#!/usr/bin/env python3
"""Deploy only student exam reminders, preserving all other live code and DB."""
import datetime, os, pathlib, subprocess, shutil, tarfile, urllib.request, sys
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
REL="src/components/ParentStudentPortalView.tsx"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("ogrenci-sinav-hatirlatma-test-"+STAMP)
BACKUP=ROOT/("ogrenci-sinav-hatirlatma-yedek-"+STAMP+".tar.gz")
DISTOLD=ROOT/("ogrenci-sinav-dist-oncesi-"+STAMP)
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def ensure(flag,message):
    if not flag: raise RuntimeError(message)
def shell(args, **options):
    print("+"," ".join(map(str,args)),flush=True)
    subprocess.check_call(args,**options)
def source(text):
    start="  // Açılış hatırlatmaları yalnızca ilgili öğrenciye ait yerleşim ve sınıfın denemelerini içerir."
    alternate="  // Öğrencinin kendi sınavlarına ait hatırlatmalar, açılıştan itibaren 48 saatlik pencerede görünür."
    end="  const openAnnouncements = async () => {"
    a=text.find(start)
    if a<0:a=text.find(alternate)
    b=text.find(end,a)
    ensure(a>=0 and b>a and text.count(end)==1,"Reminder section anchor missing")
    return a,b
ensure((LIVE/REL).is_file(),"Production student portal source missing")
ensure("reminderInformation" in (LIVE/"server.ts").read_text(encoding="utf-8"),"Previous secure reminder API is missing")
ensure(subprocess.call(["git","-C",str(CLONE),"cat-file","-e","FETCH_HEAD:"+REL])==0,"GitHub portal not fetched")
latest=subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+REL]).decode("utf-8")
current=(LIVE/REL).read_text(encoding="utf-8")
ga,gb=source(latest); ca,cb=source(current)
new=current[:ca]+latest[ga:gb]+current[cb:]
ensure(new!=current,"No changed code to deploy")
ensure("mobileExamSubjectLabel" in new or "questionOffset" in new,"Unexpected removal of existing student exam formatting")
ensure("trial-club" in new and "48" in new,"Reminder logic incomplete")
print("Preparing isolated build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),
"--exclude=./node_modules","--exclude=./dist",
"--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    reader=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    ensure(tar.wait()==0 and reader.wait()==0,"Stage copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/REL).write_text(new,encoding="utf-8")
shell(["npm","run","build"],cwd=str(STAGE))
ensure((STAGE/"dist"/"index.html").is_file(),"Built index missing")
print("Saving source and assets backup...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as backup:
    backup.add(str(LIVE/REL),arcname=REL)
    if (LIVE/"dist").is_dir():backup.add(str(LIVE/"dist"),arcname="dist")
ensure(BACKUP.stat().st_size>10000,"Backup missing")
installed=False
assets_changed=False
try:
    target=LIVE/REL
    owner=target.stat()
    temporary=target.with_name(target.name+".new-reminder")
    temporary.write_text(new,encoding="utf-8")
    os.chmod(str(temporary),owner.st_mode & 0o777)
    os.chown(str(temporary),owner.st_uid,owner.st_gid)
    os.replace(str(temporary),str(target))
    installed=True
    if (LIVE/"dist").is_dir():
        os.rename(str(LIVE/"dist"),str(DISTOLD))
    assets_changed=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    # Preserve web hosting ownership for the generated assets.
    for base,dirs,files in os.walk(str(LIVE/"dist")):
        for name in dirs+files:
            os.chown(os.path.join(base,name),owner.st_uid,owner.st_gid)
        os.chown(base,owner.st_uid,owner.st_gid)
    # Passenger restart without triggering npm reinstall.
    rest=LIVE/"tmp"/"restart.txt"
    rest.parent.mkdir(parents=True,exist_ok=True)
    rest.touch()
    with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=30) as response:
        ensure(response.status==200,"HTTP health check failed")
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Updated only "+REL+" and built dist",flush=True)
except Exception:
    print("Rolling back...",flush=True)
    if installed:
        with tarfile.open(str(BACKUP),"r:gz") as backup:
            f=backup.extractfile(REL)
            ensure(f is not None,"Unable to open backup")
            (LIVE/REL).write_bytes(f.read())
        os.chown(str(LIVE/REL),owner.st_uid,owner.st_gid)
    if assets_changed:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    (LIVE/"tmp"/"restart.txt").touch()
    raise
