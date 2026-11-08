#!/usr/bin/env python3
"""Fix mHatsapp blocking ActionStruct string type in live server.ts."""
import datetime,os,pathlib,subprocess,tarfile,shutil,urllib.request,time
LIVE=pathlib.Path("/var/www/vhosts/dersbende.com/edupanel.dersbende.com")
ROOT=pathlib.Path("/root/edupanel-gecici-arsivler")
CLONE=ROOT/"hatirlatma-github"
STAMP=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
STAGE=ROOT/("whatsapp-blocking-string-test-"+STAMP)
BACKUP=ROOT/("whatsapp-blocking-string-yedek-"+STAMP+".tar.gz")
SERVER=LIVE/"server.ts"
OLD='''      // Tek alıcılı blocking mesajlarda gönderen istemcinin hazırladığı
      // numbers dizisini koru. Medya/toplu uçlar önceki CSV biçimini kullanır.
      if (safePath === "/api/send-msg-blocking/") {
        if (typeof safeAction.numbers === "string") {
          safeAction.numbers = safeAction.numbers.split(",").map((item: string) => item.trim()).filter(Boolean);
        }
      } else {
        if (Array.isArray(safeAction.numbers)) safeAction.numbers = safeAction.numbers.join(",");
        if (safeAction.numbers !== undefined) safeAction.numbers = String(safeAction.numbers);
      }'''
NEW='''      // mHatsapp Go ActionStruct expects action.numbers as a string, not an array.
      // Normalize one or multiple recipients to comma-separated text.
      if (Array.isArray(safeAction.numbers)) safeAction.numbers = safeAction.numbers.join(",");
      if (safeAction.numbers !== undefined) safeAction.numbers = String(safeAction.numbers);'''
os.environ["PATH"]="/opt/plesk/node/22/bin:"+os.environ.get("PATH","")
def require(value,message):
    if not value:raise RuntimeError("STOP: "+message)
require(SERVER.is_file(),"Live server.ts missing")
original=SERVER.read_text(encoding="utf-8")
newgithub=subprocess.check_output(["git","-C",str(CLONE),"show","FETCH_HEAD:server.ts"]).decode("utf-8")
require(newgithub.count(NEW)==1,"GitHub fix missing")
require(original.count(OLD)==1 and original.count(NEW)==0,"Live proxy code unexpectedly changed; refusing overwrite")
merged=original.replace(OLD,NEW,1)
require(merged.count(NEW)==1,"Replacement invalid")
# Validate in staging without modifying active server or any other modules.
STAGE.mkdir(parents=True,exist_ok=False)
(STAGE/"server.ts").write_text(merged,encoding="utf-8")
check=subprocess.check_output(["/opt/plesk/node/22/bin/node","--version"],stderr=subprocess.STDOUT).decode().strip()
print("Validated Node:",check,flush=True)
print("Backing up live server...",flush=True)
with tarfile.open(str(BACKUP),"w:gz") as archive:
    archive.add(str(SERVER),arcname="server.ts")
require(BACKUP.stat().st_size>10000,"Backup is incomplete")
stat=SERVER.stat()
tmp=SERVER.with_name("server.ts.whatsapp-string-new")
try:
    tmp.write_text(merged,encoding="utf-8")
    os.chmod(str(tmp),stat.st_mode & 0o777)
    os.chown(str(tmp),stat.st_uid,stat.st_gid)
    os.replace(str(tmp),str(SERVER))
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
    for attempt in range(15):
        try:
            with urllib.request.urlopen("https://edupanel.dersbende.com/api/health",timeout=10) as response:
                if response.status==200 and "application/json" in response.headers.get("Content-Type",""):
                    print("DEPLOYMENT SUCCESS",flush=True)
                    print("Backup: "+str(BACKUP),flush=True)
                    print("Blocking message numbers now use required string type; no test message sent.",flush=True)
                    break
        except Exception:pass
        time.sleep(2)
    else:raise RuntimeError("JSON health endpoint did not respond")
except Exception:
    print("ERROR: restoring server.ts",flush=True)
    with tarfile.open(str(BACKUP),"r:gz") as archive:
        file=archive.extractfile("server.ts")
        require(file is not None,"Backup missing")
        SERVER.write_bytes(file.read())
        os.chmod(str(SERVER),stat.st_mode & 0o777)
        os.chown(str(SERVER),stat.st_uid,stat.st_gid)
    marker=LIVE/"tmp"/"restart.txt"
    marker.parent.mkdir(parents=True,exist_ok=True)
    marker.touch()
    raise
