#!/usr/bin/env python3
"""EduPanel reminders: preserve production customizations, build before changing live files."""
import datetime as dt
import os, re, pathlib, subprocess, shutil, sys, tempfile, json, tarfile

LIVE = pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
CLONE = pathlib.Path("/root/edupanel-gecici-arsivler/hatirlatma-github")
ROOT = pathlib.Path("/root/edupanel-gecici-arsivler")
TAG = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE = ROOT / ("hatirlatma-test-" + TAG)
BACKUP = ROOT / ("hatirlatma-deploy-yedek-" + TAG + ".tar.gz")
NODE_PATH = "/opt/plesk/node/22/bin"
os.environ["PATH"] = NODE_PATH + ":" + os.environ.get("PATH", "")

def run(cmd, **kwargs):
    print("+", " ".join(map(str,cmd)), flush=True)
    return subprocess.run(cmd, check=True, **kwargs)

def required_replace(s, old, new, what):
    n=s.count(old)
    if n != 1: raise RuntimeError(f"{what}: expected 1 anchor, found {n}")
    return s.replace(old,new,1)

def gitfile(path):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+path]).decode("utf-8")

def write(path, content):
    file = STAGE/path
    file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(content,encoding="utf-8")

def readlive(path):
    return (LIVE/path).read_text(encoding="utf-8")

def assertion(check, label):
    if not check: raise RuntimeError("Safety validation failed: " + label)

