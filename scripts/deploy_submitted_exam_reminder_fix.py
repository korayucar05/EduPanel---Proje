#!/usr/bin/env python3
"""Apply only the authenticated exam reminder filtering fix; protect data and unrelated code."""
import datetime,os,pathlib,subprocess,tarfile,shutil,urllib.request,urllib.error,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP=ROOT/("sinav-cevap-hatirlatma-yedek-"+STAMP+".tar.gz")
SERVER=LIVE/"server.ts"
start="  // BEGIN STUDENT_EXAM_OPENING_REMINDERS_V2"
end="  // END STUDENT_EXAM_OPENING_REMINDERS_V2"
old='''        if (electronic && Array.isArray(exam.studentTxtRecords) &&
            exam.studentTxtRecords.some((record: any) => trialClubRecordMatchesPortal(record, portal))) continue;'''
new='''        const alreadySubmitted = electronic && Array.isArray(exam.studentTxtRecords) &&
          exam.studentTxtRecords.some((record: any) => trialClubRecordMatchesPortal(record, portal));'''
oldtext='''          electronic && club ? "Deneme Kulübü → Sınav butonundan elektronik optik formunu doldurun." : "",
          electronic && club ? "Sınavı bitirince Kaydet butonuna tıklamayı unutmayın. Kayıt tek seferliktir." : "",'''
newtext='''          electronic && club && !alreadySubmitted ? "Deneme Kulübü → Sınav butonundan elektronik optik formunu doldurun." : "",
          electronic && club && !alreadySubmitted ? "Sınavı bitirince Kaydet butonuna tıklamayı unutmayın. Kayıt tek seferliktir." : "",
          electronic && club && alreadySubmitted ? "Elektronik optik cevaplarınız kaydedilmiş. Tekrar gönderim yapılamaz." : "",'''
def require(ok,msg):
    if not ok: raise RuntimeError("STOP: "+msg)
def section(source):
    require(source.count(start)==1 and source.count(end)==1,"Reminder section missing or duplicate")
    a=source.index(start)
    b=source.index(end,a)+len(end)
    return a,b
def restart():
    passenger=shutil.which("passenger-config")
    if passenger:
        result=subprocess.call([passenger,"restart-app",str(LIVE)])
        if result==0:return
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
def api_health():
    for attempt in range(12):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=10) as response:
                if response.status==200 and "application/json" in response.headers.get("Content-Type",""):return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError("Production API failed health verification")
require(SERVER.is_file(),"Live server.ts missing")
live=SERVER.read_text(encoding="utf-8")
github=subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:server.ts"]).decode("utf-8")
la,lb=section(live)
ga,gb=section(github)
require(live[la:lb].count(old)==1 and live[la:lb].count(oldtext)==1,"Live code changed; refusing unsafe patch")
require(github[ga:gb].count(new)==1 and github[ga:gb].count(newtext)==1,"GitHub fix not found")
merged=live[:la]+github[ga:gb]+live[lb:]
require(merged.count("const alreadySubmitted = electronic") == 1,"Resulting fix invalid")
with tarfile.open(str(BACKUP),"w:gz") as saved:
    saved.add(str(SERVER),arcname="server.ts")
require(BACKUP.stat().st_size>10000,"Backup incomplete")
stat=SERVER.stat()
temp=SERVER.with_name("server.ts.reminder-fix-new")
try:
    temp.write_text(merged,encoding="utf-8")
    os.chmod(str(temp),stat.st_mode & 0o777)
    os.chown(str(temp),stat.st_uid,stat.st_gid)
    os.replace(str(temp),str(SERVER))
    restart()
    api_health()
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Submitted exam responses remain untouched; reminder now stays visible",flush=True)
except Exception:
    print("ERROR: Restoring original server.ts...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as saved:
        source=saved.extractfile("server.ts")
        require(source is not None,"Backup missing source")
        SERVER.write_bytes(source.read())
        os.chmod(str(SERVER),stat.st_mode & 0o777)
        os.chown(str(SERVER),stat.st_uid,stat.st_gid)
    restart()
    raise
