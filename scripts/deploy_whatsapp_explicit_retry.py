#!/usr/bin/env python3
"""Deploy optional user-confirmed WhatsApp retry through standard API."""
import datetime,os,pathlib,subprocess,shutil,tarfile,urllib.request,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("whatsapp-retry-stage-"+STAMP)
BACKUP=ROOT/("whatsapp-retry-backup-"+STAMP+".tar.gz")
DISTOLD=ROOT/("whatsapp-retry-old-dist-"+STAMP)
API="src/lib/mhatsappApi.ts"
UI="src/components/MessageToolsModule.tsx"
PATHS=[API,UI]
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(ok,msg):
    if not ok:raise RuntimeError("STOP: "+msg)
def latest(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def patch_section(live,new,start,end):
    require(live.count(start)==1 and new.count(start)==1,"Missing/duplicate start: "+start[:80])
    a=live.index(start);b=live.find(end,a+len(start))
    c=new.index(start);d=new.find(end,c+len(start))
    require(b>a and d>c,"Section end missing: "+end[:80])
    return live[:a]+new[c:d]+live[b:]
def patch_inline(live,old,new):
    require(live.count(old)==1 and live.count(new)==0,"Unexpected old source: "+old[:75])
    return live.replace(old,new,1)
def check_health():
    for _ in range(12):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=10) as res:
                if res.status==200 and "application/json" in res.headers.get("Content-Type",""):return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError("Production API health check failed")
original={p:(LIVE/p).read_text(encoding="utf-8") for p in PATHS}
g={p:latest(p) for p in PATHS}
# Only update personalized send function to support the optional standard API.
mergedAPI=patch_section(original[API],g[API],
    "export async function sendPersonalizedBulkText(", "\n\nexport function appendMhatsappLog")
# Keep the live UI intact outside of PortalLinkManager.
uiOld=original[UI]
uiNew=g[UI]
start="  const [deliveryRows, setDeliveryRows] = useState<"
end="\n  useEffect(() => {"
mergedUI=patch_section(uiOld,uiNew,start,end)
mergedUI=patch_section(mergedUI,uiNew,
    "  const createAndSend = async (ids: string[]) => {",
    "  const visibleIds = filtered.map((item) => item.id);")
mergedUI=patch_section(mergedUI,uiNew,
    "      {info ? (\n        <div className=\"mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600\">",
    "    </section>\n  );\n}\n\nfunction ResultBox")
require(mergedUI.count('retryFailedViaStandard')>=2 and mergedUI.count('failedLinkMessages')>=3,"Retry UI patch missing")
require('"standard"' in mergedAPI and '"/api/v3/message/send/"' in mergedAPI,"Alternative endpoint missing")
merged={API:mergedAPI,UI:mergedUI}
print("Building isolated production staging...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),"--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git","-cf","-","."],stdout=subprocess.PIPE) as tar:
    unpack=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    require(tar.wait()==0 and unpack.wait()==0,"Staging copy failed")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
for p,c in merged.items():(STAGE/p).write_text(c,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build output missing")
with tarfile.open(str(BACKUP),"w:gz") as saved:
    for p in PATHS:saved.add(str(LIVE/p),arcname=p)
    saved.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup incomplete")
owners={p:(LIVE/p).stat() for p in PATHS}
changed=[]
assets=False
try:
    for p,content in merged.items():
        target=LIVE/p;st=owners[p];tmp=target.with_name(target.name+".whatsapp-retry-new")
        tmp.write_text(content,encoding="utf-8")
        os.chmod(str(tmp),st.st_mode&0o777)
        os.chown(str(tmp),st.st_uid,st.st_gid)
        os.replace(str(tmp),str(target))
        changed.append(p)
    os.rename(str(LIVE/"dist"),str(DISTOLD))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    st=owners[UI]
    for root,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(root,st.st_uid,st.st_gid)
        for item in dirs+files:os.chown(os.path.join(root,item),st.st_uid,st.st_gid)
    check_health()
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("Optional retry available ONLY for unconfirmed recipients after manual confirmation.",flush=True)
    print("No messages were sent by deployment.",flush=True)
except Exception:
    print("ERROR: restoring original sources and web assets...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as saved:
        for p in changed:
            file=saved.extractfile(p)
            require(file is not None,"Backup missing "+p)
            target=LIVE/p;target.write_bytes(file.read());st=owners[p]
            os.chmod(str(target),st.st_mode&0o777)
            os.chown(str(target),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if DISTOLD.exists():os.rename(str(DISTOLD),str(LIVE/"dist"))
    raise