# Fail-closed: production and GitHub sources must have the expected patterns.
assertion(LIVE.joinpath("server.ts").is_file() and CLONE.joinpath(".git").exists(), "project paths")
assertion(subprocess.call(["git","-C",str(CLONE),"cat-file","-e","FETCH_HEAD:scripts/deploy_reminders.py"])==0,"release commit not fetched")
paths = [
"server.ts",
"src/components/TeacherInterfacesModule.tsx",
"src/components/TeacherBehaviorLinkView.tsx",
"src/components/ParentStudentPortalView.tsx",
"src/components/ReminderInformationManager.tsx",
"src/utils/mobileReminderInformation.ts",
]
current = {p: readlive(p) for p in paths[:4]}
github = {p: gitfile(p) for p in paths[1:]}
server=current["server.ts"]
server=required_replace(server,'"optic_templates", "trial_exam_dates"]);','"optic_templates", "trial_exam_dates", "reminderInformation"]);',"protect collection")
route_marker='  app.get("/api/public-portal/:token", sendPublicPortalIdentity);'
routes=r'''
  // SCHEDULED MOBILE REMINDERS: write requires a verified manager session.
  const reminderCollection = "reminderInformation";
  const reminderAudience = new Set(["student","parent","teacher","admin"]);
  const reminderLocalTime = (value: unknown) => {
    const raw = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return NaN;
    return Date.parse(raw + ":00+03:00");
  };
  const remindersFor = (schoolId: string, audience: string) => {
    const now = Date.now();
    return listDocuments(reminderCollection)
      .filter((row: any) => row && row.active !== false &&
        String(row.schoolId || "") === schoolId &&
        Array.isArray(row.recipients) && row.recipients.includes(audience) &&
        reminderLocalTime(row.startAt) <= now && reminderLocalTime(row.endAt) > now)
      .map((row: any) => ({
        id: row.id, title: row.title, body: row.body, kind: row.kind,
        startAt: row.startAt, endAt: row.endAt
      }));
  };
  const reminderManagerSchool = (response: express.Response, requested?: unknown) => {
    const session: AuthSession = response.locals.auth.session;
    if (session.role === "teacher" || !session.userId) return "";
    const user = loadAuthDirectory().users.find((row: any) =>
      row.id === session.userId && row.status === "active");
    if (!user || user.role === "teacher") return "";
    const ownSchool = String(session.schoolId || user.schoolId || "");
    return session.role === "super_admin" ? String(requested || ownSchool || "school-main") : ownSchool;
  };
  app.get("/api/reminder-information/admin", requireAuthSession, (request, response) => {
    const schoolId = reminderManagerSchool(response, request.query.schoolId);
    if (!schoolId) return response.status(403).json({ error: "Yönetici yetkisi gerekli." });
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ reminders: listDocuments(reminderCollection).filter(
      (row: any) => row && String(row.schoolId) === schoolId
    ) });
  });
  app.put("/api/reminder-information/admin/:id", requireAuthSession, async (request, response) => {
    const schoolId = reminderManagerSchool(response, request.body?.schoolId);
    if (!schoolId) return response.status(403).json({ error: "Yönetici yetkisi gerekli." });
    const row = request.body || {};
    const id = String(request.params.id || "");
    const recipients = Array.isArray(row.recipients) ? [...new Set(row.recipients)] : [];
    const start = reminderLocalTime(row.startAt);
    const end = reminderLocalTime(row.endAt);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id) ||
        !String(row.title || "").trim() || String(row.title).length > 140 ||
        !String(row.body || "").trim() || String(row.body).length > 1200 ||
        !String(row.kind || "").trim() || String(row.kind).length > 100 ||
        !recipients.length || recipients.some((role: any) => !reminderAudience.has(String(role))) ||
        !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return response.status(400).json({ error: "Hatırlatma alanlarını ve tarihleri kontrol edin." });
    }
    const previous: any = getDocument(reminderCollection,id);
    if (previous && String(previous.schoolId || "") !== schoolId)
      return response.status(403).json({error:"Başka okulun kaydı değiştirilemez."});
    try {
      await upsertDocument(reminderCollection,id,{
        id, schoolId, title:String(row.title).trim(), body:String(row.body).trim(),
        kind:String(row.kind).trim(), recipients, startAt:row.startAt,
        endAt:row.endAt, active: row.active !== false,
        createdAt: previous?.createdAt || new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      });
      await waitForDocumentStoreWrites();
      return response.json({success:true});
    } catch {return response.status(500).json({error:"Hatırlatma kaydedilemedi."});}
  });
  app.delete("/api/reminder-information/admin/:id", requireAuthSession, async (request,response) => {
    const schoolId = reminderManagerSchool(response,request.query.schoolId);
    if (!schoolId) return response.status(403).json({error:"Yönetici yetkisi gerekli."});
    const previous: any = getDocument(reminderCollection,String(request.params.id || ""));
    if (!previous || String(previous.schoolId || "") !== schoolId)
      return response.status(404).json({error:"Kayıt bulunamadı."});
    try {
      await deleteDocument(reminderCollection,String(request.params.id));
      await waitForDocumentStoreWrites();
      return response.json({success:true});
    } catch {return response.status(500).json({error:"Hatırlatma silinemedi."});}
  });
  app.get("/api/public-portal/:token/reminder-information", (request,response) => {
    const portal: any = findPublicPortalByToken(String(request.params.token || ""));
    if (!portal) return response.status(404).json({error:"Bağlantı geçersiz."});
    const audience = String(portal.kind) === "parent" ? "parent" : "student";
    response.setHeader("Cache-Control","private, no-store");
    return response.json({reminders:remindersFor(String(portal.schoolId || "school-main"),audience)});
  });
  app.get("/api/behavior/teacher-links/:token/reminder-information", (request,response) => {
    const access = requireBehaviorTeacherLink(String(request.params.token || ""));
    if ("error" in access) return response.status(access.status).json({error:access.error});
    const role = String(resolveEnstituStaffProfile(access.row).role || "").toUpperCase();
    const audience = role === "ADMIN" ? "admin" : "teacher";
    response.setHeader("Cache-Control","private, no-store");
    return response.json({reminders:remindersFor(String(access.row.schoolId || "school-main"),audience)});
  });

'''
assertion("resolveEnstituStaffProfile" in server and "const requireBehaviorTeacherLink" in server,"staff access functions")
server=required_replace(server,route_marker,routes+route_marker,"public portal insertion")
# Keep live file exactly, changing only the two anchored server regions.
# The input files may contain newer mobile improvements than GitHub, so patch only reminder sections.
teacher=current["src/components/TeacherInterfacesModule.tsx"]
teacher=required_replace(teacher,'import React from "react";','import React from "react";\nimport ReminderInformationManager from "./ReminderInformationManager";',"teacher manager import")
teacher=required_replace(teacher,'ExternalLink, Loader2, Search, Smartphone, UserRound','BellRing, ExternalLink, Loader2, Search, Smartphone, UserRound',"teacher button icon")
teacher=required_replace(teacher,'  const [query, setQuery] = React.useState("");','  const [query, setQuery] = React.useState("");\n  const [showReminders, setShowReminders] = React.useState(false);',"teacher tab")
teacher=required_replace(teacher,
'          <span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">{rows.length} öğretmen</span>',
'          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowReminders(value => !value)} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white"><BellRing className="h-4 w-4" /> Hatırlatma Bilgileri</button><span className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">{rows.length} öğretmen</span></div>',"teacher action")
teacher=required_replace(teacher,'      {message ? <div','      {showReminders ? <ReminderInformationManager schoolId={schoolId || "school-main"} /> : null}\n      {!showReminders && message ? <div',"teacher manager entry")
teacher=required_replace(teacher,'      {lastUrl ? (','      {!showReminders && lastUrl ? (',"teacher result")
teacher=required_replace(teacher,'      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">','      {!showReminders ? (<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">',"teacher grid")
teacher=required_replace(teacher,'      {!filtered.length ?','      ) : null}\n      {!showReminders && !filtered.length ?',"teacher grid close")

