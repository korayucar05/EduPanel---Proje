import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface CpSatRunResult {
  success: boolean;
  error?: string;
  details?: string;
  schedule?: Record<string, unknown>;
  unplacedBlocks?: unknown[];
  [key: string]: unknown;
}

const projectRoot = process.cwd();
const scriptPath = path.join(projectRoot, "python_solver", "rota_cp_sat_solver.py");

function pythonCandidates(): Array<{ command: string; args: string[] }> {
  const configured = String(process.env.PYTHON_EXECUTABLE || "").trim();
  const venvPython = process.platform === "win32"
    ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
    : path.join(projectRoot, ".venv", "bin", "python");

  return [
    ...(configured ? [{ command: configured, args: [] }] : []),
    ...(fs.existsSync(venvPython) ? [{ command: venvPython, args: [] }] : []),
    { command: "python", args: [] },
    ...(process.platform === "win32" ? [{ command: "py", args: ["-3"] }] : [{ command: "python3", args: [] }]),
  ];
}

function runWithCandidate(
  candidate: { command: string; args: string[] },
  payload: unknown,
  timeoutMs: number,
): Promise<CpSatRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(candidate.command, [...candidate.args, scriptPath], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      // Windows Python may otherwise emit stdout using the active system
      // code page. That corrupts Turkish day names such as Salı, Çarşamba
      // and Perşembe, while ASCII-only Pazartesi/Cuma remain readable.
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
        LANG: process.env.LANG || "tr_TR.UTF-8",
        LC_ALL: process.env.LC_ALL || "tr_TR.UTF-8",
      },
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CP-SAT işlemi ${Math.round(timeoutMs / 1000)} saniyede tamamlanamadı.`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `Python süreci ${code} koduyla kapandı.`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as CpSatRunResult;
        if (stderr.trim()) parsed.pythonWarnings = stderr.trim();
        resolve(parsed);
      } catch {
        reject(new Error(`CP-SAT geçersiz yanıt döndürdü. ${stderr || stdout}`.trim()));
      }
    });

    child.stdin.end(JSON.stringify(payload), "utf8");
  });
}

export async function runOrToolsCpSat(payload: any): Promise<CpSatRunResult> {
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`CP-SAT Python dosyası bulunamadı: ${scriptPath}`);
  }

  const solveSeconds = Number(payload?.config?.timeLimitSeconds || 120);
  const timeoutMs = Math.max(30_000, Math.min(20 * 60_000, (solveSeconds + 30) * 1000));
  let lastError: unknown = null;

  for (const candidate of pythonCandidates()) {
    try {
      return await runWithCandidate(candidate, payload, timeoutMs);
    } catch (error: any) {
      lastError = error;
      // A stale virtual environment can still be spawnable while its base
      // Python was removed. Continue with the remaining configured/system
      // candidates instead of failing before they are tried.
      continue;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Python çalıştırıcısı bulunamadı. Python 3 ve OR-Tools kurulumunu kontrol edin.");
}

export async function checkOrToolsCpSat(): Promise<CpSatRunResult> {
  return runOrToolsCpSat({ healthCheck: true, config: { timeLimitSeconds: 5 } });
}
