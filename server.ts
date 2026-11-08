import { parseQuestionGroupFileName } from "./src/utils/questionUploadFileName.ts";
﻿import express from "express";
import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";
import zlib from "node:zlib";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { pool } from "./src/db/index.ts";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { countDocuments, createBackup, deleteDocument, getDocument, getDocumentStoreStatus, initializeDocumentStore, listDocumentLocations, listDocuments, replaceCollection, replaceCollections, searchDocuments, searchDocumentsAny, sqlite, sqlitePath, upsertDocument, waitForDocumentStoreWrites } from "./src/db/sqlite.ts";
import { createInitialAccessState } from "./src/lib/accessControlInitial.ts";
import { ensureRelationalAuthSchema, loadRelationalAuthState, saveRelationalAuthState } from "./src/db/relationalAuth.ts";
import { checkOrToolsCpSat, runOrToolsCpSat } from "./src/server/ortoolsCpSatService.ts";
import { z } from "zod";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 8787);
  await initializeDocumentStore();
  await ensureRelationalAuthSchema();
  let relationalAuthState = await loadRelationalAuthState();

  const readGitValue = (args: string[]) => {
    try {
      return execFileSync("git", args, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };
  const appReleaseVersion = String(
    process.env.ENSTITU_RELEASE_VERSION ||
    process.env.npm_package_version ||
    "4.0.0",
  ).trim();
  const appGitCommit = String(
    process.env.ENSTITU_GIT_COMMIT ||
    process.env.GITHUB_SHA ||
    readGitValue(["rev-parse", "--short=7", "HEAD"]) ||
    "bilinmiyor",
  ).trim();
  const appGitBranch = String(
    process.env.ENSTITU_GIT_BRANCH ||
    readGitValue(["rev-parse", "--abbrev-ref", "HEAD"]) ||
    "bilinmiyor",
  ).trim();

  type AttendanceAccessPayload = {
    scope: "attendance-scan" | "attendance-entry";
    issuedAt: number;
    expiresAt: number;
    linkId: string;
    date?: string;
    createdById?: string;
  };

  const attendanceSecretPath = path.join(path.dirname(sqlitePath), ".attendance-link-secret");
  const getAttendanceLinkSecret = () => {
    const configuredSecret = String(process.env.ATTENDANCE_LINK_SECRET || "").trim();
    if (configuredSecret.length >= 32) return configuredSecret;
    try {
      if (fs.existsSync(attendanceSecretPath)) {
        const storedSecret = fs.readFileSync(attendanceSecretPath, "utf8").trim();
        if (storedSecret.length >= 32) return storedSecret;
      }
      fs.mkdirSync(path.dirname(attendanceSecretPath), { recursive: true });
      const generatedSecret = crypto.randomBytes(48).toString("base64url");
      fs.writeFileSync(attendanceSecretPath, generatedSecret, { encoding: "utf8", mode: 0o600 });
      return generatedSecret;
    } catch (error) {
      console.warn("Yoklama baÄŸlantÄ± anahtarÄ± dosyaya kaydedilemedi; geÃ§ici anahtar kullanÄ±lÄ±yor.", error);
      return crypto.randomBytes(48).toString("base64url");
    }
  };
  const attendanceLinkSecret = getAttendanceLinkSecret();
  const attendanceTokenTtlMinutes = Math.max(15, Math.min(10080, Number(process.env.ATTENDANCE_LINK_TTL_MINUTES || 720)));
  const signAttendancePayload = (payload: AttendanceAccessPayload) => {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", attendanceLinkSecret).update(encodedPayload).digest("base64url");
    return `${encodedPayload}.${signature}`;
  };
  const verifyAttendanceToken = (token: string): AttendanceAccessPayload | null => {
    try {
      const [encodedPayload, signature, extra] = token.split(".");
      if (!encodedPayload || !signature || extra) return null;
      const expected = crypto.createHmac("sha256", attendanceLinkSecret).update(encodedPayload).digest();
      const received = Buffer.from(signature, "base64url");
      if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AttendanceAccessPayload;
      if (!["attendance-scan", "attendance-entry"].includes(payload.scope) || !payload.linkId || !Number.isFinite(payload.expiresAt)) return null;
      if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  };
  const requestAddress = (req: express.Request) => String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  const isPrivateAddress = (address: string) => address === "::1" || address === "127.0.0.1"
    || /^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address);
  const isDirectLocalRequest = (req: express.Request) => !req.get("cf-connecting-ip")
    && !req.get("x-forwarded-for") && isPrivateAddress(requestAddress(req));
  const requireAttendanceAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const payload = verifyAttendanceToken(token);
    if (payload) {
      res.locals.attendanceAccess = payload;
      res.setHeader("Cache-Control", "no-store");
      return next();
    }
    if (isDirectLocalRequest(req)) return next();
    return res.status(401).json({ error: "Bu yoklama baÄŸlantÄ±sÄ± geÃ§ersiz veya sÃ¼resi dolmuÅŸ. Okul yÃ¶netiminden yeni baÄŸlantÄ± isteyin." });
  };
  const requireAttendanceEntryAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const payload = verifyAttendanceToken(token);
    if (!payload || payload.scope !== "attendance-entry" || !payload.date) return res.status(401).json({ error: "Yoklama baÄŸlantÄ±sÄ± geÃ§ersiz veya sÃ¼resi dolmuÅŸ." });
    res.locals.attendanceAccess = payload;
    res.setHeader("Cache-Control", "no-store");
    next();
  };
  const attendanceWriteAttempts = new Map<string, { count: number; resetAt: number }>();
  type AttendanceReminderJob = {
    linkId: string;
    teacherName: string;
    phone: string;
    url: string;
    expiresAt: number;
    baseUrl: string;
    token: string;
    lastSentAt: number;
    messageCount: number;
    lastError?: string;
    sending?: boolean;
  };
  const attendanceReminderJobs = new Map<string, AttendanceReminderJob>();
  const limitAttendanceWrites = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = req.get("cf-connecting-ip") || requestAddress(req) || "unknown";
    const current = attendanceWriteAttempts.get(key);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + 10 * 60 * 1000 } : current;
    entry.count += 1;
    attendanceWriteAttempts.set(key, entry);
    if (entry.count > 30) return res.status(429).json({ error: "Ã‡ok fazla kayÄ±t denemesi yapÄ±ldÄ±. LÃ¼tfen birkaÃ§ dakika sonra yeniden deneyin." });
    next();
  };

  const attendanceReminderTimer = setInterval(async () => {
    const now = Date.now();
    for (const [linkId, job] of attendanceReminderJobs) {
      if (job.expiresAt <= now) {
        attendanceReminderJobs.delete(linkId);
        continue;
      }
      const uploaded = listDocuments("attendanceOpticalRecords").some((record: any) => record.accessLinkId === linkId);
      if (uploaded) {
        attendanceReminderJobs.delete(linkId);
        continue;
      }
      if (job.sending || now - job.lastSentAt < 2 * 60 * 1000) continue;
      job.sending = true;
      job.lastSentAt = now;
      try {
        const target = `${job.baseUrl.replace(/\/$/, "")}/api/send-msg-blocking/`;
        const response = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: {
              type: "text",
              token: [job.token],
              numbers: job.phone,
              message: `SayÄ±n ${job.teacherName}, yoklama fiÅŸi henÃ¼z sisteme yÃ¼klenmedi. LÃ¼tfen aÅŸaÄŸÄ±daki gÃ¼venli baÄŸlantÄ±yÄ± aÃ§arak fiÅŸ fotoÄŸrafÄ±nÄ± yÃ¼kleyiniz:\n\n${job.url}`,
            },
          }),
        });
        const responseText = await response.text();
        let responseData: any = {};
        try { responseData = responseText ? JSON.parse(responseText) : {}; } catch { responseData = { rawResponse: responseText }; }
        const providerStatus = String(responseData?.status || responseData?.message || responseData?.error || "").toLowerCase();
        const accepted = response.ok && (providerStatus === "success" || Boolean(responseData?.id) || responseData?.ok === true);
        if (!accepted) throw new Error(responseData?.error || responseData?.message || responseData?.status || `HTTP ${response.status}`);
        job.messageCount += 1;
        job.lastError = undefined;
      } catch (error) {
        job.lastError = error instanceof Error ? error.message : "HatÄ±rlatma gÃ¶nderilemedi.";
      } finally {
        job.sending = false;
      }
    }
  }, 10_000);
  attendanceReminderTimer.unref();

  app.use(cors());
  app.use(express.json({ limit: "100mb" }));

  // Soru İşlemleri > Resmi Dönüştürmek: yalnızca gönderilen görseli işler.
  app.post("/api/question-image/reimagine", async (req, res) => {
    try {
      const source = String(req.body?.image || "");
      const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(source);
      if (!match) return res.status(400).json({ error: "JPG, PNG veya WEBP soru görseli gönderin." });
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], "base64");
      if (!buffer.length || buffer.length > 10 * 1024 * 1024) return res.status(413).json({ error: "Görsel en fazla 10 MB olabilir." });
      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "Görsel dönüştürme için GEMINI_API_KEY sunucuda tanımlı olmalıdır." });
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Create a single clean, print-ready Turkish exam-question card from the supplied source image. This is an image-to-image restoration and redesign, not a new question. Keep exactly the same Turkish wording, punctuation, numbers, mathematical symbols, answer choices and their order, labels, visual information, captions and meaning. Never invent or alter a word, number, diagram label, formula or answer. Redraw the existing diagram with crisp smooth lines and faithful geometry; improve resolution, spacing, contrast and clarity. Put all content on pure white background, no shadows, watermarks, page furniture or decorative elements. Maintain the source card's approximate portrait aspect ratio, and keep the relative placement of introduction, diagram, question stem and A-E options. Set body text in a clean Arial-like sans-serif, target 11-point at an 8 cm card width, black, justified where practical; question stem bold. Do not include an answer key or explanations. If portions of the source are illegible, do not guess or replace them. Return only the completed image.`;
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: buffer.toString("base64") } }] }],
        config: { responseModalities: ["IMAGE", "TEXT"], httpOptions: { timeout: 45000 } },
      });
      const images = (response.candidates || []).flatMap((candidate: any) => candidate.content?.parts || []).filter((part: any) => part.inlineData?.data && String(part.inlineData?.mimeType || "").startsWith("image/"));
      const output = images[0]?.inlineData;
      if (!output?.data) return res.status(502).json({ error: "Görsel modeli yeni bir görsel döndürmedi. Tekrar deneyin veya model ayarını kontrol edin." });
      res.setHeader("Cache-Control", "no-store");
      return res.json({ image: `data:${output.mimeType || "image/png"};base64,${output.data}` });
    } catch (error) {
      console.error("Soru resmi dönüştürme hatası:", error);
      const detail = error instanceof Error ? error.message : String(error || "");
      const timeout = /abort|timeout|deadline/i.test(detail);
      const access = /403|401|permission|api.key|api key|unauthorized/i.test(detail);
      const limit = /429|quota|rate.limit|resource.exhausted/i.test(detail);
      return res.status(timeout ? 504 : access ? 403 : limit ? 429 : 502).json({ error: timeout
        ? "Yapay zekâ 45 saniyede yanıt vermedi. Hızlı İyileştir seçeneği beklemeden çalışır."
        : access ? "Görsel modeli erişimi reddetti. Sunucudaki GEMINI_API_KEY ve model yetkilerini kontrol edin."
        : limit ? "Görsel modeli kullanım kotasına ulaşıldı. Daha sonra deneyin veya Hızlı İyileştir'i kullanın."
        : `Görsel üretilemedi: ${detail.slice(0, 220) || "Modelden yanıt alınamadı."}` });
    }
  });


  app.post(
    "/api/question-prepare/decode-tiff",
    express.raw({ type: "application/octet-stream", limit: "250mb" }),
    (req, res) => {
      const requestedExtension = String(req.headers["x-tiff-extension"] || ".tiff").toLocaleLowerCase("tr-TR");
      const extension = requestedExtension === ".tif" ? ".tif" : ".tiff";
      const pageIndex = Math.max(0, Number.parseInt(String(req.query?.page || "0"), 10) || 0);
      const metadataOnly = String(req.query?.metadata || "") === "1";
      const input = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!input.length) return res.status(400).json({ error: "TIFF dosyası boş." });
      if (input.length > 240 * 1024 * 1024) return res.status(413).json({ error: "TIFF dosyası çok büyük." });
      if (process.platform !== "win32") {
        return res.status(501).json({ error: "TIFF görüntüleme bu sunucuda yalnız Windows ortamında destekleniyor." });
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "enstitu-tiff-"));
      const inputPath = path.join(tempDir, `source${extension}`);
      const rawPath = path.join(tempDir, "pixels.bgra");
      const metaPath = path.join(tempDir, "pixels.meta");
      const scriptPath = path.join(tempDir, "decode-tiff.ps1");
      try {
        fs.writeFileSync(inputPath, input);
        const script = String.raw`param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$RawPath,
  [Parameter(Mandatory=$true)][string]$MetaPath,
  [Parameter(Mandatory=$true)][int]$PageIndex,
  [Parameter(Mandatory=$true)][int]$MetadataOnly
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationCore
$stream = [System.IO.File]::Open($InputPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
try {
  $decoder = [System.Windows.Media.Imaging.TiffBitmapDecoder]::new(
    $stream,
    [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
    [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  )
  $pageCount = [int]$decoder.Frames.Count
  if ($pageCount -lt 1) { throw "TIFF sayfası bulunamadı." }
  if ($PageIndex -lt 0 -or $PageIndex -ge $pageCount) { throw "TIFF sayfa numarası geçersiz." }
  $frame = $decoder.Frames[$PageIndex]
  $width = [int]$frame.PixelWidth
  $height = [int]$frame.PixelHeight
  if ($width -lt 1 -or $height -lt 1) { throw "TIFF boyutu geçersiz." }
  [System.IO.File]::WriteAllText($MetaPath, "$width,$height,$pageCount")
  if ($MetadataOnly -eq 0) {
    $converted = [System.Windows.Media.Imaging.FormatConvertedBitmap]::new(
      $frame,
      [System.Windows.Media.PixelFormats]::Bgra32,
      $null,
      0
    )
    $stride = $width * 4
    $bytes = New-Object byte[] ($stride * $height)
    $converted.CopyPixels($bytes, $stride, 0)
    [System.IO.File]::WriteAllBytes($RawPath, $bytes)
  }
} finally {
  $stream.Dispose()
}`;
        fs.writeFileSync(scriptPath, script, "utf8");
        execFileSync(
          "powershell.exe",
          [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            inputPath,
            rawPath,
            metaPath,
            String(pageIndex),
            metadataOnly ? "1" : "0",
          ],
          { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], timeout: 120000 },
        );

        if (!fs.existsSync(metaPath)) throw new Error("TIFF boyut bilgisi oluşturulamadı.");
        const [widthText, heightText, pageCountText] = fs.readFileSync(metaPath, "utf8").trim().split(",");
        const width = Number(widthText);
        const height = Number(heightText);
        const pageCount = Number(pageCountText);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || !Number.isFinite(pageCount) || pageCount < 1) {
          throw new Error("TIFF boyut bilgisi geçersiz.");
        }
        if (width * height > 80_000_000 || Math.max(width, height) > 25000) {
          return res.status(413).json({ error: "TIFF görüntüsü tarayıcı bellek sınırını aşıyor." });
        }
        if (metadataOnly) {
          res.setHeader("Cache-Control", "no-store");
          return res.json({ width, height, pageCount });
        }
        if (!fs.existsSync(rawPath)) throw new Error("TIFF piksel verisi oluşturulamadı.");
        const bgra = fs.readFileSync(rawPath);
        if (bgra.length !== width * height * 4) throw new Error("TIFF piksel verisi eksik.");
        const rgba = Buffer.allocUnsafe(bgra.length);
        for (let offset = 0; offset < bgra.length; offset += 4) {
          rgba[offset] = bgra[offset + 2];
          rgba[offset + 1] = bgra[offset + 1];
          rgba[offset + 2] = bgra[offset];
          rgba[offset + 3] = bgra[offset + 3];
        }
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("X-Image-Width", String(width));
        res.setHeader("X-Image-Height", String(height));
        res.setHeader("X-Tiff-Page-Count", String(pageCount));
        return res.send(rgba);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error || "");
        console.error("TIFF okuma hatası:", error);
        return res.status(500).json({ error: detail ? `TIFF dosyası açılamadı: ${detail}` : "TIFF dosyası çalışma alanında görüntülenemedi." });
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }
    },
  );
  app.use(express.urlencoded({ limit: "100mb", extended: true }));


  type EducationNewsItem = {
    id: string;
    source: string;
    title: string;
    url: string;
    content: string;
    publishedAt: string;
    date: string;
    time: string;
  };

  type EducationNewsSource = {
    key: string;
    name: string;
    home: string;
    feeds: string[];
    pages: string[];
    googleQuery: string;
  };

  const educationNewsSources: EducationNewsSource[] = [
    {
      key: "mebhocam",
      name: "MEB Hocam",
      home: "https://www.mebhocam.com/son-haberler",
      feeds: [],
      pages: ["https://www.mebhocam.com/son-haberler"],
      googleQuery: "",
    },
    {
      key: "mebpersonel",
      name: "MEB Personel",
      home: "https://mebpersonel.com/son-haberler",
      feeds: [],
      pages: ["https://mebpersonel.com/son-haberler"],
      googleQuery: "",
    },
    {
      key: "webdeogren",
      name: "Webde Öğren",
      home: "https://www.webdeogren.com/category/egitim/haber-ve-duyurular",
      feeds: [],
      pages: ["https://www.webdeogren.com/category/egitim/haber-ve-duyurular"],
      googleQuery: "",
    },
  ];

  let educationNewsCache: { expiresAt: number; items: EducationNewsItem[]; sources: any[]; fetchedAt: string } = { expiresAt: 0, items: [], sources: [], fetchedAt: "" };
  let educationNewsInFlight: Promise<typeof educationNewsCache> | null = null;

  const decodeNewsEntities = (value: string) => String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16) || 32));

  const stripNewsHtml = (value: string) => decodeNewsEntities(String(value || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();

  const newsSlug = (value: string) => String(value || "").toLocaleLowerCase("tr-TR")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9çğıöşü]+/gi, "-").replace(/^-+|-+$/g, "");

  const turkeyDateParts = (timestamp: number) => {
    const shifted = new Date(timestamp + 3 * 60 * 60 * 1000).toISOString();
    return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
  };

  const parseEducationNewsDate = (raw: string, fallbackMs: number) => {
    const value = stripNewsHtml(raw).trim();
    if (!value) return fallbackMs;
    const direct = Date.parse(value);
    if (Number.isFinite(direct)) return direct;
    const lower = value.toLocaleLowerCase("tr-TR");
    const relative = lower.match(/(\d+)\s*(dakika|saat|gün)\s*önce/);
    if (relative) {
      const amount = Number(relative[1] || 0);
      const unitMs = relative[2] === "dakika" ? 60_000 : relative[2] === "saat" ? 3_600_000 : 86_400_000;
      return Date.now() - amount * unitMs;
    }
    const months: Record<string, number> = { ocak:0, subat:1, şubat:1, mart:2, nisan:3, mayis:4, mayıs:4, haziran:5, temmuz:6, agustos:7, ağustos:7, eylul:8, eylül:8, ekim:9, kasim:10, kasım:10, aralik:11, aralık:11 };
    const turkish = lower.match(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(20\d{2})(?:\s+\w+)?\s*(\d{1,2}:\d{2})?/i);
    if (turkish && months[turkish[2]] != null) {
      const [hour, minute] = String(turkish[4] || "12:00").split(":").map(Number);
      return Date.UTC(Number(turkish[3]), months[turkish[2]], Number(turkish[1]), (hour || 0) - 3, minute || 0);
    }
    const clock = lower.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);
    if (clock) {
      const nowTr = new Date(Date.now() + 3 * 60 * 60 * 1000);
      let candidate = Date.UTC(nowTr.getUTCFullYear(), nowTr.getUTCMonth(), nowTr.getUTCDate(), Number(clock[1]) - 3, Number(clock[2]));
      if (candidate > Date.now() + 2 * 60 * 60 * 1000) candidate -= 86_400_000;
      return candidate;
    }
    return fallbackMs;
  };

  const fetchEducationNewsText = async (url: string, timeoutMs = 10_000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.7,en;q=0.5",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.text()).slice(0, 5_000_000);
    } finally {
      clearTimeout(timer);
    }
  };

  const absoluteEducationNewsUrl = (href: string, base: string) => {
    try {
      const url = new URL(decodeNewsEntities(href), base);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      url.hash = "";
      return url.toString();
    } catch { return ""; }
  };

  const rssTag = (block: string, names: string[]) => {
    for (const name of names) {
      const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
      if (match?.[1]) return match[1];
    }
    return "";
  };

  const cleanExternalNewsTitle = (title: string, sourceName: string) => {
    const cleaned = stripNewsHtml(title).replace(/\s+[\-–—]\s+[^\-–—]{2,60}$/u, (suffix) => {
      const suffixKey = newsSlug(suffix);
      const sourceKey = newsSlug(sourceName);
      return suffixKey.includes(sourceKey) || sourceKey.includes(suffixKey.replace(/^-+/, "")) ? "" : suffix;
    }).trim();
    return cleaned || stripNewsHtml(title);
  };

  const parseEducationNewsFeed = (xml: string, source: EducationNewsSource) => {
    const blocks = Array.from(xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)).map((match) => match[2]);
    return blocks.slice(0, 30).map((block, index): EducationNewsItem | null => {
      const title = cleanExternalNewsTitle(rssTag(block, ["title"]), source.name);
      let link = stripNewsHtml(rssTag(block, ["link", "guid"]));
      if (!link) link = block.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] || "";
      const url = absoluteEducationNewsUrl(link, source.home);
      if (!title || !url) return null;
      const description = stripNewsHtml(rssTag(block, ["description", "summary", "content:encoded", "content"]));
      const rawDate = stripNewsHtml(rssTag(block, ["pubDate", "published", "updated", "dc:date", "date"]));
      const timestamp = parseEducationNewsDate(rawDate, Date.now() - index * 60_000);
      const parts = turkeyDateParts(timestamp);
      return {
        id: `${source.key}:${newsSlug(title)}:${timestamp}`,
        source: source.name,
        title,
        url,
        content: description.slice(0, 420),
        publishedAt: new Date(timestamp).toISOString(),
        date: parts.date,
        time: parts.time,
      };
    }).filter((item): item is EducationNewsItem => Boolean(item));
  };

  const extractJsonLdNews = (html: string, source: EducationNewsSource) => {
    const result: EducationNewsItem[] = [];
    const seen = new Set<string>();
    const scripts = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    const pushObject = (obj: any) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) { obj.forEach(pushObject); return; }
      if (Array.isArray(obj["@graph"])) obj["@graph"].forEach(pushObject);
      if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach((entry: any) => pushObject(entry?.item || entry));
      const rawType = Array.isArray(obj["@type"]) ? obj["@type"].join(" ") : String(obj["@type"] || "");
      const title = stripNewsHtml(obj.headline || obj.name || obj.title || "");
      const rawUrl = typeof obj.url === "string" ? obj.url : obj?.mainEntityOfPage?.["@id"] || obj?.mainEntityOfPage || "";
      const url = absoluteEducationNewsUrl(String(rawUrl || ""), source.home);
      if (!title || !url || (!/Article|NewsArticle|ListItem/i.test(rawType) && !obj.datePublished)) return;
      const key = newsSlug(title);
      if (!key || seen.has(key)) return;
      const timestamp = parseEducationNewsDate(String(obj.datePublished || obj.dateModified || ""), Date.now() - result.length * 90_000);
      const parts = turkeyDateParts(timestamp);
      seen.add(key);
      result.push({
        id: `${source.key}:${key}:${timestamp}`,
        source: source.name,
        title,
        url,
        content: stripNewsHtml(String(obj.description || "")).slice(0, 420),
        publishedAt: new Date(timestamp).toISOString(),
        date: parts.date,
        time: parts.time,
      });
    };
    for (const match of scripts) {
      try { pushObject(JSON.parse(decodeNewsEntities(match[1]).trim())); } catch { /* geçersiz JSON-LD atlanır */ }
      if (result.length >= 20) break;
    }
    return result;
  };

  const parseEducationNewsHome = (html: string, source: EducationNewsSource, pageUrl: string) => {
    const structured = extractJsonLdNews(html, source);
    const matches = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi));
    const seen = new Set<string>(structured.map((item) => newsSlug(item.title)));
    const items: EducationNewsItem[] = [...structured];
    for (const [index, match] of matches.entries()) {
      const attrs = match[1] || "";
      const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      const titleAttr = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
      const title = stripNewsHtml(titleAttr || match[2]);
      if (title.length < 12 || title.length > 260) continue;
      if (/^(anasayfa|haberler|son haberler|manşetler|gündem|eğitim|öğretmen|meb|genel|devamını oku|tümü|günün tüm haberleri)$/i.test(title)) continue;
      const url = absoluteEducationNewsUrl(href, pageUrl || source.home);
      if (!url) continue;
      try {
        const parsed = new URL(url);
        const homeHost = new URL(source.home).hostname.replace(/^www\./, "");
        if (parsed.hostname.replace(/^www\./, "") !== homeHost) continue;
        const pathText = parsed.pathname.toLocaleLowerCase("tr-TR");
        if (pathText === "/" || /\/(kategori|category|etiket|tag|yazar|author|sayfa|page)(?:\/|$)/.test(pathText)) continue;
      } catch { continue; }
      const dedupeKey = newsSlug(title);
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      const start = Math.max(0, Number(match.index || 0) - 320);
      const end = Math.min(html.length, Number(match.index || 0) + match[0].length + 360);
      const context = stripNewsHtml(html.slice(start, end));
      const relative = context.match(/\d+\s*(?:dakika|saat|gün)\s*önce/i)?.[0]
        || context.match(/\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2}(?:\s+\w+)?\s*\d{1,2}:\d{2}/i)?.[0]
        || context.match(/\b\d{1,2}:\d{2}\b/)?.[0]
        || "";
      const timestamp = parseEducationNewsDate(relative, Date.now() - items.length * 90_000);
      const parts = turkeyDateParts(timestamp);
      seen.add(dedupeKey);
      items.push({
        id: `${source.key}:${dedupeKey}:${timestamp}`,
        source: source.name,
        title,
        url,
        content: "",
        publishedAt: new Date(timestamp).toISOString(),
        date: parts.date,
        time: parts.time,
      });
      if (items.length >= 20) break;
    }
    return items;
  };


  const loadEducationNewsSource = async (source: EducationNewsSource) => {
    const errors: string[] = [];
    for (const feedUrl of source.feeds) {
      try {
        const xml = await fetchEducationNewsText(feedUrl, 7000);
        if (!/<(?:rss|feed|item)\b/i.test(xml)) continue;
        const items = parseEducationNewsFeed(xml, source);
        if (items.length) return { items, method: `feed:${feedUrl}`, error: "" };
      } catch (error) {
        errors.push(`${feedUrl}: ${error instanceof Error ? error.message : "Akış okunamadı"}`);
      }
    }

    for (const pageUrl of source.pages) {
      try {
        const html = await fetchEducationNewsText(pageUrl, 9000);
        const items = parseEducationNewsHome(html, source, pageUrl);
        if (items.length) return { items, method: `page:${pageUrl}`, error: "" };
        errors.push(`${pageUrl}: haber bağlantısı ayrıştırılamadı`);
      } catch (error) {
        errors.push(`${pageUrl}: ${error instanceof Error ? error.message : "Site okunamadı"}`);
      }
    }

    return { items: [] as EducationNewsItem[], method: "unavailable", error: errors.slice(-4).join(" | ") || "Güncel haber bulunamadı" };
  };

  const loadLatestEducationNews = async (force = false) => {
    if (!force && educationNewsCache.expiresAt > Date.now() && educationNewsCache.items.length) return educationNewsCache;
    if (educationNewsInFlight) return educationNewsInFlight;
    educationNewsInFlight = (async () => {
      const settled = await Promise.allSettled(educationNewsSources.map(async (source) => ({ source, result: await loadEducationNewsSource(source) })));
      const results = settled.map((entry, index) => {
        const source = educationNewsSources[index];
        if (entry.status === "fulfilled") return entry.value;
        return { source, result: { items: [] as EducationNewsItem[], method: "failed", error: entry.reason instanceof Error ? entry.reason.message : String(entry.reason || "Bilinmeyen hata") } };
      });
      const deduped = new Map<string, EducationNewsItem>();
      for (const { result } of results) {
        for (const item of result.items) {
          const key = `${newsSlug(item.title)}|${newsSlug(item.source)}`;
          if (!key || deduped.has(key)) continue;
          deduped.set(key, item);
        }
      }
      const items = Array.from(deduped.values())
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 48);
      const next = {
        expiresAt: Date.now() + (items.length ? 5 * 60 * 1000 : 30_000),
        items,
        sources: results.map(({ source, result }) => ({ key: source.key, name: source.name, ok: result.items.length > 0, count: result.items.length, method: result.method, error: result.error || undefined })),
        fetchedAt: new Date().toISOString(),
      };
      if (items.length || !educationNewsCache.items.length) educationNewsCache = next;
      else educationNewsCache = { ...educationNewsCache, expiresAt: Date.now() + 30_000, sources: next.sources, fetchedAt: next.fetchedAt };
      return educationNewsCache;
    })();
    try { return await educationNewsInFlight; }
    finally { educationNewsInFlight = null; }
  };

  app.get("/api/mobile/news/latest", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const force = String(req.query?.refresh || "") === "1";
      const payload = await loadLatestEducationNews(force);
      res.json({ ok: payload.items.length > 0, items: payload.items, sources: payload.sources, fetchedAt: payload.fetchedAt });
    } catch (error) {
      console.error("Güncel eğitim haberleri yüklenemedi:", error);
      res.status(502).json({ ok: false, error: "Güncel haberler alınamadı.", items: educationNewsCache.items, sources: educationNewsCache.sources, fetchedAt: educationNewsCache.fetchedAt });
    }
  });

  // Haber ekranı boş görünüyorsa bu endpoint kaynak bazında hangi sitenin
  // erişilebilir olduğunu hızlıca kontrol etmeyi sağlar.
  app.get("/api/mobile/news/status", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const payload = await loadLatestEducationNews(true);
      res.json({ ok: payload.items.length > 0, count: payload.items.length, sources: payload.sources, fetchedAt: payload.fetchedAt });
    } catch (error) {
      res.status(502).json({ ok: false, count: educationNewsCache.items.length, sources: educationNewsCache.sources, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/release-info", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      version: appReleaseVersion,
      gitCommit: appGitCommit,
      gitBranch: appGitBranch,
      environment: process.env.NODE_ENV || "development",
    });
  });

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      service: "HASAT API",
      version: process.env.npm_package_version || "0.0.0",
      environment: process.env.NODE_ENV || "development",
      database: "mysql",
      timestamp: new Date().toISOString(),
    });
  });

  // HASAT AÄ°LE â€” gÃ¼venli canlÄ± akademik dosya baÄŸlantÄ±larÄ±.
  type StoredLiveReport = {
    id: string;
    tokenHash: string;
    revokeHash: string;
    report: unknown;
    context?: unknown;
    schemaVersion: string;
    createdAt: string;
    expiresAt: string;
    revokedAt?: string;
    readCount: number;
    firstReadAt?: string;
    lastReadAt?: string;
  };

  const LIVE_REPORT_COLLECTION = "hasatLiveReports";
  const LIVE_REPORT_MAX_BYTES = Math.max(
    250_000,
    Math.min(10_000_000, Number(process.env.HASAT_LIVE_REPORT_MAX_BYTES || 4_000_000)),
  );
  const LIVE_REPORT_MAX_VALID_DAYS = 90;
  const liveReportPublishAttempts = new Map<string, { count: number; resetAt: number }>();

  const hashLiveReportSecret = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest("hex");

  const safeSecretEqual = (left: string, right: string) => {
    try {
      const a = Buffer.from(left, "hex");
      const b = Buffer.from(right, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  };

  const firstLanIpv4 = () => {
    const interfaces = os.networkInterfaces();
    for (const addresses of Object.values(interfaces)) {
      for (const address of addresses || []) {
        if (address.family === "IPv4" && !address.internal) return address.address;
      }
    }
    return "";
  };

  let runtimeLiveReportPublicUrl = "";

  const normalizePublicAppUrl = (value: unknown) => {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    if (!normalized) return "";
    try {
      const parsed = new URL(normalized);
      if (!['http:', 'https:'].includes(parsed.protocol)) return "";
      return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`.replace(/\/+$/, "");
    } catch {
      return "";
    }
  };

  const configuredLiveReportPublicUrl = () => normalizePublicAppUrl(
    process.env.HASAT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.VITE_PUBLIC_APP_URL ||
    "",
  );

  const liveReportPublicBase = (req: express.Request) => {
    const configured = runtimeLiveReportPublicUrl || configuredLiveReportPublicUrl();
    if (configured) return configured;

    const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
    const protocol = forwardedProto || req.protocol || "http";
    const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
    const requestHost = forwardedHost || String(req.get("host") || "").trim();
    const hostname = requestHost.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();

    if (requestHost && !["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      return `${protocol}://${requestHost}`;
    }

    const lanIp = firstLanIpv4();
    return lanIp ? `http://${lanIp}:${PORT}` : `${protocol}://${requestHost || `localhost:${PORT}`}`;
  };

  const cleanExpiredLiveReports = () => {
    const now = Date.now();
    for (const item of listDocuments(LIVE_REPORT_COLLECTION) as StoredLiveReport[]) {
      const expired = new Date(item.expiresAt).getTime() <= now;
      const oldRevoked = item.revokedAt
        ? new Date(item.revokedAt).getTime() <= now - 7 * 24 * 60 * 60 * 1000
        : false;
      if (expired || oldRevoked) deleteDocument(LIVE_REPORT_COLLECTION, item.id);
    }
  };

  const limitLiveReportPublishes = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = req.get("cf-connecting-ip") || requestAddress(req) || "unknown";
    const current = liveReportPublishAttempts.get(key);
    const entry = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + 10 * 60 * 1000 }
      : current;
    entry.count += 1;
    liveReportPublishAttempts.set(key, entry);
    if (entry.count > 60) {
      return res.status(429).json({ error: "Ã‡ok fazla canlÄ± rapor oluÅŸturma isteÄŸi gÃ¶nderildi. LÃ¼tfen birkaÃ§ dakika sonra tekrar deneyin." });
    }
    next();
  };

  const isLocalRequest = (req: express.Request) => {
    const address = String(req.socket.remoteAddress || "").toLowerCase();
    return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
  };

  app.get("/api/live-reports/health", (req, res) => {
    cleanExpiredLiveReports();
    const publicUrl = runtimeLiveReportPublicUrl || configuredLiveReportPublicUrl();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      service: "HASAT AÄ°LE CanlÄ± Rapor",
      version: "1.1.0",
      publicMode: Boolean(publicUrl),
      publicUrl: publicUrl || liveReportPublicBase(req),
      runtimePublicUrl: runtimeLiveReportPublicUrl || null,
      time: new Date().toISOString(),
    });
  });

  app.get("/api/live-reports/public-url", (req, res) => {
    const publicUrl = runtimeLiveReportPublicUrl || configuredLiveReportPublicUrl();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      publicUrl: publicUrl || liveReportPublicBase(req),
      source: runtimeLiveReportPublicUrl ? "runtime" : configuredLiveReportPublicUrl() ? "environment" : "request",
    });
  });

  app.post("/api/live-reports/public-url", (req, res) => {
    if (!isLocalRequest(req)) {
      return res.status(403).json({ error: "Genel baÄŸlantÄ± adresi yalnÄ±zca HASAT sunucusunun Ã§alÄ±ÅŸtÄ±ÄŸÄ± bilgisayardan deÄŸiÅŸtirilebilir." });
    }
    const publicUrl = normalizePublicAppUrl(req.body?.publicUrl);
    if (!publicUrl || !publicUrl.startsWith("https://")) {
      return res.status(400).json({ error: "GeÃ§erli bir HTTPS genel baÄŸlantÄ±sÄ± girilmelidir." });
    }
    runtimeLiveReportPublicUrl = publicUrl;
    console.log(`[HASAT AÄ°LE] Genel baÄŸlantÄ± adresi gÃ¼ncellendi: ${publicUrl}`);
    return res.json({ ok: true, publicUrl });
  });

  app.post("/api/live-reports", limitLiveReportPublishes, (req, res) => {
    try {
      const report = req.body?.report;
      const context = req.body?.context;
      const schemaVersion = String(req.body?.schemaVersion || "hasat-live-report-1").slice(0, 80);
      const validDays = Math.max(
        1,
        Math.min(LIVE_REPORT_MAX_VALID_DAYS, Math.floor(Number(req.body?.validDays || 30))),
      );

      if (!report || typeof report !== "object" || Array.isArray(report)) {
        return res.status(400).json({ error: "CanlÄ± rapor verisi geÃ§ersiz." });
      }

      const serialized = JSON.stringify({ report, context, schemaVersion });
      const payloadBytes = Buffer.byteLength(serialized, "utf8");
      if (payloadBytes > LIVE_REPORT_MAX_BYTES) {
        return res.status(413).json({
          error: `CanlÄ± rapor ${Math.ceil(payloadBytes / 1024)} KB. En fazla ${Math.ceil(LIVE_REPORT_MAX_BYTES / 1024)} KB yayÄ±mlanabilir.`,
        });
      }

      cleanExpiredLiveReports();

      const token = crypto.randomBytes(32).toString("base64url");
      const revokeSecret = crypto.randomBytes(40).toString("base64url");
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + validDays * 24 * 60 * 60 * 1000);
      const id = crypto.randomUUID();

      const stored: StoredLiveReport = {
        id,
        tokenHash: hashLiveReportSecret(token),
        revokeHash: hashLiveReportSecret(revokeSecret),
        report,
        context,
        schemaVersion,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        readCount: 0,
      };
      upsertDocument(LIVE_REPORT_COLLECTION, id, stored);

      const base = liveReportPublicBase(req);
      const url = `${base}/?mode=family-report&token=${encodeURIComponent(token)}`;

      return res.status(201).json({
        token,
        revokeSecret,
        url,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      });
    } catch (error) {
      console.error("CanlÄ± rapor yayÄ±mlanamadÄ±:", error);
      return res.status(500).json({ error: "CanlÄ± rapor oluÅŸturulurken sunucu hatasÄ± oluÅŸtu." });
    }
  });

  app.get("/api/live-reports/:token", (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!/^[A-Za-z0-9_-]{30,200}$/.test(token)) {
        return res.status(404).json({ error: "CanlÄ± rapor bulunamadÄ±." });
      }

      cleanExpiredLiveReports();
      const tokenHash = hashLiveReportSecret(token);
      const stored = (listDocuments(LIVE_REPORT_COLLECTION) as StoredLiveReport[])
        .find(item => item.tokenHash === tokenHash);

      if (!stored) return res.status(404).json({ error: "CanlÄ± rapor bulunamadÄ±." });
      if (stored.revokedAt) return res.status(410).json({ error: "CanlÄ± rapor eriÅŸimi kaldÄ±rÄ±lmÄ±ÅŸ." });
      if (new Date(stored.expiresAt).getTime() <= Date.now()) {
        deleteDocument(LIVE_REPORT_COLLECTION, stored.id);
        return res.status(410).json({ error: "CanlÄ± raporun eriÅŸim sÃ¼resi dolmuÅŸ." });
      }

      const readAt = new Date().toISOString();
      upsertDocument(LIVE_REPORT_COLLECTION, stored.id, {
        ...stored,
        readCount: Number(stored.readCount || 0) + 1,
        firstReadAt: stored.firstReadAt || readAt,
        lastReadAt: readAt,
      });

      res.setHeader("Cache-Control", "no-store, private");
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      return res.json({
        report: stored.report,
        context: stored.context,
        schemaVersion: stored.schemaVersion,
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      });
    } catch (error) {
      console.error("CanlÄ± rapor okunamadÄ±:", error);
      return res.status(500).json({ error: "CanlÄ± rapor aÃ§Ä±lÄ±rken sunucu hatasÄ± oluÅŸtu." });
    }
  });

  app.get("/api/live-reports/:token/status", (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const revokeSecret = String(req.get("X-HASAT-Revoke-Secret") || "").trim();
      if (!token || !revokeSecret) {
        return res.status(401).json({ error: "Teslim durumu iÃ§in rapor yÃ¶netim anahtarÄ± gerekli." });
      }

      cleanExpiredLiveReports();
      const tokenHash = hashLiveReportSecret(token);
      const stored = (listDocuments(LIVE_REPORT_COLLECTION) as StoredLiveReport[])
        .find(item => item.tokenHash === tokenHash);
      if (!stored) return res.status(404).json({ error: "CanlÄ± rapor bulunamadÄ±." });
      if (!safeSecretEqual(stored.revokeHash, hashLiveReportSecret(revokeSecret))) {
        return res.status(403).json({ error: "Teslim durumunu gÃ¶rÃ¼ntÃ¼leme yetkisi doÄŸrulanamadÄ±." });
      }

      const expiresAt = new Date(stored.expiresAt).getTime();
      res.setHeader("Cache-Control", "no-store");
      return res.json({
        readCount: Number(stored.readCount || 0),
        firstReadAt: stored.firstReadAt,
        lastReadAt: stored.lastReadAt,
        revokedAt: stored.revokedAt,
        expired: expiresAt <= Date.now(),
        createdAt: stored.createdAt,
        expiresAt: stored.expiresAt,
      });
    } catch (error) {
      console.error("CanlÄ± rapor teslim durumu okunamadÄ±:", error);
      return res.status(500).json({ error: "Teslim durumu okunurken sunucu hatasÄ± oluÅŸtu." });
    }
  });

  app.delete("/api/live-reports/:token", (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const revokeSecret = String(req.get("X-HASAT-Revoke-Secret") || "").trim();
      if (!token || !revokeSecret) {
        return res.status(401).json({ error: "Rapor kaldÄ±rma anahtarÄ± gerekli." });
      }

      const tokenHash = hashLiveReportSecret(token);
      const stored = (listDocuments(LIVE_REPORT_COLLECTION) as StoredLiveReport[])
        .find(item => item.tokenHash === tokenHash);
      if (!stored) return res.status(404).end();

      if (!safeSecretEqual(stored.revokeHash, hashLiveReportSecret(revokeSecret))) {
        return res.status(403).json({ error: "CanlÄ± raporu kaldÄ±rma yetkisi doÄŸrulanamadÄ±." });
      }

      upsertDocument(LIVE_REPORT_COLLECTION, stored.id, {
        ...stored,
        revokedAt: new Date().toISOString(),
      });
      return res.status(204).end();
    } catch (error) {
      console.error("CanlÄ± rapor kaldÄ±rÄ±lamadÄ±:", error);
      return res.status(500).json({ error: "CanlÄ± rapor kaldÄ±rÄ±lÄ±rken sunucu hatasÄ± oluÅŸtu." });
    }
  });

  cleanExpiredLiveReports();
  const liveReportCleanupTimer = setInterval(cleanExpiredLiveReports, 60 * 60 * 1000);
  liveReportCleanupTimer.unref();

  // MESAJ KANIT KAYDI ---------------------------------------------------------
  // mHatsapp mevcut dokÃ¼mantasyonunda native delivered/read webhook'u olmadÄ±ÄŸÄ±
  // iÃ§in Ã¼Ã§ ayrÄ± kanÄ±t seviyesini tutuyoruz:
  // 1) providerAcceptedAt: saÄŸlayÄ±cÄ± gÃ¶nderimi kabul etti
  // 2) firstOpenedAt: alÄ±cÄ± "Bilgilendirmeyi GÃ¶rÃ¼ntÃ¼le" dÃ¼ÄŸmesine bastÄ±
  // 3) acknowledgedAt: alÄ±cÄ± "Okudum, Bilgilendirildim" onayÄ± verdi
  type MessageEvidenceRecord = {
    id: string;
    tokenHash: string;
    recipientName: string;
    recipientPhone: string;
    recipientRole?: string;
    studentName?: string;
    studentNo?: string;
    className?: string;
    source?: string;
    messageType: string;
    message: string;
    messageHash: string;
    attachmentName?: string;
    createdAt: string;
    expiresAt: string;
    providerAcceptedAt?: string;
    providerFailedAt?: string;
    providerMessageId?: string;
    providerStatus?: string;
    firstOpenedAt?: string;
    lastOpenedAt?: string;
    openCount: number;
    acknowledgedAt?: string;
    acknowledgementCount: number;
  };

  const MESSAGE_EVIDENCE_COLLECTION = "messageEvidenceRecords";
  const hashMessageEvidenceValue = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest("hex");
  const cleanExpiredMessageEvidence = () => {
    const now = Date.now();
    for (const item of listDocuments(MESSAGE_EVIDENCE_COLLECTION) as MessageEvidenceRecord[]) {
      if (new Date(item.expiresAt).getTime() <= now) {
        deleteDocument(MESSAGE_EVIDENCE_COLLECTION, item.id);
      }
    }
  };
  const findMessageEvidenceByToken = (token: string) => {
    const tokenHash = hashMessageEvidenceValue(token);
    return (listDocuments(MESSAGE_EVIDENCE_COLLECTION) as MessageEvidenceRecord[])
      .find((item) => item.tokenHash === tokenHash);
  };
  const maskEvidencePhone = (phone: string) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 7) return digits;
    return `${digits.slice(0, 4)}â€¢â€¢â€¢â€¢${digits.slice(-4)}`;
  };
  const messageEvidencePage = (token: string) => `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow,noarchive"/>
<title>e-NstitÃ¼ Bilgilendirme KaydÄ±</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif}
  .wrap{max-width:720px;margin:0 auto;padding:28px 16px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:24px;box-shadow:0 18px 50px rgba(15,23,42,.08)}
  .brand{font-size:12px;font-weight:800;letter-spacing:.12em;color:#64748b;text-transform:uppercase}.title{margin:8px 0 6px;font-size:24px;font-weight:900}
  .desc{color:#64748b;line-height:1.55}.box{display:none;margin-top:18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:18px;white-space:pre-wrap;line-height:1.55}
  button{border:0;border-radius:14px;padding:13px 17px;font-size:14px;font-weight:800;cursor:pointer}.primary{background:#0f766e;color:#fff}.confirm{display:none;margin-top:14px;background:#166534;color:#fff}
  .ok{display:none;margin-top:16px;padding:13px;border-radius:14px;background:#dcfce7;color:#166534;font-weight:800}.meta{margin-top:18px;color:#94a3b8;font-size:11px}
</style>
</head>
<body><main class="wrap"><section class="card">
<div class="brand">e-NstitÃ¼ â€¢ Mesaj KanÄ±t KaydÄ±</div>
<h1 class="title">Okul Bilgilendirmesi</h1>
<p class="desc">Bilgilendirme iÃ§eriÄŸini gÃ¶rmek iÃ§in aÅŸaÄŸÄ±daki dÃ¼ÄŸmeye basÄ±nÄ±z. Bu iÅŸlem gÃ¶rÃ¼ntÃ¼leme zamanÄ±nÄ± okul kayÄ±t sistemine kaydeder.</p>
<button id="openBtn" class="primary">Bilgilendirmeyi GÃ¶rÃ¼ntÃ¼le</button>
<div id="messageBox" class="box"></div>
<button id="ackBtn" class="confirm">Okudum, Bilgilendirildim</button>
<div id="okBox" class="ok">Bilgilendirme onayÄ±nÄ±z kaydedildi.</div>
<div class="meta">Bu baÄŸlantÄ± yalnÄ±z ilgili bilgilendirme kaydÄ± iÃ§indir.</div>
</section></main>
<script>
const token=${JSON.stringify(token)};
const openBtn=document.getElementById("openBtn");
const ackBtn=document.getElementById("ackBtn");
const box=document.getElementById("messageBox");
const okBox=document.getElementById("okBox");
openBtn.addEventListener("click",async()=>{
  openBtn.disabled=true;
  try{
    const r=await fetch("/api/message-evidence/public/"+encodeURIComponent(token)+"/open",{method:"POST",headers:{"Content-Type":"application/json"}});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"KayÄ±t aÃ§Ä±lamadÄ±");
    box.textContent=d.message||"";
    box.style.display="block";
    ackBtn.style.display="inline-block";
    openBtn.style.display="none";
  }catch(e){openBtn.disabled=false;alert(e.message||"KayÄ±t aÃ§Ä±lamadÄ±");}
});
ackBtn.addEventListener("click",async()=>{
  ackBtn.disabled=true;
  try{
    const r=await fetch("/api/message-evidence/public/"+encodeURIComponent(token)+"/ack",{method:"POST",headers:{"Content-Type":"application/json"}});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||"Onay kaydedilemedi");
    ackBtn.style.display="none";okBox.style.display="block";
  }catch(e){ackBtn.disabled=false;alert(e.message||"Onay kaydedilemedi");}
});
</script></body></html>`;

  app.post("/api/message-evidence", (req, res) => {
    try {
      cleanExpiredMessageEvidence();
      const body = req.body || {};
      const recipientPhone = String(body.recipientPhone || "").replace(/[^\d+]/g, "").slice(0, 24);
      const message = String(body.message || "").trim();
      if (!recipientPhone || !message) {
        return res.status(400).json({ error: "AlÄ±cÄ± telefonu ve mesaj iÃ§eriÄŸi zorunludur." });
      }

      const validDays = Math.max(1, Math.min(365, Math.floor(Number(body.validDays || 180))));
      const token = crypto.randomBytes(32).toString("base64url");
      const id = crypto.randomUUID();
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + validDays * 24 * 60 * 60 * 1000);
      const record: MessageEvidenceRecord = {
        id,
        tokenHash: hashMessageEvidenceValue(token),
        recipientName: String(body.recipientName || "AlÄ±cÄ±").slice(0, 180),
        recipientPhone,
        recipientRole: String(body.recipientRole || "").slice(0, 80) || undefined,
        studentName: String(body.studentName || "").slice(0, 180) || undefined,
        studentNo: String(body.studentNo || "").slice(0, 40) || undefined,
        className: String(body.className || "").slice(0, 80) || undefined,
        source: String(body.source || "Mesaj GÃ¶nder").slice(0, 120),
        messageType: String(body.messageType || "text").slice(0, 30),
        message,
        messageHash: hashMessageEvidenceValue(message),
        attachmentName: String(body.attachmentName || "").slice(0, 240) || undefined,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        openCount: 0,
        acknowledgementCount: 0,
      };
      upsertDocument(MESSAGE_EVIDENCE_COLLECTION, id, record);
      const proofUrl = `${liveReportPublicBase(req)}/message-proof/${encodeURIComponent(token)}`;
      return res.status(201).json({
        id,
        proofUrl,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        messageHash: record.messageHash,
      });
    } catch (error) {
      console.error("Mesaj kanÄ±t kaydÄ± oluÅŸturulamadÄ±:", error);
      return res.status(500).json({ error: "Mesaj kanÄ±t kaydÄ± oluÅŸturulamadÄ±." });
    }
  });

  app.patch("/api/message-evidence/:id/provider", (req, res) => {
    try {
      const id = String(req.params.id || "");
      const stored = (listDocuments(MESSAGE_EVIDENCE_COLLECTION) as MessageEvidenceRecord[])
        .find((item) => item.id === id);
      if (!stored) return res.status(404).json({ error: "Mesaj kanÄ±t kaydÄ± bulunamadÄ±." });
      const accepted = req.body?.accepted === true;
      const now = new Date().toISOString();
      const next: MessageEvidenceRecord = {
        ...stored,
        providerMessageId: String(req.body?.providerMessageId || stored.providerMessageId || "").slice(0, 240) || undefined,
        providerStatus: String(req.body?.providerStatus || "").slice(0, 500) || stored.providerStatus,
        providerAcceptedAt: accepted ? (stored.providerAcceptedAt || now) : stored.providerAcceptedAt,
        providerFailedAt: accepted ? undefined : (stored.providerFailedAt || now),
      };
      upsertDocument(MESSAGE_EVIDENCE_COLLECTION, id, next);
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ error: "GÃ¶nderim durumu kaydedilemedi." });
    }
  });

  app.get("/api/message-evidence", (_req, res) => {
    try {
      cleanExpiredMessageEvidence();
      const records = (listDocuments(MESSAGE_EVIDENCE_COLLECTION) as MessageEvidenceRecord[])
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 500)
        .map((item) => ({
          ...item,
          tokenHash: undefined,
          recipientPhoneMasked: maskEvidencePhone(item.recipientPhone),
        }));
      res.setHeader("Cache-Control", "no-store");
      return res.json(records);
    } catch {
      return res.status(500).json({ error: "Mesaj kanÄ±t kayÄ±tlarÄ± okunamadÄ±." });
    }
  });

  app.get("/message-proof/:token", (req, res) => {
    const token = String(req.params.token || "").trim();
    if (!/^[A-Za-z0-9_-]{30,200}$/.test(token)) return res.status(404).send("KayÄ±t bulunamadÄ±.");
    const stored = findMessageEvidenceByToken(token);
    if (!stored || new Date(stored.expiresAt).getTime() <= Date.now()) return res.status(404).send("KayÄ±t bulunamadÄ± veya sÃ¼resi doldu.");
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    return res.type("html").send(messageEvidencePage(token));
  });

  app.post("/api/message-evidence/public/:token/open", (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const stored = findMessageEvidenceByToken(token);
      if (!stored) return res.status(404).json({ error: "Bilgilendirme kaydÄ± bulunamadÄ±." });
      if (new Date(stored.expiresAt).getTime() <= Date.now()) return res.status(410).json({ error: "Bilgilendirme baÄŸlantÄ±sÄ±nÄ±n sÃ¼resi doldu." });
      const now = new Date().toISOString();
      upsertDocument(MESSAGE_EVIDENCE_COLLECTION, stored.id, {
        ...stored,
        firstOpenedAt: stored.firstOpenedAt || now,
        lastOpenedAt: now,
        openCount: Number(stored.openCount || 0) + 1,
      });
      return res.json({
        message: stored.message,
        createdAt: stored.createdAt,
        recipientName: stored.recipientName,
      });
    } catch {
      return res.status(500).json({ error: "Bilgilendirme gÃ¶rÃ¼ntÃ¼lenemedi." });
    }
  });

  app.post("/api/message-evidence/public/:token/ack", (req, res) => {
    try {
      const token = String(req.params.token || "").trim();
      const stored = findMessageEvidenceByToken(token);
      if (!stored) return res.status(404).json({ error: "Bilgilendirme kaydÄ± bulunamadÄ±." });
      if (new Date(stored.expiresAt).getTime() <= Date.now()) return res.status(410).json({ error: "Bilgilendirme baÄŸlantÄ±sÄ±nÄ±n sÃ¼resi doldu." });
      const now = new Date().toISOString();
      upsertDocument(MESSAGE_EVIDENCE_COLLECTION, stored.id, {
        ...stored,
        firstOpenedAt: stored.firstOpenedAt || now,
        lastOpenedAt: stored.lastOpenedAt || now,
        openCount: Math.max(1, Number(stored.openCount || 0)),
        acknowledgedAt: stored.acknowledgedAt || now,
        acknowledgementCount: Number(stored.acknowledgementCount || 0) + 1,
      });
      return res.json({ ok: true, acknowledgedAt: stored.acknowledgedAt || now });
    } catch {
      return res.status(500).json({ error: "Bilgilendirme onayÄ± kaydedilemedi." });
    }
  });

  cleanExpiredMessageEvidence();
  const messageEvidenceCleanupTimer = setInterval(cleanExpiredMessageEvidence, 60 * 60 * 1000);
  messageEvidenceCleanupTimer.unref();

  type AuthSession = { userId: string; schoolId: string | null; role: string; expiresAt: number };
  const authSessions = new Map<string, AuthSession>();
  const passwordResetAttempts = new Map<string, { count: number; resetAt: number }>();
  const normalizeLoginValue = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
  const passwordDigest = (password: string, salt: string) => crypto.createHash("sha256").update(`${salt}:${password}`, "utf8").digest("hex");
  const tokenDigest = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");
  let authSaveQueue = Promise.resolve();
  const saveAuthDirectory = (state: any) => {
    relationalAuthState = state;
    const snapshot = JSON.parse(JSON.stringify(state));
    const operation = authSaveQueue.then(() => saveRelationalAuthState(snapshot));
    authSaveQueue = operation.catch((error) => console.error("Kullanıcı dizini MySQL'e kaydedilemedi", error));
    return operation;
  };
  const loadAuthDirectory = () => {
    const saved = relationalAuthState || listDocuments("authDirectory").find((item: any) => item.id === "state")?.state;
    if (saved?.schools?.length && saved?.users?.length) {
      if (saved.schemaVersion !== 2) {
        const defaults = createInitialAccessState();
        const primarySchool = defaults.schools.find((school: any) => school.id === "school-main");
        const primaryUser = defaults.users.find((user: any) => user.id === "principal-main");
        const migrated = {
          ...saved,
          schemaVersion: 2,
          schools: saved.schools.map((school: any) => school.id === "school-main" ? { ...school, code: primarySchool?.code || "KORAY" } : school),
          users: saved.users.map((user: any) => user.id === "principal-main" ? {
            ...user,
            fullName: primaryUser?.fullName || "YÃ¶netici",
            username: primaryUser?.username || "YÃ¶netici",
            passwordSalt: primaryUser?.passwordSalt,
            passwordHash: primaryUser?.passwordHash,
          } : user),
        };
        saveAuthDirectory(migrated);
        return migrated;
      }
      return saved;
    }
    const initial = createInitialAccessState();
    saveAuthDirectory(initial);
    return initial;
  };
  const publicUser = (user: any) => {
    const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safeUser } = user;
    return safeUser;
  };
  const scopedAuthState = (state: any, user: any) => user.role === "super_admin" ? { ...state, currentUserId: user.id } : ({
    schools: state.schools.filter((school: any) => school.id === user.schoolId),
    users: state.users.filter((candidate: any) => candidate.schoolId === user.schoolId),
    currentUserId: user.id,
  });
  const safeScopedAuthState = (state: any, user: any) => {
    const scoped = scopedAuthState(state, user);
    return { ...scoped, users: scoped.users.map(publicUser) };
  };
  const mergeUserCredentials = (currentUsers: any[], incomingUser: any) => {
    const existing = currentUsers.find((user: any) => user.id === incomingUser.id);
    return {
      ...incomingUser,
      passwordHash: incomingUser.passwordHash || existing?.passwordHash,
      passwordSalt: incomingUser.passwordSalt || existing?.passwordSalt,
    };
  };
  const readAuthSession = (req: express.Request) => {
    const authorization = req.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const session = token ? authSessions.get(token) : undefined;
    if (!session || session.expiresAt <= Date.now()) {
      if (token) authSessions.delete(token);
      return null;
    }
    return { token, session };
  };
  const requireAuthSession = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const auth = readAuthSession(req);
    if (!auth) return res.status(401).json({ error: "Oturum geÃ§ersiz veya sÃ¼resi dolmuÅŸ." });
    res.locals.auth = auth;
    next();
  };

  app.post("/api/auth/login", (req, res) => {
    const schoolCode = String(req.body?.schoolCode || "").trim().toLocaleUpperCase("tr-TR");
    const identifier = normalizeLoginValue(req.body?.identifier);
    const password = String(req.body?.password || "");
    const state = loadAuthDirectory();
    const school = state.schools.find((item: any) => String(item.code).trim().toLocaleUpperCase("tr-TR") === schoolCode);
    const user = state.users.find((candidate: any) => {
      const sameIdentifier = normalizeLoginValue(candidate.username) === identifier || normalizeLoginValue(candidate.email) === identifier;
      return sameIdentifier && (candidate.role === "super_admin" ? schoolCode === "MERKEZ" : candidate.schoolId === school?.id);
    });
    const validPassword = Boolean(user?.passwordHash && user?.passwordSalt)
      && passwordDigest(password, user.passwordSalt) === user.passwordHash;
    if (!user || !validPassword || user.status !== "active" || (user.schoolId && school?.status !== "active")) {
        return res.status(401).json({ error: "Okul kodu, kullanıcı adı veya şifre hatalı." });
    }
    const sessionToken = crypto.randomBytes(36).toString("base64url");
    authSessions.set(sessionToken, { userId: user.id, schoolId: user.schoolId, role: user.role, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    res.setHeader("Cache-Control", "no-store");
    res.json({ sessionToken, user: publicUser(user), accessState: safeScopedAuthState(state, user) });
  });

  app.get("/api/auth/session", requireAuthSession, (req, res) => {
    const state = loadAuthDirectory();
    const user = state.users.find((candidate: any) => candidate.id === res.locals.auth.session.userId && candidate.status === "active");
    if (!user) return res.status(401).json({ error: "KullanÄ±cÄ± hesabÄ± bulunamadÄ±." });
    res.setHeader("Cache-Control", "no-store");
    res.json({ user: publicUser(user), accessState: safeScopedAuthState(state, user) });
  });


  const SCHOOL_NEWS_SETTINGS = "schoolNewsSettings";
  const PUBLISHED_EDUCATION_NEWS = "publishedEducationNews";
  const normalizeNewsManagerValue = (value: unknown) => String(value || "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
  const authNewsActor = (res: express.Response) => {
    const session: AuthSession = res.locals.auth.session;
    const state = loadAuthDirectory();
    const user = state.users.find((candidate: any) => candidate.id === session.userId && candidate.status === "active");
    return { session, state, user };
  };
  const newsActorName = (user: any) => String(
    user?.fullName || user?.displayName || user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "",
  ).trim();
  const newsManagerSetting = (schoolId: string) => listDocuments(SCHOOL_NEWS_SETTINGS)
    .find((row: any) => String(row?.schoolId || "school-main") === schoolId) || null;
  const canAssignNewsManager = (role: string) => ["super_admin", "principal", "assistant_principal"].includes(String(role || ""));
  const normalizeNewsEmail = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
  const newsIdentitySlug = (value: unknown) => String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  const resolveNewsManagerAuthUserId = (state: any, schoolId: string, managerId: string, managerName: string) => {
    const users = Array.isArray(state?.users) ? state.users.filter((candidate: any) =>
      String(candidate?.schoolId || "") === String(schoolId || "") && candidate?.status === "active") : [];
    const directUser = users.find((candidate: any) => String(candidate?.id || "") === String(managerId || ""));
    if (directUser?.id) return String(directUser.id);

    const normalizedManagerName = normalizeNewsManagerValue(managerName);
    const byUserName = users.find((candidate: any) =>
      normalizedManagerName && (
        normalizeNewsManagerValue(newsActorName(candidate)) === normalizedManagerName ||
        normalizeNewsManagerValue(candidate?.username) === normalizedManagerName
      ));
    if (byUserName?.id) return String(byUserName.id);

    const managerSlug = newsIdentitySlug(managerName);
    if (managerSlug.length >= 5) {
      const byAccountIdentity = users.find((candidate: any) => {
        const usernameSlug = newsIdentitySlug(candidate?.username);
        const emailLocalSlug = newsIdentitySlug(String(candidate?.email || "").split("@")[0]);
        return usernameSlug === managerSlug
          || emailLocalSlug === managerSlug
          || emailLocalSlug.startsWith(managerSlug)
          || (emailLocalSlug.length >= 5 && managerSlug.startsWith(emailLocalSlug));
      });
      if (byAccountIdentity?.id) return String(byAccountIdentity.id);
    }

    const personnelRows = [...listDocuments("teachers"), ...listDocuments("school_teachers")].filter((row: any) => {
      const rowSchoolId = String(row?.schoolId || "").trim();
      return !rowSchoolId || rowSchoolId === String(schoolId || "");
    });
    const personnel = personnelRows.find((row: any) => String(row?.id || row?.teacherId || "") === String(managerId || ""))
      || personnelRows.find((row: any) => normalizeNewsManagerValue(row?.name || row?.fullName || row?.teacherName || row?.displayName) === normalizedManagerName);
    if (!personnel) return "";

    const linkedUserId = String(personnel?.authUserId || personnel?.userId || personnel?.accountId || "").trim();
    if (linkedUserId && users.some((candidate: any) => String(candidate?.id || "") === linkedUserId)) return linkedUserId;

    const personnelEmail = normalizeNewsEmail(personnel?.email || personnel?.mail || personnel?.ePosta || personnel?.eposta);
    if (personnelEmail) {
      const byEmail = users.find((candidate: any) => normalizeNewsEmail(candidate?.email) === personnelEmail);
      if (byEmail?.id) return String(byEmail.id);
    }
    return "";
  };
  const ensureNewsManagerAuthBinding = (state: any, schoolId: string, setting: any) => {
    if (!setting) return setting;
    const existingAuthUserId = String(setting?.managerAuthUserId || "").trim();
    if (existingAuthUserId) return setting;
    const resolved = resolveNewsManagerAuthUserId(
      state,
      schoolId,
      String(setting?.managerId || ""),
      String(setting?.managerName || ""),
    );
    if (!resolved) return setting;
    const repaired = { ...setting, managerAuthUserId: resolved };
    upsertDocument(SCHOOL_NEWS_SETTINGS, String(setting?.id || `news-manager-${schoolId}`), repaired);
    return repaired;
  };
  const canManageSchoolNews = (session: AuthSession, user: any, setting: any) => {
    if (String(session.role || "") === "super_admin") return true;
    if (!setting) return false;
    const actorId = String(user?.id || session.userId || "");
    const sameAuthUser = Boolean(setting?.managerAuthUserId) && String(setting.managerAuthUserId) === actorId;
    const sameId = Boolean(setting?.managerId) && String(setting.managerId) === actorId;
    const sameName = Boolean(setting?.managerName) && normalizeNewsManagerValue(setting.managerName) === normalizeNewsManagerValue(newsActorName(user));
    return sameAuthUser || sameId || sameName;
  };

  app.get("/api/news-management/config", requireAuthSession, (_req, res) => {
    const { session, state, user } = authNewsActor(res);
    if (!user) return res.status(401).json({ error: "Kullanıcı hesabı bulunamadı." });
    const schoolId = String(session.schoolId || user?.schoolId || "school-main");
    const setting = ensureNewsManagerAuthBinding(state, schoolId, newsManagerSetting(schoolId));
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      schoolId,
      user: publicUser(user),
      setting,
      canAssign: canAssignNewsManager(session.role),
      canManage: canManageSchoolNews(session, user, setting),
    });
  });

  app.put("/api/news-management/manager", requireAuthSession, (req, res) => {
    const { session, state, user } = authNewsActor(res);
    if (!user) return res.status(401).json({ error: "Kullanıcı hesabı bulunamadı." });
    if (!canAssignNewsManager(session.role)) return res.status(403).json({ error: "Haber Yöneticisi atamak için okul yöneticisi yetkisi gereklidir." });
    const schoolId = String(session.schoolId || user?.schoolId || "school-main");
    const managerId = String(req.body?.managerId || "").trim();
    const managerName = String(req.body?.managerName || "").trim();
    if (!managerId || !managerName) return res.status(400).json({ error: "Görevlendirilecek kişi seçilmedi." });
    const managerAuthUserId = resolveNewsManagerAuthUserId(state, schoolId, managerId, managerName);
    const payload = {
      id: `news-manager-${schoolId}`,
      schoolId,
      managerId,
      managerName,
      managerRole: String(req.body?.managerRole || ""),
      managerAuthUserId,
      updatedAt: new Date().toISOString(),
      updatedBy: newsActorName(user),
    };
    upsertDocument(SCHOOL_NEWS_SETTINGS, payload.id, payload);
    return res.json({ success: true, setting: payload, canManage: canManageSchoolNews(session, user, payload) });
  });

  app.get("/api/news-management/published", requireAuthSession, (_req, res) => {
    const { session, user } = authNewsActor(res);
    if (!user) return res.status(401).json({ error: "Kullanıcı hesabı bulunamadı." });
    const schoolId = String(session.schoolId || user?.schoolId || "school-main");
    const items = listDocuments(PUBLISHED_EDUCATION_NEWS)
      .filter((row: any) => String(row?.schoolId || "school-main") === schoolId && row?.active !== false)
      .sort((a: any, b: any) => String(b?.publishedAt || b?.selectedAt || "").localeCompare(String(a?.publishedAt || a?.selectedAt || "")));
    res.setHeader("Cache-Control", "no-store");
    return res.json({ items });
  });

  app.post("/api/news-management/publish", requireAuthSession, (req, res) => {
    const { session, state, user } = authNewsActor(res);
    if (!user) return res.status(401).json({ error: "Kullanıcı hesabı bulunamadı." });
    const schoolId = String(session.schoolId || user?.schoolId || "school-main");
    const setting = ensureNewsManagerAuthBinding(state, schoolId, newsManagerSetting(schoolId));
    if (!canManageSchoolNews(session, user, setting)) return res.status(403).json({ error: "Bu okulun Haber Yöneticisi değilsiniz." });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "Yayınlanacak haber seçilmedi." });
    const published: any[] = [];
    for (const item of items) {
      const externalId = String(item?.id || "").trim();
      const title = String(item?.title || "").trim();
      const url = String(item?.url || "").trim();
      if (!externalId || !title || !url) continue;
      const schoolKey = newsIdentitySlug(schoolId).slice(0, 24) || "school";
      const externalKey = crypto.createHash("sha1").update(externalId).digest("hex").slice(0, 24);
      const id = `school-news-${schoolKey}-${externalKey}`;
      const payload = {
        id,
        externalId,
        schoolId,
        source: String(item?.source || ""),
        title,
        url,
        content: String(item?.content || ""),
        publishedAt: String(item?.publishedAt || new Date().toISOString()),
        date: String(item?.date || ""),
        time: String(item?.time || ""),
        publishedBy: newsActorName(user),
        selectedAt: new Date().toISOString(),
        active: true,
      };
      upsertDocument(PUBLISHED_EDUCATION_NEWS, id, payload);
      published.push(payload);
    }
    return res.json({ success: true, count: published.length, items: published });
  });

  app.delete("/api/news-management/published/:id", requireAuthSession, (req, res) => {
    const { session, state, user } = authNewsActor(res);
    if (!user) return res.status(401).json({ error: "Kullanıcı hesabı bulunamadı." });
    const schoolId = String(session.schoolId || user?.schoolId || "school-main");
    const setting = ensureNewsManagerAuthBinding(state, schoolId, newsManagerSetting(schoolId));
    if (!canManageSchoolNews(session, user, setting)) return res.status(403).json({ error: "Bu okulun Haber Yöneticisi değilsiniz." });
    const id = String(req.params.id || "");
    const current: any = getDocument(PUBLISHED_EDUCATION_NEWS, id);
    if (!current || String(current?.schoolId || "school-main") !== schoolId) return res.status(404).json({ error: "Haber bulunamadı." });
    deleteDocument(PUBLISHED_EDUCATION_NEWS, id);
    return res.json({ success: true });
  });

  app.get("/api/mobile/news/published", (req, res) => {
    const schoolId = String(req.query?.schoolId || "school-main").trim() || "school-main";
    const items = listDocuments(PUBLISHED_EDUCATION_NEWS)
      .filter((row: any) => String(row?.schoolId || "school-main") === schoolId && row?.active !== false)
      .sort((a: any, b: any) => String(b?.publishedAt || b?.selectedAt || "").localeCompare(String(a?.publishedAt || a?.selectedAt || "")));
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, items });
  });

  const normalizeMobileAttendanceValue = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");
  const getMobileAttendanceActor = (res: express.Response) => {
    const state = loadAuthDirectory();
    return state.users.find((user: any) => user.id === res.locals.auth.session.userId && user.status === "active");
  };
  const getMobileAttendanceClassStudents = (classroomId: string, classroomName: string) => {
    const normalizedName = normalizeMobileAttendanceValue(classroomName);
    return [...listDocuments("students"), ...listDocuments("school_students")].filter((student: any) => {
      const studentClassId = String(student.classroomId || student.classId || "").trim();
      const studentClassName = normalizeMobileAttendanceValue(student.classroom || student.className || student.branch);
      return (studentClassId && studentClassId === classroomId) || (normalizedName && studentClassName === normalizedName);
    });
  };

  const canManageAttendanceEntry = (user: any) => Boolean(user && (user.role === "super_admin" || user.role === "principal" || user.permissions?.exams?.create));
  const attendanceEntryStatuses = new Set(["late", "half_day", "full_day", "skipped", "activity"]);

  app.post("/api/attendance-entry/share-link", requireAuthSession, (req, res) => {
    const actor = getMobileAttendanceActor(res);
    const date = String(req.body?.date || "");
    if (!canManageAttendanceEntry(actor)) return res.status(403).json({ error: "Yoklama baÄŸlantÄ±sÄ± oluÅŸturma yetkiniz yok." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "GeÃ§erli bir tarih seÃ§iniz." });
    const now = Math.floor(Date.now() / 1000);
    const payload: AttendanceAccessPayload = {
      scope: "attendance-entry", issuedAt: now, expiresAt: now + attendanceTokenTtlMinutes * 60,
      linkId: crypto.randomBytes(12).toString("hex"), date, createdById: actor.id,
    };
    const token = signAttendancePayload(payload);
    const addresses = Object.values(os.networkInterfaces()).flatMap((items) => items || [])
      .filter((item) => item.family === "IPv4" && !item.internal).map((item) => item.address)
      .filter((address) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
    const configuredPublicUrl = String(process.env.ATTENDANCE_PUBLIC_URL || "").trim().replace(/\/$/, "");
    const baseUrl = configuredPublicUrl || (addresses[0] ? `http://${addresses[0]}:${PORT}` : `http://localhost:${PORT}`);
    const url = new URL(baseUrl);
    url.searchParams.set("mode", "attendance-entry");
    url.hash = `token=${encodeURIComponent(token)}`;
    res.json({ url: url.toString(), linkId: payload.linkId, date, expiresAt: new Date(payload.expiresAt * 1000).toISOString(), isPublic: Boolean(configuredPublicUrl) });
  });

  app.get("/api/public/attendance-entry/bootstrap", requireAttendanceEntryAccess, (_req, res) => {
    const uniqueById = (rows: any[]) => [...new Map(rows.map((item) => [String(item.id), item])).values()];
    res.json({
      date: res.locals.attendanceAccess.date,
      students: uniqueById([...listDocuments("students"), ...listDocuments("school_students")]),
      classrooms: uniqueById([...listDocuments("classrooms"), ...listDocuments("school_classrooms")]),
    });
  });

  app.post("/api/public/attendance-entry/submission", requireAttendanceEntryAccess, limitAttendanceWrites, (req, res) => {
    try {
      const payload: AttendanceAccessPayload = res.locals.attendanceAccess;
      const classroomId = String(req.body?.classroomId || "").trim();
      const classroomName = String(req.body?.classroomName || "").trim();
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : null;
      if (!classroomId || !classroomName || !entries) return res.status(400).json({ error: "SÄ±nÄ±f ve yoklama bilgileri zorunludur." });
      const classStudents = getMobileAttendanceClassStudents(classroomId, classroomName);
      const validStudentIds = new Set(classStudents.map((student: any) => String(student.id)));
      const normalizedEntries = entries.map((entry: any) => ({
        studentId: String(entry.studentId || ""), studentName: String(entry.studentName || "").trim(),
        status: String(entry.status || ""), skippedLessons: Array.isArray(entry.skippedLessons) ? [...new Set(entry.skippedLessons.map(Number).filter((item: number) => Number.isInteger(item) && item >= 1 && item <= 8))] : [],
      }));
      if (normalizedEntries.some((entry: any) => !validStudentIds.has(entry.studentId) || !attendanceEntryStatuses.has(entry.status) || (entry.status === "skipped" && entry.skippedLessons.length === 0))) {
        return res.status(400).json({ error: "Ã–ÄŸrenci durumlarÄ±ndan biri geÃ§ersiz." });
      }
      const id = `${payload.date}_${classroomId}_${payload.linkId}`;
      const now = new Date().toISOString();
      const previous = listDocuments("attendance_mobile_submissions").find((item: any) => item.id === id);
      const record = {
        id, date: payload.date, classroomId, classroomName, entries: normalizedEntries,
        linkId: payload.linkId, status: "pending", submittedAt: now,
        revision: Number(previous?.revision || 0) + 1, approvedAt: null, approvedById: null,
      };
      upsertDocument("attendance_mobile_submissions", id, record);
      res.json({ success: true, record });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/attendance-entry/submissions", requireAuthSession, (req, res) => {
    const actor = getMobileAttendanceActor(res);
    if (!canManageAttendanceEntry(actor)) return res.status(403).json({ error: "Yoklama sonuÃ§larÄ±nÄ± gÃ¶rÃ¼ntÃ¼leme yetkiniz yok." });
    const date = String(req.query.date || "");
    const submissions = listDocuments("attendance_mobile_submissions").filter((item: any) => !date || item.date === date);
    res.setHeader("Cache-Control", "no-store");
    res.json({ submissions });
  });

  app.post("/api/attendance-entry/approve-day", requireAuthSession, (req, res) => {
    try {
      const actor = getMobileAttendanceActor(res);
      const date = String(req.body?.date || "");
      if (!canManageAttendanceEntry(actor)) return res.status(403).json({ error: "Yoklama sonuÃ§larÄ±nÄ± kaydetme yetkiniz yok." });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "GeÃ§erli bir tarih seÃ§iniz." });
      const submissions = listDocuments("attendance_mobile_submissions").filter((item: any) => item.date === date && item.status === "pending");
      const now = new Date().toISOString();
      let savedCount = 0;
      submissions.forEach((submission: any) => {
        submission.entries.forEach((entry: any) => {
          const base = { date, classroomId: submission.classroomId, classroomName: submission.classroomName, studentId: entry.studentId, studentName: entry.studentName, sourceSubmissionId: submission.id, approvedById: actor.id, approvedByName: actor.fullName, approvedAt: now };
          const id = `${date}_${submission.classroomId}_${entry.studentId}`;
          if (["late", "half_day", "full_day"].includes(entry.status)) upsertDocument("attendance_absence_records", id, { ...base, id, status: entry.status });
          if (entry.status === "skipped") upsertDocument("attendance_unauthorized_records", id, { ...base, id, skippedLessons: entry.skippedLessons });
          if (entry.status === "activity") upsertDocument("attendance_activity_records", id, { ...base, id, status: "activity" });
          savedCount += 1;
        });
        upsertDocument("attendance_mobile_submissions", submission.id, { ...submission, status: "approved", approvedAt: now, approvedById: actor.id, approvedByName: actor.fullName });
      });
      res.json({ success: true, submissionCount: submissions.length, savedCount });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/attendance-entry/records/:category", requireAuthSession, (req, res) => {
    const actor = getMobileAttendanceActor(res);
    if (!canManageAttendanceEntry(actor)) return res.status(403).json({ error: "Yoklama kayÄ±tlarÄ±nÄ± gÃ¶rÃ¼ntÃ¼leme yetkiniz yok." });
    const collections: Record<string, string> = { absences: "attendance_absence_records", unauthorized: "attendance_unauthorized_records", activities: "attendance_activity_records" };
    const collection = collections[req.params.category];
    if (!collection) return res.status(404).json({ error: "KayÄ±t kategorisi bulunamadÄ±." });
    const date = String(req.query.date || "");
    res.json({ records: listDocuments(collection).filter((item: any) => !date || item.date === date) });
  });

  app.post("/api/auth/logout", requireAuthSession, (_req, res) => {
    authSessions.delete(res.locals.auth.token);
    res.json({ success: true });
  });

  app.put("/api/auth/directory", requireAuthSession, async (req, res) => {
    const incoming = req.body;
    const current = loadAuthDirectory();
    const session: AuthSession = res.locals.auth.session;
    if (!incoming?.schools || !incoming?.users || session.role === "teacher") return res.status(403).json({ error: "Bu iÅŸlem iÃ§in yetkiniz yok." });
    if (session.role === "super_admin") {
      await saveAuthDirectory({ ...incoming, users: incoming.users.map((user: any) => mergeUserCredentials(current.users, user)) });
      return res.json({ success: true });
    }
    const schoolId = session.schoolId;
    const next = {
      ...current,
      schools: current.schools.map((school: any) => school.id === schoolId ? incoming.schools.find((item: any) => item.id === schoolId) || school : school),
      users: [
        ...current.users.filter((user: any) => user.schoolId !== schoolId),
        ...incoming.users.filter((user: any) => user.schoolId === schoolId && user.role !== "super_admin").map((user: any) => mergeUserCredentials(current.users, user)),
      ],
    };
    await saveAuthDirectory(next);
    res.json({ success: true });
  });

  app.post("/api/auth/password-reset/request", async (req, res) => {
    const schoolCode = String(req.body?.schoolCode || "").trim().toLocaleUpperCase("tr-TR");
    const identifier = normalizeLoginValue(req.body?.identifier);
    const attemptKey = `${requestAddress(req)}:${schoolCode}:${identifier}`;
    const now = Date.now();
    const previousAttempt = passwordResetAttempts.get(attemptKey);
    const attempt = !previousAttempt || previousAttempt.resetAt <= now ? { count: 0, resetAt: now + 15 * 60 * 1000 } : previousAttempt;
    attempt.count += 1;
    passwordResetAttempts.set(attemptKey, attempt);
    if (attempt.count > 5) return res.status(429).json({ error: "Ã‡ok fazla sÄ±fÄ±rlama isteÄŸi yapÄ±ldÄ±. LÃ¼tfen 15 dakika sonra tekrar deneyin." });

    const genericMessage = "Bilgiler kayÄ±tlarÄ±mÄ±zla eÅŸleÅŸiyorsa ÅŸifre sÄ±fÄ±rlama baÄŸlantÄ±sÄ± kayÄ±tlÄ± e-posta adresine gÃ¶nderildi.";
    const state = loadAuthDirectory();
    const school = state.schools.find((item: any) => String(item.code).trim().toLocaleUpperCase("tr-TR") === schoolCode);
    const user = state.users.find((candidate: any) => {
      const sameIdentifier = normalizeLoginValue(candidate.username) === identifier || normalizeLoginValue(candidate.email) === identifier;
      return sameIdentifier && (candidate.role === "super_admin" ? schoolCode === "MERKEZ" : candidate.schoolId === school?.id);
    });
    if (!user?.email || user.status !== "active") return res.json({ success: true, message: genericMessage });

    const rawToken = crypto.randomBytes(36).toString("base64url");
    const requestId = crypto.randomBytes(12).toString("hex");
    const expiresAt = Date.now() + 20 * 60 * 1000;
    upsertDocument("passwordResetRequests", requestId, {
      id: requestId,
      schoolId: user.schoolId,
      userId: user.id,
      tokenHash: tokenDigest(rawToken),
      expiresAt,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });
    const configuredBaseUrl = String(process.env.PASSWORD_RESET_PUBLIC_URL || process.env.ATTENDANCE_PUBLIC_URL || "").trim().replace(/\/$/, "");
    const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
    const resetUrl = new URL(configuredBaseUrl || requestBaseUrl);
    resetUrl.searchParams.set("mode", "password-reset");
    resetUrl.hash = `token=${encodeURIComponent(rawToken)}`;

    let delivered = false;
    const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
    const fromEmail = String(process.env.PASSWORD_RESET_FROM_EMAIL || "").trim();
    if (resendApiKey && fromEmail) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: [user.email],
            subject: "Rota Okul YÃ¶netimi ÅŸifre sÄ±fÄ±rlama",
            html: `<p>SayÄ±n ${String(user.fullName).replace(/[<>&\"]/g, "")},</p><p>Åifrenizi yenilemek iÃ§in aÅŸaÄŸÄ±daki baÄŸlantÄ±yÄ± 20 dakika iÃ§inde kullanÄ±n:</p><p><a href="${resetUrl.toString()}">Åifremi yenile</a></p><p>Bu isteÄŸi siz yapmadÄ±ysanÄ±z mesajÄ± dikkate almayÄ±n.</p>`,
          }),
        });
        delivered = emailResponse.ok;
      } catch { delivered = false; }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true,
      message: genericMessage,
      deliveryConfigured: Boolean(resendApiKey && fromEmail),
      ...(isDirectLocalRequest(req) && !delivered ? { developmentResetUrl: resetUrl.toString() } : {}),
    });
  });

  app.post("/api/auth/password-reset/confirm", async (req, res) => {
    const rawToken = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ error: "Yeni ÅŸifre en az 8 karakter olmalÄ±dÄ±r." });
    const request = listDocuments("passwordResetRequests").find((item: any) => !item.usedAt && item.expiresAt > Date.now() && item.tokenHash === tokenDigest(rawToken));
    if (!request) return res.status(400).json({ error: "Åifre sÄ±fÄ±rlama baÄŸlantÄ±sÄ± geÃ§ersiz, kullanÄ±lmÄ±ÅŸ veya sÃ¼resi dolmuÅŸ." });
    const state = loadAuthDirectory();
    const user = state.users.find((candidate: any) => candidate.id === request.userId && candidate.schoolId === request.schoolId);
    if (!user) return res.status(400).json({ error: "KullanÄ±cÄ± hesabÄ± bulunamadÄ±." });
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const nextState = { ...state, users: state.users.map((candidate: any) => candidate.id === user.id ? { ...candidate, passwordSalt, passwordHash: passwordDigest(password, passwordSalt) } : candidate) };
    await saveAuthDirectory(nextState);
    upsertDocument("passwordResetRequests", request.id, { ...request, usedAt: new Date().toISOString() });
    for (const [token, session] of authSessions) if (session.userId === user.id) authSessions.delete(token);
    res.json({ success: true, message: "Åifreniz yenilendi. Yeni ÅŸifrenizle giriÅŸ yapabilirsiniz." });
  });

  // Database initialization and seeding
  async function initDb() {
    let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
    try {
      client = await pool.connect();
      
      // Create scheduling_libraries table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scheduling_libraries (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          developer VARCHAR(100),
          description TEXT,
          penalty_rules JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Create scheduling_runs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS scheduling_runs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          algorithm VARCHAR(100) NOT NULL,
          initial_penalty INTEGER NOT NULL,
          final_penalty INTEGER NOT NULL,
          duration_ms INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Create tts_links table
      await client.query(`
        CREATE TABLE IF NOT EXISTS tts_links (
          id VARCHAR(12) PRIMARY KEY,
          text TEXT NOT NULL,
          voice VARCHAR(50) NOT NULL,
          student_name VARCHAR(150),
          exam_name VARCHAR(150),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      // Seed data
      await client.query(`
        INSERT IGNORE INTO scheduling_libraries (name, developer, description, penalty_rules)
        VALUES 
          ('Google OR-Tools', 'Google', 'An open-source software suite for optimization, specialized in vehicle routing, flows, integer and linear programming, and constraint programming (CP-SAT solver).', '{"gap_1h_penalty": 10, "gap_2h_penalty": 20, "unwanted_day_penalty": 50}'),
          ('OptaPlanner / Timefold', 'Red Hat / Community', 'A lightweight, embeddable planning engine that optimizes business resource planning use cases such as school timetabling, employee rostering, and vehicle routing.', '{"gap_1h_penalty": 10, "gap_2h_penalty": 20, "unwanted_day_penalty": 50}')
      `);

      console.log("Database initialized and seeded successfully.");
    } catch (err: any) {
      console.error("Error initializing database schema:", err.message);
    } finally {
      client?.release();
    }
  }

  // Call database initialization
  await initDb();

  // API routes

  // SORU BANKASI DOSYA DEPOSU -------------------------------------------------
  // GÃ¶rseller dosya sisteminde, soru metadata kayÄ±tlarÄ± MySQL deposunda tutulur.
  const QUESTION_BANK_COLLECTION = "questionBankRecords";
  const QUESTION_BANK_AUDIT_COLLECTION = "questionBankAudit";
  const QUESTION_BANK_USAGE_COLLECTION = "questionBankUsage";
  const QUESTION_BANK_GROUP_COLLECTION = "questionBankGroups";
  const QUESTION_BANK_EXAM_ARCHIVE_COLLECTION = "questionBankExamArchives";
  const QUESTION_BANK_SCHEMA_VERSION = 35;
  const QUESTION_BANK_IMPORT_SESSION_COLLECTION = "questionBankImportSessions";
  const questionBankRoot = path.join(path.dirname(sqlitePath), "question-bank");
  const questionBankTrashRoot = path.join(questionBankRoot, ".trash");
  const questionBankThumbnailRoot = path.join(questionBankRoot, ".thumbs");
  fs.mkdirSync(questionBankRoot, { recursive: true });
  fs.mkdirSync(questionBankTrashRoot, { recursive: true });
  fs.mkdirSync(questionBankThumbnailRoot, { recursive: true });

  // Soru bankasÄ±nÄ±n kalÄ±cÄ± ana kaynaÄŸÄ±.
  // GÃ¶rselin kendisi dosya sisteminde kalÄ±r; MySQL metadata tutar.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_questions (
      question_id TEXT PRIMARY KEY,
      question_code TEXT NOT NULL DEFAULT '',
      grade INTEGER NOT NULL DEFAULT 0,
      course_id TEXT NOT NULL DEFAULT '',
      unit_id TEXT NOT NULL DEFAULT '',
      topic_id TEXT NOT NULL DEFAULT '',
      outcome_id TEXT NOT NULL DEFAULT '',
      question_type TEXT NOT NULL DEFAULT 'study',
      scope_level TEXT NOT NULL DEFAULT 'outcome',
      answer TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      file_name TEXT NOT NULL DEFAULT '',
      original_file_name TEXT NOT NULL DEFAULT '',
      storage_path TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      thumbnail_path TEXT NOT NULL DEFAULT '',
      thumbnail_url TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      thumbnail_size_bytes INTEGER NOT NULL DEFAULT 0,
      import_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      original_storage_path TEXT NOT NULL DEFAULT '',
      trash_path TEXT NOT NULL DEFAULT '',
      thumbnail_updated_at TEXT,
      column_span INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_qbq_hierarchy
      ON question_bank_questions(grade, course_id, unit_id, topic_id, outcome_id);
    CREATE INDEX IF NOT EXISTS idx_qbq_type_status
      ON question_bank_questions(question_type, status);
    CREATE INDEX IF NOT EXISTS idx_qbq_topic
      ON question_bank_questions(course_id, topic_id, status);
    CREATE INDEX IF NOT EXISTS idx_qbq_outcome
      ON question_bank_questions(course_id, outcome_id, status);
    CREATE INDEX IF NOT EXISTS idx_qbq_hash
      ON question_bank_questions(content_hash);
    CREATE INDEX IF NOT EXISTS idx_qbq_code
      ON question_bank_questions(question_code);
    CREATE INDEX IF NOT EXISTS idx_qbq_updated
      ON question_bank_questions(updated_at);
  `);

  const questionBankQuestionColumns = sqlite.prepare("PRAGMA table_info(question_bank_questions)").all() as any[];
  if (!questionBankQuestionColumns.some((column: any) => String(column?.name || "") === "column_span")) {
    sqlite.exec("ALTER TABLE question_bank_questions ADD COLUMN column_span INTEGER NOT NULL DEFAULT 1");
  }
  if (!questionBankQuestionColumns.some((column: any) => String(column?.name || "") === "original_file_name")) {
    sqlite.exec("ALTER TABLE question_bank_questions ADD COLUMN original_file_name TEXT NOT NULL DEFAULT ''");
  }

  const questionBankQuestionUpsert = sqlite.prepare(`
    INSERT INTO question_bank_questions (
      question_id, question_code, grade, course_id, unit_id, topic_id, outcome_id,
      question_type, scope_level, answer, sort_order, file_name, original_file_name, storage_path, image_url,
      thumbnail_path, thumbnail_url, content_hash, mime_type, size_bytes,
      thumbnail_size_bytes, import_session_id, status, created_at, updated_at, deleted_at,
      original_storage_path, trash_path, thumbnail_updated_at, column_span
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      question_code = excluded.question_code,
      grade = excluded.grade,
      course_id = excluded.course_id,
      unit_id = excluded.unit_id,
      topic_id = excluded.topic_id,
      outcome_id = excluded.outcome_id,
      question_type = excluded.question_type,
      scope_level = excluded.scope_level,
      answer = excluded.answer,
      sort_order = excluded.sort_order,
      file_name = excluded.file_name,
      original_file_name = excluded.original_file_name,
      storage_path = excluded.storage_path,
      image_url = excluded.image_url,
      thumbnail_path = excluded.thumbnail_path,
      thumbnail_url = excluded.thumbnail_url,
      content_hash = excluded.content_hash,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      thumbnail_size_bytes = excluded.thumbnail_size_bytes,
      import_session_id = excluded.import_session_id,
      status = excluded.status,
      created_at = COALESCE(question_bank_questions.created_at, excluded.created_at),
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      original_storage_path = excluded.original_storage_path,
      trash_path = excluded.trash_path,
      thumbnail_updated_at = excluded.thumbnail_updated_at,
      column_span = excluded.column_span
  `);

  const stripQuestionImageExtension = (value: unknown) =>
    String(value || "").replace(/\.(?:png|jpe?g|webp)$/i, "").trim();

  const inferQuestionHierarchyFromCode = (questionCode: unknown) => {
    const clean = stripQuestionImageExtension(questionCode);
    const base = clean.replace(/_\d+_(?:G[A-Z0-9]+_)?[A-E]$/i, "");
    const parts = base.split(".").map((item) => item.trim()).filter(Boolean);
    const grade = Number(parts[0] || 0);
    if (![9, 10, 11, 12].includes(grade) || parts.length < 4) return null;

    return {
      grade,
      courseId: String(parts[1] || ""),
      unitId: parts.slice(0, 3).join("."),
      topicId: parts.slice(0, 4).join("."),
      outcomeId: parts.length > 4 ? parts.join(".") : "",
      scopeLevel: parts.length > 4 ? "outcome" : "topic",
    };
  };

  const questionCodeTail = (value: unknown) => {
    const clean = stripQuestionImageExtension(value);
    if (!clean) return null;
    const groupMatch = clean.match(/(?:^|_)(\d+)_(G[A-Z0-9]+)_([A-E])$/i);
    if (groupMatch) {
      return {
        order: Math.max(1, Number(groupMatch[1] || 1)),
        groupToken: String(groupMatch[2] || "").toUpperCase(),
        answer: String(groupMatch[3] || "").toUpperCase(),
      };
    }
    const normalMatch = clean.match(/(?:^|_)(\d+)_([A-E])$/i);
    if (!normalMatch) return null;
    return {
      order: Math.max(1, Number(normalMatch[1] || 1)),
      groupToken: "",
      answer: String(normalMatch[2] || "").toUpperCase(),
    };
  };

  const canonicalQuestionCodeForRecord = (record: any) => {
    const baseId = String(record?.outcomeId || record?.topicId || "").trim();
    if (!baseId) return "";

    const tail = questionCodeTail(record?.fileName) || questionCodeTail(record?.questionCode);
    const order = Math.max(1, Number(tail?.order || record?.order || 1));
    const answer = String(record?.answer || tail?.answer || "").trim().toUpperCase();
    if (!/^[A-E]$/.test(answer)) return "";

    const paddedOrder = String(order).padStart(3, "0");
    return tail?.groupToken
      ? `${baseId}_${paddedOrder}_${tail.groupToken}_${answer}`
      : `${baseId}_${paddedOrder}_${answer}`;
  };

  const questionRowToRecord = (row: any) => ({
    id: String(row.question_id || ""),
    questionCode: String(row.question_code || ""),
    grade: Number(row.grade || 0),
    courseId: String(row.course_id || ""),
    unitId: String(row.unit_id || ""),
    topicId: String(row.topic_id || ""),
    outcomeId: String(row.outcome_id || ""),
    questionType: String(row.question_type || "study"),
    scopeLevel: String(row.scope_level || (row.outcome_id ? "outcome" : "topic")),
    answer: String(row.answer || ""),
    order: Number(row.sort_order || 0),
    fileName: String(row.file_name || ""),
    originalFileName: String(row.original_file_name || ""),
    storagePath: String(row.storage_path || ""),
    imageUrl: String(row.image_url || ""),
    thumbnailPath: String(row.thumbnail_path || ""),
    thumbnailUrl: String(row.thumbnail_url || ""),
    contentHash: String(row.content_hash || ""),
    mimeType: String(row.mime_type || ""),
    sizeBytes: Number(row.size_bytes || 0),
    thumbnailSizeBytes: Number(row.thumbnail_size_bytes || 0),
    importSessionId: row.import_session_id || null,
    status: String(row.status || "active"),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || "",
    deletedAt: row.deleted_at || undefined,
    originalStoragePath: String(row.original_storage_path || ""),
    trashPath: String(row.trash_path || ""),
    thumbnailUpdatedAt: row.thumbnail_updated_at || undefined,
    columnSpan: Number(row.column_span || 1) === 2 ? 2 : 1,
  });

  type QuestionGroupMode = "required" | "free";
  type QuestionGroupLayout = "normal" | "full-width-source";
  type QuestionGroupRecord = {
    id: string;
    mode: QuestionGroupMode;
    layout: QuestionGroupLayout;
    title?: string;
    instructionText?: string;
    instructionImageUrl?: string;
    instructionQuestionId?: string;
    questionIds: string[];
    createdAt: string;
    updatedAt: string;
  };

  const normalizeQuestionGroupRecord = (raw: any): QuestionGroupRecord | null => {
    const id = String(raw?.id || raw?.groupId || "").trim();
    const questionIds = [...new Set(
      (Array.isArray(raw?.questionIds) ? raw.questionIds : [])
        .map((value: any) => String(value || "").trim())
        .filter(Boolean),
    )];
    if (!id || questionIds.length < 2) return null;
    const now = new Date().toISOString();
    return {
      id,
      mode: String(raw?.mode || "required").toLowerCase() === "free" ? "free" : "required",
      layout: String(raw?.layout || "normal").toLowerCase() === "full-width-source" ? "full-width-source" : "normal",
      title: String(raw?.title || "").trim().slice(0, 240) || undefined,
      instructionText: String(raw?.instructionText || "").trim().slice(0, 20000) || undefined,
      instructionImageUrl: String(raw?.instructionImageUrl || "").trim() || undefined,
      instructionQuestionId: String(raw?.instructionQuestionId || "").trim() || undefined,
      questionIds,
      createdAt: String(raw?.createdAt || now),
      updatedAt: String(raw?.updatedAt || now),
    };
  };

  // Preserve the public group identity while fitting the document-key limit.
  const questionGroupDocumentId = (groupId: string) =>
    /^[A-Za-z0-9_:.-]{1,80}$/.test(groupId)
      ? groupId
      : `qg-${crypto.createHash("sha256").update(groupId).digest("hex")}`;

  const listQuestionGroupRecords = (): QuestionGroupRecord[] =>
    (listDocuments(QUESTION_BANK_GROUP_COLLECTION) as any[])
      .map(normalizeQuestionGroupRecord)
      .filter(Boolean) as QuestionGroupRecord[];

  const inferredFileNameGroupParts = (record: any) => {
    const candidates = [
      record?.originalFileName,
      record?.original_file_name,
      record?.questionCode,
      record?.question_code,
      record?.fileName,
      record?.file_name,
      record?.storagePath,
      record?.storage_path,
    ];
    for (const candidate of candidates) {
      const modern = parseQuestionGroupFileName(candidate);
      if (modern) return { token: modern.token, order: modern.order, isInstruction: modern.isInstruction, modern: true };
      const clean = String(candidate || "").replace(/\\/g, "/").split(/[?#]/, 1)[0];
      const baseName = clean.split("/").filter(Boolean).pop() || clean;
      const stem = stripQuestionImageExtension(baseName);
      if (!stem) continue;
      const tokenMatches = Array.from(stem.matchAll(/(?:^|[_\-.\s])(G\d{1,3})(?=$|[_\-.\s])/gi));
      const tokenMatch = tokenMatches.length ? tokenMatches[tokenMatches.length - 1] : null;
      if (!tokenMatch) continue;
      const rawToken = String(tokenMatch[1] || "").toUpperCase();
      const tokenNumber = Number(rawToken.replace(/\D/g, ""));
      const token = Number.isFinite(tokenNumber) && tokenNumber > 0
        ? `G${String(tokenNumber).padStart(2, "0")}`
        : rawToken;
      const fullMatch = String(tokenMatch[0] || "");
      const tokenOffsetInMatch = Math.max(0, fullMatch.toUpperCase().lastIndexOf(rawToken));
      const tokenIndex = Number(tokenMatch.index || 0) + tokenOffsetInMatch;
      const before = stem.slice(0, tokenIndex);
      const after = stem.slice(tokenIndex + rawToken.length);
      const beforeNumbers = Array.from(before.matchAll(/(?:^|[_\-.\s])(\d+)(?=$|[_\-.\s])/g));
      const afterNumbers = Array.from(after.matchAll(/(?:^|[_\-.\s])(\d+)(?=$|[_\-.\s])/g));
      const newStyleQuestionOrder = after.match(/(?:^|[_\-.\s])S[_-]?(\d+)(?=$|[_\-.\s])/i)?.[1] || "";
      const nearestBefore = beforeNumbers.length ? String(beforeNumbers[beforeNumbers.length - 1][1] || "") : "";
      const nearestAfter = newStyleQuestionOrder || (afterNumbers.length ? String(afterNumbers[0][1] || "") : "");
      const fallbackOrder = Number(record?.order || record?.sortOrder || record?.sort_order || 0);
      return {
        token,
        modern: false,
        isInstruction: false,
        order: Math.max(0, Number(nearestBefore || nearestAfter || fallbackOrder || 0)),
      };
    }
    return null;
  };

  const buildQuestionGroupIndex = () => {
    const index = new Map<string, { group: QuestionGroupRecord; order: number }>();
    const storedGroups = listQuestionGroupRecords();
    const storedMembership = new Map<string, { group: QuestionGroupRecord; order: number }>();

    storedGroups.forEach((group) => {
      group.questionIds.forEach((questionId, order) => {
        const hit = { group, order };
        if (!storedMembership.has(questionId)) storedMembership.set(questionId, hit);
        if (!index.has(questionId)) index.set(questionId, hit);
      });
    });

    /*
     * ESKİ Gxx KAYITLARINI OTOMATİK GRUPLA:
     * Bazı eski soru kayıtlarında question-bank group belgesi hiç oluşmamış olsa
     * bile canonical question_code / file_name içinde G01, G02... bilgisi vardır.
     * PDF'nin yönergeyi normal soru sanmaması için bu kayıtları API cevabında
     * dinamik olarak tek grupta birleştiriyoruz. Böylece ilk sıra kartı frontend
     * tarafından yönerge olarak ayrılıp soru numarasından tamamen çıkarılabilir.
     */
    const inferred = new Map<string, Array<{ record: any; order: number }>>();
    const activeRows = sqlite.prepare("SELECT * FROM question_bank_questions WHERE status IN ('active', 'instruction')").all() as any[];
    activeRows.forEach((row) => {
      const record = questionRowToRecord(row);
      const parsed = inferredFileNameGroupParts(record);
      if (!parsed?.token) return;
      const scope = [
        record.grade,
        record.courseId,
        record.unitId,
        record.topicId,
        record.outcomeId,
      ].map((value) => String(value || "").trim()).join(":");
      const groupId = `filename-group-inferred:${scope}:${parsed.token}`;
      const members = inferred.get(groupId) || [];
      members.push({ record, order: Math.max(0, Number(parsed.order ?? record.order ?? 0)) });
      inferred.set(groupId, members);
    });

    inferred.forEach((members, inferredGroupId) => {
      if (members.length < 2) return;
      const ordered = [...members].sort((left, right) =>
        left.order - right.order ||
        String(left.record.id || "").localeCompare(String(right.record.id || ""), "tr-TR", { numeric: true }),
      );
      const existingGroup = ordered
        .map((member) => storedMembership.get(String(member.record.id || ""))?.group)
        .find(Boolean);
      // Gxx yalnız dosya adından çıkarılıyorsa gerçek grup için en az
      // 1 yönerge + 2 soru = 3 kart gerekir. İki bağımsız soruyu yanlışlıkla
      // yönergeli grup sayma. Kayıtlı grup varsa mevcut ilişki korunur.
      if (!existingGroup && members.length < 3) return;
      const now = new Date().toISOString();
      const explicitInstructionImage = String(existingGroup?.instructionImageUrl || "").trim();
      const existingInstructionId = String(existingGroup?.instructionQuestionId || "").trim();
      const explicitInstructionMember = ordered.find((member) =>
        inferredFileNameGroupParts(member.record)?.isInstruction ||
        String(member.record.status || "") === "instruction",
      );
      const hasModernNames = ordered.some((member) => inferredFileNameGroupParts(member.record)?.modern);
      const instructionMember = explicitInstructionMember ||
        (ordered.length >= 3 && !explicitInstructionImage && !hasModernNames ? ordered[0] : null);
      const printableMembers = ordered.filter((member) =>
        member !== instructionMember && String(member.record.id || "") !== existingInstructionId &&
        String(member.record.status || "") !== "instruction",
      );
      const inferredGroup: QuestionGroupRecord = {
        id: inferredGroupId,
        mode: existingGroup?.mode || "required",
        layout: (explicitInstructionImage || instructionMember) ? "full-width-source" : (existingGroup?.layout || "normal"),
        title: existingGroup?.title,
        instructionText: existingGroup?.instructionText,
        instructionImageUrl: explicitInstructionImage || String(instructionMember?.record?.imageUrl || "").trim() || undefined,
        instructionQuestionId: existingInstructionId || String(instructionMember?.record?.id || "").trim() || undefined,
        questionIds: printableMembers.map((member) => String(member.record.id || "")).filter(Boolean),
        createdAt: existingGroup?.createdAt || now,
        updatedAt: now,
      };
      printableMembers.forEach((member, order) => {
        const questionId = String(member.record.id || "");
        if (!questionId) return;
        index.set(questionId, { group: inferredGroup, order });
      });
    });

    return index;
  };

  const attachQuestionGroupMetadata = (record: any, index?: Map<string, { group: QuestionGroupRecord; order: number }>) => {
    const groupIndex = index || buildQuestionGroupIndex();
    const hit = groupIndex.get(String(record?.id || record?.questionId || ""));
    if (!hit) return record;
    const { group, order } = hit;
    return {
      ...record,
      questionGroupId: group.id,
      questionGroupMode: group.mode,
      questionGroupLayout: group.layout,
      questionGroupOrder: order,
      questionGroupSize: group.questionIds.length,
      questionGroupTitle: group.title || "",
      questionGroupInstructionText: group.instructionText || "",
      questionGroupInstructionImageUrl: group.instructionImageUrl || "",
      questionGroupInstructionQuestionId: group.instructionQuestionId || "",
    };
  };

  const removeQuestionFromQuestionGroups = (questionId: string) => {
    const id = String(questionId || "").trim();
    if (!id) return;
    listQuestionGroupRecords().forEach((group) => {
      if (!group.questionIds.includes(id)) return;
      const nextIds = group.questionIds.filter((value) => value !== id);
      if (nextIds.length < 2) {
        deleteDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id));
      } else {
        upsertDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id), {
          ...group,
          questionIds: nextIds,
          updatedAt: new Date().toISOString(),
        });
      }
    });
  };

  const persistQuestionBankRecord = (record: any, mirrorLegacy = false) => {
    if (!record?.id) throw new Error("Soru kimliÄŸi bulunamadÄ±.");
    const normalized = {
      ...record,
      questionType: String(record.questionType || "study"),
      scopeLevel: String(record.scopeLevel || (record.outcomeId ? "outcome" : "topic")),
      status: String(record.status || "active"),
      originalFileName: String(record.originalFileName || record.original_file_name || ""),
      updatedAt: String(record.updatedAt || new Date().toISOString()),
      createdAt: String(record.createdAt || record.updatedAt || new Date().toISOString()),
      columnSpan: Number(record.columnSpan || record.column_span || 1) === 2 ? 2 : 1,
    };

    questionBankQuestionUpsert.run(
      String(normalized.id),
      String(normalized.questionCode || ""),
      Number(normalized.grade || 0),
      String(normalized.courseId || ""),
      String(normalized.unitId || ""),
      String(normalized.topicId || ""),
      String(normalized.outcomeId || ""),
      String(normalized.questionType || "study"),
      String(normalized.scopeLevel || (normalized.outcomeId ? "outcome" : "topic")),
      String(normalized.answer || "").toUpperCase(),
      Number(normalized.order || 0),
      String(normalized.fileName || ""),
      String(normalized.originalFileName || ""),
      String(normalized.storagePath || ""),
      String(normalized.imageUrl || ""),
      String(normalized.thumbnailPath || ""),
      String(normalized.thumbnailUrl || ""),
      String(normalized.contentHash || ""),
      String(normalized.mimeType || ""),
      Number(normalized.sizeBytes || 0),
      Number(normalized.thumbnailSizeBytes || 0),
      normalized.importSessionId || null,
      String(normalized.status || "active"),
      normalized.createdAt || null,
      normalized.updatedAt || null,
      normalized.deletedAt || null,
      String(normalized.originalStoragePath || ""),
      String(normalized.trashPath || ""),
      normalized.thumbnailUpdatedAt || null,
      Number(normalized.columnSpan || 1) === 2 ? 2 : 1,
    );

    // Soru kayıtlarının tek kalıcı kaynağı question_bank_questions tablosudur.
    // mirrorLegacy parametresi eski çağrı imzasıyla uyumluluk için tutulur.
    void mirrorLegacy;
    return normalized;
  };

  const allQuestionRecords = () => {
    const groupIndex = buildQuestionGroupIndex();
    return (sqlite.prepare(`
      SELECT *
      FROM question_bank_questions
      ORDER BY COALESCE(created_at, '') DESC, question_id
    `).all() as any[])
      .map(questionRowToRecord)
      .map((record: any) => attachQuestionGroupMetadata(record, groupIndex));
  };

  const activeQuestionRecords = () =>
    allQuestionRecords().filter((record) => String(record.status || "active") === "active");

  const findQuestionRecordByStoragePath = (storagePath: string) =>
    allQuestionRecords().find((record) => String(record.storagePath || "") === String(storagePath));


  const safeQuestionArchiveFolderName = (value: unknown) => {
    let cleaned = String(value || "")
      .normalize("NFKC")
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 180);
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(cleaned)) cleaned = `_${cleaned}`;
    return cleaned || "Sinav-Test";
  };

  const resolveQuestionBankInternalPath = (relativePath: unknown) => {
    const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const segments = normalized.split("/").filter(Boolean);
    if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) return "";
    const absolute = path.resolve(questionBankRoot, ...segments);
    const root = path.resolve(questionBankRoot) + path.sep;
    return absolute.startsWith(root) ? absolute : "";
  };

  const removeQuestionArchiveRecord = (record: any) => {
    const archivePath = String(record?.storagePath || "").replace(/\\/g, "/");
    const id = String(record?.id || "").trim();
    const sharedByAnotherRecord = archivePath
      ? (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[]).some(
          (item) => String(item?.id || "") !== id && String(item?.storagePath || "").replace(/\\/g, "/") === archivePath,
        )
      : false;
    const absolute = resolveQuestionBankInternalPath(archivePath);
    if (!sharedByAnotherRecord && absolute && fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      try { fs.unlinkSync(absolute); } catch {}
    }
    if (!sharedByAnotherRecord && absolute) {
      const archiveDir = path.dirname(absolute);
      try {
        if (fs.existsSync(archiveDir) && fs.readdirSync(archiveDir).length === 0) fs.rmdirSync(archiveDir);
      } catch {}
    }
    if (id) deleteDocument(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION, id);
  };

  const upsertQuestionArchiveEntry = (input: {
    question: any;
    examId: string;
    examName: string;
    source?: string;
  }) => {
    const question = input.question;
    const examId = String(input.examId || "").trim();
    const examName = String(input.examName || "").trim();
    const questionId = String(question?.id || question?.questionId || "").trim();
    const sourceStoragePath = safeStoredQuestionPath(question?.storagePath);
    if (!examId || !examName || !questionId || !sourceStoragePath) {
      return { copied: false, reason: "missing-metadata", storagePath: "" };
    }

    const sourceAbsolute = path.resolve(questionBankRoot, sourceStoragePath);
    if (!fs.existsSync(sourceAbsolute) || !fs.statSync(sourceAbsolute).isFile()) {
      return { copied: false, reason: "missing-source-file", storagePath: "" };
    }

    const examFolder = safeQuestionArchiveFolderName(examName);
    const sourceDir = path.posix.dirname(sourceStoragePath);
    const archiveStoragePath = path.posix.join(sourceDir, examFolder, path.posix.basename(sourceStoragePath));
    const targetAbsolute = resolveQuestionBankInternalPath(archiveStoragePath);
    if (!targetAbsolute) throw new Error("Sınav/test soru klasörü güvenli biçimde oluşturulamadı.");

    const archiveId = `${examId}::${questionId}`;
    const previous = (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
      .find((item) => String(item?.id || "") === archiveId);
    const previousPath = String(previous?.storagePath || "").replace(/\\/g, "/");
    if (previousPath && previousPath !== archiveStoragePath) removeQuestionArchiveRecord(previous);

    fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });
    fs.copyFileSync(sourceAbsolute, targetAbsolute);

    const now = new Date().toISOString();
    const record = {
      id: archiveId,
      examId,
      examName,
      questionId,
      questionCode: String(question?.questionCode || ""),
      sourceStoragePath,
      storagePath: archiveStoragePath,
      source: String(input.source || "question-usage").slice(0, 120),
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    upsertDocument(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION, archiveId, record);
    return { copied: true, reason: "", storagePath: archiveStoragePath, record };
  };

  const syncQuestionArchiveSet = (input: {
    examId: string;
    examName: string;
    questionIds: string[];
    source?: string;
  }) => {
    const examId = String(input.examId || "").trim();
    const examName = String(input.examName || "").trim();
    if (!examId || !examName) throw new Error("Sınav/test kimliği ve adı zorunludur.");

    const desiredIds = [...new Set((input.questionIds || []).map(String).map((value) => value.trim()).filter(Boolean))];
    const desiredSet = new Set(desiredIds);
    const currentRecords = (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
      .filter((item) => String(item?.examId || "") === examId);

    currentRecords.forEach((record) => {
      if (!desiredSet.has(String(record?.questionId || ""))) removeQuestionArchiveRecord(record);
    });

    const questionMap = new Map(
      activeQuestionRecords().map((question: any) => [String(question?.id || ""), question]),
    );
    let copied = 0;
    const skipped: Array<{ questionId: string; reason: string }> = [];
    const archivePaths: string[] = [];
    desiredIds.forEach((questionId) => {
      const question = questionMap.get(questionId);
      if (!question) {
        skipped.push({ questionId, reason: "question-not-found" });
        return;
      }
      const result = upsertQuestionArchiveEntry({ question, examId, examName, source: input.source });
      if (result.copied) {
        copied += 1;
        if (result.storagePath) archivePaths.push(result.storagePath);
      } else {
        skipped.push({ questionId, reason: result.reason || "not-copied" });
      }
    });

    return { copied, requested: desiredIds.length, skipped, archivePaths };
  };

  const removeQuestionArchiveSet = (examIdValue: unknown) => {
    const examId = String(examIdValue || "").trim();
    if (!examId) return { removed: 0 };
    const records = (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
      .filter((item) => String(item?.examId || "") === examId);
    records.forEach((record) => removeQuestionArchiveRecord(record));
    return { removed: records.length };
  };

  const migrateLegacyQuestionRecordsToCanonicalTable = () => {
    const legacy = listDocuments(QUESTION_BANK_COLLECTION) as any[];
    const currentCount = Number(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0,
    );
    if (legacy.length === 0) return { migrated: 0, total: currentCount };

    // Bu fonksiyon hem normal aÃ§Ä±lÄ±ÅŸta hem de runQuestionBankMigration iÃ§inden
    // Ã§aÄŸrÄ±labilir. Migration yÃ¶neticisi zaten transaction aÃ§tÄ±ÄŸÄ± iÃ§in burada
    // iÃ§ iÃ§e BEGIN/COMMIT baÅŸlatmÄ±yoruz.
    let migrated = 0;
    for (const record of legacy) {
      const exists = sqlite.prepare(
        "SELECT 1 FROM question_bank_questions WHERE question_id = ? LIMIT 1",
      ).get(String(record?.id || ""));
      if (!record?.id || exists) continue;
      persistQuestionBankRecord(record, false);
      migrated += 1;
    }

    return {
      migrated,
      total: Number(
        (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0,
      ),
    };
  };

  let canonicalHierarchyRepairedOnStartup = 0;

  const repairCanonicalQuestionHierarchy = () => {
    let repaired = 0;
    for (const record of allQuestionRecords()) {
      // Özellikle kısa adla yüklenmiş Gxx sorularında question_code müfredat
      // kimliğini taşımadığında Soru İşlemleri kapsam sorgusu kaydı bulamayabiliyor.
      // Mevcut dosya adını/fiziksel yolu değiştirmeden yalnız canonical soru kodunu
      // müfredat kimliği + sıra + grup token'ı + cevap biçimine getiriyoruz.
      const inferredFromCode = inferQuestionHierarchyFromCode(record?.questionCode);
      const inferredFromFile = inferQuestionHierarchyFromCode(record?.fileName);
      const existingInferred = inferredFromFile?.outcomeId
        ? inferredFromFile
        : inferredFromCode || inferredFromFile;
      const canonicalCode = canonicalQuestionCodeForRecord(
        existingInferred
          ? {
              ...record,
              ...existingInferred,
            }
          : record,
      );
      const inferred = existingInferred || inferQuestionHierarchyFromCode(
        canonicalCode || record?.questionCode || record?.fileName,
      );
      if (!inferred) continue;

      const needsRepair =
        Boolean(canonicalCode && String(record.questionCode || "") !== canonicalCode) ||
        Number(record.grade || 0) !== inferred.grade ||
        String(record.courseId || "") !== inferred.courseId ||
        String(record.unitId || "") !== inferred.unitId ||
        String(record.topicId || "") !== inferred.topicId ||
        String(record.outcomeId || "") !== inferred.outcomeId ||
        String(record.scopeLevel || "") !== inferred.scopeLevel;

      if (!needsRepair) continue;

      const next = {
        ...record,
        ...inferred,
        questionCode: canonicalCode || String(record.questionCode || ""),
        updatedAt: new Date().toISOString(),
      };
      // Migration 34 bu noktada question_bank_index yardımcıları henüz
      // tanımlanmadan çalışır. Önce yalnız canonical kaydı düzeltiriz.
      // İndeks, helper'lar tanımlandıktan sonra tek seferde yeniden kurulur.
      persistQuestionBankRecord(next);
      repaired += 1;
    }
    return repaired;
  };

  const canonicalQuestionMigrationResult = migrateLegacyQuestionRecordsToCanonicalTable();
  if (canonicalQuestionMigrationResult.migrated > 0) {
    console.log(
      `[QUESTION-BANK] ${canonicalQuestionMigrationResult.migrated} eski soru kaydÄ± question_bank_questions tablosuna taÅŸÄ±ndÄ±.`,
    );
  }


  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_migration_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      target_version INTEGER NOT NULL DEFAULT 0,
      current_version INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'idle',
      backup_path TEXT,
      last_error TEXT,
      started_at TEXT,
      completed_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const getQuestionBankMigrationState = () =>
    sqlite.prepare(`
      SELECT
        target_version AS targetVersion,
        current_version AS currentVersion,
        status,
        backup_path AS backupPath,
        last_error AS lastError,
        started_at AS startedAt,
        completed_at AS completedAt,
        updated_at AS updatedAt
      FROM question_bank_migration_state
      WHERE id = 1
    `).get() as any;

  const setQuestionBankMigrationState = (payload: {
    targetVersion: number;
    currentVersion: number;
    status: string;
    backupPath?: string | null;
    lastError?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }) => {
    sqlite.prepare(`
      INSERT INTO question_bank_migration_state (
        id, target_version, current_version, status, backup_path,
        last_error, started_at, completed_at, updated_at
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        target_version = excluded.target_version,
        current_version = excluded.current_version,
        status = excluded.status,
        backup_path = excluded.backup_path,
        last_error = excluded.last_error,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `).run(
      payload.targetVersion,
      payload.currentVersion,
      payload.status,
      payload.backupPath || null,
      payload.lastError || null,
      payload.startedAt || null,
      payload.completedAt || null,
      new Date().toISOString(),
    );
  };

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_performance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      measured_at TEXT NOT NULL,
      active_questions INTEGER NOT NULL DEFAULT 0,
      capacity_class TEXT NOT NULL,
      performance_grade TEXT NOT NULL,
      average_latency_ms INTEGER NOT NULL DEFAULT 0,
      slowest_latency_ms INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      tests_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qb_performance_history_date
      ON question_bank_performance_history(measured_at DESC);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_health_score_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculated_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      status TEXT NOT NULL,
      active_records INTEGER NOT NULL DEFAULT 0,
      indexed_records INTEGER NOT NULL DEFAULT 0,
      missing_files INTEGER NOT NULL DEFAULT 0,
      orphan_files INTEGER NOT NULL DEFAULT 0,
      quarantine_files INTEGER NOT NULL DEFAULT 0,
      duplicate_hash_groups INTEGER NOT NULL DEFAULT 0,
      pending_writes INTEGER NOT NULL DEFAULT 0,
      failed_writes INTEGER NOT NULL DEFAULT 0,
      deductions_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qb_health_score_history_date
      ON question_bank_health_score_history(calculated_at DESC);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_safe_action_audit (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      result_json TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qb_safe_action_audit_started
      ON question_bank_safe_action_audit(started_at DESC);

    CREATE INDEX IF NOT EXISTS idx_qb_safe_action_audit_action
      ON question_bank_safe_action_audit(action_id, started_at DESC);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_integrity_snapshot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checked_at TEXT NOT NULL,
      active_records INTEGER NOT NULL DEFAULT 0,
      indexed_records INTEGER NOT NULL DEFAULT 0,
      missing_files INTEGER NOT NULL DEFAULT 0,
      orphan_files INTEGER NOT NULL DEFAULT 0,
      quarantine_files INTEGER NOT NULL DEFAULT 0,
      duplicate_hash_groups INTEGER NOT NULL DEFAULT 0,
      pending_writes INTEGER NOT NULL DEFAULT 0,
      failed_writes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      details_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qb_integrity_snapshot_checked
      ON question_bank_integrity_snapshot(checked_at DESC);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_write_journal (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      question_id TEXT,
      question_code TEXT,
      target_path TEXT,
      temp_path TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL,
      committed_at TEXT,
      recovered_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_qb_write_journal_status
      ON question_bank_write_journal(status, created_at);
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_startup_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checked_at TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      target_version INTEGER NOT NULL,
      migration_status TEXT NOT NULL,
      writable INTEGER NOT NULL,
      source_records INTEGER NOT NULL DEFAULT 0,
      indexed_records INTEGER NOT NULL DEFAULT 0,
      active_records INTEGER NOT NULL DEFAULT 0,
      missing_files INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      details_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qb_startup_audit_checked
      ON question_bank_startup_audit(checked_at DESC);
  `);

  const currentQuestionBankSchemaVersion = () => {
    const row = sqlite.prepare(`
      SELECT MAX(version) AS version
      FROM question_bank_schema_migrations
    `).get() as any;
    return Number(row?.version || 0);
  };

  const questionBankWriteGate = () => {
    const currentVersion = currentQuestionBankSchemaVersion();
    const state = getQuestionBankMigrationState();
    const failed = String(state?.status || "") === "failed";
    const outdated = currentVersion < QUESTION_BANK_SCHEMA_VERSION;

    return {
      writable: !failed && !outdated,
      failed,
      outdated,
      currentVersion,
      targetVersion: QUESTION_BANK_SCHEMA_VERSION,
      migrationStatus: String(state?.status || "idle"),
      lastError: state?.lastError || null,
      backupPath: state?.backupPath || null,
    };
  };

  const validateQuestionBankWriteReadiness = () => {
    const gate = questionBankWriteGate();
    const sourceRecords = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0);
    const indexedRecords = Number(
      (sqlite.prepare(
        "SELECT COUNT(*) AS count FROM question_bank_index",
      ).get() as any)?.count || 0,
    );

    const activeRecords = allQuestionRecords().filter(
      (record) => String(record.status || "active") === "active",
    );

    const missingFiles = activeRecords.filter((record) => {
      const storagePath = safeStoredQuestionPath(record.storagePath);
      return (
        !storagePath ||
        !fs.existsSync(path.resolve(questionBankRoot, storagePath))
      );
    });

    const checks = [
      {
        id: "schema",
        ok: gate.currentVersion >= gate.targetVersion && !gate.failed,
        detail:
          gate.currentVersion >= gate.targetVersion && !gate.failed
            ? `Åema v${gate.currentVersion} gÃ¼ncel.`
            : `Åema v${gate.currentVersion}/v${gate.targetVersion}, migration durumu: ${gate.migrationStatus}.`,
      },
      {
        id: "index",
        ok: sourceRecords === indexedRecords,
        detail:
          sourceRecords === indexedRecords
            ? `${indexedRecords} kayÄ±t indeks ile senkron.`
            : `Kaynak ${sourceRecords}, indeks ${indexedRecords}.`,
      },
      {
        id: "files",
        ok: missingFiles.length === 0,
        detail:
          missingFiles.length === 0
            ? `${activeRecords.length} aktif sorunun fiziksel dosyasÄ± hazÄ±r.`
            : `${missingFiles.length} aktif sorunun fiziksel dosyasÄ± eksik.`,
      },
    ];

    return {
      ready: checks.every((check) => check.ok),
      checks,
      sourceRecords,
      indexedRecords,
      activeRecords: activeRecords.length,
      missingFiles: missingFiles.length,
      gate,
    };
  };


  const recordQuestionBankStartupAudit = () => {
    const readiness = validateQuestionBankWriteReadiness();
    const gate = questionBankWriteGate();
    const checkedAt = new Date().toISOString();
    const status =
      readiness.ready && gate.writable
        ? "healthy"
        : gate.failed
          ? "migration_failed"
          : readiness.missingFiles > 0
            ? "missing_files"
            : readiness.sourceRecords !== readiness.indexedRecords
              ? "index_mismatch"
              : "read_only";

    sqlite.prepare(`
      INSERT INTO question_bank_startup_audit (
        checked_at, schema_version, target_version, migration_status,
        writable, source_records, indexed_records, active_records,
        missing_files, status, details_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkedAt,
      gate.currentVersion,
      gate.targetVersion,
      gate.migrationStatus,
      gate.writable ? 1 : 0,
      readiness.sourceRecords,
      readiness.indexedRecords,
      readiness.activeRecords,
      readiness.missingFiles,
      status,
      JSON.stringify(readiness.checks),
    );

    return {
      checkedAt,
      status,
      writable: gate.writable,
      readiness,
      gate,
    };
  };



  const questionBankMigrationApplied = sqlite.prepare(`
    SELECT 1 AS applied
    FROM question_bank_schema_migrations
    WHERE version = ?
    LIMIT 1
  `);

  const recordQuestionBankMigration = sqlite.prepare(`
    INSERT OR IGNORE INTO question_bank_schema_migrations (
      version, name, applied_at
    )
    VALUES (?, ?, ?)
  `);

  let questionBankMigrationBackupPath: string | null = null;
  let questionBankMigrationStarted = false;

  const ensureQuestionBankMigrationBackup = () => {
    if (questionBankMigrationBackupPath) return questionBankMigrationBackupPath;

    const currentVersion = currentQuestionBankSchemaVersion();
    if (currentVersion >= QUESTION_BANK_SCHEMA_VERSION) return null;

    const backupDirectory = path.join(
      path.dirname(sqlitePath),
      "backups",
      "question-bank-migrations",
    );
    fs.mkdirSync(backupDirectory, { recursive: true });

    const safeTimestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .replace("Z", "");
    const backupPath = path.join(
      backupDirectory,
      `edupanel-before-question-bank-v${QUESTION_BANK_SCHEMA_VERSION}-${safeTimestamp}.json.gz`,
    );

    try {
      const created = createBackup();
      questionBankMigrationBackupPath = created.path;
    } catch (error) {
      throw new Error(`MySQL geçiş yedeği oluşturulamadı: ${error instanceof Error ? error.message : String(error)}`);
    }

    return questionBankMigrationBackupPath;
  };

  const beginQuestionBankMigrationBatch = () => {
    if (questionBankMigrationStarted) return;
    const currentVersion = currentQuestionBankSchemaVersion();
    if (currentVersion >= QUESTION_BANK_SCHEMA_VERSION) return;

    const startedAt = new Date().toISOString();
    const backupPath = ensureQuestionBankMigrationBackup();

    setQuestionBankMigrationState({
      targetVersion: QUESTION_BANK_SCHEMA_VERSION,
      currentVersion,
      status: "running",
      backupPath,
      lastError: null,
      startedAt,
      completedAt: null,
    });
    questionBankMigrationStarted = true;
  };

  const runQuestionBankMigration = (
    version: number,
    name: string,
    migrate: () => void,
  ) => {
    const existing = questionBankMigrationApplied.get(version) as any;
    if (existing?.applied) return false;

    beginQuestionBankMigrationBatch();

    sqlite.exec("BEGIN IMMEDIATE");
    try {
      migrate();
      recordQuestionBankMigration.run(
        version,
        name,
        new Date().toISOString(),
      );
      sqlite.exec("COMMIT");

      setQuestionBankMigrationState({
        targetVersion: QUESTION_BANK_SCHEMA_VERSION,
        currentVersion: currentQuestionBankSchemaVersion(),
        status: "running",
        backupPath: questionBankMigrationBackupPath,
        lastError: null,
        startedAt:
          getQuestionBankMigrationState()?.startedAt || new Date().toISOString(),
        completedAt: null,
      });

      return true;
    } catch (error) {
      sqlite.exec("ROLLBACK");

      setQuestionBankMigrationState({
        targetVersion: QUESTION_BANK_SCHEMA_VERSION,
        currentVersion: currentQuestionBankSchemaVersion(),
        status: "failed",
        backupPath: questionBankMigrationBackupPath,
        lastError:
          error instanceof Error ? error.message : String(error),
        startedAt:
          getQuestionBankMigrationState()?.startedAt || new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      throw error;
    }
  };


  // Eski kurulumlarÄ± sÃ¼rÃ¼m kaydÄ±yla hizala. Bunlar idempotent migration'lardÄ±r.
  runQuestionBankMigration(12, "MySQL indeksli soru bankasÄ±", () => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS question_bank_index (
        question_id TEXT PRIMARY KEY,
        question_code TEXT,
        grade INTEGER NOT NULL DEFAULT 0,
        course_id TEXT,
        unit_id TEXT,
        topic_id TEXT,
        outcome_id TEXT,
        answer TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        content_hash TEXT,
        file_name TEXT,
        storage_path TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT,
        last_exam_id TEXT,
        last_exam_name TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_qbi_grade_course
        ON question_bank_index(grade, course_id);
      CREATE INDEX IF NOT EXISTS idx_qbi_course_outcome
        ON question_bank_index(course_id, outcome_id);
      CREATE INDEX IF NOT EXISTS idx_qbi_hierarchy
        ON question_bank_index(grade, course_id, unit_id, topic_id, outcome_id);
      CREATE INDEX IF NOT EXISTS idx_qbi_status
        ON question_bank_index(status);
      CREATE INDEX IF NOT EXISTS idx_qbi_answer
        ON question_bank_index(answer);
      CREATE INDEX IF NOT EXISTS idx_qbi_hash
        ON question_bank_index(content_hash);
      CREATE INDEX IF NOT EXISTS idx_qbi_code
        ON question_bank_index(question_code);
      CREATE INDEX IF NOT EXISTS idx_qbi_usage
        ON question_bank_index(use_count, last_used_at);
      CREATE INDEX IF NOT EXISTS idx_qbi_updated
        ON question_bank_index(updated_at);
    `);
  });

  runQuestionBankMigration(13, "Thumbnail performans katmanÄ±", () => {
    fs.mkdirSync(questionBankThumbnailRoot, { recursive: true });
  });

  runQuestionBankMigration(24, "Ä°Ã§e aktarma oturumu izleme", () => {
    // Bu sÃ¼rÃ¼mÃ¼n kayÄ±tlarÄ± documents koleksiyonunda tutulduÄŸu iÃ§in
    // yalnÄ±z migration kaydÄ± gerekir.
  });

  runQuestionBankMigration(25, "BakÄ±m ve onarÄ±m katmanÄ±", () => {
    sqlite.exec("PRAGMA optimize");
  });

  runQuestionBankMigration(32, "Åema sÃ¼rÃ¼mleme ve migration kayÄ±t sistemi", () => {
    // Migration kayÄ±t sistemi bu sÃ¼rÃ¼mle resmileÅŸti.
  });

  runQuestionBankMigration(33, "Soru kayÄ±tlarÄ±nÄ± canonical questions tablosuna taÅŸÄ±", () => {
    migrateLegacyQuestionRecordsToCanonicalTable();
  });

  runQuestionBankMigration(34, "Soru hiyerarÅŸisini soru kodundan canonical kimliklere dÃ¼zelt", () => {
    canonicalHierarchyRepairedOnStartup = repairCanonicalQuestionHierarchy();
    if (canonicalHierarchyRepairedOnStartup > 0) {
      console.log(
        `[QUESTION-BANK] ${canonicalHierarchyRepairedOnStartup} soru kaydÄ±nÄ±n ders/Ã¼nite/konu/kazanÄ±m kimliÄŸi dÃ¼zeltildi.`,
      );
    }
  });

  runQuestionBankMigration(35, "Soru kartı sütun genişliği ve özgün dosya adı şeması", () => {
    // These columns are prepared before the upsert statement at startup.
    // Record the schema upgrade only after verifying the actual database.
    const columns = new Set(
      (sqlite.prepare("PRAGMA table_info(question_bank_questions)").all() as Array<{ name: string }>)
        .map((column) => String(column.name)),
    );
    for (const required of ["column_span", "original_file_name"]) {
      if (!columns.has(required)) throw new Error(`Soru bankası şema alanı eksik: ${required}`);
    }
  });

  if (
    currentQuestionBankSchemaVersion() >= QUESTION_BANK_SCHEMA_VERSION &&
    getQuestionBankMigrationState()?.status !== "failed"
  ) {
    setQuestionBankMigrationState({
      targetVersion: QUESTION_BANK_SCHEMA_VERSION,
      currentVersion: currentQuestionBankSchemaVersion(),
      status: "completed",
      backupPath: questionBankMigrationBackupPath,
      lastError: null,
      startedAt: getQuestionBankMigrationState()?.startedAt || null,
      completedAt: new Date().toISOString(),
    });
  }

  app.use("/api/question-bank", (req, res, next) => {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return next();
    }

    const pathName = String(req.path || "");

    // Kurtarma/onarÄ±m amaÃ§lÄ± servisler yazma kilidinden muaf tutulur.
    const allowedDuringSafeMode = [
      "/maintenance/optimize",
      "/index/rebuild",
    ];

    if (allowedDuringSafeMode.some((prefix) => pathName.startsWith(prefix))) {
      return next();
    }

    const gate = questionBankWriteGate();
    if (gate.writable) return next();

    res.setHeader("X-Question-Bank-Read-Only", "1");
    return res.status(503).json({
      error: "Soru bankasÄ± gÃ¼venli Ã§alÄ±ÅŸma modunda. Yazma iÅŸlemleri geÃ§ici olarak durduruldu.",
      code: "QUESTION_BANK_READ_ONLY",
      readOnly: true,
      ...gate,
      recoveryPlanUrl: "/api/question-bank/migration/recovery-plan",
    });
  });

  // YÃ¼ksek hacimli soru bankasÄ± sorgularÄ± iÃ§in MySQL indeks katmanÄ±.
  // question_bank_questions kaynak gerÃ§ek veridir; bu indeks tablosu yeniden Ã¼retilebilir.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS question_bank_index (
      question_id TEXT PRIMARY KEY,
      question_code TEXT,
      grade INTEGER NOT NULL DEFAULT 0,
      course_id TEXT,
      unit_id TEXT,
      topic_id TEXT,
      outcome_id TEXT,
      answer TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      content_hash TEXT,
      file_name TEXT,
      storage_path TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      last_exam_id TEXT,
      last_exam_name TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qbi_grade_course
      ON question_bank_index(grade, course_id);

    CREATE INDEX IF NOT EXISTS idx_qbi_course_outcome
      ON question_bank_index(course_id, outcome_id);

    CREATE INDEX IF NOT EXISTS idx_qbi_hierarchy
      ON question_bank_index(grade, course_id, unit_id, topic_id, outcome_id);

    CREATE INDEX IF NOT EXISTS idx_qbi_status
      ON question_bank_index(status);

    CREATE INDEX IF NOT EXISTS idx_qbi_answer
      ON question_bank_index(answer);

    CREATE INDEX IF NOT EXISTS idx_qbi_hash
      ON question_bank_index(content_hash);

    CREATE INDEX IF NOT EXISTS idx_qbi_code
      ON question_bank_index(question_code);

    CREATE INDEX IF NOT EXISTS idx_qbi_usage
      ON question_bank_index(use_count, last_used_at);

    CREATE INDEX IF NOT EXISTS idx_qbi_updated
      ON question_bank_index(updated_at);
  `);

  const questionBankIndexUpsert = sqlite.prepare(`
    INSERT INTO question_bank_index (
      question_id, question_code, grade, course_id, unit_id, topic_id, outcome_id,
      answer, status, content_hash, file_name, storage_path, size_bytes,
      use_count, last_used_at, last_exam_id, last_exam_name, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_id) DO UPDATE SET
      question_code = excluded.question_code,
      grade = excluded.grade,
      course_id = excluded.course_id,
      unit_id = excluded.unit_id,
      topic_id = excluded.topic_id,
      outcome_id = excluded.outcome_id,
      answer = excluded.answer,
      status = excluded.status,
      content_hash = excluded.content_hash,
      file_name = excluded.file_name,
      storage_path = excluded.storage_path,
      size_bytes = excluded.size_bytes,
      use_count = excluded.use_count,
      last_used_at = excluded.last_used_at,
      last_exam_id = excluded.last_exam_id,
      last_exam_name = excluded.last_exam_name,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);

  const questionBankIndexDelete = sqlite.prepare(
    "DELETE FROM question_bank_index WHERE question_id = ?",
  );

  const questionBankUsageRowsFor = (questionId: string) =>
    (listDocuments(QUESTION_BANK_USAGE_COLLECTION) as any[])
      .filter((item) => String(item.questionId || "") === String(questionId))
      .sort((a, b) => String(b.usedAt || "").localeCompare(String(a.usedAt || "")));

  const syncQuestionBankIndexRecord = (record: any) => {
    if (!record?.id) return;
    const usageRows = questionBankUsageRowsFor(String(record.id));
    const lastUsage = usageRows[0];
    questionBankIndexUpsert.run(
      String(record.id),
      String(record.questionCode || ""),
      Number(record.grade || 0),
      String(record.courseId || ""),
      String(record.unitId || ""),
      String(record.topicId || ""),
      String(record.outcomeId || ""),
      String(record.answer || "").toUpperCase(),
      String(record.status || "active"),
      String(record.contentHash || ""),
      String(record.fileName || ""),
      String(record.storagePath || ""),
      Number(record.sizeBytes || 0),
      usageRows.length,
      String(lastUsage?.usedAt || ""),
      String(lastUsage?.examId || ""),
      String(lastUsage?.examName || ""),
      String(record.createdAt || ""),
      String(record.updatedAt || record.createdAt || ""),
    );
  };

  const syncQuestionBankIndexById = (questionId: string) => {
    const record = allQuestionRecords().find(
      (item) => String(item.id || "") === String(questionId),
    );
    if (!record) {
      questionBankIndexDelete.run(questionId);
      return;
    }
    syncQuestionBankIndexRecord(record);
  };

  const rebuildQuestionBankIndex = () => {
    const records = allQuestionRecords();
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.exec("DELETE FROM question_bank_index");
      records.forEach(syncQuestionBankIndexRecord);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
    return {
      indexedRecords: Number(
        (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_index").get() as any)?.count || 0,
      ),
      sourceRecords: records.length,
    };
  };

  const ensureQuestionBankIndexReady = () => {
    const sourceCount = Number(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0,
    );
    const indexCount = Number(
      (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_index").get() as any)?.count || 0,
    );
    if (sourceCount !== indexCount) {
      return rebuildQuestionBankIndex();
    }
    return { indexedRecords: indexCount, sourceRecords: sourceCount };
  };

  if (canonicalHierarchyRepairedOnStartup > 0) {
    const rebuilt = rebuildQuestionBankIndex();
    console.log(
      `[QUESTION-BANK] HiyerarÅŸi onarÄ±mÄ± sonrasÄ± indeks yeniden kuruldu: ${rebuilt.indexedRecords}/${rebuilt.sourceRecords}.`,
    );
  } else {
    ensureQuestionBankIndexReady();
  }

  const questionBankFilesStatic = express.static(questionBankRoot, {
    fallthrough: false,
    immutable: false,
    maxAge: "1h",
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  });
  const questionBankThumbsStatic = express.static(questionBankThumbnailRoot, {
    fallthrough: false,
    immutable: false,
    maxAge: "7d",
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  });

  // Eski doÄŸrudan yollar korunur; Vite 3000 Ã¼zerinden Ã§alÄ±ÅŸan arayÃ¼z ise
  // /api yollarÄ±nÄ± kullanarak 8787 API sunucusuna proxy edilir.
  app.use("/question-bank-files", questionBankFilesStatic);
  app.use("/question-bank-thumbs", questionBankThumbsStatic);
  app.use("/api/question-bank/files", express.static(questionBankRoot, {
    fallthrough: false,
    immutable: false,
    maxAge: "1h",
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  }));
  app.use("/api/question-bank/thumbs", express.static(questionBankThumbnailRoot, {
    fallthrough: false,
    immutable: false,
    maxAge: "7d",
    dotfiles: "deny",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  }));

  const safeQuestionSegment = (value: unknown, fallback = "unknown") => {
    const decoded = (() => {
      try { return decodeURIComponent(String(value || "")); }
      catch { return String(value || ""); }
    })();
    const cleaned = decoded.normalize("NFKC")
      .replace(/[^0-9A-Za-z._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
    return cleaned || fallback;
  };

  const safeStoredQuestionPath = (value: unknown) => {
    const relative = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!relative || relative.includes("..") || !/^[0-9A-Za-z._\/-]+$/.test(relative)) return "";
    const absolute = path.resolve(questionBankRoot, relative);
    const root = path.resolve(questionBankRoot) + path.sep;
    return absolute.startsWith(root) ? relative : "";
  };

  const questionImageExtension = (contentType: string, originalName: string) => {
    if (contentType === "image/png" || /\.png$/i.test(originalName)) return "png";
    if (contentType === "image/jpeg" || /\.jpe?g$/i.test(originalName)) return "jpg";
    return "";
  };

  const questionStorageLocation = (input: any, extension: string) => {
    const grade = safeQuestionSegment(input.grade, "0");
    const course = safeQuestionSegment(input.courseId);
    const unit = safeQuestionSegment(input.unitId);
    const topic = safeQuestionSegment(input.topicId);
    const outcome = safeQuestionSegment(input.outcomeId);
    const code = safeQuestionSegment(input.questionCode, "question");
    const relativeDir = path.posix.join(grade, course, unit, topic, outcome);
    const fileName = `${code}.${extension}`;
    return { relativeDir, fileName, storagePath: path.posix.join(relativeDir, fileName) };
  };

  const beginQuestionBankWriteJournal = (payload: {
    operation: string;
    questionId?: string;
    questionCode?: string;
    targetPath?: string;
    tempPath?: string;
  }) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO question_bank_write_journal (
        id, operation, question_id, question_code, target_path, temp_path,
        status, error, created_at, committed_at, recovered_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL, NULL, ?)
    `).run(
      id,
      payload.operation,
      payload.questionId || null,
      payload.questionCode || null,
      payload.targetPath || null,
      payload.tempPath || null,
      now,
      now,
    );
    return id;
  };

  const updateQuestionBankWriteJournal = (
    id: string,
    payload: {
      status?: string;
      targetPath?: string | null;
      tempPath?: string | null;
      error?: string | null;
      committedAt?: string | null;
      recoveredAt?: string | null;
    },
  ) => {
    const current = sqlite.prepare(`
      SELECT *
      FROM question_bank_write_journal
      WHERE id = ?
      LIMIT 1
    `).get(id) as any;
    if (!current) return;

    sqlite.prepare(`
      UPDATE question_bank_write_journal
      SET
        status = ?,
        target_path = ?,
        temp_path = ?,
        error = ?,
        committed_at = ?,
        recovered_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      payload.status ?? current.status,
      payload.targetPath === undefined ? current.target_path : payload.targetPath,
      payload.tempPath === undefined ? current.temp_path : payload.tempPath,
      payload.error === undefined ? current.error : payload.error,
      payload.committedAt === undefined ? current.committed_at : payload.committedAt,
      payload.recoveredAt === undefined ? current.recovered_at : payload.recoveredAt,
      new Date().toISOString(),
      id,
    );
  };

  const recoverPendingQuestionBankWrites = () => {
    const rows = sqlite.prepare(`
      SELECT
        id,
        operation,
        question_id AS questionId,
        question_code AS questionCode,
        target_path AS targetPath,
        temp_path AS tempPath,
        created_at AS createdAt
      FROM question_bank_write_journal
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all() as any[];

    let recovered = 0;
    const failures: Array<{ id: string; error: string }> = [];

    for (const row of rows) {
      try {
        const questionId = String(row.questionId || "");
        const record = questionId
          ? allQuestionRecords().find(
              (item) => String(item.id || "") === questionId,
            )
          : null;

        if (
          record &&
          String(record.status || "active") === "active" &&
          String(record.storagePath || "")
        ) {
          updateQuestionBankWriteJournal(String(row.id), {
            status: "committed",
            committedAt: new Date().toISOString(),
            recoveredAt: new Date().toISOString(),
            error: null,
          });
          recovered += 1;
          continue;
        }

        for (const candidate of [
          String(row.tempPath || ""),
          String(row.targetPath || ""),
        ]) {
          if (!candidate) continue;
          const absolute = path.isAbsolute(candidate)
            ? candidate
            : path.resolve(questionBankRoot, candidate);
          if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
            fs.unlinkSync(absolute);
          }
        }

        updateQuestionBankWriteJournal(String(row.id), {
          status: "recovered",
          recoveredAt: new Date().toISOString(),
          error: null,
        });
        recovered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ id: String(row.id), error: message });
        updateQuestionBankWriteJournal(String(row.id), {
          status: "recovery-failed",
          recoveredAt: new Date().toISOString(),
          error: message,
        });
      }
    }

    return {
      pending: rows.length,
      recovered,
      failed: failures.length,
      failures,
    };
  };

  const scanQuestionBankOrphanFiles = () => {
    const known = new Set([
      ...activeQuestionRecords()
        .map((record) => String(record.storagePath || "").replace(/\\/g, "/"))
        .filter(Boolean),
      ...(listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
        .map((record) => String(record?.storagePath || "").replace(/\\/g, "/"))
        .filter(Boolean),
    ]);

    const orphanFiles: Array<{
      relativePath: string;
      sizeBytes: number;
      modifiedAt: string;
    }> = [];

    const walk = (directory: string) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolute);
          continue;
        }

        const lower = entry.name.toLowerCase();
        if (
          !lower.endsWith(".jpg") &&
          !lower.endsWith(".jpeg") &&
          !lower.endsWith(".png")
        ) {
          continue;
        }

        const relativePath = path
          .relative(questionBankRoot, absolute)
          .split(path.sep)
          .join("/");

        // Thumbnail deposu kendi metadata akÄ±ÅŸÄ±yla yÃ¶netilir.
        if (relativePath.includes("/.thumbnails/")) continue;

        if (!known.has(relativePath)) {
          const stat = fs.statSync(absolute);
          orphanFiles.push({
            relativePath,
            sizeBytes: Number(stat.size || 0),
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      }
    };

    walk(questionBankRoot);

    return {
      scannedAt: new Date().toISOString(),
      knownRecords: known.size,
      orphanCount: orphanFiles.length,
      orphanBytes: orphanFiles.reduce(
        (sum, item) => sum + Number(item.sizeBytes || 0),
        0,
      ),
      items: orphanFiles
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 500),
    };
  };

  const quarantineQuestionBankOrphans = () => {
    const scan = scanQuestionBankOrphanFiles();
    if (scan.orphanCount === 0) {
      return {
        ...scan,
        quarantined: 0,
        quarantineDirectory: null,
      };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const quarantineRoot = path.join(
      questionBankRoot,
      ".orphan-quarantine",
      stamp,
    );
    fs.mkdirSync(quarantineRoot, { recursive: true });

    let quarantined = 0;
    const failures: Array<{ relativePath: string; error: string }> = [];

    for (const item of scan.items) {
      try {
        const source = path.resolve(questionBankRoot, item.relativePath);
        const relativeTarget = item.relativePath
          .split("/")
          .filter(Boolean)
          .join(path.sep);
        const target = path.join(quarantineRoot, relativeTarget);
        fs.mkdirSync(path.dirname(target), { recursive: true });

        if (fs.existsSync(source)) {
          fs.renameSync(source, target);
          quarantined += 1;
        }
      } catch (error) {
        failures.push({
          relativePath: item.relativePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      ...scan,
      quarantined,
      failures,
      quarantineDirectory: path.relative(
        questionBankRoot,
        quarantineRoot,
      ).split(path.sep).join("/"),
    };
  };

  const listQuestionBankQuarantine = () => {
    const root = path.join(questionBankRoot, ".orphan-quarantine");
    const items: Array<{
      quarantinePath: string;
      originalPath: string;
      sizeBytes: number;
      modifiedAt: string;
      batch: string;
    }> = [];

    if (!fs.existsSync(root)) {
      return {
        scannedAt: new Date().toISOString(),
        count: 0,
        totalBytes: 0,
        items: [],
      };
    }

    const walk = (directory: string, batch: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(absolute, batch || entry.name);
          continue;
        }

        const relative = path
          .relative(root, absolute)
          .split(path.sep)
          .join("/");
        const parts = relative.split("/").filter(Boolean);
        const detectedBatch = parts.shift() || batch || "";
        const originalPath = parts.join("/");
        const stat = fs.statSync(absolute);

        items.push({
          quarantinePath: relative,
          originalPath,
          sizeBytes: Number(stat.size || 0),
          modifiedAt: stat.mtime.toISOString(),
          batch: detectedBatch,
        });
      }
    };

    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, entry.name);
      }
    }

    return {
      scannedAt: new Date().toISOString(),
      count: items.length,
      totalBytes: items.reduce(
        (sum, item) => sum + Number(item.sizeBytes || 0),
        0,
      ),
      items: items
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, 1000),
    };
  };

  const restoreQuestionBankQuarantineFile = (quarantinePath: string) => {
    const normalized = String(quarantinePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    if (
      !normalized ||
      normalized.includes("..") ||
      path.isAbsolute(normalized)
    ) {
      throw new Error("GeÃ§ersiz karantina dosya yolu.");
    }

    const quarantineRoot = path.resolve(
      questionBankRoot,
      ".orphan-quarantine",
    );
    const source = path.resolve(quarantineRoot, normalized);

    if (
      source !== quarantineRoot &&
      !source.startsWith(`${quarantineRoot}${path.sep}`)
    ) {
      throw new Error("Karantina alanÄ± dÄ±ÅŸÄ±na eriÅŸilemez.");
    }

    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error("Karantina dosyasÄ± bulunamadÄ±.");
    }

    const parts = normalized.split("/").filter(Boolean);
    parts.shift();
    const originalRelativePath = parts.join("/");

    if (
      !originalRelativePath ||
      originalRelativePath.includes("..")
    ) {
      throw new Error("DosyanÄ±n Ã¶zgÃ¼n yolu belirlenemedi.");
    }

    const target = path.resolve(questionBankRoot, originalRelativePath);
    if (
      target !== questionBankRoot &&
      !target.startsWith(`${path.resolve(questionBankRoot)}${path.sep}`)
    ) {
      throw new Error("Hedef soru bankasÄ± alanÄ± dÄ±ÅŸÄ±nda.");
    }

    if (fs.existsSync(target)) {
      throw new Error(
        "Ã–zgÃ¼n konumda aynÄ± adlÄ± bir dosya zaten var. Ãœzerine yazÄ±lmadÄ±.",
      );
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);

    return {
      restored: true,
      quarantinePath: normalized,
      originalPath: originalRelativePath,
      restoredAt: new Date().toISOString(),
    };
  };

  const purgeQuestionBankQuarantine = (retentionDays = 30) => {
    const safeDays = Math.min(Math.max(Number(retentionDays) || 30, 7), 365);
    const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
    const root = path.join(questionBankRoot, ".orphan-quarantine");

    if (!fs.existsSync(root)) {
      return {
        retentionDays: safeDays,
        removedFiles: 0,
        removedBytes: 0,
        removedBatches: 0,
      };
    }

    let removedFiles = 0;
    let removedBytes = 0;
    let removedBatches = 0;

    for (const batch of fs.readdirSync(root, { withFileTypes: true })) {
      if (!batch.isDirectory()) continue;
      const batchPath = path.join(root, batch.name);
      const stat = fs.statSync(batchPath);

      // Batch tarihi okunabiliyorsa onu, aksi halde klasÃ¶r mtime'Ä±nÄ± kullan.
      const parsed = Date.parse(
        batch.name.replace(
          /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}).*$/,
          "$1T$2:$3:$4Z",
        ),
      );
      const batchTime = Number.isFinite(parsed) ? parsed : stat.mtimeMs;
      if (batchTime >= cutoffMs) continue;

      const walkAndCount = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          if (entry.isDirectory()) {
            walkAndCount(absolute);
          } else {
            const fileStat = fs.statSync(absolute);
            removedFiles += 1;
            removedBytes += Number(fileStat.size || 0);
          }
        }
      };

      walkAndCount(batchPath);
      fs.rmSync(batchPath, { recursive: true, force: true });
      removedBatches += 1;
    }

    return {
      retentionDays: safeDays,
      removedFiles,
      removedBytes,
      removedBatches,
      purgedAt: new Date().toISOString(),
    };
  };

  const createQuestionBankIntegritySnapshot = () => {
    const checkedAt = new Date().toISOString();
    const readiness = validateQuestionBankWriteReadiness();
    const orphanScan = scanQuestionBankOrphanFiles();
    const quarantine = listQuestionBankQuarantine();

    const duplicateHashGroups = sqlite.prepare(`
      SELECT COUNT(*) AS groups
      FROM (
        SELECT content_hash
        FROM question_bank_index
        WHERE status = 'active'
          AND content_hash IS NOT NULL
          AND content_hash <> ''
        GROUP BY content_hash
        HAVING COUNT(*) > 1
      ) AS duplicate_hash_groups
    `).get() as any;

    const journalRows = sqlite.prepare(`
      SELECT status, COUNT(*) AS count
      FROM question_bank_write_journal
      GROUP BY status
    `).all() as any[];

    const journal = Object.fromEntries(
      journalRows.map((item) => [
        String(item.status),
        Number(item.count || 0),
      ]),
    );

    const failedWrites =
      Number(journal.failed || 0) +
      Number(journal["recovery-failed"] || 0);

    const duplicateGroups = Number(duplicateHashGroups?.groups || 0);

    const status =
      readiness.missingFiles > 0 ||
      orphanScan.orphanCount > 0 ||
      Number(journal.pending || 0) > 0 ||
      failedWrites > 0 ||
      readiness.sourceRecords !== readiness.indexedRecords
        ? "attention"
        : duplicateGroups > 0
          ? "warning"
          : "healthy";

    const details = {
      readiness: readiness.checks,
      writeState: readiness.gate,
      orphanBytes: orphanScan.orphanBytes,
      quarantineBytes: quarantine.totalBytes,
      journal,
    };

    const result = sqlite.prepare(`
      INSERT INTO question_bank_integrity_snapshot (
        checked_at, active_records, indexed_records, missing_files,
        orphan_files, quarantine_files, duplicate_hash_groups,
        pending_writes, failed_writes, status, details_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkedAt,
      readiness.activeRecords,
      readiness.indexedRecords,
      readiness.missingFiles,
      orphanScan.orphanCount,
      quarantine.count,
      duplicateGroups,
      Number(journal.pending || 0),
      failedWrites,
      status,
      JSON.stringify(details),
    );

    return {
      id: Number(result.lastInsertRowid),
      checkedAt,
      activeRecords: readiness.activeRecords,
      indexedRecords: readiness.indexedRecords,
      missingFiles: readiness.missingFiles,
      orphanFiles: orphanScan.orphanCount,
      quarantineFiles: quarantine.count,
      duplicateHashGroups: duplicateGroups,
      pendingWrites: Number(journal.pending || 0),
      failedWrites,
      status,
      details,
    };
  };

  const questionBankIntegrityChanges = (limit = 30) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 2), 100);
    const rows = sqlite.prepare(`
      SELECT
        id,
        checked_at AS checkedAt,
        active_records AS activeRecords,
        indexed_records AS indexedRecords,
        missing_files AS missingFiles,
        orphan_files AS orphanFiles,
        quarantine_files AS quarantineFiles,
        duplicate_hash_groups AS duplicateHashGroups,
        pending_writes AS pendingWrites,
        failed_writes AS failedWrites,
        status
      FROM question_bank_integrity_snapshot
      ORDER BY id DESC
      LIMIT ?
    `).all(safeLimit) as any[];

    const changes = rows.map((current, index) => {
      const previous = rows[index + 1];
      if (!previous) {
        return {
          ...current,
          hasPrevious: false,
          delta: null,
          changed: false,
          severity: "baseline",
          reasons: [],
        };
      }

      const delta = {
        activeRecords:
          Number(current.activeRecords || 0) -
          Number(previous.activeRecords || 0),
        indexedRecords:
          Number(current.indexedRecords || 0) -
          Number(previous.indexedRecords || 0),
        missingFiles:
          Number(current.missingFiles || 0) -
          Number(previous.missingFiles || 0),
        orphanFiles:
          Number(current.orphanFiles || 0) -
          Number(previous.orphanFiles || 0),
        quarantineFiles:
          Number(current.quarantineFiles || 0) -
          Number(previous.quarantineFiles || 0),
        duplicateHashGroups:
          Number(current.duplicateHashGroups || 0) -
          Number(previous.duplicateHashGroups || 0),
        pendingWrites:
          Number(current.pendingWrites || 0) -
          Number(previous.pendingWrites || 0),
        failedWrites:
          Number(current.failedWrites || 0) -
          Number(previous.failedWrites || 0),
      };

      const reasons: string[] = [];
      let severity = "info";

      if (delta.activeRecords < 0) {
        reasons.push(
          `Aktif soru sayÄ±sÄ± ${Math.abs(delta.activeRecords)} azaldÄ±.`,
        );
        severity = "critical";
      }
      if (delta.missingFiles > 0) {
        reasons.push(
          `${delta.missingFiles} yeni eksik fiziksel dosya tespit edildi.`,
        );
        severity = "critical";
      }
      if (delta.failedWrites > 0) {
        reasons.push(
          `${delta.failedWrites} yeni hatalÄ± yazma iÅŸlemi oluÅŸtu.`,
        );
        severity = "critical";
      }
      if (delta.pendingWrites > 0) {
        reasons.push(
          `${delta.pendingWrites} yeni bekleyen yazma iÅŸlemi oluÅŸtu.`,
        );
        if (severity !== "critical") severity = "warning";
      }
      if (delta.orphanFiles > 0) {
        reasons.push(
          `${delta.orphanFiles} yeni sahipsiz dosya tespit edildi.`,
        );
        if (severity !== "critical") severity = "warning";
      }
      if (delta.duplicateHashGroups > 0) {
        reasons.push(
          `${delta.duplicateHashGroups} yeni mÃ¼kerrer iÃ§erik grubu oluÅŸtu.`,
        );
        if (severity !== "critical") severity = "warning";
      }
      if (
        Number(current.activeRecords || 0) !==
        Number(current.indexedRecords || 0)
      ) {
        reasons.push("Aktif kayÄ±t sayÄ±sÄ± ile indeks sayÄ±sÄ± eÅŸleÅŸmiyor.");
        severity = "critical";
      }

      const changed = Object.values(delta).some(
        (value) => Number(value) !== 0,
      );

      if (!reasons.length && changed) {
        reasons.push("BÃ¼tÃ¼nlÃ¼k metriklerinde normal deÄŸiÅŸiklik var.");
      }

      return {
        ...current,
        hasPrevious: true,
        previousId: previous.id,
        previousCheckedAt: previous.checkedAt,
        delta,
        changed,
        severity: reasons.length ? severity : "stable",
        reasons,
      };
    });

    return {
      items: changes,
      latest: changes[0] || null,
      criticalCount: changes.filter(
        (item) => item.severity === "critical",
      ).length,
      warningCount: changes.filter(
        (item) => item.severity === "warning",
      ).length,
    };
  };

  const questionBankIntegrityRecommendations = () => {
    const changes = questionBankIntegrityChanges(2);
    const latest = changes.latest;
    const recommendations: Array<{
      id: string;
      priority: "critical" | "warning" | "info";
      title: string;
      description: string;
      action?: string;
      endpoint?: string;
    }> = [];

    if (!latest) {
      recommendations.push({
        id: "create-baseline",
        priority: "info",
        title: "Ä°lk bÃ¼tÃ¼nlÃ¼k kaydÄ±nÄ± oluÅŸturun",
        description:
          "KarÅŸÄ±laÅŸtÄ±rmalÄ± analiz iÃ§in en az bir bÃ¼tÃ¼nlÃ¼k anlÄ±k gÃ¶rÃ¼ntÃ¼sÃ¼ gerekir.",
        action: "integrity-snapshot",
        endpoint: "/api/question-bank/integrity-history/run",
      });
      return { severity: "info", recommendations };
    }

    if (Number(latest.missingFiles || 0) > 0) {
      recommendations.push({
        id: "missing-files",
        priority: "critical",
        title: "Eksik fiziksel soru dosyalarÄ±nÄ± inceleyin",
        description:
          `${Number(latest.missingFiles || 0)} aktif metadata kaydÄ±nÄ±n fiziksel gÃ¶rseli bulunamÄ±yor. ` +
          "Yeni soru yÃ¼klemeden Ã¶nce bu kayÄ±tlarÄ±n kaynaÄŸÄ± kontrol edilmelidir.",
        action: "diagnostics",
        endpoint: "/api/question-bank/diagnostics",
      });
    }

    if (
      Number(latest.activeRecords || 0) !==
      Number(latest.indexedRecords || 0)
    ) {
      recommendations.push({
        id: "index-drift",
        priority: "critical",
        title: "Soru indeksini yeniden senkronlayÄ±n",
        description:
          `Aktif kayÄ±t (${Number(latest.activeRecords || 0)}) ile indeks ` +
          `(${Number(latest.indexedRecords || 0)}) sayÄ±larÄ± eÅŸleÅŸmiyor.`,
        action: "index-sync",
        endpoint: "/api/question-bank/index/sync",
      });
    }

    if (Number(latest.pendingWrites || 0) > 0) {
      recommendations.push({
        id: "pending-writes",
        priority: "warning",
        title: "YarÄ±m kalan yazma iÅŸlemlerini kurtarÄ±n",
        description:
          `${Number(latest.pendingWrites || 0)} soru yazma iÅŸlemi pending durumda.`,
        action: "recover-writes",
        endpoint: "/api/question-bank/write-journal/recover",
      });
    }

    if (Number(latest.failedWrites || 0) > 0) {
      recommendations.push({
        id: "failed-writes",
        priority: "critical",
        title: "HatalÄ± yazma kayÄ±tlarÄ±nÄ± inceleyin",
        description:
          `${Number(latest.failedWrites || 0)} yazma/kurtarma hatasÄ± bulunuyor. ` +
          "Teknik destek raporu alÄ±nmasÄ± Ã¶nerilir.",
        action: "support-bundle",
        endpoint: "/api/question-bank/support-bundle",
      });
    }

    if (Number(latest.orphanFiles || 0) > 0) {
      recommendations.push({
        id: "orphan-files",
        priority: "warning",
        title: "Sahipsiz dosyalarÄ± karantinaya alÄ±n",
        description:
          `${Number(latest.orphanFiles || 0)} gÃ¶rselin aktif soru metadata kaydÄ± yok.`,
        action: "quarantine-orphans",
        endpoint: "/api/question-bank/orphans/quarantine",
      });
    }

    if (Number(latest.duplicateHashGroups || 0) > 0) {
      recommendations.push({
        id: "duplicates",
        priority: "warning",
        title: "MÃ¼kerrer soru iÃ§eriklerini inceleyin",
        description:
          `${Number(latest.duplicateHashGroups || 0)} mÃ¼kerrer iÃ§erik grubu tespit edildi.`,
        action: "diagnostics",
        endpoint: "/api/question-bank/diagnostics",
      });
    }

    if (
      latest.hasPrevious &&
      Number(latest.delta?.activeRecords || 0) < 0
    ) {
      recommendations.unshift({
        id: "question-count-drop",
        priority: "critical",
        title: "Soru sayÄ±sÄ±ndaki azalmayÄ± doÄŸrulayÄ±n",
        description:
          `Son bÃ¼tÃ¼nlÃ¼k kaydÄ±na gÃ¶re aktif soru sayÄ±sÄ± ` +
          `${Math.abs(Number(latest.delta.activeRecords || 0))} azaldÄ±. ` +
          "Bu deÄŸiÅŸiklik planlÄ± deÄŸilse silme/geÃ§miÅŸ kayÄ±tlarÄ± incelenmelidir.",
        action: "support-bundle",
        endpoint: "/api/question-bank/support-bundle",
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: "healthy",
        priority: "info",
        title: "Soru bankasÄ± saÄŸlÄ±klÄ±",
        description:
          "Mevcut bÃ¼tÃ¼nlÃ¼k Ã¶lÃ§Ã¼mlerinde mÃ¼dahale gerektiren bir durum tespit edilmedi.",
      });
    }

    const severity = recommendations.some((item) => item.priority === "critical")
      ? "critical"
      : recommendations.some((item) => item.priority === "warning")
        ? "warning"
        : "healthy";

    return { severity, recommendations };
  };

  const beginQuestionBankSafeActionAudit = (
    actionId: string,
    label: string,
  ) => {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO question_bank_safe_action_audit (
        id, action_id, label, status, started_at
      )
      VALUES (?, ?, ?, 'running', ?)
    `).run(id, actionId, label, startedAt);

    return { id, startedAt, startedMs: Date.now() };
  };

  const finishQuestionBankSafeActionAudit = (
    audit: { id: string; startedMs: number },
    payload: {
      status: "success" | "failed";
      result?: any;
      error?: string | null;
    },
  ) => {
    sqlite.prepare(`
      UPDATE question_bank_safe_action_audit
      SET
        status = ?,
        completed_at = ?,
        duration_ms = ?,
        result_json = ?,
        error = ?
      WHERE id = ?
    `).run(
      payload.status,
      new Date().toISOString(),
      Math.max(0, Date.now() - Number(audit.startedMs || Date.now())),
      payload.result === undefined
        ? null
        : JSON.stringify(payload.result),
      payload.error || null,
      audit.id,
    );
  };

  const listQuestionBankSafeActionAudit = (limit = 50) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const rows = sqlite.prepare(`
      SELECT
        id,
        action_id AS actionId,
        label,
        status,
        started_at AS startedAt,
        completed_at AS completedAt,
        duration_ms AS durationMs,
        result_json AS resultJson,
        error
      FROM question_bank_safe_action_audit
      ORDER BY started_at DESC
      LIMIT ?
    `).all(safeLimit) as any[];

    return rows.map((row) => ({
      ...row,
      result: (() => {
        try {
          return row.resultJson ? JSON.parse(String(row.resultJson)) : null;
        } catch {
          return null;
        }
      })(),
    }));
  };

  const cleanupQuestionBankSafeActionAudit = (retentionDays = 90) => {
    const safeDays = Math.min(Math.max(Number(retentionDays) || 90, 30), 3650);
    const cutoff = new Date(
      Date.now() - safeDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const removable = sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM question_bank_safe_action_audit
      WHERE status = 'success'
        AND completed_at IS NOT NULL
        AND completed_at < ?
    `).get(cutoff) as any;

    sqlite.prepare(`
      DELETE FROM question_bank_safe_action_audit
      WHERE status = 'success'
        AND completed_at IS NOT NULL
        AND completed_at < ?
    `).run(cutoff);

    return {
      retentionDays: safeDays,
      cutoff,
      removed: Number(removable?.count || 0),
      cleanedAt: new Date().toISOString(),
    };
  };

  const calculateQuestionBankHealthScore = () => {
    const readiness = validateQuestionBankWriteReadiness();
    const orphanScan = scanQuestionBankOrphanFiles();
    const quarantine = listQuestionBankQuarantine();

    const duplicateRow = sqlite.prepare(`
      SELECT COUNT(*) AS groups
      FROM (
        SELECT content_hash
        FROM question_bank_index
        WHERE status = 'active'
          AND content_hash IS NOT NULL
          AND content_hash <> ''
        GROUP BY content_hash
        HAVING COUNT(*) > 1
      ) AS duplicate_hash_groups
    `).get() as any;

    const journalRows = sqlite.prepare(`
      SELECT status, COUNT(*) AS count
      FROM question_bank_write_journal
      GROUP BY status
    `).all() as any[];

    const journal = Object.fromEntries(
      journalRows.map((row) => [
        String(row.status),
        Number(row.count || 0),
      ]),
    );

    const failedWrites =
      Number(journal.failed || 0) +
      Number(journal["recovery-failed"] || 0);
    const pendingWrites = Number(journal.pending || 0);
    const duplicateGroups = Number(duplicateRow?.groups || 0);
    const indexDrift = Math.abs(
      Number(readiness.activeRecords || 0) -
      Number(readiness.indexedRecords || 0),
    );

    const deductions: Array<{
      id: string;
      points: number;
      label: string;
      count: number;
    }> = [];

    const addDeduction = (
      id: string,
      points: number,
      label: string,
      count: number,
    ) => {
      if (points <= 0 || count <= 0) return;
      deductions.push({ id, points, label, count });
    };

    addDeduction(
      "missing-files",
      Math.min(35, Number(readiness.missingFiles || 0) * 7),
      "Eksik fiziksel soru dosyasÄ±",
      Number(readiness.missingFiles || 0),
    );
    addDeduction(
      "index-drift",
      Math.min(30, indexDrift * 5),
      "Metadata / indeks sapmasÄ±",
      indexDrift,
    );
    addDeduction(
      "failed-writes",
      Math.min(30, failedWrites * 10),
      "HatalÄ± yazma veya kurtarma",
      failedWrites,
    );
    addDeduction(
      "pending-writes",
      Math.min(20, pendingWrites * 5),
      "Bekleyen yazma iÅŸlemi",
      pendingWrites,
    );
    addDeduction(
      "orphan-files",
      Math.min(15, Number(orphanScan.orphanCount || 0)),
      "Sahipsiz soru dosyasÄ±",
      Number(orphanScan.orphanCount || 0),
    );
    addDeduction(
      "duplicates",
      Math.min(10, duplicateGroups),
      "MÃ¼kerrer iÃ§erik grubu",
      duplicateGroups,
    );

    const totalDeduction = deductions.reduce(
      (sum, item) => sum + item.points,
      0,
    );
    const score = Math.max(0, Math.min(100, 100 - totalDeduction));

    const grade =
      score >= 95
        ? "A+"
        : score >= 90
          ? "A"
          : score >= 80
            ? "B"
            : score >= 70
              ? "C"
              : score >= 60
                ? "D"
                : "E";

    const status =
      score >= 90
        ? "healthy"
        : score >= 70
          ? "warning"
          : "critical";

    return {
      score,
      grade,
      status,
      calculatedAt: new Date().toISOString(),
      metrics: {
        activeRecords: Number(readiness.activeRecords || 0),
        indexedRecords: Number(readiness.indexedRecords || 0),
        missingFiles: Number(readiness.missingFiles || 0),
        orphanFiles: Number(orphanScan.orphanCount || 0),
        quarantineFiles: Number(quarantine.count || 0),
        duplicateHashGroups: duplicateGroups,
        pendingWrites,
        failedWrites,
      },
      deductions,
    };
  };

  const recordQuestionBankHealthScore = () => {
    const health = calculateQuestionBankHealthScore();

    const result = sqlite.prepare(`
      INSERT INTO question_bank_health_score_history (
        calculated_at, score, grade, status,
        active_records, indexed_records, missing_files, orphan_files,
        quarantine_files, duplicate_hash_groups, pending_writes,
        failed_writes, deductions_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      health.calculatedAt,
      health.score,
      health.grade,
      health.status,
      health.metrics.activeRecords,
      health.metrics.indexedRecords,
      health.metrics.missingFiles,
      health.metrics.orphanFiles,
      health.metrics.quarantineFiles,
      health.metrics.duplicateHashGroups,
      health.metrics.pendingWrites,
      health.metrics.failedWrites,
      JSON.stringify(health.deductions || []),
    );

    return {
      id: Number(result.lastInsertRowid),
      ...health,
    };
  };

  const listQuestionBankHealthScoreHistory = (limit = 30) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 2), 365);
    const rows = sqlite.prepare(`
      SELECT
        id,
        calculated_at AS calculatedAt,
        score,
        grade,
        status,
        active_records AS activeRecords,
        indexed_records AS indexedRecords,
        missing_files AS missingFiles,
        orphan_files AS orphanFiles,
        quarantine_files AS quarantineFiles,
        duplicate_hash_groups AS duplicateHashGroups,
        pending_writes AS pendingWrites,
        failed_writes AS failedWrites,
        deductions_json AS deductionsJson
      FROM question_bank_health_score_history
      ORDER BY id DESC
      LIMIT ?
    `).all(safeLimit) as any[];

    const items = rows.map((row) => ({
      ...row,
      deductions: (() => {
        try {
          return JSON.parse(String(row.deductionsJson || "[]"));
        } catch {
          return [];
        }
      })(),
    }));

    const latest = items[0] || null;
    const previous = items[1] || null;
    const delta =
      latest && previous
        ? Number(latest.score || 0) - Number(previous.score || 0)
        : null;

    return {
      items,
      latest,
      previous,
      delta,
      trend:
        delta === null
          ? "baseline"
          : delta > 0
            ? "up"
            : delta < 0
              ? "down"
              : "stable",
    };
  };

  const analyzeQuestionBankHealthScoreTrend = (limit = 30) => {
    const history = listQuestionBankHealthScoreHistory(limit);
    const chronological = [...history.items].reverse();

    if (!chronological.length) {
      return {
        points: [],
        latest: null,
        average: null,
        min: null,
        max: null,
        changeFromFirst: null,
        trend: "baseline",
        improving: false,
        deteriorating: false,
      };
    }

    const scores = chronological.map((item) => Number(item.score || 0));
    const average =
      Math.round(
        (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
      ) / 10;

    const first = chronological[0];
    const latest = chronological[chronological.length - 1];
    const changeFromFirst =
      Number(latest.score || 0) - Number(first.score || 0);

    const recent = chronological.slice(-5);
    const recentFirst = recent[0];
    const recentLast = recent[recent.length - 1];
    const recentDelta =
      recent.length > 1
        ? Number(recentLast.score || 0) - Number(recentFirst.score || 0)
        : 0;

    return {
      points: chronological.map((item) => ({
        id: item.id,
        calculatedAt: item.calculatedAt,
        score: Number(item.score || 0),
        grade: item.grade,
        status: item.status,
      })),
      latest: {
        score: Number(latest.score || 0),
        grade: latest.grade,
        calculatedAt: latest.calculatedAt,
      },
      average,
      min: Math.min(...scores),
      max: Math.max(...scores),
      changeFromFirst,
      recentDelta,
      trend:
        recentDelta > 0
          ? "up"
          : recentDelta < 0
            ? "down"
            : "stable",
      improving: recentDelta > 0,
      deteriorating: recentDelta < 0,
    };
  };

  const runQuestionBankPerformanceBenchmark = () => {
    const startedAt = Date.now();

    const activeCount = Number(
      (sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM question_bank_index
        WHERE status = 'active'
      `).get() as any)?.count || 0,
    );

    const benchmark = (
      id: string,
      label: string,
      fn: () => any,
    ) => {
      const start = Date.now();
      let result: any = null;
      let error: string | null = null;

      try {
        result = fn();
      } catch (caught) {
        error =
          caught instanceof Error ? caught.message : String(caught);
      }

      const durationMs = Math.max(0, Date.now() - start);

      return {
        id,
        label,
        durationMs,
        status:
          error
            ? "error"
            : durationMs <= 100
              ? "excellent"
              : durationMs <= 300
                ? "good"
                : durationMs <= 800
                  ? "warning"
                  : "slow",
        error,
        result,
      };
    };

    const tests: any[] = [];

    tests.push(
      benchmark(
        "latest-100",
        "Son 100 aktif soru",
        () =>
          sqlite.prepare(`
            SELECT question_id
            FROM question_bank_index
            WHERE status = 'active'
            ORDER BY updated_at DESC
            LIMIT 100
          `).all().length,
      ),
    );

    tests.push(
      benchmark(
        "course-group",
        "Ders bazlÄ± grup sorgusu",
        () =>
          sqlite.prepare(`
            SELECT course_id AS courseId, COUNT(*) AS count
            FROM question_bank_index
            WHERE status = 'active'
            GROUP BY course_id
            ORDER BY count DESC
            LIMIT 20
          `).all().length,
      ),
    );

    const profile = questionBankDatasetProfile();
    const sampleOffset =
      activeCount > 1
        ? Math.floor(Math.random() * Math.max(1, activeCount - 1))
        : 0;

    const sampleOutcome = sqlite.prepare(`
      SELECT outcome_id AS outcomeId
      FROM question_bank_index
      WHERE status = 'active'
        AND outcome_id IS NOT NULL
        AND outcome_id <> ''
      LIMIT 1 OFFSET ?
    `).get(sampleOffset) as any;

    if (sampleOutcome?.outcomeId) {
      tests.push(
        benchmark(
          "random-outcome",
          "Rastgele kazanÄ±m sorgusu",
          () =>
            sqlite.prepare(`
              SELECT question_id
              FROM question_bank_index
              WHERE status = 'active'
                AND outcome_id = ?
              ORDER BY updated_at DESC
              LIMIT 100
            `).all(String(sampleOutcome.outcomeId)).length,
        ),
      );
    }

    const sampleFiles = sqlite.prepare(`
      SELECT storage_path AS storagePath
      FROM question_bank_index
      WHERE status = 'active'
        AND storage_path IS NOT NULL
        AND storage_path <> ''
      LIMIT 25 OFFSET ?
    `).all(Math.max(0, sampleOffset - 12)) as any[];

    tests.push(
      benchmark(
        "file-stat-sample",
        "25 dosya eriÅŸim Ã¶rneklemesi",
        () => {
          let accessible = 0;
          for (const item of sampleFiles) {
            const storagePath = safeStoredQuestionPath(
              String(item.storagePath || ""),
            );
            if (
              storagePath &&
              fs.existsSync(path.resolve(questionBankRoot, storagePath))
            ) {
              accessible += 1;
            }
          }
          return {
            sample: sampleFiles.length,
            accessible,
          };
        },
      ),
    );

    const successfulTests = tests.filter(
      (test) => test.status !== "error",
    );
    const averageLatencyMs =
      successfulTests.length > 0
        ? Math.round(
            successfulTests.reduce(
              (sum, test) => sum + Number(test.durationMs || 0),
              0,
            ) / successfulTests.length,
          )
        : 0;

    const slowestLatencyMs =
      successfulTests.length > 0
        ? Math.max(
            ...successfulTests.map(
              (test) => Number(test.durationMs || 0),
            ),
          )
        : 0;

    const performanceGrade =
      tests.some((test) => test.status === "error")
        ? "E"
        : slowestLatencyMs <= 150
          ? "A+"
          : slowestLatencyMs <= 300
            ? "A"
            : slowestLatencyMs <= 600
              ? "B"
              : slowestLatencyMs <= 1000
                ? "C"
                : "D";

    const capacityClass =
      activeCount < 10000
        ? "small"
        : activeCount < 50000
          ? "medium"
          : activeCount < 150000
            ? "large"
            : "very-large";

    return {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      activeQuestions: activeCount,
      datasetProfile: profile,
      capacityClass,
      performanceGrade,
      averageLatencyMs,
      slowestLatencyMs,
      tests,
      recommendation:
        performanceGrade === "A+" || performanceGrade === "A"
          ? "Soru bankasÄ± sorgu performansÄ± gÃ¼Ã§lÃ¼."
          : performanceGrade === "B"
            ? "Performans kullanÄ±labilir dÃ¼zeyde; veri bÃ¼yÃ¼dÃ¼kÃ§e indeksleri izleyin."
            : "Performans optimizasyonu Ã¶nerilir. Ä°ndeks ve disk eriÅŸimini kontrol edin.",
    };
  };

  const recordQuestionBankPerformanceBenchmark = () => {
    const benchmark = runQuestionBankPerformanceBenchmark();

    const result = sqlite.prepare(`
      INSERT INTO question_bank_performance_history (
        measured_at, active_questions, capacity_class,
        performance_grade, average_latency_ms, slowest_latency_ms,
        duration_ms, tests_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      benchmark.generatedAt,
      benchmark.activeQuestions,
      benchmark.capacityClass,
      benchmark.performanceGrade,
      benchmark.averageLatencyMs,
      benchmark.slowestLatencyMs,
      benchmark.durationMs,
      JSON.stringify(benchmark.tests || []),
    );

    return {
      id: Number(result.lastInsertRowid),
      ...benchmark,
    };
  };

  const listQuestionBankPerformanceHistory = (limit = 30) => {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 2), 365);

    const rows = sqlite.prepare(`
      SELECT
        id,
        measured_at AS measuredAt,
        active_questions AS activeQuestions,
        capacity_class AS capacityClass,
        performance_grade AS performanceGrade,
        average_latency_ms AS averageLatencyMs,
        slowest_latency_ms AS slowestLatencyMs,
        duration_ms AS durationMs,
        tests_json AS testsJson
      FROM question_bank_performance_history
      ORDER BY id DESC
      LIMIT ?
    `).all(safeLimit) as any[];

    const items = rows.map((row) => ({
      ...row,
      tests: (() => {
        try {
          return JSON.parse(String(row.testsJson || "[]"));
        } catch {
          return [];
        }
      })(),
    }));

    const latest = items[0] || null;
    const previous = items[1] || null;

    const averageDelta =
      latest && previous
        ? Number(latest.averageLatencyMs || 0) -
          Number(previous.averageLatencyMs || 0)
        : null;

    const slowestDelta =
      latest && previous
        ? Number(latest.slowestLatencyMs || 0) -
          Number(previous.slowestLatencyMs || 0)
        : null;

    const regression =
      averageDelta !== null &&
      (
        averageDelta >= 100 ||
        (
          Number(previous?.averageLatencyMs || 0) > 0 &&
          averageDelta / Number(previous.averageLatencyMs) >= 0.35
        )
      );

    const improvement =
      averageDelta !== null &&
      (
        averageDelta <= -100 ||
        (
          Number(previous?.averageLatencyMs || 0) > 0 &&
          averageDelta / Number(previous.averageLatencyMs) <= -0.25
        )
      );

    return {
      items,
      latest,
      previous,
      averageDelta,
      slowestDelta,
      regression,
      improvement,
      trend:
        latest && previous
          ? regression
            ? "down"
            : improvement
              ? "up"
              : "stable"
          : "baseline",
    };
  };

  const analyzeQuestionBankDatabaseOptimization = () => {
    const performance = listQuestionBankPerformanceHistory(10);
    const health = calculateQuestionBankHealthScore();

    const pageCount = Number(
      (sqlite.prepare("PRAGMA page_count").get() as any)?.page_count || 0,
    );
    const freePages = Number(
      (sqlite.prepare("PRAGMA freelist_count").get() as any)?.freelist_count || 0,
    );
    const pageSize = Number(
      (sqlite.prepare("PRAGMA page_size").get() as any)?.page_size || 0,
    );

    const databaseBytes = pageCount * pageSize;
    const reclaimableBytes = freePages * pageSize;
    const freeRatio =
      pageCount > 0 ? Math.round((freePages / pageCount) * 1000) / 10 : 0;

    const indexes = sqlite.prepare(`
      SELECT name, tbl_name AS tableName
      FROM sqlite_master
      WHERE type = 'index'
        AND name NOT LIKE 'sqlite_autoindex_%'
      ORDER BY tbl_name, name
    `).all() as any[];

    const recommendations: any[] = [];

    if (performance.regression) {
      recommendations.push({
        id: "analyze",
        priority: "warning",
        title: "MySQL sorgu istatistiklerini yenileyin",
        description:
          "Son performans Ã¶lÃ§Ã¼mÃ¼nde yavaÅŸlama gÃ¶rÃ¼ldÃ¼. ANALYZE sorgu planlayÄ±cÄ±sÄ±nÄ±n istatistiklerini gÃ¼ncelleyebilir.",
        safeAction: "database-analyze",
      });
    }

    if (freeRatio >= 15 && reclaimableBytes >= 10 * 1024 * 1024) {
      recommendations.push({
        id: "vacuum",
        priority: "info",
        title: "BoÅŸ veritabanÄ± sayfalarÄ±nÄ± sÄ±kÄ±ÅŸtÄ±rÄ±n",
        description:
          `MySQL tablolarÄ±nÄ±n yaklaÅŸÄ±k %${freeRatio} bÃ¶lÃ¼mÃ¼ geri kazanÄ±labilir alan olarak gÃ¶rÃ¼nÃ¼yor. ` +
          "VACUUM yalnÄ±z yÃ¶netici onayÄ±yla Ã§alÄ±ÅŸtÄ±rÄ±lmalÄ±dÄ±r.",
        safeAction: null,
      });
    }

    if (Number(health.metrics?.activeRecords || 0) >= 50000 && indexes.length < 5) {
      recommendations.push({
        id: "index-review",
        priority: "warning",
        title: "Soru bankasÄ± indekslerini gÃ¶zden geÃ§irin",
        description:
          "Soru sayÄ±sÄ± bÃ¼yÃ¼dÃ¼. KazanÄ±m, ders ve gÃ¼ncelleme tarihi sorgularÄ±nÄ±n indeksleri kontrol edilmelidir.",
        safeAction: null,
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: "optimized",
        priority: "info",
        title: "VeritabanÄ± optimizasyon ihtiyacÄ± gÃ¶rÃ¼nmÃ¼yor",
        description:
          "Mevcut saÄŸlÄ±k ve performans Ã¶lÃ§Ã¼mlerinde bakÄ±m gerektiren MySQL sorunu tespit edilmedi.",
        safeAction: null,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      databaseBytes,
      reclaimableBytes,
      pageCount,
      freePages,
      pageSize,
      freeRatio,
      indexCount: indexes.length,
      indexes,
      performanceRegression: Boolean(performance.regression),
      queryPlanAnalysis: analyzeQuestionBankQueryPlans(),
      recommendations,
    };
  };

  const runQuestionBankDatabaseAnalyze = () => {
    const startedAt = Date.now();
    sqlite.exec("ANALYZE;");
    return {
      success: true,
      action: "ANALYZE",
      durationMs: Date.now() - startedAt,
      completedAt: new Date().toISOString(),
      optimization: analyzeQuestionBankDatabaseOptimization(),
    };
  };

  const analyzeQuestionBankQueryPlans = () => {
    const sampleOutcome = sqlite.prepare(`
      SELECT outcome_id AS outcomeId
      FROM question_bank_index
      WHERE status = 'active'
        AND outcome_id IS NOT NULL
        AND outcome_id <> ''
      LIMIT 1
    `).get() as any;

    const sampleCourse = sqlite.prepare(`
      SELECT course_id AS courseId
      FROM question_bank_index
      WHERE status = 'active'
        AND course_id IS NOT NULL
        AND course_id <> ''
      LIMIT 1
    `).get() as any;

    const checks = [
      {
        id: "latest-active",
        label: "Son aktif sorular",
        sql: `
          SELECT question_id
          FROM question_bank_index
          WHERE status = 'active'
          ORDER BY updated_at DESC
          LIMIT 100
        `,
        params: [],
      },
      {
        id: "course-filter",
        label: "Ders filtresi",
        sql: `
          SELECT question_id
          FROM question_bank_index
          WHERE status = 'active'
            AND course_id = ?
          ORDER BY updated_at DESC
          LIMIT 100
        `,
        params: [String(sampleCourse?.courseId || "__sample__")],
      },
      {
        id: "outcome-filter",
        label: "KazanÄ±m filtresi",
        sql: `
          SELECT question_id
          FROM question_bank_index
          WHERE status = 'active'
            AND outcome_id = ?
          ORDER BY updated_at DESC
          LIMIT 100
        `,
        params: [String(sampleOutcome?.outcomeId || "__sample__")],
      },
    ];

    const results = checks.map((check) => {
      const rows = sqlite.prepare(
        `EXPLAIN QUERY PLAN ${check.sql}`,
      ).all(...check.params) as any[];

      const details = rows.map((row) =>
        String(row.detail || row["QUERY PLAN"] || ""),
      );

      const fullScan = details.some((detail) =>
        /\bSCAN\b/i.test(detail) &&
        !/USING (COVERING )?INDEX/i.test(detail),
      );

      const usesIndex = details.some((detail) =>
        /USING (COVERING )?INDEX/i.test(detail),
      );

      return {
        id: check.id,
        label: check.label,
        usesIndex,
        fullScan,
        status: fullScan ? "warning" : usesIndex ? "good" : "info",
        details,
      };
    });

    const fullScanCount = results.filter((item) => item.fullScan).length;
    const indexedCount = results.filter((item) => item.usesIndex).length;

    return {
      generatedAt: new Date().toISOString(),
      checkedQueries: results.length,
      indexedQueries: indexedCount,
      fullScanQueries: fullScanCount,
      status: fullScanCount > 0 ? "warning" : "healthy",
      results,
      recommendation:
        fullScanCount > 0
          ? "BazÄ± temel soru bankasÄ± sorgularÄ± tam tablo taramasÄ± yapÄ±yor. Veri bÃ¼yÃ¼meden Ã¶nce indeks planÄ± gÃ¶zden geÃ§irilmelidir."
          : "Temel soru bankasÄ± sorgularÄ±nda kritik tam tablo taramasÄ± gÃ¶rÃ¼lmedi.",
    };
  };

  const recommendQuestionBankIndexes = () => {
    const plans = analyzeQuestionBankQueryPlans();

    const existingIndexes = sqlite.prepare(`
      SELECT name, sql
      FROM sqlite_master
      WHERE type = 'index'
        AND tbl_name = 'question_bank_index'
      ORDER BY name
    `).all() as any[];

    const existingSql = existingIndexes
      .map((item) => String(item.sql || "").toLowerCase())
      .join("\n");

    const candidates = [
      {
        id: "status-updated",
        name: "idx_qb_index_status_updated",
        columns: ["status", "updated_at"],
        sql:
          "CREATE INDEX IF NOT EXISTS idx_qb_index_status_updated " +
          "ON question_bank_index(status, updated_at DESC)",
        relatedPlan: "latest-active",
      },
      {
        id: "status-course-updated",
        name: "idx_qb_index_status_course_updated",
        columns: ["status", "course_id", "updated_at"],
        sql:
          "CREATE INDEX IF NOT EXISTS idx_qb_index_status_course_updated " +
          "ON question_bank_index(status, course_id, updated_at DESC)",
        relatedPlan: "course-filter",
      },
      {
        id: "status-outcome-updated",
        name: "idx_qb_index_status_outcome_updated",
        columns: ["status", "outcome_id", "updated_at"],
        sql:
          "CREATE INDEX IF NOT EXISTS idx_qb_index_status_outcome_updated " +
          "ON question_bank_index(status, outcome_id, updated_at DESC)",
        relatedPlan: "outcome-filter",
      },
    ];

    const recommendations = candidates.map((candidate) => {
      const plan = plans.results.find(
        (item: any) => item.id === candidate.relatedPlan,
      );
      const alreadyExists = existingIndexes.some(
        (item) => String(item.name) === candidate.name,
      );

      const equivalentLikelyExists =
        candidate.columns.every((column) =>
          existingSql.includes(column.toLowerCase()),
        );

      return {
        ...candidate,
        alreadyExists,
        equivalentLikelyExists,
        needed:
          Boolean(plan?.fullScan) &&
          !alreadyExists &&
          !equivalentLikelyExists,
        planStatus: plan?.status || "unknown",
        reason: plan?.fullScan
          ? "Ä°lgili sorgu tam tablo taramasÄ± yapÄ±yor."
          : "Ä°lgili sorguda kritik tam tablo taramasÄ± gÃ¶rÃ¼lmedi.",
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      existingIndexCount: existingIndexes.length,
      existingIndexes: existingIndexes.map((item) => ({
        name: item.name,
        sql: item.sql || null,
      })),
      recommendations,
      actionableCount: recommendations.filter(
        (item) => item.needed,
      ).length,
    };
  };

  const applyQuestionBankRecommendedIndexes = () => {
    const analysis = recommendQuestionBankIndexes();
    const applied: string[] = [];

    for (const item of analysis.recommendations) {
      if (!item.needed) continue;
      sqlite.exec(`${item.sql};`);
      applied.push(item.name);
    }

    if (applied.length > 0) {
      sqlite.exec("ANALYZE question_bank_index;");
    }

    return {
      success: true,
      applied,
      appliedCount: applied.length,
      completedAt: new Date().toISOString(),
      queryPlans: analyzeQuestionBankQueryPlans(),
      recommendations: recommendQuestionBankIndexes(),
    };
  };

  const verifyQuestionBankIndexEffectiveness = () => {
    const plans = analyzeQuestionBankQueryPlans();
    const recommendations = recommendQuestionBankIndexes();
    const performance = runQuestionBankPerformanceBenchmark();

    const required = recommendations.recommendations.filter(
      (item: any) => item.needed,
    );

    const fullScans = plans.results.filter(
      (item: any) => item.fullScan,
    );

    const score = Math.max(
      0,
      100 -
        fullScans.length * 25 -
        required.length * 15 -
        (performance.performanceGrade === "D" ||
        performance.performanceGrade === "E"
          ? 25
          : performance.performanceGrade === "C"
            ? 15
            : performance.performanceGrade === "B"
              ? 5
              : 0),
    );

    const grade =
      score >= 95
        ? "A+"
        : score >= 90
          ? "A"
          : score >= 80
            ? "B"
            : score >= 70
              ? "C"
              : score >= 60
                ? "D"
                : "E";

    return {
      generatedAt: new Date().toISOString(),
      score,
      grade,
      healthy:
        fullScans.length === 0 &&
        required.length === 0 &&
        ["A+", "A", "B"].includes(performance.performanceGrade),
      fullScanCount: fullScans.length,
      missingRecommendedIndexes: required.length,
      performanceGrade: performance.performanceGrade,
      averageLatencyMs: performance.averageLatencyMs,
      slowestLatencyMs: performance.slowestLatencyMs,
      plans: plans.results,
      missingIndexes: required.map((item: any) => ({
        id: item.id,
        name: item.name,
        reason: item.reason,
      })),
      recommendation:
        fullScans.length > 0 || required.length > 0
          ? "Ä°ndeks katmanÄ±nda iyileÅŸtirme ihtiyacÄ± devam ediyor."
          : "Temel soru bankasÄ± sorgularÄ± iÃ§in indeks yapÄ±sÄ± yeterli gÃ¶rÃ¼nÃ¼yor.",
    };
  };

  const runQuestionBankMaintenanceOrchestrator = (options?: {
    applySafeFixes?: boolean;
  }) => {
    const applySafeFixes = Boolean(options?.applySafeFixes);
    const startedAt = new Date().toISOString();
    const steps: any[] = [];

    const pushStep = (
      id: string,
      label: string,
      payload: any,
      status = "done",
    ) => {
      steps.push({
        id,
        label,
        status,
        at: new Date().toISOString(),
        payload,
      });
    };

    // 1. Yazma gÃ¼nlÃ¼ÄŸÃ¼ / yarÄ±m iÅŸlemler
    let writeRecovery = {
      pending: 0,
      recovered: 0,
      failed: 0,
      failures: [],
    } as any;

    const journalStatus = sqlite.prepare(`
      SELECT status, COUNT(*) AS count
      FROM question_bank_write_journal
      GROUP BY status
    `).all() as any[];

    const journalMap = Object.fromEntries(
      journalStatus.map((item) => [
        String(item.status),
        Number(item.count || 0),
      ]),
    );

    if (applySafeFixes && Number(journalMap.pending || 0) > 0) {
      writeRecovery = recoverPendingQuestionBankWrites();
    }
    pushStep(
      "write-journal",
      "Yazma gÃ¼nlÃ¼ÄŸÃ¼",
      {
        before: journalMap,
        recovery: writeRecovery,
      },
    );

    // 2. Sahipsiz dosya taramasÄ±
    let orphanScan = scanQuestionBankOrphanFiles();
    let orphanQuarantine: any = null;

    if (applySafeFixes && orphanScan.orphanCount > 0) {
      orphanQuarantine = quarantineQuestionBankOrphans();
      orphanScan = scanQuestionBankOrphanFiles();
    }

    pushStep(
      "orphan-files",
      "Sahipsiz dosya kontrolÃ¼",
      {
        scan: orphanScan,
        quarantine: orphanQuarantine,
      },
    );

    // 3. Ä°ndeks Ã¶nerileri ve gÃ¼venli indeks uygulamasÄ±
    let indexRecommendations = recommendQuestionBankIndexes();
    let appliedIndexes: any = null;

    if (
      applySafeFixes &&
      Number(indexRecommendations.actionableCount || 0) > 0
    ) {
      appliedIndexes = applyQuestionBankRecommendedIndexes();
      indexRecommendations = recommendQuestionBankIndexes();
    }

    pushStep(
      "indexes",
      "AkÄ±llÄ± indeks kontrolÃ¼",
      {
        recommendations: indexRecommendations,
        applied: appliedIndexes,
      },
    );

    // 4. ANALYZE yalnÄ±z performans regresyonu veya sorgu planÄ± uyarÄ±sÄ± varsa.
    let databaseOptimization = analyzeQuestionBankDatabaseOptimization();
    let analyzeResult: any = null;

    if (
      applySafeFixes &&
      (
        databaseOptimization.performanceRegression ||
        databaseOptimization.queryPlanAnalysis?.status === "warning"
      )
    ) {
      analyzeResult = runQuestionBankDatabaseAnalyze();
      databaseOptimization = analyzeQuestionBankDatabaseOptimization();
    }

    pushStep(
      "database-analyze",
      "MySQL ANALYZE",
      {
        optimization: databaseOptimization,
        executed: analyzeResult,
      },
    );

    // 5. GÃ¼venli mod tekrar deÄŸerlendirmesi
    let readiness = validateQuestionBankWriteReadiness();
    if (applySafeFixes) {
      const indexCheck = readiness.checks.find(
        (check) => check.id === "index",
      );
      if (indexCheck && !indexCheck.ok) {
        rebuildQuestionBankIndex();
        readiness = validateQuestionBankWriteReadiness();
      }

      if (readiness.ready) {
        setQuestionBankMigrationState({
          targetVersion: QUESTION_BANK_SCHEMA_VERSION,
          currentVersion: currentQuestionBankSchemaVersion(),
          status: "completed",
          backupPath:
            getQuestionBankMigrationState()?.backupPath || null,
          lastError: null,
          startedAt:
            getQuestionBankMigrationState()?.startedAt || null,
          completedAt: new Date().toISOString(),
        });
      }
    }

    const writeGate = questionBankWriteGate();

    pushStep(
      "readiness",
      "Yazma gÃ¼venliÄŸi",
      {
        readiness,
        writeGate,
      },
    );

    // 6. Final Ã¶lÃ§Ã¼mler
    const integrity = createQuestionBankIntegritySnapshot();
    const healthScore = recordQuestionBankHealthScore();
    const performance = recordQuestionBankPerformanceBenchmark();
    const queryPlans = analyzeQuestionBankQueryPlans();
    const indexEffectiveness = verifyQuestionBankIndexEffectiveness();

    pushStep(
      "final-measurement",
      "Final saÄŸlÄ±k Ã¶lÃ§Ã¼mÃ¼",
      {
        integrity,
        healthScore,
        performance,
        queryPlans,
        indexEffectiveness,
      },
    );

    const criticalReasons: string[] = [];

    if (Number(integrity.missingFiles || 0) > 0) {
      criticalReasons.push(
        `${Number(integrity.missingFiles || 0)} fiziksel soru dosyasÄ± eksik.`,
      );
    }

    if (Number(integrity.failedWrites || 0) > 0) {
      criticalReasons.push(
        `${Number(integrity.failedWrites || 0)} yazma/kurtarma hatasÄ± var.`,
      );
    }

    if (!writeGate.writable) {
      criticalReasons.push("Soru bankasÄ± yazma kilidi aktif.");
    }

    if (Number(healthScore.score || 0) < 70) {
      criticalReasons.push(
        `SaÄŸlÄ±k puanÄ± dÃ¼ÅŸÃ¼k: ${Number(healthScore.score || 0)}/100.`,
      );
    }

    const status =
      criticalReasons.length > 0
        ? "attention"
        : Number(healthScore.score || 0) >= 90 &&
            indexEffectiveness.healthy
          ? "healthy"
          : "warning";

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      applySafeFixes,
      status,
      criticalReasons,
      steps,
      summary: {
        healthScore: healthScore.score,
        healthGrade: healthScore.grade,
        performanceGrade: performance.performanceGrade,
        indexEffectivenessScore: indexEffectiveness.score,
        indexEffectivenessGrade: indexEffectiveness.grade,
        writable: writeGate.writable,
        missingFiles: integrity.missingFiles,
        orphanFiles: integrity.orphanFiles,
        pendingWrites: integrity.pendingWrites,
        failedWrites: integrity.failedWrites,
      },
      blockedAutomaticActions: [
        "VACUUM",
        "Karantina kalÄ±cÄ± temizliÄŸi",
        "VeritabanÄ± geri yÃ¼kleme",
        "Soru silme",
        "Fiziksel soru dosyasÄ± kalÄ±cÄ± silme",
      ],
    };
  };

  const clampQuestionBankPage = (
    rawLimit: unknown,
    rawOffset: unknown,
    options?: {
      defaultLimit?: number;
      maxLimit?: number;
      maxOffset?: number;
    },
  ) => {
    const defaultLimit = Number(options?.defaultLimit || 50);
    const maxLimit = Number(options?.maxLimit || 500);
    const maxOffset = Number(options?.maxOffset || 5_000_000);

    const parsedLimit = Number.parseInt(String(rawLimit ?? ""), 10);
    const parsedOffset = Number.parseInt(String(rawOffset ?? ""), 10);

    return {
      limit: Math.min(
        Math.max(
          Number.isFinite(parsedLimit) ? parsedLimit : defaultLimit,
          1,
        ),
        maxLimit,
      ),
      offset: Math.min(
        Math.max(
          Number.isFinite(parsedOffset) ? parsedOffset : 0,
          0,
        ),
        maxOffset,
      ),
    };
  };

  const questionBankDatasetProfile = () => {
    const total = Number(
      (sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM question_bank_index
      `).get() as any)?.count || 0,
    );

    const active = Number(
      (sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM question_bank_index
        WHERE status = 'active'
      `).get() as any)?.count || 0,
    );

    const deleted = Number(
      (sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM question_bank_index
        WHERE status = 'deleted'
      `).get() as any)?.count || 0,
    );

    const totalBytes = Number(
      (sqlite.prepare(`
        SELECT COALESCE(SUM(size_bytes), 0) AS bytes
        FROM question_bank_index
        WHERE status = 'active'
      `).get() as any)?.bytes || 0,
    );

    const className =
      active < 10_000
        ? "small"
        : active < 50_000
          ? "medium"
          : active < 150_000
            ? "large"
            : active < 500_000
              ? "very-large"
              : "extreme";

    return {
      generatedAt: new Date().toISOString(),
      total,
      active,
      deleted,
      totalBytes,
      className,
      recommendedPageSize:
        className === "small"
          ? 100
          : className === "medium"
            ? 75
            : className === "large"
              ? 50
              : 30,
      maintenanceSampleSize:
        className === "small"
          ? 500
          : className === "medium"
            ? 300
            : className === "large"
              ? 200
              : 100,
      maxInteractivePageSize: 500,
      protections: [
        "Listeleme limitleri sunucu tarafÄ±nda Ã¼st sÄ±nÄ±rla kÄ±sÄ±tlanÄ±r.",
        "BÃ¼yÃ¼k veri kontrollerinde tÃ¼m kayÄ±tlar yerine indeks ve Ã¶rnekleme kullanÄ±lÄ±r.",
        "BakÄ±m/rapor endpoint'lerinde sÄ±nÄ±rsÄ±z sonuÃ§ dÃ¶ndÃ¼rÃ¼lmez.",
      ],
    };
  };

  const sha256File = (filePath: string) => {
    const hash = crypto.createHash("sha256");
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.allocUnsafe(1024 * 1024);

    try {
      let bytesRead = 0;
      do {
        bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
        if (bytesRead > 0) {
          hash.update(buffer.subarray(0, bytesRead));
        }
      } while (bytesRead > 0);
    } finally {
      fs.closeSync(fd);
    }

    return hash.digest("hex");
  };

  const createQuestionBankCoordinatedBackup = () => {
    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/[:.]/g, "-");
    const backupRoot = path.join(
      path.dirname(sqlitePath),
      "backups",
      "question-bank-coordinated",
      stamp,
    );

    fs.mkdirSync(backupRoot, { recursive: true });

    const mysqlBackup = createBackup();
    const databaseBackupPath = path.join(backupRoot, "edupanel-mysql.json.gz");
    fs.copyFileSync(mysqlBackup.path, databaseBackupPath);

    const filesRoot = path.join(backupRoot, "question-bank-files");
    fs.mkdirSync(filesRoot, { recursive: true });

    const activeRecords = sqlite.prepare(`
      SELECT
        question_id AS questionId,
        question_code AS questionCode,
        storage_path AS storagePath,
        content_hash AS contentHash,
        size_bytes AS sizeBytes
      FROM question_bank_index
      WHERE status = 'active'
      ORDER BY question_id
    `).all() as any[];

    const copiedFiles: any[] = [];
    const missingFiles: any[] = [];

    for (const record of activeRecords) {
      const storagePath = safeStoredQuestionPath(
        String(record.storagePath || ""),
      );

      if (!storagePath) {
        missingFiles.push({
          questionId: record.questionId,
          questionCode: record.questionCode,
          storagePath: record.storagePath || null,
          reason: "GeÃ§ersiz depolama yolu",
        });
        continue;
      }

      const source = path.resolve(questionBankRoot, storagePath);

      if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
        missingFiles.push({
          questionId: record.questionId,
          questionCode: record.questionCode,
          storagePath,
          reason: "Dosya bulunamadÄ±",
        });
        continue;
      }

      const target = path.join(
        filesRoot,
        ...storagePath.split("/"),
      );

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);

      const fileHash = sha256File(target);

      copiedFiles.push({
        questionId: record.questionId,
        questionCode: record.questionCode,
        storagePath,
        sizeBytes: fs.statSync(target).size,
        sha256: fileHash,
        expectedContentHash:
          String(record.contentHash || "") || null,
      });
    }

    const manifest = {
      format: "e-nstitu-question-bank-coordinated-backup",
      version: 1,
      createdAt,
      schemaVersion: currentQuestionBankSchemaVersion(),
      targetSchemaVersion: QUESTION_BANK_SCHEMA_VERSION,
      database: {
        file: "edupanel-mysql.json.gz",
        sizeBytes: fs.statSync(databaseBackupPath).size,
        sha256: sha256File(databaseBackupPath),
      },
      questionBank: {
        activeRecords: activeRecords.length,
        copiedFiles: copiedFiles.length,
        missingFiles: missingFiles.length,
        totalFileBytes: copiedFiles.reduce(
          (sum, item) => sum + Number(item.sizeBytes || 0),
          0,
        ),
      },
      files: copiedFiles,
      missing: missingFiles,
      healthScore: calculateQuestionBankHealthScore(),
      integrity: createQuestionBankIntegritySnapshot(),
    };

    fs.writeFileSync(
      path.join(backupRoot, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    return {
      backupRoot,
      manifest,
      complete: missingFiles.length === 0,
    };
  };

  const verifyQuestionBankCoordinatedBackup = (
    backupRoot: string,
  ) => {
    const root = path.resolve(String(backupRoot || ""));
    const manifestPath = path.join(root, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      throw new Error("Yedek manifesti bulunamadÄ±.");
    }

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    );

    if (
      manifest?.format !==
      "e-nstitu-question-bank-coordinated-backup"
    ) {
      throw new Error("GeÃ§ersiz soru bankasÄ± yedek formatÄ±.");
    }

    const databasePath = path.join(
      root,
      String(manifest.database?.file || "edupanel-mysql.json.gz"),
    );

    if (!fs.existsSync(databasePath)) {
      throw new Error("MySQL yedek dosyasÄ± bulunamadÄ±.");
    }

    const databaseHash = sha256File(databasePath);
    const databaseValid =
      databaseHash === String(manifest.database?.sha256 || "");

    let checkedFiles = 0;
    let invalidFiles = 0;
    const invalid: any[] = [];

    for (const item of Array.isArray(manifest.files)
      ? manifest.files
      : []) {
      const relative = String(item.storagePath || "");
      const filePath = path.join(
        root,
        "question-bank-files",
        ...relative.split("/"),
      );

      if (!fs.existsSync(filePath)) {
        invalidFiles += 1;
        invalid.push({
          storagePath: relative,
          reason: "Dosya eksik",
        });
        continue;
      }

      const actualHash = sha256File(filePath);
      checkedFiles += 1;

      if (actualHash !== String(item.sha256 || "")) {
        invalidFiles += 1;
        invalid.push({
          storagePath: relative,
          reason: "SHA-256 uyuÅŸmuyor",
        });
      }
    }

    return {
      valid:
        databaseValid &&
        invalidFiles === 0 &&
        Number(manifest.questionBank?.missingFiles || 0) === 0,
      databaseValid,
      checkedFiles,
      invalidFiles,
      invalid,
      schemaVersion: Number(manifest.schemaVersion || 0),
      targetSchemaVersion: Number(
        manifest.targetSchemaVersion || 0,
      ),
      createdAt: manifest.createdAt || null,
      manifest,
    };
  };

  const runQuestionBankDisasterRecoveryDrill = (backupRoot: string) => {
    const startedAt = new Date().toISOString();
    const verification = verifyQuestionBankCoordinatedBackup(backupRoot);

    if (!verification.valid) {
      return {
        success: false,
        safe: true,
        startedAt,
        completedAt: new Date().toISOString(),
        stage: "backup-verification",
        verification,
        message: "Felaket kurtarma provasÄ± baÅŸlatÄ±lmadÄ±; yedek doÄŸrulamasÄ± geÃ§emedi.",
      };
    }

    const root = path.resolve(String(backupRoot || ""));
    const manifest = verification.manifest;
    const databasePath = path.join(
      root,
      String(manifest.database?.file || "edupanel-mysql.json.gz"),
    );
    const backupPayload = JSON.parse(zlib.gunzipSync(fs.readFileSync(databasePath)).toString("utf8"));
    const mysqlBackupValid = backupPayload?.format === "edupanel-mysql-backup" && backupPayload?.engine === "mysql";
    const tableNames = Object.keys(backupPayload?.questionBank || {});
    const requiredTables = ["question_bank_index", "question_bank_write_journal"];
    const missingTables = requiredTables.filter((name) => !tableNames.includes(name));
    const indexRows = Array.isArray(backupPayload?.questionBank?.question_bank_index)
      ? backupPayload.questionBank.question_bank_index
      : [];
    const backupActiveRecords = indexRows.filter((row: any) => String(row?.status || "") === "active").length;
    const backupDeletedRecords = indexRows.filter((row: any) => String(row?.status || "") === "deleted").length;

      const manifestActiveRecords = Number(manifest.questionBank?.activeRecords || 0);
      const copiedFiles = Number(manifest.questionBank?.copiedFiles || 0);
      const recordCountMatches = backupActiveRecords === manifestActiveRecords;
      const recoverability =
        mysqlBackupValid &&
        missingTables.length === 0 &&
        recordCountMatches &&
        copiedFiles === manifestActiveRecords;

      const checks = [
        { id: "manifest", label: "Manifest ve SHA-256", ok: verification.valid,
          detail: "Yedek manifesti ve dosya hash'leri doÄŸrulandÄ±." },
        { id: "mysql-backup", label: "MySQL yedek içeriği", ok: mysqlBackupValid,
          detail: mysqlBackupValid ? "MySQL JSON yedeği okunabildi." : "MySQL yedek biçimi geçersiz." },
        { id: "required-tables", label: "Kritik tablolar", ok: missingTables.length === 0,
          detail: missingTables.length === 0 ? "Kritik soru bankasÄ± tablolarÄ± mevcut." : `Eksik tablolar: ${missingTables.join(", ")}` },
        { id: "record-count", label: "Aktif kayÄ±t sayÄ±sÄ±", ok: recordCountMatches,
          detail: `Manifest: ${manifestActiveRecords}, MySQL yedeği: ${backupActiveRecords}` },
        { id: "file-count", label: "Fiziksel soru dosyalarÄ±", ok: copiedFiles === manifestActiveRecords,
          detail: `Dosya: ${copiedFiles}, aktif kayÄ±t: ${manifestActiveRecords}` },
      ];

      return {
        success: recoverability,
        safe: true,
        startedAt,
        completedAt: new Date().toISOString(),
        stage: "completed",
        recoverability,
        checks,
        backup: {
          root,
          schemaVersion: verification.schemaVersion,
          activeRecords: backupActiveRecords,
          deletedRecords: backupDeletedRecords,
          copiedFiles,
          checkedFiles: verification.checkedFiles,
        },
        restorePlan: recoverability ? [
          "UygulamayÄ± durdur.",
          "Mevcut canlÄ± veritabanÄ± ve soru dosyalarÄ±nÄ±n gÃ¼venlik kopyasÄ±nÄ± al.",
          "DoÄŸrulanmÄ±ÅŸ MySQL yedeÄŸini geri yÃ¼kle.",
          "DoÄŸrulanmÄ±ÅŸ question-bank-files iÃ§eriÄŸini soru bankasÄ± deposuna kopyala.",
          "UygulamayÄ± gÃ¼venli modda baÅŸlat.",
          "Åema, indeks, bÃ¼tÃ¼nlÃ¼k ve saÄŸlÄ±k kontrollerini Ã§alÄ±ÅŸtÄ±r.",
          "Kontroller baÅŸarÄ±lÄ±ysa normal yazma modunu aÃ§.",
        ] : [],
        message: recoverability
          ? "Felaket kurtarma provasÄ± baÅŸarÄ±lÄ±. Yedek geri yÃ¼klenebilir gÃ¶rÃ¼nÃ¼yor."
          : "Felaket kurtarma provasÄ±nda sorun bulundu; bu yedek otomatik geri yÃ¼klemeye uygun deÄŸil.",
      };
  };

  const getQuestionBankProductionReadiness = () => {
    const writeGate = questionBankWriteGate();
    const health = calculateQuestionBankHealthScore();
    const integrity = createQuestionBankIntegritySnapshot();
    const queryPlans = analyzeQuestionBankQueryPlans();
    const indexEffectiveness = verifyQuestionBankIndexEffectiveness();
    const dataset = questionBankDatasetProfile();

    const checks = [
      { id: "write-gate", label: "Yazma gÃ¼venliÄŸi", ok: Boolean(writeGate.writable),
        detail: writeGate.writable ? "Soru bankasÄ± yazma iÅŸlemlerine aÃ§Ä±k." : "Soru bankasÄ± gÃ¼venli mod/yazma kilidi altÄ±nda." },
      { id: "health", label: "SaÄŸlÄ±k puanÄ±", ok: Number(health.score || 0) >= 80,
        detail: `${Number(health.score || 0)}/100 â€¢ ${health.grade}` },
      { id: "missing-files", label: "Eksik fiziksel dosya", ok: Number(integrity.missingFiles || 0) === 0,
        detail: `${Number(integrity.missingFiles || 0)} eksik dosya` },
      { id: "failed-writes", label: "BaÅŸarÄ±sÄ±z yazma", ok: Number(integrity.failedWrites || 0) === 0,
        detail: `${Number(integrity.failedWrites || 0)} baÅŸarÄ±sÄ±z yazma` },
      { id: "query-plans", label: "Sorgu planlarÄ±", ok: Number(queryPlans.fullScanQueries || 0) === 0,
        detail: `${Number(queryPlans.fullScanQueries || 0)} kritik tam tarama` },
      { id: "indexes", label: "Ä°ndeks etkinliÄŸi", ok: Number(indexEffectiveness.score || 0) >= 80,
        detail: `${Number(indexEffectiveness.score || 0)}/100 â€¢ ${indexEffectiveness.grade}` },
    ];

    const failed = checks.filter((item) => !item.ok);
    const critical = checks.filter((item) =>
      !item.ok && ["write-gate", "missing-files", "failed-writes"].includes(item.id),
    );

    return {
      generatedAt: new Date().toISOString(),
      ready: critical.length === 0 && failed.length <= 1,
      status: critical.length > 0 ? "blocked" : failed.length > 1 ? "warning" : "ready",
      checks,
      failedCount: failed.length,
      criticalCount: critical.length,
      health: { score: health.score, grade: health.grade },
      dataset: { active: dataset.active, totalBytes: dataset.totalBytes, className: dataset.className },
      operatorMessage:
        critical.length > 0
          ? "Soru bankasÄ± Ã¼retim kullanÄ±mÄ±na aÃ§Ä±lmadan Ã¶nce kritik sorunlar giderilmelidir."
          : failed.length > 1
            ? "Soru bankasÄ± kullanÄ±labilir; ancak teknik bakÄ±m Ã¶neriliyor."
            : "Soru bankasÄ± Ã¼retim kullanÄ±mÄ± iÃ§in hazÄ±r gÃ¶rÃ¼nÃ¼yor.",
      technicalDetailsAvailable: true,
    };
  };

  const cleanupQuestionBankWriteJournal = (retentionDays = 30) => {
    const safeDays = Math.min(Math.max(Number(retentionDays) || 30, 7), 365);
    const cutoff = new Date(
      Date.now() - safeDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const removable = sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM question_bank_write_journal
      WHERE status IN ('committed', 'recovered')
        AND updated_at < ?
    `).get(cutoff) as any;

    sqlite.prepare(`
      DELETE FROM question_bank_write_journal
      WHERE status IN ('committed', 'recovered')
        AND updated_at < ?
    `).run(cutoff);

    return {
      retentionDays: safeDays,
      cutoff,
      removed: Number(removable?.count || 0),
    };
  };

  const questionImageUrl = (storagePath: string) =>
    `/api/question-bank/files/${storagePath.split("/").map(encodeURIComponent).join("/")}`;

  const questionThumbnailLocation = (questionId: string) => {
    const fileName = `${safeQuestionSegment(questionId, "question")}.jpg`;
    const storagePath = path.posix.join(".thumbs", fileName);
    return {
      fileName,
      storagePath,
      absolutePath: path.join(questionBankThumbnailRoot, fileName),
      thumbnailUrl: `/api/question-bank/thumbs/${encodeURIComponent(fileName)}`,
    };
  };

  const questionFileHash = (buffer: Buffer) =>
    crypto.createHash("sha256").update(buffer).digest("hex");

  const parseQuestionCodeOrder = (questionCode: string) => {
    const value = stripQuestionImageExtension(String(questionCode || "").trim());

    // Yeni kesin adlandırma:
    //   1.1.8__S001__A
    //   1.1.8__G01__S01__A
    const groupMatch = value.match(/(?:^|__)G\d{1,3}__S(\d{1,4})__([A-E])$/i);
    if (groupMatch) {
      return { order: Number(groupMatch[1] || 0), answer: String(groupMatch[2] || "").toUpperCase() };
    }
    const normalMatch = value.match(/(?:^|__)S(\d{1,6})__([A-E])$/i);
    if (normalMatch) {
      return { order: Number(normalMatch[1] || 0), answer: String(normalMatch[2] || "").toUpperCase() };
    }

    // Eski kayıtlarla geriye dönük uyumluluk.
    const legacyMatch = value.match(/_(\d+)_(?:G[A-Z0-9]+_)?([A-E])$/i);
    return {
      order: legacyMatch ? Number(legacyMatch[1]) : 0,
      answer: legacyMatch ? String(legacyMatch[2] || "").toUpperCase() : "",
    };
  };

  const recordQuestionAudit = (action: string, questionId: string, payload: any) => {
    const id = crypto.randomUUID();
    upsertDocument(QUESTION_BANK_AUDIT_COLLECTION, id, {
      id, questionId, action, payload, createdAt: new Date().toISOString(),
    });
  };


  const allQuestionUsage = () => listDocuments(QUESTION_BANK_USAGE_COLLECTION) as any[];
  const questionUsageSummary = (questionId: string) => {
    const usage = allQuestionUsage()
      .filter((item) => String(item.questionId || "") === String(questionId))
      .sort((a, b) => String(b.usedAt || "").localeCompare(String(a.usedAt || "")));
    return {
      useCount: usage.length,
      lastUsedAt: usage[0]?.usedAt || null,
      lastExamId: usage[0]?.examId || null,
      lastExamName: usage[0]?.examName || null,
    };
  };


  /*
   * Gxx VERİTABANI MİGRASYONU
   * -------------------------
   * Yeni kesin kural:
   *   - Aynı Gxx grubunda en az 3 numaralı kart varsa ilk sıra kartı yönergedir.
   *   - Yönerge gerçek soru değildir; questionIds içine girmez, cevap taşımaz,
   *     kullanım kilidi almaz ve normal soru listelerinde görünmez.
   *   - Kalan kartlar gerçek grup sorularıdır.
   *
   * Eski veritabanlarında ilk kart normal soru olarak kaydedilmiş olabildiği için
   * sunucu her açıldığında idempotent biçimde eski kayıtları bu modele taşır.
   * Gxx_METIN ile ayrı yönerge görseli bulunan eski gruplara dokunulmaz.
   */
  const migrateLegacyGxxQuestionGroups = () => {
    const rows = sqlite.prepare(`
      SELECT * FROM question_bank_questions
      WHERE status IN ('active', 'instruction')
    `).all() as any[];
    const records = rows.map(questionRowToRecord);
    const storedGroups = listQuestionGroupRecords();
    const storedGroupByMember = new Map<string, QuestionGroupRecord>();
    storedGroups.forEach((group) => {
      [group.instructionQuestionId, ...group.questionIds]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .forEach((id) => {
          if (!storedGroupByMember.has(id)) storedGroupByMember.set(id, group);
        });
    });

    const inferred = new Map<string, Array<{ record: any; token: string; order: number }>>();
    records.forEach((record: any) => {
      const parsed = inferredFileNameGroupParts(record);
      if (!parsed?.token) return;
      const scope = [
        record.grade,
        record.courseId,
        record.unitId,
        record.topicId,
        record.outcomeId,
      ].map((value) => String(value || "").trim()).join(":");
      const key = `${scope}:${parsed.token}`;
      const members = inferred.get(key) || [];
      members.push({
        record,
        token: String(parsed.token),
        order: Math.max(0, Number(parsed.order ?? record.order ?? 0)),
      });
      inferred.set(key, members);
    });

    const migratedInstructionIds = new Set<string>();
    let migratedGroups = 0;
    let migratedInstructions = 0;

    inferred.forEach((members, scopeKey) => {
      if (members.length < 3) return;
      const ordered = [...members].sort((left, right) =>
        left.order - right.order ||
        String(left.record.id || "").localeCompare(String(right.record.id || ""), "tr-TR", { numeric: true }),
      );
      const existingGroup = ordered
        .map((member) => storedGroupByMember.get(String(member.record.id || "")))
        .find(Boolean);

      // Yönerge görseli grup kaydında zaten ayrı tutuluyorsa bu grup yeni/doğru
      // modele geçmiştir. İlk gerçek soruyu yeniden yönergeye çevirmeye çalışma.
      if (existingGroup?.instructionImageUrl) return;

      const explicitInstruction = ordered.find((item) =>
        inferredFileNameGroupParts(item.record)?.isInstruction || item.record.status === "instruction",
      );
      // Modern S01+ cards are always real questions, even if S0_Y is missing.
      if (!explicitInstruction && ordered.some((item) => inferredFileNameGroupParts(item.record)?.modern)) return;
      const leader = (explicitInstruction || ordered[0])?.record;
      const printable = ordered.filter((item) => item.record !== leader).map((item) => item.record);
      if (!leader?.id || printable.length < 2) return;

      const instructionQuestionId = String(leader.id);
      const printableIds = printable.map((item) => String(item.id || "")).filter(Boolean);
      if (printableIds.length < 2) return;

      const groupId = String(existingGroup?.id || `filename-group-migrated:${scopeKey}`);
      const now = new Date().toISOString();
      const instructionImageUrl = String(existingGroup?.instructionImageUrl || leader.imageUrl || "").trim() ||
        (String(leader.storagePath || "").trim() ? questionImageUrl(String(leader.storagePath)) : "");

      const migratedGroup: QuestionGroupRecord = {
        id: groupId,
        mode: existingGroup?.mode || "required",
        layout: "full-width-source",
        title: existingGroup?.title,
        instructionText: existingGroup?.instructionText,
        instructionImageUrl: instructionImageUrl || undefined,
        instructionQuestionId,
        questionIds: printableIds,
        createdAt: existingGroup?.createdAt || now,
        updatedAt: now,
      };
      upsertDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(groupId), migratedGroup);

      // Aynı kartlar başka eski grup belgelerinde kalmasın.
      const memberSet = new Set([instructionQuestionId, ...printableIds]);
      storedGroups.forEach((group) => {
        if (group.id === groupId) return;
        const overlaps = [group.instructionQuestionId, ...group.questionIds]
          .some((id) => memberSet.has(String(id || "")));
        if (!overlaps) return;
        const nextIds = group.questionIds.filter((id) => !memberSet.has(String(id || "")));
        if (nextIds.length < 2) {
          deleteDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id));
        } else {
          upsertDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id), {
            ...group,
            instructionQuestionId: memberSet.has(String(group.instructionQuestionId || "")) ? undefined : group.instructionQuestionId,
            questionIds: nextIds,
            updatedAt: now,
          });
        }
      });

      if (String(leader.status || "active") !== "instruction" || String(leader.answer || "")) {
        const nextLeader = {
          ...leader,
          status: "instruction",
          answer: "",
          updatedAt: now,
        };
        persistQuestionBankRecord(nextLeader);
        syncQuestionBankIndexRecord(nextLeader);
        migratedInstructions += 1;
      }
      migratedInstructionIds.add(instructionQuestionId);

      printable.forEach((record: any) => {
        if (String(record.status || "active") === "active") return;
        const nextRecord = { ...record, status: "active", updatedAt: now };
        persistQuestionBankRecord(nextRecord);
        syncQuestionBankIndexRecord(nextRecord);
      });

      migratedGroups += 1;
    });

    // Yönergeler geçmişte soru gibi kilitlenmiş/kullanılmışsa serbest bırak.
    if (migratedInstructionIds.size > 0) {
      (listDocuments(QUESTION_BANK_USAGE_COLLECTION) as any[]).forEach((usage: any) => {
        if (migratedInstructionIds.has(String(usage?.questionId || ""))) {
          deleteDocument(QUESTION_BANK_USAGE_COLLECTION, String(usage.id));
        }
      });

      // Eski test/öğretmen görevlerinde yönerge soru listesine yazılmış olabilir.
      // Bu iki sunucu koleksiyonunda yönerge kimliklerini ve snapshot'larını temizle.
      ["teacherTestAssignments", "teacherTestAssignmentSelections"].forEach((collection) => {
        (listDocuments(collection) as any[]).forEach((document: any) => {
          const oldKeys = Array.isArray(document?.selectedQuestionKeys)
            ? document.selectedQuestionKeys.map(String)
            : [];
          const nextKeys = oldKeys.filter((id: string) => !migratedInstructionIds.has(id));
          const filterSnapshots = (rows: any) => Array.isArray(rows)
            ? rows.filter((question: any) => {
                const id = String(question?.questionId || question?.question_id || question?.id || question?.key || "");
                return !migratedInstructionIds.has(id);
              })
            : rows;
          const nextSelectedSnapshots = filterSnapshots(document?.selectedQuestionSnapshots);
          const nextAvailableSnapshots = filterSnapshots(document?.availableQuestionSnapshots);
          const changed =
            nextKeys.length !== oldKeys.length ||
            (Array.isArray(document?.selectedQuestionSnapshots) && nextSelectedSnapshots.length !== document.selectedQuestionSnapshots.length) ||
            (Array.isArray(document?.availableQuestionSnapshots) && nextAvailableSnapshots.length !== document.availableQuestionSnapshots.length);
          if (!changed || !document?.id) return;
          const removedCount = oldKeys.length - nextKeys.length;
          upsertDocument(collection, String(document.id), {
            ...document,
            selectedQuestionKeys: nextKeys,
            selectedQuestionSnapshots: nextSelectedSnapshots,
            availableQuestionSnapshots: nextAvailableSnapshots,
            selectedQuestionCount: Number.isFinite(Number(document?.selectedQuestionCount))
              ? Math.max(0, Number(document.selectedQuestionCount || 0) - removedCount)
              : document?.selectedQuestionCount,
            updatedAt: new Date().toISOString(),
          });
        });
      });

      migratedInstructionIds.forEach((questionId) => syncQuestionBankIndexById(questionId));
    }

    if (migratedGroups > 0 || migratedInstructions > 0) {
      console.log(`[Soru Bankası] Gxx migrasyonu: ${migratedGroups} grup, ${migratedInstructions} yönerge düzeltildi.`);
    }
    return { migratedGroups, migratedInstructions, instructionIds: [...migratedInstructionIds] };
  };

  try {
    migrateLegacyGxxQuestionGroups();
  } catch (error) {
    console.error("[Soru Bankası] Gxx veritabanı migrasyonu tamamlanamadı:", error);
  }

  // 29 Ekim 2026: Bir defaya mahsus eski yüklenmiş soru havuzunu sıfırla.
  // Müfredat belgeleri ve ders kayıtları bu işlemde kesinlikle değiştirilmez.
  const QUESTION_RESET_MARKER = "questions-reset-2026-10-29";
  const questionResetCompleted = Boolean(sqlite.prepare(
    "SELECT migration_key FROM edupanel_migrations WHERE migration_key = ? LIMIT 1",
  ).get(QUESTION_RESET_MARKER));
  if (!questionResetCompleted) {
    const count = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0);
    const legacyCount = listDocuments(QUESTION_BANK_COLLECTION).length;
    const hasQuestionFiles = fs.readdirSync(questionBankRoot).some((entry) => ![".trash", ".thumbs"].includes(entry))
      || fs.readdirSync(questionBankTrashRoot).length > 0 || fs.readdirSync(questionBankThumbnailRoot).length > 0;
    let archivedDirectory = "";
    let backupPath = "";
    if (count || legacyCount || hasQuestionFiles) {
      // Veritabanının tamamını yedekle; yalnız soru kayıtlarını temizle.
      backupPath = createBackup().path;
      archivedDirectory = path.join(path.dirname(backupPath), `question-bank-before-reset-20261029-${Date.now()}`);
      fs.renameSync(questionBankRoot, archivedDirectory);
      fs.mkdirSync(questionBankTrashRoot, { recursive: true });
      fs.mkdirSync(questionBankThumbnailRoot, { recursive: true });
    }
    try {
      sqlite.exec("BEGIN IMMEDIATE");
      sqlite.exec("DELETE FROM question_bank_questions; DELETE FROM question_bank_index;");
      const completedAt = new Date().toISOString();
      sqlite.prepare(`INSERT INTO edupanel_migrations (migration_key, applied_at, details)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE applied_at=VALUES(applied_at), details=VALUES(details)`).run(
        QUESTION_RESET_MARKER,
        completedAt,
        JSON.stringify({ clearedQuestionCount: count, clearedLegacyCount: legacyCount, backupPath, archivedDirectory }),
      );
      sqlite.exec("COMMIT");
      console.log(`[Soru Bankası] Önceki ${count} soru temizlendi. Müfredat korundu. Yedek: ${backupPath || "boş havuz"}`);
    } catch (error) {
      try { sqlite.exec("ROLLBACK"); } catch {}
      if (archivedDirectory && fs.existsSync(archivedDirectory)) {
        try {
          fs.rmSync(questionBankRoot, { recursive: true, force: true });
          fs.renameSync(archivedDirectory, questionBankRoot);
        } catch (restoreError) { console.error("Soru dosyaları geri taşınamadı:", restoreError); }
      }
      throw error;
    }
  }

  app.post(
    "/api/question-bank/images",
    express.raw({ type: ["image/jpeg", "image/png", "application/octet-stream"], limit: "20mb" }),
    (req, res) => {
      let tempFile = "";
      let absoluteFile = "";
      let writeJournalId = "";
      let id = "";
      let questionCode = "";

      try {
        const contentType = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
        const originalName = (() => {
          try { return decodeURIComponent(String(req.get("x-original-name") || "")); }
          catch { return ""; }
        })();
        const extension = questionImageExtension(contentType, originalName);
        if (!extension || !Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "YalnÄ±zca JPG, JPEG veya PNG soru gÃ¶rseli yÃ¼klenebilir." });
        }

        const decodeHeader = (name: string) => {
          try { return decodeURIComponent(String(req.get(name) || "")); }
          catch { return String(req.get(name) || ""); }
        };

        questionCode = decodeHeader("x-question-code");
        const metadata = {
          grade: Number(req.get("x-question-grade") || 0),
          courseId: decodeHeader("x-question-course"),
          unitId: decodeHeader("x-question-unit"),
          topicId: decodeHeader("x-question-topic"),
          outcomeId: decodeHeader("x-question-outcome"),
          questionCode,
        };

        const parsedIncoming = parseQuestionCodeOrder(questionCode);
        const incomingQuestionType = ["exam", "study"].includes(
          String(req.get("x-question-type") || "").toLowerCase(),
        )
          ? String(req.get("x-question-type") || "").toLowerCase()
          : "study";
        const incomingAnswer = String(
          req.get("x-question-answer") || parsedIncoming.answer || "",
        ).toUpperCase();
        const incomingRole = String(req.get("x-question-role") || "question").trim().toLowerCase();
        const isInstructionUpload = incomingRole === "instruction";
        const releaseInstructionUsage = (questionId: string) => {
          if (!questionId) return;
          (listDocuments(QUESTION_BANK_USAGE_COLLECTION) as any[])
            .filter((usage: any) => String(usage?.questionId || "") === String(questionId))
            .forEach((usage: any) => deleteDocument(QUESTION_BANK_USAGE_COLLECTION, String(usage.id)));
        };

        const contentHash = questionFileHash(req.body);
        const duplicatePool = isInstructionUpload
          ? allQuestionRecords().filter((record: any) => ["active", "instruction"].includes(String(record?.status || "active")))
          : activeQuestionRecords();
        const duplicate = duplicatePool.find(
          (record) => String(record.contentHash || "") === contentHash,
        );
        if (duplicate) {
          const sameTarget =
            Number(duplicate.grade || 0) === Number(metadata.grade || 0) &&
            String(duplicate.courseId || "") === String(metadata.courseId || "") &&
            String(duplicate.unitId || "") === String(metadata.unitId || "") &&
            String(duplicate.topicId || "") === String(metadata.topicId || "") &&
            String(duplicate.outcomeId || "") === String(metadata.outcomeId || "");

          if (sameTarget) {
            const normalizedOriginalName = String(originalName || "").trim();
            const desiredLocation = questionStorageLocation(metadata, extension);
            const oldStoragePath = safeStoredQuestionPath(duplicate.storagePath);
            let nextStoragePath = oldStoragePath || String(duplicate.storagePath || "");
            let nextFileName = String(duplicate.fileName || "");
            let nextImageUrl = String(duplicate.imageUrl || "");

            // Aynı soru yeni isim standardıyla tekrar yüklendiyse fiziksel dosyayı da
            // mümkünse yeni canonical ada taşı. Böylece eski kayıtları silmeden
            // S_001_A / G01_S01_A standardına geçiririz.
            if (oldStoragePath) {
              try {
                const sourceAbsolute = path.resolve(questionBankRoot, oldStoragePath);
                const targetAbsolute = path.resolve(questionBankRoot, desiredLocation.storagePath);
                if (sourceAbsolute !== targetAbsolute && fs.existsSync(sourceAbsolute)) {
                  fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });
                  if (!fs.existsSync(targetAbsolute)) {
                    fs.renameSync(sourceAbsolute, targetAbsolute);
                    nextStoragePath = desiredLocation.storagePath;
                    nextFileName = desiredLocation.fileName;
                    nextImageUrl = questionImageUrl(desiredLocation.storagePath);
                  }
                } else if (sourceAbsolute === targetAbsolute) {
                  nextStoragePath = desiredLocation.storagePath;
                  nextFileName = desiredLocation.fileName;
                  nextImageUrl = questionImageUrl(desiredLocation.storagePath);
                }
              } catch (renameError) {
                console.warn(`Mükerrer soru yeni canonical ada taşınamadı (${duplicate.id}); metadata yine güncelleniyor:`, renameError);
              }
            }

            const now = new Date().toISOString();
            const refreshedDuplicate = persistQuestionBankRecord({
              ...duplicate,
              questionCode: questionCode || duplicate.questionCode,
              questionType: incomingQuestionType,
              scopeLevel: metadata.outcomeId ? "outcome" : "topic",
              answer: isInstructionUpload ? "" : (incomingAnswer || duplicate.answer || ""),
              order: isInstructionUpload ? 0 : (parsedIncoming.order || Number(duplicate.order || 0)),
              fileName: nextFileName || duplicate.fileName,
              originalFileName: normalizedOriginalName || duplicate.originalFileName || "",
              storagePath: nextStoragePath || duplicate.storagePath,
              imageUrl: nextImageUrl || duplicate.imageUrl,
              status: isInstructionUpload ? "instruction" : "active",
              updatedAt: now,
            });
            if (isInstructionUpload) releaseInstructionUsage(String(refreshedDuplicate.id || duplicate.id || ""));
            syncQuestionBankIndexRecord(refreshedDuplicate);
            recordQuestionAudit("renamed", duplicate.id, {
              questionCode: refreshedDuplicate.questionCode,
              originalFileName: refreshedDuplicate.originalFileName,
              storagePath: refreshedDuplicate.storagePath,
            });

            return res.status(200).json({
              ...refreshedDuplicate,
              duplicate: true,
              skipped: true,
              relinked: false,
              renamed: true,
              instruction: isInstructionUpload,
              existing: refreshedDuplicate,
              message: "Bu soru bu hedefte zaten kayıtlıydı; yeni dosya adı standardına göre kaydı güncellendi, ikinci kopya oluşturulmadı.",
            });
          }

          // AynÄ± fiziksel gÃ¶rsel daha Ã¶nce farklÄ± bir mÃ¼fredat kimliÄŸiyle kaydedilmiÅŸse
          // ikinci kopya oluÅŸturmak yerine mevcut canonical kaydÄ± kullanÄ±cÄ±nÄ±n ÅŸu an
          // seÃ§tiÄŸi konu/kazanÄ±ma baÄŸlarÄ±z. BÃ¶ylece eski numaralandÄ±rmalar yÃ¼zÃ¼nden
          // soru bankasÄ±nda gÃ¶rÃ¼nmeyen kayÄ±tlar gÃ¼venli biÃ§imde gÃ¼ncel mÃ¼fredata taÅŸÄ±nÄ±r.
          const oldStoragePath = safeStoredQuestionPath(duplicate.storagePath);
          let nextStoragePath = oldStoragePath;
          let nextFileName = String(duplicate.fileName || "");
          let nextImageUrl = String(duplicate.imageUrl || "");

          if (oldStoragePath) {
            try {
              const sourceAbsolute = path.resolve(questionBankRoot, oldStoragePath);
              const duplicateExtension =
                path.extname(sourceAbsolute).toLowerCase() === ".png" ? "png" : extension;
              const desiredLocation = questionStorageLocation(metadata, duplicateExtension);
              const targetAbsolute = path.resolve(questionBankRoot, desiredLocation.storagePath);

              if (sourceAbsolute !== targetAbsolute && fs.existsSync(sourceAbsolute)) {
                fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });
                if (!fs.existsSync(targetAbsolute)) {
                  fs.renameSync(sourceAbsolute, targetAbsolute);
                  nextStoragePath = desiredLocation.storagePath;
                  nextFileName = desiredLocation.fileName;
                  nextImageUrl = questionImageUrl(desiredLocation.storagePath);
                }
              } else if (sourceAbsolute === targetAbsolute) {
                nextStoragePath = desiredLocation.storagePath;
                nextFileName = desiredLocation.fileName;
                nextImageUrl = questionImageUrl(desiredLocation.storagePath);
              }
            } catch (moveError) {
              console.warn(
                `MÃ¼kerrer soru fiziksel olarak yeni hedefe taÅŸÄ±namadÄ± (${duplicate.id}); metadata yeniden baÄŸlanÄ±yor:`,
                moveError,
              );
            }
          }

          const now = new Date().toISOString();
          const relinkedRecord = {
            ...duplicate,
            questionCode: questionCode || duplicate.questionCode,
            grade: Number(metadata.grade || duplicate.grade || 0),
            courseId: String(metadata.courseId || duplicate.courseId || ""),
            unitId: String(metadata.unitId || duplicate.unitId || ""),
            topicId: String(metadata.topicId || duplicate.topicId || ""),
            outcomeId: String(metadata.outcomeId || ""),
            questionType: incomingQuestionType,
            scopeLevel: metadata.outcomeId ? "outcome" : "topic",
            answer: isInstructionUpload ? "" : (incomingAnswer || duplicate.answer || ""),
            order: isInstructionUpload ? 0 : (parsedIncoming.order || Number(duplicate.order || 0)),
            fileName: nextFileName || duplicate.fileName,
            originalFileName: String(originalName || duplicate.originalFileName || ""),
            storagePath: nextStoragePath || duplicate.storagePath,
            imageUrl: nextImageUrl || duplicate.imageUrl,
            status: isInstructionUpload ? "instruction" : "active",
            updatedAt: now,
          };

          persistQuestionBankRecord(relinkedRecord);
          if (isInstructionUpload) releaseInstructionUsage(String(relinkedRecord.id || duplicate.id || ""));
          syncQuestionBankIndexRecord(relinkedRecord);
          recordQuestionAudit("relinked", duplicate.id, {
            from: {
              grade: duplicate.grade,
              courseId: duplicate.courseId,
              unitId: duplicate.unitId,
              topicId: duplicate.topicId,
              outcomeId: duplicate.outcomeId,
            },
            to: {
              grade: relinkedRecord.grade,
              courseId: relinkedRecord.courseId,
              unitId: relinkedRecord.unitId,
              topicId: relinkedRecord.topicId,
              outcomeId: relinkedRecord.outcomeId,
            },
            questionCode: relinkedRecord.questionCode,
          });

          return res.status(200).json({
            ...relinkedRecord,
            duplicate: true,
            skipped: false,
            relinked: true,
            instruction: isInstructionUpload,
            existing: duplicate,
            message: "Mevcut soru yeni mÃ¼fredat hedefine baÄŸlandÄ±; ikinci kopya oluÅŸturulmadÄ±.",
          });
        }

        id = crypto.randomUUID();

        let location = questionStorageLocation(metadata, extension);
        absoluteFile = path.join(questionBankRoot, ...location.storagePath.split("/"));
        if (fs.existsSync(absoluteFile)) {
          // Archived or orphaned files may still be referenced by old tests.
          // Keep them and allocate a separate path for the new record.
          const relativeDir = path.posix.join(location.relativeDir, id);
          location = { ...location, relativeDir, storagePath: path.posix.join(relativeDir, location.fileName) };
          absoluteFile = path.join(questionBankRoot, ...location.storagePath.split("/"));
        }
        const absoluteDir = path.dirname(absoluteFile);
        fs.mkdirSync(absoluteDir, { recursive: true });

        tempFile = path.join(
          absoluteDir,
          `.${location.fileName}.${crypto.randomBytes(8).toString("hex")}.tmp`,
        );

        writeJournalId = beginQuestionBankWriteJournal({
          operation: "create-question",
          questionId: id,
          questionCode,
          targetPath: location.storagePath,
          tempPath: tempFile,
        });

        fs.writeFileSync(tempFile, req.body, { flag: "wx" });
        fs.renameSync(tempFile, absoluteFile);
        tempFile = "";

        const parsed = parseQuestionCodeOrder(questionCode);
        const now = new Date().toISOString();

        const record = {
          id,
          questionCode,
          grade: Number(req.get("x-question-grade") || 0),
          courseId: decodeHeader("x-question-course"),
          unitId: decodeHeader("x-question-unit"),
          topicId: decodeHeader("x-question-topic"),
          outcomeId: decodeHeader("x-question-outcome"),
          questionType: ["exam", "study"].includes(String(req.get("x-question-type") || "").toLowerCase())
            ? String(req.get("x-question-type") || "").toLowerCase()
            : "study",
          scopeLevel: decodeHeader("x-question-outcome") ? "outcome" : "topic",
          answer: isInstructionUpload ? "" : String(req.get("x-question-answer") || parsed.answer || "").toUpperCase(),
          order: isInstructionUpload ? 0 : parsed.order,
          fileName: location.fileName,
          originalFileName: String(originalName || location.fileName),
          storagePath: location.storagePath,
          imageUrl: questionImageUrl(location.storagePath),
          contentHash,
          mimeType: extension === "png" ? "image/png" : "image/jpeg",
          sizeBytes: req.body.length,
          importSessionId: String(req.get("x-question-import-session") || "").trim() || null,
          status: isInstructionUpload ? "instruction" : "active",
          createdAt: now,
          updatedAt: now,
        };

        persistQuestionBankRecord(record);
        syncQuestionBankIndexRecord(record);

        updateQuestionBankWriteJournal(writeJournalId, {
          status: "committed",
          targetPath: location.storagePath,
          tempPath: null,
          committedAt: new Date().toISOString(),
          error: null,
        });

        recordQuestionAudit(isInstructionUpload ? "created-instruction" : "created", id, {
          questionCode: record.questionCode,
          storagePath: record.storagePath,
          contentHash,
          writeJournalId,
        });

        return res.status(201).json({ ...record, instruction: isInstructionUpload });
      } catch (error) {
        if (tempFile && fs.existsSync(tempFile)) {
          try { fs.unlinkSync(tempFile); } catch {}
        }

        if (writeJournalId) {
          updateQuestionBankWriteJournal(writeJournalId, {
            status: "failed",
            tempPath: tempFile || null,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // EÄŸer metadata yazÄ±lmadÄ±ysa fakat hedef dosya oluÅŸtuysa otomatik
        // recovery'nin temizleyebilmesi iÃ§in journal hedef yolu korunur.
        console.error("Soru bankasÄ± gÃ¶rsel yÃ¼kleme hatasÄ±:", error);
        return res.status(500).json({
          error: "Soru gÃ¶rseli dosya deposuna kaydedilemedi.",
          writeJournalId: writeJournalId || null,
        });
      }
    },
  );

  app.post(
    "/api/question-bank/thumbnails/:questionId",
    express.raw({ type: ["image/jpeg", "image/png", "application/octet-stream"], limit: "2mb" }),
    (req, res) => {
      try {
        const questionId = String(req.params.questionId || "").trim();
        if (!questionId || !Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ error: "Thumbnail verisi geÃ§ersiz." });
        }

        const record = allQuestionRecords().find(
          (item) => String(item.id || "") === questionId,
        );
        if (!record) {
          return res.status(404).json({ error: "Soru kaydÄ± bulunamadÄ±." });
        }

        const location = questionThumbnailLocation(questionId);
        const temp = `${location.absolutePath}.${crypto.randomBytes(5).toString("hex")}.tmp`;
        fs.writeFileSync(temp, req.body, { flag: "wx" });
        fs.renameSync(temp, location.absolutePath);

        const next = {
          ...record,
          thumbnailPath: location.storagePath,
          thumbnailUrl: location.thumbnailUrl,
          thumbnailSizeBytes: req.body.length,
          thumbnailUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persistQuestionBankRecord(next);
        syncQuestionBankIndexRecord(next);

        return res.status(201).json({
          questionId,
          thumbnailPath: location.storagePath,
          thumbnailUrl: location.thumbnailUrl,
          thumbnailSizeBytes: req.body.length,
        });
      } catch (error) {
        console.error("Soru thumbnail yÃ¼kleme hatasÄ±:", error);
        return res.status(500).json({ error: "Soru thumbnail kaydedilemedi." });
      }
    },
  );

  app.post("/api/question-bank/images/move", (req, res) => {
    try {
      const sourceStoragePath = safeStoredQuestionPath(req.body?.storagePath);
      if (!sourceStoragePath) return res.status(400).json({ error: "Soru dosya yolu geÃ§ersiz." });
      const sourceAbsolute = path.resolve(questionBankRoot, sourceStoragePath);
      if (!fs.existsSync(sourceAbsolute)) return res.status(404).json({ error: "TaÅŸÄ±nacak soru gÃ¶rseli bulunamadÄ±." });

      const existingRecord = findQuestionRecordByStoragePath(sourceStoragePath);
      const extension = path.extname(sourceAbsolute).toLowerCase() === ".png" ? "png" : "jpg";
      const location = questionStorageLocation(req.body || {}, extension);
      const targetAbsolute = path.resolve(questionBankRoot, location.storagePath);
      fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });

      if (sourceAbsolute !== targetAbsolute) {
        if (fs.existsSync(targetAbsolute)) return res.status(409).json({ error: "Hedef soru kodunda zaten bir gÃ¶rsel var." });
        fs.renameSync(sourceAbsolute, targetAbsolute);
      }

      const now = new Date().toISOString();
      const parsed = parseQuestionCodeOrder(String(req.body?.questionCode || ""));
      if (existingRecord) {
        const nextRecord = {
          ...existingRecord,
          questionCode: String(req.body?.questionCode || existingRecord.questionCode || ""),
          grade: Number(req.body?.grade || existingRecord.grade || 0),
          courseId: String(req.body?.courseId || existingRecord.courseId || ""),
          unitId: String(req.body?.unitId || existingRecord.unitId || ""),
          topicId: String(req.body?.topicId || existingRecord.topicId || ""),
          outcomeId: String(req.body?.outcomeId || existingRecord.outcomeId || ""),
          questionType: ["exam", "study"].includes(String(req.body?.questionType || "").toLowerCase())
            ? String(req.body.questionType).toLowerCase()
            : String(existingRecord.questionType || "study"),
          scopeLevel: String(req.body?.outcomeId || existingRecord.outcomeId || "") ? "outcome" : "topic",
          answer: String(req.body?.answer || parsed.answer || existingRecord.answer || "").toUpperCase(),
          order: parsed.order || Number(existingRecord.order || 0),
          fileName: location.fileName,
          storagePath: location.storagePath,
          imageUrl: questionImageUrl(location.storagePath),
          updatedAt: now,
        };
        persistQuestionBankRecord(nextRecord);
        syncQuestionBankIndexRecord(nextRecord);
        recordQuestionAudit("moved", existingRecord.id, {
          from: sourceStoragePath,
          to: location.storagePath,
          questionCode: nextRecord.questionCode,
          outcomeId: nextRecord.outcomeId,
        });
        return res.json(nextRecord);
      }

      return res.json({
        fileName: location.fileName,
        storagePath: location.storagePath,
        imageUrl: questionImageUrl(location.storagePath),
      });
    } catch (error) {
      console.error("Soru bankasÄ± taÅŸÄ±ma hatasÄ±:", error);
      return res.status(500).json({ error: "Soru gÃ¶rseli taÅŸÄ±namadÄ±." });
    }
  });

  const questionSnapshotIdentity = (question: any) =>
    String(
      question?.questionId ||
        question?.question_id ||
        question?.id ||
        question?.key ||
        "",
    ).trim();

  const questionSnapshotFileGroupParts = (question: any) => {
    const explicitOrder = question?.questionGroupOrder ?? question?.groupOrder;
    const groupId = String(question?.questionGroupId || question?.groupId || "").trim();
    if (groupId && explicitOrder !== undefined && explicitOrder !== null && explicitOrder !== "") {
      return { groupId, order: Math.max(0, Number(explicitOrder || 0)) };
    }
    const candidates = [
      question?.originalFileName,
      question?.original_file_name,
      question?.fileName,
      question?.file_name,
      question?.questionCode,
      question?.question_code,
      question?.code,
    ];
    for (const candidate of candidates) {
      const stem = stripQuestionImageExtension(candidate);
      const newStyle = stem.match(/(?:^|__|_)(G\d{1,3})(?:__|_)S[_-]?(\d+)(?:__|_)([A-E])$/i);
      const legacy = stem.match(/(?:^|_)(\d+)_(G[A-Z0-9]+)_([A-E])$/i);
      if (!newStyle && !legacy) continue;
      const tokenRaw = newStyle ? newStyle[1] : legacy?.[2];
      const orderRaw = newStyle ? newStyle[2] : legacy?.[1];
      const tokenNumber = Number(String(tokenRaw || "").replace(/\D/g, ""));
      const token = Number.isFinite(tokenNumber) && tokenNumber > 0
        ? `G${String(tokenNumber).padStart(2, "0")}`
        : String(tokenRaw || "").toUpperCase();
      const scope = [
        question?.courseId || question?.course_id || "",
        question?.unitId || question?.unit_id || "",
        question?.topicId || question?.topic_id || "",
        question?.outcomeId || question?.outcome_id || "",
      ].map((value: unknown) => String(value || "").trim()).join(":");
      return {
        groupId: groupId || `filename-group-fallback:${scope}:${token}`,
        order: Math.max(0, Number(orderRaw || 0)),
      };
    }
    return null;
  };

  const effectiveSelectedQuestionCount = (keys: string[], snapshotMap: Map<string, any>) => {
    const selectedSnapshots = keys
      .map((key) => snapshotMap.get(String(key)))
      .filter(Boolean);
    const leaderKeys = new Set<string>();
    const groups = new Map<string, any[]>();
    selectedSnapshots.forEach((question: any) => {
      const parsed = questionSnapshotFileGroupParts(question);
      if (!parsed?.groupId) return;
      const members = groups.get(parsed.groupId) || [];
      members.push(question);
      groups.set(parsed.groupId, members);
    });
    groups.forEach((members, groupId) => {
      if (!groupId || members.length < 2) return;
      const hasSeparateInstruction = members.some((question: any) =>
        Boolean(String(question?.questionGroupInstructionImageUrl || "").trim()),
      );
      if (hasSeparateInstruction) return;
      const leader = [...members].sort((left, right) => {
        const leftOrder = questionSnapshotFileGroupParts(left)?.order || 0;
        const rightOrder = questionSnapshotFileGroupParts(right)?.order || 0;
        return leftOrder - rightOrder || questionSnapshotIdentity(left).localeCompare(questionSnapshotIdentity(right));
      })[0];
      const leaderKey = questionSnapshotIdentity(leader);
      if (leaderKey) leaderKeys.add(leaderKey);
    });
    return keys.filter((key) => !leaderKeys.has(String(key))).length;
  };

  const questionProtectionSummary = (questionId: string) => {
    const usageRecords = allQuestionUsage().filter(
      (item: any) => String(item?.questionId || "") === String(questionId),
    );

    const assignmentRefs = listDocuments("teacherTestAssignments").filter(
      (assignment: any) => {
        const keys = Array.isArray(assignment?.selectedQuestionKeys)
          ? assignment.selectedQuestionKeys.map(String)
          : [];
        const available = Array.isArray(assignment?.availableQuestionSnapshots)
          ? assignment.availableQuestionSnapshots
          : [];
        const selected = Array.isArray(assignment?.selectedQuestionSnapshots)
          ? assignment.selectedQuestionSnapshots
          : [];
        return (
          keys.includes(String(questionId)) ||
          available.some(
            (question: any) =>
              questionSnapshotIdentity(question) === String(questionId),
          ) ||
          selected.some(
            (question: any) =>
              questionSnapshotIdentity(question) === String(questionId),
          )
        );
      },
    );

    const teacherSelectionRefs = listDocuments(
      "teacherTestAssignmentSelections",
    ).filter((selection: any) => {
      const keys = Array.isArray(selection?.selectedQuestionKeys)
        ? selection.selectedQuestionKeys.map(String)
        : [];
      const snapshots = Array.isArray(selection?.selectedQuestionSnapshots)
        ? selection.selectedQuestionSnapshots
        : [];
      return (
        keys.includes(String(questionId)) ||
        snapshots.some(
          (question: any) =>
            questionSnapshotIdentity(question) === String(questionId),
        )
      );
    });

    return {
      useCount: usageRecords.length,
      teacherAssignmentCount: assignmentRefs.length,
      teacherSelectionCount: teacherSelectionRefs.length,
      protected:
        usageRecords.length > 0 ||
        assignmentRefs.length > 0 ||
        teacherSelectionRefs.length > 0,
    };
  };

  const deleteCanonicalQuestionById = (questionId: string) => {
    const record = allQuestionRecords().find(
      (item) => String(item.id || "") === String(questionId),
    );
    if (!record) {
      return { found: false, success: false, questionId };
    }

    const protection = questionProtectionSummary(questionId);

    if (String(record.status || "active") === "deleted") {
      return {
        found: true,
        success: true,
        alreadyDeleted: true,
        archived: true,
        questionId,
        physicalFileRetained: true,
        protection,
      };
    }

    const deletedAt = new Date().toISOString();

    /*
     * NORMAL SÄ°LME = SOFT DELETE / ARÅÄ°VLEME
     *
     * Fiziksel gÃ¶rsel ve thumbnail yerinde kalÄ±r.
     * BÃ¶ylece:
     * - geÃ§miÅŸ test snapshot'larÄ± bozulmaz,
     * - daha Ã¶nce Ã¶ÄŸretmene gÃ¶nderilmiÅŸ telefon gÃ¶revi bozulmaz,
     * - yalnÄ±z yeni havuzlarda status='deleted' nedeniyle gÃ¶rÃ¼nmez.
     */
    const next = {
      ...record,
      status: "deleted",
      deletedAt,
      archivedAt: deletedAt,
      archiveReason: "question-bank-soft-delete",
      updatedAt: deletedAt,
    };

    persistQuestionBankRecord(next);
    syncQuestionBankIndexRecord(next);
    recordQuestionAudit("archived", record.id, {
      source: "canonical-question-id",
      physicalFileRetained: true,
      protection,
    });

    return {
      found: true,
      success: true,
      archived: true,
      questionId: String(record.id),
      physicalFileRetained: true,
      protection,
    };
  };

  app.post("/api/question-bank/groups", (req, res) => {
    try {
      const rawQuestionIds = Array.isArray(req.body?.questionIds) ? req.body.questionIds : [];
      let questionIds = [...new Set(rawQuestionIds.map((value: any) => String(value || "").trim()).filter(Boolean))];
      if (questionIds.length < 2) {
        return res.status(400).json({ error: "Soru grubu için en az iki soru seçilmelidir." });
      }
      if (questionIds.length > 50) {
        return res.status(400).json({ error: "Bir soru grubunda en fazla 50 soru olabilir." });
      }

      const rowsById = new Map<string, any>();
      (sqlite.prepare(`SELECT * FROM question_bank_questions WHERE status IN ('active', 'instruction')`).all() as any[])
        .forEach((row: any) => rowsById.set(String(row?.question_id || ""), questionRowToRecord(row)));
      const missing = questionIds.filter((id: string) => !rowsById.has(id));
      if (missing.length) {
        return res.status(404).json({
          error: `Soru bankasında bulunamayan grup soruları var: ${missing.slice(0, 5).join(", ")}`,
          missingQuestionIds: missing,
        });
      }

      const requestedGroupId = String(req.body?.groupId || req.body?.id || "").trim();
      const groupId = requestedGroupId || `qg-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const previous = listQuestionGroupRecords().find((group) => group.id === groupId);

      let instructionImageUrl = String(req.body?.instructionImageUrl || previous?.instructionImageUrl || "").trim();
      let instructionQuestionId = String(req.body?.instructionQuestionId || previous?.instructionQuestionId || "").trim();

      // Yeni modelde yönerge ayrı bir instruction kaydıdır; gerçek soru listesinde
      // aynı kimlik eski kayıttan kalmış olsa bile kesinlikle tutulmaz.
      if (instructionQuestionId) {
        questionIds = questionIds.filter((id) => id !== instructionQuestionId);
      }

      /*
       * Gxx VERİTABANI KURALI:
       * Ayrı bir Gxx_METIN yönergesi yoksa ve aynı Gxx grubunda en az üç numaralı
       * kart varsa, sıra numarası en küçük ilk kart yönergedir. Bu kayıt gerçek
       * soru listesinden çıkarılır; görseli grup kaydının instructionImageUrl
       * alanına taşınır. Böylece yönerge cevap anahtarı / soru sayısı / kullanım
       * kilidi gibi gerçek soru işlemlerine hiçbir zaman karışmaz.
       */
      const candidateRecords = questionIds.map((id) => rowsById.get(id)).filter(Boolean);
      const parsedCandidates = candidateRecords
        .map((record: any) => ({ record, parsed: inferredFileNameGroupParts(record) }))
        .filter((item: any) => item.parsed?.token);
      const tokens = new Set(parsedCandidates.map((item: any) => String(item.parsed.token || "")));
      const canInferFirstCardInstruction =
        !instructionImageUrl &&
        !instructionQuestionId &&
        questionIds.length >= 3 &&
        parsedCandidates.length === questionIds.length &&
        tokens.size === 1 &&
        !parsedCandidates.some((item: any) => item.parsed.modern);

      if (canInferFirstCardInstruction) {
        const ordered = [...parsedCandidates].sort((left: any, right: any) =>
          Number(left.parsed.order || left.record.order || 0) - Number(right.parsed.order || right.record.order || 0) ||
          String(left.record.id || "").localeCompare(String(right.record.id || ""), "tr-TR", { numeric: true }),
        );
        const leader = ordered[0]?.record;
        if (leader?.id && ordered.length >= 3) {
          instructionQuestionId = String(leader.id);
          instructionImageUrl = String(leader.imageUrl || "").trim() ||
            (String(leader.storagePath || "").trim() ? questionImageUrl(String(leader.storagePath)) : "");
          questionIds = ordered.slice(1).map((item: any) => String(item.record.id || "")).filter(Boolean);

          const nextLeader = {
            ...leader,
            status: "instruction",
            answer: "",
            updatedAt: now,
          };
          persistQuestionBankRecord(nextLeader);
          syncQuestionBankIndexRecord(nextLeader);

          // Yönerge geçmişte yanlışlıkla soru gibi kullanılmışsa bu kullanım
          // kayıtlarını temizle; yönerge başka testlerde "kullanılmış soru" sayılmasın.
          (listDocuments(QUESTION_BANK_USAGE_COLLECTION) as any[])
            .filter((usage: any) => String(usage?.questionId || "") === instructionQuestionId)
            .forEach((usage: any) => deleteDocument(QUESTION_BANK_USAGE_COLLECTION, String(usage.id)));
          syncQuestionBankIndexRecord(nextLeader);
        }
      }

      if (questionIds.length < 2) {
        return res.status(400).json({ error: "Yönergeden sonra en az iki gerçek grup sorusu bulunmalıdır." });
      }

      const allMemberIds = new Set([instructionQuestionId, ...questionIds].filter(Boolean));

      // Bir soru aynı anda iki farklı yönerge grubunda kalmasın. Yeni gruba alınan
      // kayıtları eski gruplardan otomatik çıkar; eski grup iki gerçek sorunun altına düşerse kaldır.
      listQuestionGroupRecords().forEach((group) => {
        if (group.id === groupId) return;
        const nextIds = group.questionIds.filter((id) => !allMemberIds.has(id));
        const nextInstructionQuestionId = allMemberIds.has(String(group.instructionQuestionId || ""))
          ? ""
          : String(group.instructionQuestionId || "");
        if (nextIds.length === group.questionIds.length && nextInstructionQuestionId === String(group.instructionQuestionId || "")) return;
        if (nextIds.length < 2) deleteDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id));
        else upsertDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(group.id), {
          ...group,
          questionIds: nextIds,
          instructionQuestionId: nextInstructionQuestionId || undefined,
          updatedAt: now,
        });
      });

      // Daha önce yanlışlıkla "instruction" durumuna alınmış gerçek grup soruları
      // varsa yeniden aktif hale getir.
      questionIds.forEach((questionId) => {
        const record = rowsById.get(questionId);
        if (!record || String(record.status || "active") === "active") return;
        const nextRecord = { ...record, status: "active", updatedAt: now };
        persistQuestionBankRecord(nextRecord);
        syncQuestionBankIndexRecord(nextRecord);
      });

      const group: QuestionGroupRecord = {
        id: groupId,
        mode: String(req.body?.mode || previous?.mode || "required").toLowerCase() === "free" ? "free" : "required",
        layout: instructionImageUrl
          ? "full-width-source"
          : String(req.body?.layout || previous?.layout || "normal").toLowerCase() === "full-width-source"
            ? "full-width-source"
            : "normal",
        title: String(req.body?.title || previous?.title || "").trim().slice(0, 240) || undefined,
        instructionText: String(req.body?.instructionText || previous?.instructionText || "").trim().slice(0, 20000) || undefined,
        instructionImageUrl: instructionImageUrl || undefined,
        instructionQuestionId: instructionQuestionId || undefined,
        questionIds,
        createdAt: String(previous?.createdAt || now),
        updatedAt: now,
      };
      upsertDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(groupId), group);
      return res.json({ success: true, group });
    } catch (error) {
      console.error("Soru grubu kaydedilemedi:", error);
      return res.status(500).json({ error: "Soru grubu kaydedilemedi." });
    }
  });

  app.get("/api/question-bank/groups/:id", (req, res) => {
    const id = String(req.params.id || "").trim();
    const group = listQuestionGroupRecords().find((item) => item.id === id);
    if (!group) return res.status(404).json({ error: "Soru grubu bulunamadı." });
    return res.json({ group });
  });

  app.delete("/api/question-bank/groups/:id", (req, res) => {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "Soru grubu kimliği zorunludur." });
    deleteDocument(QUESTION_BANK_GROUP_COLLECTION, questionGroupDocumentId(id));
    return res.json({ success: true, groupId: id });
  });

  app.get("/api/question-bank/questions/:id/protection", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        return res.status(400).json({ error: "Soru kimliÄŸi zorunludur." });
      }
      const record = allQuestionRecords().find(
        (item) => String(item.id || "") === id,
      );
      if (!record) {
        return res.status(404).json({ error: "Soru kaydÄ± bulunamadÄ±." });
      }
      return res.json({
        questionId: id,
        status: String(record.status || "active"),
        ...questionProtectionSummary(id),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Soru kullanÄ±m korumasÄ± okunamadÄ±." });
    }
  });

  app.patch("/api/question-bank/questions/:id/answer", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const answer = String(req.body?.answer || "").trim().toUpperCase();
      if (!id) return res.status(400).json({ error: "Soru kimliği zorunludur." });
      if (!/^[A-E]$/.test(answer)) {
        return res.status(400).json({ error: "Doğru cevap A, B, C, D veya E olmalıdır." });
      }

      const record = allQuestionRecords().find(
        (item: any) => String(item?.id || "") === id,
      );
      if (!record) return res.status(404).json({ error: "Soru kaydı bulunamadı." });

      const previousAnswer = String(record?.answer || "").trim().toUpperCase();
      const now = new Date().toISOString();
      const next = {
        ...record,
        answer,
        updatedAt: now,
      };
      persistQuestionBankRecord(next);
      syncQuestionBankIndexRecord(next);

      // Açık öğretmen görevlerinde aynı sorunun eski cevabı snapshot olarak
      // kalırsa masaüstündeki düzeltme tekrar eski cevaba dönebiliyordu. Aynı
      // kanonik sorunun bütün görev snapshot'larını da eşitliyoruz.
      const patchSnapshots = (rows: any) => {
        let changed = false;
        const nextRows = (Array.isArray(rows) ? rows : []).map((question: any) => {
          if (questionSnapshotIdentity(question) !== id) return question;
          changed = true;
          return {
            ...question,
            answer,
            correctAnswer: answer,
            correct_answer: answer,
            answerUpdatedAt: now,
          };
        });
        return { changed, rows: nextRows };
      };

      listDocuments("teacherTestAssignments").forEach((assignment: any) => {
        const available = patchSnapshots(assignment?.availableQuestionSnapshots);
        const selected = patchSnapshots(assignment?.selectedQuestionSnapshots);
        if (!available.changed && !selected.changed) return;
        upsertDocument("teacherTestAssignments", String(assignment.id), {
          ...assignment,
          availableQuestionSnapshots: available.rows,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      listDocuments("teacherTestAssignmentSelections").forEach((selection: any) => {
        const selected = patchSnapshots(selection?.selectedQuestionSnapshots);
        if (!selected.changed) return;
        upsertDocument("teacherTestAssignmentSelections", String(selection.id), {
          ...selection,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      recordQuestionAudit("answer-updated", id, {
        previousAnswer,
        answer,
        source: "question-manager",
      });

      return res.json({
        success: true,
        questionId: id,
        previousAnswer,
        answer,
        updatedAt: now,
      });
    } catch (error) {
      console.error("Soru doğru cevabı güncellenemedi:", error);
      return res.status(500).json({ error: "Soru doğru cevabı güncellenemedi." });
    }
  });

  app.patch("/api/question-bank/questions/:id/column-span", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const columnSpan = Number(req.body?.columnSpan) === 2 ? 2 : 1;
      if (!id) return res.status(400).json({ error: "Soru kimliği zorunludur." });

      const record = allQuestionRecords().find(
        (item: any) => String(item?.id || "") === id,
      );
      if (!record) return res.status(404).json({ error: "Soru kaydı bulunamadı." });

      const previousColumnSpan = Number(record?.columnSpan || 1) === 2 ? 2 : 1;
      const now = new Date().toISOString();
      const next = {
        ...record,
        columnSpan,
        updatedAt: now,
      };
      persistQuestionBankRecord(next);
      syncQuestionBankIndexRecord(next);

      const patchSnapshots = (rows: any) => {
        let changed = false;
        const nextRows = (Array.isArray(rows) ? rows : []).map((question: any) => {
          if (questionSnapshotIdentity(question) !== id) return question;
          changed = true;
          return {
            ...question,
            columnSpan,
            columnSpanUpdatedAt: now,
          };
        });
        return { changed, rows: nextRows };
      };

      listDocuments("teacherTestAssignments").forEach((assignment: any) => {
        const available = patchSnapshots(assignment?.availableQuestionSnapshots);
        const selected = patchSnapshots(assignment?.selectedQuestionSnapshots);
        if (!available.changed && !selected.changed) return;
        upsertDocument("teacherTestAssignments", String(assignment.id), {
          ...assignment,
          availableQuestionSnapshots: available.rows,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      listDocuments("teacherTestAssignmentSelections").forEach((selection: any) => {
        const selected = patchSnapshots(selection?.selectedQuestionSnapshots);
        if (!selected.changed) return;
        upsertDocument("teacherTestAssignmentSelections", String(selection.id), {
          ...selection,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      recordQuestionAudit("column-span-updated", id, {
        previousColumnSpan,
        columnSpan,
        source: "question-manager",
      });

      return res.json({
        success: true,
        questionId: id,
        previousColumnSpan,
        columnSpan,
        updatedAt: now,
      });
    } catch (error) {
      console.error("Soru sütun genişliği güncellenemedi:", error);
      return res.status(500).json({ error: "Soru sütun genişliği güncellenemedi." });
    }
  });

  app.patch("/api/question-bank/questions/:id/curriculum", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ error: "Soru kimliği zorunludur." });

      const record = allQuestionRecords().find(
        (item: any) => String(item?.id || "") === id,
      );
      if (!record) return res.status(404).json({ error: "Soru kaydı bulunamadı." });

      const hasOwn = (key: string) =>
        Object.prototype.hasOwnProperty.call(req.body || {}, key);

      const grade = hasOwn("grade")
        ? Number(req.body?.grade || 0)
        : Number(record?.grade || 0);
      const courseId = hasOwn("courseId")
        ? String(req.body?.courseId || "").trim()
        : String(record?.courseId || "").trim();
      const unitId = hasOwn("unitId")
        ? String(req.body?.unitId || "").trim()
        : String(record?.unitId || "").trim();
      const topicId = hasOwn("topicId")
        ? String(req.body?.topicId || "").trim()
        : String(record?.topicId || "").trim();
      const outcomeId = hasOwn("outcomeId")
        ? String(req.body?.outcomeId || "").trim()
        : String(record?.outcomeId || "").trim();

      const unitName = String(req.body?.unitName || "").trim();
      const topicName = String(req.body?.topicName || "").trim();
      const outcomeName = String(req.body?.outcomeName || "").trim();

      const scopeLevel = outcomeId
        ? "outcome"
        : topicId
          ? "topic"
          : unitId
            ? "unit"
            : "course";
      const now = new Date().toISOString();

      const previous = {
        grade: Number(record?.grade || 0),
        courseId: String(record?.courseId || ""),
        unitId: String(record?.unitId || ""),
        topicId: String(record?.topicId || ""),
        outcomeId: String(record?.outcomeId || ""),
      };

      const next = {
        ...record,
        grade,
        courseId,
        unitId,
        topicId,
        outcomeId,
        scopeLevel,
        unitName,
        topicName,
        outcomeName,
        curriculumUpdatedAt: now,
        updatedAt: now,
      };

      persistQuestionBankRecord(next);
      syncQuestionBankIndexRecord(next);

      // Öğretmen görevlerindeki snapshot'lar birkaç saniyede bir masaüstüne
      // geri aktarıldığı için burada da aynı müfredat bilgisini güncelliyoruz.
      // Böylece yönetici tarafından düzeltilen konu/kazanım eski snapshot ile
      // tekrar silinemez.
      const patchSnapshots = (rows: any) => {
        let changed = false;
        const nextRows = (Array.isArray(rows) ? rows : []).map((question: any) => {
          if (questionSnapshotIdentity(question) !== id) return question;
          changed = true;
          return {
            ...question,
            grade,
            courseId,
            course_id: courseId,
            systemCourseId: courseId,
            unitId,
            unit_id: unitId,
            systemUnitId: unitId,
            topicId,
            topic_id: topicId,
            systemTopicId: topicId,
            outcomeId,
            outcome_id: outcomeId,
            systemOutcomeId: outcomeId,
            unit: unitName,
            unitName,
            unit_name: unitName,
            topic: topicName,
            topicName,
            topic_name: topicName,
            outcome: outcomeName,
            outcomeName,
            outcome_name: outcomeName,
            curriculumManuallyCorrected: true,
            curriculumUpdatedAt: now,
          };
        });
        return { changed, rows: nextRows };
      };

      listDocuments("teacherTestAssignments").forEach((assignment: any) => {
        const available = patchSnapshots(assignment?.availableQuestionSnapshots);
        const selected = patchSnapshots(assignment?.selectedQuestionSnapshots);
        if (!available.changed && !selected.changed) return;
        upsertDocument("teacherTestAssignments", String(assignment.id), {
          ...assignment,
          availableQuestionSnapshots: available.rows,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      listDocuments("teacherTestAssignmentSelections").forEach((selection: any) => {
        const selected = patchSnapshots(selection?.selectedQuestionSnapshots);
        if (!selected.changed) return;
        upsertDocument("teacherTestAssignmentSelections", String(selection.id), {
          ...selection,
          selectedQuestionSnapshots: selected.rows,
          updatedAt: now,
        });
      });

      recordQuestionAudit("curriculum-updated", id, {
        previous,
        next: { grade, courseId, unitId, topicId, outcomeId },
        source: "question-manager",
      });

      return res.json({
        success: true,
        questionId: id,
        grade,
        courseId,
        unitId,
        topicId,
        outcomeId,
        scopeLevel,
        updatedAt: now,
      });
    } catch (error) {
      console.error("Soru müfredat bilgisi güncellenemedi:", error);
      return res.status(500).json({ error: "Soru müfredat bilgisi güncellenemedi." });
    }
  });

  app.delete("/api/question-bank/questions/:id", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) return res.status(400).json({ error: "Soru kimliÄŸi zorunludur." });
      const result = deleteCanonicalQuestionById(id);
      if (!result.found) return res.status(404).json({ error: "Soru kaydÄ± bulunamadÄ±." });
      if (result.success) removeQuestionFromQuestionGroups(id);
      return res.json(result);
    } catch (error) {
      console.error("Canonical soru silme hatasÄ±:", error);
      return res.status(500).json({ error: "Soru silinemedi." });
    }
  });

  app.post("/api/question-bank/questions/bulk-delete", (req, res) => {
    try {
      const ids = Array.isArray(req.body?.questionIds)
        ? [...new Set(req.body.questionIds.map((value: any) => String(value || "").trim()).filter(Boolean))]
        : [];
      if (ids.length === 0) {
        return res.status(400).json({ error: "Silinecek soru seÃ§ilmedi." });
      }
      if (ids.length > 500) {
        return res.status(400).json({ error: "Tek iÅŸlemde en fazla 500 soru silinebilir." });
      }

      const results = ids.map((id: string) => {
        try {
          return deleteCanonicalQuestionById(id);
        } catch (error) {
          return {
            found: true,
            success: false,
            questionId: id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      results.forEach((item: any) => {
        if (item?.success && item?.questionId) removeQuestionFromQuestionGroups(String(item.questionId));
      });
      const deleted = results.filter((item: any) => item.success).length;
      const failed = results.length - deleted;
      return res.json({
        success: failed === 0,
        deleted,
        failed,
        results,
      });
    } catch (error) {
      console.error("Canonical toplu soru silme hatasÄ±:", error);
      return res.status(500).json({ error: "Sorular toplu olarak silinemedi." });
    }
  });

  app.delete("/api/question-bank/images", (req, res) => {
    try {
      const storagePath = safeStoredQuestionPath(req.body?.storagePath);
      if (!storagePath) return res.status(400).json({ error: "Soru dosya yolu geÃ§ersiz." });

      const absolute = path.resolve(questionBankRoot, storagePath);
      const record = findQuestionRecordByStoragePath(storagePath);
      const deletedAt = new Date().toISOString();
      let trashPath = "";

      if (fs.existsSync(absolute)) {
        const trashName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${path.basename(storagePath)}`;
        const trashAbsolute = path.join(questionBankTrashRoot, trashName);
        fs.renameSync(absolute, trashAbsolute);
        trashPath = path.posix.join(".trash", trashName);
      }

      if (record) {
        const next = {
          ...record,
          status: "deleted",
          deletedAt,
          originalStoragePath: storagePath,
          trashPath,
          storagePath: "",
          imageUrl: "",
          updatedAt: deletedAt,
        };
        persistQuestionBankRecord(next);
        syncQuestionBankIndexRecord(next);
        recordQuestionAudit("deleted", record.id, { originalStoragePath: storagePath, trashPath });
      }

      return res.json({ success: true, recoverable: Boolean(trashPath), questionId: record?.id || null });
    } catch (error) {
      console.error("Soru bankasÄ± silme hatasÄ±:", error);
      return res.status(500).json({ error: "Soru gÃ¶rseli silinemedi." });
    }
  });

  app.post("/api/question-bank/restore/:id", (req, res) => {
    try {
      const id = String(req.params.id || "");
      const record = allQuestionRecords().find((item) => String(item.id) === id);
      if (!record || record.status !== "deleted") return res.status(404).json({ error: "Geri alÄ±nabilir soru kaydÄ± bulunamadÄ±." });

      const originalStoragePath = safeStoredQuestionPath(record.originalStoragePath);
      const trashPath = safeStoredQuestionPath(record.trashPath);
      if (!originalStoragePath || !trashPath) return res.status(400).json({ error: "Sorunun geri yÃ¼kleme yolu geÃ§ersiz." });

      const trashAbsolute = path.resolve(questionBankRoot, trashPath);
      const targetAbsolute = path.resolve(questionBankRoot, originalStoragePath);
      if (!fs.existsSync(trashAbsolute)) return res.status(404).json({ error: "Ã‡Ã¶p kutusundaki soru dosyasÄ± bulunamadÄ±." });
      if (fs.existsSync(targetAbsolute)) return res.status(409).json({ error: "Eski konumda aynÄ± adlÄ± baÅŸka bir soru var." });

      fs.mkdirSync(path.dirname(targetAbsolute), { recursive: true });
      fs.renameSync(trashAbsolute, targetAbsolute);
      const restoredAt = new Date().toISOString();
      const next = {
        ...record,
        status: "active",
        storagePath: originalStoragePath,
        imageUrl: questionImageUrl(originalStoragePath),
        deletedAt: undefined,
        trashPath: undefined,
        originalStoragePath: undefined,
        updatedAt: restoredAt,
      };
      persistQuestionBankRecord(next);
      syncQuestionBankIndexRecord(next);
      recordQuestionAudit("restored", id, { storagePath: originalStoragePath });
      return res.json(next);
    } catch (error) {
      console.error("Soru bankasÄ± geri alma hatasÄ±:", error);
      return res.status(500).json({ error: "Soru geri yÃ¼klenemedi." });
    }
  });

  app.post("/api/question-bank/import-sessions", (req, res) => {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const record = {
        id,
        label: String(req.body?.label || "AkÄ±llÄ± KlasÃ¶r Ä°Ã§e Aktarma").slice(0, 240),
        source: String(req.body?.source || "CourseCurriculumPanel").slice(0, 120),
        grade: Number(req.body?.grade || 0) || null,
        courseCount: Number(req.body?.courseCount || 0),
        expectedFiles: Number(req.body?.expectedFiles || 0),
        expectedOutcomes: Number(req.body?.expectedOutcomes || 0),
        importedFiles: 0,
        completedOutcomes: 0,
        failedGroups: 0,
        status: "running",
        createdAt: now,
        updatedAt: now,
      };
      upsertDocument(QUESTION_BANK_IMPORT_SESSION_COLLECTION, id, record);
      return res.status(201).json(record);
    } catch (error) {
      return res.status(500).json({ error: "Ä°Ã§e aktarma oturumu oluÅŸturulamadÄ±." });
    }
  });

  app.patch("/api/question-bank/import-sessions/:id", (req, res) => {
    try {
      const id = String(req.params.id || "");
      const existing = (listDocuments(QUESTION_BANK_IMPORT_SESSION_COLLECTION) as any[])
        .find((item) => String(item.id || "") === id);
      if (!existing) {
        return res.status(404).json({ error: "Ä°Ã§e aktarma oturumu bulunamadÄ±." });
      }

      const next = {
        ...existing,
        ...req.body,
        id,
        updatedAt: new Date().toISOString(),
      };
      upsertDocument(QUESTION_BANK_IMPORT_SESSION_COLLECTION, id, next);
      return res.json(next);
    } catch (error) {
      return res.status(500).json({ error: "Ä°Ã§e aktarma oturumu gÃ¼ncellenemedi." });
    }
  });

  app.get("/api/question-bank/import-sessions", (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
      const sessions = (listDocuments(QUESTION_BANK_IMPORT_SESSION_COLLECTION) as any[])
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, limit)
        .map((session) => {
          const questions = allQuestionRecords().filter(
            (record) => String(record.importSessionId || "") === String(session.id),
          );
          return {
            ...session,
            questionCount: questions.length,
            activeQuestionCount: questions.filter(
              (record) => String(record.status || "active") === "active",
            ).length,
            deletedQuestionCount: questions.filter(
              (record) => String(record.status || "") === "deleted",
            ).length,
          };
        });

      return res.json({ sessions });
    } catch (error) {
      return res.status(500).json({ error: "Ä°Ã§e aktarma geÃ§miÅŸi okunamadÄ±." });
    }
  });

  app.post("/api/question-bank/import-sessions/:id/rollback", (req, res) => {
    try {
      const id = String(req.params.id || "");
      const session = (listDocuments(QUESTION_BANK_IMPORT_SESSION_COLLECTION) as any[])
        .find((item) => String(item.id || "") === id);
      if (!session) {
        return res.status(404).json({ error: "Ä°Ã§e aktarma oturumu bulunamadÄ±." });
      }

      const questions = allQuestionRecords().filter(
        (record) =>
          String(record.importSessionId || "") === id &&
          String(record.status || "active") === "active",
      );

      let rolledBack = 0;
      const failures: Array<{ questionId: string; questionCode: string; error: string }> = [];
      const rolledBackQuestionIds: string[] = [];

      for (const record of questions) {
        try {
          const storagePath = safeStoredQuestionPath(record.storagePath);
          let trashPath = "";

          if (storagePath) {
            const absolute = path.resolve(questionBankRoot, storagePath);
            if (fs.existsSync(absolute)) {
              const trashName = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}-${path.basename(storagePath)}`;
              const trashAbsolute = path.join(questionBankTrashRoot, trashName);
              fs.renameSync(absolute, trashAbsolute);
              trashPath = path.posix.join(".trash", trashName);
            }
          }

          const thumbnailPath = safeStoredQuestionPath(record.thumbnailPath);
          if (thumbnailPath) {
            const thumbnailAbsolute = path.resolve(questionBankRoot, thumbnailPath);
            if (fs.existsSync(thumbnailAbsolute)) {
              try { fs.unlinkSync(thumbnailAbsolute); } catch {}
            }
          }

          const now = new Date().toISOString();
          const next = {
            ...record,
            status: "deleted",
            deletedAt: now,
            originalStoragePath: storagePath || record.originalStoragePath || "",
            trashPath,
            storagePath: "",
            imageUrl: "",
            thumbnailPath: "",
            thumbnailUrl: "",
            rollbackSessionId: id,
            updatedAt: now,
          };
          persistQuestionBankRecord(next);
          syncQuestionBankIndexRecord(next);
          recordQuestionAudit("import-session-rollback", record.id, {
            importSessionId: id,
            questionCode: record.questionCode,
          });
          rolledBackQuestionIds.push(String(record.id));
          rolledBack += 1;
        } catch (error) {
          failures.push({
            questionId: String(record.id || ""),
            questionCode: String(record.questionCode || ""),
            error: error instanceof Error ? error.message : "Geri alma baÅŸarÄ±sÄ±z.",
          });
        }
      }

      const now = new Date().toISOString();
      const nextSession = {
        ...session,
        status: failures.length > 0 ? "rollback-partial" : "rolled-back",
        rolledBack,
        rollbackFailed: failures.length,
        rollbackAt: now,
        updatedAt: now,
      };
      upsertDocument(QUESTION_BANK_IMPORT_SESSION_COLLECTION, id, nextSession);

      return res.json({
        success: failures.length === 0,
        session: nextSession,
        rolledBack,
        failed: failures.length,
        rolledBackQuestionIds,
        failures,
      });
    } catch (error) {
      console.error("Ä°Ã§e aktarma geri alma hatasÄ±:", error);
      return res.status(500).json({ error: "Ä°Ã§e aktarma oturumu geri alÄ±namadÄ±." });
    }
  });

  app.get("/api/question-bank/next-sequence", (req, res) => {
    try {
      const grade = Number(req.query.grade || 0);
      const courseId = String(req.query.courseId || "").trim();
      const unitId = String(req.query.unitId || "").trim();
      const topicId = String(req.query.topicId || "").trim();
      const outcomeId = String(req.query.outcomeId || "").trim();

      if (!grade || !courseId || !unitId || !topicId) {
        return res.status(400).json({ error: "SÄ±nÄ±f, ders, Ã¼nite ve konu bilgisi zorunludur." });
      }

      const row = sqlite.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
        FROM question_bank_questions
        WHERE grade = ?
          AND course_id = ?
          AND unit_id = ?
          AND topic_id = ?
          AND outcome_id = ?
      `).get(grade, courseId, unitId, topicId, outcomeId) as any;

      const maxOrder = Number(row?.maxOrder || 0);
      return res.json({ maxOrder, nextSequence: maxOrder + 1 });
    } catch (error) {
      console.error("Soru sÄ±ra numarasÄ± okunamadÄ±:", error);
      return res.status(500).json({ error: "Soru sÄ±ra numarasÄ± okunamadÄ±." });
    }
  });

  app.post("/api/question-bank/rebind-hierarchy", (req, res) => {
    try {
      const source = req.body?.source || {};
      const target = req.body?.target || {};

      const sourceGrade = Number(source.grade || 0);
      const sourceCourseId = String(source.courseId || "").trim();
      const sourceUnitId = String(source.unitId || "").trim();
      const sourceTopicId = String(source.topicId || "").trim();
      const sourceOutcomeId = String(source.outcomeId || "").trim();
      const sourceQuestionType = String(source.questionType || "").trim().toLowerCase();

      const targetGrade = Number(target.grade || sourceGrade || 0);
      const targetCourseId = String(target.courseId || sourceCourseId || "").trim();
      const targetUnitId = String(target.unitId || "").trim();
      const targetTopicId = String(target.topicId || "").trim();
      const targetOutcomeId = String(target.outcomeId || "").trim();
      const targetQuestionType = String(
        target.questionType || sourceQuestionType || "study",
      ).trim().toLowerCase();

      if (
        !sourceGrade ||
        !sourceCourseId ||
        !sourceUnitId ||
        !sourceTopicId ||
        !targetGrade ||
        !targetCourseId ||
        !targetUnitId ||
        !targetTopicId
      ) {
        return res.status(400).json({
          error: "Kaynak ve hedef sÄ±nÄ±f/ders/Ã¼nite/konu bilgileri zorunludur.",
        });
      }

      const sourceRows = sqlite.prepare(`
        SELECT *
        FROM question_bank_questions
        WHERE status = 'active'
          AND grade = ?
          AND course_id = ?
          AND unit_id = ?
          AND topic_id = ?
          AND outcome_id = ?
          ${sourceQuestionType ? "AND question_type = ?" : ""}
        ORDER BY
          sort_order ASC,
          COALESCE(created_at, '') ASC,
          question_id ASC
      `).all(
        sourceGrade,
        sourceCourseId,
        sourceUnitId,
        sourceTopicId,
        sourceOutcomeId,
        ...(sourceQuestionType ? [sourceQuestionType] : []),
      ) as any[];

      if (sourceRows.length === 0) {
        return res.status(404).json({
          error: "Kaynak hiyerarÅŸide taÅŸÄ±nacak aktif soru bulunamadÄ±.",
          moved: 0,
        });
      }

      const targetBaseId = targetOutcomeId || targetTopicId;
      const now = new Date().toISOString();
      const updated: any[] = [];

      sqlite.exec("BEGIN IMMEDIATE");
      try {
        sourceRows.forEach((row, index) => {
          const record = questionRowToRecord(row);
          const order = index + 1;
          const answer = /^[A-E]$/.test(String(record.answer || "").toUpperCase())
            ? String(record.answer).toUpperCase()
            : "A";
          const questionCode = `${targetBaseId}_${String(order).padStart(3, "0")}_${answer}`;

          const next = {
            ...record,
            questionCode,
            grade: targetGrade,
            courseId: targetCourseId,
            unitId: targetUnitId,
            topicId: targetTopicId,
            outcomeId: targetOutcomeId,
            questionType: ["exam", "study"].includes(targetQuestionType)
              ? targetQuestionType
              : "study",
            scopeLevel: targetOutcomeId ? "outcome" : "topic",
            order,
            updatedAt: now,
          };

          persistQuestionBankRecord(next);
          updated.push(next);
        });

        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }

      // Canonical kaynak gÃ¼ncellendikten sonra yardÄ±mcÄ± indeksleri de eÅŸitle.
      updated.forEach((record) => syncQuestionBankIndexRecord(record));

      recordQuestionAudit("hierarchy-rebind", `bulk-${Date.now()}`, {
        source: {
          grade: sourceGrade,
          courseId: sourceCourseId,
          unitId: sourceUnitId,
          topicId: sourceTopicId,
          outcomeId: sourceOutcomeId,
          questionType: sourceQuestionType || null,
        },
        target: {
          grade: targetGrade,
          courseId: targetCourseId,
          unitId: targetUnitId,
          topicId: targetTopicId,
          outcomeId: targetOutcomeId,
          questionType: targetQuestionType || "study",
        },
        moved: updated.length,
      });

      return res.json({
        success: true,
        moved: updated.length,
        source: {
          grade: sourceGrade,
          courseId: sourceCourseId,
          unitId: sourceUnitId,
          topicId: sourceTopicId,
          outcomeId: sourceOutcomeId,
          questionType: sourceQuestionType || null,
        },
        target: {
          grade: targetGrade,
          courseId: targetCourseId,
          unitId: targetUnitId,
          topicId: targetTopicId,
          outcomeId: targetOutcomeId,
          questionType: targetQuestionType || "study",
        },
        questions: updated.map((record) => ({
          id: record.id,
          questionCode: record.questionCode,
          answer: record.answer,
          order: record.order,
        })),
      });
    } catch (error) {
      console.error("Canonical soru hiyerarÅŸi taÅŸÄ±ma hatasÄ±:", error);
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Sorular yeni mÃ¼fredat hedefine taÅŸÄ±namadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/counts", (req, res) => {
    try {
      const grade = Number(req.query.grade || 0);
      const courseId = String(req.query.courseId || "").trim();
      const questionType = String(req.query.questionType || "").trim().toLowerCase();

      const where = ["qbq.status = 'active'"];
      const params: any[] = [];
      if (grade) {
        where.push("qbq.grade = ?");
        params.push(grade);
      }
      if (courseId) {
        where.push("qbq.course_id = ?");
        params.push(courseId);
      }
      if (questionType) {
        where.push("qbq.question_type = ?");
        params.push(questionType);
      }

      const rows = sqlite.prepare(`
        SELECT
          qbq.course_id AS courseId,
          qbq.unit_id AS unitId,
          qbq.topic_id AS topicId,
          qbq.outcome_id AS outcomeId,
          qbq.question_type AS questionType,
          COUNT(*) AS count
        FROM question_bank_questions qbq
        WHERE ${where.join(" AND ")}
        GROUP BY
          qbq.course_id,
          qbq.unit_id,
          qbq.topic_id,
          qbq.outcome_id,
          qbq.question_type
      `).all(...params) as any[];

      return res.json({
        grade: grade || null,
        courseId: courseId || null,
        counts: rows.map((row) => ({
          courseId: String(row.courseId || ""),
          unitId: String(row.unitId || ""),
          topicId: String(row.topicId || ""),
          outcomeId: String(row.outcomeId || ""),
          questionType: String(row.questionType || "study"),
          count: Number(row.count || 0),
        })),
      });
    } catch (error) {
      console.error("Soru bankasÄ± sayÄ±m Ã¶zeti oluÅŸturulamadÄ±:", error);
      return res.status(500).json({ error: "Soru sayÄ±larÄ± okunamadÄ±." });
    }
  });

  app.get("/api/question-bank/questions", (req, res) => {
    try {
      const status = String(req.query.status || "active").trim();
      const grade = String(req.query.grade || "").trim();
      const courseId = String(req.query.courseId || "").trim();
      const unitId = String(req.query.unitId || "").trim();
      const topicId = String(req.query.topicId || "").trim();
      const outcomeId = String(req.query.outcomeId || "").trim();
      const questionType = String(req.query.questionType || "").trim().toLowerCase();
      const answer = String(req.query.answer || "").trim().toUpperCase();
      const usage = String(req.query.usage || "").trim().toLowerCase();
      const examId = String(req.query.examId || "").trim();
      const q = String(req.query.q || "").trim();
      const ids = String(req.query.ids || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 200);
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
      const offset = Math.max(0, Number(req.query.offset || 0));

      const where: string[] = [];
      const params: any[] = [];

      if (status) { where.push("qbq.status = ?"); params.push(status); }
      if (ids.length > 0) {
        where.push(`qbq.question_id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
      if (grade) { where.push("qbq.grade = ?"); params.push(Number(grade)); }
      if (courseId) { where.push("qbq.course_id = ?"); params.push(courseId); }
      if (unitId) { where.push("qbq.unit_id = ?"); params.push(unitId); }
      if (topicId) { where.push("qbq.topic_id = ?"); params.push(topicId); }
      if (outcomeId) { where.push("qbq.outcome_id = ?"); params.push(outcomeId); }
      else if (req.query.unassignedOnly === "true") { where.push("COALESCE(qbq.outcome_id, '') = ''"); }
      if (questionType) { where.push("qbq.question_type = ?"); params.push(questionType); }
      if (answer) { where.push("qbq.answer = ?"); params.push(answer); }
      if (usage === "unused") where.push("COALESCE(qbi.use_count, 0) = 0");
      else if (usage === "used") where.push("COALESCE(qbi.use_count, 0) > 0");
      if (examId) {
        where.push(`EXISTS (
          SELECT 1 FROM soru_bankasi_kullanimlari u
          WHERE u.soru_id = qbq.question_id
            AND u.sinav_id = ?
        )`);
        params.push(examId);
      }
      if (q) {
        where.push(`(
          qbq.question_code LIKE ? ESCAPE '\\'
          OR qbq.file_name LIKE ? ESCAPE '\\'
          OR qbq.outcome_id LIKE ? ESCAPE '\\'
          OR qbq.course_id LIKE ? ESCAPE '\\'
        )`);
        const escaped = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
        params.push(escaped, escaped, escaped, escaped);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const countRow = sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM question_bank_questions qbq
        LEFT JOIN question_bank_index qbi ON qbi.question_id = qbq.question_id
        ${whereSql}
      `).get(...params) as any;

      const rows = sqlite.prepare(`
        SELECT qbq.*,
          COALESCE(qbi.use_count, 0) AS use_count,
          qbi.last_used_at AS last_used_at,
          qbi.last_exam_id AS last_exam_id,
          qbi.last_exam_name AS last_exam_name
        FROM question_bank_questions qbq
        LEFT JOIN question_bank_index qbi ON qbi.question_id = qbq.question_id
        ${whereSql}
        ORDER BY
          CASE WHEN COALESCE(qbi.use_count, 0) = 0 THEN 0 ELSE 1 END,
          COALESCE(qbi.use_count, 0) ASC,
          COALESCE(qbi.last_used_at, '') ASC,
          COALESCE(qbq.created_at, '') DESC,
          qbq.question_id
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset) as any[];

      const questionGroupIndex = buildQuestionGroupIndex();
      const questions = rows.map((row) => {
        const parsedRecord = attachQuestionGroupMetadata(questionRowToRecord(row), questionGroupIndex);
        const storagePath = safeStoredQuestionPath(parsedRecord?.storagePath);
        const thumbnailPath = safeStoredQuestionPath(parsedRecord?.thumbnailPath);
        return {
          ...parsedRecord,
          ...(storagePath ? { imageUrl: questionImageUrl(storagePath) } : {}),
          ...(thumbnailPath ? {
            thumbnailUrl: `/api/question-bank/thumbs/${encodeURIComponent(path.basename(thumbnailPath))}`,
          } : {}),
          useCount: Number(row.use_count || 0),
          lastUsedAt: row.last_used_at || null,
          lastExamId: row.last_exam_id || null,
          lastExamName: row.last_exam_name || null,
        };
      });

      return res.json({
        total: Number(countRow?.count || 0),
        offset,
        limit,
        questions,
        engine: "sqlite-canonical",
      });
    } catch (error) {
      console.error("Canonical soru bankasÄ± listeleme hatasÄ±:", error);
      return res.status(500).json({ error: "Soru bankasÄ± listelenemedi." });
    }
  });


  app.delete("/api/question-bank/archive/:examId", (req, res) => {
    try {
      const examId = String(req.params.examId || "").trim();
      if (!examId) return res.status(400).json({ error: "Sınav/test kimliği zorunludur." });
      const result = removeQuestionArchiveSet(examId);
      return res.json({ success: true, examId, ...result });
    } catch (error) {
      console.error("Sınav/test soru klasörü temizlenemedi:", error);
      return res.status(500).json({ error: "Sınav/test soru klasörü temizlenemedi." });
    }
  });

  app.delete("/api/question-bank/test-draft/:testId", (req, res) => {
    try {
      const testId = String(req.params.testId || "").trim();
      if (!testId) return res.status(400).json({ error: "Test kimliği zorunludur." });
      const usages = allQuestionUsage().filter((item) => String(item.examId || "") === testId);
      if (usages.length > 0) {
        return res.status(409).json({
          error: "Bu test kesinleştirilmiştir. Kesinleştirilmiş test silinemez.",
          finalized: true,
          usageCount: usages.length,
        });
      }
      // Taslak test silinirken test seçimi/görevlendirme kayıtlarını da temizle.
      // Kullanım kaydı olmadığı için sorular soru bankasında serbest kalır; dosya-adı
      // soru grubu ise sorunun kalıcı özelliğidir ve soru bankasından silinmez.
      const assignments = listDocuments("teacherTestAssignments").filter(
        (item: any) => String(item?.testId || "") === testId,
      );
      assignments.forEach((assignment: any) => {
        const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
        if (!assignmentId) return;
        deleteDocument("teacherTestAssignmentSelections", assignmentId);
        deleteDocument("teacherTestAssignments", assignmentId);
      });
      const archive = removeQuestionArchiveSet(testId);
      return res.json({
        success: true,
        testId,
        releasedCount: 0,
        assignmentRemovedCount: assignments.length,
        archiveRemoved: archive.removed,
      });
    } catch (error) {
      console.error("Taslak test silme kontrolü yapılamadı:", error);
      return res.status(500).json({ error: "Taslak test silinemedi." });
    }
  });

  app.post("/api/question-bank/usage", (req, res) => {
    try {
      const questionId = String(req.body?.questionId || "").trim();
      const examId = String(req.body?.examId || "").trim();
      if (!questionId || !examId) {
        return res.status(400).json({ error: "Soru ve sÄ±nav kimliÄŸi zorunludur." });
      }

      const question = allQuestionRecords().find(
        (item) =>
          String(item.id || "") === questionId &&
          String(item.status || "active") === "active",
      );
      if (!question) return res.status(404).json({ error: "Soru bankasÄ± kaydÄ± bulunamadÄ±." });

      const usageId = `${examId}::${questionId}`;
      const requestedExamName = String(req.body?.examName || "").trim().slice(0, 240);
      const existingOtherExamUsage = allQuestionUsage().find(
        (item) =>
          String(item.questionId || "") === questionId &&
          String(item.examId || "") !== examId,
      );
      if (existingOtherExamUsage) {
        return res.status(409).json({
          error: `Bu soru daha önce "${String(existingOtherExamUsage.examName || "başka bir sınav/test")}" içinde kullanılmıştır ve yeniden kullanılamaz.`,
          usedByOtherExam: true,
          usage: existingOtherExamUsage,
          summary: questionUsageSummary(questionId),
        });
      }
      const existing = allQuestionUsage().find((item) => String(item.id || "") === usageId);
      if (existing) {
        const nextExisting = requestedExamName && requestedExamName !== String(existing?.examName || "")
          ? { ...existing, examName: requestedExamName }
          : existing;
        if (nextExisting !== existing) upsertDocument(QUESTION_BANK_USAGE_COLLECTION, usageId, nextExisting);
        const archive = requestedExamName
          ? upsertQuestionArchiveEntry({
              question,
              examId,
              examName: requestedExamName,
              source: String(req.body?.source || "Sınav Hazırla"),
            })
          : null;
        return res.status(200).json({
          duplicateUsage: true,
          usage: nextExisting,
          archive,
          summary: questionUsageSummary(questionId),
        });
      }

      const record = {
        id: usageId,
        questionId,
        questionCode: question.questionCode,
        examId,
        examName: requestedExamName,
        examDate: String(req.body?.examDate || "").slice(0, 40) || null,
        bookType: String(req.body?.bookType || "").slice(0, 40) || null,
        questionNumber: Number(req.body?.questionNumber || 0) || null,
        source: String(req.body?.source || "SÄ±nav HazÄ±rla").slice(0, 120),
        usedAt: new Date().toISOString(),
      };
      upsertDocument(QUESTION_BANK_USAGE_COLLECTION, usageId, record);
      const archive = record.examName
        ? upsertQuestionArchiveEntry({
            question,
            examId,
            examName: record.examName,
            source: record.source,
          })
        : null;
      syncQuestionBankIndexById(questionId);
      recordQuestionAudit("used", questionId, {
        examId,
        examName: record.examName,
        questionNumber: record.questionNumber,
      });
      return res.status(201).json({
        usage: record,
        archive,
        summary: questionUsageSummary(questionId),
      });
    } catch (error) {
      console.error("Soru kullanÄ±m kaydÄ± oluÅŸturulamadÄ±:", error);
      return res.status(500).json({ error: "Soru kullanÄ±m kaydÄ± oluÅŸturulamadÄ±." });
    }
  });

  app.post("/api/question-bank/archive-selection", (req, res) => {
    try {
      const examId = String(req.body?.examId || "").trim();
      const examName = String(req.body?.examName || "").trim().slice(0, 240);
      const questionIds = Array.isArray(req.body?.questionIds)
        ? req.body.questionIds.map(String).map((value: string) => value.trim()).filter(Boolean)
        : [];
      if (!examId || !examName) {
        return res.status(400).json({ error: "Sınav/test kimliği ve adı zorunludur." });
      }
      if (questionIds.length > 1000) {
        return res.status(400).json({ error: "Tek işlemde en fazla 1000 soru arşivlenebilir." });
      }

      const conflictUsages = allQuestionUsage().filter(
        (item) =>
          questionIds.includes(String(item.questionId || "")) &&
          String(item.examId || "") !== examId,
      );
      if (conflictUsages.length > 0) {
        return res.status(409).json({
          error: `${conflictUsages.length} soru daha önce başka bir sınav/testte kullanıldığı için bu sınava bağlanamaz.`,
          conflicts: conflictUsages.map((item) => ({
            questionId: String(item.questionId || ""),
            examId: String(item.examId || ""),
            examName: String(item.examName || ""),
          })),
        });
      }

      const source = String(req.body?.source || "Sınav/Test Hazırla").slice(0, 120);
      const lockUsage = req.body?.lockUsage !== false;
      const result = syncQuestionArchiveSet({
        examId,
        examName,
        questionIds,
        source,
      });

      // Taslak test hazırlanırken aynı klasör yapısı oluşturulur fakat kullanım
      // kilidi ancak kesinleştirme akışında açılır. Böylece taslak silinirse soru
      // klasörü kaldırılır ve sorular serbest kalır; kesinleşmiş testte ise mevcut
      // tek-kullanım kuralı aynen korunur.
      let locked = 0;
      if (lockUsage) {
        const activeById = new Map(
          activeQuestionRecords().map((question: any) => [String(question?.id || ""), question]),
        );
        const now = new Date().toISOString();
        questionIds.forEach((questionId) => {
          const question = activeById.get(questionId);
          if (!question) return;
          const usageId = `${examId}::${questionId}`;
          const existingUsage = allQuestionUsage().find((item) => String(item.id || "") === usageId);
          if (existingUsage) {
            if (examName && examName !== String(existingUsage.examName || "")) {
              upsertDocument(QUESTION_BANK_USAGE_COLLECTION, usageId, {
                ...existingUsage,
                examName,
                source: existingUsage.source || source,
              });
            }
            return;
          }
          upsertDocument(QUESTION_BANK_USAGE_COLLECTION, usageId, {
            id: usageId,
            questionId,
            questionCode: String(question?.questionCode || ""),
            examId,
            examName,
            examDate: null,
            bookType: null,
            questionNumber: null,
            source,
            usedAt: now,
          });
          syncQuestionBankIndexById(questionId);
          recordQuestionAudit("used", questionId, {
            examId,
            examName,
            source,
            reason: "archive-selection",
          });
          locked += 1;
        });
      }

      return res.json({ success: true, examId, examName, lockUsage, locked, ...result });
    } catch (error) {
      console.error("Sınav/test soru klasörü oluşturulamadı:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Sınav/test soru klasörü oluşturulamadı.",
      });
    }
  });

  app.delete("/api/question-bank/usage", (req, res) => {
    try {
      const questionId = String(req.body?.questionId || "").trim();
      const examId = String(req.body?.examId || "").trim();
      if (!questionId || !examId) {
        return res.status(400).json({ error: "Soru ve sÄ±nav kimliÄŸi zorunludur." });
      }
      const usageId = `${examId}::${questionId}`;
      const existing = allQuestionUsage().find((item) => String(item.id || "") === usageId);
      if (!existing) return res.status(404).json({ error: "Soru kullanÄ±m kaydÄ± bulunamadÄ±." });
      const archiveRecord = (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
        .find((item) => String(item?.id || "") === usageId);
      if (archiveRecord) removeQuestionArchiveRecord(archiveRecord);
      deleteDocument(QUESTION_BANK_USAGE_COLLECTION, usageId);
      syncQuestionBankIndexById(questionId);
      recordQuestionAudit("usage-removed", questionId, { examId });
      return res.json({ success: true, summary: questionUsageSummary(questionId) });
    } catch (error) {
      return res.status(500).json({ error: "Soru kullanÄ±m kaydÄ± kaldÄ±rÄ±lamadÄ±." });
    }
  });

  app.get("/api/exams/:examId/delete-status", (req, res) => {
    try {
      const examId = String(req.params.examId || "").trim();
      if (!examId) return res.status(400).json({ error: "Sınav kimliği zorunludur." });
      const currentExam = getDocument("exams", examId);
      if (!currentExam) return res.status(404).json({ error: "Sınav bulunamadı." });
      const finalized = Boolean(
        currentExam?.finalizedAt ||
        currentExam?.isFinalized === true ||
        currentExam?.bookletLayoutLock?.questionsLocked === true
      );
      return res.json({ examId, finalized, finalizedAt: currentExam?.finalizedAt || currentExam?.bookletLayoutLock?.questionsLockedAt || null });
    } catch (error) {
      return res.status(500).json({ error: "Sınav silme durumu okunamadı." });
    }
  });

  app.delete("/api/exams/:examId", (req, res) => {
    try {
      const examId = String(req.params.examId || "").trim();
      if (!examId) {
        return res.status(400).json({ error: "SÄ±nav kimliÄŸi zorunludur." });
      }

      const currentExam = getDocument("exams", examId);
      if (!currentExam) {
        return res.status(404).json({ error: "SÄ±nav bulunamadÄ±." });
      }
      const finalizedExam = Boolean(
        currentExam?.finalizedAt ||
        currentExam?.isFinalized === true ||
        currentExam?.bookletLayoutLock?.questionsLocked === true
      );
      if (finalizedExam) {
        return res.status(409).json({
          error: "Bu sınav kesinleştirilmiştir. Kesinleştirilmiş sınav silinemez.",
          finalized: true,
        });
      }

      const examUsages = allQuestionUsage().filter(
        (item) => String(item.examId || "") === examId,
      );

      const affectedQuestionIds = Array.from(
        new Set(
          examUsages
            .map((item) => String(item.questionId || "").trim())
            .filter(Boolean),
        ),
      );

      // Ana kayıt ve rezervasyonlar aynı transaction'da kaldırılır.
      // Soru indeksi / denetim geçmişi bakım işleri başarısız olursa
      // ana sınav silme işlemi geri alınmamalıdır.
      const deleteExamWithUsages = sqlite.transaction(() => {
        for (const usage of examUsages) {
          const usageId = String(usage.id || "").trim();
          if (usageId) deleteDocument(QUESTION_BANK_USAGE_COLLECTION, usageId);
        }
        deleteDocument("exams", examId);
      });
      deleteExamWithUsages();

      if (getDocument("exams", examId)) {
        throw new Error("Sınav kaydı veritabanından kaldırılamadı.");
      }

      const maintenanceWarnings: string[] = [];
      for (const questionId of affectedQuestionIds) {
        try { syncQuestionBankIndexById(questionId); }
        catch (error) { maintenanceWarnings.push(`İndeks ${questionId}: ${error instanceof Error ? error.message : String(error)}`); }
        try { recordQuestionAudit("usage-removed", questionId, { examId, reason: "exam-deleted" }); }
        catch (error) { maintenanceWarnings.push(`Denetim ${questionId}: ${error instanceof Error ? error.message : String(error)}`); }
      }
      if (maintenanceWarnings.length) console.warn("Sınav silindi; yardımcı kayıtlarda uyarı:", maintenanceWarnings);

      // Ana sınav kaydı artık silindi. Arşiv dosyası temizliği başarısız
      // olursa başarılı veritabanı işlemi 500 olarak raporlanmamalı.
      const archiveCleanupErrors: string[] = [];
      (listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
        .filter((item) => String(item?.examId || "") === examId)
        .forEach((record) => {
          try { removeQuestionArchiveRecord(record); }
          catch (error) {
            archiveCleanupErrors.push(error instanceof Error ? error.message : String(error));
          }
        });
      if (archiveCleanupErrors.length) console.warn("Sınav silindi; arşiv temizliğinde uyarı:", archiveCleanupErrors);

      // Transaction sonrasÄ± doÄŸrulama.
      if (getDocument("exams", examId)) {
        throw new Error("SÄ±nav MySQL'den silinemedi.");
      }

      const remainingUsageCount = allQuestionUsage().filter(
        (item) => String(item.examId || "") === examId,
      ).length;

      if (remainingUsageCount > 0) {
        throw new Error("SÄ±nava ait soru kullanÄ±m kayÄ±tlarÄ± tamamen kaldÄ±rÄ±lamadÄ±.");
      }

      return res.json({
        success: true,
        examId,
        releasedCount: examUsages.length,
        affectedQuestionCount: affectedQuestionIds.length,
        archiveCleanupWarnings: archiveCleanupErrors,
        maintenanceWarnings,
      });
    } catch (error: any) {
      console.error("SÄ±nav ve soru kullanÄ±m kayÄ±tlarÄ± silinemedi:", error);
      return res.status(500).json({
        error: String(
          error?.message || "SÄ±nav ve soru kullanÄ±m kayÄ±tlarÄ± silinemedi.",
        ),
      });
    }
  });

  app.get("/api/question-bank/usage/:questionId", (req, res) => {
    try {
      const questionId = String(req.params.questionId || "").trim();
      const usage = allQuestionUsage()
        .filter((item) => String(item.questionId || "") === questionId)
        .sort((a, b) => String(b.usedAt || "").localeCompare(String(a.usedAt || "")));
      return res.json({
        questionId,
        summary: questionUsageSummary(questionId),
        usage,
      });
    } catch (error) {
      return res.status(500).json({ error: "Soru kullanÄ±m geÃ§miÅŸi okunamadÄ±." });
    }
  });

  app.post("/api/question-bank/usage/check-exam", (req, res) => {
    try {
      const examId = String(req.body?.examId || "").trim();
      const questionIds = Array.isArray(req.body?.questionIds)
        ? req.body.questionIds.map((item: any) => String(item || "").trim()).filter(Boolean)
        : [];
      if (!examId) return res.status(400).json({ error: "SÄ±nav kimliÄŸi zorunludur." });
      const conflictRows = allQuestionUsage().filter(
        (item) =>
          questionIds.includes(String(item.questionId || "")) &&
          String(item.examId || "") !== examId,
      );
      const conflictIds = new Set(conflictRows.map((item) => String(item.questionId || "")));
      return res.json({
        examId,
        conflicts: questionIds.filter((id: string) => conflictIds.has(id)),
        usages: conflictRows.map((item) => ({
          questionId: String(item.questionId || ""),
          examId: String(item.examId || ""),
          examName: String(item.examName || ""),
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: "SÄ±nav soru tekrar kontrolÃ¼ yapÄ±lamadÄ±." });
    }
  });

  const QUESTION_BANK_BACKUP_VERSION = 1;
  const questionBackupFileForRecord = (record: any) => {
    const candidate =
      String(record.status || "active") === "deleted"
        ? String(record.trashPath || "")
        : String(record.storagePath || "");
    return safeStoredQuestionPath(candidate);
  };

  app.post("/api/question-bank/backup/export", async (req, res) => {
    try {
      const clientTemplates = Array.isArray(req.body?.templates)
        ? req.body.templates
        : [];
      const records = allQuestionRecords();
      const usage = allQuestionUsage();
      const audit = listDocuments(QUESTION_BANK_AUDIT_COLLECTION) as any[];
      const backupId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const fileName = `e-nstitu-soru-bankasi-${createdAt
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "")}.enqbackup.gz`;

      res.status(200);
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");

      const gzip = zlib.createGzip({ level: 6 });
      gzip.pipe(res);

      const writeLine = async (value: any) => {
        const line = `${JSON.stringify(value)}\n`;
        if (!gzip.write(line, "utf8")) {
          await new Promise<void>((resolve) => gzip.once("drain", resolve));
        }
      };

      await writeLine({
        type: "header",
        format: "e-nstitu-question-bank-backup",
        version: QUESTION_BANK_BACKUP_VERSION,
        backupId,
        createdAt,
        appVersion: "4.0.0",
        templates: clientTemplates,
        counts: {
          questionRecords: records.length,
          usage: usage.length,
          audit: audit.length,
        },
      });

      for (const record of records) {
        await writeLine({
          type: "document",
          collection: QUESTION_BANK_COLLECTION,
          value: record,
        });
      }

      for (const item of usage) {
        await writeLine({
          type: "document",
          collection: QUESTION_BANK_USAGE_COLLECTION,
          value: item,
        });
      }

      for (const item of audit) {
        await writeLine({
          type: "document",
          collection: QUESTION_BANK_AUDIT_COLLECTION,
          value: item,
        });
      }

      let exportedFiles = 0;
      let exportedBytes = 0;
      let skippedMissingFiles = 0;

      for (const record of records) {
        const relativePath = questionBackupFileForRecord(record);
        if (!relativePath) continue;
        const absolute = path.resolve(questionBankRoot, relativePath);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          skippedMissingFiles += 1;
          continue;
        }

        const buffer = fs.readFileSync(absolute);
        const contentHash = questionFileHash(buffer);
        await writeLine({
          type: "file",
          questionId: record.id,
          path: relativePath,
          sizeBytes: buffer.length,
          contentHash,
          data: buffer.toString("base64"),
        });
        exportedFiles += 1;
        exportedBytes += buffer.length;

        const thumbnailPath = safeStoredQuestionPath(record.thumbnailPath);
        if (thumbnailPath) {
          const thumbnailAbsolute = path.resolve(questionBankRoot, thumbnailPath);
          if (fs.existsSync(thumbnailAbsolute) && fs.statSync(thumbnailAbsolute).isFile()) {
            const thumbnailBuffer = fs.readFileSync(thumbnailAbsolute);
            await writeLine({
              type: "file",
              questionId: record.id,
              path: thumbnailPath,
              sizeBytes: thumbnailBuffer.length,
              contentHash: questionFileHash(thumbnailBuffer),
              fileRole: "thumbnail",
              data: thumbnailBuffer.toString("base64"),
            });
            exportedFiles += 1;
            exportedBytes += thumbnailBuffer.length;
          }
        }
      }

      await writeLine({
        type: "footer",
        backupId,
        createdAt,
        exportedFiles,
        exportedBytes,
        skippedMissingFiles,
      });

      gzip.end();
    } catch (error) {
      console.error("Soru bankasÄ± yedekleme hatasÄ±:", error);
      if (!res.headersSent) {
        return res.status(500).json({
          error: "Soru bankasÄ± yedeÄŸi oluÅŸturulamadÄ±.",
        });
      }
      try { res.end(); } catch {}
    }
  });

  app.post("/api/question-bank/backup/restore", async (req, res) => {
    const idMap = new Map<string, string>();
    const skipFileQuestionIds = new Set<string>();
    const restoredQuestionIds = new Set<string>();
    const result = {
      backupId: "",
      backupCreatedAt: "",
      templates: [] as any[],
      questionsAdded: 0,
      questionsMatched: 0,
      questionsSkipped: 0,
      usageAdded: 0,
      auditAdded: 0,
      filesAdded: 0,
      filesMatched: 0,
      filesSkipped: 0,
      hashMismatches: 0,
      codeConflicts: [] as Array<{
        questionCode: string;
        backupQuestionId: string;
        existingQuestionId: string;
      }>,
      warnings: [] as string[],
    };

    try {
      const gunzip = zlib.createGunzip();
      req.pipe(gunzip);
      const rl = readline.createInterface({
        input: gunzip,
        crlfDelay: Infinity,
      });

      const existingRecordsAtStart = allQuestionRecords();
      const existingById = new Map(
        existingRecordsAtStart.map((item) => [String(item.id), item]),
      );
      const existingByHash = new Map(
        existingRecordsAtStart
          .filter((item) => String(item.contentHash || ""))
          .map((item) => [String(item.contentHash), item]),
      );
      const existingByCode = new Map(
        existingRecordsAtStart
          .filter((item) => String(item.questionCode || ""))
          .map((item) => [String(item.questionCode), item]),
      );

      for await (const rawLine of rl) {
        const line = String(rawLine || "").trim();
        if (!line) continue;

        let entry: any;
        try {
          entry = JSON.parse(line);
        } catch {
          throw new Error("Yedek dosyasÄ±nda okunamayan bir kayÄ±t bulundu.");
        }

        if (entry.type === "header") {
          if (
            entry.format !== "e-nstitu-question-bank-backup" ||
            Number(entry.version) !== QUESTION_BANK_BACKUP_VERSION
          ) {
            throw new Error("Bu dosya desteklenen e-NstitÃ¼ soru bankasÄ± yedeÄŸi deÄŸil.");
          }
          result.backupId = String(entry.backupId || "");
          result.backupCreatedAt = String(entry.createdAt || "");
          result.templates = Array.isArray(entry.templates) ? entry.templates : [];
          continue;
        }

        if (entry.type === "document") {
          const collection = String(entry.collection || "");
          const value = entry.value || {};
          const originalId = String(value.id || "");

          if (!originalId) continue;

          if (collection === QUESTION_BANK_COLLECTION) {
            const sameId = existingById.get(originalId);
            if (sameId) {
              idMap.set(originalId, originalId);
              skipFileQuestionIds.add(originalId);
              result.questionsMatched += 1;
              continue;
            }

            const hash = String(value.contentHash || "");
            const sameHash = hash ? existingByHash.get(hash) : undefined;
            if (sameHash) {
              idMap.set(originalId, String(sameHash.id));
              skipFileQuestionIds.add(originalId);
              result.questionsMatched += 1;
              continue;
            }

            const code = String(value.questionCode || "");
            const sameCode = code ? existingByCode.get(code) : undefined;
            if (sameCode) {
              idMap.set(originalId, String(sameCode.id));
              skipFileQuestionIds.add(originalId);
              result.questionsSkipped += 1;
              result.codeConflicts.push({
                questionCode: code,
                backupQuestionId: originalId,
                existingQuestionId: String(sameCode.id),
              });
              continue;
            }

            const nextRecord = { ...value };
            persistQuestionBankRecord(nextRecord);
            existingById.set(originalId, nextRecord);
            if (hash) existingByHash.set(hash, nextRecord);
            if (code) existingByCode.set(code, nextRecord);
            idMap.set(originalId, originalId);
            restoredQuestionIds.add(originalId);
            result.questionsAdded += 1;
            continue;
          }

          if (collection === QUESTION_BANK_USAGE_COLLECTION) {
            const mappedQuestionId = idMap.get(String(value.questionId || ""));
            if (!mappedQuestionId) {
              result.warnings.push(
                `KullanÄ±m kaydÄ± atlandÄ±; soru eÅŸleÅŸtirilemedi: ${value.questionId || originalId}`,
              );
              continue;
            }

            const examId = String(value.examId || "");
            const usageId = `${examId}::${mappedQuestionId}`;
            const exists = allQuestionUsage().some(
              (item) => String(item.id || "") === usageId,
            );
            if (!exists) {
              upsertDocument(QUESTION_BANK_USAGE_COLLECTION, usageId, {
                ...value,
                id: usageId,
                questionId: mappedQuestionId,
              });
              result.usageAdded += 1;
            }
            continue;
          }

          if (collection === QUESTION_BANK_AUDIT_COLLECTION) {
            const mappedQuestionId = idMap.get(String(value.questionId || ""));
            const newAuditId = crypto.randomUUID();
            upsertDocument(QUESTION_BANK_AUDIT_COLLECTION, newAuditId, {
              ...value,
              id: newAuditId,
              questionId: mappedQuestionId || String(value.questionId || ""),
              restoredFromBackupId: result.backupId || null,
            });
            result.auditAdded += 1;
            continue;
          }

          continue;
        }

        if (entry.type === "file") {
          const originalQuestionId = String(entry.questionId || "");
          if (skipFileQuestionIds.has(originalQuestionId)) {
            result.filesSkipped += 1;
            continue;
          }

          const mappedQuestionId = idMap.get(originalQuestionId);
          if (!mappedQuestionId || mappedQuestionId !== originalQuestionId) {
            result.filesSkipped += 1;
            continue;
          }

          const relativePath = safeStoredQuestionPath(entry.path);
          if (!relativePath) {
            result.filesSkipped += 1;
            result.warnings.push(`GeÃ§ersiz dosya yolu atlandÄ±: ${entry.path || ""}`);
            continue;
          }

          const buffer = Buffer.from(String(entry.data || ""), "base64");
          const actualHash = questionFileHash(buffer);
          const expectedHash = String(entry.contentHash || "");
          if (expectedHash && actualHash !== expectedHash) {
            result.hashMismatches += 1;
            result.filesSkipped += 1;
            result.warnings.push(
              `Dosya Ã¶zeti uyuÅŸmadÄ±; dosya yazÄ±lmadÄ±: ${relativePath}`,
            );
            continue;
          }

          const absolute = path.resolve(questionBankRoot, relativePath);
          fs.mkdirSync(path.dirname(absolute), { recursive: true });

          if (fs.existsSync(absolute)) {
            const existingBuffer = fs.readFileSync(absolute);
            if (questionFileHash(existingBuffer) === actualHash) {
              result.filesMatched += 1;
              continue;
            }
            result.filesSkipped += 1;
            result.warnings.push(
              `AynÄ± dosya yolunda farklÄ± iÃ§erik bulundu; mevcut dosya korunuyor: ${relativePath}`,
            );
            continue;
          }

          const temp = `${absolute}.${crypto.randomBytes(6).toString("hex")}.restore.tmp`;
          fs.writeFileSync(temp, buffer, { flag: "wx" });
          fs.renameSync(temp, absolute);
          result.filesAdded += 1;
          continue;
        }
      }

      if (!result.backupId) {
        throw new Error("Yedek baÅŸlÄ±ÄŸÄ± bulunamadÄ±.");
      }

      rebuildQuestionBankIndex();
      recordQuestionAudit("backup-restored", result.backupId, {
        backupCreatedAt: result.backupCreatedAt,
        questionsAdded: result.questionsAdded,
        questionsMatched: result.questionsMatched,
        filesAdded: result.filesAdded,
        codeConflicts: result.codeConflicts.length,
      });

      return res.json({
        success: true,
        mode: "merge",
        ...result,
      });
    } catch (error) {
      console.error("Soru bankasÄ± yedekten geri yÃ¼kleme hatasÄ±:", error);
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Soru bankasÄ± yedeÄŸi geri yÃ¼klenemedi.",
      });
    }
  });

  app.post("/api/question-bank/maintenance/cleanup-missing", (_req, res) => {
    try {
      const active = allQuestionRecords().filter(
        (record) => String(record.status || "active") === "active",
      );

      let markedDeleted = 0;
      const affected: Array<{
        id: string;
        questionCode: string;
        previousStoragePath: string;
      }> = [];

      for (const record of active) {
        const storagePath = safeStoredQuestionPath(record.storagePath);
        const absolute = storagePath
          ? path.resolve(questionBankRoot, storagePath)
          : "";

        if (storagePath && fs.existsSync(absolute)) continue;

        const now = new Date().toISOString();
        const next = {
          ...record,
          status: "deleted",
          deletedAt: now,
          missingFileCleanup: true,
          originalStoragePath: storagePath || String(record.storagePath || ""),
          storagePath: "",
          imageUrl: "",
          updatedAt: now,
        };

        persistQuestionBankRecord(next);
        syncQuestionBankIndexRecord(next);
        recordQuestionAudit("missing-file-cleanup", record.id, {
          previousStoragePath: record.storagePath || "",
        });

        affected.push({
          id: String(record.id || ""),
          questionCode: String(record.questionCode || ""),
          previousStoragePath: String(record.storagePath || ""),
        });
        markedDeleted += 1;
      }

      rebuildQuestionBankIndex();

      return res.json({
        success: true,
        markedDeleted,
        affected,
      });
    } catch (error) {
      console.error("Eksik dosya kayÄ±t temizliÄŸi hatasÄ±:", error);
      return res.status(500).json({
        error: "Eksik dosya kayÄ±tlarÄ± temizlenemedi.",
      });
    }
  });

  app.post("/api/question-bank/maintenance/cleanup-orphans", (_req, res) => {
    try {
      const records = allQuestionRecords();
      const indexedPaths = new Set([
        ...records
          .flatMap((record) => [
            String(record.storagePath || ""),
            String(record.trashPath || ""),
            String(record.thumbnailPath || ""),
          ])
          .filter(Boolean),
        ...(listDocuments(QUESTION_BANK_EXAM_ARCHIVE_COLLECTION) as any[])
          .map((record) => String(record?.storagePath || ""))
          .filter(Boolean),
      ]);

      const orphanFiles: string[] = [];

      const walk = (dir: string, relative = "") => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          const rel = path.posix.join(relative, entry.name);

          if (entry.isDirectory()) {
            walk(full, rel);
            continue;
          }

          if (!entry.isFile()) continue;
          if (!indexedPaths.has(rel)) {
            orphanFiles.push(rel);
          }
        }
      };

      walk(questionBankRoot);

      let removed = 0;
      const failed: Array<{ path: string; error: string }> = [];

      for (const relativePath of orphanFiles) {
        try {
          const safePath = safeStoredQuestionPath(relativePath);
          if (!safePath) continue;
          const absolute = path.resolve(questionBankRoot, safePath);
          if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
            fs.unlinkSync(absolute);
            removed += 1;
          }
        } catch (error) {
          failed.push({
            path: relativePath,
            error: error instanceof Error ? error.message : "Silinemedi.",
          });
        }
      }

      return res.json({
        success: failed.length === 0,
        discovered: orphanFiles.length,
        removed,
        failed,
      });
    } catch (error) {
      console.error("Sahipsiz dosya temizliÄŸi hatasÄ±:", error);
      return res.status(500).json({
        error: "Sahipsiz dosyalar temizlenemedi.",
      });
    }
  });

  app.get("/api/question-bank/diagnostics", (_req, res) => {
    const startedAt = Date.now();
    const checks: Array<{
      id: string;
      label: string;
      status: "ok" | "warning" | "error";
      detail: string;
      value?: any;
    }> = [];

    const push = (
      id: string,
      label: string,
      status: "ok" | "warning" | "error",
      detail: string,
      value?: any,
    ) => checks.push({ id, label, status, detail, value });

    try {
      // MySQL eriÅŸimi.
      try {
        const quick = sqlite.prepare("SELECT 1 AS ok").get() as any;
        push(
          "mysql",
          "MySQL eriÅŸimi",
          Number(quick?.ok || 0) === 1 ? "ok" : "error",
          Number(quick?.ok || 0) === 1
            ? "MySQL sorgusu baÅŸarÄ±lÄ±."
            : "MySQL sorgusu beklenen sonucu vermedi.",
        );
      } catch (error) {
        push(
          "mysql",
          "MySQL eriÅŸimi",
          "error",
          error instanceof Error ? error.message : "MySQL eriÅŸilemedi.",
        );
      }

      // Veri dizini yazÄ±labilirlik testi.
      try {
        const probe = path.join(
          path.dirname(sqlitePath),
          `.question-bank-write-test-${crypto.randomBytes(5).toString("hex")}.tmp`,
        );
        fs.writeFileSync(probe, "ok", { flag: "wx" });
        fs.unlinkSync(probe);
        push(
          "data-write",
          "Veri dizini yazma izni",
          "ok",
          "Veri dizinine yazma ve silme testi baÅŸarÄ±lÄ±.",
        );
      } catch (error) {
        push(
          "data-write",
          "Veri dizini yazma izni",
          "error",
          error instanceof Error ? error.message : "Veri dizinine yazÄ±lamÄ±yor.",
        );
      }

      // Soru bankasÄ± klasÃ¶rleri.
      const folders = [
        { id: "bank-root", label: "Soru bankasÄ± klasÃ¶rÃ¼", dir: questionBankRoot },
        { id: "trash-root", label: "Ã‡Ã¶p kutusu klasÃ¶rÃ¼", dir: questionBankTrashRoot },
        { id: "thumb-root", label: "Thumbnail klasÃ¶rÃ¼", dir: questionBankThumbnailRoot },
      ];
      folders.forEach((item) => {
        const exists = fs.existsSync(item.dir);
        push(
          item.id,
          item.label,
          exists ? "ok" : "error",
          exists ? item.dir : `KlasÃ¶r bulunamadÄ±: ${item.dir}`,
        );
      });

      // Kaynak / indeks senkronu.
      const sourceRecords = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0);
      const indexedRecords = Number(
        (sqlite.prepare(
          "SELECT COUNT(*) AS count FROM question_bank_index",
        ).get() as any)?.count || 0,
      );
      push(
        "index-sync",
        "MySQL indeks senkronu",
        sourceRecords === indexedRecords ? "ok" : "warning",
        sourceRecords === indexedRecords
          ? `${indexedRecords} kayÄ±t indeks ile senkron.`
          : `Kaynak ${sourceRecords}, indeks ${indexedRecords}. Yeniden indeksleme Ã¶nerilir.`,
        { sourceRecords, indexedRecords },
      );

      // Aktif soru / kayÄ±p dosya / thumbnail kapsamÄ±.
      const records = allQuestionRecords();
      const active = records.filter(
        (record) => String(record.status || "active") === "active",
      );
      let missingFiles = 0;
      let thumbnailsReady = 0;

      active.forEach((record) => {
        const storagePath = safeStoredQuestionPath(record.storagePath);
        if (
          !storagePath ||
          !fs.existsSync(path.resolve(questionBankRoot, storagePath))
        ) {
          missingFiles += 1;
        }

        const thumbnailPath = safeStoredQuestionPath(record.thumbnailPath);
        if (
          thumbnailPath &&
          fs.existsSync(path.resolve(questionBankRoot, thumbnailPath))
        ) {
          thumbnailsReady += 1;
        }
      });

      push(
        "missing-files",
        "Fiziksel soru dosyalarÄ±",
        missingFiles === 0 ? "ok" : "error",
        missingFiles === 0
          ? `${active.length} aktif sorunun fiziksel dosyasÄ± hazÄ±r.`
          : `${missingFiles} aktif sorunun fiziksel dosyasÄ± bulunamÄ±yor.`,
        { activeQuestions: active.length, missingFiles },
      );

      const thumbnailRate =
        active.length > 0
          ? Math.round((thumbnailsReady / active.length) * 100)
          : 100;
      push(
        "thumbnails",
        "Thumbnail kapsamÄ±",
        thumbnailRate >= 95
          ? "ok"
          : thumbnailRate >= 70
            ? "warning"
            : "error",
        `${thumbnailsReady}/${active.length} aktif soru iÃ§in thumbnail hazÄ±r (%${thumbnailRate}).`,
        { thumbnailsReady, activeQuestions: active.length, thumbnailRate },
      );

      // Basit indeksli sorgu gecikmesi.
      try {
        const queryStartedAt = Date.now();
        sqlite.prepare(`
          SELECT question_id
          FROM question_bank_index
          WHERE status = 'active'
          ORDER BY updated_at DESC
          LIMIT 100
        `).all();
        const queryMs = Date.now() - queryStartedAt;
        push(
          "query-latency",
          "Ä°ndeksli sorgu performansÄ±",
          queryMs <= 150
            ? "ok"
            : queryMs <= 500
              ? "warning"
              : "error",
          `100 kayÄ±tlÄ±k indeksli sorgu ${queryMs} ms sÃ¼rdÃ¼.`,
          { queryMs },
        );
      } catch (error) {
        push(
          "query-latency",
          "Ä°ndeksli sorgu performansÄ±",
          "error",
          error instanceof Error ? error.message : "Test sorgusu Ã§alÄ±ÅŸmadÄ±.",
        );
      }

      // SHA-256 tekrar kontrolÃ¼.
      const duplicateHashRows = sqlite.prepare(`
        SELECT content_hash AS contentHash, COUNT(*) AS count
        FROM question_bank_index
        WHERE status = 'active'
          AND content_hash IS NOT NULL
          AND content_hash <> ''
        GROUP BY content_hash
        HAVING COUNT(*) > 1
        LIMIT 20
      `).all() as any[];

      push(
        "duplicate-hash",
        "MÃ¼kerrer gÃ¶rsel parmak izi",
        duplicateHashRows.length === 0 ? "ok" : "warning",
        duplicateHashRows.length === 0
          ? "Aktif soru bankasÄ±nda mÃ¼kerrer SHA-256 grubu bulunmadÄ±."
          : `${duplicateHashRows.length} mÃ¼kerrer SHA-256 grubu bulundu.`,
        { duplicateGroups: duplicateHashRows.length },
      );

      // Ä°Ã§e aktarma oturumlarÄ±nÄ±n durumu.
      const importSessions = listDocuments(
        QUESTION_BANK_IMPORT_SESSION_COLLECTION,
      ) as any[];
      const stuckSessions = importSessions.filter(
        (session) =>
          String(session.status || "") === "running" &&
          Date.now() - new Date(String(session.createdAt || 0)).getTime() >
            30 * 60 * 1000,
      );
      push(
        "import-sessions",
        "Ä°Ã§e aktarma oturumlarÄ±",
        stuckSessions.length === 0 ? "ok" : "warning",
        stuckSessions.length === 0
          ? `${importSessions.length} iÃ§e aktarma oturumunda takÄ±lÄ± kayÄ±t yok.`
          : `${stuckSessions.length} oturum 30 dakikadan uzun sÃ¼redir 'running' durumunda.`,
        { sessionCount: importSessions.length, stuckSessions: stuckSessions.length },
      );

      // Yedekleme iÃ§in gerekli kaynaklara eriÅŸim.
      const backupReadable =
        fs.existsSync(questionBankRoot) &&
        fs.existsSync(path.dirname(sqlitePath));
      push(
        "backup-readiness",
        "Yedekleme hazÄ±rlÄ±ÄŸÄ±",
        backupReadable ? "ok" : "error",
        backupReadable
          ? "MySQL ve soru dosyasÄ± dizinleri yedekleme iÃ§in eriÅŸilebilir."
          : "Yedekleme kaynaklarÄ±ndan biri eriÅŸilemiyor.",
      );

      const errors = checks.filter((item) => item.status === "error").length;
      const warnings = checks.filter((item) => item.status === "warning").length;

      return res.json({
        ready: errors === 0,
        grade:
          errors > 0
            ? "error"
            : warnings > 0
              ? "warning"
              : "ready",
        summary: {
          totalChecks: checks.length,
          ok: checks.filter((item) => item.status === "ok").length,
          warnings,
          errors,
          durationMs: Date.now() - startedAt,
        },
        checks,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Soru bankasÄ± tanÄ±lama hatasÄ±:", error);
      return res.status(500).json({
        error: "Soru bankasÄ± tanÄ±lama testi Ã§alÄ±ÅŸtÄ±rÄ±lamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/maintenance/optimize", (_req, res) => {
    try {
      const startedAt = Date.now();

      const rebuild = rebuildQuestionBankIndex();

      sqlite.exec("PRAGMA optimize");

      try {
        sqlite.exec("ANALYZE");
      } catch {}

      const integrity = (() => {
        const records = allQuestionRecords();
        const active = records.filter(
          (record) => String(record.status || "active") === "active",
        );

        const missingFiles = active.filter((record) => {
          const storagePath = safeStoredQuestionPath(record.storagePath);
          return !storagePath || !fs.existsSync(path.resolve(questionBankRoot, storagePath));
        });

        return {
          activeRecords: active.length,
          missingFiles: missingFiles.length,
        };
      })();

      return res.json({
        success: true,
        durationMs: Date.now() - startedAt,
        indexedRecords: rebuild.indexedRecords,
        sourceRecords: rebuild.sourceRecords,
        activeRecords: integrity.activeRecords,
        missingFiles: integrity.missingFiles,
      });
    } catch (error) {
      console.error("Soru bankasÄ± optimizasyon hatasÄ±:", error);
      return res.status(500).json({
        error: "Soru bankasÄ± optimize edilemedi.",
      });
    }
  });

  app.get("/api/question-bank/integrity", (_req, res) => {
    try {
      const records = allQuestionRecords();
      const active = records.filter((record) => String(record.status || "active") === "active");

      const missingFiles = active
        .filter((record) => {
          const storagePath = safeStoredQuestionPath(record.storagePath);
          return !storagePath || !fs.existsSync(path.resolve(questionBankRoot, storagePath));
        })
        .map((record) => ({ id: record.id, questionCode: record.questionCode, storagePath: record.storagePath }));

      const indexedPaths = new Set(active.map((record) => String(record.storagePath || "")).filter(Boolean));
      const orphanFiles: string[] = [];
      const walkFiles = (dir: string, relative = "") => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === ".trash" || entry.name === ".thumbs") continue;
          const full = path.join(dir, entry.name);
          const rel = path.posix.join(relative, entry.name);
          if (entry.isDirectory()) walkFiles(full, rel);
          else if (entry.isFile() && !indexedPaths.has(rel)) orphanFiles.push(rel);
        }
      };
      walkFiles(questionBankRoot);

      const hashGroups = new Map<string, any[]>();
      active.forEach((record) => {
        const hash = String(record.contentHash || "");
        if (!hash) return;
        const group = hashGroups.get(hash) || [];
        group.push(record);
        hashGroups.set(hash, group);
      });
      const duplicateHashes = [...hashGroups.entries()]
        .filter(([, group]) => group.length > 1)
        .map(([contentHash, group]) => ({
          contentHash,
          questions: group.map((item) => ({
            id: item.id, questionCode: item.questionCode, outcomeId: item.outcomeId,
          })),
        }));

      return res.json({
        ok: missingFiles.length === 0 && orphanFiles.length === 0 && duplicateHashes.length === 0,
        activeRecords: active.length,
        deletedRecords: records.length - active.length,
        missingFiles,
        orphanFiles,
        duplicateHashes,
      });
    } catch (error) {
      console.error("Soru bankasÄ± bÃ¼tÃ¼nlÃ¼k kontrolÃ¼ hatasÄ±:", error);
      return res.status(500).json({ error: "Soru bankasÄ± bÃ¼tÃ¼nlÃ¼k kontrolÃ¼ yapÄ±lamadÄ±." });
    }
  });

  app.get("/api/question-bank/capacity", (req, res) => {
    try {
      ensureQuestionBankIndexReady();

      const grade = String(req.query.grade || "").trim();
      const courseId = String(req.query.courseId || "").trim();
      const minimumStock = Math.max(0, Math.min(500, Number(req.query.minimumStock || 5)));

      const where: string[] = ["status = 'active'"];
      const params: any[] = [];

      if (grade) {
        where.push("grade = ?");
        params.push(Number(grade));
      }
      if (courseId) {
        where.push("course_id = ?");
        params.push(courseId);
      }

      const whereSql = `WHERE ${where.join(" AND ")}`;

      const totals = sqlite.prepare(`
        SELECT
          COUNT(*) AS totalQuestions,
          SUM(CASE WHEN use_count = 0 THEN 1 ELSE 0 END) AS unusedQuestions,
          SUM(CASE WHEN use_count > 0 THEN 1 ELSE 0 END) AS usedQuestions,
          COUNT(DISTINCT course_id) AS courseCount,
          COUNT(DISTINCT outcome_id) AS outcomeCount
        FROM question_bank_index
        ${whereSql}
      `).get(...params) as any;

      const outcomes = sqlite.prepare(`
        SELECT
          grade,
          course_id AS courseId,
          unit_id AS unitId,
          topic_id AS topicId,
          outcome_id AS outcomeId,
          COUNT(*) AS totalQuestions,
          SUM(CASE WHEN use_count = 0 THEN 1 ELSE 0 END) AS unusedQuestions,
          SUM(CASE WHEN use_count > 0 THEN 1 ELSE 0 END) AS usedQuestions,
          MIN(use_count) AS minUseCount,
          MAX(use_count) AS maxUseCount,
          AVG(use_count) AS avgUseCount
        FROM question_bank_index
        ${whereSql}
        GROUP BY grade, course_id, unit_id, topic_id, outcome_id
        ORDER BY grade, course_id, unit_id, topic_id, outcome_id
      `).all(...params) as any[];

      const courses = sqlite.prepare(`
        SELECT
          grade,
          course_id AS courseId,
          COUNT(*) AS totalQuestions,
          SUM(CASE WHEN use_count = 0 THEN 1 ELSE 0 END) AS unusedQuestions,
          COUNT(DISTINCT outcome_id) AS outcomeCount
        FROM question_bank_index
        ${whereSql}
        GROUP BY grade, course_id
        ORDER BY grade, course_id
      `).all(...params) as any[];

      const lowStock = outcomes
        .filter((item) => Number(item.unusedQuestions || 0) < minimumStock)
        .map((item) => ({
          ...item,
          shortage: Math.max(0, minimumStock - Number(item.unusedQuestions || 0)),
        }))
        .sort((a, b) =>
          Number(a.unusedQuestions || 0) - Number(b.unusedQuestions || 0),
        );

      return res.json({
        filters: {
          grade: grade ? Number(grade) : null,
          courseId: courseId || null,
          minimumStock,
        },
        totals: {
          totalQuestions: Number(totals?.totalQuestions || 0),
          unusedQuestions: Number(totals?.unusedQuestions || 0),
          usedQuestions: Number(totals?.usedQuestions || 0),
          courseCount: Number(totals?.courseCount || 0),
          outcomeCount: Number(totals?.outcomeCount || 0),
        },
        courses,
        outcomes,
        lowStock,
      });
    } catch (error) {
      console.error("Soru bankasÄ± kapasite analizi hatasÄ±:", error);
      return res.status(500).json({ error: "Soru bankasÄ± kapasite analizi yapÄ±lamadÄ±." });
    }
  });

  app.get("/api/question-bank/thumbnails/status", (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
      const offset = Math.max(0, Number(req.query.offset || 0));
      const activeRecords = allQuestionRecords().filter(
        (record) => String(record.status || "active") === "active",
      );

      const missing = activeRecords.filter((record) => {
        const thumbnailPath = safeStoredQuestionPath(record.thumbnailPath);
        if (!thumbnailPath) return true;
        const absolute = path.resolve(questionBankRoot, thumbnailPath);
        return !fs.existsSync(absolute);
      });

      return res.json({
        totalActive: activeRecords.length,
        missingCount: missing.length,
        readyCount: activeRecords.length - missing.length,
        limit,
        offset,
        questions: missing.slice(offset, offset + limit).map((record) => ({
          id: record.id,
          questionCode: record.questionCode,
          imageUrl: record.imageUrl,
          storagePath: record.storagePath,
          thumbnailUrl: record.thumbnailUrl || null,
          fileName: record.fileName,
        })),
      });
    } catch (error) {
      console.error("Thumbnail durum taramasÄ± hatasÄ±:", error);
      return res.status(500).json({ error: "Thumbnail durumu okunamadÄ±." });
    }
  });

  app.get("/api/question-bank/index/status", (_req, res) => {
    try {
      const sourceRecords = Number((sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0);
      const indexRow = sqlite.prepare(`
        SELECT
          COUNT(*) AS indexedRecords,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeIndexed,
          SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) AS deletedIndexed,
          SUM(use_count) AS totalUsage
        FROM question_bank_index
      `).get() as any;

      const indexes = sqlite.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = 'question_bank_index'
        ORDER BY name
      `).all() as Array<{ name: string }>;

      const indexedRecords = Number(indexRow?.indexedRecords || 0);
      return res.json({
        ok: sourceRecords === indexedRecords,
        engine: "mysql-index",
        sourceRecords,
        indexedRecords,
        activeIndexed: Number(indexRow?.activeIndexed || 0),
        deletedIndexed: Number(indexRow?.deletedIndexed || 0),
        totalUsage: Number(indexRow?.totalUsage || 0),
        indexCount: indexes.length,
        indexes: indexes.map((item) => item.name),
      });
    } catch (error) {
      return res.status(500).json({ error: "Soru bankasÄ± indeks durumu okunamadÄ±." });
    }
  });

  app.post("/api/question-bank/index/rebuild", (_req, res) => {
    try {
      const startedAt = Date.now();
      const result = rebuildQuestionBankIndex();
      return res.json({
        ok: result.indexedRecords === result.sourceRecords,
        ...result,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error("Soru bankasÄ± yeniden indeksleme hatasÄ±:", error);
      return res.status(500).json({ error: "Soru bankasÄ± yeniden indekslenemedi." });
    }
  });

  app.get("/api/question-bank/migration/recovery-plan", (_req, res) => {
    try {
      const state = getQuestionBankMigrationState();
      const currentVersion = currentQuestionBankSchemaVersion();
      const failed = String(state?.status || "") === "failed";
      return res.json({
        needed: failed,
        status: state?.status || "idle",
        currentVersion,
        targetVersion: QUESTION_BANK_SCHEMA_VERSION,
        backupPath: String(state?.backupPath || "") || null,
        databaseEngine: "mysql",
        lastError: state?.lastError || null,
        instructions: failed
          ? [
              "e-NstitÃ¼ backend sunucusunu tamamen kapatÄ±n.",
              "Mevcut MySQL veritabanÄ±nÄ± ayrÄ±ca yedekleyin.",
              "Migration Ã¶ncesi MySQL yedeÄŸini geri yÃ¼kleyin.",
              "Sunucuyu yeniden baÅŸlatÄ±n.",
              "Soru BankasÄ± SaÄŸlÄ±ÄŸÄ± ekranÄ±nda Åema SÃ¼rÃ¼mÃ¼ ve HazÄ±rlÄ±k Testini tekrar Ã§alÄ±ÅŸtÄ±rÄ±n.",
            ]
          : [],
      });
    } catch (error) {
      return res.status(500).json({
        error: "Migration kurtarma planÄ± oluÅŸturulamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/support-bundle", (_req, res) => {
    try {
      const generatedAt = new Date().toISOString();
      const gate = questionBankWriteGate();
      const readiness = validateQuestionBankWriteReadiness();

      const migrations = sqlite.prepare(`
        SELECT version, name, applied_at AS appliedAt
        FROM question_bank_schema_migrations
        ORDER BY version ASC
      `).all() as any[];

      const migrationState = getQuestionBankMigrationState();

      const startupAudit = sqlite.prepare(`
        SELECT
          id,
          checked_at AS checkedAt,
          schema_version AS schemaVersion,
          target_version AS targetVersion,
          migration_status AS migrationStatus,
          writable,
          source_records AS sourceRecords,
          indexed_records AS indexedRecords,
          active_records AS activeRecords,
          missing_files AS missingFiles,
          status
        FROM question_bank_startup_audit
        ORDER BY id DESC
        LIMIT 20
      `).all() as any[];

      const indexStats = sqlite.prepare(`
        SELECT
          COUNT(*) AS indexedRecords,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeIndexed,
          SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END) AS deletedIndexed,
          SUM(use_count) AS totalUsage
        FROM question_bank_index
      `).get() as any;

      const activeRecords = allQuestionRecords().filter(
        (record) => String(record.status || "active") === "active",
      );

      let thumbnailsReady = 0;
      let missingFiles = 0;

      activeRecords.forEach((record) => {
        const storagePath = safeStoredQuestionPath(record.storagePath);
        if (
          !storagePath ||
          !fs.existsSync(path.resolve(questionBankRoot, storagePath))
        ) {
          missingFiles += 1;
        }

        const thumbnailPath = safeStoredQuestionPath(record.thumbnailPath);
        if (
          thumbnailPath &&
          fs.existsSync(path.resolve(questionBankRoot, thumbnailPath))
        ) {
          thumbnailsReady += 1;
        }
      });

      const duplicateHashGroups = sqlite.prepare(`
        SELECT COUNT(*) AS groups
        FROM (
          SELECT content_hash
          FROM question_bank_index
          WHERE status = 'active'
            AND content_hash IS NOT NULL
            AND content_hash <> ''
          GROUP BY content_hash
          HAVING COUNT(*) > 1
        ) AS duplicate_hash_groups
      `).get() as any;

      const importSessions = (listDocuments(
        QUESTION_BANK_IMPORT_SESSION_COLLECTION,
      ) as any[])
        .sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
        )
        .slice(0, 20)
        .map((session) => ({
          id: session.id,
          label: session.label,
          status: session.status,
          expectedFiles: session.expectedFiles,
          importedFiles: session.importedFiles,
          completedOutcomes: session.completedOutcomes,
          failedGroups: session.failedGroups,
          createdAt: session.createdAt,
          completedAt: session.completedAt,
          rollbackAt: session.rollbackAt,
        }));

      const bundle = {
        format: "e-nstitu-question-bank-support-bundle",
        version: 1,
        generatedAt,
        privacy: {
          containsDatabase: false,
          containsQuestionImages: false,
          containsStudentData: false,
          containsTeacherData: false,
          containsQuestionText: false,
        },
        application: {
          schemaVersion: currentQuestionBankSchemaVersion(),
          targetSchemaVersion: QUESTION_BANK_SCHEMA_VERSION,
          databaseEngine: "mysql",
          questionBankDirectoryName: path.basename(questionBankRoot),
        },
        writeState: {
          readOnly: !gate.writable,
          ...gate,
        },
        readiness,
        migration: {
          state: migrationState || null,
          migrations,
        },
        index: {
          sourceRecords: Number((sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_questions").get() as any)?.count || 0),
          indexedRecords: Number(indexStats?.indexedRecords || 0),
          activeIndexed: Number(indexStats?.activeIndexed || 0),
          deletedIndexed: Number(indexStats?.deletedIndexed || 0),
          totalUsage: Number(indexStats?.totalUsage || 0),
        },
        files: {
          activeRecords: activeRecords.length,
          missingFiles,
          thumbnailsReady,
          thumbnailCoveragePercent:
            activeRecords.length > 0
              ? Math.round((thumbnailsReady / activeRecords.length) * 100)
              : 100,
        },
        duplicateHashGroups: Number(duplicateHashGroups?.groups || 0),
        orphanFiles: (() => {
          const scan = scanQuestionBankOrphanFiles();
          return {
            orphanCount: scan.orphanCount,
            orphanBytes: scan.orphanBytes,
          };
        })(),
        quarantine: (() => {
          const inventory = listQuestionBankQuarantine();
          return {
            count: inventory.count,
            totalBytes: inventory.totalBytes,
          };
        })(),
        integrityChange: (() => {
          const changes = questionBankIntegrityChanges(2);
          return changes.latest
            ? {
                severity: changes.latest.severity,
                reasons: changes.latest.reasons,
                delta: changes.latest.delta,
              }
            : null;
        })(),
        integrityRecommendations:
          questionBankIntegrityRecommendations(),
        healthScore: calculateQuestionBankHealthScore(),
        healthScoreTrend:
          analyzeQuestionBankHealthScoreTrend(30),
        datasetProfile:
          questionBankDatasetProfile(),
        productionReadiness:
          getQuestionBankProductionReadiness(),
        disasterRecovery: {
          drillEnabled: true,
          liveRestoreEnabled: false,
          requiresVerifiedBackup: true,
          usesReadonlyBackupDatabase: true,
        },
        coordinatedBackup: {
          enabled: true,
          includesDatabase: true,
          includesQuestionFiles: true,
          includesManifestHashes: true,
          restoreRequiresOfflineValidation: true,
        },
        performanceBenchmark:
          runQuestionBankPerformanceBenchmark(),
        databaseOptimization:
          analyzeQuestionBankDatabaseOptimization(),
        queryPlanAnalysis:
          analyzeQuestionBankQueryPlans(),
        indexRecommendations:
          recommendQuestionBankIndexes(),
        indexEffectiveness:
          verifyQuestionBankIndexEffectiveness(),
        maintenancePreview:
          runQuestionBankMaintenanceOrchestrator({
            applySafeFixes: false,
          }),
        performanceHistory: (() => {
          const history = listQuestionBankPerformanceHistory(10);
          return {
            latest: history.latest,
            previous: history.previous,
            averageDelta: history.averageDelta,
            slowestDelta: history.slowestDelta,
            regression: history.regression,
            improvement: history.improvement,
            trend: history.trend,
          };
        })(),
        healthScoreHistory: (() => {
          const history = listQuestionBankHealthScoreHistory(10);
          return {
            latest: history.latest,
            previous: history.previous,
            delta: history.delta,
            trend: history.trend,
          };
        })(),
        safeActionAudit: {
          total: Number(
            (sqlite.prepare(`
              SELECT COUNT(*) AS count
              FROM question_bank_safe_action_audit
            `).get() as any)?.count || 0,
          ),
          failed: Number(
            (sqlite.prepare(`
              SELECT COUNT(*) AS count
              FROM question_bank_safe_action_audit
              WHERE status = 'failed'
            `).get() as any)?.count || 0,
          ),
          recent: listQuestionBankSafeActionAudit(20).map((item) => ({
            id: item.id,
            actionId: item.actionId,
            label: item.label,
            status: item.status,
            startedAt: item.startedAt,
            completedAt: item.completedAt,
            durationMs: item.durationMs,
            error: item.error || null,
          })),
        },
        writeJournal: (() => {
          const rows = sqlite.prepare(`
            SELECT status, COUNT(*) AS count
            FROM question_bank_write_journal
            GROUP BY status
          `).all() as any[];
          return Object.fromEntries(
            rows.map((item) => [
              String(item.status),
              Number(item.count || 0),
            ]),
          );
        })(),
        startupAudit: startupAudit.map((item) => ({
          ...item,
          writable: Boolean(item.writable),
        })),
        importSessions,
      };

      const fileName = `e-nstitu-question-bank-support-${generatedAt
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "")}.json`;

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(JSON.stringify(bundle, null, 2));
    } catch (error) {
      console.error("Soru bankasÄ± destek paketi hatasÄ±:", error);
      return res.status(500).json({
        error: "Soru bankasÄ± destek paketi oluÅŸturulamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/safe-actions/:actionId/run", async (req, res) => {
    const actionId = String(req.params.actionId || "");

    const catalog: Record<
      string,
      { label: string; destructive: boolean; run: () => any }
    > = {
      "integrity-snapshot": {
        label: "Yeni bÃ¼tÃ¼nlÃ¼k kaydÄ± oluÅŸtur",
        destructive: false,
        run: () => createQuestionBankIntegritySnapshot(),
      },
      "recover-writes": {
        label: "YarÄ±m yazmalarÄ± kurtar",
        destructive: false,
        run: () => recoverPendingQuestionBankWrites(),
      },
      "quarantine-orphans": {
        label: "Sahipsiz dosyalarÄ± karantinaya al",
        destructive: false,
        run: () => quarantineQuestionBankOrphans(),
      },
      "coordinated-backup": {
        label: "Soru bankasÄ± tutarlÄ± yedeÄŸi oluÅŸtur",
        destructive: false,
        run: () => createQuestionBankCoordinatedBackup(),
      },
      "maintenance-orchestrator": {
        label: "Soru bankasÄ± gÃ¼venli bakÄ±m orkestrasyonu",
        destructive: false,
        run: () =>
          runQuestionBankMaintenanceOrchestrator({
            applySafeFixes: true,
          }),
      },
      "apply-recommended-indexes": {
        label: "Ã–nerilen soru bankasÄ± indekslerini uygula",
        destructive: false,
        run: () => applyQuestionBankRecommendedIndexes(),
      },
      "database-analyze": {
        label: "MySQL ANALYZE Ã§alÄ±ÅŸtÄ±r",
        destructive: false,
        run: () => runQuestionBankDatabaseAnalyze(),
      },
      "safe-mode-recheck": {
        label: "GÃ¼venli modu yeniden kontrol et",
        destructive: false,
        run: () => {
          let readiness = validateQuestionBankWriteReadiness();
          const indexCheck = readiness.checks.find(
            (check) => check.id === "index",
          );
          if (indexCheck && !indexCheck.ok) {
            rebuildQuestionBankIndex();
            readiness = validateQuestionBankWriteReadiness();
          }

          if (readiness.ready) {
            const now = new Date().toISOString();
            setQuestionBankMigrationState({
              targetVersion: QUESTION_BANK_SCHEMA_VERSION,
              currentVersion: currentQuestionBankSchemaVersion(),
              status: "completed",
              backupPath:
                getQuestionBankMigrationState()?.backupPath || null,
              lastError: null,
              startedAt:
                getQuestionBankMigrationState()?.startedAt || null,
              completedAt: now,
            });
          }

          const gate = questionBankWriteGate();
          return {
            success: readiness.ready && gate.writable,
            readOnly: !gate.writable,
            readiness,
            gate,
          };
        },
      },
    };

    const action = catalog[actionId];
    if (!action || action.destructive) {
      return res.status(400).json({
        error: "Bu iÅŸlem gÃ¼venli otomatik eylem olarak Ã§alÄ±ÅŸtÄ±rÄ±lamaz.",
      });
    }

    const audit = beginQuestionBankSafeActionAudit(
      actionId,
      action.label,
    );

    try {
      const result = await action.run();
      finishQuestionBankSafeActionAudit(audit, {
        status: "success",
        result,
      });
      return res.json({
        success: true,
        actionId,
        label: action.label,
        result,
        auditId: audit.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      finishQuestionBankSafeActionAudit(audit, {
        status: "failed",
        error: message,
      });

      return res.status(500).json({
        error: message || "GÃ¼venli iÅŸlem tamamlanamadÄ±.",
        actionId,
        auditId: audit.id,
      });
    }
  });

  app.get("/api/question-bank/safe-actions/audit", (req, res) => {
    const limit = Number.parseInt(String(req.query.limit || "50"), 10);
    return res.json({
      items: listQuestionBankSafeActionAudit(limit),
    });
  });

  app.get("/api/question-bank/safe-actions/audit/export", (req, res) => {
    try {
      const status = String(req.query.status || "").trim();
      const limit = Math.min(
        Math.max(Number.parseInt(String(req.query.limit || "500"), 10) || 500, 1),
        5000,
      );

      let items = listQuestionBankSafeActionAudit(limit);
      if (status) {
        items = items.filter(
          (item) => String(item.status || "") === status,
        );
      }

      const generatedAt = new Date().toISOString();
      const payload = {
        format: "e-nstitu-question-bank-safe-action-audit",
        version: 1,
        generatedAt,
        filter: {
          status: status || null,
          limit,
        },
        count: items.length,
        items: items.map((item) => ({
          id: item.id,
          actionId: item.actionId,
          label: item.label,
          status: item.status,
          startedAt: item.startedAt,
          completedAt: item.completedAt,
          durationMs: item.durationMs,
          error: item.error || null,
          result: item.result || null,
        })),
      };

      const fileName = `e-nstitu-safe-action-audit-${generatedAt
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "")}.json`;

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`,
      );
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(JSON.stringify(payload, null, 2));
    } catch (error) {
      return res.status(500).json({
        error: "GÃ¼venli eylem denetim kaydÄ± dÄ±ÅŸa aktarÄ±lamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/safe-actions/audit/cleanup", (req, res) => {
    try {
      const retentionDays = Number(req.body?.retentionDays || 90);
      return res.json(
        cleanupQuestionBankSafeActionAudit(retentionDays),
      );
    } catch (error) {
      return res.status(500).json({
        error: "GÃ¼venli eylem geÃ§miÅŸi temizlenemedi.",
      });
    }
  });

  app.get("/api/question-bank/safe-actions", (_req, res) => {
    return res.json({
      actions: [
        {
          id: "integrity-snapshot",
          label: "Yeni bÃ¼tÃ¼nlÃ¼k kaydÄ± oluÅŸtur",
          method: "POST",
          endpoint: "/api/question-bank/integrity-history/run",
          destructive: false,
          reversible: true,
        },
        {
          id: "recover-writes",
          label: "YarÄ±m yazmalarÄ± kurtar",
          method: "POST",
          endpoint: "/api/question-bank/write-journal/recover",
          destructive: false,
          reversible: true,
        },
        {
          id: "quarantine-orphans",
          label: "Sahipsiz dosyalarÄ± karantinaya al",
          method: "POST",
          endpoint: "/api/question-bank/orphans/quarantine",
          destructive: false,
          reversible: true,
        },
        {
          id: "safe-mode-recheck",
          label: "GÃ¼venli modu yeniden kontrol et",
          method: "POST",
          endpoint: "/api/question-bank/safe-mode/recheck",
          destructive: false,
          reversible: true,
        },
        {
          id: "coordinated-backup",
          label: "TutarlÄ± soru bankasÄ± yedeÄŸi oluÅŸtur",
          method: "POST",
          endpoint: "/api/question-bank/coordinated-backup",
          destructive: false,
          reversible: true,
        },
        {
          id: "maintenance-orchestrator",
          label: "GÃ¼venli bakÄ±m orkestrasyonunu Ã§alÄ±ÅŸtÄ±r",
          method: "POST",
          endpoint: "/api/question-bank/maintenance-orchestrator/run",
          destructive: false,
          reversible: true,
        },
        {
          id: "apply-recommended-indexes",
          label: "Ã–nerilen indeksleri uygula",
          method: "POST",
          endpoint: "/api/question-bank/index-recommendations/apply",
          destructive: false,
          reversible: true,
        },
        {
          id: "database-analyze",
          label: "MySQL ANALYZE Ã§alÄ±ÅŸtÄ±r",
          method: "POST",
          endpoint: "/api/question-bank/database-optimization/analyze",
          destructive: false,
          reversible: true,
        },
        {
          id: "support-bundle",
          label: "Teknik destek raporu indir",
          method: "GET",
          endpoint: "/api/question-bank/support-bundle",
          destructive: false,
          reversible: true,
        },
      ],
    });
  });

  app.get("/api/question-bank/production-readiness", (_req, res) => {
    try {
      return res.json(getQuestionBankProductionReadiness());
    } catch (error) {
      return res.status(500).json({ error: "Soru bankasÄ± Ã¼retim hazÄ±rlÄ±ÄŸÄ± denetlenemedi." });
    }
  });

  app.post("/api/question-bank/disaster-recovery/drill", (req, res) => {
    const audit = beginQuestionBankSafeActionAudit(
      "disaster-recovery-drill",
      "Soru bankasÄ± felaket kurtarma provasÄ±",
    );
    try {
      const backupRoot = String(req.body?.backupRoot || "");
      if (!backupRoot) throw new Error("Yedek klasÃ¶rÃ¼ belirtilmedi.");
      const result = runQuestionBankDisasterRecoveryDrill(backupRoot);
      finishQuestionBankSafeActionAudit(audit, {
        status: result.success ? "success" : "failed",
        result: { recoverability: result.recoverability || false, stage: result.stage, backup: result.backup || null },
      });
      return res.status(result.success ? 200 : 409).json({ ...result, auditId: audit.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finishQuestionBankSafeActionAudit(audit, { status: "failed", error: message });
      return res.status(400).json({ error: message || "Felaket kurtarma provasÄ± tamamlanamadÄ±.", auditId: audit.id });
    }
  });

  app.post("/api/question-bank/coordinated-backup", (_req, res) => {
    const audit = beginQuestionBankSafeActionAudit(
      "coordinated-backup",
      "Soru bankasÄ± tutarlÄ± yedeÄŸi oluÅŸtur",
    );

    try {
      const result = createQuestionBankCoordinatedBackup();

      finishQuestionBankSafeActionAudit(audit, {
        status: "success",
        result: {
          backupRoot: result.backupRoot,
          complete: result.complete,
          activeRecords:
            result.manifest.questionBank.activeRecords,
          copiedFiles:
            result.manifest.questionBank.copiedFiles,
          missingFiles:
            result.manifest.questionBank.missingFiles,
        },
      });

      return res.json({
        ...result,
        auditId: audit.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      finishQuestionBankSafeActionAudit(audit, {
        status: "failed",
        error: message,
      });

      return res.status(500).json({
        error:
          message ||
          "Soru bankasÄ± tutarlÄ± yedeÄŸi oluÅŸturulamadÄ±.",
        auditId: audit.id,
      });
    }
  });

  app.post("/api/question-bank/coordinated-backup/verify", (req, res) => {
    try {
      const backupRoot = String(req.body?.backupRoot || "");
      return res.json(
        verifyQuestionBankCoordinatedBackup(backupRoot),
      );
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Soru bankasÄ± yedeÄŸi doÄŸrulanamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/dataset-profile", (_req, res) => {
    try {
      return res.json(questionBankDatasetProfile());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± veri hacmi profili oluÅŸturulamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/maintenance-orchestrator/preview", (_req, res) => {
    try {
      return res.json(
        runQuestionBankMaintenanceOrchestrator({
          applySafeFixes: false,
        }),
      );
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± bakÄ±m Ã¶n izlemesi oluÅŸturulamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/maintenance-orchestrator/run", (_req, res) => {
    const audit = beginQuestionBankSafeActionAudit(
      "maintenance-orchestrator",
      "Soru bankasÄ± gÃ¼venli bakÄ±m orkestrasyonu",
    );

    try {
      const result = runQuestionBankMaintenanceOrchestrator({
        applySafeFixes: true,
      });

      finishQuestionBankSafeActionAudit(audit, {
        status: "success",
        result: {
          status: result.status,
          summary: result.summary,
          criticalReasons: result.criticalReasons,
        },
      });

      return res.json({
        ...result,
        auditId: audit.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      finishQuestionBankSafeActionAudit(audit, {
        status: "failed",
        error: message,
      });

      return res.status(500).json({
        error: message || "Soru bankasÄ± gÃ¼venli bakÄ±m orkestrasyonu tamamlanamadÄ±.",
        auditId: audit.id,
      });
    }
  });

  app.get("/api/question-bank/index-effectiveness", (_req, res) => {
    try {
      return res.json(verifyQuestionBankIndexEffectiveness());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± indeks etkinliÄŸi doÄŸrulanamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/index-recommendations", (_req, res) => {
    try {
      return res.json(recommendQuestionBankIndexes());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± indeks Ã¶nerileri oluÅŸturulamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/index-recommendations/apply", (_req, res) => {
    const audit = beginQuestionBankSafeActionAudit(
      "apply-recommended-indexes",
      "Ã–nerilen soru bankasÄ± indekslerini uygula",
    );

    try {
      const result = applyQuestionBankRecommendedIndexes();
      finishQuestionBankSafeActionAudit(audit, {
        status: "success",
        result,
      });
      return res.json({ ...result, auditId: audit.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      finishQuestionBankSafeActionAudit(audit, {
        status: "failed",
        error: message,
      });
      return res.status(500).json({
        error: message || "Ã–nerilen indeksler uygulanamadÄ±.",
        auditId: audit.id,
      });
    }
  });

  app.get("/api/question-bank/query-plan-analysis", (_req, res) => {
    try {
      return res.json(analyzeQuestionBankQueryPlans());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± sorgu planÄ± analizi yapÄ±lamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/database-optimization", (_req, res) => {
    try {
      return res.json(analyzeQuestionBankDatabaseOptimization());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± veritabanÄ± optimizasyon analizi yapÄ±lamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/database-optimization/analyze", (_req, res) => {
    const audit = beginQuestionBankSafeActionAudit(
      "database-analyze",
      "MySQL ANALYZE Ã§alÄ±ÅŸtÄ±r",
    );

    try {
      const result = runQuestionBankDatabaseAnalyze();
      finishQuestionBankSafeActionAudit(audit, {
        status: "success",
        result,
      });
      return res.json({ ...result, auditId: audit.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      finishQuestionBankSafeActionAudit(audit, {
        status: "failed",
        error: message,
      });
      return res.status(500).json({
        error: message || "MySQL ANALYZE tamamlanamadÄ±.",
        auditId: audit.id,
      });
    }
  });

  app.get("/api/question-bank/performance-history", (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit || "30"), 10);
      return res.json(
        listQuestionBankPerformanceHistory(limit),
      );
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± performans geÃ§miÅŸi okunamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/performance-history/run", (_req, res) => {
    try {
      const recorded = recordQuestionBankPerformanceBenchmark();
      const history = listQuestionBankPerformanceHistory(30);
      return res.json({
        recorded,
        history,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± performans kaydÄ± oluÅŸturulamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/performance-benchmark", (_req, res) => {
    try {
      return res.json(runQuestionBankPerformanceBenchmark());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± performans testi Ã§alÄ±ÅŸtÄ±rÄ±lamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/health-score/trend", (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit || "30"), 10);
      return res.json(analyzeQuestionBankHealthScoreTrend(limit));
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± saÄŸlÄ±k puanÄ± trendi analiz edilemedi.",
      });
    }
  });

  app.get("/api/question-bank/health-score/history", (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit || "30"), 10);
      return res.json(
        listQuestionBankHealthScoreHistory(limit),
      );
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± saÄŸlÄ±k puanÄ± geÃ§miÅŸi okunamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/health-score/history/run", (_req, res) => {
    try {
      const recorded = recordQuestionBankHealthScore();
      const history = listQuestionBankHealthScoreHistory(30);
      return res.json({
        recorded,
        history,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± saÄŸlÄ±k puanÄ± kaydÄ± oluÅŸturulamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/health-score", (_req, res) => {
    try {
      return res.json(calculateQuestionBankHealthScore());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± saÄŸlÄ±k puanÄ± hesaplanamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/integrity-recommendations", (_req, res) => {
    try {
      return res.json(questionBankIntegrityRecommendations());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± bakÄ±m Ã¶nerileri oluÅŸturulamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/integrity-changes", (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit || "30"), 10);
      return res.json(questionBankIntegrityChanges(limit));
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± bÃ¼tÃ¼nlÃ¼k deÄŸiÅŸimleri analiz edilemedi.",
      });
    }
  });

  app.get("/api/question-bank/integrity-history", (req, res) => {
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit || "30"), 10) || 30, 1),
      100,
    );

    const items = sqlite.prepare(`
      SELECT
        id,
        checked_at AS checkedAt,
        active_records AS activeRecords,
        indexed_records AS indexedRecords,
        missing_files AS missingFiles,
        orphan_files AS orphanFiles,
        quarantine_files AS quarantineFiles,
        duplicate_hash_groups AS duplicateHashGroups,
        pending_writes AS pendingWrites,
        failed_writes AS failedWrites,
        status
      FROM question_bank_integrity_snapshot
      ORDER BY id DESC
      LIMIT ?
    `).all(limit) as any[];

    return res.json({ items });
  });

  app.post("/api/question-bank/integrity-history/run", (_req, res) => {
    try {
      return res.json(createQuestionBankIntegritySnapshot());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± bÃ¼tÃ¼nlÃ¼k anlÄ±k gÃ¶rÃ¼ntÃ¼sÃ¼ oluÅŸturulamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/orphans/quarantine/purge", (req, res) => {
    try {
      const retentionDays = Number(req.body?.retentionDays || 30);
      return res.json(
        purgeQuestionBankQuarantine(retentionDays),
      );
    } catch (error) {
      return res.status(500).json({
        error: "Eski karantina dosyalarÄ± temizlenemedi.",
      });
    }
  });

  app.get("/api/question-bank/orphans/quarantine", (_req, res) => {
    try {
      return res.json(listQuestionBankQuarantine());
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± karantina alanÄ± okunamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/orphans/quarantine/restore", (req, res) => {
    try {
      const quarantinePath = String(req.body?.quarantinePath || "");
      return res.json(
        restoreQuestionBankQuarantineFile(quarantinePath),
      );
    } catch (error) {
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Karantina dosyasÄ± geri yÃ¼klenemedi.",
      });
    }
  });

  app.get("/api/question-bank/orphans/scan", (_req, res) => {
    try {
      return res.json(scanQuestionBankOrphanFiles());
    } catch (error) {
      return res.status(500).json({
        error: "Sahipsiz soru dosyalarÄ± taranamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/orphans/quarantine", (_req, res) => {
    try {
      return res.json(quarantineQuestionBankOrphans());
    } catch (error) {
      return res.status(500).json({
        error: "Sahipsiz soru dosyalarÄ± karantinaya alÄ±namadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/write-journal/cleanup", (req, res) => {
    try {
      const retentionDays = Number(req.body?.retentionDays || 30);
      return res.json(cleanupQuestionBankWriteJournal(retentionDays));
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± yazma gÃ¼nlÃ¼ÄŸÃ¼ temizlenemedi.",
      });
    }
  });

  app.get("/api/question-bank/write-journal/status", (_req, res) => {
    const counts = sqlite.prepare(`
      SELECT status, COUNT(*) AS count
      FROM question_bank_write_journal
      GROUP BY status
      ORDER BY status
    `).all() as any[];

    const recent = sqlite.prepare(`
      SELECT
        id,
        operation,
        question_id AS questionId,
        question_code AS questionCode,
        target_path AS targetPath,
        status,
        error,
        created_at AS createdAt,
        committed_at AS committedAt,
        recovered_at AS recoveredAt,
        updated_at AS updatedAt
      FROM question_bank_write_journal
      ORDER BY created_at DESC
      LIMIT 30
    `).all() as any[];

    const countMap = Object.fromEntries(
      counts.map((item) => [String(item.status), Number(item.count || 0)]),
    );

    return res.json({
      counts: countMap,
      healthy:
        Number(countMap.pending || 0) === 0 &&
        Number(countMap["recovery-failed"] || 0) === 0,
      recent,
    });
  });

  app.post("/api/question-bank/write-journal/recover", (_req, res) => {
    try {
      return res.json(recoverPendingQuestionBankWrites());
    } catch (error) {
      return res.status(500).json({
        error: "YarÄ±m kalmÄ±ÅŸ soru bankasÄ± yazÄ±mlarÄ± kurtarÄ±lamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/startup-audit", (req, res) => {
    const limit = Math.min(
      Math.max(Number.parseInt(String(req.query.limit || "20"), 10) || 20, 1),
      100,
    );

    const items = sqlite.prepare(`
      SELECT
        id,
        checked_at AS checkedAt,
        schema_version AS schemaVersion,
        target_version AS targetVersion,
        migration_status AS migrationStatus,
        writable,
        source_records AS sourceRecords,
        indexed_records AS indexedRecords,
        active_records AS activeRecords,
        missing_files AS missingFiles,
        status,
        details_json AS detailsJson
      FROM question_bank_startup_audit
      ORDER BY id DESC
      LIMIT ?
    `).all(limit) as any[];

    return res.json({
      items: items.map((item) => ({
        ...item,
        writable: Boolean(item.writable),
        details: (() => {
          try {
            return JSON.parse(String(item.detailsJson || "[]"));
          } catch {
            return [];
          }
        })(),
      })),
    });
  });

  app.post("/api/question-bank/startup-audit/run", (_req, res) => {
    try {
      return res.json(recordQuestionBankStartupAudit());
    } catch (error) {
      console.error("Soru bankasÄ± baÅŸlangÄ±Ã§ denetimi hatasÄ±:", error);
      return res.status(500).json({
        error: "Soru bankasÄ± baÅŸlangÄ±Ã§ denetimi tamamlanamadÄ±.",
      });
    }
  });

  app.post("/api/question-bank/safe-mode/recheck", (_req, res) => {
    try {
      let readiness = validateQuestionBankWriteReadiness();

      // Ä°ndeks tek baÅŸÄ±na geride kaldÄ±ysa gÃ¼venli biÃ§imde yeniden oluÅŸtur.
      const indexCheck = readiness.checks.find((check) => check.id === "index");
      if (indexCheck && !indexCheck.ok) {
        rebuildQuestionBankIndex();
        readiness = validateQuestionBankWriteReadiness();
      }

      if (readiness.ready) {
        const now = new Date().toISOString();
        setQuestionBankMigrationState({
          targetVersion: QUESTION_BANK_SCHEMA_VERSION,
          currentVersion: currentQuestionBankSchemaVersion(),
          status: "completed",
          backupPath: getQuestionBankMigrationState()?.backupPath || null,
          lastError: null,
          startedAt: getQuestionBankMigrationState()?.startedAt || null,
          completedAt: now,
        });
      }

      const gate = questionBankWriteGate();

      return res.json({
        success: readiness.ready && gate.writable,
        readOnly: !gate.writable,
        readiness,
        gate,
      });
    } catch (error) {
      console.error("Soru bankasÄ± gÃ¼venli mod yeniden kontrol hatasÄ±:", error);
      return res.status(500).json({
        error: "GÃ¼venli mod yeniden kontrolÃ¼ tamamlanamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/write-state", (_req, res) => {
    const gate = questionBankWriteGate();
    const readiness = validateQuestionBankWriteReadiness();
    return res.json({
      readOnly: !gate.writable,
      ...gate,
      readiness,
    });
  });

  app.get("/api/question-bank/version", (_req, res) => {
    try {
      const migrations = sqlite.prepare(`
        SELECT version, name, applied_at AS appliedAt
        FROM question_bank_schema_migrations
        ORDER BY version ASC
      `).all() as Array<{
        version: number;
        name: string;
        appliedAt: string;
      }>;

      const currentVersion =
        migrations.length > 0
          ? Math.max(...migrations.map((item) => Number(item.version || 0)))
          : 0;

      const migrationState = getQuestionBankMigrationState();
      const pendingVersions = migrations.length > 0
        ? Array.from(
            { length: QUESTION_BANK_SCHEMA_VERSION },
            (_, index) => index + 1,
          ).filter(
            (version) =>
              version > currentVersion &&
              [12, 13, 24, 25, 32].includes(version),
          )
        : [12, 13, 24, 25, 32].filter((version) => version > currentVersion);

      return res.json({
        schemaVersion: currentVersion,
        targetSchemaVersion: QUESTION_BANK_SCHEMA_VERSION,
        upToDate: currentVersion >= QUESTION_BANK_SCHEMA_VERSION,
        migrationCount: migrations.length,
        pendingVersions,
        safety: {
          status:
            migrationState?.status ||
            (currentVersion >= QUESTION_BANK_SCHEMA_VERSION
              ? "completed"
              : "idle"),
          backupPath: migrationState?.backupPath || null,
          lastError: migrationState?.lastError || null,
          startedAt: migrationState?.startedAt || null,
          completedAt: migrationState?.completedAt || null,
        },
        writeGate: questionBankWriteGate(),
        migrations,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Soru bankasÄ± ÅŸema sÃ¼rÃ¼mÃ¼ okunamadÄ±.",
      });
    }
  });

  app.get("/api/question-bank/status", (_req, res) => {
    const walk = (dir: string): { files: number; bytes: number } => {
      let files = 0, bytes = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === ".trash" || entry.name === ".thumbs") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const child = walk(full);
          files += child.files;
          bytes += child.bytes;
        } else if (entry.isFile()) {
          files += 1;
          bytes += fs.statSync(full).size;
        }
      }
      return { files, bytes };
    };
    const stats = walk(questionBankRoot);
    const thumbnailStats = (() => {
      let files = 0;
      let bytes = 0;
      if (fs.existsSync(questionBankThumbnailRoot)) {
        for (const entry of fs.readdirSync(questionBankThumbnailRoot, { withFileTypes: true })) {
          if (!entry.isFile()) continue;
          files += 1;
          bytes += fs.statSync(path.join(questionBankThumbnailRoot, entry.name)).size;
        }
      }
      return { files, bytes };
    })();
    const records = allQuestionRecords();
    res.json({
      ok: true,
      root: questionBankRoot,
      ...stats,
      activeRecords: records.filter((record) => String(record.status || "active") === "active").length,
      deletedRecords: records.filter((record) => String(record.status || "") === "deleted").length,
      indexedRecords: Number(
        (sqlite.prepare("SELECT COUNT(*) AS count FROM question_bank_index").get() as any)?.count || 0,
      ),
      queryEngine: "mysql-index",
      thumbnailFiles: thumbnailStats.files,
      thumbnailBytes: thumbnailStats.bytes,
    });
  });

  app.get("/api/database/status", (_req, res) => {
    res.json({ status: "ok", ...getDocumentStoreStatus(), relationalAuth: Boolean(relationalAuthState) });
  });

  app.get("/api/network-info", (_req, res) => {
    const addresses = Object.values(os.networkInterfaces())
      .flatMap((items) => items || [])
      .filter((item) => item.family === "IPv4" && !item.internal)
      .map((item) => item.address)
      .filter((address) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
    const configuredPublicUrl = String(process.env.ATTENDANCE_PUBLIC_URL || "").trim().replace(/\/$/, "");
    res.json({ port: PORT, addresses, preferredBaseUrl: addresses[0] ? `http://${addresses[0]}:${PORT}` : "", publicBaseUrl: configuredPublicUrl });
  });

  app.post("/api/attendance-optical/share-link", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "GÃ¼venli yoklama baÄŸlantÄ±sÄ± yalnÄ±zca okulun yerel uygulamasÄ±ndan oluÅŸturulabilir." });
    const now = Math.floor(Date.now() / 1000);
    const payload: AttendanceAccessPayload = {
      scope: "attendance-scan",
      issuedAt: now,
      expiresAt: now + attendanceTokenTtlMinutes * 60,
      linkId: crypto.randomBytes(12).toString("hex"),
    };
    const token = signAttendancePayload(payload);
    const addresses = Object.values(os.networkInterfaces())
      .flatMap((items) => items || [])
      .filter((item) => item.family === "IPv4" && !item.internal)
      .map((item) => item.address)
      .filter((address) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address));
    const configuredPublicUrl = String(process.env.ATTENDANCE_PUBLIC_URL || "").trim().replace(/\/$/, "");
    const baseUrl = configuredPublicUrl || (addresses[0] ? `http://${addresses[0]}:${PORT}` : `http://localhost:${PORT}`);
    const url = new URL(baseUrl);
    url.searchParams.set("mode", "attendance-scan");
    url.hash = `token=${encodeURIComponent(token)}`;
    res.setHeader("Cache-Control", "no-store");
    res.json({ url: url.toString(), expiresAt: new Date(payload.expiresAt * 1000).toISOString(), isPublic: Boolean(configuredPublicUrl), linkId: payload.linkId });
  });

  app.post("/api/attendance-optical/reminders", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "HatÄ±rlatma gÃ¶revi yalnÄ±zca okul uygulamasÄ±ndan baÅŸlatÄ±labilir." });
    const { linkId, teacherName, phone, url, expiresAt, baseUrl, token, lastSentAt } = req.body || {};
    const normalizedBaseUrl = String(baseUrl || "https://api.mhatsapp.com").trim().replace(/\/$/, "");
    let providerHost = "";
    try { providerHost = new URL(normalizedBaseUrl).hostname; } catch { /* AÅŸaÄŸÄ±daki doÄŸrulama hata dÃ¶ndÃ¼rÃ¼r. */ }
    if (!linkId || !teacherName || !/^\d{11,13}$/.test(String(phone || "")) || !url || !token || !Number.isFinite(Date.parse(expiresAt))) {
      return res.status(400).json({ error: "HatÄ±rlatma gÃ¶revi bilgileri eksik veya geÃ§ersiz." });
    }
    if (!["api.mhatsapp.com", "msg.mhatsapp.com", "msgapi.mhatsapp.com"].includes(providerHost)) {
      return res.status(400).json({ error: "WhatsApp servis adresi geÃ§ersiz." });
    }
    attendanceReminderJobs.set(String(linkId), {
      linkId: String(linkId),
      teacherName: String(teacherName),
      phone: String(phone),
      url: String(url),
      expiresAt: Date.parse(expiresAt),
      baseUrl: normalizedBaseUrl,
      token: String(token),
      lastSentAt: Number.isFinite(Date.parse(lastSentAt)) ? Date.parse(lastSentAt) : Date.now(),
      messageCount: 1,
    });
    res.json({ success: true, linkId, intervalSeconds: 120 });
  });

  app.get("/api/attendance-optical/reminders/:linkId", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "Bu bilgi yalnÄ±zca okul uygulamasÄ±ndan gÃ¶rÃ¼ntÃ¼lenebilir." });
    const job = attendanceReminderJobs.get(String(req.params.linkId));
    if (!job) return res.status(404).json({ active: false });
    res.json({ active: true, linkId: job.linkId, teacherName: job.teacherName, lastSentAt: new Date(job.lastSentAt).toISOString(), messageCount: job.messageCount, lastError: job.lastError || "" });
  });

  app.delete("/api/attendance-optical/reminders/:linkId", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "HatÄ±rlatma gÃ¶revi yalnÄ±zca okul uygulamasÄ±ndan durdurulabilir." });
    attendanceReminderJobs.delete(String(req.params.linkId));
    res.json({ success: true });
  });


  type StudentSelfRegistrationAttempt = {
    count: number;
    resetAt: number;
  };
  const studentSelfRegistrationAttempts = new Map<string, StudentSelfRegistrationAttempt>();
  const limitStudentSelfRegistrations = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const now = Date.now();
    const key = req.get("cf-connecting-ip") || requestAddress(req) || "unknown";
    const current = studentSelfRegistrationAttempts.get(key);
    const attempt =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + 10 * 60 * 1000 }
        : current;

    attempt.count += 1;
    studentSelfRegistrationAttempts.set(key, attempt);

    if (attempt.count > 20) {
      return res.status(429).json({
        error: "Ã‡ok fazla kayÄ±t denemesi yapÄ±ldÄ±. LÃ¼tfen birkaÃ§ dakika sonra yeniden deneyin.",
      });
    }

    next();
  };

  const upperStudentText = (value: unknown) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleUpperCase("tr-TR");

  const normalizeTrPhone = (value: unknown) => {
    let digits = String(value ?? "").replace(/\D/g, "");
    if (digits.startsWith("90") && digits.length >= 12) digits = digits.slice(2);
    else if (digits.startsWith("0") && digits.length >= 11) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    return digits.length === 10 ? `+90${digits}` : "";
  };


  app.get("/api/public/student-registration/link", (req, res) => {
    try {
      const forwardedHost = String(req.get("x-forwarded-host") || "").trim();
      const requestHost = String(req.get("host") || "").trim();
      const host = forwardedHost || requestHost;
      const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
      const requestProto = forwardedProto || req.protocol || "http";

      const isLoopbackHost =
        !host ||
        /^localhost(?::\d+)?$/i.test(host) ||
        /^127\.0\.0\.1(?::\d+)?$/i.test(host) ||
        /^\[?::1\]?(?::\d+)?$/i.test(host);

      let registrationUrl = "";
      let networkHost = "";

      if (!isLoopbackHost && !/^127\.0\.0\.1:8787$/i.test(host)) {
        registrationUrl = `${requestProto}://${host}/?mode=student-register`;
        networkHost = host;
      } else {
        const interfaces = os.networkInterfaces();
        const candidates: string[] = [];

        Object.values(interfaces).forEach((entries) => {
          (entries || []).forEach((entry) => {
            if (
              entry &&
              entry.family === "IPv4" &&
              !entry.internal &&
              !entry.address.startsWith("169.254.")
            ) {
              candidates.push(entry.address);
            }
          });
        });

        const preferred =
          candidates.find((address) => /^192\.168\./.test(address)) ||
          candidates.find((address) => /^10\./.test(address)) ||
          candidates.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address)) ||
          candidates[0] ||
          "";

        if (preferred) {
          networkHost = `${preferred}:3000`;
          registrationUrl = `http://${networkHost}/?mode=student-register`;
        }
      }

      if (!registrationUrl) {
        return res.status(503).json({
          error:
            "Telefonun eriÅŸebileceÄŸi yerel aÄŸ adresi bulunamadÄ±. BilgisayarÄ±n Wi-Fi/Ethernet baÄŸlantÄ±sÄ±nÄ± kontrol edin.",
        });
      }

      res.setHeader("Cache-Control", "no-store");
      res.json({
        url: registrationUrl,
        host: networkHost,
        sameNetworkRequired: true,
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || "QR kayÄ±t baÄŸlantÄ±sÄ± hazÄ±rlanamadÄ±.",
      });
    }
  });

  app.get("/api/public/student-registration/bootstrap", (_req, res) => {
    try {
      const classroomDocuments = [
        ...listDocuments("classrooms"),
        ...listDocuments("school_classrooms"),
      ];

      const classrooms = Array.from(
        new Set(
          classroomDocuments
            .map((item: any) => upperStudentText(item?.name))
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        a.localeCompare(b, "tr", { numeric: true, sensitivity: "base" }),
      );

      res.setHeader("Cache-Control", "no-store");
      res.json({ classrooms });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "KayÄ±t formu hazÄ±rlanamadÄ±." });
    }
  });

  app.post(
    "/api/public/student-registration/submit",
    limitStudentSelfRegistrations,
    (req, res) => {
      try {
        const incoming = req.body || {};
        const id = String(incoming.id || "").replace(/\D/g, "").trim();
        const name = upperStudentText(incoming.name);
        const classroom = upperStudentText(incoming.classroom);
        const parentName = upperStudentText(incoming.parentName);

        if (!id || !name || !classroom || !parentName) {
          return res.status(400).json({
            error: "Ã–ÄŸrenci No, Ad Soyad, SÄ±nÄ±f / Åube ve Veli AdÄ± SoyadÄ± zorunludur.",
          });
        }

        if (!/^(9|10|11|12)[A-E]$/.test(classroom)) {
          return res.status(400).json({ error: "Sınıf 9A-9E, 10A-10E, 11A-11E veya 12A-12E biçiminde seçilmelidir." });
        }

        if (id.length > 12) {
          return res.status(400).json({ error: "Ã–ÄŸrenci numarasÄ± geÃ§ersiz." });
        }

        const existingStudent = [
          ...listDocuments("students"),
          ...listDocuments("school_students"),
          ...listDocuments("studentSelfRegistrations"),
        ].some((student: any) => String(student?.id || "") === id);

        if (existingStudent) {
          return res.status(409).json({
            error: "Bu Ã¶ÄŸrenci numarasÄ± ile daha Ã¶nce kayÄ±t yapÄ±lmÄ±ÅŸ. Ä°kinci kez kayÄ±t yapÄ±lamaz.",
          });
        }

        const rawOob = String(incoming.oob || "").replace(",", ".").trim();
        const parsedOob = rawOob ? Number(rawOob) : undefined;
        if (
          parsedOob !== undefined &&
          (!Number.isFinite(parsedOob) || parsedOob < 0 || parsedOob > 100)
        ) {
          return res.status(400).json({ error: "Okul puanÄ± (OÃ–B) 0 ile 100 arasÄ±nda olmalÄ±dÄ±r." });
        }

        const rawPhone = String(incoming.phone || "").trim();
        const rawParentPhone = String(incoming.parentPhone || "").trim();
        if ((rawPhone && rawPhone !== "+90" && !/^\+90\d{10}$/.test(rawPhone)) || (rawParentPhone && rawParentPhone !== "+90" && !/^\+90\d{10}$/.test(rawParentPhone))) {
          return res.status(400).json({ error: "Telefon numaraları boşluksuz +90XXXXXXXXXX biçiminde olmalıdır." });
        }
        const phone = normalizeTrPhone(rawPhone);
        const parentPhone = normalizeTrPhone(rawParentPhone);

        if (incoming.phone && !phone) {
          return res.status(400).json({ error: "Ã–ÄŸrenci telefonu geÃ§ersiz." });
        }
        if (incoming.parentPhone && !parentPhone) {
          return res.status(400).json({ error: "Veli telefonu geÃ§ersiz." });
        }

        const nowIso = new Date().toISOString();
        const student = {
          id,
          name,
          classroom,
          group: upperStudentText(incoming.group) || undefined,
          phone,
          parentName,
          parentPhone,
          dob: String(incoming.dob || "").trim(),
          pob: upperStudentText(incoming.pob),
          address: upperStudentText(incoming.address),
          oob: parsedOob,
          status: "Aktif",
          avatar: "",
          registerDate: nowIso,
          registrationSource: "QR_SELF_REGISTRATION",
          selfRegistrationLocked: true,
        };

        // Ana Ã¶ÄŸrenci koleksiyonuna doÄŸrudan yazÄ±lÄ±r.
        upsertDocument("students", id, student);
        // Yönetim panelinin legacy/yerel hydrate yolu school_students okur.
        // QR kaydı bu koleksiyona yazılmazsa form başarılı olsa bile öğrenci
        // listesinde görünmez.
        upsertDocument("school_students", id, student);

        // Tek kullanÄ±mlÄ±lÄ±k iÃ§in ayrÄ± denetim kaydÄ± da tutulur.
        upsertDocument("studentSelfRegistrations", id, {
          id,
          studentId: id,
          submittedAt: nowIso,
          locked: true,
        });

        res.status(201).json({
          success: true,
          id,
          locked: true,
        });
      } catch (error: any) {
        res.status(500).json({
          error: error.message || "Ã–ÄŸrenci kaydÄ± yapÄ±lamadÄ±.",
        });
      }
    },
  );

  // VELI ONAY SISTEMI ---------------------------------------------------------
  const PARENT_CONSENT_COLLECTION = "parentConsentCampaigns";

  const parentConsentText = (value: unknown) =>
    String(value ?? "").trim();

  const portalDirectoryFirstText = (...values: unknown[]) => {
    for (const value of values) {
      const text = parentConsentText(value);
      if (text) return text;
    }
    return "";
  };

  const portalDirectoryClassKey = (value: unknown) =>
    parentConsentText(value)
      .toLocaleUpperCase("tr-TR")
      .replace(/[\s\-_/]+/g, "");

  const portalDirectoryRoster = () => {
    const classroomRows = [
      ...listDocuments("school_classrooms"),
      ...listDocuments("classrooms"),
    ];

    const classroomById = new Map<string, string>();
    classroomRows.forEach((row: any) => {
      const id = portalDirectoryFirstText(
        row?.id,
        row?.classroomId,
        row?.classId,
        row?.__documentId
      );
      const name = portalDirectoryFirstText(
        row?.name,
        row?.classroom,
        row?.classroomName,
        row?.className,
        row?.branch,
        row?.sube,
        row?.["şube"],
        row?.sinif,
        row?.["sınıf"]
      );
      if (id && name && !classroomById.has(id)) classroomById.set(id, name);
    });

    const byStudent = new Map<string, any>();
    // Older imports may assign a different database ID to the same school number.
    // The student number is stable across classroom transfers; keep one roster entry.
    const canonicalStudents = listDocuments("students");
    const schoolNumberOf = (student: any) => portalDirectoryFirstText(
      student?.number, student?.studentNumber, student?.schoolNumber,
      student?.studentNo, student?.schoolNo, student?.no,
      student?.ogrenciNo, student?.["öğrenciNo"], student?.okulNo, student?.numara
    );
    const canonicalNumbers = new Set(canonicalStudents.map(schoolNumberOf).filter(Boolean));
    const canonicalIds = new Set(canonicalStudents.map((student: any) =>
      portalDirectoryFirstText(student?.id, student?.studentId, student?.__documentId)
    ).filter(Boolean));
    const source = [
      ...listDocuments("school_students").filter((student: any) =>
        !canonicalIds.has(portalDirectoryFirstText(student?.id, student?.studentId, student?.__documentId)) &&
        !canonicalNumbers.has(schoolNumberOf(student))
      ),
      ...canonicalStudents,
    ];

    source.forEach((student: any) => {
      const firstName = portalDirectoryFirstText(
        student?.firstName,
        student?.givenName,
        student?.ad,
        student?.adi,
        student?.isim,
        student?.ogrenciAdi,
        student?.["öğrenciAdi"]
      );
      const lastName = portalDirectoryFirstText(
        student?.lastName,
        student?.surname,
        student?.soyad,
        student?.soyadi,
        student?.ogrenciSoyadi,
        student?.["öğrenciSoyadi"]
      );
      const composedName = `${firstName} ${lastName}`.trim();
      const name = portalDirectoryFirstText(
        student?.name,
        student?.fullName,
        student?.studentName,
        student?.studentFullName,
        student?.adSoyad,
        student?.ogrenciAdSoyad,
        composedName
      );

      const classroomId = portalDirectoryFirstText(
        student?.classroomId,
        student?.classId,
        student?.classroom_id
      );
      const classroom = portalDirectoryFirstText(
        student?.classroom,
        student?.classroomName,
        student?.className,
        student?.branch,
        student?.sinif,
        student?.["sınıf"],
        student?.sube,
        student?.["şube"],
        student?.class,
        classroomById.get(classroomId)
      );

      const number = portalDirectoryFirstText(
        student?.number,
        student?.studentNumber,
        student?.schoolNumber,
        student?.studentNo,
        student?.schoolNo,
        student?.no,
        student?.ogrenciNo,
        student?.["öğrenciNo"],
        student?.okulNo,
        student?.numara
      );

      const rawId = portalDirectoryFirstText(
        student?.id,
        student?.studentId,
        student?.recordId,
        student?.__documentId
      );
      const fallbackId = `${portalDirectoryClassKey(classroom)}:${number || name}`;
      const id = rawId || fallbackId;
      if (!id || !name) return;
      const rosterKey = number ? `number:${number}` : `id:${id}`;

      const next = {
        id,
        name,
        number,
        classroom,
        classroomId,
        parentName: portalDirectoryFirstText(
          student?.parentName,
          student?.guardianName,
          student?.veliAdi,
          student?.veliAdSoyad
        ),
        parentPhone: portalDirectoryFirstText(
          student?.parentPhone,
          student?.guardianPhone,
          student?.veliTelefon,
          student?.veliTelefonu,
          student?.parentPhoneNumber,
          student?.motherPhone,
          student?.fatherPhone,
          student?.anneTelefon,
          student?.babaTelefon,
          student?.phoneParent,
          student?.guardian_phone,
          student?.veliCep,
          student?.veliCepTelefonu,
          student?.parent_mobile
        ),
        studentPhone: portalDirectoryFirstText(
          student?.phone,
          student?.studentPhone,
          student?.telefon,
          student?.cepTelefonu,
          student?.mobile,
          student?.mobilePhone,
          student?.phoneNumber,
          student?.studentPhoneNumber,
          student?.ogrenciTelefon,
          student?.["öğrenciTelefon"]
        ),
      };

      const current = byStudent.get(rosterKey);
      if (!current) {
        byStudent.set(rosterKey, next);
        return;
      }

      // Canonical Students is iterated last. Do not inherit a stale value
      // when the admin deliberately clears a phone or classroom field.
      byStudent.set(rosterKey, next);
    });

    return Array.from(byStudent.values())
      .filter((item: any) => item.id && item.name && item.classroom)
      .sort((a: any, b: any) => {
        const classCompare = String(a.classroom).localeCompare(
          String(b.classroom),
          "tr-TR",
          { numeric: true, sensitivity: "base" }
        );
        if (classCompare !== 0) return classCompare;
        const numberCompare = String(a.number || "").localeCompare(
          String(b.number || ""),
          "tr-TR",
          { numeric: true, sensitivity: "base" }
        );
        if (numberCompare !== 0) return numberCompare;
        return String(a.name).localeCompare(String(b.name), "tr-TR");
      });
  };

  app.get("/api/message-tools/portal-targets", requireAuthSession, (_req, res) => {
    try {
      const session: AuthSession = res.locals.auth.session;
      if (session.role === "teacher") {
        return res.status(403).json({ error: "Bu işlem için yönetici yetkisi gereklidir." });
      }
      res.setHeader("Cache-Control", "no-store");
      return res.json({ items: portalDirectoryRoster() });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || "Öğrenci ve sınıf bilgileri yüklenemedi.",
      });
    }
  });

  app.get("/api/parent-consents/targets", (_req, res) => {
    try {
      const items = portalDirectoryRoster().map((student: any) => ({
        id: student.id,
        name: student.name,
        number: student.number,
        classroom: student.classroom,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
      }));

      res.setHeader("Cache-Control", "no-store");
      return res.json({ items });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || "Veli onay hedefleri yuklenemedi.",
      });
    }
  });

  app.get("/api/parent-consents", (_req, res) => {
    try {
      const items = (listDocuments(PARENT_CONSENT_COLLECTION) as any[])
        .sort((a, b) =>
          String(b?.createdAt || "").localeCompare(
            String(a?.createdAt || "")
          )
        );

      res.setHeader("Cache-Control", "no-store");
      return res.json({ items });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || "Veli onay kayitlari yuklenemedi.",
      });
    }
  });

  app.post("/api/parent-consents", (req, res) => {
    try {
      const body = req.body || {};

      const title = parentConsentText(body.title);
      const description = parentConsentText(body.description);
      const principalName = parentConsentText(body.principalName);
      const createdBy = parentConsentText(body.createdBy);
      const eventDate = parentConsentText(body.eventDate);
      const expiresAt = parentConsentText(body.expiresAt);

      const targets = Array.isArray(body.targets)
        ? body.targets
            .map((target: any) => ({
              id: parentConsentText(target?.id),
              name: parentConsentText(target?.name),
              number: parentConsentText(target?.number),
              classroom: parentConsentText(target?.classroom),
              parentName: parentConsentText(target?.parentName),
              parentPhone: parentConsentText(target?.parentPhone),
              status: "pending",
              respondedAt: null,
            }))
            .filter((target: any) =>
              target.id &&
              target.name &&
              target.classroom
            )
        : [];

      if (!title || !description || !principalName) {
        return res.status(400).json({
          error: "Islem adi, onay yazisi ve okul muduru zorunludur.",
        });
      }

      if (!targets.length) {
        return res.status(400).json({
          error: "En az bir ogrenci secilmelidir.",
        });
      }

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      const campaign = {
        id,
        title,
        description,
        principalName,
        eventDate,
        expiresAt,
        createdBy,
        createdAt,
        updatedAt: createdAt,
        status: "active",
        targets,
      };

      upsertDocument(
        PARENT_CONSENT_COLLECTION,
        id,
        campaign
      );

      return res.status(201).json({
        success: true,
        campaign,
      });
    } catch (error: any) {
      return res.status(500).json({
        error: error?.message || "Veli onay belgesi olusturulamadi.",
      });
    }
  });
  app.post("/api/parent-consents/:id/notify", async (req, res) => {
    try {
      const campaignId = String(req.params.id || "").trim();

      const campaign: any = (
        listDocuments(PARENT_CONSENT_COLLECTION) as any[]
      ).find((item: any) => String(item?.id || "") === campaignId);

      if (!campaign) {
        return res.status(404).json({
          ok: false,
          error: "Veli onay kampanyasi bulunamadi.",
        });
      }

      const runtimeSettings: any = (
        listDocuments("mhatsappRuntimeSettings") as any[]
      ).find((item: any) => String(item?.id || "") === "active");

      const mhToken = String(runtimeSettings?.token || "").trim();
      const baseUrl = String(
        runtimeSettings?.baseUrl || "https://api.mhatsapp.com"
      )
        .trim()
        .replace(/\/$/, "");

      if (!mhToken) {
        return res.status(400).json({
          ok: false,
          error: "mHatsapp API ayarlari yapilandirilmamis.",
        });
      }

      const targets = Array.isArray(campaign?.targets)
        ? campaign.targets
        : [];

      const portalLinks = listDocuments("publicPortalLinks") as any[];

      const normalizePhone = (value: unknown) => {
        let digits = String(value ?? "").replace(/\D/g, "");

        if (digits.startsWith("0090")) {
          digits = digits.slice(2);
        }

        if (digits.startsWith("0") && digits.length === 11) {
          digits = `90${digits.slice(1)}`;
        } else if (digits.length === 10) {
          digits = `90${digits}`;
        }

        return digits;
      };

      const normalizeStudentNo = (value: unknown) =>
        String(value ?? "")
          .trim()
          .replace(/\D/g, "")
          .replace(/^0+/, "");

      const normalizeText = (value: unknown) =>
        String(value ?? "")
          .trim()
          .toLocaleUpperCase("tr-TR");

      const publicBase = liveReportPublicBase(req).replace(/\/$/, "");
      const results: any[] = [];

      for (const target of targets) {
        const studentId = String(target?.id || "").trim();
        const studentNumber = normalizeStudentNo(target?.number);
        const studentName = normalizeText(target?.name);
        const classroom = normalizeText(target?.classroom);
        const parentPhone = normalizePhone(target?.parentPhone);

        let portal: any =
          portalLinks.find(
            (item: any) =>
              String(item?.kind || "") === "parent" &&
              !item?.revokedAt &&
              String(item?.studentId || "") === studentId
          ) || null;

        if (!portal && studentNumber) {
          portal =
            portalLinks.find(
              (item: any) =>
                String(item?.kind || "") === "parent" &&
                !item?.revokedAt &&
                normalizeStudentNo(item?.studentNumber) === studentNumber
            ) || null;
        }

        if (!portal) {
          portal =
            portalLinks.find(
              (item: any) =>
                String(item?.kind || "") === "parent" &&
                !item?.revokedAt &&
                normalizeText(item?.studentName) === studentName &&
                normalizeText(item?.classroom) === classroom
            ) || null;
        }

        if (!parentPhone) {
          results.push({
            id: studentId,
            ok: false,
            error: "Veli telefon numarasi yok.",
            portalUrl: "",
          });
          continue;
        }

        let rawPortalToken = String(
          portal?.recoverableToken || ""
        ).trim();

        const stableStudentId =
          studentId ||
          studentNumber ||
          behaviorDocumentId(
            "portal-student",
            studentName,
            classroom
          );

        if (!rawPortalToken) {
          rawPortalToken = randomBehaviorSecret(32);
        }

        const portalNow = new Date().toISOString();
        const portalId =
          String(portal?.id || "").trim() ||
          behaviorDocumentId(
            "portal-link",
            "parent",
            stableStudentId
          );

        const activePortal = {
          ...(portal || {}),
          id: portalId,
          kind: "parent",
          studentId: stableStudentId,
          tokenHash: hashPublicPortalToken(rawPortalToken),
          recoverableToken: rawPortalToken,
          studentName,
          studentNumber,
          classroom,
          phone: parentPhone,
          createdAt:
            String(portal?.createdAt || "").trim() ||
            portalNow,
          updatedAt: portalNow,
          revokedAt: null,
        };

        upsertDocument(
          "publicPortalLinks",
          portalId,
          activePortal
        );

        if (portal) {
          Object.assign(portal, activePortal);
        } else {
          portalLinks.push(activePortal);
        }

        portal = activePortal;

        const portalUrl =
          `${publicBase}/veli/${encodeURIComponent(rawPortalToken)}`;

        if (!portalUrl) {
          results.push({
            id: studentId,
            ok: false,
            error: "Veli uygulama baglantisi olusturulamadi.",
          });
          continue;
        }

        const eventLine = campaign?.eventDate
          ? `\nEtkinlik tarihi: ${campaign.eventDate}`
          : "";

        const message =
          `ORDU LİSESİ – VELİ ONAY TALEBİ\n\n` +
          `${campaign.title}\n\n` +
          `${campaign.description}` +
          `${eventLine}\n\n` +
          `Sayın velimiz, onay veya ret işleminizi e-Nstitü Veli uygulamasındaki ` +
          `"Veli Onay Bilgisi" bölümünden yapabilirsiniz.\n\n` +
          `${portalUrl}`;

        let providerResponse: Response | null = null;
        let providerData: any = null;
        let providerError = "";

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);

          try {
            providerResponse = await fetch(
              `${baseUrl}/api/v3/message/send/`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  action: {
                    token: mhToken,
                    numbers: parentPhone,
                    message,
                    type: "text",
                  },
                }),
                signal: controller.signal,
              }
            );
          } finally {
            clearTimeout(timeoutId);
          }

          const text = await providerResponse.text();

          try {
            providerData = text ? JSON.parse(text) : {};
          } catch {
            providerData = {
              rawResponse: text,
            };
          }
        } catch (error: any) {
          providerError =
            error?.name === "AbortError"
              ? "mHatsapp sunucusu zaman asimina ugradi."
              : error?.message || "mHatsapp istegi basarisiz.";
        }

        const providerPayload =
          providerData?.data &&
          typeof providerData.data === "object"
            ? providerData.data
            : providerData;

        const statusText = String(
          providerPayload?.status ||
            providerPayload?.message ||
            providerPayload?.error ||
            providerPayload?.rawResponse ||
            ""
        ).trim();

        const explicitlyFailed =
          providerData?.ok === false ||
          providerPayload?.ok === false ||
          Boolean(providerPayload?.error) ||
          /(^|\b)(error|failed|failure|invalid|denied|rejected)(\b|$)/i.test(
            statusText
          );

        const explicitlyAccepted =
          providerData?.ok === true ||
          providerPayload?.ok === true ||
          Boolean(
            providerPayload?.id ||
              providerPayload?.messageId ||
              providerPayload?.message_id
          ) ||
          /(^|\b)(success|sent|queued|accepted|ok)(\b|$)/i.test(
            statusText
          );

        const sent =
          Boolean(providerResponse?.ok) &&
          !explicitlyFailed &&
          explicitlyAccepted;

        results.push({
          id: studentId,
          ok: sent,
          portalUrl,
          notifiedAt: sent ? new Date().toISOString() : null,
          error: sent
            ? ""
            : providerError ||
              statusText ||
              `HTTP ${providerResponse?.status || 0}`,
        });
      }

      const resultMap = new Map(
        results.map((item: any) => [String(item.id), item])
      );

      const updatedTargets = targets.map((target: any) => {
        const result: any = resultMap.get(String(target?.id || ""));

        if (!result) return target;

        return {
          ...target,
          portalUrl: result.portalUrl || target?.portalUrl || "",
          notificationOk: Boolean(result.ok),
          lastNotificationAt: result.ok
            ? result.notifiedAt
            : target?.lastNotificationAt || null,
          lastNotificationError: result.ok
            ? ""
            : result.error || "Mesaj gonderilemedi.",
        };
      });

      const sentCount = results.filter((item) => item.ok).length;
      const failedCount = results.length - sentCount;
      const updatedAt = new Date().toISOString();

      const updatedCampaign = {
        ...campaign,
        targets: updatedTargets,
        updatedAt,
        lastNotificationAt: updatedAt,
        notificationSummary: {
          total: results.length,
          sent: sentCount,
          failed: failedCount,
        },
      };

      upsertDocument(
        PARENT_CONSENT_COLLECTION,
        campaignId,
        updatedCampaign
      );

      return res.json({
        ok: failedCount === 0,
        total: results.length,
        sent: sentCount,
        failed: failedCount,
        results,
      });
    } catch (error: any) {
      console.error(
        "POST /api/parent-consents/:id/notify error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error?.message ||
          "Veli onay bildirimleri gonderilemedi.",
      });
    }
  });
  app.get("/api/public/behavior-link/bootstrap", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "Eski davranÄ±ÅŸ baÄŸlantÄ±sÄ± kapatÄ±ldÄ±." });
    try {
      const students = listDocuments("school_students");
      const behaviors = listDocuments("customBehaviors");
      res.json({ students, behaviors });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/public/behavior-link/records", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "Bu kayÄ±t kuyruÄŸu yalnÄ±zca okul uygulamasÄ±ndan okunabilir." });
    try { res.json(listDocuments("behaviorRecords").filter(record => !record?.notePrepared && !record?.sentTo)); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/public/behavior-link/records", (_req, res) => {
    return res.status(410).json({ error: "Eski Ã¶ÄŸretmen davranÄ±ÅŸ kayÄ±t yolu kapatÄ±ldÄ±. GÃ¼venli Firebase baÄŸlantÄ±sÄ±nÄ± kullanÄ±nÄ±z." });
  });

  app.delete("/api/public/behavior-link/records/:id", (req, res) => {
    if (!isDirectLocalRequest(req)) return res.status(403).json({ error: "Bu iÅŸlem yalnÄ±zca okul uygulamasÄ±ndan yapÄ±labilir." });
    try {
      deleteDocument("behaviorRecords", String(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/public/attendance-optical/bootstrap", requireAttendanceAccess, (_req, res) => {
    try {
      res.json({
        students: listDocuments("school_students"),
        classrooms: listDocuments("school_classrooms"),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/public/attendance-optical/records", requireAttendanceAccess, (_req, res) => {
    try { res.json(listDocuments("attendanceOpticalRecords")); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.post("/api/public/attendance-optical/records", requireAttendanceAccess, limitAttendanceWrites, (req, res) => {
    try {
      const record = req.body || {};
      if (!record.id || !record.date || !record.classroomId || !Array.isArray(record.absentStudents)) {
        return res.status(400).json({ error: "Tarih, sÄ±nÄ±f ve yoklama bilgileri zorunludur." });
      }
      const previous = listDocuments("attendanceOpticalRecords").find((item) => String(item.id) === String(record.id));
      const previousIds = new Set((previous?.absentStudents || []).map((item: any) => String(item.studentId)));
      const nextIds = new Set(record.absentStudents.map((item: any) => String(item.studentId)));
      const students = listDocuments("school_students");
      students.forEach((student: any) => {
        const studentId = String(student.id);
        const wasAbsent = previousIds.has(studentId);
        const isAbsent = nextIds.has(studentId);
        if (wasAbsent === isAbsent) return;
        upsertDocument("school_students", studentId, {
          ...student,
          absences: Math.max(0, Number(student.absences || 0) + (isAbsent ? 1 : -1)),
        });
      });
      upsertDocument("attendanceOpticalRecords", String(record.id), {
        ...record,
        submittedAt: new Date().toISOString(),
        accessLinkId: res.locals.attendanceAccess?.linkId || "local",
      });
      res.json({ success: true, id: record.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  const OPTIC_TEMPLATE_COLLECTION = "optic_templates";
  const LEGACY_OPTIC_COLLECTIONS = [
    "opticForms",
    "sekonicOpticForms",
    "opticTxtTemplates",
    "sekonicOpticFormTombstones",
  ];

  const opticIdentityKeys = [
    "schoolCode",
    "studentNo",
    "fullName",
    "classLevel",
    "branch",
    "area",
    "bookletType",
  ] as const;

  const opticTemplateInputSchema = z.object({
    name: z.string().trim().min(1).max(120),
    templateKind: z.enum(["TYT", "AYT", "Ã–zel"]).default("Ã–zel"),
    identityFields: z.array(
      z.object({
        key: z.enum(opticIdentityKeys),
        label: z.string().trim().min(1).max(80),
        startColumn: z.number().int().positive(),
        columnCount: z.number().int().positive(),
      }),
    ).length(7),
    answerFields: z.array(
      z.object({
        id: z.string().trim().min(1).max(120),
        courseName: z.string().trim().min(1).max(120),
        startColumn: z.number().int().positive(),
        columnCount: z.number().int().positive(),
      }),
    ).max(50),
  });

  const validateOpticTemplate = (input: unknown) => {
    const parsed = opticTemplateInputSchema.parse(input);

    const identityKeys = parsed.identityFields.map((item) => item.key);
    if (new Set(identityKeys).size !== opticIdentityKeys.length) {
      throw new Error("Sabit bilgi alanlarÄ± eksik veya tekrarlÄ±.");
    }
    for (const key of opticIdentityKeys) {
      if (!identityKeys.includes(key)) {
        throw new Error(`Eksik sabit bilgi alanÄ±: ${key}`);
      }
    }

    const courseNames = parsed.answerFields.map((item) =>
      item.courseName.toLocaleLowerCase("tr-TR"),
    );
    if (new Set(courseNames).size !== courseNames.length) {
      throw new Error("AynÄ± ders optik forma birden fazla kez eklenemez.");
    }

    const ranges = [
      ...parsed.identityFields.map((item) => ({
        label: item.label,
        start: item.startColumn,
        count: item.columnCount,
      })),
      ...parsed.answerFields.map((item) => ({
        label: item.courseName,
        start: item.startColumn,
        count: item.columnCount,
      })),
    ];

    for (let i = 0; i < ranges.length; i += 1) {
      const aEnd = ranges[i].start + ranges[i].count - 1;
      for (let j = i + 1; j < ranges.length; j += 1) {
        const bEnd = ranges[j].start + ranges[j].count - 1;
        const overlaps =
          ranges[i].start <= bEnd && ranges[j].start <= aEnd;
        if (overlaps) {
          throw new Error(
            `${ranges[i].label} ile ${ranges[j].label} sÃ¼tunlarÄ± Ã§akÄ±ÅŸÄ±yor.`,
          );
        }
      }
    }

    return parsed;
  };

  const listOpticTemplatesFromDb = () =>
    (listDocuments(OPTIC_TEMPLATE_COLLECTION) as any[])
      .filter((item) => item && item.id && item.name)
      .map((item) => ({
        ...item,
        templateKind:
          item?.templateKind === "TYT" || item?.templateKind === "AYT"
            ? item.templateKind
            : "Ã–zel",
      }))
      .sort((a, b) =>
        String(a.name).localeCompare(String(b.name), "tr-TR"),
      );

  app.get("/api/optic-templates", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ templates: listOpticTemplatesFromDb() });
  });

  app.post("/api/optic-templates", (req, res) => {
    try {
      const input = validateOpticTemplate(req.body);
      const normalizedName = input.name.toLocaleLowerCase("tr-TR");
      const duplicate = listOpticTemplatesFromDb().find(
        (item: any) =>
          String(item.name || "")
            .trim()
            .toLocaleLowerCase("tr-TR") === normalizedName,
      );
      if (duplicate) {
        return res.status(409).json({
          error: "Bu isimde bir optik form zaten kayÄ±tlÄ±.",
        });
      }

      const now = new Date().toISOString();
      const id = `optic-${crypto.randomBytes(10).toString("hex")}`;
      const record = {
        id,
        ...input,
        createdAt: now,
        updatedAt: now,
      };

      upsertDocument(OPTIC_TEMPLATE_COLLECTION, id, record);
      const verified = getDocument(OPTIC_TEMPLATE_COLLECTION, id);
      if (!verified) {
        throw new Error("Optik form MySQL'e yazÄ±ldÄ±ktan sonra doÄŸrulanamadÄ±.");
      }

      res.status(201).json({ template: verified });
    } catch (error: any) {
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => issue.message).join("; ")
          : String(error?.message || error);
      res.status(400).json({ error: message });
    }
  });

  app.put("/api/optic-templates/:id", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const current = getDocument(OPTIC_TEMPLATE_COLLECTION, id);
      if (!current) {
        return res.status(404).json({ error: "Optik form bulunamadÄ±." });
      }

      const input = validateOpticTemplate(req.body);
      const normalizedName = input.name.toLocaleLowerCase("tr-TR");
      const duplicate = listOpticTemplatesFromDb().find(
        (item: any) =>
          item.id !== id &&
          String(item.name || "")
            .trim()
            .toLocaleLowerCase("tr-TR") === normalizedName,
      );
      if (duplicate) {
        return res.status(409).json({
          error: "Bu isimde baÅŸka bir optik form zaten kayÄ±tlÄ±.",
        });
      }

      const record = {
        ...current,
        ...input,
        id,
        createdAt: current.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      upsertDocument(OPTIC_TEMPLATE_COLLECTION, id, record);
      const verified = getDocument(OPTIC_TEMPLATE_COLLECTION, id);
      if (!verified) {
        throw new Error("Optik form gÃ¼ncellemesi MySQL'de doÄŸrulanamadÄ±.");
      }

      res.json({ template: verified });
    } catch (error: any) {
      const message =
        error instanceof z.ZodError
          ? error.issues.map((issue) => issue.message).join("; ")
          : String(error?.message || error);
      res.status(400).json({ error: message });
    }
  });

  app.delete("/api/optic-templates/:id", (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const current = getDocument(OPTIC_TEMPLATE_COLLECTION, id);
      if (!current) {
        return res.status(404).json({ error: "Optik form bulunamadÄ±." });
      }

      deleteDocument(OPTIC_TEMPLATE_COLLECTION, id);
      const verified = getDocument(OPTIC_TEMPLATE_COLLECTION, id);
      if (verified) {
        throw new Error("Optik form MySQL'den silinemedi.");
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  // Yeni yapÄ± ilk kez kullanÄ±ldÄ±ÄŸÄ±nda eski optik koleksiyonlarÄ± boÅŸaltmak iÃ§in
  // tek seferlik, aÃ§Ä±kÃ§a Ã§aÄŸrÄ±lan temizlik uÃ§ noktasÄ±.
  app.post("/api/optic-templates/cleanup-legacy", (_req, res) => {
    try {
      for (const collection of LEGACY_OPTIC_COLLECTIONS) {
        replaceCollection(collection, []);
      }
      res.json({
        success: true,
        clearedCollections: LEGACY_OPTIC_COLLECTIONS,
      });
    } catch (error: any) {
      res.status(400).json({ error: String(error?.message || error) });
    }
  });

  const protectedDatabaseCollections = new Set(["authDirectory", "passwordResetRequests", "schoolNewsSettings", "publishedEducationNews", "attendance_records", "attendance_record_audit", "attendance_mobile_submissions", "attendance_absence_records", "attendance_unauthorized_records", "attendance_activity_records", "optic_templates", "trial_exam_dates"]);

  const TRIAL_EXAM_DATE_COLLECTION = "trial_exam_dates";

  const normalizeTrialExamDateRow = (item: any) => {
    const id = String(item?.id || "").trim();
    const gradeLevel = String(item?.gradeLevel || "").trim();
    const date = String(item?.date || "").trim();
    const kind = String(item?.kind || "").trim();
    const description = String(item?.description || "").trim();

    if (!id) throw new Error("Deneme kaydÄ± kimliÄŸi zorunludur.");
    if (!["9", "10", "11", "12"].includes(gradeLevel)) {
      throw new Error("SÄ±nÄ±f seviyesi 9, 10, 11 veya 12 olmalÄ±dÄ±r.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Deneme tarihi geÃ§ersiz.");
    }
    if (!["TYT", "AYT", "Ã–zel"].includes(kind)) {
      throw new Error("Deneme tÃ¼rÃ¼ TYT, AYT veya Ã–zel olmalÄ±dÄ±r.");
    }

    return {
      id,
      gradeLevel,
      date,
      kind,
      description: kind === "Ã–zel" ? description.slice(0, 2000) : "",
      updatedAt: new Date().toISOString(),
    };
  };

  const listTrialExamDates = () =>
    (listDocuments(TRIAL_EXAM_DATE_COLLECTION) as any[])
      .filter(Boolean)
      .sort((a, b) =>
        String(a.gradeLevel || "").localeCompare(String(b.gradeLevel || ""), "tr-TR", { numeric: true }) ||
        String(a.date || "").localeCompare(String(b.date || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""))
      );

  app.get("/api/trial-exam-dates", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ items: listTrialExamDates() });
  });

  app.put("/api/trial-exam-dates", (req, res) => {
    try {
      const source = Array.isArray(req.body?.items) ? req.body.items : [];
      const normalized = source.map(normalizeTrialExamDateRow);
      const ids = normalized.map((item: any) => item.id);
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: "TekrarlÄ± deneme kaydÄ± kimliÄŸi bulundu." });
      }
      replaceCollection(TRIAL_EXAM_DATE_COLLECTION, normalized);
      return res.json({ success: true, items: listTrialExamDates() });
    } catch (error: any) {
      return res.status(400).json({
        error: String(error?.message || "Deneme sÄ±navÄ± tarihleri kaydedilemedi."),
      });
    }
  });

  const istanbulTodayKey = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  };

  const dateKeyDiff = (futureDate: string, currentDate: string) => {
    const future = Date.parse(`${futureDate}T00:00:00Z`);
    const current = Date.parse(`${currentDate}T00:00:00Z`);
    if (!Number.isFinite(future) || !Number.isFinite(current)) return Number.NaN;
    return Math.round((future - current) / 86400000);
  };

  const trialExamReminders = (gradeLevel?: string) => {
    const today = istanbulTodayKey();
    return listTrialExamDates()
      .filter((item: any) => !gradeLevel || String(item.gradeLevel) === String(gradeLevel))
      .map((item: any) => ({
        item,
        daysLeft: dateKeyDiff(String(item.date || ""), today),
      }))
      .filter(({ daysLeft }) => Number.isFinite(daysLeft) && daysLeft >= 0 && daysLeft <= 3)
      .map(({ item, daysLeft }) => {
        const title =
          daysLeft === 0
            ? `${item.gradeLevel}. SÄ±nÄ±f ${item.kind} denemesi bugÃ¼n`
            : `${item.gradeLevel}. SÄ±nÄ±f ${item.kind} denemesine ${daysLeft} gÃ¼n kaldÄ±`;
        const detailParts = [
          `${item.date}`,
          item.kind === "Ã–zel" && item.description ? item.description : "",
        ].filter(Boolean);
        return {
          id: `trial-exam-${item.id}-${today}`,
          type: "exam",
          title,
          detail: detailParts.join(" Â· "),
          action: "exams",
          meta: {
            source: "trial-exam-dates",
            trialExamId: item.id,
            gradeLevel: item.gradeLevel,
            date: item.date,
            kind: item.kind,
            description: item.description || "",
            daysLeft,
          },
        };
      });
  };

  app.get("/api/public-portal/:token/trial-exam-reminders", (request, response) => {
    const token = String(request.params.token || "").trim();
    const portal: any = findPublicPortalByToken(token);
    if (!portal) {
      return response.status(404).json({ error: "Ã–ÄŸrenci/veli uygulama baÄŸlantÄ±sÄ± bulunamadÄ±." });
    }
    const classroom = String(portal.classroom || "").trim();
    const gradeMatch = classroom.match(/^(9|10|11|12)/);
    const gradeLevel = gradeMatch?.[1] || "";
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({
      reminders: gradeLevel ? trialExamReminders(gradeLevel) : [],
    });
  });

  app.get("/api/behavior/teacher-links/:token/trial-exam-reminders", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) {
      return response.status(access.status).json({ error: access.error });
    }
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ reminders: trialExamReminders() });
  });

  app.get("/api/database/academic-catalog", (_req, res) => {
    try {
      res.json({
        classrooms: listDocuments("classrooms"),
        courses: listDocuments("courses"),
        customCreatedCourses: listDocuments("customCreatedCourses"),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/database/academic-catalog", async (req, res) => {
    try {
      const { classrooms, courses, customCreatedCourses } = req.body || {};
      if (![classrooms, courses, customCreatedCourses].every(Array.isArray)) {
        return res.status(400).json({ error: "SÄ±nÄ±f, ders ve okul dersi listeleri birlikte gÃ¶nderilmelidir." });
      }
      await replaceCollections({ classrooms, courses, customCreatedCourses });
      await waitForDocumentStoreWrites();
      res.json({
        success: true,
        counts: {
          classrooms: classrooms.length,
          courses: courses.length,
          customCreatedCourses: customCreatedCourses.length,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });


  // Keep only the same student's legacy display record in sync with the
  // authoritative Students screen. Do not modify unrelated collections/records.
  const syncCanonicalStudentDirectory = (studentIds?: Set<string>) => {
    const authoritative = listDocuments("students") as any[];
    const legacyRecords = listDocuments("school_students") as any[];
    const studentNo = (item: any) => portalDirectoryFirstText(
      item?.number, item?.studentNumber, item?.schoolNumber,
      item?.studentNo, item?.schoolNo, item?.no,
      item?.ogrenciNo, item?.["öğrenciNo"], item?.okulNo, item?.numara
    );
    for (const student of authoritative) {
      const id = String(student?.id ?? student?.studentId ?? "").trim();
      if (!id || (studentIds && !studentIds.has(id))) continue;
      const number = studentNo(student);
      // Update only records belonging to this student, even when the old
      // collection used another record ID. Do not delete historical links.
      for (const legacy of legacyRecords) {
        const legacyId = String(legacy?.id ?? legacy?.studentId ?? legacy?.__documentId ?? "").trim();
        if (!legacyId) continue;
        if (legacyId !== id && (!number || studentNo(legacy) !== number)) continue;
        upsertDocument("school_students", legacyId, { ...student, id: legacyId });
      }
    }
  };

  app.post("/api/database/transaction", async (req, res) => {
    try {
      const collections = req.body?.collections;
      if (!collections || typeof collections !== "object" || Array.isArray(collections)) {
        return res.status(400).json({ error: "Transaction iÃ§in koleksiyon haritasÄ± bekleniyor." });
      }
      const entries = Object.entries(collections);
      if (entries.length === 0) return res.json({ success: true, counts: {} });
      for (const [collectionName, rows] of entries) {
        if (protectedDatabaseCollections.has(collectionName)) {
          return res.status(403).json({ error: `${collectionName} koleksiyonu transaction uÃ§ noktasÄ±ndan deÄŸiÅŸtirilemez.` });
        }
        if (!Array.isArray(rows)) return res.status(400).json({ error: `${collectionName} iÃ§in kayÄ±t listesi bekleniyor.` });
      }
      await replaceCollections(collections as Record<string, any[]>);
      if (Object.prototype.hasOwnProperty.call(collections, "students")) {
        syncCanonicalStudentDirectory();
      }
      await waitForDocumentStoreWrites();
      res.json({
        success: true,
        counts: Object.fromEntries(entries.map(([name, rows]) => [name, (rows as any[]).length])),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const teacherAssignmentSelectionIsCurrent = (assignment: any, selection: any) => {
    if (!assignment || !selection) return false;

    const assignmentCycleId = String(assignment?.assignmentCycleId || "").trim();
    const selectionCycleId = String(selection?.assignmentCycleId || "").trim();

    // Yeni sürüm görevlerinde seçim yalnız aynı görev döngüsüne aitse geçerlidir.
    if (assignmentCycleId) {
      return Boolean(selectionCycleId && selectionCycleId === assignmentCycleId);
    }

    // Eski kayıtlarda cycle id yoktur. Yönetici görevi yeniden açmışsa ana görev
    // kaydının updatedAt zamanı eski tamamlanmış seçimden daha yenidir. Bu durumda
    // eski seçim kaydı yeni görevi gizleyemez.
    const assignmentUpdatedAt = Date.parse(
      String(assignment?.updatedAt || assignment?.createdAt || ""),
    );
    const selectionUpdatedAt = Date.parse(
      String(selection?.updatedAt || selection?.createdAt || ""),
    );
    // completedAt görev kapanışındaki kesin alandır. Eski sürümlerde selectionStatus
    // "completed" kalabildiği için yalnız bu metin alanı yeni görevi gizleyemez.
    const assignmentIsOpen = !String(assignment?.completedAt || "").trim();
    const selectionCompleted = Boolean(
      String(selection?.completedAt || "").trim() ||
      String(selection?.selectionStatus || "").toLowerCase() === "completed",
    );

    // Ana görev yeniden açık durumdaysa eski tamamlanmış seçim hiçbir koşulda
    // yeni görevi kapatamaz.
    if (assignmentIsOpen && selectionCompleted) return false;

    if (
      assignmentIsOpen &&
      Number.isFinite(assignmentUpdatedAt) &&
      Number.isFinite(selectionUpdatedAt) &&
      assignmentUpdatedAt > selectionUpdatedAt
    ) {
      return false;
    }

    return true;
  };

  app.get("/api/database/collections/:collection", (req, res) => {
    if (protectedDatabaseCollections.has(req.params.collection)) return res.status(403).json({ error: "Bu koleksiyona genel veritabanÄ± uÃ§ noktasÄ±ndan eriÅŸilemez." });
    try { res.json(listDocuments(req.params.collection)); }
    catch (error: any) { res.status(400).json({ error: error.message }); }
  });

  app.put("/api/database/collections/:collection", async (req, res) => {
    if (protectedDatabaseCollections.has(req.params.collection)) return res.status(403).json({ error: "Bu koleksiyon genel veritabanÄ± uÃ§ noktasÄ±ndan deÄŸiÅŸtirilemez." });
    try {
      if (!Array.isArray(req.body)) return res.status(400).json({ error: "KayÄ±t listesi bekleniyor" });
      await replaceCollection(req.params.collection, req.body);
      if (req.params.collection === "students") syncCanonicalStudentDirectory();
      await waitForDocumentStoreWrites();
      res.json({ success: true, count: req.body.length });
    } catch (error: any) { res.status(400).json({ error: error.message }); }
  });

  app.put("/api/database/collections/:collection/:id", async (req, res) => {
    if (protectedDatabaseCollections.has(req.params.collection)) return res.status(403).json({ error: "Bu koleksiyon genel veritabanÄ± uÃ§ noktasÄ±ndan deÄŸiÅŸtirilemez." });
    try {
      let payload: any = req.body;

      // teacherTestAssignments aynı kimlikle yeniden görevlendirilebildiği için
      // önceki tamamlanmış seçimin teacherTestAssignmentSelections kaydı yeni görevi
      // gizlememelidir. Yeni/açık görevlendirme yazılırken eski tamamlanmış seçim
      // otomatik temizlenir ve yeni bir assignmentCycleId başlatılır.
      if (
        req.params.collection === "teacherTestAssignments" &&
        payload && typeof payload === "object" && !Array.isArray(payload)
      ) {
        const assignmentId = String(req.params.id || "").trim();
        const existingAssignment: any = getDocument("teacherTestAssignments", assignmentId);
        const previousSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
        const incomingCompletedAt = String(payload?.completedAt || "").trim();
        // Yeni görevlendirmede completedAt boşaltılır. Eski sürüm selectionStatus'u
        // yanlışlıkla "completed" bırakmış olsa bile bu yeni görevi kapatmamalıdır.
        const incomingLooksOpen = !incomingCompletedAt;
        const previousSelectionCompleted = Boolean(
          String(previousSelection?.completedAt || "").trim() ||
          String(previousSelection?.selectionStatus || "").toLowerCase() === "completed",
        );

        payload = { ...payload };

        if (incomingLooksOpen && previousSelectionCompleted) {
          deleteDocument("teacherTestAssignmentSelections", assignmentId);
          payload.selectedQuestionKeys = [];
          payload.selectedQuestionSnapshots = [];
          payload.selectionRevision = 0;
          payload.completedAt = "";
          payload.selectionStatus = "in_progress";
          payload.questionPoolLocked = false;
          payload.questionUsageLocked = false;
          payload.assignmentCycleId = `${assignmentId}-${Date.now()}`;
        } else if (!existingAssignment && !String(payload?.assignmentCycleId || "").trim()) {
          payload.assignmentCycleId = `${assignmentId}-${Date.now()}`;
        } else if (
          existingAssignment?.assignmentCycleId &&
          !String(payload?.assignmentCycleId || "").trim()
        ) {
          payload.assignmentCycleId = existingAssignment.assignmentCycleId;
        }
      }

      await upsertDocument(req.params.collection, req.params.id, payload);
      if (req.params.collection === "students") syncCanonicalStudentDirectory(new Set([String(req.params.id)]));
      await waitForDocumentStoreWrites();
      res.json({ success: true });
    }
    catch (error: any) { res.status(400).json({ error: error.message }); }
  });

  app.delete("/api/database/collections/:collection/:id", async (req, res) => {
    if (protectedDatabaseCollections.has(req.params.collection)) return res.status(403).json({ error: "Bu koleksiyon genel veritabanÄ± uÃ§ noktasÄ±ndan deÄŸiÅŸtirilemez." });
    try {
      if (req.params.collection === "exams") {
        const currentExam = getDocument("exams", req.params.id);
        const finalizedExam = Boolean(
          currentExam?.finalizedAt ||
          currentExam?.isFinalized === true ||
          currentExam?.bookletLayoutLock?.questionsLocked === true
        );
        if (finalizedExam) {
          return res.status(409).json({ error: "Bu sınav kesinleştirilmiştir. Kesinleştirilmiş sınav silinemez.", finalized: true });
        }
      }
      await deleteDocument(req.params.collection, req.params.id);
      await waitForDocumentStoreWrites();
      res.json({ success: true });
    }
    catch (error: any) { res.status(400).json({ error: error.message }); }
  });

  app.get("/api/lost-documents/:type", (req, res) => {
    try {
      const type = req.params.type;
      const config = type === "diploma"
        ? { collection: "lostDocumentDiplomaRecords", nameField: "Adı Soyadı", numberField: "Okul Numarası", tcField: "TC Kimlik No" }
        : type === "tasdikname"
          ? { collection: "lostDocumentTasdiknameRecords", nameField: "Adı Soyadı", numberField: "Okul Numarası", tcField: "TC No" }
          : null;
      if (!config) return res.status(400).json({ error: "GeÃ§ersiz belge tÃ¼rÃ¼" });
      const query = String(req.query.q || "").trim();
      const searchBy = req.query.by === "tc" ? "tc" : req.query.by === "number" ? "number" : "name";
      const field = searchBy === "tc" ? config.tcField : searchBy === "number" ? config.numberField : config.nameField;
      res.json({ count: countDocuments(config.collection), records: searchDocuments(config.collection, field, query, 1000) });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/students/search", (req, res) => {
    try {
      const query = String(req.query.q || "").trim();
      if (!query) return res.json({ count: countDocuments("students"), records: [] });
      res.json({
        count: countDocuments("students"),
        records: searchDocumentsAny("students", ["classroom", "id", "name"], query, 100),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/database/backup", (_req, res) => {
    try { res.json({ success: true, ...createBackup() }); }
    catch (error: any) { res.status(500).json({ error: error.message }); }
  });

  app.get("/api/health/database", async (_req, res) => {
    try {
      // Test DB connection
      const client = await pool.connect();
      client.release();
      res.json({ status: "ok", db: "connected" });
    } catch (err: any) {
      console.error("DB Connection Error:", err.message);
      res.status(500).json({ status: "error", db: "disconnected", error: err.message });
    }
  });

  app.get("/api/scheduling/libraries", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM scheduling_libraries ORDER BY id ASC");
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/scheduling/runs", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM scheduling_runs ORDER BY id DESC LIMIT 50");
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/scheduling/runs", async (req, res) => {
    try {
      const { algorithm, initial_penalty, final_penalty, duration_ms, status, details } = req.body;
      const inserted = await pool.query(
        "INSERT INTO scheduling_runs (algorithm, initial_penalty, final_penalty, duration_ms, status, details) VALUES ($1, $2, $3, $4, $5, $6)",
        [algorithm, initial_penalty, final_penalty, duration_ms, status, details]
      );
      const result = await pool.query("SELECT * FROM scheduling_runs WHERE id = $1", [inserted.insertId]);
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/scheduling/ortools/health", async (_req, res) => {
    try {
      const result = await checkOrToolsCpSat();
      res.json(result);
    } catch (error: any) {
      res.status(503).json({
        success: false,
        status: "NOT_READY",
        error: error?.message || "OR-Tools CP-SAT servisi hazÄ±r deÄŸil.",
        installCommand: "npm run setup:ortools",
      });
    }
  });

  app.post("/api/scheduling/ortools/solve", async (req, res) => {
    try {
      const result = await runOrToolsCpSat(req.body);
      if (result.error && !result.schedule) return res.status(503).json(result);
      res.json(result);
    } catch (error: any) {
      console.error("OR-Tools CP-SAT Error:", error);
      res.status(500).json({
        success: false,
        error: error?.message || "OR-Tools CP-SAT Ã§alÄ±ÅŸtÄ±rÄ±lamadÄ±.",
        installCommand: "npm run setup:ortools",
      });
    }
  });

  app.post("/api/scheduling/gemini", async (req, res) => {
    try {
      const { classrooms, teachers, scheduleData } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY ortam deÄŸiÅŸkeni tanÄ±mlÄ± deÄŸil. LÃ¼tfen Ayarlar > SÄ±rlar (Secrets) sekmesinden ekleyin.");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const DAYS = ["Pazartesi", "SalÄ±", "Ã‡arÅŸamba", "PerÅŸembe", "Cuma"];
      const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

      // Format teacher data for Gemini
      const ogretmenlerData = teachers.map((t: any) => {
        const kapali_saatler: string[] = [];
        DAYS.forEach((day) => {
          HOURS.forEach((hour) => {
            if (scheduleData[`blocked_teacher_${t.id}_${day}_${hour}`]) {
              kapali_saatler.push(`${day} ${hour}. Saat`);
            }
          });
        });
        return {
          isim: t.name,
          id: t.id,
          kapali_saatler,
        };
      });

      // Format classroom data for Gemini
      const siniflarData = classrooms.map((cls: any) => {
        const kapali_saatler: string[] = [];
        DAYS.forEach((day) => {
          HOURS.forEach((hour) => {
            if (scheduleData[`blocked_class_${cls.id}_${day}_${hour}`]) {
              kapali_saatler.push(`${day} ${hour}. Saat`);
            }
          });
        });

        const dersler = (cls.assignedCourses || []).map((ac: any) => {
          let blok_yapisi = "2";
          if (ac.weeklyHours === 4) {
            blok_yapisi = "2+2";
          } else if (ac.weeklyHours === 6) {
            blok_yapisi = "2+2+2";
          } else if (ac.weeklyHours === 2) {
            blok_yapisi = "2";
          } else if (ac.weeklyHours === 1) {
            blok_yapisi = "1";
          } else if (ac.weeklyHours === 3) {
            blok_yapisi = "2+1";
          } else if (ac.weeklyHours === 5) {
            blok_yapisi = "2+2+1";
          } else {
            blok_yapisi = String(ac.weeklyHours);
          }

          return {
            ders_adi: ac.courseName,
            ogretmen: ac.teacherName,
            ogretmen2: ac.teacherName2 || "",
            haftalik_saat: ac.weeklyHours || 0,
            blok_yapisi,
            grupName: ac.groupName || ""
          };
        });

        return {
          sinif_adi: cls.name,
          id: cls.id,
          kapali_saatler,
          dersler
        };
      });

      const prompt = `AÅŸaÄŸÄ±daki okul ders daÄŸÄ±tÄ±m bilgilerini ve kÄ±sÄ±tlarÄ± kullanarak haftalÄ±k ders programÄ±nÄ± oluÅŸtur:

GÄ°RÄ°Å VERÄ°LERÄ° (JSON FORMATINDA):
${JSON.stringify({ ogretmenler: ogretmenlerData, siniflar: siniflarData }, null, 2)}

KATI KURALLAR:
1. Bir Ã¶ÄŸretmen aynÄ± gÃ¼n ve aynÄ± saat diliminde (Ã–rn: Pazartesi 3. Saat) kesinlikle birden fazla sÄ±nÄ±fa atanamaz.
2. Bir sÄ±nÄ±f aynÄ± saat diliminde sadece bir ders alabilir.
3. Ã–ÄŸretmenlerin "kapali_saatler" listesindeki gÃ¼n ve saatlere kesinlikle ders yazamazsÄ±n.
4. SÄ±nÄ±flarÄ±n "kapali_saatler" listesindeki gÃ¼n ve saatlere kesinlikle ders yazamazsÄ±n.
5. "blok_yapisi" 2+2+2 veya 2+2 vb. olan derslerde, 2 saatlik bloklarÄ± gÃ¼n iÃ§inde ardÄ±ÅŸÄ±k iki saat (Ã–rn: 1. ve 2. saat, veya 3. ve 4. saat, veya 5. ve 6. saat, veya 7. ve 8. saat) olacak ÅŸekilde yerleÅŸtirmelisin. 2 saatlik blok bÃ¶lÃ¼nemez. HaftalÄ±k ders saatini tamamlamak iÃ§in dersleri gÃ¼nlere daÄŸÄ±t.
6. Bir sÄ±nÄ±fÄ±n bir gÃ¼nde alabileceÄŸi maksimum ders saati 8 saattir. EÄŸer sÄ±nÄ±fa atanan toplam haftalÄ±k ders saati haftalÄ±k ders kapasitesinden az ise, ders olmayan saatler iÃ§in "BoÅŸ" yazmalÄ±sÄ±n. Her gÃ¼n tam olarak 8 elemandan oluÅŸmalÄ±dÄ±r.
7. TÃ¼m sÄ±nÄ±flarÄ±n tÃ¼m derslerinin haftalÄ±k saat sayÄ±larÄ± tam olarak karÅŸÄ±lanmalÄ±dÄ±r.

Ã‡IKTI FORMATI:
Sadece ve sadece geÃ§erli bir JSON objesi dÃ¶ndÃ¼r. Metin aÃ§Ä±klamasÄ±, giriÅŸ veya Ã§Ä±kÄ±ÅŸ konuÅŸmasÄ± ekleme. Ã‡Ä±ktÄ± ÅŸu yapÄ±da olmalÄ±dÄ±r:
{
  "sinif_programlari": {
    "9-A": {
      "Pazartesi": ["Matematik", "Matematik", "Tarih", "Tarih", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ"],
      "SalÄ±": ["Fizik", "Fizik", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ"],
      "Ã‡arÅŸamba": ["BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ"],
      "PerÅŸembe": ["BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ"],
      "Cuma": ["BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ", "BoÅŸ"]
    }
  }
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Sen bir okul ders daÄŸÄ±tÄ±m optimizasyon motorusun. GÃ¶revin, verilen JSON verisindeki kÄ±sÄ±tlara %100 uyarak haftalÄ±k ders programÄ± tablosunu JSON olarak Ã¼retmektir.",
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sinif_programlari: {
                type: Type.OBJECT,
                description: "SÄ±nÄ±f isimleri anahtar (Ã¶rn: '9-A'), deÄŸer her gÃ¼n iÃ§in 8 elemanlÄ± ders listesi iÃ§eren bir nesne"
              }
            },
            required: ["sinif_programlari"]
          }
        }
      });

      const responseText = response.text || "{}";
      const resultObj = JSON.parse(responseText.trim());
      res.json(resultObj);
    } catch (err: any) {
      console.error("Gemini optimizer error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tts/stream", async (req, res) => {
    try {
      const text = req.query.text as string;
      const voice = (req.query.voice as string) || "Kore";

      if (!text) {
        return res.status(400).send("Seslendirilecek metin belirtilmedi.");
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).send("GEMINI_API_KEY ortam deÄŸiÅŸkeni tanÄ±mlÄ± deÄŸil.");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioBase64 = inlineData?.data;
      const mimeType = inlineData?.mimeType || "audio/pcm";

      if (!audioBase64) {
        throw new Error("Yapay zeka ses dÃ¶kÃ¼mÃ¼ Ã¼retemedi.");
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // If it's already a playable format like wav or mp3, just send it back
      if (mimeType.includes('wav') || mimeType.includes('mp3') || mimeType.includes('mpeg')) {
         res.set('Content-Type', mimeType);
         return res.send(audioBuffer);
      }

      // Convert raw PCM to WAV
      const numChannels = 1;
      const sampleRate = 24000;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      
      const wavBuffer = Buffer.alloc(44 + audioBuffer.length);
      
      // RIFF chunk descriptor
      wavBuffer.write('RIFF', 0);
      wavBuffer.writeUInt32LE(36 + audioBuffer.length, 4);
      wavBuffer.write('WAVE', 8);
      
      // "fmt " sub-chunk
      wavBuffer.write('fmt ', 12);
      wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size
      wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
      wavBuffer.writeUInt16LE(numChannels, 22);
      wavBuffer.writeUInt32LE(sampleRate, 24);
      wavBuffer.writeUInt32LE(byteRate, 28);
      wavBuffer.writeUInt16LE(blockAlign, 32);
      wavBuffer.writeUInt16LE(bitsPerSample, 34);
      
      // "data" sub-chunk
      wavBuffer.write('data', 36);
      wavBuffer.writeUInt32LE(audioBuffer.length, 40);
      
      audioBuffer.copy(wavBuffer, 44);

      res.set('Content-Type', 'audio/wav');
      res.send(wavBuffer);
    } catch (err: any) {
      console.error("Gemini Stream TTS Error:", err);
      res.status(500).send("Ses dÃ¶kÃ¼mÃ¼ akÄ±ÅŸÄ± Ã¼retilemedi: " + err.message);
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Seslendirilecek metin belirtilmedi." });
      }

      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY ortam deÄŸiÅŸkeni tanÄ±mlÄ± deÄŸil. LÃ¼tfen Ayarlar > SÄ±rlar (Secrets) sekmesinden ekleyin.");
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: text,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice || "Kore"
              }
            }
          }
        }
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const audioBase64 = inlineData?.data;
      const mimeType = inlineData?.mimeType || "audio/pcm";

      if (!audioBase64) {
        throw new Error("Yapay zeka ses dÃ¶kÃ¼mÃ¼ Ã¼retemedi.");
      }

      // If it's already a playable format like wav or mp3, just send it back
      if (mimeType.includes('wav') || mimeType.includes('mp3') || mimeType.includes('mpeg')) {
         return res.json({ audio: audioBase64, mimeType });
      }

      // Otherwise assume raw PCM and Convert raw PCM to WAV
      const pcmBuffer = Buffer.from(audioBase64, 'base64');
      const numChannels = 1;
      const sampleRate = 24000;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      
      const wavBuffer = Buffer.alloc(44 + pcmBuffer.length);
      
      // RIFF chunk descriptor
      wavBuffer.write('RIFF', 0);
      wavBuffer.writeUInt32LE(36 + pcmBuffer.length, 4);
      wavBuffer.write('WAVE', 8);
      
      // "fmt " sub-chunk
      wavBuffer.write('fmt ', 12);
      wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size
      wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
      wavBuffer.writeUInt16LE(numChannels, 22);
      wavBuffer.writeUInt32LE(sampleRate, 24);
      wavBuffer.writeUInt32LE(byteRate, 28);
      wavBuffer.writeUInt16LE(blockAlign, 32);
      wavBuffer.writeUInt16LE(bitsPerSample, 34);
      
      // "data" sub-chunk
      wavBuffer.write('data', 36);
      wavBuffer.writeUInt32LE(pcmBuffer.length, 40);
      
      pcmBuffer.copy(wavBuffer, 44);

      res.json({ audio: wavBuffer.toString('base64'), mimeType: 'audio/wav' });
    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      res.status(500).json({ error: err.message || "Bilinmeyen bir hata oluÅŸtu." });
    }
  });

  // Shorten a single TTS link
  app.post("/api/tts/shorten", async (req, res) => {
    try {
      const { text, voice, studentName, examName } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Metin belirtilmedi." });
      }
      const id = Math.random().toString(36).substring(2, 10); // 8 chars
      
      await pool.query(
        "INSERT INTO tts_links (id, text, voice, student_name, exam_name) VALUES ($1, $2, $3, $4, $5)",
        [id, text, voice || "Kore", studentName || "", examName || ""]
      );

      res.json({ id });
    } catch (err: any) {
      console.error("Shorten error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Shorten multiple TTS links in a batch
  app.post("/api/tts/shorten-batch", async (req, res) => {
    try {
      const { items } = req.body; // array of { text, voice, studentName, examName, studentId }
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "GeÃ§ersiz veri formatÄ±." });
      }

      const results: { studentName: string; studentId: string; shortId: string }[] = [];
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const item of items) {
          const id = Math.random().toString(36).substring(2, 10);
          await client.query(
            "INSERT INTO tts_links (id, text, voice, student_name, exam_name) VALUES ($1, $2, $3, $4, $5)",
            [id, item.text, item.voice || "Kore", item.studentName || "", item.examName || ""]
          );
          results.push({ 
            studentName: item.studentName, 
            studentId: item.studentId,
            shortId: id 
          });
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      res.json({ success: true, results });
    } catch (err: any) {
      console.error("Batch shorten error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Serve a beautiful visual player page for a shortened link
  app.get("/api/tts/s/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query("SELECT * FROM tts_links WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return res.status(404).send(`
          <html>
            <head>
              <title>Sesli Karne BulunamadÄ±</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script src="https://cdn.tailwindcss.com"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
              <style>body { font-family: 'Inter', sans-serif; }</style>
            </head>
            <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">
              <div class="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-md w-full text-center space-y-4">
                <div class="text-4xl">âš ï¸</div>
                <h2 class="text-lg font-black text-slate-850">BaÄŸlantÄ± GeÃ§ersiz</h2>
                <p class="text-xs text-slate-450 font-bold leading-relaxed">Ä°stediÄŸiniz sesli karne kaydÄ± bulunamadÄ± veya sÃ¼resi dolmuÅŸ olabilir.</p>
                <a href="/" class="inline-block bg-orange-650 text-white font-black text-xs px-6 py-3 rounded-2xl">Ana Sayfaya DÃ¶n</a>
              </div>
            </body>
          </html>
        `);
      }

      const link = result.rows[0];
      const audioUrl = `/api/tts/stream?voice=${encodeURIComponent(link.voice)}&text=${encodeURIComponent(link.text)}`;

      res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>\${link.student_name ? link.student_name + ' - ' : ''}Sesli Karne Raporu</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', sans-serif;
            }
            .sound-wave-bar {
              animation: wave-bounce 1s ease-in-out infinite alternate;
              animation-play-state: paused;
            }
            @keyframes wave-bounce {
              0% { height: 4px; }
              100% { height: 32px; }
            }
            .wave-delay-1 { animation-delay: 0.1s; }
            .wave-delay-2 { animation-delay: 0.2s; }
            .wave-delay-3 { animation-delay: 0.3s; }
            .wave-delay-4 { animation-delay: 0.4s; }
            .wave-delay-5 { animation-delay: 0.5s; }
          </style>
        </head>
        <body class="bg-slate-50 min-h-screen flex flex-col justify-between p-4 antialiased selection:bg-orange-500/10">
          <div class="flex-1 flex items-center justify-center py-12">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 max-w-md w-full p-8 space-y-8 relative overflow-hidden">
              
              <!-- Top soft gradient accent -->
              <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 to-amber-500"></div>

              <!-- Header -->
              <div class="text-center space-y-2">
                <span class="inline-flex items-center gap-1.5 bg-orange-50 text-orange-650 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider uppercase">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  Yapay Zeka Sesli Karne
                </span>
                <h1 class="text-2xl font-black text-slate-850 tracking-tight leading-none pt-2">\${link.student_name || 'DeÄŸerli Ã–ÄŸrencimiz'}</h1>
                <p class="text-xs text-slate-400 font-bold">\${link.exam_name || 'Deneme SÄ±navÄ± Analiz Raporu'}</p>
              </div>

              <!-- Waveform Visualizer -->
              <div class="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
                <div id="wave-container" class="flex items-center justify-center gap-1.5 h-10 w-full opacity-40 transition-opacity duration-300">
                  <div class="sound-wave-bar wave-delay-1 w-1.5 bg-orange-500 rounded-full h-4"></div>
                  <div class="sound-wave-bar wave-delay-2 w-1.5 bg-orange-500 rounded-full h-6"></div>
                  <div class="sound-wave-bar wave-delay-3 w-1.5 bg-orange-500 rounded-full h-8"></div>
                  <div class="sound-wave-bar wave-delay-4 w-1.5 bg-orange-500 rounded-full h-10"></div>
                  <div class="sound-wave-bar wave-delay-5 w-1.5 bg-orange-500 rounded-full h-8"></div>
                  <div class="sound-wave-bar wave-delay-3 w-1.5 bg-orange-500 rounded-full h-6"></div>
                  <div class="sound-wave-bar wave-delay-1 w-1.5 bg-orange-500 rounded-full h-4"></div>
                </div>
                <div id="status-text" class="text-[11px] font-bold text-slate-450 tracking-wide uppercase">DÄ°NLEMEYE HAZIR</div>
              </div>

              <!-- Audio Player Core -->
              <audio id="audio-player" src="\${audioUrl}" preload="auto"></audio>

              <!-- Controls -->
              <div class="space-y-4">
                <button id="play-btn" class="w-full flex items-center justify-center gap-3 h-14 rounded-2xl font-black text-sm text-white bg-orange-650 hover:bg-orange-700 active:scale-[0.98] transition-all shadow-md shadow-orange-650/10 cursor-pointer">
                  <!-- Play Icon -->
                  <svg id="play-icon" class="w-5 h-5 fill-white" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <!-- Pause Icon (Hidden by default) -->
                  <svg id="pause-icon" class="w-5 h-5 fill-white hidden" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                  </svg>
                  <span id="btn-text">Analizi Dinle</span>
                </button>

                <!-- Progress Bar -->
                <div id="progress-container" class="space-y-1 hidden">
                  <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative cursor-pointer" id="progress-bar-bg">
                    <div id="progress-bar" class="h-full bg-orange-500 w-0 transition-all duration-100"></div>
                  </div>
                  <div class="flex justify-between text-[10px] font-mono text-slate-400 font-bold">
                    <span id="current-time">0:00</span>
                    <span id="duration">0:00</span>
                  </div>
                </div>
              </div>

              <!-- Content summary collapse -->
              <div class="border-t border-slate-100 pt-5 space-y-3">
                <details class="group">
                  <summary class="flex justify-between items-center text-xs font-bold text-slate-500 cursor-pointer select-none">
                    <span>YazÄ±lÄ± Analiz Raporunu GÃ¶ster</span>
                    <svg class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div class="mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-650 leading-relaxed font-bold whitespace-pre-wrap max-h-48 overflow-y-auto">
                    \${escapeHtml(link.text)}
                  </div>
                </details>
              </div>

            </div>
          </div>

          <!-- Footer -->
          <div class="text-center py-6">
            <p class="text-[10px] text-slate-400 font-bold">
              Bu sesli karne yapay zeka tarafÄ±ndan analiz edilerek Ã¼retilmiÅŸtir.
            </p>
          </div>

          <script>
            const audio = document.getElementById('audio-player');
            const playBtn = document.getElementById('play-btn');
            const playIcon = document.getElementById('play-icon');
            const pauseIcon = document.getElementById('pause-icon');
            const btnText = document.getElementById('btn-text');
            const statusText = document.getElementById('status-text');
            const waveBars = document.querySelectorAll('.sound-wave-bar');
            const waveContainer = document.getElementById('wave-container');
            const progressContainer = document.getElementById('progress-container');
            const progressBar = document.getElementById('progress-bar');
            const progressBarBg = document.getElementById('progress-bar-bg');
            const currentTimeEl = document.getElementById('current-time');
            const durationEl = document.getElementById('duration');

            function formatTime(secs) {
              if (isNaN(secs)) return '0:00';
              const m = Math.floor(secs / 60);
              const s = Math.floor(secs % 60);
              return m + ':' + (s < 10 ? '0' : '') + s;
            }

            playBtn.addEventListener('click', () => {
              if (audio.paused) {
                audio.play().then(() => {
                  playIcon.classList.add('hidden');
                  pauseIcon.classList.remove('hidden');
                  btnText.innerText = 'Analizi Duraklat';
                  statusText.innerText = 'SESLÄ° RAPOR OYNATILIYOR';
                  waveContainer.classList.remove('opacity-40');
                  waveBars.forEach(bar => bar.style.animationPlayState = 'running');
                  progressContainer.classList.remove('hidden');
                }).catch(err => {
                  console.error(err);
                  statusText.innerText = 'YÃœKLENEMEDÄ°. TEKRAR DENEYÄ°N';
                });
              } else {
                audio.pause();
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
                btnText.innerText = 'Analizi Dinle';
                statusText.innerText = 'DURAKLATILDI';
                waveContainer.classList.add('opacity-40');
                waveBars.forEach(bar => bar.style.animationPlayState = 'paused');
              }
            });

            audio.addEventListener('timeupdate', () => {
              const percent = (audio.currentTime / audio.duration) * 100;
              progressBar.style.width = percent + '%';
              currentTimeEl.innerText = formatTime(audio.currentTime);
              if (audio.duration) {
                durationEl.innerText = formatTime(audio.duration);
              }
            });

            audio.addEventListener('loadedmetadata', () => {
              durationEl.innerText = formatTime(audio.duration);
            });

            audio.addEventListener('ended', () => {
              playIcon.classList.remove('hidden');
              pauseIcon.classList.add('hidden');
              btnText.innerText = 'Yeniden Dinle';
              statusText.innerText = 'TAMAMLANDI';
              waveContainer.classList.add('opacity-40');
              waveBars.forEach(bar => bar.style.animationPlayState = 'paused');
              progressBar.style.width = '0%';
              currentTimeEl.innerText = '0:00';
            });

            // Progress bar scrub
            progressBarBg.addEventListener('click', (e) => {
              const rect = progressBarBg.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const width = rect.width;
              const duration = audio.duration;
              if (duration) {
                audio.currentTime = (clickX / width) * duration;
              }
            });
          </script>
        </body>
        </html>
      `);
    } catch (err: any) {
      console.error("GET /api/tts/s/:id error:", err);
      res.status(500).send("Bir hata oluÅŸtu: " + err.message);
    }
  });

  function escapeHtml(text: string) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  // mHatsapp gÃ¼venli backend proxy. TarayÄ±cÄ± CORS'a takÄ±lmasÄ±n ve medya base64 doÄŸru iletilsin.

  // mHatsapp runtime ayarlari --------------------------------------------------
  const MHATSAPP_RUNTIME_SETTINGS_COLLECTION = "mhatsappRuntimeSettings";
  const MHATSAPP_RUNTIME_SETTINGS_ID = "active";

  const loadMhatsappRuntimeSettings = () => {
    const saved = (listDocuments(
      MHATSAPP_RUNTIME_SETTINGS_COLLECTION
    ) as any[]).find(
      (item: any) =>
        String(item?.id || "").trim() === MHATSAPP_RUNTIME_SETTINGS_ID
    );

    return {
      baseUrl: String(
        saved?.baseUrl || "https://api.mhatsapp.com"
      ).trim().replace(/\/$/, ""),
      token: String(saved?.token || "").trim(),
      updatedAt: String(saved?.updatedAt || ""),
    };
  };

  app.get("/api/mhatsapp/runtime-settings", (_req, res) => {
    try {
      const saved = loadMhatsappRuntimeSettings();

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        ok: true,
        configured: Boolean(saved.token),
        baseUrl: saved.baseUrl,
        updatedAt: saved.updatedAt,
      });
    } catch (error: any) {
      console.error("GET /api/mhatsapp/runtime-settings error:", error);

      return res.status(500).json({
        ok: false,
        error:
          error?.message ||
          "mHatsapp runtime ayarlari okunamadi.",
      });
    }
  });

  app.post("/api/mhatsapp/runtime-settings", (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();

      const requestedBaseUrl = String(
        req.body?.baseUrl || "https://api.mhatsapp.com"
      ).trim().replace(/\/$/, "");

      if (!token) {
        return res.status(400).json({
          ok: false,
          error: "mHatsapp API token eksik.",
        });
      }

      let parsed: URL;

      try {
        parsed = new URL(requestedBaseUrl);
      } catch {
        return res.status(400).json({
          ok: false,
          error: "mHatsapp Base URL gecersiz.",
        });
      }

      const allowedHosts = new Set([
        "api.mhatsapp.com",
        "msg.mhatsapp.com",
        "msgapi.mhatsapp.com",
      ]);

      if (!allowedHosts.has(parsed.hostname)) {
        return res.status(400).json({
          ok: false,
          error: "mHatsapp servis adresi gecersiz.",
        });
      }

      const record = {
        id: MHATSAPP_RUNTIME_SETTINGS_ID,
        baseUrl: `${parsed.protocol}//${parsed.hostname}`,
        token,
        updatedAt: new Date().toISOString(),
      };

      upsertDocument(
        MHATSAPP_RUNTIME_SETTINGS_COLLECTION,
        MHATSAPP_RUNTIME_SETTINGS_ID,
        record
      );

      return res.json({
        ok: true,
        configured: true,
        baseUrl: record.baseUrl,
        updatedAt: record.updatedAt,
      });
    } catch (error: any) {
      console.error("POST /api/mhatsapp/runtime-settings error:", error);

      return res.status(500).json({
        ok: false,
        error:
          error?.message ||
          "mHatsapp runtime ayarlari kaydedilemedi.",
      });
    }
  });
  app.post("/api/mhatsapp/proxy", async (req, res) => {
    try {
      const { targetUrl, path: apiPath, baseUrl, action } = req.body || {};
      if (!action || typeof action !== "object") {
        return res.status(200).json({ ok: false, error: "action gÃ¶vdesi eksik." });
      }

      const allowedPaths = new Set(["/api/v3/message/send/", "/api/send-msg-blocking/", "/api/v3/bulk/send/", "/api/register-callback"]);
      let safePath = "";
      let root = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim().replace(/\/$/, "") : "https://api.mhatsapp.com";

      if (typeof apiPath === "string" && apiPath.trim()) {
        safePath = apiPath.trim();
      } else if (typeof targetUrl === "string" && targetUrl.trim()) {
        try {
          const parsed = new URL(targetUrl.trim());
          if (["api.mhatsapp.com", "msg.mhatsapp.com", "msgapi.mhatsapp.com"].includes(parsed.hostname)) {
            root = `${parsed.protocol}//${parsed.hostname}`;
            safePath = parsed.pathname;
            if (targetUrl.trim().endsWith("/") && !safePath.endsWith("/")) safePath += "/";
          }
        } catch {}
      }

      if (!safePath.startsWith("/")) safePath = `/${safePath}`;
      if (safePath === "/api/v3/message/send") safePath = "/api/v3/message/send/";
      if (safePath === "/api/v3/bulk/send") safePath = "/api/v3/bulk/send/";
      if (safePath === "/api/send-msg-blocking") safePath = "/api/send-msg-blocking/";
      if (!allowedPaths.has(safePath)) {
        return res.status(200).json({ ok: false, error: `GeÃ§ersiz mHatsapp API yolu: ${safePath || "boÅŸ"}` });
      }

      try {
        const parsedRoot = new URL(root);
        if (!["api.mhatsapp.com", "msg.mhatsapp.com", "msgapi.mhatsapp.com"].includes(parsedRoot.hostname)) root = "https://api.mhatsapp.com";
      } catch {
        root = "https://api.mhatsapp.com";
      }

      const safeAction: any = { ...action };
      // mHatsapp Go ActionStruct expects action.numbers as a string, not an array.
      // Normalize one or multiple recipients to comma-separated text.
      if (Array.isArray(safeAction.numbers)) safeAction.numbers = safeAction.numbers.join(",");
      if (safeAction.numbers !== undefined) safeAction.numbers = String(safeAction.numbers);
      if (safeAction.message === undefined || safeAction.message === null) safeAction.message = " ";
      if (safeAction.filename) safeAction.filename = String(safeAction.filename);
      if (safeAction.file) safeAction.file = String(safeAction.file).replace(/^data:[^,]+,/, "");
      const payload = { action: safeAction };

      const isMedia = safeAction?.type === "image" || safeAction?.type === "document";
      const candidateRoots = [root];
      if (isMedia) {
        for (const alt of ["https://api.mhatsapp.com", "https://msg.mhatsapp.com", "https://msgapi.mhatsapp.com"]) {
          if (!candidateRoots.includes(alt)) candidateRoots.push(alt);
        }
      }

      let lastStatus = 0;
      let lastData: any = null;
      let lastOk = false;

      for (const candidateRoot of candidateRoots) {
        const finalTargetUrl = `${candidateRoot}${safePath}`;
        console.log("mHatsapp proxy target:", finalTargetUrl);
        console.log("mHatsapp proxy type:", safeAction?.type, "numbers:", safeAction?.numbers, "filename:", safeAction?.filename || "-");

        const providerController = new AbortController();
        const providerTimeoutId = setTimeout(() => providerController.abort(), 20_000);
        let response: Response;
        try {
          response = await fetch(finalTargetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: providerController.signal,
          });
        } finally {
          clearTimeout(providerTimeoutId);
        }

        const responseText = await response.text();
        let data: any;
        try {
          data = responseText.trim() ? JSON.parse(responseText) : { rawResponse: "" };
        } catch {
          data = { rawResponse: responseText };
        }
        const providerData = data?.data && typeof data.data === "object" ? data.data : data;
        const statusText = String(
          providerData?.status ||
          providerData?.message ||
          providerData?.error ||
          providerData?.rawResponse ||
          "",
        ).trim();
        const normalizedStatus = statusText.toLowerCase();
        const explicitlyFailed =
          data?.ok === false ||
          providerData?.ok === false ||
          Boolean(providerData?.error) ||
          /(^|\b)(error|failed|failure|invalid|denied|rejected)(\b|$)/i.test(normalizedStatus);
        const explicitlyAccepted =
          data?.ok === true ||
          providerData?.ok === true ||
          Boolean(providerData?.id || providerData?.messageId || providerData?.message_id) ||
          /(^|\b)(success|sent|queued|accepted|ok)(\b|$)/i.test(normalizedStatus);
        const apiOk = response.ok && !explicitlyFailed && explicitlyAccepted;
        lastStatus = response.status;
        lastData = data;
        lastOk = apiOk;
        if (apiOk || !isMedia || response.status !== 502) break;
      }

      return res.status(200).json({
        ok: lastOk,
        httpStatus: lastStatus,
        data: lastData,
        error: lastOk
          ? undefined
          : (lastData?.status || lastData?.error || lastData?.message || lastData?.rawResponse ||
            (lastStatus >= 200 && lastStatus < 300
              ? "mHatsapp API isteğine HTTP 200 yanıtı verdi fakat gönderim onayı veya mesaj kimliği bulunamadı. Mesajın telefona teslim edildiği doğrulanmadı."
              : `HTTP ${lastStatus}`)),
      });
    } catch (err: any) {
      console.error("mHatsapp proxy error:", err);
      const timeoutError = err?.name === "AbortError";
      return res.status(200).json({
        ok: false,
        error: timeoutError
          ? "mHatsapp sunucusu 20 saniye içinde yanıt vermedi. Gönderim doğrulanamadı."
          : (err?.message || "mHatsapp proxy hatasÄ±"),
      });
    }
  });

  app.delete("/api/mhatsapp/delete-callback", async (req, res) => {
    try {
      const { baseUrl, token } = req.body || {};
      if (!token) return res.status(400).json({ ok: false, error: "Token eksik." });
      const root = String(baseUrl || "https://api.mhatsapp.com").replace(/\/$/, "");
      const response = await fetch(`${root}/api/delete-callback/${token}`, { method: "DELETE" });
      const text = await response.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { rawResponse: text }; }
      res.status(response.ok ? 200 : response.status).json({ ok: response.ok && data?.status === "success", httpStatus: response.status, data });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || "Webhook silme proxy hatasÄ±" });
    }
  });

  // Send automatic direct WhatsApp message via mhatsapp.com API
  app.post("/api/whatsapp/send-direct", async (req, res) => {
    try {
      const { apiUrl, apiKey, phone, numbers, message, type, filename, file } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: "API anahtarÄ± (Token) eksik." });
      }
      
      // Support both phone (from older versions) or numbers (for multi-receiver / newer versions)
      let targetNumbers = phone || numbers;
      if (!targetNumbers) {
        return res.status(400).json({ error: "AlÄ±cÄ± telefon numarasÄ±/numaralarÄ± belirtilmedi." });
      }
      
      const targetUrl = apiUrl || "https://api.mhatsapp.com/api/v3/message/send/";
      const messageType = type || "text";
      const isMedia = messageType === "image" || messageType === "document";
      
      if (!message && !isMedia) {
        return res.status(400).json({ error: "GÃ¶nderilecek mesaj iÃ§eriÄŸi boÅŸ olamaz." });
      }

      // Support personalized messages (where message is an array and numbers is an array)
      // Always use array for numbers since mhatsapp API likely expects an array
      let finalNumbers: string[] = [];
      if (typeof targetNumbers === "string") {
        finalNumbers = targetNumbers.split(",").map(num => String(num).trim()).filter(Boolean);
      } else if (Array.isArray(targetNumbers)) {
        finalNumbers = targetNumbers.map(num => String(num).trim()).filter(Boolean);
      }

      // Construct exact payload specified by user's curls
      const payload: any = {
        action: {
          type: messageType,
          token: [apiKey],
          numbers: isMedia ? finalNumbers.join(",") : finalNumbers
        }
      };
      
      // Mhatsapp API uses "message" for text content or captions
      if (message) {
         payload.action.message = message;
      }

      // Add file attachment if type is image or document
      if (messageType === "image" || messageType === "document") {
        if (file) {
          if (messageType === "image") {
            payload.action.image = file;
          } else {
            payload.action.file = file; 
          }
        }
        if (filename) {
          payload.action.filename = filename;
        }
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawResponse: responseText };
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: `API HatasÄ± (${response.status})`,
          details: responseData
        });
      }

      const providerData = responseData?.data ?? responseData;
      const providerStatus = String(providerData?.status || responseData?.status || responseData?.message || "").toLowerCase();
      const providerError = Boolean(responseData?.error) || responseData?.ok === false || providerStatus.includes("error") || providerStatus.includes("fail");
      const providerAccepted = !providerError && (providerStatus === "success" || responseData?.success === true || responseData?.ok === true || Boolean(providerData?.id));
      if (!providerAccepted) {
        return res.status(502).json({
          success: false,
          error: responseData?.error || responseData?.message || providerData?.status || "WhatsApp saÄŸlayÄ±cÄ±sÄ± mesajÄ± kabul etmedi.",
          details: responseData
        });
      }

      res.json({ success: true, status: providerData?.status || "success", id: providerData?.id, data: responseData });
    } catch (err: any) {
      console.error("WhatsApp send API error:", err);
      res.status(500).json({ error: err.message || "Bilinmeyen bir hata oluÅŸtu." });
    }
  });

  // Example generic query endpoint if needed
  // app.post("/api/query", async (req, res) => { ... });

  
  // ===== Tek Sunucu: DavranÄ±ÅŸ / Ã–ÄŸretmen Linki / Ã–dev API =====
  const behaviorEventClients = new Set<express.Response>();
  const broadcastBehaviorChanged = (reason: "submission" | "delete") => {
    const payload = `event: behavior-changed\ndata: ${JSON.stringify({ reason, at: Date.now() })}\n\n`;
    for (const client of behaviorEventClients) {
      try { client.write(payload); } catch { behaviorEventClients.delete(client); }
    }
  };

  app.get("/api/behavior/events", (request, response) => {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders?.();
    response.write(`event: ready\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`);
    behaviorEventClients.add(response);
    const heartbeat = setInterval(() => {
      try { response.write(`: ping ${Date.now()}\n\n`); } catch {}
    }, 25000);
    request.on("close", () => {
      clearInterval(heartbeat);
      behaviorEventClients.delete(response);
    });
  });

  const behaviorPublishSchema = z.object({
    schoolId: z.string().min(1).max(160),
    teacherId: z.string().min(1).max(160),
    teacherName: z.string().min(1).max(240),
    createdBy: z.string().max(240).optional().default(""),
    students: z.array(z.object({
      id: z.string(),
      name: z.string(),
      classroom: z.string(),
      number: z.string(),
    })).max(3000),
    behaviors: z.array(z.object({
      id: z.string(),
      type: z.enum(["Olumlu", "Olumsuz"]),
      name: z.string(),
    })).max(500),
    validDays: z.number().int().min(1).max(365).default(365),
  });

  const BEHAVIOR_LINKS = "behaviorTeacherLinks";
  const BEHAVIOR_SUBMISSIONS = "behaviorTeacherSubmissions";
  const HOMEWORK_SESSIONS = "teacherHomeworkSessions";
  const TEACHER_ACTIVITY_RECORDS = "teacherActivityRecords";
  const HOMEWORK_EVALUATIONS = "teacherHomeworkEvaluations";
  const PUBLIC_PORTAL_LINKS = "publicPortalLinks";

  const hashPublicPortalToken = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest("hex");

  const publicPortalBaseUrl = (request: express.Request, requestedBaseUrl?: unknown) => {
    const supplied = String(requestedBaseUrl || "").trim();
    if (supplied) {
      try {
        const parsed = new URL(supplied);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.origin;
        }
      } catch {}
    }

    // Mevcut canlÄ± rapor URL Ã§Ã¶zÃ¼mleyicisini kullan.
    return liveReportPublicBase(request);
  };

  const findPublicPortalByToken = (token: string) => {
    if (!/^[A-Za-z0-9_-]{30,200}$/.test(token)) return null;
    const tokenHash = hashPublicPortalToken(token);
    return listDocuments(PUBLIC_PORTAL_LINKS).find(
      (item: any) =>
        String(item?.tokenHash || "") === tokenHash &&
        !item?.revokedAt
    ) || null;
  };


  // YILLIK --------------------------------------------------------------------
  const YEARBOOK_SETTINGS = "yearbookSettings";
  const YEARBOOK_ENTRIES = "yearbookEntries";
  const YEARBOOK_SETTINGS_ID = "global";
  const yearbookText = (value: unknown) => String(value ?? "").trim();
  const yearbookClass = (value: unknown) => yearbookText(value).toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g, "");
  const yearbookNumber = (value: unknown) => {
    const raw = yearbookText(value);
    const digits = raw.replace(/\D/g, "");
    return (digits || raw).replace(/^0+/, "") || "0";
  };
  const yearbookRoster = () => {
    const classroomRows = [...listDocuments("school_classrooms"), ...listDocuments("classrooms")];
    const classroomById = new Map<string, string>();
    classroomRows.forEach((row: any) => {
      const id = yearbookText(row?.id || row?.classroomId || row?.classId || row?.__documentId);
      const name = yearbookText(row?.name || row?.classroom || row?.classroomName || row?.className || row?.branch || row?.sinif || row?.["sınıf"]);
      if (id && name && !classroomById.has(id)) classroomById.set(id, name);
    });

    const seen = new Set<string>();
    const students = [...listDocuments("school_students"), ...listDocuments("students")]
      .map((student: any) => {
        const firstName = yearbookText(student?.firstName || student?.givenName || student?.ad || student?.adi || student?.isim);
        const lastName = yearbookText(student?.lastName || student?.surname || student?.soyad || student?.soyadi);
        const composedName = `${firstName} ${lastName}`.trim();
        const name = yearbookText(student?.name || student?.fullName || student?.studentName || student?.studentFullName || student?.adSoyad || student?.ogrenciAdSoyad || composedName);
        const classroomId = yearbookText(student?.classroomId || student?.classId || student?.classroom_id);
        const classroom = yearbookText(
          student?.classroom || student?.className || student?.classroomName || student?.branch ||
          student?.sinif || student?.["sınıf"] || student?.sube || student?.["şube"] || student?.class ||
          classroomById.get(classroomId)
        );
        const number = yearbookText(
          student?.number || student?.studentNumber || student?.schoolNumber || student?.studentNo ||
          student?.schoolNo || student?.no || student?.ogrenciNo || student?.["öğrenciNo"] || student?.okulNo || student?.numara
        );
        const rawId = yearbookText(student?.id || student?.studentId || student?.recordId || student?.__documentId);
        const id = rawId || `${yearbookClass(classroom)}:${yearbookNumber(number) || name}`;
        return { id, name, number, classroom, classroomId };
      })
      .filter((item: any) => {
        if (!item.id || !item.name || !item.classroom) return false;
        const dedupeKey = `${yearbookClass(item.classroom)}|${yearbookNumber(item.number)}|${item.name.toLocaleUpperCase("tr-TR")}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      })
      .sort((a: any, b: any) =>
        yearbookClass(a.classroom).localeCompare(yearbookClass(b.classroom), "tr-TR", { numeric: true }) ||
        Number(yearbookNumber(a.number)) - Number(yearbookNumber(b.number)) ||
        a.name.localeCompare(b.name, "tr-TR")
      );

    const classrooms = Array.from(new Set([
      ...classroomRows.map((row: any) => yearbookText(row?.name || row?.classroom || row?.classroomName || row?.className || row?.branch)).filter(Boolean),
      ...students.map((row: any) => row.classroom).filter(Boolean),
    ])).sort((a, b) => a.localeCompare(b, "tr-TR", { numeric: true }));

    return { students, classrooms };
  };
  const yearbookStudents = () => yearbookRoster().students;
  const normalizeYearbookSurvey = (row: any) => {
    if (!row || !Array.isArray(row.questions)) return null;
    const questions = row.questions
      .map((q: any) => ({
        id: yearbookText(q?.id),
        text: yearbookText(q?.text),
        answerType: yearbookText(q?.answerType) || "choice",
        options: Array.isArray(q?.options) ? q.options.map((x: any) => yearbookText(x)).filter(Boolean) : [],
        required: q?.required === true,
      }))
      .filter((q: any) => q.id && q.text);
    if (!questions.length) return null;
    return {
      id: yearbookText(row.id),
      title: yearbookText(row.title) || "Yıllık Anketi",
      description: yearbookText(row.description),
      questions,
    };
  };
  const yearbookSurveyById = (surveyId: string) => normalizeYearbookSurvey(
    listDocuments("surveys").find((item: any) => String(item?.id || "") === surveyId),
  );
  const yearbookSettings = () => {
    const row: any = listDocuments(YEARBOOK_SETTINGS).find((item: any) => String(item?.id || "") === YEARBOOK_SETTINGS_ID);
    const requestedSurveyId = yearbookText(row?.surveyId);
    const survey = requestedSurveyId ? yearbookSurveyById(requestedSurveyId) : null;
    return {
      open: row?.open === true,
      surveyId: survey?.id || "",
      survey,
      updatedAt: row?.updatedAt || null,
    };
  };
  const yearbookStableEntryId = (authorId: string, targetId: string) => behaviorDocumentId("yearbook", authorId, targetId);

  app.get("/api/yearbook/settings", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    return response.json(yearbookSettings());
  });

  app.get("/api/yearbook/roster", (_request, response) => {
    try {
      const roster = yearbookRoster();
      response.setHeader("Cache-Control", "no-store");
      return response.json(roster);
    } catch (error: any) {
      return response.status(500).json({ error: error?.message || "Yıllık sınıf ve öğrenci listesi yüklenemedi." });
    }
  });

  app.put("/api/yearbook/settings", (request, response) => {
    const current = yearbookSettings();
    const hasOpen = typeof request.body?.open === "boolean";
    const hasSurveyId = Object.prototype.hasOwnProperty.call(request.body || {}, "surveyId");
    let surveyId = current.surveyId;
    if (hasSurveyId) {
      const requested = yearbookText(request.body?.surveyId);
      if (requested && !yearbookSurveyById(requested)) {
        return response.status(400).json({ error: "Yıllıkta kullanılacak anket bulunamadı veya ankette geçerli soru yok." });
      }
      surveyId = requested;
    }
    const now = new Date().toISOString();
    const payload = {
      id: YEARBOOK_SETTINGS_ID,
      open: hasOpen ? request.body.open === true : current.open,
      surveyId,
      updatedAt: now,
    };
    upsertDocument(YEARBOOK_SETTINGS, YEARBOOK_SETTINGS_ID, payload);
    response.setHeader("Cache-Control", "no-store");
    return response.json(yearbookSettings());
  });

  app.get("/api/yearbook/admin", (request, response) => {
    const classroom = yearbookText(request.query.classroom);
    const targetStudentId = yearbookText(request.query.targetStudentId);
    if (!classroom || !targetStudentId) return response.status(400).json({ error: "Sınıf ve öğrenci seçilmelidir." });
    const settings = yearbookSettings();
    const students = yearbookStudents();
    const target = students.find((item: any) => item.id === targetStudentId && yearbookClass(item.classroom) === yearbookClass(classroom));
    if (!target) return response.status(404).json({ error: "Öğrenci bulunamadı." });
    const classmates = students.filter((item: any) => yearbookClass(item.classroom) === yearbookClass(target.classroom) && item.id !== target.id);
    const entries = listDocuments(YEARBOOK_ENTRIES).filter((item: any) => String(item?.targetStudentId || "") === target.id);
    const byAuthor = new Map(entries.map((item: any) => [String(item?.authorStudentId || ""), item]));
    const authors = classmates.map((student: any) => {
      const entry: any = byAuthor.get(student.id) || null;
      return {
        ...student,
        submitted: Boolean(entry),
        entry: entry ? {
          comment: yearbookText(entry.comment),
          surveyAnswers: entry?.surveyAnswers && typeof entry.surveyAnswers === "object" ? entry.surveyAnswers : {},
          updatedAt: entry.updatedAt || entry.createdAt || null,
        } : null,
      };
    });
    response.setHeader("Cache-Control", "no-store");
    return response.json({
      ...settings,
      target,
      authors,
      totals: {
        total: authors.length,
        submitted: authors.filter((x: any) => x.submitted).length,
        missing: authors.filter((x: any) => !x.submitted).length,
      },
    });
  });

  app.get("/api/public-portal/:token/yearbook", (request, response) => {
    const token = yearbookText(request.params.token);
    const portal: any = findPublicPortalByToken(token);
    if (!portal || String(portal.kind) !== "student") return response.status(404).json({ error: "Öğrenci uygulama bağlantısı bulunamadı." });
    const settings = yearbookSettings();
    const students = yearbookStudents();
    const current = students.find((item: any) => item.id === yearbookText(portal.studentId)) || students.find((item: any) => yearbookNumber(item.number) === yearbookNumber(portal.studentNumber) && yearbookClass(item.classroom) === yearbookClass(portal.classroom)) || { id: yearbookText(portal.studentId), name: yearbookText(portal.studentName), number: yearbookText(portal.studentNumber), classroom: yearbookText(portal.classroom) };
    const classmates = students.filter((item: any) => yearbookClass(item.classroom) === yearbookClass(current.classroom) && item.id !== current.id).sort((a: any,b: any) => Number(yearbookNumber(a.number))-Number(yearbookNumber(b.number)) || a.name.localeCompare(b.name,"tr-TR"));
    const myEntries = listDocuments(YEARBOOK_ENTRIES)
      .filter((item: any) => String(item?.authorStudentId || "") === current.id)
      .map((item: any) => ({
        targetStudentId: yearbookText(item.targetStudentId),
        comment: yearbookText(item.comment),
        surveyAnswers: item?.surveyAnswers && typeof item.surveyAnswers === "object" ? item.surveyAnswers : {},
        updatedAt: item.updatedAt || item.createdAt || null,
      }));
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ ...settings, currentStudent: current, classmates, myEntries });
  });

  app.put("/api/public-portal/:token/yearbook/:targetStudentId", (request, response) => {
    const token = yearbookText(request.params.token);
    const portal: any = findPublicPortalByToken(token);
    if (!portal || String(portal.kind) !== "student") return response.status(404).json({ error: "Öğrenci uygulama bağlantısı bulunamadı." });
    const settings = yearbookSettings();
    if (!settings.open) return response.status(423).json({ error: "Yıllık yönetici tarafından öğrencilere kapatıldı." });
    if (!settings.survey) return response.status(409).json({ error: "Yıllık için kullanılacak anket yönetici tarafından henüz seçilmedi." });
    const students = yearbookStudents();
    const current = students.find((item: any) => item.id === yearbookText(portal.studentId)) || students.find((item: any) => yearbookNumber(item.number) === yearbookNumber(portal.studentNumber) && yearbookClass(item.classroom) === yearbookClass(portal.classroom));
    if (!current) return response.status(404).json({ error: "Öğrenci kaydı bulunamadı." });
    const targetId = yearbookText(request.params.targetStudentId);
    const target = students.find((item: any) => item.id === targetId);
    if (!target || yearbookClass(target.classroom) !== yearbookClass(current.classroom)) return response.status(400).json({ error: "Yalnızca kendi sınıfınızdaki bir arkadaşınızı seçebilirsiniz." });
    if (target.id === current.id) return response.status(400).json({ error: "Kendiniz için yıllık kaydı oluşturamazsınız." });
    const comment = yearbookText(request.body?.comment).slice(0, 200);
    if (!comment) return response.status(400).json({ error: "Arkadaşınız hakkındaki düşüncenizi yazınız." });

    const incoming = request.body?.surveyAnswers && typeof request.body.surveyAnswers === "object" ? request.body.surveyAnswers : {};
    const surveyAnswers: Record<string, string | string[]> = {};
    for (const question of settings.survey.questions as any[]) {
      const raw = incoming[question.id];
      if (question.answerType === "multiple") {
        const values = Array.isArray(raw) ? raw.map((x: any) => yearbookText(x)).filter(Boolean) : [];
        const allowed = question.options.length ? values.filter((x: string) => question.options.includes(x)) : values;
        const clean = Array.from(new Set(allowed)).slice(0, 20);
        if (question.required && clean.length === 0) return response.status(400).json({ error: `“${question.text}” sorusunu yanıtlayınız.` });
        if (clean.length) surveyAnswers[question.id] = clean;
      } else {
        let value = yearbookText(raw);
        if (["choice", "dropdown"].includes(question.answerType) && question.options.length && value && !question.options.includes(value)) value = "";
        if (question.required && !value) return response.status(400).json({ error: `“${question.text}” sorusunu yanıtlayınız.` });
        if (value) surveyAnswers[question.id] = value.slice(0, question.answerType === "paragraph" ? 1000 : 300);
      }
    }

    const id = yearbookStableEntryId(current.id, target.id);
    const existing: any = listDocuments(YEARBOOK_ENTRIES).find((item: any) => String(item?.id || "") === id);
    const now = new Date().toISOString();
    const payload = {
      id,
      authorStudentId: current.id,
      authorStudentName: current.name,
      authorStudentNumber: current.number,
      targetStudentId: target.id,
      targetStudentName: target.name,
      targetStudentNumber: target.number,
      classroom: current.classroom,
      comment,
      surveyId: settings.survey.id,
      surveyTitle: settings.survey.title,
      surveyAnswers,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    upsertDocument(YEARBOOK_ENTRIES, id, payload);
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ success: true, item: payload });
  });


  const randomBehaviorSecret = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
  const behaviorDocumentId = (prefix: string, ...parts: unknown[]) =>
    `${prefix}-${crypto.createHash("sha256").update(parts.map(part => String(part ?? "")).join("|"), "utf8").digest("hex").slice(0, 32)}`;

  const findBehaviorLinkByToken = (token: string) =>
    listDocuments(BEHAVIOR_LINKS).find((item: any) => String(item.token) === token);

  const requireBehaviorTeacherLink = (token: string) => {
    const row: any = findBehaviorLinkByToken(token);
    if (!row || row.active === false) return { error: "Ã–ÄŸretmen baÄŸlantÄ±sÄ± geÃ§ersiz.", status: 404 as const };
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return { error: "Ã–ÄŸretmen baÄŸlantÄ±sÄ±nÄ±n sÃ¼resi dolmuÅŸ.", status: 410 as const };
    }
    return { row };
  };

  app.post("/api/behavior/teacher-links", (request, response) => {
    const parsed = behaviorPublishSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Ã–ÄŸretmen davranÄ±ÅŸ baÄŸlantÄ±sÄ± verisi geÃ§ersiz." });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsed.data.validDays * 86400000);
    const existing: any = listDocuments(BEHAVIOR_LINKS).find(
      (item: any) => String(item.schoolId) === parsed.data.schoolId && String(item.teacherId) === parsed.data.teacherId
    );
    const token = existing?.token || randomBehaviorSecret(24);
    const id = existing?.id || behaviorDocumentId("btl", parsed.data.schoolId, parsed.data.teacherId);
    const payload = {
      id,
      token,
      ...parsed.data,
      studentIds: parsed.data.students.map(x => x.id),
      behaviorNames: parsed.data.behaviors.map(x => x.name),
      active: true,
      createdAt: existing?.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    upsertDocument(BEHAVIOR_LINKS, id, payload);

    return response.status(201).json({
      token,
      url: `${liveReportPublicBase(request)}/t/${encodeURIComponent(token)}`,
      expiresAt: expiresAt.toISOString(),
    });
  });


  // VELÄ° / Ã–ÄRENCÄ° UYGULAMA LÄ°NKLERÄ° ---------------------------------------
  // Ã–ÄŸretmen linki gibi doÄŸrudan seÃ§ilen payload Ã¼zerinden token Ã¼retir.
  // Ã–ÄŸrenciyi ikinci bir veritabanÄ±nda yeniden aramaz.
  app.post("/api/behavior/teacher-links/public-portal-links", requireAuthSession, (request, response) => {
    try {
      const session: AuthSession = response.locals.auth.session;
      if (session.role === "teacher") {
        return response.status(403).json({ error: "Bu işlem için yönetici yetkisi gereklidir." });
      }
      const kind = String(request.body?.kind || "") === "parent" ? "parent" : "student";
      const targets = Array.isArray(request.body?.targets) ? request.body.targets : [];

      if (!targets.length) {
        return response.status(400).json({ error: "Link oluÅŸturmak iÃ§in Ã¶ÄŸrenci seÃ§ilmedi." });
      }

      const baseUrl = publicPortalBaseUrl(request, request.body?.publicBaseUrl);
      const now = new Date().toISOString();
      const links: any[] = [];

      for (const target of targets) {
        const requestId = String(target?.id || "").trim();
        const studentNumber = String(target?.number || "").trim();
        const currentStudent = portalDirectoryRoster().find((student: any) =>
          (studentNumber && String(student.number || "") === studentNumber) ||
          (requestId && String(student.id || "") === requestId)
        );
        if (!currentStudent) {
          return response.status(409).json({ error: `Öğrenci kaydı güncel listede bulunamadı: ${studentNumber || requestId}` });
        }
        const studentName = String(currentStudent.name || "").trim();
        const classroom = String(currentStudent.classroom || "").trim();
        const phone = String(kind === "parent" ? currentStudent.parentPhone || "" : currentStudent.studentPhone || "").trim();

        if (!requestId && !studentNumber && !studentName) continue;

        const stableStudentId =
          String(currentStudent.id || "").trim() ||
          studentNumber ||
          behaviorDocumentId("portal-student", studentName, classroom);

        const existing: any = listDocuments(PUBLIC_PORTAL_LINKS).find(
          (item: any) =>
            String(item?.studentId || "") === stableStudentId &&
            String(item?.kind || "") === kind &&
            !item?.revokedAt
        );

        let rawToken = "";
        let row: any;

        if (existing?.recoverableToken) {
          rawToken = String(existing.recoverableToken);
          row = {
            ...existing,
            id: existing?.id || behaviorDocumentId("portal-link", kind, stableStudentId),
            kind,
            schoolId: String(session.schoolId || "school-main"),
            studentId: stableStudentId,
            tokenHash: hashPublicPortalToken(rawToken),
            recoverableToken: rawToken,
            studentName,
            studentNumber,
            classroom,
            phone,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            revokedAt: null,
          };
        } else {
          rawToken = randomBehaviorSecret(32);
          row = {
            id: existing?.id || behaviorDocumentId("portal-link", kind, stableStudentId),
            kind,
            schoolId: String(session.schoolId || "school-main"),
            studentId: stableStudentId,
            tokenHash: hashPublicPortalToken(rawToken),
            recoverableToken: rawToken,
            studentName,
            studentNumber,
            classroom,
            phone,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
            revokedAt: null,
          };
        }

        upsertDocument(PUBLIC_PORTAL_LINKS, row.id, row);

        links.push({
          requestId,
          studentId: stableStudentId,
          schoolId: String(session.schoolId || "school-main"),
          studentName,
          studentNumber,
          classroom,
          phone,
          token: rawToken,
          url: `${baseUrl}/${kind === "parent" ? "veli" : "ogrenci"}/${encodeURIComponent(rawToken)}`,
        });
      }

      if (!links.length) {
        return response.status(400).json({
          error: "SeÃ§ilen kiÅŸilerden link oluÅŸturulabilecek geÃ§erli kayÄ±t alÄ±namadÄ±.",
        });
      }

      response.setHeader("Cache-Control", "no-store");
      return response.status(201).json({
        success: true,
        createdCount: links.length,
        links,
      });
    } catch (error: any) {
      console.error("[Public Portal Links]", error);
      return response.status(500).json({
        error: error?.message || "Ã–ÄŸrenci/veli uygulama linki oluÅŸturulamadÄ±.",
      });
    }
  });

  const sendPublicPortalIdentity = (request: express.Request, response: express.Response) => {
    const token = String(request.params.token || "").trim();
    const row: any = findPublicPortalByToken(token);
    if (!row) {
      return response.status(404).json({
        error: "Uygulama baÄŸlantÄ±sÄ± bulunamadÄ± veya iptal edilmiÅŸ.",
      });
    }

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({
      kind: row.kind,
      studentId: row.studentId,
      studentName: row.studentName,
      studentNumber: row.studentNumber,
      classroom: row.classroom,
      schoolId: String(row.schoolId || "school-main"),
      schoolName: String(row.schoolName || "Ordu Lisesi"),
    });
  };

  app.get("/api/public-portal/:token", sendPublicPortalIdentity);
  app.get("/api/behavior/teacher-links/public-portal/:token", sendPublicPortalIdentity);



  // Ã–ÄRENCÄ° UYGULAMASI â€” SINAV SONUÃ‡LARI (KANONÄ°K SINAV VERÄ°SÄ°) ---------
  // Snapshot gerektirmez. SÄ±nav Analiz / SÄ±nav RaporlarÄ± ekranlarÄ±nÄ±n da
  // beslendiÄŸi deÄŸerlendirilmiÅŸ `exams` kayÄ±tlarÄ±ndan sonucu istek anÄ±nda Ã¼retir.

  // PARENT CONSENT - PUBLIC PARENT PORTAL -------------------------------

  const parentConsentPortalMatchesTarget = (portal: any, target: any) => {
    const clean = (value: unknown) => String(value ?? "").trim();

    const normalizeNumber = (value: unknown) => {
      const raw = clean(value);
      if (!raw) return "";
      const digits = raw.replace(/\D/g, "");
      return (digits || raw).replace(/^0+/, "") || "0";
    };

    const normalizeName = (value: unknown) =>
      clean(value)
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ");

    const normalizeClassroom = (value: unknown) =>
      clean(value)
        .toLocaleUpperCase("tr-TR")
        .replace(/[\s\-_/]+/g, "");

    const portalStudentId = clean(portal?.studentId);
    const targetStudentId = clean(target?.id);

    if (
      portalStudentId &&
      targetStudentId &&
      portalStudentId === targetStudentId
    ) {
      return true;
    }

    const portalNumber = normalizeNumber(portal?.studentNumber);
    const targetNumber = normalizeNumber(
      target?.number || target?.studentNumber
    );

    if (
      portalNumber &&
      targetNumber &&
      portalNumber === targetNumber
    ) {
      return true;
    }

    const portalName = normalizeName(portal?.studentName);
    const targetName = normalizeName(
      target?.name || target?.studentName
    );

    const portalClassroom = normalizeClassroom(portal?.classroom);
    const targetClassroom = normalizeClassroom(target?.classroom);

    return Boolean(
      portalName &&
      targetName &&
      portalClassroom &&
      targetClassroom &&
      portalName === targetName &&
      portalClassroom === targetClassroom
    );
  };

  app.get("/api/public-portal/:token/parent-consents", (request, response) => {
    try {
      const token = String(request.params.token || "").trim();
      const portal: any = findPublicPortalByToken(token);

      if (!portal || String(portal.kind || "") !== "parent") {
        return response.status(404).json({
          error: "Veli uygulama baglantisi bulunamadi veya iptal edilmis.",
        });
      }

      const campaigns = listDocuments(PARENT_CONSENT_COLLECTION) as any[];

      const items = campaigns
        .map((campaign: any) => {
          const targets = Array.isArray(campaign?.targets)
            ? campaign.targets
            : Array.isArray(campaign?.rows)
              ? campaign.rows
              : [];

          const target = targets.find((item: any) =>
            parentConsentPortalMatchesTarget(portal, item)
          );

          if (!target) return null;

          return {
            id: String(campaign?.id || ""),
            campaignId: String(campaign?.id || ""),
            studentId: String(target?.id || portal?.studentId || ""),
            studentName: String(
              target?.name ||
              target?.studentName ||
              portal?.studentName ||
              ""
            ),
            studentNumber: String(
              target?.number ||
              target?.studentNumber ||
              portal?.studentNumber ||
              ""
            ),
            classroom: String(
              target?.classroom ||
              portal?.classroom ||
              ""
            ),
            parentPhone: String(target?.parentPhone || ""),
            title: String(campaign?.title || ""),
            description: String(campaign?.description || ""),
            principalName: String(campaign?.principalName || ""),
            eventDate: String(campaign?.eventDate || ""),
            expiresAt: String(campaign?.expiresAt || ""),
            status:
              target?.status === "approved" ||
              target?.status === "rejected"
                ? target.status
                : "pending",
            createdAt: String(campaign?.createdAt || ""),
            respondedAt: target?.respondedAt || null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) =>
          String(b?.createdAt || "").localeCompare(
            String(a?.createdAt || "")
          )
        );

      response.setHeader("Cache-Control", "private, no-store");
      return response.json({ items });
    } catch (error: any) {
      return response.status(500).json({
        error: error?.message || "Veli onay kayitlari yuklenemedi.",
      });
    }
  });

  app.post(
    "/api/public-portal/:token/parent-consents/:id/respond",
    (request, response) => {
      try {
        const token = String(request.params.token || "").trim();
        const campaignId = String(request.params.id || "").trim();

        const portal: any = findPublicPortalByToken(token);

        if (!portal || String(portal.kind || "") !== "parent") {
          return response.status(404).json({
            error: "Veli uygulama baglantisi bulunamadi veya iptal edilmis.",
          });
        }

        const decision = String(request.body?.decision || "").trim();

        if (decision !== "approved" && decision !== "rejected") {
          return response.status(400).json({
            error: "Gecersiz veli onay karari.",
          });
        }

        const campaigns =
          listDocuments(PARENT_CONSENT_COLLECTION) as any[];

        const campaign: any = campaigns.find(
          (item: any) =>
            String(item?.id || "") === campaignId
        );

        if (!campaign) {
          return response.status(404).json({
            error: "Veli onay kaydi bulunamadi.",
          });
        }

        const targets = Array.isArray(campaign?.targets)
          ? [...campaign.targets]
          : Array.isArray(campaign?.rows)
            ? [...campaign.rows]
            : [];

        const targetIndex = targets.findIndex((item: any) =>
          parentConsentPortalMatchesTarget(portal, item)
        );

        if (targetIndex < 0) {
          return response.status(404).json({
            error: "Bu veliye ait onay kaydi bulunamadi.",
          });
        }

        const currentTarget: any = targets[targetIndex];

        if (
          currentTarget?.status === "approved" ||
          currentTarget?.status === "rejected"
        ) {
          return response.status(409).json({
            error: "Bu veli onay karari daha once kaydedilmis.",
          });
        }

        if (campaign?.expiresAt) {
          const expiry = new Date(
            String(campaign.expiresAt) + "T23:59:59"
          ).getTime();

          if (
            Number.isFinite(expiry) &&
            expiry < Date.now()
          ) {
            return response.status(410).json({
              error: "Bu veli onay belgesinin suresi dolmus.",
            });
          }
        }

        const respondedAt = new Date().toISOString();

        targets[targetIndex] = {
          ...currentTarget,
          status: decision,
          respondedAt,
          parentDisplayName: String(
            request.body?.parentDisplayName || "Veli"
          ).trim(),
          responseIp: String(
            request.ip ||
            request.socket?.remoteAddress ||
            ""
          ),
          responseUserAgent: String(
            request.get("user-agent") || ""
          ),
        };

        const updatedCampaign = {
          ...campaign,
          targets,
          updatedAt: respondedAt,
        };

        upsertDocument(
          PARENT_CONSENT_COLLECTION,
          campaignId,
          updatedCampaign
        );

        response.setHeader("Cache-Control", "private, no-store");

        return response.json({
          ok: true,
          campaignId,
          status: decision,
          respondedAt,
        });
      } catch (error: any) {
        return response.status(500).json({
          error: error?.message || "Veli onay karari kaydedilemedi.",
        });
      }
    }
  );


  // DENEME KULÜBÜ — öğrenci mobil sınavları ve elektronik optik -----------------
  const trialClubText = (value: unknown) => String(value ?? "").trim();
  const trialClubNumber = (value: unknown) => {
    const raw = trialClubText(value);
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    return (digits || raw).replace(/^0+/, "") || "0";
  };
  const trialClubGrade = (value: unknown) => {
    const match = trialClubText(value).match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
    return match?.[1] || "";
  };
  const trialClubNormalizedName = (value: unknown) => trialClubText(value).toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
  const isTrialClubExamRecord = (exam: any) => {
    const group = trialClubText(exam?.participantGroup).toLocaleLowerCase("tr-TR");
    if (group === "trial-club") return true;
    const label = trialClubText(exam?.participantLabel || exam?.targetAudience).toLocaleLowerCase("tr-TR");
    return label.includes("deneme kulüb") || label.includes("deneme kulub");
  };
  const isElectronicTrialClubExam = (exam: any) =>
    trialClubText(exam?.answeringMethod).toLocaleLowerCase("tr-TR").includes("elektronik");
  const trialClubExamType = (exam: any) =>
    trialClubText(exam?.examType || exam?.type || exam?.examKind || exam?.templateKind).toLocaleUpperCase("tr-TR");
  const trialClubAreaName = (value: unknown) => {
    const raw = trialClubText(value).replace(/\s+Testi$/iu, "").trim();
    const key = raw.toLocaleLowerCase("tr-TR");
    if (key.includes("sosyal bilim")) return "Sosyal Bilimler";
    if (key.includes("fen bilim")) return "Fen Bilimleri";
    if (key.includes("temel matematik") || key === "matematik") return "Matematik";
    if (key.includes("türkçe") || key.includes("turkce")) return "Türkçe";
    return raw || "Alan";
  };
  const trialClubBookletOptions = (exam: any) => {
    const raw = trialClubText(exam?.bookletType).toLocaleUpperCase("tr-TR");
    if (raw.includes("A-B-C-D")) return ["A", "B", "C", "D"];
    if (raw.includes("A-B")) return ["A", "B"];
    if (["A", "B", "C", "D"].includes(raw)) return [raw];
    return ["A"];
  };
  const trialClubSubjectDefinitions = (exam: any) => {
    const rows: Array<{ name: string; count: number }> = [];
    const seen = new Set<string>();
    const add = (nameValue: unknown, countValue: unknown) => {
      const name = trialClubText(nameValue);
      const count = Math.max(0, Math.floor(Number(countValue) || 0));
      const key = name.toLocaleLowerCase("tr-TR");
      if (!name || count <= 0 || seen.has(key)) return;
      seen.add(key);
      rows.push({ name, count });
    };
    const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
    structure.forEach((test: any) => (Array.isArray(test?.subjects) ? test.subjects : []).forEach((subject: any) => {
      add(subject?.name || subject?.subjectName, subject?.count ?? subject?.questionCount);
    }));
    if (rows.length) return rows;

    const blueprint = Array.isArray(exam?.questionBlueprint) ? exam.questionBlueprint : [];
    const grouped = new Map<string, { name: string; count: number }>();
    blueprint.forEach((item: any) => {
      const name = trialClubText(item?.subject || item?.subjectName || item?.courseName);
      if (!name) return;
      const key = name.toLocaleLowerCase("tr-TR");
      const current = grouped.get(key) || { name, count: 0 };
      current.count += Math.max(0, Math.floor(Number(item?.count || item?.questionCount || 0)));
      grouped.set(key, current);
    });
    grouped.forEach((item) => add(item.name, item.count));
    if (rows.length) return rows;

    const questions = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
    Object.keys(questions).forEach((name) => add(name, Object.keys(questions[name] || {}).length));
    return rows;
  };
  const trialClubAreasForExam = (exam: any, definitions: Array<{ name: string; count: number }>) => {
    if (trialClubExamType(exam) !== "TYT") return [];
    const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
    const fromStructure = structure.map((test: any) => ({
      name: trialClubAreaName(test?.testName || test?.name),
      subjects: (Array.isArray(test?.subjects) ? test.subjects : []).map((subject: any) => ({
        name: trialClubText(subject?.name || subject?.subjectName),
        totalQuestions: Math.max(0, Math.floor(Number(subject?.count ?? subject?.questionCount) || 0)),
      })).filter((subject: any) => subject.name && subject.totalQuestions > 0),
    })).filter((area: any) => area.subjects.length > 0);
    if (fromStructure.length) return fromStructure;

    const grouped = new Map<string, Array<{ name: string; totalQuestions: number }>>();
    const areaForSubject = (nameValue: unknown) => {
      const key = trialClubNormalizedName(nameValue);
      if (key.includes("TÜRKÇE") || key.includes("TURKCE")) return "Türkçe";
      if (key.includes("TARİH") || key.includes("TARIH") || key.includes("COĞRAFYA") || key.includes("COGRAFYA") || key.includes("FELSEFE") || key.includes("DİN KÜLTÜR") || key.includes("DIN KULTUR")) return "Sosyal Bilimler";
      if (key.includes("MATEMATİK") || key.includes("MATEMATIK")) return "Matematik";
      if (key.includes("FİZİK") || key.includes("FIZIK") || key.includes("KİMYA") || key.includes("KIMYA") || key.includes("BİYOLOJİ") || key.includes("BIYOLOJI")) return "Fen Bilimleri";
      return trialClubText(nameValue);
    };
    definitions.forEach((subject) => {
      const areaName = areaForSubject(subject.name);
      const list = grouped.get(areaName) || [];
      list.push({ name: subject.name, totalQuestions: subject.count });
      grouped.set(areaName, list);
    });
    return Array.from(grouped.entries()).map(([name, subjects]) => ({ name, subjects }));
  };

  const trialClubScopesForSubject = (exam: any, subjectName: string) => {
    const blueprint = Array.isArray(exam?.questionBlueprint) ? exam.questionBlueprint : [];
    const target = subjectName.toLocaleLowerCase("tr-TR");
    const grouped = new Map<string, number>();
    blueprint.forEach((item: any) => {
      const itemSubject = trialClubText(item?.subject || item?.subjectName || item?.courseName).toLocaleLowerCase("tr-TR");
      if (itemSubject !== target) return;
      const label = trialClubText(
        item?.outcomeName || item?.outcome || item?.topicName || item?.topic || item?.unitName || item?.unit,
      );
      if (!label) return;
      grouped.set(label, (grouped.get(label) || 0) + Math.max(0, Math.floor(Number(item?.count || item?.questionCount || 0))));
    });
    return Array.from(grouped.entries()).map(([label, count]) => ({ label, count }));
  };
  const trialClubRegistrationForPortal = (portal: any) => {
    const portalId = trialClubText(portal?.studentId);
    const portalNo = trialClubNumber(portal?.studentNumber);
    const portalName = trialClubNormalizedName(portal?.studentName);
    const portalClassroom = trialClubText(portal?.classroom).toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g, "");
    return (listDocuments("trial_club_registrations") as any[]).find((row: any) => {
      if (!row || row?.active === false) return false;
      const rowId = trialClubText(row?.studentId);
      const rowNo = trialClubNumber(row?.studentNumber);
      if (portalId && rowId && portalId === rowId) return true;
      if (portalNo && rowNo && portalNo === rowNo) return true;
      const rowName = trialClubNormalizedName(row?.studentName);
      const rowClassroom = trialClubText(row?.classroom).toLocaleUpperCase("tr-TR").replace(/[\s\-_/]+/g, "");
      return Boolean(portalName && rowName && portalName === rowName && portalClassroom && rowClassroom === portalClassroom);
    }) || null;
  };
  const trialClubRecordMatchesPortal = (record: any, portal: any) => {
    const portalNo = trialClubNumber(portal?.studentNumber);
    const rowNo = trialClubNumber(
      record?.studentNumber || record?.studentNo || record?.schoolNumber || record?.fieldValues?.["Öğrenci No"] || record?.fieldValues?.["Ogrenci No"],
    );
    if (portalNo && rowNo && portalNo === rowNo) return true;
    const portalId = trialClubText(portal?.studentId);
    const rowIds = [record?.studentId, record?.matchedSystemStudentId, record?.systemStudentId].map(trialClubText).filter(Boolean);
    return Boolean(portalId && rowIds.includes(portalId));
  };

  const trialTimedStart = (exam: any) => {
    // Yeni kayıtlarda saat, yerel tarih metninden bağımsız sayısal zaman damgasıdır.
    const savedStart = Number(exam?.examStartsAt || 0);
    if (Number.isFinite(savedStart) && savedStart > 1_500_000_000_000) return savedStart;
    // Sınav Hazırla'daki datetime-local alanı, Türkiye yerel saati olarak saklanır.
    // Eski kayıtlardaki tarih ve saat ayrı tutulmuşsa onları da destekle.
    const rawDate = String(exam?.examDate || exam?.examDateTime || exam?.date || exam?.scheduledAt || "").trim();
    const separateTime = String(exam?.examTime || exam?.startTime || exam?.examStartTime || "").trim();
    if (!rawDate) return 0;
    const normalized = rawDate.replace(" ", "T");
    const hasTime = /T\d{1,2}:\d{2}/.test(normalized);
    const dateTime = hasTime ? normalized : separateTime && /^\d{1,2}:\d{2}/.test(separateTime)
      ? `${normalized.slice(0, 10)}T${separateTime}` : "";
    // Saat tanımlı değilse gece yarısını sınav başlangıcı kabul etme.
    if (!dateTime) return 0;
    const dateWithZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateTime) ? dateTime : `${dateTime}+03:00`;
    const parsed = Date.parse(dateWithZone);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const trialTimedDuration = (exam: any) => Math.max(1, Math.min(600, Number(exam?.electronicDurationMinutes || 120)));
  const trialTimedEnd = (exam: any) => { const start = trialTimedStart(exam); return start ? start + trialTimedDuration(exam) * 60_000 : 0; };

  // BEGIN STUDENT_EXAM_OPENING_REMINDERS_V2
  // Only the student carrying a valid portal token may read these notices.
  app.get("/api/public-portal/:token/exam-opening-reminders", (request, response) => {
    try {
      const portal: any = findPublicPortalByToken(String(request.params.token || ""));
      if (!portal || String(portal.kind || "") !== "student") {
        return response.status(404).json({ error: "Öğrenci bağlantısı bulunamadı." });
      }
      const now = Date.now();
      const latest = now + 48 * 60 * 60 * 1000;
      const inWindow = (stamp: number) => Number.isFinite(stamp) && stamp >= now && stamp <= latest;
      const studentSchool = String(portal.schoolId || "school-main");
      const studentGrade = trialClubGrade(portal.classroom);
      const studentId = trialClubText(portal.studentId);
      const studentNo = trialClubNumber(portal.studentNumber);
      const normal = (v: unknown) => trialClubText(v).toLocaleUpperCase("tr-TR").replace(/\s+/g," ");
      const studentClass = normal(portal.classroom).replace(/[\s\-_/]+/g,"");
      const studentRegistered = Boolean(trialClubRegistrationForPortal(portal));
      const formatMoment = (stamp: number) => new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul", weekday: "long", day: "2-digit", month: "2-digit",
        year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date(stamp));
      const rows: Array<{id:string;title:string;detail:string}> = [];
      for (const exam of (listDocuments("exams") as any[])) {
        if (!exam || exam.active === false || exam.deleted === true) continue;
        if (exam.schoolId && String(exam.schoolId) !== studentSchool) continue;
        const group = trialClubText(exam.participantGroup).toLocaleLowerCase("tr-TR");
        const club = isTrialClubExamRecord(exam);
        if (club && !studentRegistered) continue;
        if (!club && group && group !== "school") continue;
        const examGrade = trialClubGrade(exam.gradeLevel);
        const exactGrade = trialClubText(exam.gradeLevel).toLocaleUpperCase("tr-TR");
        if (studentGrade && examGrade && examGrade !== studentGrade) continue;
        if (!examGrade && exactGrade === "YKS" && studentGrade && !["11","12"].includes(studentGrade)) continue;
        // School exams are assigned to the selected grade; club exams to registered club members.
        const startsAt = trialTimedStart(exam);
        if (!inWindow(startsAt)) continue;
        const electronic = isElectronicTrialClubExam(exam);
        const alreadySubmitted = electronic && Array.isArray(exam.studentTxtRecords) &&
          exam.studentTxtRecords.some((record: any) => trialClubRecordMatchesPortal(record, portal));
        const duration = Number(exam.electronicDurationMinutes || exam.durationMinutes || exam.examDurationMinutes || 0);
        const label = trialClubText(exam.examName || exam.name || exam.title || exam.examType || "Deneme sınavı");
        const detail = "Tarih ve saat: " + formatMoment(startsAt);
        rows.push({ id:"exam:"+String(exam.id || exam.__documentId), title:"Deneme Sınavınız Var", detail });
      }
      // Seat assignments are included only for this student's own matching record.
      const seatingRows = listDocuments("studentAppAnnouncements") as any[];
      for (const row of seatingRows) {
        if (!row || String(row.source) !== "exam-seating") continue;
        if (row.schoolId && String(row.schoolId) !== studentSchool) continue;
        const rowId = trialClubText(row.recipientStudentId);
        const rowNo = trialClubNumber(row.recipientStudentNumber);
        if (!((studentId && rowId === studentId) || (studentNo && rowNo === studentNo))) continue;
        const rawDate = trialClubText(row.examDate || row.date);
        const rawClock = trialClubText(row.examTime || row.startTime);
        const datetime = /T\d{1,2}:\d{2}/.test(rawDate) ? rawDate : rawClock ? rawDate.slice(0,10) + "T" + rawClock : "";
        const time = datetime ? Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(datetime) ? datetime : datetime + "+03:00") : NaN;
        if (!inWindow(time)) continue;
        const course = trialClubText(row.courseName || row.subjectName || row.lessonName || row.examName || row.title || "Ortak sınav");
        const detail = [
          "Tarih ve saat: "+formatMoment(time),
          row.buildingName ? "Bina: "+trialClubText(row.buildingName) : "",
          row.roomName || row.classroomName ? "Salon/Sınıf: "+trialClubText(row.roomName || row.classroomName) : "",
          row.seatNumber != null && String(row.seatNumber) !== "" ? "Sıra No: "+String(row.seatNumber) : "",
          "Modül: Ortak Sınavlar",
        ].filter(Boolean).join(" · ");
        rows.push({ id:"seating:"+String(row.id || ""),title:"Ortak sınav: "+course,detail });
      }
      response.setHeader("Cache-Control","private, no-store");
      return response.json({reminders:rows});
    } catch (error) {
      console.error("[Exam opening reminders]",error);
      return response.status(500).json({error:"Sınav hatırlatmaları yüklenemedi."});
    }
  });
  // END STUDENT_EXAM_OPENING_REMINDERS_V2

  const trialAnswerKey = (exam: any) => {
    const definitions = trialClubSubjectDefinitions(exam);
    const questions = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
    const out: Record<string, string[]> = {};
    for (const subject of definitions) {
      const source = questions?.[subject.name] || [];
      out[subject.name] = Array.from({ length: subject.count }, (_, i) => {
        const q = Array.isArray(source) ? source[i] : source?.[i];
        const letter = String(q?.correctAnswer || q?.answer || "").trim().toUpperCase();
        return /^[A-E]$/.test(letter) ? letter : "";
      });
    }
    return out;
  };
  // Elektronik Deneme Kulübü sınavlarını süre sonunda, yayımlamadan, değerlendir.
  // Manuel değerlendirmeyi ve yayımlama onayını birbirinden bağımsız tutar.
  const trialAutoEvaluationChoice = (value: unknown): string => {
    const v = String(value || "").trim().toLocaleUpperCase("tr-TR");
    return /^[A-E]$/.test(v) ? v : "";
  };
  const trialAutoEvaluationQuestion = (exam: any, subject: string, index: number) => {
    const group = exam?.questions?.[subject];
    return Array.isArray(group) ? group[index] : group?.[index];
  };
  const trialAutoEvaluationCorrect = (question: any): string => {
    const direct = trialAutoEvaluationChoice(question?.correctAnswer || question?.answer);
    if (direct) return direct;
    const name = String(question?.fileName || "").split(/[\\/]/).pop() || "";
    const base = name.replace(/\.[^.]+$/, "");
    return trialAutoEvaluationChoice(base.match(/_([A-E])(?:_\d{2}Y?)?$/i)?.[1]);
  };
  const trialAutoEvaluationOrder = (exam: any, subjectName: string, booklet: string, count: number) => {
    const lockPages = exam?.bookletLayoutLock?.booklets?.[booklet]?.pages;
    const locked: Array<{ printedNumber: number; sourceIndex?: number; answer: string }> = [];
    if (Array.isArray(lockPages)) for (const page of lockPages) {
      if (trialClubNormalizedName(page?.testName) !== trialClubNormalizedName(subjectName)) continue;
      const cols = Array.isArray(page?.columns) ? page.columns : [[], []];
      for (const col of cols) for (const q of Array.isArray(col) ? col : []) {
        const sourceIndex = Number(q?.sourceIndex);
        locked.push({ printedNumber: Number(q?.number), ...(Number.isInteger(sourceIndex) && sourceIndex >= 0 ? { sourceIndex } : {}), answer: trialAutoEvaluationChoice(q?.answer) });
      }
    }
    if (locked.length === count && locked.every(q => Number.isInteger(q.printedNumber) && q.printedNumber > 0)) {
      locked.sort((a, b) => a.printedNumber - b.printedNumber);
      return locked.map((q, i) => ({ index: Number.isInteger(q.sourceIndex) ? q.sourceIndex! : i, answer: q.answer }));
    }
    const items = Array.from({ length: count }, (_, i) => {
      let index = i;
      if (booklet === "B") index = count - 1 - i;
      else if (booklet === "C") index = (i + Math.floor(count / 2)) % count;
      else if (booklet === "D") index = count - 1 - ((i + Math.floor(count / 3)) % count);
      if (exam?.examSource === "Basılı Yayın") for (let x = 0; x < count; x++) {
        if (Number(trialAutoEvaluationQuestion(exam, subjectName, x)?.bookletNumbers?.[booklet]) === i + 1) { index = x; break; }
      }
      return { index, answer: "" };
    });
    return items;
  };
  // Ek katılım yalnız tanımlanan öğrenci için geçerlidir; ana sınav takvimi değişmez.
  const trialLateWindow = (exam: any, studentNumber: unknown) => {
    const key = trialClubNumber(studentNumber);
    const entry = exam?.electronicLateWindows?.[key];
    const startsAt = Number(entry?.startsAt);
    const endsAt = Number(entry?.endsAt);
    return key && Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > startsAt
      ? { startsAt, endsAt } : null;
  };
  const trialEvaluationNeedsUpdate = (exam: any) => {
    const records = (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : []).filter((record: any) => record?.source === "electronic-optic");
    const results = Array.isArray(exam?.evaluationResults) ? exam.evaluationResults : [];
    if (!exam?.isEvaluated || results.length === 0) return records.length > 0;
    return records.some((record: any) => !results.some((result: any) =>
      trialClubNumber(result?.studentNumber) === trialClubNumber(record?.studentNumber) &&
      trialClubText(result?.recordId) === trialClubText(record?.id)));
  };
  const trialAutoEvaluationRun = (exam: any, nowMillis = Date.now()): { status: string; exam: any } => {
    if (!exam || !isTrialClubExamRecord(exam) || !isElectronicTrialClubExam(exam)) return { status: "not-applicable", exam };
    const end = trialTimedEnd(exam);
    if (!end || nowMillis < end) return { status: "not-ended", exam };
    if (!trialEvaluationNeedsUpdate(exam)) return { status: "evaluated", exam };
    // Geç katılımcının ek süresi bitmeden kesin değerlendirme yapma.
    if (Object.values(exam?.electronicLateWindows || {}).some((window: any) => Number(window?.startsAt) <= nowMillis && nowMillis < Number(window?.endsAt))) return { status: "late-session-active", exam };
    const records = (Array.isArray(exam.studentTxtRecords) ? exam.studentTxtRecords : []).filter((r: any) => r?.source === "electronic-optic");
    if (!records.length) return { status: "no-answers", exam };
    const definitions = trialClubSubjectDefinitions(exam);
    if (!definitions.length) return { status: "no-subjects", exam };
    const keys: Record<string, Record<string, string[]>> = {};
    const booklets = Array.from(new Set(records.map((r: any) => trialClubText(r?.bookletType).toUpperCase() || "A")));
    for (const booklet of booklets) {
      keys[booklet] = {};
      for (const subject of definitions) {
        const order = trialAutoEvaluationOrder(exam, subject.name, booklet, subject.count);
        const answerKey = order.map(({ index, answer }) => answer || trialAutoEvaluationCorrect(trialAutoEvaluationQuestion(exam, subject.name, index)));
        if (answerKey.length !== subject.count || answerKey.some(answer => !answer)) {
          return { status: `missing-answer-key: ${subject.name} (${booklet})`, exam };
        }
        keys[booklet][subject.name] = answerKey;
      }
    }
    const results = records.map((record: any) => {
      const booklet = trialClubText(record.bookletType).toUpperCase() || "A";
      const answerText = trialClubText(record.answers).toUpperCase();
      let offset = 0, totalCorrect = 0, totalWrong = 0, totalEmpty = 0;
      const subjects = definitions.map((subject) => {
        const answers = (answerText.slice(offset, offset + subject.count) || "").padEnd(subject.count, "-");
        const key = keys[booklet][subject.name];
        let correct = 0, wrong = 0, empty = 0;
        for (let i = 0; i < subject.count; i++) {
          const value = trialAutoEvaluationChoice(answers[i]);
          if (!value) empty++;
          else if (value === key[i]) correct++;
          else wrong++;
        }
        offset += subject.count;
        totalCorrect += correct; totalWrong += wrong; totalEmpty += empty;
        return { subjectName: subject.name, correct, wrong, empty, net: Number((correct - wrong * 0.25).toFixed(2)), totalQuestions: subject.count };
      });
      return {
        recordId: trialClubText(record.id), studentId: trialClubText(record.studentId),
        studentNumber: trialClubNumber(record.studentNumber), studentName: trialClubText(record.studentName),
        classroom: trialClubText(record.classroom || record.gradeLevel), bookletType: booklet,
        subjects, totals: { correct: totalCorrect, wrong: totalWrong, empty: totalEmpty, net: Number((totalCorrect - totalWrong * 0.25).toFixed(2)) },
      };
    });
    const next = {
      ...exam, evaluationResults: results, isEvaluated: true, examStatus: "Değerlendirildi",
      evaluatedAt: new Date(nowMillis).toISOString(), electronicAutoEvaluationStatus: "completed",
      electronicAutoEvaluatedAt: new Date(nowMillis).toISOString(),
      // Yayınlama yalnızca yöneticinin işlemiyle yapılır.
      electronicResultsPublished: exam?.electronicResultsPublished === true,
    };
    upsertDocument("exams", trialClubText(exam.id || exam.__documentId), next);
    return { status: "completed", exam: next };
  };
  const trialAutoEvaluationPending = () => {
    const now = Date.now();
    for (let exam of listDocuments("exams") as any[]) {
      // Süre dolduğunda ara kayıtları öğrenci tekrar Kaydet'e basmasa bile
      // tamamla. Geç katılımcıların kişisel süreleri korunur.
      if (isTrialClubExamRecord(exam) && isElectronicTrialClubExam(exam)) {
        const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
        let changed = false;
        const finalizedRecords = records.map((record: any) => {
          if (record?.source !== "electronic-optic" || record?.finalizedAt) return record;
          const end = trialLateWindow(exam, record?.studentNumber)?.endsAt || trialTimedEnd(exam);
          if (!end || now < end) return record;
          changed = true;
          return { ...record, finalizedAt: new Date(end).toISOString(), updatedAt: new Date(now).toISOString() };
        });
        if (changed) {
          exam = { ...exam, studentTxtRecords: finalizedRecords, updatedAt: new Date(now).toISOString() };
          upsertDocument("exams", trialClubText(exam.id || exam.__documentId), exam);
        }
      }
      if (!isTrialClubExamRecord(exam) || !isElectronicTrialClubExam(exam) || !trialEvaluationNeedsUpdate(exam)) continue;
      if (!trialTimedEnd(exam) || now < trialTimedEnd(exam)) continue;
      try {
        const result = trialAutoEvaluationRun(exam, now);
        if (result.status.startsWith("missing-answer-key") || result.status === "no-subjects") {
          const previous = trialClubText(exam?.electronicAutoEvaluationStatus);
          if (previous !== result.status) upsertDocument("exams", trialClubText(exam.id || exam.__documentId), { ...exam, electronicAutoEvaluationStatus: result.status });
        }
      } catch (error) { console.error("[Trial Auto Evaluation]", exam?.id, error); }
    }
  };
  // Sunucu çalışırken 15 sn aralıklarla kontrol et; ilk tarama açılışta yapılır.
  setTimeout(trialAutoEvaluationPending, 2500).unref?.();
  setInterval(trialAutoEvaluationPending, 15_000).unref?.();

  app.get("/api/public-portal/:token/trial-club", (request, response) => {
    try {
      const token = String(request.params.token || "").trim();
      const portal: any = findPublicPortalByToken(token);
      if (!portal || String(portal?.kind || "") !== "student") {
        return response.status(404).json({ error: "Öğrenci uygulama bağlantısı bulunamadı veya iptal edilmiş." });
      }
      const registration: any = trialClubRegistrationForPortal(portal);
      const gradeLevel = trialClubGrade(registration?.gradeLevel || registration?.classroom || portal?.classroom);
      if (!registration) {
        response.setHeader("Cache-Control", "private, no-store");
        return response.json({ exams: [], canEditTargets: false, studentName: trialClubText(portal?.studentName), gradeLevel });
      }

      const examRows = (listDocuments("exams") as any[])
        .filter((exam: any) => exam && isTrialClubExamRecord(exam))
        .filter((exam: any) => {
          const examGrade = trialClubGrade(exam?.gradeLevel || exam?.classroom);
          return !gradeLevel || !examGrade || examGrade === gradeLevel;
        })
        .sort((a: any, b: any) => {
          const left = Date.parse(trialClubText(a?.examDate || a?.date || a?.createdAt)) || 0;
          const right = Date.parse(trialClubText(b?.examDate || b?.date || b?.createdAt)) || 0;
          if (left !== right) return left - right;
          return trialClubText(a?.id).localeCompare(trialClubText(b?.id));
        });

      const exams = examRows.map((row: any, index: number) => {
        const exam = trialAutoEvaluationRun(row).exam;
        const definitions = trialClubSubjectDefinitions(exam);
        const electronic = isElectronicTrialClubExam(exam);
        const submitted = electronic && (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [])
          .some((record: any) => trialClubRecordMatchesPortal(record, portal));
        const lateWindow = trialLateWindow(exam, portal?.studentNumber || registration?.studentNumber);
        const studentStartsAt = lateWindow?.startsAt || trialTimedStart(exam);
        const studentEndsAt = lateWindow?.endsAt || trialTimedEnd(exam);
        // Publish only this authenticated student's own evaluated result.
        // Rankings are calculated over all evaluated participants, never over the filtered view.
        const evaluated = Array.isArray(exam?.evaluationResults) ? exam.evaluationResults : [];
        const scoreTotal = (row: any, field: string) => (Array.isArray(row?.subjects) ? row.subjects : [])
          .reduce((sum: number, item: any) => sum + (Number(item?.[field]) || 0), 0);
        const ranked = [...evaluated].sort((left: any, right: any) =>
          scoreTotal(right, "net") - scoreTotal(left, "net") || scoreTotal(right, "correct") - scoreTotal(left, "correct"));
        const subjectRankings = new Map<string, Array<{ result: any; net: number; correct: number }>>();
        evaluated.forEach((result: any) => {
          (Array.isArray(result?.subjects) ? result.subjects : []).forEach((subject: any) => {
            const key = trialClubNormalizedName(subject?.subjectName || subject?.name);
            if (!key) return;
            const rows = subjectRankings.get(key) || [];
            rows.push({ result, net: Number(subject?.net) || 0, correct: Number(subject?.correct) || 0 });
            subjectRankings.set(key, rows);
          });
        });
        subjectRankings.forEach((rows) => rows.sort((a, b) => b.net - a.net || b.correct - a.correct));
        const studentResult = evaluated.find((row: any) => trialClubRecordMatchesPortal(row, portal));
        const resultPublished = Boolean(exam?.electronicResultsPublished && exam?.isEvaluated && studentResult);
        const ownResult = resultPublished ? {
          subjects: (Array.isArray(studentResult.subjects) ? studentResult.subjects : []).map((subject: any) => {
            const name = trialClubText(subject?.subjectName || subject?.name);
            const rows = subjectRankings.get(trialClubNormalizedName(name)) || [];
            const rowIndex = rows.findIndex((item) => item.result === studentResult);
            return {
              name,
              correct: Number(subject?.correct) || 0,
              wrong: Number(subject?.wrong) || 0,
              empty: Number(subject?.empty) || 0,
              net: Number(subject?.net) || 0,
              rank: rowIndex >= 0 ? rowIndex + 1 : undefined,
              participantCount: rows.length,
            };
          }),
          correct: scoreTotal(studentResult, "correct"),
          wrong: scoreTotal(studentResult, "wrong"),
          empty: scoreTotal(studentResult, "empty"),
          net: Number(scoreTotal(studentResult, "net").toFixed(2)),
          score: Number(studentResult?.score ?? studentResult?.totalScore ?? studentResult?.puan ?? 0) || null,
          rank: ranked.findIndex((row: any) => row === studentResult) + 1,
          participantCount: ranked.length,
        } : undefined;
        // Cevap anahtarı öğrenciye yalnız kendi kitapçığının sırasıyla gönderilir.
        const ownSubmission = (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [])
          .find((record: any) => trialClubRecordMatchesPortal(record, portal) && record?.source === "electronic-optic");
        const ownBooklet = trialClubText(ownSubmission?.bookletType).toUpperCase();
        const keyWindowOpen = trialTimedEnd(exam) > 0 && Date.now() >= trialTimedEnd(exam) && Date.now() < trialTimedEnd(exam) + 3_600_000;
        // Yönetici cevapları/sonuçları yayımladıysa cevap anahtarı süre
        // penceresine bağlı kalmadan öğrencinin kendi kitapçığı için görünür.
        const keyVisible = Boolean(electronic && ownSubmission?.finalizedAt && ownBooklet &&
          (exam?.electronicResultsPublished === true || keyWindowOpen));
        const answerKeyForStudent: Record<string, string[]> = {};
        const answerStats: Record<string, Array<{ correct: number; wrong: number; empty: number }>> = {};
        if (keyVisible) {
          const submissions = (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [])
            .filter((record: any) => record?.source === "electronic-optic" && Boolean(record?.finalizedAt));
          let subjectOffset = 0;
          for (const subject of definitions) {
            const order = trialAutoEvaluationOrder(exam, subject.name, ownBooklet, subject.count);
            const answerKey = order.map(({ index, answer }) =>
              answer || trialAutoEvaluationCorrect(trialAutoEvaluationQuestion(exam, subject.name, index)));
            answerKeyForStudent[subject.name] = answerKey;
            const stats = Array.from({ length: subject.count }, () => ({ correct: 0, wrong: 0, empty: 0 }));
            for (const record of submissions) {
              const booklet = trialClubText(record.bookletType).toUpperCase() || "A";
              const recordOrder = trialAutoEvaluationOrder(exam, subject.name, booklet, subject.count);
              const rawAnswers = trialClubText(record.answers).toUpperCase().slice(subjectOffset, subjectOffset + subject.count);
              for (let i = 0; i < subject.count; i++) {
                const sourceIndex = recordOrder[i]?.index;
                if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= subject.count) continue;
                const correct = recordOrder[i]?.answer || trialAutoEvaluationCorrect(trialAutoEvaluationQuestion(exam, subject.name, sourceIndex));
                if (!correct) continue;
                const marked = trialAutoEvaluationChoice(rawAnswers[i]);
                const target = stats.find((_, index) => order[index]?.index === sourceIndex);
                if (!target) continue;
                if (!marked) target.empty++;
                else if (marked === correct) target.correct++;
                else target.wrong++;
              }
            }
            answerStats[subject.name] = stats;
            subjectOffset += subject.count;
          }
        }
        return {
          id: trialClubText(exam?.id || exam?.__documentId),
          examName: trialClubText(exam?.examName || exam?.name || exam?.title || `${index + 1}. Deneme`),
          examType: trialClubExamType(exam),
          gradeLevel: trialClubGrade(exam?.gradeLevel) || gradeLevel,
          examNumber: Math.max(1, Number(exam?.examNumber || index + 1)),
          examDate: trialClubText(exam?.examDate || exam?.date || exam?.createdAt).slice(0, 10),
          startsAt: studentStartsAt,
          endsAt: studentEndsAt,
          durationMinutes: trialTimedDuration(exam),
          answerKey: keyVisible ? answerKeyForStudent : undefined,
          answerKeyBooklet: keyVisible ? ownBooklet : undefined,
          answerStats: keyVisible ? answerStats : undefined,
          subjects: definitions.map((subject) => ({
            name: subject.name,
            totalQuestions: subject.count,
            scopes: trialClubScopesForSubject(exam, subject.name),
          })),
          areas: trialClubAreasForExam(exam, definitions),
          targetNets: {},
          publishedResult: ownResult,
          resultStatus: !electronic ? undefined : ownResult ? "published" : !exam?.electronicResultsPublished ? "not-published" : !exam?.isEvaluated || !evaluated.length ? "not-evaluated" : "student-result-missing",
          electronic,
          bookletOptions: electronic ? trialClubBookletOptions(exam) : [],
          submitted,
          finalized: submitted && (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : []).some((record: any) => trialClubRecordMatchesPortal(record, portal) && Boolean(record?.finalizedAt)),
          savedBooklet: submitted ? trialClubText((exam?.studentTxtRecords || []).find((record: any) => trialClubRecordMatchesPortal(record, portal))?.bookletType) : "",
          savedAnswers: submitted ? ((exam?.studentTxtRecords || []).find((record: any) => trialClubRecordMatchesPortal(record, portal))?.draftAnswers || {}) : {},
        };
      }).filter((exam: any) => exam.id && exam.subjects.length > 0);

      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      return response.json({
        exams,
        serverNow: Date.now(),
        canEditTargets: false,
        studentName: trialClubText(portal?.studentName || registration?.studentName),
        gradeLevel,
      });
    } catch (error: any) {
      console.error("[Trial Club Portal]", error);
      return response.status(500).json({ error: error?.message || "Deneme Kulübü sınavları yüklenemedi." });
    }
  });

  app.post("/api/public-portal/:token/trial-club/exams/:examId/submit", (request, response) => {
    try {
      const token = String(request.params.token || "").trim();
      const examId = String(request.params.examId || "").trim();
      const portal: any = findPublicPortalByToken(token);
      if (!portal || String(portal?.kind || "") !== "student") {
        return response.status(404).json({ error: "Öğrenci uygulama bağlantısı bulunamadı veya iptal edilmiş." });
      }
      const registration: any = trialClubRegistrationForPortal(portal);
      if (!registration) {
        return response.status(403).json({ error: "Bu öğrenci Deneme Kulübü üyesi değil." });
      }

      const exams = listDocuments("exams") as any[];
      const exam: any = exams.find((item: any) => String(item?.id || item?.__documentId || "") === examId);
      if (!exam || !isTrialClubExamRecord(exam) || !isElectronicTrialClubExam(exam)) {
        return response.status(404).json({ error: "Elektronik Deneme Kulübü sınavı bulunamadı." });
      }
      const memberGrade = trialClubGrade(registration?.gradeLevel || registration?.classroom || portal?.classroom);
      const examGrade = trialClubGrade(exam?.gradeLevel || exam?.classroom);
      if (memberGrade && examGrade && memberGrade !== examGrade) {
        return response.status(403).json({ error: "Bu sınav öğrencinin sınıf seviyesine ait değil." });
      }

      const existing = (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [])
        .find((record: any) => trialClubRecordMatchesPortal(record, portal));
      const nowMillis = Date.now();
      const lateWindow = trialLateWindow(exam, portal?.studentNumber || registration?.studentNumber);
      const submissionStart = lateWindow?.startsAt || trialTimedStart(exam);
      const submissionEnd = lateWindow?.endsAt || trialTimedEnd(exam);
      if (!submissionStart || !submissionEnd) return response.status(409).json({ error: "Sınavın başlangıç tarihi ve saati tanımlı değil. Sınav Hazırla bölümünden tarih ve saati kaydediniz." });
      if (nowMillis < submissionStart) return response.status(403).json({ error: "Sınav henüz başlamadı." });
      if (existing && existing.finalizedAt) return response.status(409).json({ error: "Optik form daha önce kapatılmış." });
      const expired = nowMillis >= submissionEnd;
      // Süre dolduktan sonra yeni işaretleme kabul edilmez; daha önce kaydedilmiş
      // cevaplar kesinleştirilir, hiç kayıt yoksa optik boş olarak kapatılır.
      const bookletOptions = trialClubBookletOptions(exam);
      const bookletType = trialClubText(request.body?.bookletType).toLocaleUpperCase("tr-TR");
      if (!bookletOptions.includes(bookletType)) {
        return response.status(400).json({ error: "Geçerli bir kitapçık türü seçiniz." });
      }

      const definitions = trialClubSubjectDefinitions(exam);
      if (!definitions.length) {
        return response.status(400).json({ error: "Sınavın ders ve soru sayıları bulunamadı." });
      }
      const submittedAnswers = expired ? (existing?.draftAnswers || {}) : (request.body?.answers && typeof request.body.answers === "object" ? request.body.answers : {});
      const fieldValues: Record<string, string> = {};
      const answerParts: string[] = [];
      for (const subject of definitions) {
        const raw = Array.isArray(submittedAnswers?.[subject.name]) ? submittedAnswers[subject.name] : [];
        const segment = Array.from({ length: subject.count }, (_, index) => {
          const value = trialClubText(raw[index]).toLocaleUpperCase("tr-TR");
          return ["A", "B", "C", "D", "E"].includes(value) ? value : "-";
        }).join("");
        fieldValues[subject.name] = segment;
        answerParts.push(segment);
      }

      const now = new Date().toISOString();
      const studentNumber = trialClubNumber(portal?.studentNumber || registration?.studentNumber);
      const studentName = trialClubText(portal?.studentName || registration?.studentName || "Öğrenci");
      const classroom = trialClubText(portal?.classroom || registration?.classroom || `${memberGrade}. Sınıf`);
      const record = {
        id: `electronic-${examId}-${studentNumber || trialClubText(portal?.studentId)}`,
        studentId: trialClubText(portal?.studentId || registration?.studentId),
        studentNumber,
        studentName,
        gradeLevel: classroom,
        classroom,
        bookletType,
        answers: answerParts.join(""),
        fieldValues: {
          ...fieldValues,
          "Öğrenci No": studentNumber,
          "Öğrenci Adı Soyadı": studentName,
          "Sınıfı": classroom,
          "Kitapçık Türü": bookletType,
        },
        source: "electronic-optic",
        submittedAt: expired ? (existing?.submittedAt || now) : now,
        finalizedAt: expired ? now : undefined,
        draftAnswers: submittedAnswers,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      const nextExam = {
        ...exam,
        studentTxtRecords: [...(Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : []).filter((item: any) => !trialClubRecordMatchesPortal(item, portal)), record],
        updatedAt: now,
        // Yeni cevap gelince eski sonuçlar geçerli sayılmaz; yönetici yeniden yayımlar.
        isEvaluated: false,
        electronicResultsPublished: false,
        electronicAutoEvaluationStatus: "pending-late-evaluation",
      };
      const documentId = String(exam?.id || exam?.__documentId || examId);
      upsertDocument("exams", documentId, nextExam);

      response.setHeader("Cache-Control", "private, no-store");
      return response.status(201).json({ success: true, finalized: expired, submittedAt: now, serverNow: Date.now() });
    } catch (error: any) {
      console.error("[Trial Club Electronic Submit]", error);
      return response.status(500).json({ error: error?.message || "Elektronik optik cevapları kaydedilemedi." });
    }
  });

  app.get("/api/public-portal/:token/exam-results", (request, response) => {
    try {
      const token = String(request.params.token || "").trim();
      const portal: any = findPublicPortalByToken(token);
      if (!portal || String(portal.kind) !== "student") {
        return response.status(404).json({ error: "Ã–ÄŸrenci uygulama baÄŸlantÄ±sÄ± bulunamadÄ± veya iptal edilmiÅŸ." });
      }

      const clean = (value: unknown) => String(value ?? "").trim();
      const cleanNo = (value: unknown) => {
        const raw = clean(value);
        if (!raw) return "";
        const digits = raw.replace(/\D/g, "");
        return (digits || raw).replace(/^0+/, "") || "0";
      };
      const num = (value: unknown, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const normalizeClass = (value: unknown) => clean(value)
        .toLocaleUpperCase("tr-TR")
        .replace(/[\s\-_/]+/g, "");
      const studentNumber = cleanNo(portal.studentNumber);
      const studentId = clean(portal.studentId);

      const sameStudent = (row: any) => {
        if (!row || typeof row !== "object") return false;
        const rowNumbers = [
          row.studentNumber, row.studentNo, row.schoolNumber, row.number,
          row.matchedSystemStudentNumber, row.fieldValues?.["Ã–ÄŸrenci No"],
          row.fieldValues?.["Ogrenci No"], row.student?.number,
        ].map(cleanNo).filter(Boolean);
        if (studentNumber && rowNumbers.includes(studentNumber)) return true;

        const ids = [row.studentId, row.matchedSystemStudentId, row.systemStudentId, row.student?.id]
          .map(clean).filter(Boolean);
        return Boolean(studentId && ids.includes(studentId));
      };

      const answerOf = (question: any) => clean(
        question?.correctAnswer ?? question?.answer ?? question?.correctOption ??
        question?.correctChoice ?? question?.dogruCevap ?? question?.correct
      ).toLocaleUpperCase("tr-TR");

      const printedQuestionIndex = (
        exam: any,
        bookletKey: string,
        targetNum1Based: number,
        subjectName: string,
        count: number,
      ) => {
        const booklet = clean(bookletKey).toLocaleUpperCase("tr-TR") || "A";
        const subjectQuestions = exam?.questions?.[subjectName] || {};
        for (let originalIdx = 0; originalIdx < count; originalIdx += 1) {
          const saved = subjectQuestions?.[originalIdx]?.bookletNumbers?.[booklet];
          if (saved !== undefined && saved !== null && saved !== "" && Number(saved) === targetNum1Based) {
            return originalIdx;
          }
        }
        const i = targetNum1Based - 1;
        if (booklet === "B") return count - 1 - i;
        if (booklet === "C") return (i + Math.floor(count / 2)) % count;
        if (booklet === "D") return count - 1 - ((i + Math.floor(count / 3)) % count);
        return i;
      };

      const subjectDefinitions = (exam: any) => {
        const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
        const defs: Array<{ name: string; count: number }> = [];
        for (const test of structure) {
          for (const subject of Array.isArray(test?.subjects) ? test.subjects : []) {
            const name = clean(subject?.name || subject?.subjectName);
            const count = Math.max(0, Math.floor(num(subject?.count ?? subject?.questionCount)));
            if (name && count > 0) defs.push({ name, count });
          }
        }
        if (defs.length) return defs;
        const questions = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
        return Object.keys(questions).map((name) => ({
          name,
          count: Object.keys(questions[name] || {}).length,
        })).filter((item) => item.count > 0);
      };

      const evaluateExam = (exam: any) => {
        const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
        const definitions = subjectDefinitions(exam);
        const results: any[] = [];

        for (const record of records) {
          const bookletType = clean(record?.bookletType || record?.booklet || record?.bookletCode || "A").toLocaleUpperCase("tr-TR");
          const rawAnswers = clean(record?.answers).toLocaleUpperCase("tr-TR");
          let offset = 0;
          const subjects: any[] = [];
          let totalCorrect = 0;
          let totalWrong = 0;
          let totalEmpty = 0;

          for (const definition of definitions) {
            const count = definition.count;
            const segmentFromFields = clean(record?.fieldValues?.[definition.name]);
            const segment = (segmentFromFields || rawAnswers.slice(offset, offset + count)).padEnd(count, " ");
            offset += count;
            let correct = 0;
            let wrong = 0;
            let empty = 0;
            const questions: any[] = [];

            for (let printedIndex = 0; printedIndex < count; printedIndex += 1) {
              const originalIndex = printedQuestionIndex(exam, bookletType, printedIndex + 1, definition.name, count);
              const q = exam?.questions?.[definition.name]?.[originalIndex] || {};
              const correctAnswer = answerOf(q);
              const studentAnswer = clean(segment.charAt(printedIndex)).toLocaleUpperCase("tr-TR");
              const isEmpty = !studentAnswer || studentAnswer === "-";
              const isCorrect = Boolean(correctAnswer && !isEmpty && studentAnswer === correctAnswer);
              if (isEmpty) empty += 1;
              else if (isCorrect) correct += 1;
              else wrong += 1;
              questions.push({
                qNum: printedIndex + 1,
                originalIndex,
                studentAns: studentAnswer,
                correctAns: correctAnswer,
                isCorrect,
                isEmpty,
                unit: clean(q?.unit),
                topic: clean(q?.topic),
                outcome: clean(q?.outcome),
              });
            }

            const net = Number((correct - wrong / 4).toFixed(2));
            subjects.push({
              subjectName: definition.name,
              totalQuestions: count,
              questionCount: count,
              correct,
              wrong,
              empty,
              net,
              questions,
            });
            totalCorrect += correct;
            totalWrong += wrong;
            totalEmpty += empty;
          }

          results.push({
            recordId: clean(record?.id) || `${clean(exam?.id)}-${cleanNo(record?.studentNumber)}`,
            studentId: clean(record?.matchedSystemStudentId || record?.studentId),
            studentNumber: cleanNo(record?.studentNumber || record?.studentNo || record?.fieldValues?.["Ã–ÄŸrenci No"]),
            studentName: clean(record?.studentName || record?.name),
            classroom: clean(record?.classroom || record?.gradeLevel || record?.className),
            schoolCode: clean(
              record?.schoolCode ||
              record?.institutionCode ||
              record?.institutionId ||
              record?.schoolId ||
              record?.fieldValues?.["Okul Kodu"] ||
              record?.fieldValues?.["OKUL KODU"] ||
              record?.fieldValues?.["Kurum Kodu"] ||
              record?.schoolName ||
              exam?.institutionCode ||
              exam?.schoolCode ||
              "",
            ),
            bookletType,
            totals: {
              correct: totalCorrect,
              wrong: totalWrong,
              empty: totalEmpty,
              net: Number((totalCorrect - totalWrong / 4).toFixed(2)),
            },
            subjects,
          });
        }
        return results;
      };

      const isEvaluatedExam = (exam: any) => {
        if (!exam || typeof exam !== "object") return false;
        if (exam.isEvaluated === true) return true;
        const status = clean(exam.examStatus || exam.status).toLocaleLowerCase("tr-TR");
        if (status.includes("deÄŸerlendir") || status.includes("degerlendir") || status.includes("analiz") || status.includes("tamam")) return true;
        return Array.isArray(exam.studentTxtRecords) && exam.studentTxtRecords.length > 0 && subjectDefinitions(exam).length > 0;
      };

      // Sınavların tek kanonik kaynağı exams koleksiyonudur.
      const examMap = new Map<string, any>();
      for (const exam of listDocuments("exams") as any[]) {
        const id = clean(exam?.id) || crypto.createHash("sha1").update(JSON.stringify(exam)).digest("hex");
        examMap.set(id, exam);
      }

      const output: any[] = [];
      for (const exam of examMap.values()) {
        // Elektronik Deneme Kulübü sonuçları yönetici açıkça yayımlamadan
        // öğrenci ve veli portalına gönderilmez.
        if (isTrialClubExamRecord(exam) && isElectronicTrialClubExam(exam) && exam.electronicResultsPublished !== true) continue;
        if (!isEvaluatedExam(exam)) continue;
        const allResults = evaluateExam(exam);
        const target = allResults.find(sameStudent);
        if (!target) continue;

        const generalRanked = [...allResults].sort((a, b) => num(b?.totals?.net) - num(a?.totals?.net));
        const targetSchoolCode = clean(target.schoolCode);
        const distinctSchoolCodes = Array.from(
          new Set(allResults.map((row: any) => clean(row.schoolCode)).filter(Boolean)),
        );
        const hasGeneralComparison = Boolean(
          targetSchoolCode &&
          distinctSchoolCodes.length > 1 &&
          distinctSchoolCodes.some((code) => code !== targetSchoolCode),
        );
        const schoolRanked = targetSchoolCode
          ? generalRanked.filter((row: any) => clean(row.schoolCode) === targetSchoolCode)
          : generalRanked;
        const classroomKey = normalizeClass(target.classroom || portal.classroom);
        const classRanked = schoolRanked.filter((row) => normalizeClass(row.classroom) === classroomKey);
        const targetKey = clean(target.recordId) || cleanNo(target.studentNumber);
        const sameKey = (row: any) => (clean(row.recordId) || cleanNo(row.studentNumber)) === targetKey;
        const schoolRank = schoolRanked.findIndex(sameKey) + 1;
        const generalRank = generalRanked.findIndex(sameKey) + 1;
        const classroomRank = classRanked.findIndex(sameKey) + 1;

        const subjects = (target.subjects || []).map((subject: any) => {
          const subjectName = clean(subject.subjectName);
          const subjectOf = (row: any) =>
            (row.subjects || []).find((item: any) => clean(item.subjectName) === subjectName);
          const subjectNet = (row: any) => num(subjectOf(row)?.net);
          const successOf = (row: any) => {
            const value = subjectOf(row);
            const questionCount = num(value?.questionCount ?? value?.totalQuestions);
            if (questionCount <= 0) return null;
            return Math.max(0, Math.min(100, (num(value?.correct) / questionCount) * 100));
          };
          const averageSuccess = (rows: any[]) => {
            const values = rows.map(successOf).filter((value): value is number => value !== null);
            if (!values.length) return 0;
            return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
          };
          const schoolSubjectRanked = [...schoolRanked].sort((a, b) => subjectNet(b) - subjectNet(a));
          const generalSubjectRanked = [...generalRanked].sort((a, b) => subjectNet(b) - subjectNet(a));
          const classSubjectRanked = [...classRanked].sort((a, b) => subjectNet(b) - subjectNet(a));
          const questionCount = num(subject.questionCount ?? subject.totalQuestions);
          const studentSuccess = questionCount > 0
            ? Number(((num(subject.correct) / questionCount) * 100).toFixed(1))
            : 0;

          // Soru bazlÄ± mobil analiz doÄŸrudan SÄ±nav Analiz'in kullandÄ±ÄŸÄ± aynÄ± ham
          // sÄ±nav verisinden Ã¼retilir. Ã–nceden sadece hesaplanmÄ±ÅŸ subject.questions
          // alanÄ±na gÃ¼veniliyordu; bazÄ± eski sÄ±nav kayÄ±tlarÄ±nda bu alan olmadÄ±ÄŸÄ± iÃ§in
          // mobil ekranda "soru bazlÄ± veri bulunamadÄ±" gÃ¶rÃ¼nÃ¼yordu.
          //
          // Ã–nce deÄŸerlendirme sonucu iÃ§indeki soru listesini kullanÄ±yoruz. Eksikse
          // Ã¶ÄŸrenci TXT/optik kaydÄ± + cevap anahtarÄ±ndan yeniden kuruyoruz.
          const targetQuestionsFromAnalysis = Array.isArray(subject?.questions) ? subject.questions : [];
          const rawRecords = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
          const targetRawRecord = rawRecords.find(sameStudent) || null;
          const definitions = subjectDefinitions(exam);
          const definitionIndex = definitions.findIndex((item) => clean(item.name) === subjectName);
          const currentDefinition = definitionIndex >= 0 ? definitions[definitionIndex] : null;

          const subjectOffset = definitions.slice(0, Math.max(0, definitionIndex)).reduce(
            (sum, item) => sum + Math.max(0, Math.floor(num(item.count))),
            0,
          );

          const recordSubjectSegment = (record: any) => {
            if (!record || !currentDefinition) return "";
            const count = Math.max(0, Math.floor(num(currentDefinition.count)));
            const directCandidates = [
              record?.fieldValues?.[subjectName],
              record?.fieldValues?.[currentDefinition.name],
            ];
            const direct = directCandidates.map(clean).find(Boolean) || "";
            if (direct) return direct.toLocaleUpperCase("tr-TR").padEnd(count, " ").slice(0, count);
            const rawAnswers = clean(record?.answers).toLocaleUpperCase("tr-TR");
            return rawAnswers.slice(subjectOffset, subjectOffset + count).padEnd(count, " ");
          };

          const rebuildQuestionsFromExamAnalysisSource = () => {
            if (!targetRawRecord || !currentDefinition) return [] as any[];
            const count = Math.max(0, Math.floor(num(currentDefinition.count)));
            if (!count) return [] as any[];
            const targetBooklet = clean(
              targetRawRecord?.bookletType || targetRawRecord?.booklet || targetRawRecord?.bookletCode || "A",
            ).toLocaleUpperCase("tr-TR");
            const targetSegment = recordSubjectSegment(targetRawRecord);

            return Array.from({ length: count }, (_, printedIndex) => {
              const originalIndex = printedQuestionIndex(
                exam,
                targetBooklet,
                printedIndex + 1,
                subjectName,
                count,
              );
              const q = exam?.questions?.[subjectName]?.[originalIndex] || {};
              const correctAnswer = answerOf(q);
              const studentAnswer = clean(targetSegment.charAt(printedIndex)).toLocaleUpperCase("tr-TR");
              const isEmpty = !studentAnswer || studentAnswer === "-";
              const isCorrect = Boolean(correctAnswer && !isEmpty && studentAnswer === correctAnswer);

              let participants = 0;
              let correctCount = 0;
              for (const record of rawRecords) {
                const booklet = clean(
                  record?.bookletType || record?.booklet || record?.bookletCode || "A",
                ).toLocaleUpperCase("tr-TR");
                const segment = recordSubjectSegment(record);
                if (!segment) continue;
                const recordOriginalIndex = printedQuestionIndex(
                  exam,
                  booklet,
                  printedIndex + 1,
                  subjectName,
                  count,
                );
                const recordQuestion = exam?.questions?.[subjectName]?.[recordOriginalIndex] || {};
                const recordCorrectAnswer = answerOf(recordQuestion);
                const answer = clean(segment.charAt(printedIndex)).toLocaleUpperCase("tr-TR");
                participants += 1;
                if (recordCorrectAnswer && answer && answer !== "-" && answer === recordCorrectAnswer) {
                  correctCount += 1;
                }
              }

              return {
                qNum: printedIndex + 1,
                originalIndex,
                studentAns: studentAnswer,
                correctAns: correctAnswer,
                isCorrect,
                isEmpty,
                unit: clean(q?.unit),
                topic: clean(q?.topic),
                outcome: clean(q?.outcome),
                sourceCorrectRate: participants > 0
                  ? Number(((correctCount / participants) * 100).toFixed(1))
                  : 0,
              };
            });
          };

          const targetQuestions = targetQuestionsFromAnalysis.length
            ? targetQuestionsFromAnalysis
            : rebuildQuestionsFromExamAnalysisSource();

          const questions = targetQuestions.map((question: any, questionIndex: number) => {
            const originalIndex = num(question?.originalIndex, questionIndex);
            const comparable = schoolRanked
              .map((row: any) => subjectOf(row))
              .filter(Boolean)
              .map((rowSubject: any) => {
                const rowQuestions = Array.isArray(rowSubject?.questions) ? rowSubject.questions : [];
                return rowQuestions.find((item: any) => num(item?.originalIndex, -9999) === originalIndex);
              })
              .filter(Boolean);
            const answered = comparable.length;
            const correctCount = comparable.filter((item: any) => item?.isCorrect === true).length;
            const correctRate = Number.isFinite(Number(question?.sourceCorrectRate))
              ? Number(question.sourceCorrectRate)
              : answered > 0
                ? Number(((correctCount / answered) * 100).toFixed(1))
                : 0;
            return {
              questionNumber: num(question?.qNum, questionIndex + 1),
              originalIndex,
              status: question?.isEmpty ? "empty" : question?.isCorrect ? "correct" : "wrong",
              correctRate,
              correctAnswer: clean(question?.correctAns),
              studentAnswer: clean(question?.studentAns),
              unit: clean(question?.unit),
              topic: clean(question?.topic),
              outcome: clean(question?.outcome),
            };
          });

          return {
            subjectName,
            questionCount,
            totalQuestions: num(subject.totalQuestions ?? subject.questionCount),
            correct: num(subject.correct),
            wrong: num(subject.wrong),
            empty: num(subject.empty),
            net: num(subject.net),
            score: num(subject.score ?? subject.points ?? subject.puan, Number((num(subject.net) * 4).toFixed(2))),
            studentSuccess,
            schoolSuccess: averageSuccess(schoolRanked),
            generalSuccess: hasGeneralComparison ? averageSuccess(generalRanked) : null,
            hasGeneralComparison,
            classroomRank: classSubjectRanked.findIndex(sameKey) + 1,
            schoolRank: schoolSubjectRanked.findIndex(sameKey) + 1,
            generalRank: hasGeneralComparison
              ? generalSubjectRanked.findIndex(sameKey) + 1
              : schoolSubjectRanked.findIndex(sameKey) + 1,
            questions,
          };
        });

        output.push({
          id: clean(exam.id) || `exam-${output.length + 1}`,
          examName: clean(exam.examName || exam.name || exam.title) || "SÄ±nav",
          examDate: clean(exam.examDate || exam.date || exam.evaluatedAt || exam.updatedAt || exam.createdAt),
          student: {
            id: studentId,
            name: clean(target.studentName || portal.studentName),
            number: cleanNo(target.studentNumber || studentNumber),
            classroom: clean(target.classroom || portal.classroom),
          },
          overall: {
            correct: num(target.totals?.correct),
            wrong: num(target.totals?.wrong),
            empty: num(target.totals?.empty),
            net: num(target.totals?.net),
            classroomRank: Math.max(0, classroomRank),
            schoolRank: Math.max(0, schoolRank),
            generalRank: Math.max(0, hasGeneralComparison ? generalRank : schoolRank),
          },
          subjects,
        });
      }

      output.sort((a, b) => new Date(b.examDate || 0).getTime() - new Date(a.examDate || 0).getTime());
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
      return response.json({ exams: output });
    } catch (error: any) {
      console.error("[Public Portal Canonical Exam Results]", error);
      return response.status(500).json({ error: error?.message || "SÄ±nav sonuÃ§larÄ± alÄ±namadÄ±." });
    }
  });

  app.get("/api/behavior/teacher-links/public-portal/:token/manifest.webmanifest", (request, response) => {
    const token = String(request.params.token || "").trim();
    const row: any = findPublicPortalByToken(token);
    if (!row) {
      return response.status(404).json({ error: "BaÄŸlantÄ± bulunamadÄ±." });
    }

    const isParent = String(row.kind) === "parent";
    const startUrl = `/${isParent ? "veli" : "ogrenci"}/${encodeURIComponent(token)}`;

    response.type("application/manifest+json");
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({
      id: startUrl,
      name: isParent ? "e-NstitÃ¼ Veli" : "e-NstitÃ¼ Ã–ÄŸrenci",
      short_name: isParent ? "e-NstitÃ¼ Veli" : "e-NstitÃ¼ Ã–ÄŸrenci",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      display_override: ["standalone"],
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      launch_handler: { client_mode: "navigate-existing" },
      icons: [
        { src: "/enstitu-pwa-icon-v2-192.png?v=35", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/enstitu-pwa-icon-v2.png?v=35", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    });
  });

  const ENSTITU_STAFF_PROFILE_VERSION = "2026-08-25-v16";

  const resolveEnstituStaffProfile = (row: any) => {
    const normalizeId = (value: unknown) => String(value || "").trim();
    const normalizeName = (value: unknown) => normalizeTeacherValue(value);
    const teacherId = normalizeId(row?.teacherId || row?.id);
    const name = normalizeName(row?.teacherName || row?.fullName || row?.name);

    // Tek link sistemi: link kaydÄ±nÄ± okulun gerÃ§ek kullanÄ±cÄ±/personel diziniyle birleÅŸtirir.
    // BÃ¶ylece kiÅŸiye Ã¶zel isim kodlamak yerine gÃ¶rev/rol deÄŸiÅŸikliÄŸi otomatik yansÄ±r.
    let directoryUser: any = null;
    try {
      const state = loadAuthDirectory();
      directoryUser = (state?.users || []).find((user: any) => {
        const ids = [user?.id, user?.teacherId, user?.personnelId, user?.staffId].map(normalizeId).filter(Boolean);
        const names = [user?.fullName, user?.name, user?.teacherName].map(normalizeName).filter(Boolean);
        return (teacherId && ids.includes(teacherId)) || (name && names.includes(name));
      }) || null;
    } catch {
      directoryUser = null;
    }

    const teacherRecord = [...listDocuments("teachers"), ...listDocuments("school_teachers")].find((teacher: any) => {
      const ids = [teacher?.id, teacher?.teacherId, teacher?.personnelId, teacher?.staffId].map(normalizeId).filter(Boolean);
      const names = [teacher?.name, teacher?.fullName, teacher?.teacherName].map(normalizeName).filter(Boolean);
      return (teacherId && ids.includes(teacherId)) || (name && names.includes(name));
    }) || null;

    const merged = { ...(teacherRecord || {}), ...(directoryUser || {}), ...(row || {}) };
    const teacherPhotoUrl = String(merged?.teacherPhotoUrl || merged?.photoUrl || merged?.photo || merged?.avatar || "").trim();
    const roleProbe = normalizeTeacherValue([
      row?.role, row?.staffRole, row?.adminRole, row?.position, row?.title, row?.duty, row?.jobTitle,
      directoryUser?.role, directoryUser?.staffRole, directoryUser?.adminRole, directoryUser?.position, directoryUser?.title, directoryUser?.duty, directoryUser?.jobTitle,
      teacherRecord?.role, teacherRecord?.staffRole, teacherRecord?.adminRole, teacherRecord?.position, teacherRecord?.title, teacherRecord?.duty, teacherRecord?.jobTitle,
      ...(Array.isArray(directoryUser?.duties) ? directoryUser.duties : []),
      ...(Array.isArray(teacherRecord?.duties) ? teacherRecord.duties : []),
    ].filter(Boolean).join(" "));

    const adminPattern = /SUPER_ADMIN|PRINCIPAL|VICE[ _-]?PRINCIPAL|DEPUTY[ _-]?PRINCIPAL|ASSISTANT[ _-]?PRINCIPAL|SCHOOL[ _-]?ADMIN|ADMINISTRATOR|ADMIN|YÖNETİCİ|YONETICI|OKUL YÖNETİCİSİ|OKUL YONETICISI|MÜDÜR|MUDUR|MÜDÜR YARDIMCISI|MUDUR YARDIMCISI/;
    const guidancePattern = /GUIDANCE|COUNSEL|COUNSELLOR|COUNSELOR|PDR|REHBER|PSİKOLOJİK|PSIKOLOJIK/;

    const duties = Array.isArray(merged?.duties) ? merged.duties : [];
    const permissions = merged?.permissions || {};

    if (adminPattern.test(roleProbe)) {
      const isVice = /VICE|DEPUTY|ASSISTANT|YARDIMCI/.test(roleProbe);
      const isPrincipal = /PRINCIPAL|MÃœDÃœR|MUDUR/.test(roleProbe) && !isVice;
      return {
        role: "ADMIN",
        staffRole: "ADMIN",
        position: String(merged?.position || merged?.title || (isVice ? "Müdür Yardımcısı" : isPrincipal ? "Okul Müdürü" : "Okul Yöneticisi")),
        duties: duties.length ? duties : ["SCHOOL_ADMINISTRATION"],
        permissions: { administration: true, programs: true, duty: true, ...permissions },
        teacherPhotoUrl,
      };
    }

    if (guidancePattern.test(roleProbe)) {
      return {
        role: "GUIDANCE",
        staffRole: "GUIDANCE",
        position: String(merged?.position || merged?.title || "Rehber Ã–ÄŸretmen / PDR"),
        duties: duties.length ? duties : ["GUIDANCE_COUNSELING"],
        permissions: { guidance: true, ...permissions },
        teacherPhotoUrl,
      };
    }

    return {
      role: "TEACHER",
      staffRole: "TEACHER",
      position: String(merged?.position || merged?.title || merged?.branch || "Öğretmen"),
      duties,
      permissions,
      teacherPhotoUrl,
    };
  };

  const behaviorAdminRoster = () => yearbookStudents().map((student: any) => ({
    id: String(student?.id || "").trim(),
    name: String(student?.name || "").trim(),
    number: String(student?.number || "").trim(),
    classroom: String(student?.classroom || "").trim(),
  })).filter((student: any) => student.id && student.name);

  const requireBehaviorAdminLink = (token: string) => {
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return access;
    if (resolveEnstituStaffProfile(access.row).role !== "ADMIN") {
      return { error: "YÃ¶netici yetkisi gerekli.", status: 403 as const };
    }
    return access;
  };

  app.get("/api/behavior/teacher-links/:token/admin/behavior-dashboard", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorAdminLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const schoolId = String(access.row?.schoolId || "").trim();
    const submissions = listDocuments(BEHAVIOR_SUBMISSIONS)
      .filter((record: any) => String(record?.schoolId || "").trim() === schoolId)
      .sort((a: any, b: any) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    const studentsByKey = new Map<string, { id: string; name: string; number: string; classroom: string }>();
    const addStudent = (student: any) => {
      const id = String(student?.id || student?.studentId || "").trim();
      const number = String(student?.number || student?.studentNumber || "").trim();
      const name = String(student?.name || student?.studentName || "").trim();
      const classroom = String(student?.classroom || student?.studentClassroom || "").trim();
      const key = id || number || `${name}|${classroom}`;
      if (!key) return;
      const current = studentsByKey.get(key);
      studentsByKey.set(key, {
        id: id || current?.id || key,
        name: name || current?.name || "İsimsiz Öğrenci",
        number: number || current?.number || "",
        classroom: classroom || current?.classroom || "",
      });
    };

    behaviorAdminRoster().forEach(addStudent);
    (Array.isArray(access.row?.students) ? access.row.students : []).forEach(addStudent);
    submissions.forEach(addStudent);

    const records = submissions.map((record: any) => ({
      id: String(record?.id || ""),
      studentId: String(record?.studentId || "").trim(),
      studentName: String(record?.studentName || "").trim(),
      studentNumber: String(record?.studentNumber || "").trim(),
      classroom: String(record?.classroom || record?.studentClassroom || "").trim(),
      behaviorType: String(record?.behaviorType || "").trim(),
      behaviorName: String(record?.behaviorName || record?.behavior || "Davranış Kaydı").trim(),
      description: String(record?.description || "").trim(),
      teacherName: String(record?.teacherName || "").trim(),
      date: String(record?.date || "").trim(),
      createdAt: record?.createdAt,
    }));

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ students: [...studentsByKey.values()], records });
  });

  app.get("/api/behavior/teacher-links/:token/admin/behavior-action-reminders", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorAdminLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const schoolId = String(access.row?.schoolId || "").trim();
    const items = listDocuments(BEHAVIOR_SUBMISSIONS)
      .filter((record: any) => String(record?.schoolId || "").trim() === schoolId)
      .filter((record: any) => record?.sentTo === "Uyarı Bildirimi" || record?.sentTo === "Ön İnceleme")
      .map((record: any) => ({
        id: String(record?.id || ""),
        studentId: String(record?.studentId || "").trim(),
        studentName: String(record?.studentName || "").trim(),
        classroom: String(record?.classroom || record?.studentClassroom || "").trim(),
        behaviorName: String(record?.behaviorName || record?.behavior || "Davranış Kaydı").trim(),
        destination: String(record?.sentTo),
        routedAt: String(record?.updatedAt || record?.submittedAt || record?.createdAt || ""),
      }));
    const warningCount = items.filter((item: any) => item.destination === "Uyarı Bildirimi").length;
    const preInspectionCount = items.filter((item: any) => item.destination === "Ön İnceleme").length;

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ count: items.length, warningCount, preInspectionCount, items });
  });

  app.get("/api/behavior/teacher-links/:token", (request, response) => {
    const token = String(request.params.token || "");
    if (!token || token.length > 240) return response.status(404).json({ error: "BaÄŸlantÄ± bulunamadÄ±." });
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const profile = resolveEnstituStaffProfile(access.row);
    const students = profile.role === "ADMIN"
      ? behaviorAdminRoster()
      : (Array.isArray(access.row?.students) ? access.row.students : []);

    // Yönetici ve öğretmen telefonunda davranış adları aynı kaynaktan gelsin.
    // Öğretmen linki daha önce oluşturulmuş olsa bile eski davranış adlarını taşımak
    // yerine bilgisayar uygulamasındaki güncel Davranış Tanımları kullanılır.
    const currentBehaviorDefinitions = listDocuments("customBehaviors")
      .map((item: any) => ({
        id: String(item?.id || item?.__documentId || "").trim(),
        type: String(item?.type || "").trim(),
        name: String(item?.name || "").trim(),
      }))
      .filter((item: any) =>
        item.id &&
        item.name &&
        (item.type === "Olumlu" || item.type === "Olumsuz")
      );
    const behaviors = currentBehaviorDefinitions.length
      ? currentBehaviorDefinitions
      : (Array.isArray(access.row?.behaviors) ? access.row.behaviors : []);

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({
      ...access.row,
      ...profile,
      students,
      studentIds: students.map((student: any) => String(student?.id || "")).filter(Boolean),
      behaviors,
      behaviorNames: behaviors.map((item: any) => String(item?.name || "").trim()).filter(Boolean),
      // Davranış kaydı sınıf/öğrenci seçimi için okulun güncel öğrenci-sınıf eşleşmesi.
      // Diğer öğretmen modüllerinin mevcut öğrenci kapsamını değiştirmez.
      behaviorRoster: behaviorAdminRoster(),
      staffProfileVersion: ENSTITU_STAFF_PROFILE_VERSION,
    });
  });

  app.get("/api/behavior/teacher-links/:token/behavior-history", (request, response) => {
    const token = String(request.params.token || "");
    const studentId = String(request.query.studentId || "").trim();
    if (!studentId) return response.status(400).json({ error: "Öğrenci seçilmedi." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const profile = resolveEnstituStaffProfile(access.row);
    const allowedStudentIds = new Set(
      (Array.isArray(access.row?.students) ? access.row.students : [])
        .map((student: any) => String(student?.id || student?.studentId || "").trim())
        .filter(Boolean),
    );
    if (profile.role !== "ADMIN" && !allowedStudentIds.has(studentId)) {
      return response.status(403).json({ error: "Bu öğrenci için davranış kayıtlarını görme yetkiniz yok." });
    }

    const schoolId = String(access.row?.schoolId || "").trim();
    const items = listDocuments(BEHAVIOR_SUBMISSIONS)
      .filter((record: any) => String(record?.schoolId || "").trim() === schoolId)
      .filter((record: any) => String(record?.studentId || "").trim() === studentId)
      .sort((a: any, b: any) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))
      .map((record: any) => ({
        id: String(record?.id || ""),
        studentId: String(record?.studentId || "").trim(),
        studentName: String(record?.studentName || "").trim(),
        studentNumber: String(record?.studentNumber || "").trim(),
        studentClassroom: String(record?.studentClassroom || record?.classroom || "").trim(),
        behaviorType: String(record?.behaviorType || "").trim(),
        behaviorName: String(record?.behaviorName || record?.behavior || "Davranış Kaydı").trim(),
        date: String(record?.date || "").trim(),
        description: String(record?.description || "").trim(),
        teacherName: String(record?.teacherName || "").trim(),
        createdAt: record?.createdAt,
        submittedAt: record?.submittedAt,
        source: String(record?.source || "").trim(),
      }));

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ items });
  });



  const TEACHER_ATTENDANCE_SUBMISSIONS = "attendance_mobile_submissions";
  const DEFAULT_TEACHER_LESSON_TIMES = [
    { hour: 1, start: "08:30", end: "09:10" },
    { hour: 2, start: "09:20", end: "10:00" },
    { hour: 3, start: "10:10", end: "10:50" },
    { hour: 4, start: "11:00", end: "11:40" },
    { hour: 5, start: "11:50", end: "12:30" },
    { hour: 6, start: "13:30", end: "14:10" },
    { hour: 7, start: "14:20", end: "15:00" },
    { hour: 8, start: "15:10", end: "15:50" },
  ];

  const normalizeTeacherSchoolId = (value: unknown) =>
    String(value || "school-main").trim().replace(/[^a-zA-Z0-9._-]+/g, "_") || "school-main";

  const teacherScopedCollections = (schoolId: unknown, collection: string) => {
    const normalizedSchoolId = normalizeTeacherSchoolId(schoolId);
    return normalizedSchoolId === "school-main"
      ? [collection]
      : [`school__${normalizedSchoolId}__${collection}`, collection];
  };

  const teacherStateValue = (key: string, schoolId: unknown = "school-main") => {
    for (const collection of teacherScopedCollections(schoolId, "app_state")) {
      const row: any = getDocument(collection, key);
      if (row && row.value !== undefined && row.value !== null) return row.value;
    }
    return null;
  };

  const teacherScopedRows = (schoolId: unknown, ...collections: string[]) => {
    const rows: any[] = [];
    const seen = new Set<string>();
    for (const collectionName of collections) {
      for (const collection of teacherScopedCollections(schoolId, collectionName)) {
        for (const item of listDocuments(collection) as any[]) {
          const id = String(item?.id || item?.teacherId || item?.studentId || item?.name || "").trim();
          const signature = id || JSON.stringify(item);
          if (seen.has(signature)) continue;
          seen.add(signature);
          rows.push(item);
        }
      }
    }
    return rows;
  };

  const normalizeTeacherValue = (value: unknown) =>
    String(value || "").trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");

  // Soru seçimi görevlendirmesinde farklı veri kaynaklarında aynı öğretmenin
  // adı büyük/küçük harf, Türkçe karakter veya noktalama farkıyla tutulabiliyor.
  // Program/ders günü gibi diğer öğretmen eşleştirmelerini etkilememek için
  // bu daha güçlü normalizasyon yalnız mobil soru görevi kimliğinde kullanılır.
  const normalizeTeacherAssignmentIdentity = (value: unknown) =>
    String(value || "")
      .trim()
      .toLocaleUpperCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Ç/g, "C")
      .replace(/Ğ/g, "G")
      .replace(/İ/g, "I")
      .replace(/Ö/g, "O")
      .replace(/Ş/g, "S")
      .replace(/Ü/g, "U")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Program verisi eski kayitlarda Turkce gun adlarini UTF-8/Latin-1
  // karisimi ile saklamis olabilir (ornegin "SalÄ±"). Mobil program
  // okurken hem kanonik hem de eski bozuk anahtari kabul et.
  const teacherScheduleDayVariants = (day: string) => {
    const canonical = String(day || "").trim();
    const mojibake = Buffer.from(canonical, "utf8").toString("latin1");
    return [...new Set([canonical, mojibake].filter(Boolean))];
  };

  const teacherScheduleCell = (
    schedule: Record<string, any>,
    prefix: string,
    day: string,
    hour: number,
  ) => {
    for (const candidateDay of teacherScheduleDayVariants(day)) {
      const value = schedule[`${prefix}${candidateDay}_${hour}`];
      if (value) return value;
    }
    return undefined;
  };

  const teacherNow = () => {
    const instant = new Date();
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(instant);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(instant);
    const rawDay = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul", weekday: "long",
    }).format(instant);
    const day = rawDay.charAt(0).toLocaleUpperCase("tr-TR") + rawDay.slice(1).toLocaleLowerCase("tr-TR");
    return { date, time, day };
  };

  const toMinute = (time: string) => {
    const [hour, minute] = String(time || "").split(":").map(Number);
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1;
  };

  const currentLessonTimes = (schoolId: unknown = "school-main") => {
    const saved = teacherStateValue("school_timetable", schoolId);
    let rows: any[] = [];
    if (Array.isArray(saved)) rows = saved;
    else if (typeof saved === "string" && saved.trim()) {
      try { const parsed = JSON.parse(saved); rows = Array.isArray(parsed) ? parsed : []; } catch {}
    }
    return DEFAULT_TEACHER_LESSON_TIMES.map((fallback) => {
      const found: any = rows.find((item: any) => Number(item?.hour) === fallback.hour);
      return {
        hour: fallback.hour,
        start: /^\d{2}:\d{2}$/.test(String(found?.start || "")) ? String(found.start) : fallback.start,
        end: /^\d{2}:\d{2}$/.test(String(found?.end || "")) ? String(found.end) : fallback.end,
      };
    });
  };

  const currentScheduleData = (schoolId: unknown = "school-main") => {
    const data = teacherStateValue("scheduleData", schoolId);
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, any>;
    if (typeof data === "string" && data.trim()) {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, any>;
      } catch {}
    }
    return {};
  };

  type TeacherScheduleStateCandidate = {
    schoolId: string;
    collectionName: string;
    schedule: Record<string, any>;
    updatedAt: string;
  };

  const teacherScheduleSchoolIdFromCollection = (collectionName: string) => {
    if (collectionName === "app_state") return "school-main";
    const match = String(collectionName || "").match(/^school__(.+)__app_state$/);
    return match?.[1] || "school-main";
  };

  const teacherScheduleStateCandidates = (): TeacherScheduleStateCandidate[] => {
    try {
      return listDocumentLocations("scheduleData").flatMap((row) => {
        if (row.collectionName !== "app_state" && !/^school__.+__app_state$/.test(row.collectionName)) return [];
        try {
          const document = row.data;
          let value = document?.value;
          if (typeof value === "string" && value.trim()) value = JSON.parse(value);
          if (!value || typeof value !== "object" || Array.isArray(value)) return [];
          return [{
            schoolId: teacherScheduleSchoolIdFromCollection(row.collectionName),
            collectionName: row.collectionName,
            schedule: value as Record<string, any>,
            updatedAt: String(row.updatedAt || ""),
          }];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  };

  const teacherScheduleNameVariants = (value: unknown) => {
    const raw = String(value || "").trim();
    if (!raw) return new Set<string>();
    const values = new Set<string>([raw]);
    try {
      const repaired = Buffer.from(raw, "latin1").toString("utf8");
      if (repaired && repaired !== raw && !repaired.includes("�")) values.add(repaired);
    } catch {}
    return new Set([...values].map(normalizeTeacherAssignmentIdentity).filter(Boolean));
  };

  const teacherScheduleIdentity = (row: any, schoolId: unknown) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    const addId = (value: unknown) => {
      const clean = String(value || "").trim();
      if (clean) ids.add(clean);
    };
    const addName = (value: unknown) => {
      teacherScheduleNameVariants(value).forEach((clean) => names.add(clean));
    };

    [row?.teacherId, row?.id, row?.userId, row?.personnelId, row?.staffId].forEach(addId);
    [row?.teacherName, row?.name, row?.fullName].forEach(addName);

    const scopedTeachers = teacherScopedRows(schoolId, "teachers", "school_teachers");
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const teacher of scopedTeachers) {
        const candidateIds = [teacher?.id, teacher?.teacherId, teacher?.userId, teacher?.personnelId, teacher?.staffId]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        const candidateNames = [teacher?.name, teacher?.fullName, teacher?.teacherName]
          .flatMap((value) => [...teacherScheduleNameVariants(value)]);
        const matches = candidateIds.some((id) => ids.has(id)) || candidateNames.some((name) => names.has(name));
        if (!matches) continue;
        for (const id of candidateIds) {
          if (!ids.has(id)) { ids.add(id); expanded = true; }
        }
        for (const name of candidateNames) {
          if (!names.has(name)) { names.add(name); expanded = true; }
        }
      }
    }

    return { ids, names };
  };

  const teacherScheduleMatchScore = (schedule: Record<string, any>, row: any, schoolId: unknown) => {
    const identity = teacherScheduleIdentity(row, schoolId);
    if (!identity.ids.size && !identity.names.size) return 0;
    let score = 0;

    const rowMatches = (item: any) => {
      if (!item || typeof item !== "object") return false;
      const itemIds = [item?.teacherId, item?.teacherId2, item?.originalTeacherId, item?.originalTeacherId2]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (itemIds.some((id) => identity.ids.has(id))) return true;
      const itemNames = [item?.teacherName, item?.teacherName2, item?.originalTeacherName, item?.originalTeacherName2]
        .flatMap((value) => [...teacherScheduleNameVariants(value)]);
      return itemNames.some((name) => identity.names.has(name));
    };

    for (const [key, raw] of Object.entries(schedule || {})) {
      if (!raw || (!key.startsWith("teacher_") && !key.startsWith("class_"))) continue;
      if (key.startsWith("teacher_") && [...identity.ids].some((id) => key.startsWith(`teacher_${id}_`))) score += 20;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.some(rowMatches)) score += key.startsWith("teacher_") ? 12 : 8;
    }
    return score;
  };

  const allAttendanceStudents = (schoolId: unknown = "school-main") =>
    teacherScopedRows(schoolId, "students", "school_students");

  const allAttendanceClassrooms = (schoolId: unknown = "school-main") =>
    teacherScopedRows(schoolId, "classrooms", "school_classrooms");

  type TeacherScheduleContext = {
    schedule: Record<string, any>;
    lessonTimes: Array<{ hour: number; start: string; end: string }>;
    classroomsById: Map<string, any>;
    classroomsByName: Map<string, any>;
  };

  const teacherScheduleContextFor = (schoolId: unknown, schedule?: Record<string, any>): TeacherScheduleContext => {
    const classrooms = allAttendanceClassrooms(schoolId);
    return {
      schedule: schedule || currentScheduleData(schoolId),
      lessonTimes: currentLessonTimes(schoolId),
      classroomsById: new Map(classrooms.map((item: any) => [String(item?.id || "").trim(), item])),
      classroomsByName: new Map(classrooms.map((item: any) => [normalizeTeacherValue(item?.name || item?.className), item])),
    };
  };

  const createTeacherScheduleContext = (row?: any): TeacherScheduleContext =>
    teacherScheduleContextFor(row?.schoolId || "school-main");

  // Öğretmen mobil bağlantıları geçmiş sürümlerde yanlış okul kimliğiyle
  // üretilebildi. Program ise doğru tenant app_state koleksiyonunda kalıyordu.
  // Bu nedenle mobil program için yalnız linkteki schoolId'ye güvenmeyip,
  // MySQL'deki bütün scheduleData kayıtlarını öğretmen kimliği/adı üzerinden
  // karşılaştırır ve gerçek programın bulunduğu tenant'ı seçeriz.
  const resolveTeacherScheduleContext = (row: any): TeacherScheduleContext => {
    const requestedSchoolId = normalizeTeacherSchoolId(row?.schoolId || "school-main");
    const direct = teacherScheduleContextFor(requestedSchoolId);
    let bestContext = direct;
    let bestScore = teacherScheduleMatchScore(direct.schedule, row, requestedSchoolId);
    let bestDirect = true;
    let bestUpdatedAt = "";

    for (const candidate of teacherScheduleStateCandidates()) {
      const candidateContext = teacherScheduleContextFor(candidate.schoolId, candidate.schedule);
      const matchScore = teacherScheduleMatchScore(candidate.schedule, row, candidate.schoolId);
      const isDirect = normalizeTeacherSchoolId(candidate.schoolId) === requestedSchoolId;
      const shouldReplace =
        matchScore > bestScore
        || (matchScore === bestScore && matchScore > 0 && isDirect && !bestDirect)
        || (matchScore === bestScore && matchScore > 0 && isDirect === bestDirect && candidate.updatedAt > bestUpdatedAt);
      if (!shouldReplace) continue;
      bestContext = candidateContext;
      bestScore = matchScore;
      bestDirect = isDirect;
      bestUpdatedAt = candidate.updatedAt;
    }

    return bestContext;
  };

  const teacherClassStudents = (classroomId: string, classroomName: string, schoolId: unknown = "school-main") => {
    const id = String(classroomId || "").trim();
    const name = normalizeTeacherValue(classroomName);
    return allAttendanceStudents(schoolId).filter((student: any) => {
      if (student?.status === "Pasif") return false;
      const studentClassId = String(student.classroomId || student.classId || "").trim();
      const studentClassName = normalizeTeacherValue(student.classroom || student.className || student.branch);
      // If we have a class name, require exact class-name equality. This prevents the whole-school fallback.
      if (name) return studentClassName === name;
      return Boolean(id && studentClassId === id);
    });
  };

  const teacherAssignmentAt = (row: any, day: string, hour: number, context: TeacherScheduleContext) => {
    const schedule = context.schedule;
    const teacherId = String(row?.teacherId || row?.id || "").trim();
    const teacherName = normalizeTeacherValue(row?.teacherName || row?.name);
    const suffixes = teacherScheduleDayVariants(day).map((candidateDay) => `_${candidateDay}_${hour}`);

    const assignmentMatchesTeacher = (item: any) => {
      if (!item) return false;
      const ids = [item?.teacherId, item?.teacherId2, item?.originalTeacherId, item?.originalTeacherId2]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (teacherId && ids.includes(teacherId)) return true;
      const names = [item?.teacherName, item?.teacherName2, item?.originalTeacherName, item?.originalTeacherName2]
        .map(normalizeTeacherValue)
        .filter(Boolean);
      return Boolean(teacherName && names.includes(teacherName));
    };

    if (teacherId) {
      const teacherCell = teacherScheduleCell(schedule, `teacher_${teacherId}_`, day, hour);
      const teacherRows = teacherCell ? (Array.isArray(teacherCell) ? teacherCell : [teacherCell]) : [];
      const teacherMatch: any = teacherRows.find(assignmentMatchesTeacher) || teacherRows[0];
      if (teacherMatch) {
        const classroomName = String(teacherMatch.className || teacherMatch.classroomName || "").trim();
        const classroom: any = context.classroomsByName.get(normalizeTeacherValue(classroomName));
        return {
          classroomId: String(classroom?.id || teacherMatch.classroomId || classroomName).trim(),
          classroomName: classroomName || String(classroom?.name || classroom?.className || "").trim(),
          courseName: String(teacherMatch.courseName || teacherMatch.course || teacherMatch.name || "").trim(),
        };
      }
    }

    // Bazı eski/manüel programlarda teacher_* hücresi yoktur veya öğretmen kimliği
    // sonradan değişmiştir. Aynı gün/saatteki tüm teacher_* hücrelerinde payload'ı da dene.
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("teacher_") || !suffixes.some((suffix) => key.endsWith(suffix)) || !raw) continue;
      const rows = Array.isArray(raw) ? raw : [raw];
      const match: any = rows.find(assignmentMatchesTeacher);
      if (!match) continue;
      const classroomName = String(match.className || match.classroomName || "").trim();
      const classroom: any = context.classroomsByName.get(normalizeTeacherValue(classroomName));
      return {
        classroomId: String(classroom?.id || match.classroomId || classroomName).trim(),
        classroomName: classroomName || String(classroom?.name || classroom?.className || "").trim(),
        courseName: String(match.courseName || match.course || match.name || "").trim(),
      };
    }

    // Sınıf hücreleri asıl güvenli kaynaktır. Öğretmen ID veya adı üzerinden eşleştir.
    for (const [key, raw] of Object.entries(schedule)) {
      if (!key.startsWith("class_") || !raw) continue;
      const matchedSuffix = suffixes.find((suffix) => key.endsWith(suffix));
      if (!matchedSuffix) continue;
      const rows = Array.isArray(raw) ? raw : [raw];
      const match: any = rows.find(assignmentMatchesTeacher);
      if (!match) continue;
      const classId = key.slice("class_".length, key.length - matchedSuffix.length);
      const classroom: any = context.classroomsById.get(classId);
      return {
        classroomId: classId,
        classroomName: String(classroom?.name || classroom?.className || match.className || match.classroomName || "").trim(),
        courseName: String(match.courseName || match.course || match.name || "").trim(),
      };
    }
    return null;
  };

  const sameTeacherAssignment = (a: any, b: any) =>
    Boolean(a && b)
    && normalizeTeacherValue(a.classroomId || a.classroomName) === normalizeTeacherValue(b.classroomId || b.classroomName)
    && normalizeTeacherValue(a.courseName) === normalizeTeacherValue(b.courseName);

  const resolveTeacherActiveLesson = (row: any, context: TeacherScheduleContext) => {
    const now = teacherNow();
    const minute = toMinute(now.time);
    const slots = context.lessonTimes.map((slot) => ({
      ...slot,
      assignment: teacherAssignmentAt(row, now.day, slot.hour, context),
    }));

    for (let index = 0; index < slots.length; index += 1) {
      if (!slots[index].assignment) continue;
      let first = index;
      let last = index;
      while (first > 0 && sameTeacherAssignment(slots[first - 1].assignment, slots[index].assignment)) first -= 1;
      while (last < slots.length - 1 && sameTeacherAssignment(slots[last + 1].assignment, slots[index].assignment)) last += 1;
      if (index !== first) continue;

      const starts = toMinute(slots[first].start);
      const ends = toMinute(slots[last].end);
      if (minute < starts || minute > ends) continue;

      let currentLesson = slots[first].hour;
      for (let i = first; i <= last; i += 1) {
        if (minute >= toMinute(slots[i].start) && minute <= toMinute(slots[i].end)) {
          currentLesson = slots[i].hour;
          break;
        }
      }

      return {
        active: true,
        date: now.date,
        day: now.day,
        currentTime: now.time,
        classroomId: slots[index].assignment.classroomId,
        classroomName: slots[index].assignment.classroomName,
        courseName: slots[index].assignment.courseName,
        lessons: slots.slice(first, last + 1).map((slot) => slot.hour),
        currentLesson,
        startTime: slots[first].start,
        endTime: slots[last].end,
      };
    }
    return { active: false, date: now.date, day: now.day, currentTime: now.time };
  };

  const TEACHER_SCHEDULE_DAYS = ["Pazartesi", "Sal\u0131", "\u00c7ar\u015famba", "Per\u015fembe", "Cuma"];
  const TEACHER_SCHEDULE_NOTES = "teacher_schedule_notes";

  const addDaysToTeacherDate = (date: string, days: number) => {
    const [year, month, day] = String(date || "").split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return date;
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  };

  const teacherWeeklySchedule = (row: any, context: TeacherScheduleContext) =>
    TEACHER_SCHEDULE_DAYS.map((day) => ({
      day,
      slots: context.lessonTimes.map((slot) => ({
        ...slot,
        assignment: teacherAssignmentAt(row, day, slot.hour, context),
      })),
    }));

  const allEnstituTeachers = () => {
    const rows = [...listDocuments("teachers"), ...listDocuments("school_teachers")];
    const byKey = new Map<string, any>();
    for (const item of rows) {
      const id = String(item?.id || item?.teacherId || "").trim();
      const name = String(item?.name || item?.fullName || item?.teacherName || "").trim();
      if (!id && !name) continue;
      const key = id || normalizeTeacherValue(name);
      if (!byKey.has(key)) byKey.set(key, { ...item, id: id || key, name });
    }
    return [...byKey.values()].sort((a,b) => String(a.name).localeCompare(String(b.name), "tr-TR"));
  };

  const adminTeacherSchedulePayload = (context: TeacherScheduleContext) => allEnstituTeachers().map((teacher: any) => {
    const row = { teacherId: String(teacher.id || teacher.teacherId || ""), teacherName: String(teacher.name || teacher.fullName || teacher.teacherName || "") };
    return {
      id: row.teacherId,
      name: row.teacherName,
      branch: String(teacher.branch || teacher.branchName || teacher.subjectName || ""),
      days: teacherWeeklySchedule(row, context),
    };
  });

  const classSortKey = (value: string) => {
    const text = String(value || "").trim().toLocaleUpperCase("tr-TR");
    const m = text.match(/^(9|10|11|12)\s*[-/. ]?\s*(.*)$/);
    const grade = m ? Number(m[1]) : 99;
    const branch = m ? m[2] : text;
    return [grade, branch] as const;
  };

  const adminDutyAssignments = () => {
    const row: any = getDocument("browser_storage", "school_duty_assignments_v1");
    const raw = row?.value;
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const adminClassSchedulePayload = (context: TeacherScheduleContext) => {
    const classrooms = [...context.classroomsById.values()]
      .filter((item: any) => item && (item.id || item.name))
      .map((item: any) => ({ id: String(item.id || item.name || "").trim(), name: String(item.name || item.className || "").trim() }))
      .filter((item: any) => item.id && item.name)
      .sort((a: any, b: any) => {
        const ak = classSortKey(a.name), bk = classSortKey(b.name);
        return ak[0] - bk[0] || String(ak[1]).localeCompare(String(bk[1]), "tr-TR");
      });

    return classrooms.map((classroom: any) => ({
      id: classroom.id,
      name: classroom.name,
      days: TEACHER_SCHEDULE_DAYS.map((day) => ({
        day,
        slots: context.lessonTimes.map((slot) => {
          const raw = teacherScheduleCell(context.schedule, `class_${classroom.id}_`, day, slot.hour);
          const rows = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
          const assignments = rows.map((item: any) => ({
            teacherName: String(item?.teacherName || item?.teacher || "").trim(),
            teacherName2: String(item?.teacherName2 || "").trim(),
            courseName: String(item?.courseName || item?.course || "").trim(),
          })).filter((item: any) => item.teacherName || item.teacherName2 || item.courseName);
          return { ...slot, assignments };
        }),
      })),
    }));
  };

  const adminExamRows = () => listDocuments("exams")
    .filter((exam: any) => exam && (exam?.isEvaluated === true || (Array.isArray(exam?.studentTxtRecords) && exam.studentTxtRecords.length > 0)))
    .map((exam: any) => {
      const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
      const subjects = structure.flatMap((test: any) => Array.isArray(test?.subjects) ? test.subjects : []);
      const questionMap = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
      const subjectNames = Array.from(new Set([...subjects.map((subject: any) => String(subject?.name || "").trim()), ...Object.keys(questionMap)].filter(Boolean)));
      const questionCount = subjectNames.reduce((total, name) => total + Math.max(Number(subjects.find((subject: any) => String(subject?.name || "").trim() === name)?.count || 0), Object.keys(questionMap?.[name] || {}).length), 0);
      const gradeLevels = Array.from(new Set((exam?.studentTxtRecords || []).map((record: any) => String(record?.classLevel || record?.gradeLevel || "").match(/^(9|10|11|12)/)?.[1]).filter(Boolean)));
      return { id: String(exam?.id || ""), examName: String(exam?.examName || exam?.name || "Sınav"), examDate: String(exam?.examDate || exam?.date || exam?.updatedAt || ""), examStatus: String(exam?.examStatus || exam?.status || ""), questionCount, subjectCount: subjectNames.length, gradeLevels };
    })
    .filter((exam: any) => exam.id)
    .sort((a: any, b: any) => String(b.examDate).localeCompare(String(a.examDate)));

  const adminExamSummary = (exam: any) => {
    const structure = Array.isArray(exam?.examStructure) ? exam.examStructure : [];
    const configured = structure.flatMap((test: any) => Array.isArray(test?.subjects) ? test.subjects : []);
    const questionMap = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
    const subjectNames = Array.from(new Set([...configured.map((subject: any) => String(subject?.name || "").trim()), ...Object.keys(questionMap)].filter(Boolean)));
    const records = Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : [];
    const responseLetter = (value: unknown) => String(value || "").trim().toLocaleUpperCase("tr-TR");
    const subjects = subjectNames.map((subjectName) => {
      const questions = questionMap?.[subjectName] || {};
      const count = Math.max(Number(configured.find((subject: any) => String(subject?.name || "").trim() === subjectName)?.count || 0), Object.keys(questions).length);
      const stats = records.map((record: any) => {
        const answers = String(record?.answerFields?.[subjectName] || record?.fieldValues?.[subjectName] || "").replace(/\s/g, "");
        let correct = 0, wrong = 0, empty = 0;
        for (let index = 0; index < count; index += 1) { const answer = responseLetter(answers[index]); const key = responseLetter(questions?.[index]?.correctAnswer); if (!answer) empty += 1; else if (key && answer === key) correct += 1; else wrong += 1; }
        const classroom = String(record?.gradeLevel || record?.classLevel || "").trim() || [record?.classLevel, record?.branch].filter(Boolean).join(" ");
        return { classroom: classroom || "Sınıf bilgisi yok", correct, wrong, empty, net: correct - wrong / 4 };
      });
      const sum = (key: "correct" | "wrong" | "empty" | "net") => stats.reduce((total, item) => total + Number(item[key] || 0), 0);
      const classroomMap = new Map<string, any[]>(); stats.forEach((item) => classroomMap.set(item.classroom, [...(classroomMap.get(item.classroom) || []), item]));
      const classroomStats = Array.from(classroomMap.entries()).map(([classroom, items], index) => { const divisor = items.length || 1; const correct = sumFrom(items, "correct") / divisor; const wrong = sumFrom(items, "wrong") / divisor; const empty = sumFrom(items, "empty") / divisor; const net = sumFrom(items, "net") / divisor; return { classroom, participantCount: items.length, correct, wrong, empty, net, successPercentage: count ? correct / count * 100 : 0, rank: index + 1 }; }).sort((a: any, b: any) => b.successPercentage - a.successPercentage).map((item: any, index: number) => ({ ...item, rank: index + 1 }));
      const answerCounts: Record<string, Record<string, number>> = {}; for (let index = 0; index < count; index += 1) answerCounts[String(index)] = {};
      records.forEach((record: any) => { const answers = String(record?.answerFields?.[subjectName] || record?.fieldValues?.[subjectName] || "").replace(/\s/g, ""); for (let index = 0; index < count; index += 1) { const answer = responseLetter(answers[index]); if (answer) answerCounts[String(index)][answer] = (answerCounts[String(index)][answer] || 0) + 1; } });
      const outcomeMap = new Map<string, number[]>(); for (let index = 0; index < count; index += 1) { const question = questions?.[index] || {}; const outcomeName = String(question?.outcome || question?.topic || "Kazanım bilgisi yok"); outcomeMap.set(outcomeName, [...(outcomeMap.get(outcomeName) || []), index]); }
      return { subjectName, questionCount: count, participantCount: stats.length, averageCorrect: stats.length ? sum("correct") / stats.length : 0, averageWrong: stats.length ? sum("wrong") / stats.length : 0, averageEmpty: stats.length ? sum("empty") / stats.length : 0, averageNet: stats.length ? sum("net") / stats.length : 0, classroomStats, outcomeStats: Array.from(outcomeMap.entries()).map(([outcomeName, indexes]) => { const total = indexes.length * stats.length; const correct = stats.reduce((totalCorrect, _item, recordIndex) => { const answers = String(records[recordIndex]?.answerFields?.[subjectName] || records[recordIndex]?.fieldValues?.[subjectName] || "").replace(/\s/g, ""); return totalCorrect + indexes.filter((index) => responseLetter(answers[index]) === responseLetter(questions?.[index]?.correctAnswer)).length; }, 0); return { outcomeName, questionNumbers: indexes.map((index) => index + 1), successPercentage: total ? correct / total * 100 : 0, historicalSuccessPercentage: null, historicalExamCount: 0, historicalAnswerCount: 0, changePercentagePoint: null, developmentStatus: "NO_HISTORY" }; }), itemAnalysis: Array.from({ length: count }, (_, index) => { const counts = answerCounts[String(index)] || {}; const totalResponses = Object.values(counts).reduce((total, value) => total + value, 0); return { questionNumber: index + 1, correctAnswer: responseLetter(questions?.[index]?.correctAnswer), totalResponses, answerCounts: counts, answerPercentages: Object.fromEntries(Object.entries(counts).map(([answer, value]) => [answer, totalResponses ? value / totalResponses * 100 : 0])) }; }) };
    });
    return { exam: { id: String(exam?.id || ""), examName: String(exam?.examName || exam?.name || "Sınav"), examDate: String(exam?.examDate || exam?.date || exam?.updatedAt || ""), examStatus: String(exam?.examStatus || exam?.status || "") }, subjects };
  };

  function sumFrom(items: any[], key: string) { return items.reduce((total, item) => total + Number(item?.[key] || 0), 0); }

  app.get("/api/behavior/teacher-links/:token/admin/exams", (request, response) => {
    const access = requireBehaviorAdminLink(String(request.params.token || ""));
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    return response.json({ exams: adminExamRows() });
  });

  app.get("/api/behavior/teacher-links/:token/admin/exams/:examId/summary", (request, response) => {
    const access = requireBehaviorAdminLink(String(request.params.token || ""));
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const exam = listDocuments("exams").find((item: any) => String(item?.id || "") === String(request.params.examId || ""));
    if (!exam) return response.status(404).json({ error: "Sınav bulunamadı." });
    return response.json(adminExamSummary(exam));
  });

  const guidanceStudentScope = (row: any) => {
    const profile = resolveEnstituStaffProfile(row);
    const ownerValues = [row?.teacherId, row?.teacherName, row?.id, row?.name]
      .map((value) => normalizeTeacherValue(value))
      .filter(Boolean);
    const ownsClassroom = (classroom: any) => [
      classroom?.advisorTeacherId, classroom?.advisorTeacherName,
      classroom?.counselorTeacherId, classroom?.counselorTeacherName,
      classroom?.guidanceTeacherId, classroom?.guidanceTeacherName,
      classroom?.classTeacherId, classroom?.classTeacherName,
    ].map((value) => normalizeTeacherValue(value)).some((value) => ownerValues.includes(value));
    const classrooms = allAttendanceClassrooms();
    const assigned = classrooms.filter(ownsClassroom);
    const position = normalizeTeacherValue(profile.position);
    const isClassCounselor = profile.role === "TEACHER" || /SINIF.*REHBER|REHBER.*SINIF/.test(position);
    return {
      profile,
      all: profile.role === "ADMIN" || (profile.role === "GUIDANCE" && !isClassCounselor),
      classroomIds: new Set(assigned.map((item: any) => String(item?.id || item?.classId || "").trim()).filter(Boolean)),
      classroomNames: new Set(assigned.map((item: any) => normalizeTeacherValue(item?.name || item?.classroom || item?.className)).filter(Boolean)),
    };
  };

  const guidanceStudentRows = (scope: ReturnType<typeof guidanceStudentScope>) => {
    const byId = new Map<string, any>();
    for (const student of allAttendanceStudents()) {
      if (!student || student?.status === "Pasif") continue;
      const id = String(student?.id || student?.studentId || "").trim();
      const number = String([
        student?.number, student?.studentNumber, student?.studentNo,
        student?.schoolNumber, student?.schoolNo, student?.ogrenciNo,
        student?.okulNo, student?.okulNumarasi, student?.student_number, student?.no,
        id,
      ].find((value) => String(value || "").trim()) || "").trim();
      const classroomId = String(student?.classroomId || student?.classId || "").trim();
      const classroom = String(student?.classroom || student?.className || student?.gradeLevel || "").trim();
      if (!scope.all && !scope.classroomIds.has(classroomId) && !scope.classroomNames.has(normalizeTeacherValue(classroom))) continue;
      if (!id) continue;
      byId.set(id, { id, number, name: String(student?.name || student?.fullName || student?.studentName || "").trim(), classroom, classroomId });
    }
    return Array.from(byId.values()).sort((a, b) => String(a.number).localeCompare(String(b.number), "tr", { numeric: true }) || String(a.name).localeCompare(String(b.name), "tr"));
  };

  const guidanceExamProgress = (student: any) => {
    const cleanNumber = (value: unknown) => String(value || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
    const studentNumber = cleanNumber(student.number);
    const studentName = normalizeTeacherValue(student.name);
    const belongs = (record: any) => {
      const numbers = [record?.studentNumber, record?.studentNo, record?.schoolNumber, record?.fieldValues?.["Öğrenci No"], record?.fieldValues?.["Ogrenci No"]].map(cleanNumber);
      if (studentNumber && numbers.includes(studentNumber)) return true;
      return normalizeTeacherValue(record?.studentName || record?.name || record?.fieldValues?.["Adı Soyadı"] || record?.fieldValues?.["Adi Soyadi"]) === studentName;
    };
    const today = new Date().toISOString().slice(0, 10);
    const exams = listDocuments("exams").filter((exam: any) => {
      if (!exam || !(exam?.isEvaluated === true || (Array.isArray(exam?.studentTxtRecords) && exam.studentTxtRecords.length))) return false;
      const examDate = String(exam?.examDate || exam?.date || "").slice(0, 10);
      return !examDate || examDate <= today;
    }).map((exam: any) => {
      const record = (Array.isArray(exam?.studentTxtRecords) ? exam.studentTxtRecords : []).find(belongs);
      if (!record) return null;
      const configured = (Array.isArray(exam?.examStructure) ? exam.examStructure : []).flatMap((test: any) => Array.isArray(test?.subjects) ? test.subjects : []);
      const questions = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
      const subjects = Array.from(new Set([...configured.map((item: any) => String(item?.name || item?.subjectName || "").trim()), ...Object.keys(questions)].filter(Boolean))).map((subjectName) => {
        const subjectQuestions = questions?.[subjectName] || {};
        const questionCount = Math.max(Number(configured.find((item: any) => String(item?.name || item?.subjectName || "").trim() === subjectName)?.count || 0), Object.keys(subjectQuestions).length);
        const answers = String(record?.answerFields?.[subjectName] || record?.fieldValues?.[subjectName] || "").replace(/\s/g, "").toLocaleUpperCase("tr-TR");
        let correct = 0, wrong = 0, empty = 0;
        for (let index = 0; index < questionCount; index += 1) {
          const answer = String(answers[index] || "").trim();
          const key = String(subjectQuestions?.[index]?.correctAnswer || subjectQuestions?.[index]?.answer || "").trim().toLocaleUpperCase("tr-TR");
          if (!answer) empty += 1;
          else if (key && answer === key) correct += 1;
          else wrong += 1;
        }
        return { subjectName, questionCount, correct, wrong, empty, net: Number((correct - wrong / 4).toFixed(2)), successPercentage: questionCount ? Number((correct / questionCount * 100).toFixed(1)) : 0 };
      });
      return { id: String(exam?.id || ""), examName: String(exam?.examName || exam?.name || "Sınav"), examDate: String(exam?.examDate || exam?.date || exam?.updatedAt || ""), subjects };
    }).filter(Boolean).sort((a: any, b: any) => String(a.examDate).localeCompare(String(b.examDate)));
    const bySubject = new Map<string, any[]>();
    exams.forEach((exam: any) => exam.subjects.forEach((subject: any) => bySubject.set(subject.subjectName, [...(bySubject.get(subject.subjectName) || []), { examId: exam.id, examName: exam.examName, examDate: exam.examDate, ...subject }])));
    const courseProgress = Array.from(bySubject.entries()).map(([subjectName, history]) => {
      const first = history[0]; const latest = history[history.length - 1];
      return { subjectName, latest, first, changePercentagePoint: Number((latest.successPercentage - first.successPercentage).toFixed(1)), history };
    }).sort((a, b) => a.subjectName.localeCompare(b.subjectName, "tr"));
    return { lastExam: exams[exams.length - 1] || null, courseProgress };
  };

  app.get("/api/behavior/teacher-links/:token/guidance/students", (request, response) => {
    const access = requireBehaviorTeacherLink(String(request.params.token || ""));
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const scope = guidanceStudentScope(access.row);
    if (!scope.all && !scope.classroomIds.size && !scope.classroomNames.size) return response.status(403).json({ error: "Öğrenci erişimi için sınıf rehberliği eşleştirmesi bulunamadı." });
    const query = normalizeTeacherValue(request.query.q || "");
    const students = guidanceStudentRows(scope)
      .filter((student) => !query || normalizeTeacherValue(`${student.number} ${student.name} ${student.classroom}`).includes(query));
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ scope: scope.all ? "all" : "classroom", students });
  });

  app.get("/api/behavior/teacher-links/:token/guidance/students/:studentId/overview", (request, response) => {
    const access = requireBehaviorTeacherLink(String(request.params.token || ""));
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const scope = guidanceStudentScope(access.row);
    const student = guidanceStudentRows(scope).find((item) => item.id === String(request.params.studentId || ""));
    if (!student) return response.status(404).json({ error: "Öğrenci bulunamadı veya erişim yetkiniz yok." });
    const studentNumbers = new Set([String(student.number || ""), String(student.number || "").replace(/^0+/, "")].filter(Boolean));
    const behaviorHistory = listDocuments(BEHAVIOR_SUBMISSIONS).filter((record: any) => String(record?.schoolId || "") === String(access.row?.schoolId || "")).filter((record: any) => String(record?.studentId || "") === student.id || studentNumbers.has(String(record?.studentNumber || "")) || normalizeTeacherValue(record?.studentName) === normalizeTeacherValue(student.name)).sort((a: any, b: any) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ student, behaviorHistory, exams: guidanceExamProgress(student) });
  });

  app.get("/api/behavior/teacher-links/:token/admin/programs", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    if (resolveEnstituStaffProfile(access.row).role !== "ADMIN") return response.status(403).json({ error: "YÃ¶netici yetkisi gerekli." });
    const context = createTeacherScheduleContext();
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ lessonTimes: context.lessonTimes, teachers: adminTeacherSchedulePayload(context), classrooms: adminClassSchedulePayload(context) });
  });

  app.get("/api/behavior/teacher-links/:token/admin/duty", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    if (resolveEnstituStaffProfile(access.row).role !== "ADMIN") return response.status(403).json({ error: "YÃ¶netici yetkisi gerekli." });
    const now = teacherNow();
    const items = adminDutyAssignments()
      .filter((item: any) => normalizeTeacherValue(item?.day) === normalizeTeacherValue(now.day))
      .map((item: any) => ({
        id: String(item?.id || behaviorDocumentId("duty", item?.day, item?.location, item?.teacherName)),
        day: String(item?.day || now.day),
        location: String(item?.location || "GÃ¶rev Yeri BelirtilmemiÅŸ").trim(),
        teacherName: String(item?.teacherName || "").trim(),
      }))
      .filter((item: any) => item.teacherName)
      .sort((a: any, b: any) => String(a.location).localeCompare(String(b.location), "tr-TR") || String(a.teacherName).localeCompare(String(b.teacherName), "tr-TR"));
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ now, items });
  });

  const nextTeacherLesson = (row: any, context: TeacherScheduleContext) => {
    const now = teacherNow();
    const minute = toMinute(now.time);
    const calendarDays = ["Pazartesi", "Sal\u0131", "\u00c7ar\u015famba", "Per\u015fembe", "Cuma", "Cumartesi", "Pazar"];
    const todayIndex = calendarDays.indexOf(now.day);

    for (let offset = 0; offset <= 7; offset += 1) {
      const calendarDay = calendarDays[((todayIndex >= 0 ? todayIndex : 0) + offset) % calendarDays.length];
      if (!TEACHER_SCHEDULE_DAYS.includes(calendarDay)) continue;
      for (const slot of context.lessonTimes) {
        if (offset === 0 && toMinute(slot.start) <= minute) continue;
        const assignment = teacherAssignmentAt(row, calendarDay, slot.hour, context);
        if (!assignment) continue;
        return {
          day: calendarDay,
          hour: slot.hour,
          start: slot.start,
          end: slot.end,
          date: addDaysToTeacherDate(now.date, offset),
          assignment,
        };
      }
    }
    return null;
  };

  const teacherScheduleNotes = (row: any, token: string) =>
    listDocuments(TEACHER_SCHEDULE_NOTES).filter((note: any) =>
      String(note?.teacherId || "") === String(row.teacherId || "")
      && String(note?.linkToken || "") === token
      && String(note?.status || "pending") === "pending"
    );

  // Soru seçme görevi yarım kalmış, tamamlanmış veya eski bir seçim kaydı taşıyor
  // olsa bile yönetici görevi başka kullanıcıya aktarabilmelidir. Seçilmiş sorular
  // korunur; sadece görevin sahibi değişir ve görev yeniden "in_progress" olur.
  app.post(
    "/api/question-bank/teacher-assignments/reassign-by-context",
    (request, response) => {
      try {
        const requestedAssignmentId = String(request.body?.assignmentId || "").trim();
        const examId = String(request.body?.examId || "").trim();
        const examCode = String(request.body?.examCode || "").trim();
        const subjectName = String(request.body?.subjectName || "").trim();
        const requestedTeacherId = String(request.body?.teacherId || "").trim();
        const requestedTeacherName = String(request.body?.teacherName || "").trim();
        if (!requestedTeacherId) {
          return response.status(400).json({ error: "Yeni öğretmen kimliği zorunludur." });
        }

        // Öğretmen listesi ile öğretmen telefon bağlantısındaki kimlikler eski
        // kayıtlarda farklı id şemaları kullanabiliyor. Telefon uygulamasının
        // görevi kesin görebilmesi için seçilen öğretmeni mevcut aktif bağlantı
        // kaydıyla eşleştirip kanonik teacherId / teacherName değerlerini kullan.
        const requestedTeacherNameKey = normalizeTeacherAssignmentIdentity(requestedTeacherName);
        const matchingTeacherLink: any = listDocuments(BEHAVIOR_LINKS)
          .filter((link: any) => link?.active !== false)
          .sort((a: any, b: any) => {
            // Önce tam teacherId eşleşmesini, sonra normalize ad eşleşmesini tercih et.
            const aId = String(a?.teacherId || a?.userId || a?.personnelId || "").trim();
            const bId = String(b?.teacherId || b?.userId || b?.personnelId || "").trim();
            return Number(bId === requestedTeacherId) - Number(aId === requestedTeacherId);
          })
          .find((link: any) => {
            const linkTeacherId = String(link?.teacherId || link?.userId || link?.personnelId || "").trim();
            const linkTeacherNameKey = normalizeTeacherAssignmentIdentity(
              link?.teacherName || link?.name || link?.fullName || link?.adSoyad,
            );
            return (linkTeacherId && linkTeacherId === requestedTeacherId)
              || (requestedTeacherNameKey && linkTeacherNameKey === requestedTeacherNameKey);
          });

        // Öğretmenin telefon uygulaması bu aktif teacher-link kaydı üzerinden görev okur.
        // Bağlantı çözülemezken “kaydedildi” demek yanlış yönlendiriyordu; görev mobilde
        // hiçbir zaman görünemeyeceği için açık hata döndür ve sahte başarı oluşturma.
        if (!matchingTeacherLink) {
          return response.status(409).json({
            error: `${requestedTeacherName || requestedTeacherId} öğretmeninin aktif mobil uygulama bağlantısı bulunamadı. Öğretmen uygulaması bağlantısını bir kez yenileyip tekrar görevlendiriniz.`,
            code: "TEACHER_MOBILE_LINK_NOT_FOUND",
          });
        }

        const teacherId = String(matchingTeacherLink?.teacherId || requestedTeacherId).trim();
        const teacherName = String(matchingTeacherLink?.teacherName || requestedTeacherName || teacherId).trim();
        const teacherLinkId = String(matchingTeacherLink?.id || matchingTeacherLink?.__documentId || "").trim();

        const examKeys = new Set([examId, examCode].filter(Boolean));
        const subjectKey = normalizeTeacherValue(subjectName);
        const candidates = listDocuments("teacherTestAssignments")
          .filter((assignment: any) => {
            const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
            if (requestedAssignmentId && assignmentId === requestedAssignmentId) return true;
            const linked = [assignment?.testId, assignment?.examId, assignment?.examCode]
              .map((value) => String(value || "").trim())
              .filter(Boolean);
            const sameExam = examKeys.size > 0 && linked.some((value) => examKeys.has(value));
            if (!sameExam) return false;
            if (!subjectKey) return true;
            const assignmentSubject = normalizeTeacherValue(
              assignment?.courseName || assignment?.subject || assignment?.lessonName || assignment?.courseId || "",
            );
            return assignmentSubject === subjectKey;
          })
          .sort((a: any, b: any) => {
            const aTime = Date.parse(String(a?.updatedAt || a?.createdAt || "")) || 0;
            const bTime = Date.parse(String(b?.updatedAt || b?.createdAt || "")) || 0;
            return bTime - aTime;
          });

        let assignment: any =
          candidates.find((item: any) =>
            requestedAssignmentId && String(item?.id || item?.__documentId || "") === requestedAssignmentId,
          ) || candidates[0];

        // İlk görevlendirmede henüz teacherTestAssignments kaydı yoktur. Eski akış
        // burada 404 döndürdüğü için yönetici açılır listeden öğretmeni görse bile
        // seçim kontrollü select içinde tekrar boş değere dönüyordu. İstemcinin
        // gönderdiği sınav/kapsam seed'i ile aynı endpoint ilk görevi de oluşturur.
        if (!assignment) {
          const seed = request.body?.seedAssignment;
          if (!seed || typeof seed !== "object" || Array.isArray(seed)) {
            return response.status(404).json({ error: "Aktarılacak veya oluşturulacak soru seçme görevi bulunamadı." });
          }
          const seedId = String(
            seed?.id ||
            requestedAssignmentId ||
            `exam-assignment-${examId || examCode || Date.now()}-${subjectName || teacherId}`,
          )
            .trim()
            .replace(/\s+/g, "-");
          const now = new Date().toISOString();
          assignment = {
            ...seed,
            id: seedId,
            testId: String(seed?.testId || examId || examCode || seedId),
            examId: String(seed?.examId || examId || ""),
            examCode: String(seed?.examCode || examCode || ""),
            courseName: String(seed?.courseName || seed?.subject || subjectName || ""),
            subject: String(seed?.subject || seed?.courseName || subjectName || ""),
            teacherId,
            teacherName: teacherName || String(seed?.teacherName || teacherId),
            selectedQuestionKeys: Array.isArray(seed?.selectedQuestionKeys) ? seed.selectedQuestionKeys.map(String) : [],
            selectedQuestionSnapshots: Array.isArray(seed?.selectedQuestionSnapshots) ? seed.selectedQuestionSnapshots : [],
            selectionStatus: "in_progress",
            completedAt: "",
            createdAt: String(seed?.createdAt || now),
            updatedAt: now,
          };
        }

        const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
        const rawSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
        const currentSelection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
          ? rawSelection
          : null;
        const selectedQuestionKeys = Array.isArray(currentSelection?.selectedQuestionKeys)
          ? currentSelection.selectedQuestionKeys.map(String)
          : Array.isArray(assignment?.selectedQuestionKeys)
            ? assignment.selectedQuestionKeys.map(String)
            : [];
        const selectedQuestionSnapshots = Array.isArray(currentSelection?.selectedQuestionSnapshots)
          ? currentSelection.selectedQuestionSnapshots
          : Array.isArray(assignment?.selectedQuestionSnapshots)
            ? assignment.selectedQuestionSnapshots
            : [];
        const now = new Date().toISOString();
        const nextRevision = Math.max(
          Number(currentSelection?.selectionRevision || 0),
          Number(assignment?.selectionRevision || 0),
        ) + 1;
        const nextCycleId = `${assignmentId}-${Date.now()}`;

        const nextAssignment: any = {
          ...assignment,
          id: assignmentId,
          teacherId,
          teacherName: teacherName || String(assignment?.teacherName || teacherId),
          teacherLinkId,
          assignmentCycleId: nextCycleId,
          selectedQuestionKeys,
          selectedQuestionSnapshots,
          selectionStatus: "in_progress",
          selectionRevision: nextRevision,
          completedAt: "",
          questionPoolLocked: selectedQuestionKeys.length > 0,
          questionUsageLocked: selectedQuestionKeys.length > 0,
          updatedAt: now,
        };

        upsertDocument("teacherTestAssignments", assignmentId, nextAssignment);
        upsertDocument("teacherTestAssignmentSelections", assignmentId, {
          ...(currentSelection || {}),
          id: assignmentId,
          assignmentId,
          testId: String(assignment?.testId || assignment?.examId || examId || examCode || ""),
          teacherId,
          teacherName: nextAssignment.teacherName,
          teacherLinkId,
          assignmentCycleId: nextCycleId,
          selectedQuestionKeys,
          selectedQuestionSnapshots,
          selectionStatus: "in_progress",
          selectionRevision: nextRevision,
          completedAt: "",
          createdAt: String(currentSelection?.createdAt || assignment?.createdAt || now),
          updatedAt: now,
        });

        // Aynı sınav/ders için eskiden kalmış mükerrer görevler yeni öğretmenin
        // ekranında karışıklık oluşturmasın.
        candidates.forEach((item: any) => {
          const duplicateId = String(item?.id || item?.__documentId || "").trim();
          if (!duplicateId || duplicateId === assignmentId) return;
          deleteDocument("teacherTestAssignmentSelections", duplicateId);
          deleteDocument("teacherTestAssignments", duplicateId);
        });

        // Görevlendirme yalnız teacherTestAssignments içinde kalırsa yönetici ekranı
        // başka sekmeye gidip döndüğünde eski exams belgesini okuyup seçimi kaybediyordu.
        // Aynı işlem içinde sınav belgesine de görev referansını yaz; böylece masaüstü
        // ve telefon tek kalıcı görevi görür.
        const incomingExamSnapshot =
          request.body?.examSnapshot && typeof request.body.examSnapshot === "object" && !Array.isArray(request.body.examSnapshot)
            ? request.body.examSnapshot
            : null;
        const persistedExamId = String(
          examId || assignment?.examId || assignment?.testId || incomingExamSnapshot?.id || "",
        ).trim();
        let persistedExam: any = null;
        if (persistedExamId) {
          const storedExam: any = getDocument("exams", persistedExamId);
          const baseExam: any = storedExam || (incomingExamSnapshot && String(incomingExamSnapshot?.id || "") === persistedExamId
            ? incomingExamSnapshot
            : null);
          if (baseExam) {
            const currentAssignments =
              baseExam?.questionAssignments && typeof baseExam.questionAssignments === "object"
                ? baseExam.questionAssignments
                : {};
            const nextAssignments: Record<string, any> = {};
            let replaced = false;
            Object.entries(currentAssignments).forEach(([key, value]: any) => {
              const sameSubject = normalizeTeacherAssignmentIdentity(
                value?.subject || value?.courseName || value?.lessonName || "",
              ) === normalizeTeacherAssignmentIdentity(subjectName);
              if (sameSubject) {
                if (!replaced) {
                  nextAssignments[key] = nextAssignment;
                  replaced = true;
                }
              } else {
                nextAssignments[key] = value;
              }
            });
            if (!replaced) {
              const gradeKey = String(nextAssignment?.grade || baseExam?.gradeLevel || "").trim();
              nextAssignments[gradeKey ? `${gradeKey}__${subjectName}` : subjectName] = nextAssignment;
            }
            persistedExam = {
              ...baseExam,
              id: persistedExamId,
              questionAssignments: nextAssignments,
              questionSelectionModeBySubject: {
                ...(baseExam?.questionSelectionModeBySubject || {}),
                [subjectName]: "teacher",
              },
            };
            upsertDocument("exams", persistedExamId, persistedExam);
          }
        }

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          assignment: nextAssignment,
          exam: persistedExam,
          mobileLinkResolved: true,
          teacherLinkId,
        });
      } catch (error) {
        console.error("Soru seçme görevi öğretmen değiştirme hatası:", error);
        return response.status(500).json({
          error: error instanceof Error ? error.message : "Soru seçme görevi aktarılamadı.",
        });
      }
    },
  );

  // Yöneticiye geçildiğinde yarım kalmış görevin iptal edilememesi doğru değildir.
  // Bu endpoint seçilmiş sorulara dokunmadan yalnız görev/selection kayıtlarını kaldırır.
  app.post(
    "/api/question-bank/teacher-assignments/release-by-context",
    (request, response) => {
      try {
        const requestedAssignmentId = String(request.body?.assignmentId || "").trim();
        const examId = String(request.body?.examId || "").trim();
        const examCode = String(request.body?.examCode || "").trim();
        const subjectName = String(request.body?.subjectName || "").trim();
        const examKeys = new Set([examId, examCode].filter(Boolean));
        const subjectKey = normalizeTeacherValue(subjectName);

        const assignments = listDocuments("teacherTestAssignments").filter((assignment: any) => {
          const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
          if (requestedAssignmentId && assignmentId === requestedAssignmentId) return true;
          const linked = [assignment?.testId, assignment?.examId, assignment?.examCode]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          const sameExam = examKeys.size > 0 && linked.some((value) => examKeys.has(value));
          if (!sameExam) return false;
          if (!subjectKey) return true;
          const assignmentSubject = normalizeTeacherValue(
            assignment?.courseName || assignment?.subject || assignment?.lessonName || assignment?.courseId || "",
          );
          return assignmentSubject === subjectKey;
        });

        const removedAssignmentIds: string[] = [];
        const preservedQuestionKeys = new Set<string>();
        const preservedQuestionSnapshots: any[] = [];
        const preservedSnapshotIds = new Set<string>();
        assignments.forEach((assignment: any) => {
          const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
          if (!assignmentId) return;
          const rawSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
          const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
            ? rawSelection
            : null;
          const keys = Array.isArray(selection?.selectedQuestionKeys)
            ? selection.selectedQuestionKeys
            : Array.isArray(assignment?.selectedQuestionKeys)
              ? assignment.selectedQuestionKeys
              : [];
          keys.map(String).forEach((key: string) => preservedQuestionKeys.add(key));

          const snapshots = Array.isArray(selection?.selectedQuestionSnapshots)
            ? selection.selectedQuestionSnapshots
            : Array.isArray(assignment?.selectedQuestionSnapshots)
              ? assignment.selectedQuestionSnapshots
              : [];
          snapshots.filter(Boolean).forEach((snapshot: any, index: number) => {
            const snapshotId = String(
              snapshot?.id ||
              snapshot?.questionId ||
              snapshot?.question_id ||
              snapshot?.key ||
              `${assignmentId}-${index}`,
            ).trim();
            if (preservedSnapshotIds.has(snapshotId)) return;
            preservedSnapshotIds.add(snapshotId);
            preservedQuestionSnapshots.push(snapshot);
          });

          deleteDocument("teacherTestAssignmentSelections", assignmentId);
          deleteDocument("teacherTestAssignments", assignmentId);
          removedAssignmentIds.push(assignmentId);
        });

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          removedAssignmentIds,
          removedCount: removedAssignmentIds.length,
          preservedQuestionKeys: Array.from(preservedQuestionKeys),
          preservedQuestionSnapshots,
        });
      } catch (error) {
        console.error("Soru seçme görevini yöneticiye bırakma hatası:", error);
        return response.status(500).json({
          error: error instanceof Error ? error.message : "Soru seçme görevi kaldırılamadı.",
        });
      }
    },
  );

  app.delete(
    "/api/question-bank/teacher-assignments/:assignmentId/cancel",
    (request, response) => {
      try {
        const assignmentId = String(
          request.params.assignmentId || "",
        ).trim();

        if (!assignmentId) {
          return response.status(400).json({
            error: "Ã–ÄŸretmen gÃ¶rev kimliÄŸi zorunludur.",
          });
        }

        const assignment: any = getDocument(
          "teacherTestAssignments",
          assignmentId,
        );

        if (!assignment) {
          return response.json({
            success: true,
            alreadyRemoved: true,
            assignmentId,
          });
        }

        const rawSelection: any =
          getDocument("teacherTestAssignmentSelections", assignmentId) || {};
        const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
          ? rawSelection
          : {};

        const completed =
          Boolean(selection?.completedAt || assignment?.completedAt) ||
          String(
            selection?.selectionStatus ||
              assignment?.selectionStatus ||
              "",
          ) === "completed";

        if (completed) {
          return response.status(409).json({
            error:
              "TamamlanmÄ±ÅŸ Ã¶ÄŸretmen gÃ¶revi iptal edilemez. SeÃ§ilen sorular artÄ±k testin kesin sorularÄ±dÄ±r.",
            code: "ASSIGNMENT_ALREADY_COMPLETED",
          });
        }

        deleteDocument("teacherTestAssignmentSelections", assignmentId);
        deleteDocument("teacherTestAssignments", assignmentId);

        return response.json({
          success: true,
          assignmentId,
          testId: String(assignment?.testId || ""),
          releasedQuestionKeys: Array.isArray(
            selection?.selectedQuestionKeys,
          )
            ? selection.selectedQuestionKeys.map(String)
            : Array.isArray(assignment?.selectedQuestionKeys)
              ? assignment.selectedQuestionKeys.map(String)
              : [],
        });
      } catch (error) {
        return response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Ã–ÄŸretmen gÃ¶revi iptal edilemedi.",
        });
      }
    },
  );

  app.get("/api/question-bank/teacher-assignments/summary", (_request, response) => {
    try {
      const selectionRows = listDocuments(
        "teacherTestAssignmentSelections",
      );
      const selectionMap = new Map<string, any>();

      selectionRows.forEach((selection: any) => {
        const id = String(
          selection?.assignmentId ||
            selection?.id ||
            selection?.__documentId ||
            "",
        ).trim();
        if (id) selectionMap.set(id, selection);
      });

      const assignments = listDocuments("teacherTestAssignments")
        .map((item: any) => {
          const assignmentId = String(
            item?.id || item?.__documentId || "",
          ).trim();
          const rawSelection = selectionMap.get(assignmentId) || {};
          const selection = teacherAssignmentSelectionIsCurrent(item, rawSelection)
            ? rawSelection
            : {};

          const selectedQuestionKeys = Array.isArray(
            selection?.selectedQuestionKeys,
          )
            ? selection.selectedQuestionKeys.map(String)
            : Array.isArray(item?.selectedQuestionKeys)
              ? item.selectedQuestionKeys.map(String)
              : [];
          const selectedQuestionSnapshots = Array.isArray(selection?.selectedQuestionSnapshots)
            ? selection.selectedQuestionSnapshots
            : Array.isArray(item?.selectedQuestionSnapshots)
              ? item.selectedQuestionSnapshots
              : [];
          const selectedSnapshotMap = new Map<string, any>();
          selectedQuestionSnapshots.forEach((question: any) => {
            const key = questionSnapshotIdentity(question);
            if (key) selectedSnapshotMap.set(key, question);
          });
          const effectiveSelectedCount = effectiveSelectedQuestionCount(selectedQuestionKeys, selectedSnapshotMap);

          const requiredQuestionCount = Math.max(
            1,
            Number(
              item?.requiredQuestionCount ||
                item?.maxQuestionCount ||
                1,
            ),
          );

          const selectionStatus = String(
            selection?.selectionStatus ||
              item?.selectionStatus ||
              "in_progress",
          );

          const completedAt = String(
            selection?.completedAt ||
              item?.completedAt ||
              "",
          );

          const updatedAt = String(
            selection?.updatedAt ||
              item?.updatedAt ||
              item?.createdAt ||
              "",
          );

          return {
            id: assignmentId,
            testId: String(item?.testId || selection?.testId || ""),
            testName: String(item?.testName || ""),
            teacherId: String(
              item?.teacherId || selection?.teacherId || "",
            ),
            teacherName: String(
              item?.teacherName || selection?.teacherName || "",
            ),
            selectedQuestionKeys,
            selectedQuestionCount: effectiveSelectedCount,
            requiredQuestionCount,
            maxQuestionCount: Math.max(
              requiredQuestionCount,
              Number(item?.maxQuestionCount || requiredQuestionCount),
            ),
            remainingQuestionCount: Math.max(
              0,
              requiredQuestionCount - effectiveSelectedCount,
            ),
            canComplete:
              effectiveSelectedCount === requiredQuestionCount,
            selectionStatus,
            selectionRevision: Math.max(
              Number(selection?.selectionRevision || 0),
              Number(item?.selectionRevision || 0),
            ),
            completedAt,
            updatedAt,
          };
        })
        .filter((item: any) => Boolean(item.id && item.testId))
        .sort((a: any, b: any) =>
          String(b.updatedAt || "").localeCompare(
            String(a.updatedAt || ""),
          ),
        );

      response.setHeader("Cache-Control", "no-store");
      return response.json(assignments);
    } catch (error) {
      console.error("Ã–ÄŸretmen soru gÃ¶revi Ã¶zeti hatasÄ±:", error);
      return response.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Ã–ÄŸretmen soru gÃ¶revi Ã¶zeti okunamadÄ±.",
      });
    }
  });

  app.get(
    "/api/question-bank/teacher-assignments/:assignmentId/final-selection",
    (request, response) => {
      try {
        const assignmentId = String(request.params.assignmentId || "").trim();
        const assignment: any = getDocument(
          "teacherTestAssignments",
          assignmentId,
        );
        if (!assignment) {
          return response.status(404).json({
            error: "Ã–ÄŸretmen soru gÃ¶revi bulunamadÄ±.",
          });
        }

        const rawSelection: any =
          getDocument("teacherTestAssignmentSelections", assignmentId) || {};
        const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
          ? rawSelection
          : {};

        const completedAt = String(
          selection?.completedAt || assignment?.completedAt || "",
        );
        const selectionStatus = String(
          selection?.selectionStatus ||
            assignment?.selectionStatus ||
            "in_progress",
        );

        if (!completedAt && selectionStatus !== "completed") {
          return response.status(409).json({
            error: "Ã–ÄŸretmenin soru seÃ§imi henÃ¼z tamamlanmadÄ±.",
          });
        }

        const selectedQuestionKeys = Array.isArray(
          selection?.selectedQuestionKeys,
        )
          ? selection.selectedQuestionKeys.map(String)
          : Array.isArray(assignment?.selectedQuestionKeys)
            ? assignment.selectedQuestionKeys.map(String)
            : [];

        const selectedQuestionSnapshots = Array.isArray(
          selection?.selectedQuestionSnapshots,
        )
          ? selection.selectedQuestionSnapshots
          : Array.isArray(assignment?.selectedQuestionSnapshots)
            ? assignment.selectedQuestionSnapshots
            : [];
        const selectedSnapshotMap = new Map<string, any>();
        selectedQuestionSnapshots.forEach((question: any) => {
          const key = questionSnapshotIdentity(question);
          if (key) selectedSnapshotMap.set(key, question);
        });
        const effectiveSelectedCount = effectiveSelectedQuestionCount(selectedQuestionKeys, selectedSnapshotMap);

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          id: assignmentId,
          testId: String(assignment?.testId || ""),
          teacherId: String(assignment?.teacherId || ""),
          teacherName: String(assignment?.teacherName || ""),
          selectedQuestionKeys,
          selectedQuestionSnapshots,
          selectedQuestionCount: effectiveSelectedCount,
          requiredQuestionCount: Math.max(
            1,
            Number(
              assignment?.requiredQuestionCount ||
                assignment?.maxQuestionCount ||
                selectedQuestionKeys.length ||
                1,
            ),
          ),
          selectionStatus: "completed",
          completedAt,
          updatedAt: String(
            selection?.updatedAt || assignment?.updatedAt || completedAt,
          ),
        });
      } catch (error) {
        return response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Tamamlanan Ã¶ÄŸretmen seÃ§imi okunamadÄ±.",
        });
      }
    },
  );

  // Öğretmen seçim görevi yalnız yönetici tarafından sonlandırılır.
  // Bu uç nokta seçimleri korur, görevi iki koleksiyonda da atomik olarak
  // tamamlanmış işaretler. Öğretmen tarafındaki "Kaydet/Gönder" bunu yapamaz.
  app.post(
    "/api/question-bank/teacher-assignments/:assignmentId/complete-by-admin",
    (request, response) => {
      try {
        const assignmentId = String(request.params.assignmentId || "").trim();
        const assignment: any = getDocument("teacherTestAssignments", assignmentId);
        if (!assignment) {
          return response.status(404).json({ error: "Öğretmen soru görevi bulunamadı." });
        }

        const rawSelection: any =
          getDocument("teacherTestAssignmentSelections", assignmentId) || {};
        const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
          ? rawSelection
          : {};

        const selectedQuestionKeys = Array.isArray(selection?.selectedQuestionKeys)
          ? selection.selectedQuestionKeys.map(String)
          : Array.isArray(assignment?.selectedQuestionKeys)
            ? assignment.selectedQuestionKeys.map(String)
            : [];
        const selectedQuestionSnapshots = Array.isArray(selection?.selectedQuestionSnapshots)
          ? selection.selectedQuestionSnapshots
          : Array.isArray(assignment?.selectedQuestionSnapshots)
            ? assignment.selectedQuestionSnapshots
            : [];

        const now = new Date().toISOString();
        const selectionRevision = Math.max(
          Number(selection?.selectionRevision || 0),
          Number(assignment?.selectionRevision || 0),
        ) + 1;

        const completedSelection = {
          ...selection,
          id: assignmentId,
          assignmentId,
          testId: String(assignment?.testId || selection?.testId || ""),
          teacherId: String(assignment?.teacherId || selection?.teacherId || ""),
          teacherName: String(assignment?.teacherName || selection?.teacherName || ""),
          teacherLinkId: String(assignment?.teacherLinkId || selection?.teacherLinkId || ""),
          assignmentCycleId: String(assignment?.assignmentCycleId || selection?.assignmentCycleId || ""),
          selectedQuestionKeys,
          selectedQuestionSnapshots,
          selectionStatus: "completed",
          selectionRevision,
          completedAt: now,
          completedBy: "admin",
          updatedAt: now,
          createdAt: String(selection?.createdAt || assignment?.createdAt || now),
        };

        const completedAssignment = {
          ...assignment,
          selectedQuestionKeys,
          selectedQuestionSnapshots,
          selectedQuestionCount: selectedQuestionKeys.length,
          selectionStatus: "completed",
          selectionRevision,
          completedAt: now,
          completedBy: "admin",
          updatedAt: now,
        };

        upsertDocument("teacherTestAssignmentSelections", assignmentId, completedSelection);
        upsertDocument("teacherTestAssignments", assignmentId, completedAssignment);

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          assignment: completedAssignment,
          selection: completedSelection,
        });
      } catch (error) {
        return response.status(500).json({
          error: error instanceof Error
            ? error.message
            : "Öğretmen soru görevi sonlandırılamadı.",
        });
      }
    },
  );

  const teacherLinkOwnsQuestionAssignment = (row: any, assignment: any) => {
    if (!row || !assignment) return false;
    const rowLinkId = String(row?.id || row?.__documentId || "").trim();
    const assignmentLinkId = String(assignment?.teacherLinkId || "").trim();
    if (rowLinkId && assignmentLinkId && rowLinkId === assignmentLinkId) return true;

    const rowTeacherId = String(row?.teacherId || row?.userId || row?.personnelId || "").trim();
    const assignmentTeacherId = String(assignment?.teacherId || "").trim();
    if (rowTeacherId && assignmentTeacherId && rowTeacherId === assignmentTeacherId) return true;

    const rowName = normalizeTeacherAssignmentIdentity(
      row?.teacherName || row?.name || row?.fullName || row?.adSoyad,
    );
    const assignmentName = normalizeTeacherAssignmentIdentity(
      assignment?.teacherName || assignment?.name || assignment?.fullName,
    );
    return Boolean(rowName && assignmentName && rowName === assignmentName);
  };

  app.get("/api/behavior/teacher-links/:token/question-assignments", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const row: any = access.row;
    const teacherId = String(row.teacherId || row.userId || row.personnelId || "").trim();
    const teacherName = normalizeTeacherAssignmentIdentity(
      row.teacherName || row.name || row.fullName || row.adSoyad,
    );
    const teacherLinkId = String(row?.id || row?.__documentId || "").trim();

    // Mobil görev listesinin tek kimlik ölçütü artık teacher-link kaydıdır. Eski
    // görevlerde teacherLinkId yoksa teacherId veya güçlü normalize edilmiş ad ile
    // eşleştirip kaydı aynı istekte onarırız.
    const assignments = listDocuments("teacherTestAssignments")
      .filter((item: any) => teacherLinkOwnsQuestionAssignment(row, item));

    // Seçim kaydı teacherId'ye göre değil assignmentId'ye göre bağlanır. Böylece
    // eski bir teacherId taşıyan seçim kaydı yeni/kanonik görevi gizleyemez.
    const assignmentIds = new Set(
      assignments.map((item: any) => String(item?.id || item?.__documentId || "").trim()).filter(Boolean),
    );
    const selections = listDocuments("teacherTestAssignmentSelections")
      .filter((item: any) => assignmentIds.has(String(item?.assignmentId || item?.id || "").trim()));
    const selectionByAssignment = new Map(
      selections.map((item: any) => [String(item.assignmentId || item.id), item]),
    );

    // Normalized ad üzerinden bulunan eski görevleri bir kez kanonik telefon
    // kimliğine geçir. Bundan sonraki istekler teacherId üzerinden de doğrudan eşleşir.
    assignments.forEach((item: any) => {
      const assignmentId = String(item?.id || item?.__documentId || "").trim();
      if (!assignmentId) return;
      const itemTeacherId = String(item?.teacherId || "").trim();
      const itemTeacherLinkId = String(item?.teacherLinkId || "").trim();
      const itemTeacherName = normalizeTeacherAssignmentIdentity(item?.teacherName);
      const alreadyCanonical =
        (!teacherId || itemTeacherId === teacherId) &&
        (!teacherLinkId || itemTeacherLinkId === teacherLinkId) &&
        (!teacherName || itemTeacherName === teacherName);
      if (alreadyCanonical) return;
      const healed = {
        ...item,
        teacherId: teacherId || itemTeacherId,
        teacherName: String(row.teacherName || row.name || item?.teacherName || "").trim(),
        teacherLinkId: teacherLinkId || itemTeacherLinkId,
        updatedAt: new Date().toISOString(),
      };
      upsertDocument("teacherTestAssignments", assignmentId, healed);
      const selection: any = selectionByAssignment.get(assignmentId);
      if (selection) {
        const healedSelection = {
          ...selection,
          teacherId: teacherId || String(selection?.teacherId || ""),
          teacherName: String(row.teacherName || row.name || selection?.teacherName || item?.teacherName || "").trim(),
          teacherLinkId: teacherLinkId || String(selection?.teacherLinkId || ""),
          updatedAt: healed.updatedAt,
        };
        upsertDocument("teacherTestAssignmentSelections", assignmentId, healedSelection);
        selectionByAssignment.set(assignmentId, healedSelection);
      }
      Object.assign(item, healed);
    });
    const openAssignments = assignments
      .map((item: any) => {
        const selection: any = selectionByAssignment.get(String(item.id));
        const useSelection = teacherAssignmentSelectionIsCurrent(item, selection);
        return useSelection ? {
          ...item,
          selectedQuestionKeys: Array.isArray(selection.selectedQuestionKeys) ? selection.selectedQuestionKeys : [],
          selectedQuestionSnapshots: Array.isArray(selection.selectedQuestionSnapshots) ? selection.selectedQuestionSnapshots : item.selectedQuestionSnapshots,
          selectionStatus: String(selection.selectionStatus || item.selectionStatus || "in_progress"),
          completedAt: String(selection.completedAt || ""),
          updatedAt: String(selection.updatedAt || item.updatedAt || ""),
        } : item;
      })
      .filter((item: any) => !item.completedAt)
      .sort((a: any, b: any) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
      .map((item: any) => {
        const selectedQuestionKeys = Array.isArray(item.selectedQuestionKeys)
          ? item.selectedQuestionKeys.map(String)
          : [];
        const flexibleCount =
          String(item?.questionCountMode || "").toLowerCase() === "flexible" ||
          (Number(item?.requiredQuestionCount || 0) <= 0 && Number(item?.maxQuestionCount || 0) > 1);
        const requiredQuestionCount = flexibleCount
          ? 0
          : Math.max(1, Number(item.requiredQuestionCount || item.maxQuestionCount || 1));
        const maxQuestionCount = flexibleCount
          ? Math.max(1, Number(item.maxQuestionCount || 5000))
          : Math.max(requiredQuestionCount, Number(item.maxQuestionCount || requiredQuestionCount));
        const selectedSnapshotMap = new Map<string, any>();
        (Array.isArray(item.selectedQuestionSnapshots) ? item.selectedQuestionSnapshots : []).forEach((question: any) => {
          const key = questionSnapshotIdentity(question);
          if (key) selectedSnapshotMap.set(key, question);
        });
        const effectiveSelectedCount = effectiveSelectedQuestionCount(selectedQuestionKeys, selectedSnapshotMap);
        const { availableQuestionSnapshots: _available, selectedQuestionSnapshots: _selected, ...summary } = item;
        return {
          ...summary,
          selectedQuestionKeys,
          selectedQuestionCount: effectiveSelectedCount,
          requiredQuestionCount,
          maxQuestionCount,
          remainingQuestionCount: flexibleCount
            ? 0
            : Math.max(0, requiredQuestionCount - effectiveSelectedCount),
          canComplete: flexibleCount
            ? effectiveSelectedCount > 0
            : effectiveSelectedCount === requiredQuestionCount,
        };
      });

    response.setHeader("Cache-Control", "private, no-store");
    return response.json(openAssignments);
  });

  app.get("/api/behavior/teacher-links/:token/question-assignments/:assignmentId", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;
    const assignment: any = getDocument("teacherTestAssignments", String(request.params.assignmentId || ""));
    const ownsAssignment = teacherLinkOwnsQuestionAssignment(row, assignment);
    if (!ownsAssignment) return response.status(404).json({ error: "Soru seÃ§imi gÃ¶revi bulunamadÄ±." });

    const selection: any = getDocument("teacherTestAssignmentSelections", String(assignment.id));
    const useSelection = teacherAssignmentSelectionIsCurrent(assignment, selection);
    const detail = useSelection ? {
      ...assignment,
      selectedQuestionKeys: Array.isArray(selection.selectedQuestionKeys) ? selection.selectedQuestionKeys : [],
      selectedQuestionSnapshots: Array.isArray(selection.selectedQuestionSnapshots) ? selection.selectedQuestionSnapshots : assignment.selectedQuestionSnapshots,
      selectionStatus: String(selection.selectionStatus || assignment.selectionStatus || "in_progress"),
      completedAt: String(selection.completedAt || ""),
      updatedAt: String(selection.updatedAt || assignment.updatedAt || ""),
    } : assignment;
    if (detail.completedAt) return response.status(410).json({ error: "Bu soru seÃ§imi gÃ¶revi tamamlanmÄ±ÅŸ." });

    const detailSelectedKeys = Array.isArray(detail.selectedQuestionKeys)
      ? detail.selectedQuestionKeys.map(String)
      : [];
    const flexibleCount =
      String(detail?.questionCountMode || "").toLowerCase() === "flexible" ||
      (Number(detail?.requiredQuestionCount || 0) <= 0 && Number(detail?.maxQuestionCount || 0) > 1);
    const requiredQuestionCount = flexibleCount
      ? 0
      : Math.max(1, Number(detail.requiredQuestionCount || detail.maxQuestionCount || 1));
    const maxQuestionCount = flexibleCount
      ? Math.max(1, Number(detail.maxQuestionCount || 5000))
      : Math.max(requiredQuestionCount, Number(detail.maxQuestionCount || requiredQuestionCount));
    const detailSnapshotMap = new Map<string, any>();
    (Array.isArray(detail.selectedQuestionSnapshots) ? detail.selectedQuestionSnapshots : []).forEach((question: any) => {
      const key = questionSnapshotIdentity(question);
      if (key) detailSnapshotMap.set(key, question);
    });
    const detailEffectiveSelectedCount = effectiveSelectedQuestionCount(detailSelectedKeys, detailSnapshotMap);

    response.setHeader("Cache-Control", "private, no-store");
    return response.json({
      ...detail,
      selectedQuestionKeys: detailSelectedKeys,
      selectedQuestionCount: detailEffectiveSelectedCount,
      requiredQuestionCount,
      maxQuestionCount,
      remainingQuestionCount: flexibleCount
        ? 0
        : Math.max(0, requiredQuestionCount - detailEffectiveSelectedCount),
      canComplete: flexibleCount
        ? detailEffectiveSelectedCount > 0
        : detailEffectiveSelectedCount === requiredQuestionCount,
    });
  });


  app.post("/api/behavior/teacher-links/:token/question-assignments/:assignmentId/selection", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) {
      return response
        .status(access.status)
        .json({ error: access.error });
    }

    const row: any = access.row;
    const assignmentId = String(
      request.params.assignmentId || "",
    ).trim();

    const assignment: any = getDocument(
      "teacherTestAssignments",
      assignmentId,
    );

    const ownsAssignment = teacherLinkOwnsQuestionAssignment(row, assignment);

    if (!ownsAssignment) {
      return response
        .status(404)
        .json({ error: "Soru seÃ§imi gÃ¶revi bulunamadÄ±." });
    }

    // Görev yalnız yönetici tarafından sonlandırılır. Yönetici kapattıktan
    // sonra öğretmenin açık kalmış eski ekranı görevi yeniden açamaz.
    if (String(assignment?.completedAt || "").trim()) {
      return response.status(410).json({
        error: "Bu soru seçimi görevi yönetici tarafından sonlandırılmış.",
        code: "QUESTION_ASSIGNMENT_CLOSED_BY_ADMIN",
      });
    }

    const selectedQuestionKeys: string[] = [
      ...new Set<string>(
        (
          Array.isArray(
            request.body?.selectedQuestionKeys,
          )
            ? request.body.selectedQuestionKeys
            : []
        )
          .map((item: unknown) =>
            String(item || "").trim(),
          )
          .filter(Boolean),
      ),
    ];

    const assignmentAvailableSnapshots = Array.isArray(
      assignment?.availableQuestionSnapshots,
    )
      ? assignment.availableQuestionSnapshots
      : [];

    const assignmentSelectedSnapshots = Array.isArray(
      assignment?.selectedQuestionSnapshots,
    )
      ? assignment.selectedQuestionSnapshots
      : [];

    const allowedSnapshotMap = new Map<string, any>();
    [
      ...assignmentAvailableSnapshots,
      ...assignmentSelectedSnapshots,
    ].forEach((question: any) => {
      const identity = questionSnapshotIdentity(question);
      if (identity && !allowedSnapshotMap.has(identity)) {
        allowedSnapshotMap.set(identity, question);
      }
    });

    const allowedKeys = new Set(allowedSnapshotMap.keys());
    const safeSelectedQuestionKeys = selectedQuestionKeys.filter(
      (key) => allowedKeys.size === 0 || allowedKeys.has(String(key)),
    );
    const effectiveSelectedCount = effectiveSelectedQuestionCount(
      safeSelectedQuestionKeys,
      allowedSnapshotMap,
    );

    const flexibleCount =
      String(assignment?.questionCountMode || "").toLowerCase() === "flexible" ||
      (Number(assignment?.requiredQuestionCount || 0) <= 0 && Number(assignment?.maxQuestionCount || 0) > 1);
    const requiredQuestionCount = flexibleCount
      ? 0
      : Math.max(1, Number(assignment?.requiredQuestionCount || assignment?.maxQuestionCount || 1));
    const maxQuestionCount = flexibleCount
      ? Math.max(1, Number(assignment?.maxQuestionCount || 5000))
      : Math.max(requiredQuestionCount, Number(assignment?.maxQuestionCount || requiredQuestionCount));

    if (effectiveSelectedCount > maxQuestionCount) {
      return response.status(409).json({
        error: `Bu gÃ¶revde en fazla ${maxQuestionCount} soru seÃ§ebilirsiniz.`,
        code: "QUESTION_LIMIT_EXCEEDED",
        selectedQuestionCount: effectiveSelectedCount,
        requiredQuestionCount,
        maxQuestionCount,
      });
    }

    // Öğretmen istemcisi eski bir sürümden selectionStatus="completed"
    // gönderse bile görev kapanmaz. Öğretmen yalnız seçim ilerlemesini kaydeder;
    // görevi sonlandırma yetkisi yöneticidedir.

    const incomingSelectedSnapshots =
      Array.isArray(request.body?.selectedQuestionSnapshots)
        ? request.body.selectedQuestionSnapshots.filter(Boolean)
        : [];

    const incomingSnapshotMap = new Map<string, any>();
    incomingSelectedSnapshots.forEach((question: any) => {
      const identity = questionSnapshotIdentity(question);
      if (identity) incomingSnapshotMap.set(identity, question);
    });

    /*
     * Ã–ÄŸretmenin telefondan seÃ§tiÄŸi sorularÄ±n snapshot'Ä± sunucu tarafÄ±nda
     * gÃ¶rev havuzundan tÃ¼retilir. Soru sonradan arÅŸivlense bile seÃ§im ve
     * gÃ¶rsel/kazanÄ±m bilgisi korunur.
     */
    const selectedQuestionSnapshots = safeSelectedQuestionKeys
      .map(
        (key) =>
          incomingSnapshotMap.get(String(key)) ||
          allowedSnapshotMap.get(String(key)),
      )
      .filter(Boolean)
      .slice(0, 500);

    const incomingRevision = Math.max(
      0,
      Number(request.body?.selectionRevision || 0),
    );

    const previousSelection: any = getDocument(
      "teacherTestAssignmentSelections",
      assignmentId,
    );

    const previousRevision = Math.max(
      Number(previousSelection?.selectionRevision || 0),
      Number(assignment?.selectionRevision || 0),
    );

    /*
     * HÄ±zlÄ± art arda tÄ±klamalarda eski istek yeni seÃ§imi ezmesin.
     */
    if (
      incomingRevision > 0 &&
      incomingRevision < previousRevision
    ) {
      return response.json({
        success: true,
        stale: true,
        selectedQuestionKeys:
          previousSelection?.selectedQuestionKeys ||
          assignment?.selectedQuestionKeys ||
          [],
        selectionRevision: previousRevision,
      });
    }

    const now = new Date().toISOString();
    const selectionRevision =
      incomingRevision > 0
        ? incomingRevision
        : previousRevision + 1;

    const selectionRecord = {
      id: assignmentId,
      assignmentId,
      testId: String(assignment.testId || ""),
      teacherId: String(
        assignment.teacherId || row.teacherId || "",
      ),
      teacherName: String(
        assignment.teacherName || row.teacherName || "",
      ),
      selectedQuestionKeys: safeSelectedQuestionKeys,
      selectedQuestionSnapshots,
      assignmentCycleId: String(assignment?.assignmentCycleId || ""),
      selectionStatus: "in_progress",
      selectionRevision,
      completedAt: "",
      updatedAt: now,
      createdAt: String(
        previousSelection?.createdAt || now,
      ),
    };

    /*
     * AyrÄ±, kÃ¼Ã§Ã¼k seÃ§im kaydÄ±:
     * Telefonda tÃ¼m bÃ¼yÃ¼k gÃ¶rev/soru havuzu tekrar gÃ¶nderilmez.
     */
    upsertDocument(
      "teacherTestAssignmentSelections",
      assignmentId,
      selectionRecord,
    );

    /*
     * YÃ¶netici Test Paneli teacherTestAssignments koleksiyonunu
     * doÄŸrudan okuyabildiÄŸi iÃ§in aynÄ± seÃ§imi ana gÃ¶reve de
     * sunucu iÃ§inde, aÄŸdan bÃ¼yÃ¼k payload taÅŸÄ±madan yansÄ±tÄ±rÄ±z.
     */
    upsertDocument(
      "teacherTestAssignments",
      assignmentId,
      {
        ...assignment,
        selectedQuestionKeys: safeSelectedQuestionKeys,
        selectedQuestionSnapshots,
        selectionStatus:
          selectionRecord.selectionStatus,
        selectionRevision,
        questionUsageLocked: true,
        questionPoolLocked:
          safeSelectedQuestionKeys.length > 0
            ? true
            : Boolean(assignment?.questionPoolLocked),
        completedAt: "",
        updatedAt: now,
      },
    );

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      success: true,
      selectedQuestionKeys: safeSelectedQuestionKeys,
      selectedQuestionCount: effectiveSelectedCount,
      requiredQuestionCount,
      maxQuestionCount,
      remainingQuestionCount: flexibleCount
        ? 0
        : Math.max(0, requiredQuestionCount - effectiveSelectedCount),
      canComplete: flexibleCount
        ? effectiveSelectedCount > 0
        : effectiveSelectedCount === requiredQuestionCount,
      selectionStatus: "in_progress",
      completedAt: "",
      selectionRevision,
      updatedAt: now,
    });
  });


  const compactTeacherAssignmentCourseId = (value: unknown) => {
    const raw = String(value || "").trim();
    const matched = raw.match(/^CURR-(?:9|10|11|12)-(.+)$/i);
    return String(matched?.[1] || raw).trim();
  };

  const patchTeacherAssignmentQuestionSnapshot = (
    rows: any,
    questionId: string,
    patch: Record<string, any> | null,
  ) => (Array.isArray(rows) ? rows : [])
    .map((question: any) => {
      if (questionSnapshotIdentity(question) !== questionId) return question;
      return patch ? { ...question, ...patch } : null;
    })
    .filter(Boolean);

  const removeQuestionFromTeacherAssignmentState = (
    assignment: any,
    assignmentId: string,
    questionId: string,
  ) => {
    const rawSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
    const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
      ? rawSelection
      : null;

    const sourceKeys = Array.isArray(selection?.selectedQuestionKeys)
      ? selection.selectedQuestionKeys
      : Array.isArray(assignment?.selectedQuestionKeys)
        ? assignment.selectedQuestionKeys
        : [];
    const sourceSnapshots = Array.isArray(selection?.selectedQuestionSnapshots)
      ? selection.selectedQuestionSnapshots
      : Array.isArray(assignment?.selectedQuestionSnapshots)
        ? assignment.selectedQuestionSnapshots
        : [];

    const nextKeys = sourceKeys.map(String).filter((key: string) => key !== questionId);
    const nextSnapshots = patchTeacherAssignmentQuestionSnapshot(sourceSnapshots, questionId, null);
    const now = new Date().toISOString();
    const nextRevision = Math.max(
      Number(selection?.selectionRevision || 0),
      Number(assignment?.selectionRevision || 0),
    ) + 1;

    const baseSelection = selection || {
      id: assignmentId,
      assignmentId,
      testId: String(assignment?.testId || ""),
      teacherId: String(assignment?.teacherId || ""),
      teacherName: String(assignment?.teacherName || ""),
      createdAt: now,
    };

    upsertDocument("teacherTestAssignmentSelections", assignmentId, {
      ...baseSelection,
      assignmentCycleId: String(assignment?.assignmentCycleId || ""),
      selectedQuestionKeys: nextKeys,
      selectedQuestionSnapshots: nextSnapshots,
      selectionStatus: "in_progress",
      selectionRevision: nextRevision,
      completedAt: "",
      updatedAt: now,
    });

    upsertDocument("teacherTestAssignments", assignmentId, {
      ...assignment,
      availableQuestionSnapshots: patchTeacherAssignmentQuestionSnapshot(
        assignment?.availableQuestionSnapshots,
        questionId,
        null,
      ),
      selectedQuestionKeys: nextKeys,
      selectedQuestionSnapshots: nextSnapshots,
      selectionStatus: "in_progress",
      selectionRevision: nextRevision,
      completedAt: "",
      questionPoolLocked: nextKeys.length > 0,
      questionUsageLocked: nextKeys.length > 0,
      updatedAt: now,
    });

    return { nextKeys, nextSnapshots, nextRevision };
  };

  app.patch(
    "/api/behavior/teacher-links/:token/question-assignments/:assignmentId/questions/:questionId/hierarchy",
    (request, response) => {
      try {
        const token = String(request.params.token || "");
        const access = requireBehaviorTeacherLink(token);
        if ("error" in access) return response.status(access.status).json({ error: access.error });

        const row: any = access.row;
        const assignmentId = String(request.params.assignmentId || "").trim();
        const questionId = String(request.params.questionId || "").trim();
        const assignment: any = getDocument("teacherTestAssignments", assignmentId);
        const ownsAssignment = teacherLinkOwnsQuestionAssignment(row, assignment);
        if (!ownsAssignment) return response.status(404).json({ error: "Soru seçimi görevi bulunamadı." });

        const question = allQuestionRecords().find(
          (item: any) => String(item.id || "") === questionId && String(item.status || "active") === "active",
        );
        if (!question) return response.status(404).json({ error: "Soru bankası kaydı bulunamadı." });

        const assignmentGrade = Number(assignment?.grade || assignment?.gradeLevel || 0);
        if (assignmentGrade && Number(question.grade || 0) && assignmentGrade !== Number(question.grade || 0)) {
          return response.status(403).json({ error: "Bu soru görevin sınıf düzeyine ait değil." });
        }
        const assignmentCourseId = compactTeacherAssignmentCourseId(assignment?.courseId);
        const questionCourseId = compactTeacherAssignmentCourseId(question?.courseId);
        if (assignmentCourseId && questionCourseId && assignmentCourseId !== questionCourseId) {
          return response.status(403).json({ error: "Bu soru görevin dersine ait değil." });
        }

        const targetUnitId = String(request.body?.unitId || "").trim();
        const targetTopicId = String(request.body?.topicId || "").trim();
        const targetOutcomeId = String(request.body?.outcomeId || "").trim();
        if (!targetUnitId || !targetTopicId || !targetOutcomeId) {
          return response.status(400).json({ error: "Hedef ünite, konu ve kazanım zorunludur." });
        }
        if (
          String(question.unitId || "") !== targetUnitId ||
          String(question.topicId || "") !== targetTopicId
        ) {
          return response.status(409).json({
            error: "Soru yalnız aynı konunun başka bir kazanımına taşınabilir.",
          });
        }

        if (String(question.outcomeId || "") === targetOutcomeId) {
          return response.json({ success: true, unchanged: true, question });
        }

        const maxRow = sqlite.prepare(`
          SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
          FROM question_bank_questions
          WHERE status = 'active'
            AND grade = ?
            AND course_id = ?
            AND unit_id = ?
            AND topic_id = ?
            AND outcome_id = ?
        `).get(
          Number(question.grade || 0),
          String(question.courseId || ""),
          targetUnitId,
          targetTopicId,
          targetOutcomeId,
        ) as any;

        const order = Math.max(1, Number(maxRow?.maxOrder || 0) + 1);
        const answer = /^[A-E]$/.test(String(question.answer || "").toUpperCase())
          ? String(question.answer).toUpperCase()
          : "A";
        const questionCode = `${targetOutcomeId}_${String(order).padStart(3, "0")}_${answer}`;
        const now = new Date().toISOString();
        const patch = {
          unitId: targetUnitId,
          unitName: String(request.body?.unitName || "").trim(),
          topicId: targetTopicId,
          topicName: String(request.body?.topicName || "").trim(),
          outcomeId: targetOutcomeId,
          outcomeName: String(request.body?.outcomeName || "").trim(),
          questionCode,
          code: questionCode,
          order,
        };

        const nextQuestion = {
          ...question,
          questionCode,
          unitId: targetUnitId,
          topicId: targetTopicId,
          outcomeId: targetOutcomeId,
          scopeLevel: "outcome",
          order,
          updatedAt: now,
        };
        persistQuestionBankRecord(nextQuestion);
        syncQuestionBankIndexRecord(nextQuestion);
        recordQuestionAudit("teacher-mobile-hierarchy-change", questionId, {
          assignmentId,
          teacherId: String(row.teacherId || ""),
          fromOutcomeId: String(question.outcomeId || ""),
          toOutcomeId: targetOutcomeId,
        });

        // Aynı soru başka açık görevlerde de snapshot olarak bulunabilir. Soru
        // müfredatta taşındığında eski kazanım bilgisinin başka öğretmen
        // görevlerinde yaşamaması için bütün snapshot aynalarını eşitleriz.
        listDocuments("teacherTestAssignments").forEach((task: any) => {
          const nextAvailable = patchTeacherAssignmentQuestionSnapshot(
            task?.availableQuestionSnapshots,
            questionId,
            patch,
          );
          const nextSelected = patchTeacherAssignmentQuestionSnapshot(
            task?.selectedQuestionSnapshots,
            questionId,
            patch,
          );
          const changed =
            JSON.stringify(nextAvailable) !== JSON.stringify(Array.isArray(task?.availableQuestionSnapshots) ? task.availableQuestionSnapshots : []) ||
            JSON.stringify(nextSelected) !== JSON.stringify(Array.isArray(task?.selectedQuestionSnapshots) ? task.selectedQuestionSnapshots : []);
          if (changed) {
            upsertDocument("teacherTestAssignments", String(task.id || task.__documentId), {
              ...task,
              availableQuestionSnapshots: nextAvailable,
              selectedQuestionSnapshots: nextSelected,
              updatedAt: now,
            });
          }
        });

        listDocuments("teacherTestAssignmentSelections").forEach((selection: any) => {
          const nextSelected = patchTeacherAssignmentQuestionSnapshot(
            selection?.selectedQuestionSnapshots,
            questionId,
            patch,
          );
          if (JSON.stringify(nextSelected) !== JSON.stringify(Array.isArray(selection?.selectedQuestionSnapshots) ? selection.selectedQuestionSnapshots : [])) {
            upsertDocument("teacherTestAssignmentSelections", String(selection.id || selection.assignmentId), {
              ...selection,
              selectedQuestionSnapshots: nextSelected,
              updatedAt: now,
            });
          }
        });

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          question: {
            id: questionId,
            questionCode,
            unitId: targetUnitId,
            topicId: targetTopicId,
            outcomeId: targetOutcomeId,
            order,
          },
        });
      } catch (error) {
        console.error("Öğretmen mobil soru kazanımı değiştirme hatası:", error);
        return response.status(500).json({
          error: error instanceof Error ? error.message : "Soru başka kazanıma taşınamadı.",
        });
      }
    },
  );

  app.delete(
    "/api/behavior/teacher-links/:token/question-assignments/:assignmentId/questions/:questionId/outside-curriculum",
    (request, response) => {
      try {
        const token = String(request.params.token || "");
        const access = requireBehaviorTeacherLink(token);
        if ("error" in access) return response.status(access.status).json({ error: access.error });
        const row: any = access.row;
        const assignmentId = String(request.params.assignmentId || "").trim();
        const questionId = String(request.params.questionId || "").trim();
        const assignment: any = getDocument("teacherTestAssignments", assignmentId);
        const ownsAssignment = teacherLinkOwnsQuestionAssignment(row, assignment);
        if (!ownsAssignment) return response.status(404).json({ error: "Soru seçimi görevi bulunamadı." });

        const question = allQuestionRecords().find(
          (item: any) => String(item.id || "") === questionId && String(item.status || "active") === "active",
        );
        if (!question) return response.status(404).json({ error: "Soru bankası kaydı bulunamadı." });

        const assignmentGrade = Number(assignment?.grade || assignment?.gradeLevel || 0);
        const assignmentCourseId = compactTeacherAssignmentCourseId(assignment?.courseId);
        const questionCourseId = compactTeacherAssignmentCourseId(question?.courseId);
        if (
          (assignmentGrade && Number(question.grade || 0) && assignmentGrade !== Number(question.grade || 0)) ||
          (assignmentCourseId && questionCourseId && assignmentCourseId !== questionCourseId)
        ) {
          return response.status(403).json({ error: "Bu soru ilgili öğretmen görevinin kapsamına ait değil." });
        }

        const deletion = deleteCanonicalQuestionById(questionId);
        if (!deletion.found) return response.status(404).json({ error: "Soru bankası kaydı bulunamadı." });

        // Aktif soru bankasından çıkarılan soru başka açık öğretmen görevlerinde
        // seçili/uygun görünmeye devam etmesin. Tamamlanmış tarihsel görevleri
        // değiştirmeden yalnız açık görevlerin seçimlerini temizleriz.
        let state = removeQuestionFromTeacherAssignmentState(assignment, assignmentId, questionId);
        listDocuments("teacherTestAssignments").forEach((task: any) => {
          const taskId = String(task.id || task.__documentId || "").trim();
          if (!taskId || taskId === assignmentId || task?.completedAt) return;
          const keys = Array.isArray(task?.selectedQuestionKeys) ? task.selectedQuestionKeys.map(String) : [];
          const available = Array.isArray(task?.availableQuestionSnapshots) ? task.availableQuestionSnapshots : [];
          const selected = Array.isArray(task?.selectedQuestionSnapshots) ? task.selectedQuestionSnapshots : [];
          const containsQuestion =
            keys.includes(questionId) ||
            [...available, ...selected].some((snapshot: any) => questionSnapshotIdentity(snapshot) === questionId);
          if (containsQuestion) removeQuestionFromTeacherAssignmentState(task, taskId, questionId);
        });
        recordQuestionAudit("teacher-mobile-outside-curriculum", questionId, {
          assignmentId,
          teacherId: String(row.teacherId || ""),
        });

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          archived: true,
          questionId,
          selectedQuestionKeys: state.nextKeys,
          selectedQuestionCount: state.nextKeys.length,
          selectionRevision: state.nextRevision,
        });
      } catch (error) {
        console.error("Öğretmen mobil kazanım dışı soru hatası:", error);
        return response.status(500).json({
          error: error instanceof Error ? error.message : "Soru kazanım dışına çıkarılamadı.",
        });
      }
    },
  );


  app.post(
    "/api/question-bank/teacher-assignments/remove-selected-question-by-context",
    (request, response) => {
      try {
        const questionId = String(request.body?.questionId || "").trim();
        const requestedAssignmentId = String(request.body?.assignmentId || "").trim();
        const examId = String(request.body?.examId || "").trim();
        const examCode = String(request.body?.examCode || "").trim();
        const subjectName = String(request.body?.subjectName || "").trim();
        if (!questionId) {
          return response.status(400).json({ error: "Soru kimliği zorunludur." });
        }

        const examKeys = new Set([examId, examCode].filter(Boolean));
        const subjectKey = normalizeTeacherValue(subjectName);
        const assignments = listDocuments("teacherTestAssignments").filter((assignment: any) => {
          const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
          if (requestedAssignmentId && assignmentId === requestedAssignmentId) return true;

          const linked = [assignment?.testId, assignment?.examId, assignment?.examCode]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          const sameExam = examKeys.size > 0 && linked.some((value) => examKeys.has(value));
          if (!sameExam) return false;

          if (!subjectKey) return true;
          const assignmentSubject = normalizeTeacherValue(
            assignment?.courseName || assignment?.subject || assignment?.lessonName || assignment?.courseId || "",
          );
          return assignmentSubject === subjectKey;
        });

        const touched: string[] = [];
        for (const assignment of assignments) {
          const assignmentId = String(assignment?.id || assignment?.__documentId || "").trim();
          if (!assignmentId) continue;
          const rawSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
          const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
            ? rawSelection
            : null;
          const keys = Array.isArray(selection?.selectedQuestionKeys)
            ? selection.selectedQuestionKeys.map(String)
            : Array.isArray(assignment?.selectedQuestionKeys)
              ? assignment.selectedQuestionKeys.map(String)
              : [];
          const snapshots = Array.isArray(selection?.selectedQuestionSnapshots)
            ? selection.selectedQuestionSnapshots
            : Array.isArray(assignment?.selectedQuestionSnapshots)
              ? assignment.selectedQuestionSnapshots
              : [];
          const snapshotMatches = (snapshot: any) => {
            const identities = [
              questionSnapshotIdentity(snapshot),
              snapshot?.id,
              snapshot?.questionId,
              snapshot?.question_id,
              snapshot?.key,
              snapshot?.questionKey,
              snapshot?.questionCode,
              snapshot?.code,
            ]
              .map((value) => String(value || "").trim())
              .filter(Boolean);
            return identities.includes(questionId);
          };
          const contains =
            keys.includes(questionId) ||
            snapshots.some((snapshot: any) => snapshotMatches(snapshot));
          if (!contains) continue;

          removeQuestionFromTeacherAssignmentState(assignment, assignmentId, questionId);
          touched.push(assignmentId);
        }

        response.setHeader("Cache-Control", "no-store");
        return response.json({
          success: true,
          removedQuestionId: questionId,
          touchedAssignmentIds: touched,
          touchedCount: touched.length,
        });
      } catch (error) {
        console.error("Bağlama göre öğretmen seçimi silme hatası:", error);
        return response.status(500).json({
          error: error instanceof Error ? error.message : "Öğretmen seçimi görevden çıkarılamadı.",
        });
      }
    },
  );

  app.post(
    "/api/question-bank/teacher-assignments/:assignmentId/remove-selected-question",
    (request, response) => {
      try {
        const assignmentId = String(request.params.assignmentId || "").trim();
        const questionId = String(request.body?.questionId || "").trim();
        if (!assignmentId || !questionId) {
          return response.status(400).json({
            error: "Görev kimliği ve soru kimliği zorunludur.",
          });
        }

        const assignment: any = getDocument("teacherTestAssignments", assignmentId);
        if (!assignment) {
          return response.status(404).json({ error: "Öğretmen soru görevi bulunamadı." });
        }

        const rawSelection: any = getDocument("teacherTestAssignmentSelections", assignmentId);
        const selection: any = teacherAssignmentSelectionIsCurrent(assignment, rawSelection)
          ? rawSelection
          : null;

        const questionMatches = (question: any) => {
          const identities = [
            questionSnapshotIdentity(question),
            question?.id,
            question?.questionId,
            question?.question_id,
            question?.key,
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          return identities.includes(questionId);
        };

        const sourceKeys = Array.isArray(selection?.selectedQuestionKeys)
          ? selection.selectedQuestionKeys
          : Array.isArray(assignment?.selectedQuestionKeys)
            ? assignment.selectedQuestionKeys
            : [];
        const sourceSnapshots = Array.isArray(selection?.selectedQuestionSnapshots)
          ? selection.selectedQuestionSnapshots
          : Array.isArray(assignment?.selectedQuestionSnapshots)
            ? assignment.selectedQuestionSnapshots
            : [];

        const matchingSnapshots = sourceSnapshots.filter((question: any) => questionMatches(question));
        const keysToRemove = new Set<string>([questionId]);
        matchingSnapshots.forEach((question: any) => {
          [
            questionSnapshotIdentity(question),
            question?.id,
            question?.questionId,
            question?.question_id,
            question?.key,
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .forEach((value) => keysToRemove.add(value));
        });

        const nextKeys = sourceKeys
          .map(String)
          .filter((key: string) => !keysToRemove.has(key));
        const nextSnapshots = sourceSnapshots.filter((question: any) => !questionMatches(question));
        const now = new Date().toISOString();
        const nextRevision = Math.max(
          Number(selection?.selectionRevision || 0),
          Number(assignment?.selectionRevision || 0),
        ) + 1;

        const baseSelection = selection || {
          id: assignmentId,
          assignmentId,
          testId: String(assignment?.testId || ""),
          teacherId: String(assignment?.teacherId || ""),
          teacherName: String(assignment?.teacherName || ""),
          createdAt: now,
        };

        upsertDocument("teacherTestAssignmentSelections", assignmentId, {
          ...baseSelection,
          assignmentCycleId: String(assignment?.assignmentCycleId || ""),
          selectedQuestionKeys: nextKeys,
          selectedQuestionSnapshots: nextSnapshots,
          selectionStatus: "in_progress",
          selectionRevision: nextRevision,
          completedAt: "",
          updatedAt: now,
        });

        upsertDocument("teacherTestAssignments", assignmentId, {
          ...assignment,
          selectedQuestionKeys: nextKeys,
          selectedQuestionSnapshots: nextSnapshots,
          selectionStatus: "in_progress",
          selectionRevision: nextRevision,
          completedAt: "",
          questionPoolLocked: nextKeys.length > 0,
          questionUsageLocked: nextKeys.length > 0,
          updatedAt: now,
        });

        return response.json({
          success: true,
          assignmentId,
          removedQuestionId: questionId,
          selectedQuestionKeys: nextKeys,
          selectedQuestionCount: nextKeys.length,
          selectionStatus: "in_progress",
          completedAt: "",
          selectionRevision: nextRevision,
        });
      } catch (error) {
        return response.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Öğretmen seçimi sınavdan çıkarılamadı.",
        });
      }
    },
  );

  app.get("/api/behavior/teacher-links/:token/schedule", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const row: any = access.row;
    const scheduleContext = resolveTeacherScheduleContext(row);
    const now = teacherNow();
    const active: any = resolveTeacherActiveLesson(row, scheduleContext);
    const notes = teacherScheduleNotes(row, token);
    const reminders = active.active
      ? notes.filter((note: any) => String(note?.reminderDate || "") <= now.date)
      : [];

    response.setHeader("Cache-Control", "no-store");
    return response.json({
      now,
      active,
      lessonTimes: scheduleContext.lessonTimes,
      days: teacherWeeklySchedule(row, scheduleContext),
      notes: notes.map((note: any) => ({
        id: String(note.id),
        text: String(note.text || ""),
        sourceDay: String(note.sourceDay || ""),
        sourceHour: Number(note.sourceHour || 0),
        reminderDay: String(note.reminderDay || ""),
        reminderHour: Number(note.reminderHour || 0),
        reminderDate: String(note.reminderDate || ""),
        createdAt: String(note.createdAt || ""),
      })),
      reminders: reminders.map((note: any) => ({
        id: String(note.id),
        text: String(note.text || ""),
        reminderDay: String(note.reminderDay || ""),
        reminderHour: Number(note.reminderHour || 0),
      })),
    });
  });

  app.post("/api/behavior/teacher-links/:token/schedule/notes", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const row: any = access.row;
    const sourceDay = String(request.body?.day || "").trim();
    const sourceHour = Number(request.body?.hour || 0);
    const text = String(request.body?.text || "").trim();
    const context = resolveTeacherScheduleContext(row);
    const validHour = context.lessonTimes.some((slot) => slot.hour === sourceHour);
    if (!TEACHER_SCHEDULE_DAYS.includes(sourceDay) || !validHour || !text || text.length > 1000) {
      return response.status(400).json({ error: "Not bilgileri geÃ§ersiz." });
    }

    const reminder = nextTeacherLesson(row, context);
    if (!reminder) return response.status(409).json({ error: "HatÄ±rlatma iÃ§in sonraki planlÄ± ders bulunamadÄ±." });

    const createdAt = new Date().toISOString();
    const id = `teacher-schedule-note-${Date.now()}-${randomBehaviorSecret(8)}`;
    const note = {
      id,
      teacherId: String(row.teacherId || ""),
      teacherName: String(row.teacherName || ""),
      linkToken: token,
      text,
      sourceDay,
      sourceHour,
      reminderDay: reminder.day,
      reminderHour: reminder.hour,
      reminderDate: reminder.date,
      reminderCourseName: String(reminder.assignment?.courseName || ""),
      reminderClassroomName: String(reminder.assignment?.classroomName || ""),
      status: "pending",
      createdAt,
    };
    upsertDocument(TEACHER_SCHEDULE_NOTES, id, note);
    return response.status(201).json({ success: true, note });
  });

  app.post("/api/behavior/teacher-links/:token/schedule/notes/:noteId/dismiss", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;
    const id = String(request.params.noteId || "");
    const note: any = getDocument(TEACHER_SCHEDULE_NOTES, id);
    if (!note || String(note.teacherId || "") !== String(row.teacherId || "") || String(note.linkToken || "") !== token) {
      return response.status(404).json({ error: "HatÄ±rlatma notu bulunamadÄ±." });
    }
    upsertDocument(TEACHER_SCHEDULE_NOTES, id, { ...note, status: "dismissed", dismissedAt: new Date().toISOString() });
    return response.json({ success: true });
  });

  app.get("/api/behavior/teacher-links/:token/attendance/active", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;
    const active: any = resolveTeacherActiveLesson(row, resolveTeacherScheduleContext(row));

    response.setHeader("Cache-Control", "no-store");
    if (!active.active) return response.json(active);

    const students = teacherClassStudents(String(active.classroomId || ""), String(active.classroomName || ""), row.schoolId)
      .sort((a: any, b: any) =>
        Number(String(a.number || a.studentNumber || "").replace(/\D/g, "") || 999999)
        - Number(String(b.number || b.studentNumber || "").replace(/\D/g, "") || 999999)
        || String(a.name || "").localeCompare(String(b.name || ""), "tr-TR")
      )
      .map((student: any) => ({
        id: String(student.id),
        name: String(student.name || student.fullName || ""),
        number: String(student.number || student.studentNumber || student.schoolNumber || ""),
        classroom: String(student.classroom || student.className || student.branch || active.classroomName || ""),
      }));

    return response.json({ ...active, teacherId: row.teacherId, teacherName: row.teacherName, students });
  });

  app.post("/api/behavior/teacher-links/:token/attendance", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;
    const active: any = resolveTeacherActiveLesson(row, resolveTeacherScheduleContext(row));
    if (!active.active) return response.status(409).json({
      error: "Åu anda aktif dersiniz bulunmuyor. Yoklama yalnÄ±z ders sÃ¼resi iÃ§inde kaydedilebilir."
    });

    const selectedIds = [...new Set(
      (Array.isArray(request.body?.absentStudentIds) ? request.body.absentStudentIds : [])
        .map((item: unknown) => String(item || "").trim()).filter(Boolean)
    )];

    const classStudents = teacherClassStudents(String(active.classroomId || ""), String(active.classroomName || ""), row.schoolId);
    const byId = new Map(classStudents.map((student: any) => [String(student.id), student]));
    if (selectedIds.some((id) => !byId.has(id))) {
      return response.status(400).json({ error: "SeÃ§ilen Ã¶ÄŸrencilerden biri aktif ders sÄ±nÄ±fÄ±nda bulunmuyor." });
    }

    const entries = selectedIds.map((studentId) => {
      const student: any = byId.get(studentId);
      return {
        studentId,
        studentName: String(student?.name || student?.fullName || ""),
        lessons: [...active.lessons],
      };
    });

    const firstLesson = Number(active.lessons?.[0] || active.currentLesson || 0);
    const safeClass = String(active.classroomId || active.classroomName).replace(/[^\p{L}\p{N}_-]/gu, "_");
    const id = `teacher_${active.date}_${safeClass}_${row.teacherId}_${firstLesson}`;
    const previous: any = listDocuments(TEACHER_ATTENDANCE_SUBMISSIONS)
      .find((item: any) => String(item.id) === id);
    const nowIso = new Date().toISOString();

    const record = {
      id,
      date: active.date,
      classroomId: active.classroomId,
      classroomName: active.classroomName,
      courseName: active.courseName,
      lessons: active.lessons,
      currentLesson: active.currentLesson,
      entries,
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      linkToken: token,
      source: "teacher-link-attendance",
      status: "pending",
      submittedAt: nowIso,
      revision: Number(previous?.revision || 0) + 1,
      approvedAt: null,
      approvedById: null,
    };
    upsertDocument(TEACHER_ATTENDANCE_SUBMISSIONS, id, record);
    return response.json({ success: true, record });
  });

  app.get("/api/behavior/teacher-links/:token/manifest.webmanifest", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const row: any = access.row;
    const profile: any = resolveEnstituStaffProfile(row);
    const role = String(profile?.role || profile?.staffRole || "TEACHER").toUpperCase();
    const isAdmin = role === "ADMIN";
    const isGuidance = role === "GUIDANCE";
    const personName = String(row?.teacherName || row?.fullName || "").trim();
    const startUrl = `/t/${encodeURIComponent(token)}`;
    const themeColor = "#ffffff";
    const roleLabel = isAdmin ? "Y\u00f6netici" : isGuidance ? "Rehberlik" : "\u00d6\u011fretmen";

    response.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    return response.json({
      id: startUrl,
      name: `e-Nstit\u00fc ${roleLabel}${personName ? ` - ${personName}` : ""}`,
      short_name: "e-Nstit\u00fc",
      description: isAdmin
        ? "Ordu Lisesi y\u00f6netici mobil uygulamas\u0131"
        : "Ordu Lisesi e-Nstit\u00fc mobil uygulamas\u0131",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      display_override: ["standalone"],
      orientation: "portrait",
      background_color: themeColor,
      theme_color: themeColor,
      launch_handler: { client_mode: "navigate-existing" },
      icons: [
        { src: "/enstitu-pwa-icon-v2-192.png?v=35", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/enstitu-pwa-icon-v2.png?v=35", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    });
  });

  app.post("/api/behavior/teacher-links/:token/submissions", (request, response) => {
    const token = String(request.params.token || "");
    const records = Array.isArray(request.body?.records) ? request.body.records : [];
    if (!token || records.length < 1 || records.length > 100) {
      return response.status(400).json({ error: "DavranÄ±ÅŸ kayÄ±tlarÄ± geÃ§ersiz." });
    }
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;

    records.forEach((record: any, index: number) => {
      const createdAt = Number(record?.createdAt || Date.now() + index);
      const id = String(record?.id || `teacher-${createdAt}-${randomBehaviorSecret(8)}`);
      upsertDocument(BEHAVIOR_SUBMISSIONS, id, {
        ...record,
        id,
        linkToken: token,
        schoolId: row.schoolId,
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        source: records.length > 1 ? "teacher-link-bulk" : "teacher-link",
        createdAt,
        submittedAt: new Date().toISOString(),
      });
    });

    broadcastBehaviorChanged("submission");
    return response.status(201).json({ ok: true, count: records.length });
  });

  app.get("/api/behavior/teacher-submissions", (request, response) => {
    const schoolId = String(request.query.schoolId || "").trim();
    if (!schoolId) return response.status(400).json({ error: "schoolId gerekli." });
    const items = listDocuments(BEHAVIOR_SUBMISSIONS)
      .filter((item: any) => String(item.schoolId) === schoolId)
      .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return response.json({ items });
  });

  app.delete("/api/behavior/teacher-submissions/:id", (request, response) => {
    deleteDocument(BEHAVIOR_SUBMISSIONS, String(request.params.id || ""));
    broadcastBehaviorChanged("delete");
    return response.status(204).end();
  });

  const normalizeHomeworkStatusValue = (value: unknown) => {
    const raw = String(value || "").trim();
    if (raw === "KÄ±smi Eksik") return "Kısmi Eksik";
    if (raw === "GeliÅŸtirilmeli") return "Geliştirilmeli";
    return raw;
  };

  const homeworkStatusSchema = z.preprocess(
    normalizeHomeworkStatusValue,
    z.enum(["Tam", "Kısmi Eksik", "Geliştirilmeli", "Teslim Edilmedi"]),
  );

  const teacherAssignmentMatchesCatalog = (row: any, assignment: any) => {
    const teacherId = String(row?.teacherId || row?.id || "").trim();
    const teacherName = normalizeTeacherValue(row?.teacherName || row?.name);
    const ids = [assignment?.teacherId, assignment?.teacherId2]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (teacherId && ids.includes(teacherId)) return true;
    const names = [assignment?.teacherName, assignment?.teacherName2]
      .map(normalizeTeacherValue)
      .filter(Boolean);
    return Boolean(teacherName && names.includes(teacherName));
  };

  const teacherHomeworkAssignments = (row: any) => {
    const context = resolveTeacherScheduleContext(row);
    const scheduleDays = teacherWeeklySchedule(row, context);
    const byKey = new Map<string, any>();

    const mergeAssignment = (candidate: any) => {
      const classroomId = String(candidate?.classroomId || "").trim();
      const classroom = String(candidate?.classroom || candidate?.classroomName || "").trim();
      const courseName = String(candidate?.courseName || candidate?.course || "").trim();
      if (!classroom || !courseName) return;
      const key = `${normalizeTeacherValue(classroom)}|${normalizeTeacherValue(courseName)}`;
      const existing = byKey.get(key) || {
        classroomId,
        classroom,
        courseName,
        studentIds: [],
        slots: [],
        nextOccurrences: [],
      };
      if (!existing.classroomId && classroomId) existing.classroomId = classroomId;
      const ids = Array.isArray(candidate?.studentIds) ? candidate.studentIds.map(String).filter(Boolean) : [];
      existing.studentIds = [...new Set([...(existing.studentIds || []), ...ids])];
      byKey.set(key, existing);
    };

    const seenClassrooms = new Set<string>();
    for (const classroom of context.classroomsById.values()) {
      const classId = String((classroom as any)?.id || "").trim();
      const className = String((classroom as any)?.name || (classroom as any)?.className || "").trim();
      const classKey = classId || normalizeTeacherValue(className);
      if (!classKey || seenClassrooms.has(classKey)) continue;
      seenClassrooms.add(classKey);
      const assignedCourses = Array.isArray((classroom as any)?.assignedCourses)
        ? (classroom as any).assignedCourses
        : [];
      for (const assignment of assignedCourses) {
        if (!teacherAssignmentMatchesCatalog(row, assignment)) continue;
        mergeAssignment({
          classroomId: classId,
          classroom: className,
          courseName: assignment?.courseName || assignment?.name || assignment?.course,
          studentIds: assignment?.studentIds,
        });
      }
    }

    // Katalogun classroom.assignedCourses tarafı eski/yarım kalmışsa, courses
    // koleksiyonundaki öğretmen-sınıf kaydını ikinci güvenli kaynak olarak kullan.
    for (const course of teacherScopedRows(row?.schoolId || "school-main", "courses", "school_courses")) {
      if (!teacherAssignmentMatchesCatalog(row, course)) continue;
      const classroomName = String(course?.classroom || course?.classroomName || "").trim();
      const classroom: any = context.classroomsByName.get(normalizeTeacherValue(classroomName));
      mergeAssignment({
        classroomId: String(classroom?.id || course?.classroomId || "").trim(),
        classroom: classroomName || String(classroom?.name || classroom?.className || "").trim(),
        courseName: course?.name || course?.courseName || course?.course,
        studentIds: course?.studentIds,
      });
    }

    // Programda bulunan dersleri de ekle. Bu, eski kataloglarda assignedCourses
    // eksik olsa bile öğretmenin gerçek programını ve ödev sınıfını görünür tutar.
    for (const day of scheduleDays) {
      for (const slot of day.slots || []) {
        if (!slot?.assignment) continue;
        mergeAssignment({
          classroomId: slot.assignment.classroomId,
          classroom: slot.assignment.classroomName,
          courseName: slot.assignment.courseName,
        });
      }
    }

    // Her sınıf/ders için programdaki gerçek gün-saatleri bağla.
    for (const assignment of byKey.values()) {
      const slots: any[] = [];
      for (const day of scheduleDays) {
        for (const slot of day.slots || []) {
          const current = slot?.assignment;
          if (!current) continue;
          const sameClass = normalizeTeacherValue(current.classroomName || current.classroomId)
            === normalizeTeacherValue(assignment.classroom || assignment.classroomId);
          const sameCourse = normalizeTeacherValue(current.courseName)
            === normalizeTeacherValue(assignment.courseName);
          if (!sameClass || !sameCourse) continue;
          slots.push({ day: day.day, hour: slot.hour, start: slot.start, end: slot.end });
        }
      }
      assignment.slots = slots;
    }

    return [...byKey.values()].sort((a, b) =>
      String(a.classroom).localeCompare(String(b.classroom), "tr-TR", { numeric: true })
      || String(a.courseName).localeCompare(String(b.courseName), "tr-TR"),
    );
  };

  const teacherLinkStudentsForHomework = (row: any, classroom: string, studentIds: string[] = []) => {
    const classKey = normalizeTeacherValue(classroom);
    const allowedIds = new Set((studentIds || []).map(String).filter(Boolean));
    const rows = Array.isArray(row?.students) && row.students.length
      ? row.students
      : allAttendanceStudents(row?.schoolId || "school-main");
    return rows.filter((student: any) => {
      if (student?.status === "Pasif") return false;
      const studentId = String(student?.id || student?.studentId || "");
      // Öğrenci bazlı/alan grubu atamalarında studentIds kesin kaynaktır; sınıf adı
      // 11C / 11C SAY gibi farklı tutulsa bile doğru öğrenci listesi korunur.
      if (allowedIds.size > 0) return allowedIds.has(studentId);
      const studentClass = normalizeTeacherValue(student?.classroom || student?.className || student?.branch);
      return !classKey || studentClass === classKey;
    });
  };


  const teacherExamNormalizeCourse = (value: unknown) =>
    normalizeTeacherAssignmentIdentity(value)
      .replace(/\bSECMELI\b/g, " ")
      .replace(/^S\s+/, "")
      .replace(/\bDERSI?\b/g, " ")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const teacherExamCourseAliases = (value: unknown) => {
    const raw = teacherExamNormalizeCourse(value);
    const aliases = new Set<string>();
    if (raw) aliases.add(raw);
    if (/TURK DILI VE EDEBIYATI|EDEBIYAT/.test(raw)) {
      aliases.add("TURK DILI VE EDEBIYATI"); aliases.add("EDEBIYAT"); aliases.add("TDE");
    }
    if (/DIN KULTURU|DIN KULTURU VE AHLAK BILGISI|DKAB/.test(raw)) {
      aliases.add("DIN KULTURU VE AHLAK BILGISI"); aliases.add("DIN KULTURU"); aliases.add("DKAB");
    }
    if (/BILISIM TEKNOLOJILERI/.test(raw)) aliases.add("BILISIM");
    if (/FELSEFE/.test(raw)) aliases.add("FELSEFE");
    if (/MATEMATIK/.test(raw)) aliases.add("MATEMATIK");
    return aliases;
  };

  const teacherExamCourseMatches = (courseName: unknown, subjectName: unknown) => {
    const courseAliases = teacherExamCourseAliases(courseName);
    const subjectAliases = teacherExamCourseAliases(subjectName);
    for (const course of courseAliases) {
      for (const subject of subjectAliases) {
        if (!course || !subject) continue;
        if (course === subject) return true;
        if (Math.min(course.length, subject.length) >= 5 && (course.includes(subject) || subject.includes(course))) return true;
      }
    }
    return false;
  };

  const teacherExamNormalizeClass = (value: unknown) =>
    normalizeTeacherAssignmentIdentity(value)
      .replace(/\b(SAY|EA|SOZ|DIL|GENEL)\b/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .trim();

  const teacherExamNormalizeStudentNumber = (value: unknown) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    return (digits || raw).replace(/^0+/, "") || "0";
  };

  const teacherExamNormalizeStudentName = (value: unknown) =>
    normalizeTeacherAssignmentIdentity(value).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const teacherExamRows = () => {
    const map = new Map<string, any>();
    for (const exam of listDocuments("exams") as any[]) {
      const id = String(exam?.id || "").trim() || crypto.createHash("sha1").update(JSON.stringify(exam)).digest("hex");
      map.set(id, exam);
    }
    return [...map.values()];
  };

  const teacherExamTypeLabel = (exam: any) => {
    const raw = normalizeTeacherAssignmentIdentity(
      exam?.examType || exam?.type || exam?.examCategory || exam?.category || exam?.examName || exam?.name,
    );
    if (raw.includes("TYT")) return "TYT";
    if (raw.includes("AYT")) return "AYT";
    if (raw.includes("BRANS")) return "Branş Denemesi";
    if (raw.includes("UNITE")) return "Ünite Denemesi";
    if (raw.includes("KONU")) return "Konu Taraması";
    return String(exam?.examType || exam?.type || "Sınav").trim() || "Sınav";
  };

  app.get("/api/behavior/teacher-links/:token/exam-results", (request, response) => {
    try {
      const token = String(request.params.token || "").trim();
      const access = requireBehaviorTeacherLink(token);
      if ("error" in access) return response.status(access.status).json({ error: access.error });
      const row: any = access.row;
      const profile: any = resolveEnstituStaffProfile(row);
      const accessRole = String(profile?.role || profile?.staffRole || "TEACHER").toUpperCase();
      const fullExamAccess = accessRole === "ADMIN" || accessRole === "GUIDANCE";
      const assignments = teacherHomeworkAssignments(row);

      const assignedSubjectsMap = new Map<string, { courseName: string; classrooms: string[] }>();
      for (const assignment of assignments) {
        const key = teacherExamNormalizeCourse(assignment?.courseName);
        if (!key) continue;
        const current = assignedSubjectsMap.get(key) || { courseName: String(assignment?.courseName || "").trim(), classrooms: [] };
        const classroom = String(assignment?.classroom || "").trim();
        if (classroom && !current.classrooms.includes(classroom)) current.classrooms.push(classroom);
        assignedSubjectsMap.set(key, current);
      }

      // Öğretmen genel başarı görünümünde yalnız dersine girdiği sınıflardaki öğrencileri görür.
      // Yönetici ve rehber öğretmen için bu sınır uygulanmaz.
      const teacherAllowedStudentNumbers = new Set<string>();
      const teacherAllowedStudentNames = new Set<string>();
      const teacherAllowedClasses = new Set<string>();
      const teacherClassLabelsOverall = new Set<string>();
      for (const assignment of assignments) {
        const classroom = String(assignment?.classroom || "").trim();
        if (classroom) {
          teacherClassLabelsOverall.add(classroom);
          const classKey = teacherExamNormalizeClass(classroom);
          if (classKey) teacherAllowedClasses.add(classKey);
        }
        const assignmentStudents = teacherLinkStudentsForHomework(row, classroom, assignment?.studentIds || []);
        for (const student of assignmentStudents) {
          const number = teacherExamNormalizeStudentNumber(
            student?.number || student?.studentNumber || student?.studentNo || student?.schoolNumber || student?.id,
          );
          const name = teacherExamNormalizeStudentName(student?.name || student?.fullName || student?.studentName);
          if (number) teacherAllowedStudentNumbers.add(number);
          if (name) teacherAllowedStudentNames.add(name);
        }
      }

      const resultIdentityKey = (result: any) => {
        const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel) || "SINIFSIZ";
        return `${teacherExamNormalizeStudentNumber(result?.studentNumber || result?.studentNo || result?.schoolNumber)}|${teacherExamNormalizeStudentName(result?.studentName || result?.name)}|${classKey}`;
      };

      const resultBelongsToTeacher = (result: any) => {
        const number = teacherExamNormalizeStudentNumber(result?.studentNumber || result?.studentNo || result?.schoolNumber);
        const name = teacherExamNormalizeStudentName(result?.studentName || result?.name);
        const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel);
        if (number && teacherAllowedStudentNumbers.has(number)) return true;
        if (name && teacherAllowedStudentNames.has(name)) return true;
        return Boolean(classKey && teacherAllowedClasses.has(classKey));
      };

      const examPayloads: any[] = [];
      for (const exam of teacherExamRows()) {
        const storedResults = Array.isArray(exam?.evaluationResults) ? exam.evaluationResults : [];
        if (!storedResults.length) continue;

        const availableSubjectNames = Array.from(new Set(
          storedResults.flatMap((result: any) => Array.isArray(result?.subjects)
            ? result.subjects.map((subject: any) => String(subject?.subjectName || "").trim()).filter(Boolean)
            : []),
        ));
        if (!availableSubjectNames.length) continue;

        const subjects: any[] = [];
        for (const subjectName of availableSubjectNames) {
          const matchingAssignments = assignments.filter((assignment: any) => teacherExamCourseMatches(assignment?.courseName, subjectName));
          if (!fullExamAccess && !matchingAssignments.length) continue;

          const allowedStudentNumbers = new Set<string>();
          const allowedStudentNames = new Set<string>();
          const allowedClasses = new Set<string>();
          const visibleClassLabels = new Set<string>();

          if (!fullExamAccess) {
            for (const assignment of matchingAssignments) {
              const classroom = String(assignment?.classroom || "").trim();
              if (classroom) {
                visibleClassLabels.add(classroom);
                const classKey = teacherExamNormalizeClass(classroom);
                if (classKey) allowedClasses.add(classKey);
              }
              const assignmentStudents = teacherLinkStudentsForHomework(row, classroom, assignment?.studentIds || []);
              for (const student of assignmentStudents) {
                const number = teacherExamNormalizeStudentNumber(
                  student?.number || student?.studentNumber || student?.studentNo || student?.schoolNumber || student?.id,
                );
                const name = teacherExamNormalizeStudentName(student?.name || student?.fullName || student?.studentName);
                if (number) allowedStudentNumbers.add(number);
                if (name) allowedStudentNames.add(name);
              }
            }
          }

          const subjectRowsAll = storedResults.map((result: any) => {
            const subject = (Array.isArray(result?.subjects) ? result.subjects : []).find((candidate: any) => teacherExamCourseMatches(subjectName, candidate?.subjectName));
            return subject ? { result, subject } : null;
          }).filter(Boolean) as Array<{ result: any; subject: any }>;
          if (!subjectRowsAll.length) continue;

          if (fullExamAccess) {
            for (const item of subjectRowsAll) {
              const label = String(item.result?.classroom || item.result?.className || item.result?.gradeLevel || "").trim();
              if (label) visibleClassLabels.add(label);
            }
          }

          const belongsToTeacher = ({ result }: { result: any; subject: any }) => {
            const number = teacherExamNormalizeStudentNumber(result?.studentNumber || result?.studentNo || result?.schoolNumber);
            const name = teacherExamNormalizeStudentName(result?.studentName || result?.name);
            const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel);
            if (number && allowedStudentNumbers.has(number)) return true;
            if (name && allowedStudentNames.has(name)) return true;
            return Boolean(classKey && allowedClasses.has(classKey));
          };
          const visibleRowsRaw = fullExamAccess ? subjectRowsAll : subjectRowsAll.filter(belongsToTeacher);
          if (!visibleRowsRaw.length) continue;

          const netOf = (item: { result: any; subject: any }) => Number(item?.subject?.net || 0);
          const correctOf = (item: { result: any; subject: any }) => Number(item?.subject?.correct || 0);
          const schoolSorted = [...subjectRowsAll].sort((a, b) => netOf(b) - netOf(a) || correctOf(b) - correctOf(a));
          const schoolRankMap = new Map<string, number>();
          schoolSorted.forEach((item, index) => {
            const key = resultIdentityKey(item.result);
            if (!schoolRankMap.has(key)) schoolRankMap.set(key, index + 1);
          });

          const allClassGroups = new Map<string, Array<{ result: any; subject: any }>>();
          for (const item of subjectRowsAll) {
            const classKey = teacherExamNormalizeClass(item.result?.classroom || item.result?.className || item.result?.gradeLevel) || "SINIFSIZ";
            allClassGroups.set(classKey, [...(allClassGroups.get(classKey) || []), item]);
          }
          const classRankMaps = new Map<string, Map<string, number>>();
          for (const [classKey, items] of allClassGroups) {
            const ranked = [...items].sort((a, b) => netOf(b) - netOf(a) || correctOf(b) - correctOf(a));
            classRankMaps.set(classKey, new Map(ranked.map((item, index) => [resultIdentityKey(item.result), index + 1])));
          }

          const examQuestionSource = (() => {
            const allQuestionSubjects: any = exam?.questions && typeof exam.questions === "object" ? exam.questions : {};
            const subjectLabel = String(subjectName || "");
            const direct = allQuestionSubjects?.[subjectLabel];
            if (direct) return direct;
            const matchedEntry = Object.entries(allQuestionSubjects).find(([candidateName]) =>
              teacherExamCourseMatches(candidateName, subjectLabel),
            );
            return matchedEntry?.[1] || {};
          })() as any;
          const teacherExamQuestionImageUrl = (originalIndex: number, evaluationQuestion: any) => {
            const snapshot = examQuestionSource?.[originalIndex] || examQuestionSource?.[String(originalIndex)] || {};
            const directImage = String(snapshot?.imageUrl || snapshot?.questionImageUrl || evaluationQuestion?.imageUrl || "").trim();
            if (directImage) return directImage;
            const questionId = String(snapshot?.questionId || snapshot?.question_id || snapshot?.id || "").trim();
            if (!questionId) return "";
            const bankRecord = activeQuestionRecords().find((record: any) =>
              String(record?.id || record?.questionId || record?.question_id || "") === questionId,
            );
            if (!bankRecord) return "";
            const storedImageUrl = String(bankRecord?.imageUrl || "").trim();
            if (storedImageUrl) return storedImageUrl;
            const storagePath = safeStoredQuestionPath(bankRecord?.storagePath);
            return storagePath ? questionImageUrl(storagePath) : "";
          };

          const rows = visibleRowsRaw.map((item) => {
            const result = item.result;
            const subject = item.subject;
            const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel) || "SINIFSIZ";
            const key = resultIdentityKey(result);
            const questions = (Array.isArray(subject?.questions) ? subject.questions : []).map((question: any) => ({
              qNum: Number(question?.qNum || 0),
              originalIndex: Number(question?.originalIndex ?? -1),
              studentAns: String(question?.studentAns || "-").trim().toLocaleUpperCase("tr-TR") || "-",
              correctAns: String(question?.correctAns || "").trim().toLocaleUpperCase("tr-TR"),
              isCorrect: question?.isCorrect === true,
              isEmpty: question?.isEmpty === true,
              unit: String(question?.unit || "").trim(),
              topic: String(question?.topic || "").trim(),
              outcome: String(question?.outcome || "").trim(),
              imageUrl: teacherExamQuestionImageUrl(
                Number.isInteger(Number(question?.originalIndex)) && Number(question?.originalIndex) >= 0
                  ? Number(question.originalIndex)
                  : Math.max(0, Number(question?.qNum || 1) - 1),
                question,
              ),
            }));
            return {
              studentNumber: String(result?.studentNumber || "").trim(),
              studentName: String(result?.studentName || "Öğrenci").trim(),
              classroom: String(result?.classroom || "").trim(),
              bookletType: String(result?.bookletType || "A").trim().toLocaleUpperCase("tr-TR") || "A",
              correct: Number(subject?.correct || 0),
              wrong: Number(subject?.wrong || 0),
              empty: Number(subject?.empty || 0),
              net: Number(subject?.net || 0),
              totalQuestions: Number(subject?.totalQuestions || subject?.questionCount || questions.length || 0),
              classroomRank: classRankMaps.get(classKey)?.get(key) || 0,
              schoolRank: schoolRankMap.get(key) || 0,
              questions,
            };
          }).sort((a, b) => Number(b.net) - Number(a.net) || Number(b.correct) - Number(a.correct) || String(a.studentName).localeCompare(String(b.studentName), "tr-TR"));

          const statSource = fullExamAccess ? subjectRowsAll : visibleRowsRaw;
          const statGroups = new Map<string, Array<{ result: any; subject: any }>>();
          for (const item of statSource) {
            const classKey = teacherExamNormalizeClass(item.result?.classroom || item.result?.className || item.result?.gradeLevel) || "SINIFSIZ";
            statGroups.set(classKey, [...(statGroups.get(classKey) || []), item]);
          }
          const classroomStats = Array.from(statGroups.entries()).map(([classKey, items]) => {
            const classroom = String(items[0]?.result?.classroom || classKey).trim();
            const average = (field: string) => items.length ? items.reduce((sum, item) => sum + Number(item.subject?.[field] || 0), 0) / items.length : 0;
            return {
              classroom,
              participantCount: items.length,
              correct: Number(average("correct").toFixed(2)),
              wrong: Number(average("wrong").toFixed(2)),
              empty: Number(average("empty").toFixed(2)),
              net: Number(average("net").toFixed(2)),
              rank: 0,
              isTeacherClass: !fullExamAccess && allowedClasses.has(classKey),
            };
          }).sort((a, b) => Number(b.net) - Number(a.net));
          classroomStats.forEach((item, index) => { item.rank = index + 1; });

          const itemMap = new Map<number, any>();
          for (const rowItem of visibleRowsRaw) {
            const result = rowItem.result;
            const subject = rowItem.subject;
            for (const question of Array.isArray(subject?.questions) ? subject.questions : []) {
              const originalIndex = Number.isInteger(Number(question?.originalIndex)) && Number(question?.originalIndex) >= 0
                ? Number(question.originalIndex) : Math.max(0, Number(question?.qNum || 1) - 1);
              const state = itemMap.get(originalIndex) || {
                questionNumber: originalIndex + 1,
                bookletNumbers: {},
                correctAnswer: "",
                imageUrl: teacherExamQuestionImageUrl(originalIndex, question),
                correctCount: 0, wrongCount: 0, emptyCount: 0, totalCount: 0, choiceCounts: {},
              };
              if (!state.imageUrl) state.imageUrl = teacherExamQuestionImageUrl(originalIndex, question);
              const booklet = String(result?.bookletType || "A").trim().toLocaleUpperCase("tr-TR") || "A";
              const printed = Number(question?.qNum || 0);
              if (["A", "B", "C", "D"].includes(booklet) && printed > 0) state.bookletNumbers[booklet] = printed;
              const bookletCorrectAnswer = String(question?.correctAns || "").trim().toLocaleUpperCase("tr-TR");
              if (booklet === "A" && bookletCorrectAnswer) state.correctAnswer = bookletCorrectAnswer;
              else if (!state.correctAnswer && bookletCorrectAnswer) state.correctAnswer = bookletCorrectAnswer;
              const studentAnswer = String(question?.studentAns || "-").trim().toLocaleUpperCase("tr-TR") || "-";
              state.totalCount += 1;
              if (question?.isEmpty === true || studentAnswer === "-") state.emptyCount += 1;
              else if (question?.isCorrect === true) state.correctCount += 1;
              else state.wrongCount += 1;
              if (["A", "B", "C", "D", "E"].includes(studentAnswer)) state.choiceCounts[studentAnswer] = Number(state.choiceCounts[studentAnswer] || 0) + 1;
              itemMap.set(originalIndex, state);
            }
          }
          const items = [...itemMap.values()].sort((a, b) =>
            Number(a.bookletNumbers?.A || a.questionNumber || 0) - Number(b.bookletNumbers?.A || b.questionNumber || 0),
          ).map((item) => ({
            ...item,
            correctRate: item.totalCount ? Number((item.correctCount / item.totalCount * 100).toFixed(1)) : 0,
          }));

          const averageNet = (items: Array<{ result: any; subject: any }>) => items.length
            ? items.reduce((sum, item) => sum + Number(item.subject?.net || 0), 0) / items.length : 0;
          const subjectPayload = {
            subjectName,
            assignedClassrooms: [...visibleClassLabels],
            teacherAverageNet: Number(averageNet(visibleRowsRaw).toFixed(2)),
            schoolAverageNet: Number(averageNet(subjectRowsAll).toFixed(2)),
            assignedParticipantCount: visibleRowsRaw.length,
            schoolParticipantCount: subjectRowsAll.length,
            rows,
            classroomStats,
            items,
          };
          subjects.push(subjectPayload);

          if (fullExamAccess) {
            const key = teacherExamNormalizeCourse(subjectName);
            if (key) assignedSubjectsMap.set(key, { courseName: subjectName, classrooms: [...visibleClassLabels] });
          }
        }

        if (!subjects.length) continue;

        // Genel başarı: yöneticiler ve rehber öğretmenler için tüm okul;
        // branş öğretmeni için yalnız dersine girdiği sınıflardaki öğrenciler.
        const generalSourceResults = fullExamAccess ? storedResults : storedResults.filter(resultBelongsToTeacher);
        if (!generalSourceResults.length) continue;

        const totalField = (result: any, field: string) => (Array.isArray(result?.subjects) ? result.subjects : [])
          .reduce((sum: number, subject: any) => sum + Number(subject?.[field] || 0), 0);
        const totalQuestionsOf = (result: any) => (Array.isArray(result?.subjects) ? result.subjects : [])
          .reduce((sum: number, subject: any) => sum + Number(subject?.totalQuestions || subject?.questionCount || (Array.isArray(subject?.questions) ? subject.questions.length : 0) || 0), 0);

        const generalSortedAll = [...storedResults].sort((a, b) =>
          totalField(b, "net") - totalField(a, "net") || totalField(b, "correct") - totalField(a, "correct") || String(a?.studentName || "").localeCompare(String(b?.studentName || ""), "tr-TR"),
        );
        const generalSchoolRankMap = new Map<string, number>();
        generalSortedAll.forEach((result, index) => {
          const key = resultIdentityKey(result);
          if (!generalSchoolRankMap.has(key)) generalSchoolRankMap.set(key, index + 1);
        });

        const generalClassRankMaps = new Map<string, Map<string, number>>();
        const generalAllClassGroups = new Map<string, any[]>();
        for (const result of storedResults) {
          const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel) || "SINIFSIZ";
          generalAllClassGroups.set(classKey, [...(generalAllClassGroups.get(classKey) || []), result]);
        }
        for (const [classKey, results] of generalAllClassGroups) {
          const ranked = [...results].sort((a, b) => totalField(b, "net") - totalField(a, "net") || totalField(b, "correct") - totalField(a, "correct"));
          generalClassRankMaps.set(classKey, new Map(ranked.map((result, index) => [resultIdentityKey(result), index + 1])));
        }

        const generalRows = generalSourceResults.map((result: any) => {
          const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel) || "SINIFSIZ";
          const key = resultIdentityKey(result);
          return {
            studentNumber: String(result?.studentNumber || "").trim(),
            studentName: String(result?.studentName || "Öğrenci").trim(),
            classroom: String(result?.classroom || "").trim(),
            bookletType: String(result?.bookletType || "A").trim().toLocaleUpperCase("tr-TR") || "A",
            correct: totalField(result, "correct"),
            wrong: totalField(result, "wrong"),
            empty: totalField(result, "empty"),
            net: Number(totalField(result, "net").toFixed(2)),
            totalQuestions: totalQuestionsOf(result),
            classroomRank: generalClassRankMaps.get(classKey)?.get(key) || 0,
            schoolRank: generalSchoolRankMap.get(key) || 0,
            questions: [],
          };
        }).sort((a, b) => Number(b.net) - Number(a.net) || Number(b.correct) - Number(a.correct) || String(a.studentName).localeCompare(String(b.studentName), "tr-TR"));

        const generalStatGroups = new Map<string, any[]>();
        for (const result of generalSourceResults) {
          const classKey = teacherExamNormalizeClass(result?.classroom || result?.className || result?.gradeLevel) || "SINIFSIZ";
          generalStatGroups.set(classKey, [...(generalStatGroups.get(classKey) || []), result]);
        }
        const generalClassroomStats = Array.from(generalStatGroups.entries()).map(([classKey, results]) => {
          const average = (field: string) => results.length ? results.reduce((sum, result) => sum + totalField(result, field), 0) / results.length : 0;
          return {
            classroom: String(results[0]?.classroom || results[0]?.className || classKey).trim(),
            participantCount: results.length,
            correct: Number(average("correct").toFixed(2)),
            wrong: Number(average("wrong").toFixed(2)),
            empty: Number(average("empty").toFixed(2)),
            net: Number(average("net").toFixed(2)),
            rank: 0,
            isTeacherClass: !fullExamAccess && teacherAllowedClasses.has(classKey),
          };
        }).sort((a, b) => Number(b.net) - Number(a.net));
        generalClassroomStats.forEach((item, index) => { item.rank = index + 1; });

        const generalItems = subjects.flatMap((subject: any) =>
          (Array.isArray(subject?.items) ? subject.items : []).map((item: any) => ({
            ...item,
            subjectName: String(subject?.subjectName || "").trim(),
          })),
        );
        const averageGeneralNet = (results: any[]) => results.length
          ? results.reduce((sum, result) => sum + totalField(result, "net"), 0) / results.length : 0;
        const general = {
          subjectName: "Genel Başarı",
          assignedClassrooms: fullExamAccess
            ? Array.from(new Set(generalSourceResults.map((result: any) => String(result?.classroom || "").trim()).filter(Boolean)))
            : [...teacherClassLabelsOverall],
          teacherAverageNet: Number(averageGeneralNet(generalSourceResults).toFixed(2)),
          schoolAverageNet: Number(averageGeneralNet(storedResults).toFixed(2)),
          assignedParticipantCount: generalSourceResults.length,
          schoolParticipantCount: storedResults.length,
          rows: generalRows,
          classroomStats: generalClassroomStats,
          items: generalItems,
        };

        examPayloads.push({
          id: String(exam?.id || "").trim(),
          examName: String(exam?.examName || exam?.name || "Sınav").trim(),
          examDate: String(exam?.examDate || exam?.date || exam?.evaluatedAt || exam?.updatedAt || "").slice(0, 10),
          examType: teacherExamTypeLabel(exam),
          examSource: String(exam?.examSource || exam?.source || "").trim(),
          general,
          subjects,
        });
      }

      examPayloads.sort((a, b) => String(b.examDate || "").localeCompare(String(a.examDate || "")) || String(b.examName).localeCompare(String(a.examName), "tr-TR"));
      response.setHeader("Cache-Control", "private, no-store");
      return response.json({
        exams: examPayloads,
        assignedSubjects: [...assignedSubjectsMap.values()].sort((a, b) => a.courseName.localeCompare(b.courseName, "tr-TR")),
        accessRole,
      });
    } catch (error: any) {
      return response.status(500).json({ error: error?.message || "Sınav sonuçları yüklenemedi." });
    }
  });

  const homeworkSessionSummary = (session: any, row: any, assignments?: any[]) => {
    const assignmentRows = assignments || teacherHomeworkAssignments(row);
    const assignment = assignmentRows.find((item: any) =>
      normalizeTeacherValue(item.classroom) === normalizeTeacherValue(session?.classroom)
      && (!session?.courseName || normalizeTeacherValue(item.courseName) === normalizeTeacherValue(session?.courseName))
    );
    const students = teacherLinkStudentsForHomework(row, String(session?.classroom || ""), assignment?.studentIds || []);
    const evaluations = listDocuments(HOMEWORK_EVALUATIONS)
      .filter((item: any) => String(item?.sessionId || "") === String(session?.id || ""));
    const evaluatedIds = new Set(evaluations.map((item: any) => String(item?.studentId || "")).filter(Boolean));
    const totalStudents = students.length;
    const evaluatedCount = evaluatedIds.size;
    return {
      ...session,
      evaluatedCount,
      totalStudents,
      fullyEvaluated: Boolean(session?.completedAt) || (totalStudents > 0 && evaluatedCount >= totalStudents),
    };
  };

  app.get("/api/behavior/teacher-links/:token/homework/assignments", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ assignments: teacherHomeworkAssignments(access.row) });
  });

  app.get("/api/behavior/teacher-links/:token/homework/overview", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const assignments = teacherHomeworkAssignments(access.row);
    const sessions = listDocuments(HOMEWORK_SESSIONS)
      .filter((item: any) => String(item?.linkToken || "") === token)
      .map((item: any) => homeworkSessionSummary(item, access.row, assignments))
      .sort((a: any, b: any) => {
        const aDone = a.completedAt ? 1 : 0;
        const bDone = b.completedAt ? 1 : 0;
        return aDone - bDone || String(b.createdAt || b.homeworkDate || "").localeCompare(String(a.createdAt || a.homeworkDate || ""));
      });
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ sessions });
  });

  app.get("/api/behavior/teacher-links/:token/homework/reminders", (request, response) => {
    const token = String(request.params.token || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const today = teacherNow().date;
    const reminders = listDocuments(HOMEWORK_SESSIONS)
      .filter((item: any) => String(item?.linkToken || "") === token)
      .filter((item: any) => !item?.completedAt && !item?.reminderAcknowledgedAt)
      .filter((item: any) => String(item?.controlDate || item?.reminderDate || "") && String(item?.controlDate || item?.reminderDate || "") <= today)
      .map((item: any) => ({
        id: String(item.id),
        classroom: String(item.classroom || ""),
        courseName: String(item.courseName || ""),
        topic: String(item.topic || "Ödev kontrolü"),
        controlDate: String(item.controlDate || item.reminderDate || ""),
      }));
    return response.json({ reminders });
  });

  app.post("/api/behavior/teacher-links/:token/homework/reminders/:sessionId/ack", (request, response) => {
    const token = String(request.params.token || "");
    const sessionId = String(request.params.sessionId || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item?.id || "") === sessionId && String(item?.linkToken || "") === token,
    );
    if (!session) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });
    const updated = { ...session, reminderAcknowledgedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    upsertDocument(HOMEWORK_SESSIONS, sessionId, updated);
    return response.json({ ok: true });
  });

  app.get("/api/behavior/teacher-links/:token/homework", (request, response) => {
    const token = String(request.params.token || "");
    const classroom = String(request.query.classroom || "").trim();
    const date = String(request.query.date || "").trim();
    const courseName = String(request.query.courseName || "").trim();
    if (!token || !classroom || !date) return response.status(400).json({ error: "Sınıf ve tarih gereklidir." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item.linkToken) === token
        && normalizeTeacherValue(item.classroom) === normalizeTeacherValue(classroom)
        && String(item.homeworkDate) === date
        && (!courseName || normalizeTeacherValue(item.courseName) === normalizeTeacherValue(courseName)),
    );
    if (!session) return response.json({ session: null, evaluations: {} });

    const evaluations = Object.fromEntries(
      listDocuments(HOMEWORK_EVALUATIONS)
        .filter((item: any) => String(item.sessionId) === String(session.id))
        .map((item: any) => [String(item.studentId), normalizeHomeworkStatusValue(item.status)]),
    );
    return response.json({ session: homeworkSessionSummary(session, access.row), evaluations });
  });

  app.get("/api/behavior/teacher-links/:token/homework/sessions", (request, response) => {
    const token = String(request.params.token || "");
    const classroom = String(request.query.classroom || "").trim();
    if (!token || !classroom) return response.status(400).json({ error: "Sınıf gereklidir." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const assignments = teacherHomeworkAssignments(access.row);
    const sessions = listDocuments(HOMEWORK_SESSIONS)
      .filter((item: any) => String(item.linkToken) === token && normalizeTeacherValue(item.classroom) === normalizeTeacherValue(classroom))
      .map((item: any) => homeworkSessionSummary(item, access.row, assignments))
      .sort((a: any, b: any) => {
        const d = String(b.controlDate || b.homeworkDate || "").localeCompare(String(a.controlDate || a.homeworkDate || ""));
        return d || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })
      .slice(0, 100);
    return response.json({ sessions });
  });

  app.get("/api/behavior/teacher-links/:token/homework/session/:sessionId", (request, response) => {
    const token = String(request.params.token || "");
    const sessionId = String(request.params.sessionId || "");
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item.id) === sessionId && String(item.linkToken) === token,
    );
    if (!session) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });

    const evaluations = Object.fromEntries(
      listDocuments(HOMEWORK_EVALUATIONS)
        .filter((item: any) => String(item.sessionId) === sessionId)
        .map((item: any) => [String(item.studentId), normalizeHomeworkStatusValue(item.status)]),
    );
    return response.json({ session: homeworkSessionSummary(session, access.row), evaluations });
  });

  app.post("/api/behavior/teacher-links/:token/homework", (request, response) => {
    const token = String(request.params.token || "");
    const parsed = z.object({
      sessionId: z.string().min(1).max(200).optional(),
      classroom: z.string().min(1).max(120),
      courseName: z.string().min(1).max(240),
      topic: z.string().min(1).max(1000),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      controlDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Ödev bilgisi geçersiz." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;

    const assignments = teacherHomeworkAssignments(row);
    const assignment = assignments.find((item: any) =>
      normalizeTeacherValue(item.classroom) === normalizeTeacherValue(parsed.data.classroom)
      && normalizeTeacherValue(item.courseName) === normalizeTeacherValue(parsed.data.courseName),
    );
    if (!assignment) {
      return response.status(403).json({ error: "Bu sınıf ve ders öğretmene atanmış görünmüyor." });
    }

    const existing: any = parsed.data.sessionId
      ? listDocuments(HOMEWORK_SESSIONS).find(
          (item: any) => String(item.id) === parsed.data.sessionId && String(item.linkToken) === token,
        )
      : undefined;
    if (parsed.data.sessionId && !existing) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });

    const now = new Date().toISOString();
    const id = existing?.id || `hw-${Date.now()}-${randomBehaviorSecret(8)}`;
    const session = {
      ...existing,
      id,
      linkToken: token,
      schoolId: row.schoolId,
      teacherId: row.teacherId,
      teacherName: row.teacherName,
      classroom: parsed.data.classroom,
      classroomId: assignment.classroomId || existing?.classroomId || "",
      courseName: parsed.data.courseName,
      topic: parsed.data.topic.trim(),
      homeworkDate: parsed.data.date,
      controlDate: parsed.data.controlDate,
      reminderDate: parsed.data.controlDate,
      reminderAcknowledgedAt: existing?.controlDate === parsed.data.controlDate ? existing?.reminderAcknowledgedAt : undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    upsertDocument(HOMEWORK_SESSIONS, id, session);
    return response.status(existing ? 200 : 201).json({ session: homeworkSessionSummary(session, row, assignments) });
  });

  app.post("/api/behavior/teacher-links/:token/homework/:sessionId/evaluations", (request, response) => {
    const token = String(request.params.token || "");
    const sessionId = String(request.params.sessionId || "");
    const parsed = z.object({
      studentId: z.string().min(1).max(200),
      studentName: z.string().min(1).max(240),
      studentNumber: z.string().max(80).optional().default(""),
      status: homeworkStatusSchema,
    }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Ödev değerlendirmesi geçersiz." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item.id) === sessionId && String(item.linkToken) === token,
    );
    if (!session) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });

    const assignments = teacherHomeworkAssignments(access.row);
    const assignment = assignments.find((item: any) =>
      normalizeTeacherValue(item.classroom) === normalizeTeacherValue(session.classroom)
      && normalizeTeacherValue(item.courseName) === normalizeTeacherValue(session.courseName),
    );
    const allowedStudents = teacherLinkStudentsForHomework(access.row, String(session.classroom || ""), assignment?.studentIds || []);
    const allowedIds = new Set(allowedStudents.map((student: any) => String(student?.id || student?.studentId || "")));
    if (allowedIds.size > 0 && !allowedIds.has(parsed.data.studentId)) {
      return response.status(403).json({ error: "Öğrenci bu sınıf/ders atamasında bulunmuyor." });
    }

    const now = new Date().toISOString();
    const evaluationId = behaviorDocumentId("hwe", sessionId, parsed.data.studentId);
    upsertDocument(HOMEWORK_EVALUATIONS, evaluationId, {
      id: evaluationId,
      sessionId,
      studentId: parsed.data.studentId,
      studentName: parsed.data.studentName,
      studentNumber: parsed.data.studentNumber,
      status: parsed.data.status,
      updatedAt: now,
    });
    const summary = homeworkSessionSummary({ ...session, updatedAt: now }, access.row, assignments);
    upsertDocument(HOMEWORK_SESSIONS, sessionId, {
      ...session,
      evaluatedCount: summary.evaluatedCount,
      totalStudents: summary.totalStudents,
      fullyEvaluated: summary.fullyEvaluated,
      updatedAt: now,
    });

    return response.status(201).json({
      ok: true,
      studentId: parsed.data.studentId,
      status: parsed.data.status,
      updatedAt: now,
    });
  });

  app.post("/api/behavior/teacher-links/:token/homework/:sessionId/completion", (request, response) => {
    const token = String(request.params.token || "");
    const sessionId = String(request.params.sessionId || "");
    const parsed = z.object({ completed: z.boolean() }).safeParse(request.body || {});
    if (!parsed.success) return response.status(400).json({ error: "Ödev kontrol durumu geçersiz." });
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item?.id || "") === sessionId && String(item?.linkToken || "") === token,
    );
    if (!session) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });
    const now = new Date().toISOString();
    const updated = {
      ...session,
      completedAt: parsed.data.completed ? (session.completedAt || now) : undefined,
      completedBy: parsed.data.completed ? String(access.row?.teacherName || "") : undefined,
      updatedAt: now,
    };
    upsertDocument(HOMEWORK_SESSIONS, sessionId, updated);
    return response.json({ session: homeworkSessionSummary(updated, access.row) });
  });

  app.delete("/api/behavior/teacher-links/:token/homework/:sessionId", (request, response) => {
    const token = String(request.params.token || "");
    const sessionId = String(request.params.sessionId || "");
    if (!token || !sessionId) return response.status(400).json({ error: "Ödev kaydı bilgisi eksik." });

    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });

    const session: any = listDocuments(HOMEWORK_SESSIONS).find(
      (item: any) => String(item.id) === sessionId && String(item.linkToken) === token,
    );
    if (!session) return response.status(404).json({ error: "Ödev kaydı bulunamadı." });

    for (const item of listDocuments(HOMEWORK_EVALUATIONS)) {
      if (String((item as any).sessionId) === sessionId) deleteDocument(HOMEWORK_EVALUATIONS, String((item as any).id));
    }
    deleteDocument(HOMEWORK_SESSIONS, sessionId);
    return response.json({ ok: true, sessionId });
  });


  app.post("/api/behavior/teacher-links/:token/activity", (request, response) => {
    const token = String(request.params.token || "");
    const parsed = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activityName: z.string().min(1).max(500),
      lessons: z.array(z.number().int().min(1).max(12)).min(1).max(12),
      students: z.array(z.object({
        id: z.string().min(1).max(200), name: z.string().min(1).max(300),
        number: z.union([z.string(), z.number()]).optional(), classroom: z.string().min(1).max(120),
      })).min(1).max(200),
    }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Faaliyet bilgisi geÃ§ersiz." });
    const access = requireBehaviorTeacherLink(token);
    if ("error" in access) return response.status(access.status).json({ error: access.error });
    const row: any = access.row;
    const now = new Date().toISOString();
    const activityId = `act-${Date.now()}-${randomBehaviorSecret(8)}`;
    const lessons = [...new Set(parsed.data.lessons)].sort((a,b)=>a-b);
    parsed.data.students.forEach((student) => {
      const id = behaviorDocumentId("act", activityId, student.id);
      upsertDocument(TEACHER_ACTIVITY_RECORDS, id, {
        id, activityId, linkToken: token, schoolId: row.schoolId, teacherId: row.teacherId,
        teacherName: row.teacherName, date: parsed.data.date, activityName: parsed.data.activityName.trim(),
        lessons, studentId: student.id, studentName: student.name, studentNumber: String(student.number ?? ""),
        classroom: student.classroom, status: "pending", source: "teacher-link-activity", createdAt: now, updatedAt: now,
      });
    });
    return response.status(201).json({ ok: true, activityId, count: parsed.data.students.length });
  });

  app.get("/api/behavior/activity-records", (request, response) => {
    const schoolId = String(request.query.schoolId || "").trim();
    const date = String(request.query.date || "").trim();
    const status = String(request.query.status || "").trim();
    const items = listDocuments(TEACHER_ACTIVITY_RECORDS)
      .filter((item: any) => !schoolId || String(item.schoolId) === schoolId)
      .filter((item: any) => !date || String(item.date) === date)
      .filter((item: any) => !status || String(item.status) === status)
      .sort((a: any,b: any)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    response.setHeader("Cache-Control", "no-store");
    return response.json({ items });
  });

  app.get("/api/behavior/homework-records", (request, response) => {
    const schoolId = String(request.query.schoolId || "").trim();
    const date = String(request.query.date || "").trim();
    const teacherId = String(request.query.teacherId || "").trim();
    const classroom = String(request.query.classroom || "").trim();

    const sessions = listDocuments(HOMEWORK_SESSIONS)
      .filter((s: any) => !schoolId || String(s.schoolId) === schoolId)
      .filter((s: any) => !date || String(s.homeworkDate) === date)
      .filter((s: any) => !teacherId || String(s.teacherId) === teacherId)
      .filter((s: any) => !classroom || String(s.classroom) === classroom)
      .sort((a: any, b: any) => {
        const d = String(b.homeworkDate || "").localeCompare(String(a.homeworkDate || ""));
        return d || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });

    const evaluations = listDocuments(HOMEWORK_EVALUATIONS);
    const items: any[] = [];
    for (const session of sessions as any[]) {
      const rows = evaluations.filter((e: any) => String(e.sessionId) === String(session.id)) as any[];
      if (rows.length === 0) {
        items.push({
          id: `${session.id}:pending`,
          sessionId: session.id,
          schoolId: session.schoolId,
          teacherId: session.teacherId,
          teacherName: session.teacherName,
          classroom: session.classroom,
          homeworkTitle: session.topic,
          homeworkTopic: session.topic,
          checkDate: session.homeworkDate,
          studentId: "",
          studentName: "",
          studentNumber: "",
          homeworkStatus: "",
          status: "",
          createdAt: new Date(session.createdAt).getTime(),
          updatedAt: session.updatedAt,
          recordType: "homework",
          source: "teacher-homework",
        });
      } else {
        for (const row of rows) {
          items.push({
            id: `${session.id}:${row.studentId}`,
            sessionId: session.id,
            schoolId: session.schoolId,
            teacherId: session.teacherId,
            teacherName: session.teacherName,
            classroom: session.classroom,
            homeworkTitle: session.topic,
            homeworkTopic: session.topic,
            checkDate: session.homeworkDate,
            studentId: row.studentId,
            studentName: row.studentName,
            studentNumber: row.studentNumber || "",
            homeworkStatus: row.status || "",
            status: row.status || "",
            createdAt: row.updatedAt ? new Date(row.updatedAt).getTime() : new Date(session.createdAt).getTime(),
            updatedAt: row.updatedAt || session.updatedAt,
            recordType: "homework",
            source: "teacher-homework",
          });
        }
      }
    }
    return response.json({ items });
  });
  // ===== /Tek Sunucu DavranÄ±ÅŸ API =====

// Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  setTimeout(() => {
    try {
      const recovery = recoverPendingQuestionBankWrites();
      if (recovery.pending > 0) {
        console.log(
          `[question-bank] recovered pending writes: ${recovery.recovered}/${recovery.pending}`,
        );
      }

      const journalCleanup = cleanupQuestionBankWriteJournal(30);
      if (journalCleanup.removed > 0) {
        console.log(
          `[question-bank] cleaned old write journal entries: ${journalCleanup.removed}`,
        );
      }

      const audit = recordQuestionBankStartupAudit();
      console.log(
        `[question-bank] startup audit: ${audit.status} | writable=${audit.writable}`,
      );
      const integrity = createQuestionBankIntegritySnapshot();
      console.log(
        `[question-bank] integrity snapshot: ${integrity.status}`,
      );
      const healthScore = recordQuestionBankHealthScore();
      console.log(
        `[question-bank] health score: ${healthScore.score}/100 (${healthScore.grade})`,
      );
      const performance = recordQuestionBankPerformanceBenchmark();
      console.log(
        `[question-bank] performance: ${performance.performanceGrade} | avg=${performance.averageLatencyMs}ms`,
      );
    } catch (error) {
      console.error("[question-bank] startup audit failed:", error);
    }
  }, 0);



  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
