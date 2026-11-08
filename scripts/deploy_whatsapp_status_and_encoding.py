#!/usr/bin/env python3
"""Deploy accurate WhatsApp acceptance statuses, per-student copy links, and UTF-8 errors."""
import datetime,os,pathlib,subprocess,tarfile,shutil,urllib.request,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("whatsapp-status-stage-"+STAMP)
BACKUP=ROOT/("whatsapp-status-backup-"+STAMP+".tar.gz")
DISTOLD=ROOT/("whatsapp-status-old-dist-"+STAMP)
UI="src/components/MessageToolsModule.tsx"
SERVER="server.ts"
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(condition,msg):
    if not condition:raise RuntimeError("STOP: "+msg)
def latest(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def patch(live,new,start,end):
    require(live.count(start)==1 and new.count(start)==1,"Start anchor missing or duplicate")
    a=live.index(start);b=live.find(end,a+len(start))
    c=new.index(start);d=new.find(end,c+len(start))
    require(b>a and d>c,"End anchor missing")
    return live[:a]+new[c:d]+live[b:]
def replace_exact(live,old,new):
    require(live.count(old)==1 and live.count(new)==0,"Unexpected live content near "+old[:50])
    return live.replace(old,new,1)
def health():
    for i in range(12):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=10) as resp:
                if resp.status==200 and "application/json" in resp.headers.get("Content-Type",""):return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError("API health not ready")
liveUI=(LIVE/UI).read_text(encoding="utf-8")
newUI=latest(UI)
liveServer=(LIVE/SERVER).read_text(encoding="utf-8")
newServer=latest(SERVER)
typeOld='  const [deliveryRows, setDeliveryRows] = useState<Array<{ id: string; name: string; number: string; status: string; ok: boolean }>>([]);'
typeNew='  const [deliveryRows, setDeliveryRows] = useState<Array<{ id: string; name: string; number: string; status: string; ok: boolean; url?: string }>>([]);'
updatedUI=replace_exact(liveUI,typeOld,typeNew)
updatedUI=patch(updatedUI,newUI,
    "  const createAndSend = async (ids: string[]) => {",
    "  const visibleIds = filtered.map((item) => item.id);")
updatedUI=patch(updatedUI,newUI,
    '      {deliveryRows.length > 0 ? (\n        <div className="mt-3 max-h-64',
    '    </section>\n  );\n}\n\nfunction ResultBox')
require('bg-amber-50 text-amber-900' in updatedUI and 'Linki Kopyala' in updatedUI,"UI statuses or copy link missing")
serverOld='mHatsapp sunucusuna ulaÅŸÄ±ldÄ± ancak mesaj kimliÄŸi veya gÃ¶nderim onayÄ± alÄ±namadÄ±. mHatsapp panelindeki telefon baÄŸlantÄ±sÄ±nÄ± ve token durumunu kontrol edin.'
serverNew='mHatsapp API isteğine HTTP 200 yanıtı verdi fakat gönderim onayı veya mesaj kimliği bulunamadı. Mesajın telefona teslim edildiği doğrulanmadı.'
serverTimeoutOld='mHatsapp sunucusu 20 saniye iÃ§inde yanÄ±t vermedi. GÃ¶nderim beklemesi sonlandÄ±rÄ±ldÄ±.'
serverTimeoutNew='mHatsapp sunucusu 20 saniye içinde yanıt vermedi. Gönderim doğrulanamadı.'
require(newServer.count(serverNew)==1 and newServer.count(serverTimeoutNew)==1,"GitHub server patch missing")
updatedServer=replace_exact(liveServer,serverOld,serverNew)
updatedServer=replace_exact(updatedServer,serverTimeoutOld,serverTimeoutNew)
print("Preparing isolated production build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as src:
    dest=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=src.stdout)
    src.stdout.close()
    require(src.wait()==0 and dest.wait()==0,"Stage copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
(STAGE/UI).write_text(updatedUI,encoding="utf-8")
(STAGE/SERVER).write_text(updatedServer,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build output absent")
print("Backing up live code and built assets...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as archive:
    archive.add(str(LIVE/UI),arcname=UI)
    archive.add(str(LIVE/SERVER),arcname=SERVER)
    archive.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup incomplete")
owner={rel:(LIVE/rel).stat() for rel in (UI,SERVER)}
changed=[]
assets=False
try:
    for rel,content in [(UI,updatedUI),(SERVER,updatedServer)]:
        target=LIVE/rel;st=owner[rel]
        tmp=target.with_name(target.name+".whatsapp-status-new")
        tmp.write_text(content,encoding="utf-8")
        os.chmod(str(tmp),st.st_mode&0o777)
        os.chown(str(tmp),st.st_uid,st.st_gid)
        os.replace(str(tmp),str(target))
        changed.append(rel)
    os.rename(str(LIVE/"dist"),str(DISTOLD))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    st=owner[UI]
    for root,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(root,st.st_uid,st.st_gid)
        for name in dirs+files:os.chown(os.path.join(root,name),st.st_uid,st.st_gid)
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
    health()
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Status colors corrected, personal link copying available, Turkish provider errors corrected.",flush=True)
    print("No WhatsApp messages sent, no webhook changed.",flush=True)
except Exception:
    print("ERROR: Restoring original source files and static assets...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as archive:
        for rel in changed:
            part=archive.extractfile(rel)
            require(part is not None,"Backup source missing "+rel)
            target=LIVE/rel;target.write_bytes(part.read())
            st=owner[rel]
            os.chmod(str(target),st.st_mode&0o777)
            os.chown(str(target),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
    raise
