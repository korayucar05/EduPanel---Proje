#!/usr/bin/env python3
"""EduPanel: deploy WhatsApp relational settings and complete recipient accounting, without unrelated edits."""
import datetime,os,pathlib,subprocess,shutil,tarfile,urllib.request,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("whatsapp-links-stage-"+STAMP)
BACKUP=ROOT/("whatsapp-links-backup-"+STAMP+".tar.gz")
OLD_DIST=ROOT/("whatsapp-links-old-dist-"+STAMP)
SCHEMA="database/schema/edupanel-relational-communications-schema.sql"
REPOSITORY="src/db/relationalCommunications.ts"
API="src/lib/mhatsappApi.ts"
MODULE="src/components/MessageToolsModule.tsx"
PATHS=[SCHEMA,REPOSITORY,API,MODULE]
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(ok, message):
    if not ok:raise RuntimeError("STOP: "+message)
def source(rel):
    return (LIVE/rel).read_text(encoding="utf-8")
def github(rel):
    return subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:"+rel]).decode("utf-8")
def patch_slice(live,latest,begin,end):
    require(live.count(begin)==1 and latest.count(begin)==1,"Patch start ambiguous: "+begin[:85])
    x=live.index(begin); y=live.find(end,x+len(begin))
    a=latest.index(begin); b=latest.find(end,a+len(begin))
    require(y>x and b>a,"Patch end missing: "+end[:85])
    return live[:x]+latest[a:b]+live[y:]
def patch_fragment(live,old,new):
    if live.count(new)==1 and live.count(old)==0:return live
    require(live.count(old)==1 and live.count(new)==0,"Unexpected live fragment: "+old[:100])
    return live.replace(old,new,1)
def check_http():
    for n in range(15):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=9) as response:
                if response.status==200 and "application/json" in response.headers.get("Content-Type",""): return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError("API health did not respond with JSON")
def passenger_restart():
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
for p in PATHS: require((LIVE/p).is_file(),"Missing live file: "+p)
l={p:source(p) for p in PATHS}
g={p:github(p) for p in PATHS}
# Compatible with existing relational schema; only one new CREATE TABLE statement.
tableHead="CREATE TABLE IF NOT EXISTS mhatsapp_runtime_ayarlari ("
tableEnd=") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n"
require(g[SCHEMA].startswith(tableHead),"New table missing in GitHub schema")
statement=g[SCHEMA].split(tableEnd,1)[0]+tableEnd
require(l[SCHEMA].count(tableHead)==0,"WhatsApp settings table already present in live schema")
mergedSchema=statement+l[SCHEMA]
configStart="const CONFIGS: Record<string, Config> = {\n"
configDefinition='  mhatsappRuntimeSettings: { tableName: "mhatsapp_runtime_ayarlari", fields: [\n    ["api_base_url", "baseUrl"], ["api_token", "token"],\n    ["guncelleme_zamani", "updatedAt"],\n  ] },\n'
require(g[REPOSITORY].count(configDefinition)==1,"Runtime mapping missing in GitHub")
require(l[REPOSITORY].count(configDefinition)==0 and l[REPOSITORY].count(configStart)==1,"Live runtime repository changed")
mergedRepository=l[REPOSITORY].replace(configStart,configStart+configDefinition,1)
mergedApi=patch_slice(l[API],g[API],
    "export async function sendPersonalizedBulkText(", "\n\nexport function appendMhatsappLog")
# Add only UI state, send handler and per-student status details.
stateOld='  const [info, setInfo] = useState("");'
stateNew='  const [info, setInfo] = useState("");\n  const [deliveryRows, setDeliveryRows] = useState<Array<{ id: string; name: string; number: string; status: string; ok: boolean }>>([]);'
mergedModule=patch_fragment(l[MODULE],stateOld,stateNew)
mergedModule=patch_slice(mergedModule,g[MODULE],
    "  const createAndSend = async (ids: string[]) => {",
    "  const visibleIds = filtered.map((item) => item.id);")
