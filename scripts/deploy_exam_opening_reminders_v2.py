#!/usr/bin/env python3
"""EduPanel: token-scoped trial club, school and common-exam opening reminders.
Apply only two known code regions; preserve all other live changes.
"""
import datetime, os, pathlib, subprocess, shutil, tarfile, urllib.request
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("sinav-acilis-test-"+STAMP)
BACKUP=ROOT/("sinav-acilis-yedek-"+STAMP+".tar.gz")
DISTOLD=ROOT/("sinav-acilis-eski-dist-"+STAMP)
PORTAL="src/components/ParentStudentPortalView.tsx"
SERVER="server.ts"
PATHS=[SERVER,PORTAL]
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(value,label):
    if not value: raise RuntimeError("STOP: "+label)
def shell(args,**opts):
    print("+"," ".join(map(str,args)),flush=True)
    subprocess.check_call(args,**opts)
def read(rel):
    return (LIVE/rel).read_text(encoding="utf-8")
def github(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def region(text,start,end):
    a=text.find(start); b=text.find(end,a+len(start))
    require(a>=0 and b>a and text.count(start)==1 and text.count(end)==1,"patch anchor mismatch")
    return a,b
require((LIVE/PORTAL).is_file() and (LIVE/SERVER).is_file(),"missing live files")
for p in PATHS:
    require(subprocess.call(["git","-C",str(CLONE),"cat-file","-e","FETCH_HEAD:"+p])==0,"GitHub file missing: "+p)
newPortal=github(PORTAL)
livePortal=read(PORTAL)
start='  // Öğrencinin açılış bildirimleri, sunucuda kendi bağlantı anahtarıyla yetkilendirilir.'
oldStart='  // Öğrencinin kendi sınavlarına ait hatırlatmalar, açılıştan itibaren 48 saatlik pencerede görünür.'
end='  const openAnnouncements = async () => {'
ga,gb=region(newPortal,start,end)
if start not in livePortal:
    require(livePortal.count(oldStart)==1,"Live mobile reminders section not found")
    oldA=livePortal.index(oldStart)
else:
    require(livePortal.count(start)==1,"Multiple live mobile reminder sections")
    oldA=livePortal.index(start)
oldB=livePortal.index(end,oldA)
require(oldB>oldA,"Invalid mobile section end")
mergedPortal=livePortal[:oldA]+newPortal[ga:gb]+livePortal[oldB:]
require("exam-opening-reminders" in mergedPortal,"Missing student API")
# Existing mobile exam formatting is outside this change and must be identical.
require(mergedPortal[:oldA]==livePortal[:oldA] and mergedPortal[oldA+len(newPortal[ga:gb]):]==livePortal[oldB:],"Other portal content would change")
liveServer=read(SERVER)
newServer=github(SERVER)
begin="  // BEGIN STUDENT_EXAM_OPENING_REMINDERS_V2"
finish="  // END STUDENT_EXAM_OPENING_REMINDERS_V2"
gs,ge=region(newServer,begin,finish)
insertion=newServer[gs:ge+len(finish)]
require(liveServer.count(begin)==0 and liveServer.count(finish)==0,"Live already has this endpoint: refusing duplicate")
anchor='  const trialTimedEnd = (exam: any) => { const start = trialTimedStart(exam); return start ? start + trialTimedDuration(exam) * 60_000 : 0; };'
require(liveServer.count(anchor)==1,"Exam schedule source marker missing")
mergedServer=liveServer.replace(anchor,anchor+"\n"+insertion,1)
require('const trialClubRegistrationForPortal' in liveServer and 'const findPublicPortalByToken' in liveServer,"Identity checks unavailable")
require('app.get("/api/public-portal/:token/exam-opening-reminders"' in mergedServer,"API not created")
print("Preparing temporary staging build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    out=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    require(tar.wait()==0 and out.wait()==0,"Staging copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/SERVER).write_text(mergedServer,encoding="utf-8")
(STAGE/PORTAL).write_text(mergedPortal,encoding="utf-8")
shell(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Vite build output missing")
print("Backing up both live sources and built assets...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as out:
    for rel in PATHS: out.add(str(LIVE/rel),arcname=rel)
    if (LIVE/"dist").is_dir():out.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup failure")
owners={}
changed=[]
assetsChanged=False
try:
    for rel,content in [(SERVER,mergedServer),(PORTAL,mergedPortal)]:
        dst=LIVE/rel
        owner=dst.stat()
        owners[rel]=owner
        temp=dst.with_name(dst.name+".exam-reminder-new")
        temp.write_text(content,encoding="utf-8")
        os.chmod(str(temp),owner.st_mode & 0o777)
        os.chown(str(temp),owner.st_uid,owner.st_gid)
        os.replace(str(temp),str(dst))
        changed.append(rel)
    if (LIVE/"dist").is_dir():
        os.rename(str(LIVE/"dist"),str(DISTOLD))
    assetsChanged=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    owner=owners[PORTAL]
    for base,dirs,files in os.walk(str(LIVE/"dist")):
        for name in dirs+files: os.chown(os.path.join(base,name),owner.st_uid,owner.st_gid)
        os.chown(base,owner.st_uid,owner.st_gid)
    rest=LIVE/"tmp"/"restart.txt"
    rest.parent.mkdir(parents=True,exist_ok=True)
    rest.touch()
    with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=30) as check:
        require(check.status==200,"Health check failed")
    # A fake token must be rejected by the new authenticated endpoint.
    test="https://edupanel.dersbende.com/api/public-portal/not-valid/exam-opening-reminders"
    try:
        urllib.request.urlopen(test,timeout=20)
        raise RuntimeError("Unsafe: invalid token accepted by exam reminder API")
    except urllib.error.HTTPError as error:
        require(error.code==404,"New API returned unexpected HTTP "+str(error.code))
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Exam reminders: school students + registered trial club + assigned seating",flush=True)
except Exception:
    print("ERROR: Restoring source and static assets...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as saved:
        for rel in changed:
            f=saved.extractfile(rel)
            require(f is not None,"Cannot restore "+rel)
            (LIVE/rel).write_bytes(f.read())
            os.chown(str(LIVE/rel),owners[rel].st_uid,owners[rel].st_gid)
    if assetsChanged:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    (LIVE/"tmp"/"restart.txt").touch()
    raise