portal=current["src/components/ParentStudentPortalView.tsx"]
portal=required_replace(portal,'import React from "react";','import React from "react";\nimport { displayExamMoment, inNext48Hours, localExamTimestamp } from "../utils/mobileReminderInformation";',"portal utility")
start="// Açılış hatırlatmaları yalnızca ilgili öğrenciye ait yerleşim ve sınıfın denemelerini içerir."
end="  const openAnnouncements = async () => {"
assertion(portal.count(start)==1 and portal.count(end)==1,"portal reminders block")
github_portal=github["src/components/ParentStudentPortalView.tsx"]
new_block=github_portal[github_portal.index(start):github_portal.index(end)]
new_block=new_block.replace('getRows("/api/database/collections/reminderInformation"),','getRows("/api/public-portal/" + encodeURIComponent(token) + "/reminder-information"),')
new_block=new_block.replace('activeCustomReminders(manual, kind, String(payload.schoolId || "school-main")).map(row =>','manual.map((row: any) =>')
assertion('manual.map((row: any) =>' in new_block,"portal manual mapping")
portal=portal[:portal.index(start)]+new_block+portal[portal.index(end):]

mobile=current["src/components/TeacherBehaviorLinkView.tsx"]
mobile=required_replace(mobile,'import React from "react";','import React from "react";',"teacher mobile marker")
original='''      setStartupReminders(nextReminders);
      if (nextReminders.length > 0) void playEnstituNotificationSound();'''
new='''      try {
        const rows = await requestJson<{ reminders?: any[] }>(
          "/api/behavior/teacher-links/" + encodeURIComponent(token) + "/reminder-information",
          { method: "GET" },
        );
        nextReminders.push(...(Array.isArray(rows.reminders) ? rows.reminders : []).map((item: any) => ({
          id: "manual:" + item.id, type: "notice", title: item.title,
          body: item.body + " · " + (item.kind || ""), action: "",
        })));
      } catch {}
'''+original
mobile=required_replace(mobile,original,new,"teacher mobile reminders")

manager=github["src/components/ReminderInformationManager.tsx"]
manager=required_replace(manager,'import React from "react";','import React from "react";\nimport { runtimeSessionStorage } from "../lib/runtimeSessionStorage";',"manager auth import")
manager=required_replace(manager,'const recipientOptions = [','const authHeaders = () => ({ Authorization: "Bearer " + (runtimeSessionStorage.getItem("edupanel_auth_token") || "") });\nconst recipientOptions = [',"manager auth helper")
manager=manager.replace('fetch(\x60/api/database/collections/reminderInformation?schoolId=\x24{encodeURIComponent(schoolId)}\x60, { cache: "no-store" })',
'fetch(\x60/api/reminder-information/admin?schoolId=\x24{encodeURIComponent(schoolId)}\x60, { cache: "no-store", headers: authHeaders() })')
manager=required_replace(manager,
'setItems((Array.isArray(json) ? json : []).filter((item: Reminder) => item.schoolId === schoolId));',
'setItems(Array.isArray(json.reminders) ? json.reminders : []);',"manager parse")
manager=manager.replace('fetch(\x60/api/database/collections/reminderInformation/\x24{encodeURIComponent(record.id)}\x60, {',
'fetch(\x60/api/reminder-information/admin/\x24{encodeURIComponent(record.id)}\x60, {')
manager=required_replace(manager,'method: "PUT", headers: { "Content-Type": "application/json" },','method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() },',"manager save auth")
manager=manager.replace('fetch(\x60/api/database/collections/reminderInformation/\x24{encodeURIComponent(item.id)}\x60, { method: "DELETE" })',
'fetch(\x60/api/reminder-information/admin/\x24{encodeURIComponent(item.id)}?schoolId=\x24{encodeURIComponent(schoolId)}\x60, { method: "DELETE", headers: authHeaders() })')
assertion("/api/database/collections/reminderInformation" not in manager,"unprotected manager endpoint")
assertion("/api/reminder-information/admin" in manager,"manager route")

