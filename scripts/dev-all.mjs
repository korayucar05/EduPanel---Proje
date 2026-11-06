import { spawn } from "node:child_process";
import net from "node:net";

const API_PORT = 8787;
const WEB_PORT = 3000;

const API_URL = `http://127.0.0.1:${API_PORT}/api/health`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}/`;

const children = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: "127.0.0.1",
      port,
    });

    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(700);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function apiIsCorrect() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) return false;

    const data = await response.json();
    return data?.ok === true && data?.service === "HASAT API";
  } catch {
    return false;
  }
}

async function webIsReady() {
  try {
    const response = await fetch(WEB_URL, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

/*
 * Windows'ta npm.cmd'yi doğrudan spawn etmek bazı Node/Windows
 * kombinasyonlarında spawn EINVAL üretebiliyor.
 *
 * Bu nedenle Windows'ta npm komutlarını cmd.exe üzerinden,
 * diğer platformlarda doğrudan npm üzerinden başlatıyoruz.
 */
function startNpmScript(scriptName, label) {
  let command;
  let args;

  if (process.platform === "win32") {
    command = process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe";
    args = ["/d", "/s", "/c", `npm run ${scriptName}`];
  } else {
    command = "npm";
    args = ["run", scriptName];
  }

  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: false,
    shell: false,
    env: process.env,
  });

  children.push({ child, label });

  child.on("error", (error) => {
    if (!shuttingDown) {
      console.error(`\n[${label}] baslatma hatasi:`, error);
      shutdown(1);
    }
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(
        `\n[${label}] beklenmedik bicimde kapandi. Kod: ${code ?? "-"} Sinyal: ${signal ?? "-"}`
      );
      shutdown(1);
    }
  });

  return child;
}

async function waitFor(check, label, timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await check()) return true;
    await sleep(350);
  }

  throw new Error(
    `${label} ${Math.round(timeoutMs / 1000)} saniye icinde hazir olmadi.`
  );
}

function killTree(pid) {
  if (!pid) return;

  try {
    if (process.platform === "win32") {
      const killer = spawn(
        process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe",
        ["/d", "/s", "/c", `taskkill /PID ${pid} /T /F >nul 2>&1`],
        {
          stdio: "ignore",
          windowsHide: true,
          shell: false,
        }
      );
      killer.unref();
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {}
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;

  shuttingDown = true;
  console.log("\n\ne-Nstitu kapatiliyor...");

  for (const { child } of children) {
    killTree(child.pid);
  }

  setTimeout(() => process.exit(exitCode), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

process.on("uncaughtException", (error) => {
  console.error("\nBaslatici hatasi:", error);
  shutdown(1);
});

process.on("unhandledRejection", (error) => {
  console.error("\nBaslatici hatasi:", error);
  shutdown(1);
});

console.log("\n==============================================");
console.log("       e-Nstitu Tek Baslatma Sistemi");
console.log("==============================================");
console.log(`Web : http://localhost:${WEB_PORT}`);
console.log(`API : http://localhost:${API_PORT}`);
console.log("");

try {
  const apiPortOpen = await isPortOpen(API_PORT);

  if (apiPortOpen) {
    if (!(await apiIsCorrect())) {
      throw new Error(
        "8787 portu acik fakat calisan servis HASAT API degil. " +
          "Once 8787 portunu kullanan eski sureci kapatin."
      );
    }

    console.log("OK 8787: HASAT API zaten acik; mevcut surec kullanilacak.");
  } else {
    console.log("-> 8787: Ana e-Nstitu API baslatiliyor...");
    startNpmScript("dev:api", "API 8787");
    await waitFor(apiIsCorrect, "HASAT API");
    console.log("OK 8787: HASAT API hazir.");
  }

  const webPortOpen = await isPortOpen(WEB_PORT);

  if (webPortOpen) {
    if (!(await webIsReady())) {
      throw new Error(
        "3000 portu acik fakat web arayuzu cevap vermiyor. " +
          "Once 3000 portunu kullanan eski sureci kapatin."
      );
    }

    console.log("OK 3000: Web arayuzu zaten acik; mevcut surec kullanilacak.");
  } else {
    console.log("-> 3000: e-Nstitu web arayuzu baslatiliyor...");
    startNpmScript("dev:web", "WEB 3000");
    await waitFor(webIsReady, "e-Nstitu web arayuzu");
    console.log("OK 3000: Web arayuzu hazir.");
  }

  console.log("\n==============================================");
  console.log(" e-Nstitu HAZIR");
  console.log(" Web : http://localhost:3000");
  console.log(" API : http://localhost:8787");
  console.log(" Ctrl+C ile iki sureci birlikte kapatabilirsiniz.");
  console.log("==============================================\n");

  // Baslaticinin cocuk sureclerle birlikte acik kalmasini sagla.
  setInterval(() => {}, 1 << 30);
} catch (error) {
  console.error(
    "\ne-Nstitu baslatilamadi:",
    error instanceof Error ? error.message : error
  );
  shutdown(1);
}
