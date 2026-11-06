import { spawnSync } from "node:child_process";

const run = (cmd, args = [], options = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stderr || "");
      process.stdout.write(result.stdout || "");
    }
    process.exit(result.status ?? 1);
  }
  return result.stdout?.trim() || "";
};

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-` +
  `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

console.log("\n==============================================");
console.log("      EduPanel Guvenli Checkpoint Sistemi");
console.log("==============================================\n");

run("git", ["rev-parse", "--is-inside-work-tree"], { capture: true });

const tracked = run("git", ["ls-files"], { capture: true })
  .split(/\r?\n/)
  .filter(Boolean);

const forbidden = tracked.filter((p) =>
  /(^|\/)(node_modules|\.venv|backups)(\/|$)|\.bak$|before-|wrong-|\.db(-shm|-wal)?$|(^|\/)\.thumbs\//i.test(p)
);

if (forbidden.length) {
  console.error("HATA: Git icinde takip edilmemesi gereken dosyalar bulundu:");
  forbidden.slice(0, 50).forEach((p) => console.error(`  - ${p}`));
  if (forbidden.length > 50) console.error(`  ... ve ${forbidden.length - 50} dosya daha`);
  console.error("\nCheckpoint olusturulmadi.");
  process.exit(2);
}

console.log("-> Production build kontrol ediliyor...\n");
run("npm", ["run", "build"]);

console.log("\n-> Git degisiklikleri hazirlaniyor...");
run("git", ["add", "-A"]);

const pending = run("git", ["status", "--porcelain"], { capture: true });

let commitHash;
if (pending) {
  const message = `EduPanel-checkpoint-${stamp}`;
  console.log(`-> Commit olusturuluyor: ${message}`);
  run("git", ["commit", "-m", message]);
  commitHash = run("git", ["rev-parse", "--short", "HEAD"], { capture: true });
} else {
  console.log("-> Yeni dosya degisikligi yok; mevcut HEAD etiketlenecek.");
  commitHash = run("git", ["rev-parse", "--short", "HEAD"], { capture: true });
}

const tag = `checkpoint-${stamp}`;
run("git", ["tag", tag]);

console.log("\n==============================================");
console.log(" CHECKPOINT BASARILI");
console.log(` Commit : ${commitHash}`);
console.log(` Tag    : ${tag}`);
console.log(" Build  : BASARILI");
console.log(" Git    : TEMIZ");
console.log("==============================================\n");


