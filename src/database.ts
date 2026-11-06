import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {config} from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath),{recursive:true});

export const db=new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS live_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    revoke_hash TEXT NOT NULL,
    report_json TEXT NOT NULL,
    report_code TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    read_count INTEGER NOT NULL DEFAULT 0,
    last_read_at TEXT
  );


  CREATE TABLE IF NOT EXISTS behavior_teacher_links (
    token TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    created_by TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(school_id, teacher_id)
  );

  CREATE TABLE IF NOT EXISTS behavior_teacher_submissions (
    id TEXT PRIMARY KEY,
    link_token TEXT NOT NULL,
    school_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    submitted_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_behavior_submissions_school
  ON behavior_teacher_submissions(school_id);

  CREATE INDEX IF NOT EXISTS idx_live_reports_expires_at
  ON live_reports(expires_at);

  CREATE INDEX IF NOT EXISTS idx_live_reports_revoked_at
  ON live_reports(revoked_at);
`);

export const cleanupExpired=()=>{
  const now=new Date().toISOString();
  return db.prepare(`
    DELETE FROM live_reports
    WHERE expires_at < ?
       OR (revoked_at IS NOT NULL AND revoked_at < datetime(?, '-7 day'))
  `).run(now,now);
};
