#!/usr/bin/env python3
"""Update only WhatsApp API acceptance labels, not sending logic."""
import datetime,os,pathlib,subprocess,shutil,tarfile,urllib.request
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("wa-delivery-labels-stage-"+STAMP)
BACKUP=ROOT/("wa-delivery-labels-backup-"+STAMP+".tar.gz")
OLD_DIST=ROOT/("wa-delivery-labels-old-dist-"+STAMP)
REL="src/components/MessageToolsModule.tsx"
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(ok,msg):
    if not ok:raise RuntimeError("STOP: "+msg)
def section(text,start,end):
    require(text.count(start)==1 and text.count(end)==1,"Missing or duplicate anchor")
    i=text.index(start);j=text.index(end,i+len(start))
    require(j>i,"Invalid anchor order")
    return i,j
live=(LIVE/REL).read_text(encoding="utf-8")
latest=subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+REL]).decode("utf-8")
START="  const createAndSend = async (ids: string[]) => {"
END="  const visibleIds = filtered.map((item) => item.id);"
i,j=section(live,START,END)
a,b=section(latest,START,END)
old=live[i:j];new=latest[a:b]
require("WhatsApp onaylı" in old and "API tarafından kabul edilen" in new,"Unexpected live or GitHub labels")
require("retryFailedViaStandard" in old and "retryFailedViaStandard" in new,"Existing retry handler missing")
merged=live[:i]+new+live[j:]
print("Building isolated frontend...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as src:
    dst=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=src.stdout)
    src.stdout.close()
    require(src.wait()==0 and dst.wait()==0,"Staging copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/REL).write_text(merged,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build output missing")
with tarfile.open(str(BACKUP),"w:gz") as archive:
    archive.add(str(LIVE/REL),arcname=REL)
    archive.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup incomplete")
st=(LIVE/REL).stat()
updated=False;assets=False
try:
    tmp=(LIVE/REL).with_name("MessageToolsModule.tsx.delivery-label-new")
    tmp.write_text(merged,encoding="utf-8")
    os.chmod(str(tmp),st.st_mode&0o777)
    os.chown(str(tmp),st.st_uid,st.st_gid)
    os.replace(str(tmp),str(LIVE/REL))
    updated=True
    os.rename(str(LIVE/"dist"),str(OLD_DIST))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    for directory,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(directory,st.st_uid,st.st_gid)
        for n in dirs+files:os.chown(os.path.join(directory,n),st.st_uid,st.st_gid)
    with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=20) as resp:
        require(resp.status==200,"Health check failed")
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("API acceptance and phone delivery no longer conflated; no messages sent.",flush=True)
except Exception:
    print("ERROR: Restoring old source and assets...",flush=True)
    if updated:
        with tarfile.open(str(BACKUP),"r:gz") as archive:
            f=archive.extractfile(REL);require(f is not None,"Missing backup")
            (LIVE/REL).write_bytes(f.read())
        os.chmod(str(LIVE/REL),st.st_mode&0o777)
        os.chown(str(LIVE/REL),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if OLD_DIST.exists():os.rename(str(OLD_DIST),str(LIVE/"dist"))
    raise
