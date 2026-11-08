#!/usr/bin/env python3
"""Safely deploy minimal trial-club autosave and simple exam reminders."""
import datetime,os,pathlib,subprocess,shutil,tarfile,urllib.request,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("deneme-oto-kayit-test-"+STAMP)
BACKUP=ROOT/("deneme-oto-kayit-yedek-"+STAMP+".tar.gz")
DISTOLD=ROOT/("deneme-oto-kayit-eski-dist-"+STAMP)
SERVER="server.ts"
OPTIC="src/components/TrialClubView.tsx"
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(ok,msg):
    if not ok:raise RuntimeError("STOP: "+msg)
def github(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def region(source,begin,end):
    require(source.count(begin)==1,"Expected one start anchor: "+begin[:70])
    a=source.index(begin)
    b=source.find(end,a+len(begin))
    require(b>a,"Missing end anchor: "+end[:70])
    return a,b
def replace_region(live,latest,begin,end):
    a,b=region(live,begin,end)
    c,d=region(latest,begin,end)
    return live[:a]+latest[c:d]+live[b:]
def replace_once(live,old,new):
    require(live.count(old)==1,"Missing/duplicate old fragment: "+old[:100])
    return live.replace(old,new,1)
def restart():
    # Plesk Passenger may have a socket-path error with passenger-config.
    # Use Passenger's standard restart marker, not npm redeploy.
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
def health():
    for i in range(12):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=10) as resp:
                if resp.status==200 and "application/json" in resp.headers.get("Content-Type",""):return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError("API health failed")
require((LIVE/SERVER).is_file() and (LIVE/OPTIC).is_file(),"Live files missing")
latestServer=github(SERVER)
latestOptic=github(OPTIC)
currentServer=(LIVE/SERVER).read_text(encoding="utf-8")
currentOptic=(LIVE/OPTIC).read_text(encoding="utf-8")
# Only alter the reminder details and end-of-exam background evaluation loop.
remindBegin='        const detail = '
remindEnd='      }\n      // Seat assignments are included'
sA,sB=region(currentServer,'  // BEGIN STUDENT_EXAM_OPENING_REMINDERS_V2','  // END STUDENT_EXAM_OPENING_REMINDERS_V2')
gA,gB=region(latestServer,'  // BEGIN STUDENT_EXAM_OPENING_REMINDERS_V2','  // END STUDENT_EXAM_OPENING_REMINDERS_V2')
livePart=currentServer[sA:sB]; newPart=latestServer[gA:gB]
require(livePart.count(remindBegin)==1 and newPart.count(remindBegin)==1,"Reminder detail marker mismatch")
livePart=replace_region(livePart,newPart,remindBegin,remindEnd)
mergedServer=currentServer[:sA]+livePart+currentServer[sB:]
mergedServer=replace_region(mergedServer,latestServer,'  const trialAutoEvaluationPending = () => {','  // Sunucu çalışırken 15 sn aralıklarla kontrol et; ilk tarama açılışta yapılır.')
require('title:"Deneme Sınavınız Var"' in mergedServer,"Simple reminder not applied")
require('const finalizedRecords = records.map' in mergedServer,"Auto-finalization not applied")
# Only alter the draft-save state, effects, handlers and optic display.
mergedOptic=replace_region(currentOptic,latestOptic,'  const [electronicSaving, setElectronicSaving] = React.useState(false);','  const [selectedAnswerDetail, setSelectedAnswerDetail]')
mergedOptic=replace_region(mergedOptic,latestOptic,'  const selectedExam = exams.find((exam) => exam.id === selectedExamId) || null;','  React.useEffect(() => {\n    if (!selectedExam?.electronic || !selectedExam.endsAt || selectedExam.answerKey || clock + clockOffset < selectedExam.endsAt) return;')
mergedOptic=replace_region(mergedOptic,latestOptic,'  const openExam = (exam: TrialClubExam) => {','  const closeExam = () => {')
mergedOptic=replace_region(mergedOptic,latestOptic,'  const setElectronicAnswer = (subjectName: string, questionIndex: number, option: string) => {','  const formatCountdown = (milliseconds: number) => {')
mergedOptic=replace_once(mergedOptic,'onClick={() => { setElectronicBooklet(booklet); setError(""); }}','onClick={() => { setElectronicBooklet(booklet); setElectronicRevision((value) => value + 1); setError(""); }}')
mergedOptic=replace_once(mergedOptic,'Sınav sona ermiştir. Şu andan itibaren cevaplama işlemi yapılamayacaktır. Kaydet tuşuna basarak optik formu kapatabilirsiniz.','Sınav süresi doldu. Kaydedilmiş cevaplar otomatik olarak kesinleştirilir ve değerlendirmeye alınır.')
mergedOptic=replace_once(mergedOptic,'{!pending && !exam.finalized ? <><div className=','{!pending && !expired && !exam.finalized ? <><div className=')
require('persistElectronicDraft' in mergedOptic and 'electronicAutoSaveQueue' in mergedOptic,"Draft save not applied")
require(currentServer!=mergedServer and currentOptic!=mergedOptic,"No changes detected")
print("Staging production build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    out=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    require(tar.wait()==0 and out.wait()==0,"Staging copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/SERVER).write_text(mergedServer,encoding="utf-8")
(STAGE/OPTIC).write_text(mergedOptic,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build output missing")
print("Backing up source and static assets...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as saved:
    saved.add(str(LIVE/SERVER),arcname=SERVER)
    saved.add(str(LIVE/OPTIC),arcname=OPTIC)
    saved.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup incomplete")
owners={rel:(LIVE/rel).stat() for rel in [SERVER,OPTIC]}
changed=[]
assets=False
try:
    for rel,content in [(SERVER,mergedServer),(OPTIC,mergedOptic)]:
        dst=LIVE/rel
        temp=dst.with_name(dst.name+".deneme-oto-kayit-new")
        temp.write_text(content,encoding="utf-8")
        st=owners[rel]
        os.chmod(str(temp),st.st_mode & 0o777)
        os.chown(str(temp),st.st_uid,st.st_gid)
        os.replace(str(temp),str(dst))
        changed.append(rel)
    os.rename(str(LIVE/"dist"),str(DISTOLD))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    st=owners[OPTIC]
    for base,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(base,st.st_uid,st.st_gid)
        for name in dirs+files:os.chown(os.path.join(base,name),st.st_uid,st.st_gid)
    restart()
    health()
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Reminder: Deneme Sınavınız Var + date/time only",flush=True)
    print("Electronic optical: repeatable save, automatic draft save, expiry finalization",flush=True)
except Exception:
    print("Deployment failed: restoring original source and assets...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as saved:
        for rel in changed:
            content=saved.extractfile(rel)
            require(content is not None,"Missing backup file: "+rel)
            (LIVE/rel).write_bytes(content.read())
            st=owners[rel]
            os.chmod(str(LIVE/rel),st.st_mode & 0o777)
            os.chown(str(LIVE/rel),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    restart()
    raise
