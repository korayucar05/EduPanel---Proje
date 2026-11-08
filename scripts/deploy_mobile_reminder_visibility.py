#!/usr/bin/env python3
"""Deploy only student mobile reminder visibility, preserving unrelated edits."""
import datetime,os,pathlib,subprocess,shutil,tarfile,urllib.request
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("hatirlatma-gorunum-test-"+STAMP)
BACKUP=ROOT/("hatirlatma-gorunum-yedek-"+STAMP+".tar.gz")
DISTOLD=ROOT/("hatirlatma-gorunum-eski-dist-"+STAMP)
PORTAL="src/components/ParentStudentPortalView.tsx"
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(ok,msg):
    if not ok:raise RuntimeError("STOP: "+msg)
def repo(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def patch(live,new):
    begin="  // Öğrencinin açılış bildirimleri, sunucuda kendi bağlantı anahtarıyla yetkilendirilir."
    end="  const openAnnouncements = async () => {"
    condition='{openingReminderVisible && view === "home" && openingReminders.length > 0 ? ('
    replacement='{openingReminderVisible && openingReminders.length > 0 ? ('
    require(new.count(begin)==1 and new.count(end)==1 and new.count(replacement)==1,"GitHub reminder source mismatch")
    require(live.count(begin)==1 and live.count(end)==1,"Live reminder source mismatch")
    a=live.index(begin);b=live.index(end,a)
    na=new.index(begin);nb=new.index(end,na)
    result=live[:a]+new[na:nb]+live[b:]
    require(result.count(condition)==1 and result.count(replacement)==0,"Live modal visibility source mismatch")
    result=result.replace(condition,replacement,1)
    require(result.count(replacement)==1 and 'visibilitychange' in result,"Patch not applied")
    return result
require((LIVE/PORTAL).is_file(),"Live portal file not found")
live=(LIVE/PORTAL).read_text(encoding="utf-8")
new=repo(PORTAL)
merged=patch(live,new)
print("Preparing staged frontend build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    out=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    require(tar.wait()==0 and out.wait()==0,"Stage copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/PORTAL).write_text(merged,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build output absent")
print("Backing up live portal and web assets...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as saved:
    saved.add(str(LIVE/PORTAL),arcname=PORTAL)
    saved.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup too small")
st=(LIVE/PORTAL).stat()
updated=False
assets=False
try:
    tmp=(LIVE/PORTAL).with_name("ParentStudentPortalView.tsx.reminder-new")
    tmp.write_text(merged,encoding="utf-8")
    os.chmod(str(tmp),st.st_mode & 0o777)
    os.chown(str(tmp),st.st_uid,st.st_gid)
    os.replace(str(tmp),str(LIVE/PORTAL))
    updated=True
    os.rename(str(LIVE/"dist"),str(DISTOLD))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    for base,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(base,st.st_uid,st.st_gid)
        for name in dirs+files:os.chown(os.path.join(base,name),st.st_uid,st.st_gid)
    with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=30) as response:
        require(response.status==200 and "application/json" in response.headers.get("Content-Type",""),"API health failed")
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Student reminder visibility updated; API unchanged",flush=True)
except Exception:
    print("Deployment failed; restoring originals...",flush=True)
    if updated:
        with tarfile.open(str(BACKUP),"r:gz") as saved:
            file=saved.extractfile(PORTAL)
            require(file is not None,"Portal missing in backup")
            (LIVE/PORTAL).write_bytes(file.read())
            os.chown(str(LIVE/PORTAL),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    raise