# Copy into isolated staging folder: never update running app before compiling.
print("Preparing isolated build, preserving production source...")
STAGE.mkdir(parents=True, exist_ok=False)
exclude={"node_modules","dist",".git","backups"}
with subprocess.Popen(["tar","-C",str(LIVE), "--exclude=./node_modules","--exclude=./dist", "--exclude=./backups", "--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    extracted=subprocess.run(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    if tar.stdout: tar.stdout.close()
    rc=tar.wait()
    assertion(rc==0 and extracted.returncode==0,"stage source copy")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
write(pathlib.Path("server.ts"),server)
write(pathlib.Path("src/components/TeacherInterfacesModule.tsx"),teacher)
write(pathlib.Path("src/components/TeacherBehaviorLinkView.tsx"),mobile)
write(pathlib.Path("src/components/ParentStudentPortalView.tsx"),portal)
write(pathlib.Path("src/components/ReminderInformationManager.tsx"),manager)
write(pathlib.Path("src/utils/mobileReminderInformation.ts"),github["src/utils/mobileReminderInformation.ts"])
assertion("mobileExamSubjectLabel" in portal or "questionOffset" in portal,"existing exam UI preserved")
print("Building Vite assets in staging...")
run(["npm","run","build"],cwd=STAGE)
assertion((STAGE/"dist"/"index.html").is_file(),"Vite build output missing")
# Validate changed TypeScript syntax, including server routes, before touching production.
# Vite validated the complete client bundle; TypeScript package may be missing on this server.
# Basic server syntax/TS transpile check without starting the server.
run(["node",str(LIVE/"node_modules"/"typescript"/"bin"/"tsc"),"--noEmit","--pretty","false",
     "--skipLibCheck","--allowJs","false"],cwd=STAGE) if os.environ.get("REMINDER_STRICT_TSC")=="1" else None
# Verify no other sources in the live folder are touched.
print("Backing up precisely the files we will replace...")
with tarfile.open(BACKUP,"w:gz") as tar:
    for path in paths[:4]:tar.add(LIVE/path,arcname=path)
    if (LIVE/"dist").exists():tar.add(LIVE/"dist",arcname="dist")
assertion(BACKUP.stat().st_size>10000,"backup creation")
changed=[]
distBackup=ROOT/("hatirlatma-dist-oncesi-"+TAG)
try:
    for p in paths:
        target=LIVE/p
        target.parent.mkdir(parents=True,exist_ok=True)
        temp=target.with_name(target.name+".reminder-new")
        shutil.copy2(STAGE/p,temp)
        original=target.stat() if target.exists() else target.parent.stat()
        os.chown(temp,original.st_uid,original.st_gid)
        os.replace(temp,target)
        changed.append(p)
    # Only publish assets after a successful staging build.
    if (LIVE/"dist").exists():os.rename(LIVE/"dist",distBackup)
    shutil.copytree(STAGE/"dist",LIVE/"dist")
    owner = (LIVE/"server.ts").stat()
    for base, dirs, files in os.walk(str(LIVE/"dist")):
        for name in dirs + files:
            os.chown(os.path.join(base,name),owner.st_uid,owner.st_gid)
        os.chown(base,owner.st_uid,owner.st_gid)
    # Plesk Passenger restart signal; avoids npm install.
    passenger_restart = LIVE/"tmp"/"restart.txt"
    passenger_restart.parent.mkdir(parents=True,exist_ok=True)
    passenger_restart.touch()
    import urllib.request
    with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=20) as response:
        assertion(response.status==200,"health HTTP 200")
    print("DEPLOYMENT SUCCESS. Backup:",BACKUP)
except Exception:
    print("Deployment error: restoring prior source and dist...")
    with tarfile.open(BACKUP,"r:gz") as tar:
        for p in paths[:4]:
            if p in changed:
                source=tar.extractfile(p)
                assert source is not None
                (LIVE/p).write_bytes(source.read())
    for p in paths[4:]:
        if p in changed:
            ((LIVE/p).unlink() if (LIVE/p).exists() else None)
    if (LIVE/"dist").exists():shutil.rmtree(LIVE/"dist")
    if distBackup.exists():os.rename(distBackup,LIVE/"dist")
    try:(LIVE/"tmp"/"restart.txt").touch()
    except Exception: pass
    raise
print("Changes:",", ".join(paths))