uiStart="      {info ? (\n        <div className=\"mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600\">"
uiEnd="\n    </section>\n  );\n}\n\nfunction ResultBox"
mergedModule=patch_slice(mergedModule,g[MODULE],uiStart,uiEnd)
require("const [deliveryRows" in mergedModule and "setDeliveryRows(combined)" in mergedModule,"Recipient detail patch missing")
merged={SCHEMA:mergedSchema,REPOSITORY:mergedRepository,API:mergedApi,MODULE:mergedModule}
require(all(merged[p]!=l[p] for p in PATHS),"Missing expected changes in live sources")
print("Preparing staging copy and build...",flush=True)
STAGE.mkdir(parents=True,exist_ok=False)
with subprocess.Popen(["tar","-C",str(LIVE),
    "--exclude=./node_modules","--exclude=./dist","--exclude=./backups","--exclude=./.git",
    "-cf","-","."],stdout=subprocess.PIPE) as tar:
    unpack=subprocess.Popen(["tar","-C",str(STAGE),"-xf","-"],stdin=tar.stdout)
    tar.stdout.close()
    require(tar.wait()==0 and unpack.wait()==0,"Staging copy failure")
(STAGE/"node_modules").symlink_to(LIVE/"node_modules",target_is_directory=True)
for rel,content in merged.items():(STAGE/rel).write_text(content,encoding="utf-8")
subprocess.check_call(["npm","run","build"],cwd=str(STAGE))
require((STAGE/"dist"/"index.html").is_file(),"Build produced no index")
print("Backing up all affected files and static assets...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as saved:
    for rel in PATHS:saved.add(str(LIVE/rel),arcname=rel)
    saved.add(str(LIVE/"dist"),arcname="dist")
require(BACKUP.stat().st_size>10000,"Backup missing")
owners={rel:(LIVE/rel).stat() for rel in PATHS}
changed=[]
assets=False
try:
    for rel,content in merged.items():
        dst=LIVE/rel
        st=owners[rel]
        temp=dst.with_name(dst.name+".whatsapp-new")
        temp.write_text(content,encoding="utf-8")
        os.chmod(str(temp),st.st_mode & 0o777)
        os.chown(str(temp),st.st_uid,st.st_gid)
        os.replace(str(temp),str(dst))
        changed.append(rel)
    os.rename(str(LIVE/"dist"),str(OLD_DIST))
    assets=True
    shutil.copytree(str(STAGE/"dist"),str(LIVE/"dist"))
    owner=owners[MODULE]
    for parent,dirs,files in os.walk(str(LIVE/"dist")):
        os.chown(parent,owner.st_uid,owner.st_gid)
        for name in dirs+files:os.chown(os.path.join(parent,name),owner.st_uid,owner.st_gid)
    passenger_restart()
    check_http()
    print("DEPLOYMENT SUCCESS",flush=True)
    print("Backup: "+str(BACKUP),flush=True)
    print("WhatsApp settings: relational MySQL repository prepared",flush=True)
    print("Link delivery: per-student send acknowledgement and missing-phone reports",flush=True)
    print("Note: actual provider delivery must be checked with a real class send",flush=True)
except Exception:
    print("ERROR: Restoring original files and web assets...",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as saved:
        for rel in changed:
            entry=saved.extractfile(rel)
            require(entry is not None,"Missing backup file: "+rel)
            dst=LIVE/rel;dst.write_bytes(entry.read())
            st=owners[rel]
            os.chmod(str(dst),st.st_mode & 0o777)
            os.chown(str(dst),st.st_uid,st.st_gid)
    if assets:
        if (LIVE/"dist").exists():shutil.rmtree(str(LIVE/"dist"))
        if OLD_DIST.exists():os.rename(str(OLD_DIST),str(LIVE/"dist"))
    passenger_restart()
    raise
