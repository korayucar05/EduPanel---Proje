import { parentPort, workerData } from "node:worker_threads";
import mysql from "mysql2/promise";

const signal = new Int32Array(workerData.signal);
const port = workerData.port;

const notify = (message) => {
  port.postMessage(message);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
};

const connection = await mysql.createConnection({
  ...workerData.config,
  charset: "utf8mb4",
  timezone: "Z",
  multipleStatements: true,
  supportBigNumbers: true,
  bigNumberStrings: false,
});

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS question_bank_questions (
    question_id VARCHAR(191) NOT NULL PRIMARY KEY,
    question_code VARCHAR(191) NOT NULL DEFAULT '',
    grade INT NOT NULL DEFAULT 0,
    course_id VARCHAR(191) NOT NULL DEFAULT '',
    unit_id VARCHAR(191) NOT NULL DEFAULT '',
    topic_id VARCHAR(191) NOT NULL DEFAULT '',
    outcome_id VARCHAR(191) NOT NULL DEFAULT '',
    question_type VARCHAR(60) NOT NULL DEFAULT 'study',
    scope_level VARCHAR(60) NOT NULL DEFAULT 'outcome',
    answer VARCHAR(191) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    image_url LONGTEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    thumbnail_url LONGTEXT NOT NULL,
    content_hash VARCHAR(191) NOT NULL DEFAULT '',
    mime_type VARCHAR(191) NOT NULL DEFAULT '',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    thumbnail_size_bytes BIGINT NOT NULL DEFAULT 0,
    import_session_id VARCHAR(191) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    created_at VARCHAR(40) NULL,
    updated_at VARCHAR(40) NULL,
    deleted_at VARCHAR(40) NULL,
    original_storage_path TEXT NOT NULL,
    trash_path TEXT NOT NULL,
    thumbnail_updated_at VARCHAR(40) NULL,
    column_span INT NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_index (
    question_id VARCHAR(191) NOT NULL PRIMARY KEY,
    question_code VARCHAR(191) NULL,
    grade INT NOT NULL DEFAULT 0,
    course_id VARCHAR(191) NULL,
    unit_id VARCHAR(191) NULL,
    topic_id VARCHAR(191) NULL,
    outcome_id VARCHAR(191) NULL,
    answer VARCHAR(191) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    content_hash VARCHAR(191) NULL,
    file_name TEXT NULL,
    storage_path TEXT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    use_count INT NOT NULL DEFAULT 0,
    last_used_at VARCHAR(40) NULL,
    last_exam_id VARCHAR(191) NULL,
    last_exam_name TEXT NULL,
    created_at VARCHAR(40) NULL,
    updated_at VARCHAR(40) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_schema_migrations (
    version INT NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    applied_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_migration_state (
    id TINYINT NOT NULL PRIMARY KEY,
    target_version INT NOT NULL DEFAULT 0,
    current_version INT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'idle',
    backup_path TEXT NULL,
    last_error TEXT NULL,
    started_at VARCHAR(40) NULL,
    completed_at VARCHAR(40) NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_performance_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    measured_at VARCHAR(40) NOT NULL,
    active_questions INT NOT NULL DEFAULT 0,
    capacity_class VARCHAR(80) NOT NULL,
    performance_grade VARCHAR(40) NOT NULL,
    average_latency_ms INT NOT NULL DEFAULT 0,
    slowest_latency_ms INT NOT NULL DEFAULT 0,
    duration_ms INT NOT NULL DEFAULT 0,
    tests_json LONGTEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_health_score_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    calculated_at VARCHAR(40) NOT NULL,
    score INT NOT NULL,
    grade VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL,
    active_records INT NOT NULL DEFAULT 0,
    indexed_records INT NOT NULL DEFAULT 0,
    missing_files INT NOT NULL DEFAULT 0,
    orphan_files INT NOT NULL DEFAULT 0,
    quarantine_files INT NOT NULL DEFAULT 0,
    duplicate_hash_groups INT NOT NULL DEFAULT 0,
    pending_writes INT NOT NULL DEFAULT 0,
    failed_writes INT NOT NULL DEFAULT 0,
    deductions_json LONGTEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_safe_action_audit (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    action_id VARCHAR(191) NOT NULL,
    label TEXT NOT NULL,
    status VARCHAR(40) NOT NULL,
    started_at VARCHAR(40) NOT NULL,
    completed_at VARCHAR(40) NULL,
    duration_ms INT NULL,
    result_json LONGTEXT NULL,
    error TEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_integrity_snapshot (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    checked_at VARCHAR(40) NOT NULL,
    active_records INT NOT NULL DEFAULT 0,
    indexed_records INT NOT NULL DEFAULT 0,
    missing_files INT NOT NULL DEFAULT 0,
    orphan_files INT NOT NULL DEFAULT 0,
    quarantine_files INT NOT NULL DEFAULT 0,
    duplicate_hash_groups INT NOT NULL DEFAULT 0,
    pending_writes INT NOT NULL DEFAULT 0,
    failed_writes INT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL,
    details_json LONGTEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_write_journal (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    operation VARCHAR(80) NOT NULL,
    question_id VARCHAR(191) NULL,
    question_code VARCHAR(191) NULL,
    target_path TEXT NULL,
    temp_path TEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    error TEXT NULL,
    created_at VARCHAR(40) NOT NULL,
    committed_at VARCHAR(40) NULL,
    recovered_at VARCHAR(40) NULL,
    updated_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS question_bank_startup_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    checked_at VARCHAR(40) NOT NULL,
    schema_version INT NOT NULL,
    target_version INT NOT NULL,
    migration_status VARCHAR(40) NOT NULL,
    writable TINYINT NOT NULL,
    source_records INT NOT NULL DEFAULT 0,
    indexed_records INT NOT NULL DEFAULT 0,
    active_records INT NOT NULL DEFAULT 0,
    missing_files INT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL,
    details_json LONGTEXT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const indexStatements = [
  "CREATE INDEX idx_qbq_code ON question_bank_questions(question_code)",
  "CREATE INDEX idx_qbq_hash ON question_bank_questions(content_hash)",
  "CREATE INDEX idx_qbq_hierarchy ON question_bank_questions(grade, course_id, unit_id, topic_id, outcome_id)",
  "CREATE INDEX idx_qbq_outcome ON question_bank_questions(course_id, outcome_id, status)",
  "CREATE INDEX idx_qbq_topic ON question_bank_questions(course_id, topic_id, status)",
  "CREATE INDEX idx_qbq_type_status ON question_bank_questions(question_type, status)",
  "CREATE INDEX idx_qbq_updated ON question_bank_questions(updated_at)",
  "CREATE INDEX idx_qbi_answer ON question_bank_index(answer)",
  "CREATE INDEX idx_qbi_code ON question_bank_index(question_code)",
  "CREATE INDEX idx_qbi_course_outcome ON question_bank_index(course_id, outcome_id)",
  "CREATE INDEX idx_qbi_grade_course ON question_bank_index(grade, course_id)",
  "CREATE INDEX idx_qbi_hash ON question_bank_index(content_hash)",
  "CREATE INDEX idx_qbi_hierarchy ON question_bank_index(grade, course_id, unit_id, topic_id, outcome_id)",
  "CREATE INDEX idx_qbi_status ON question_bank_index(status)",
  "CREATE INDEX idx_qbi_updated ON question_bank_index(updated_at)",
  "CREATE INDEX idx_qbi_usage ON question_bank_index(use_count, last_used_at)",
  "CREATE INDEX idx_qb_health_score_history_date ON question_bank_health_score_history(calculated_at)",
  "CREATE INDEX idx_qb_integrity_snapshot_checked ON question_bank_integrity_snapshot(checked_at)",
  "CREATE INDEX idx_qb_performance_history_date ON question_bank_performance_history(measured_at)",
  "CREATE INDEX idx_qb_safe_action_audit_action ON question_bank_safe_action_audit(action_id, started_at)",
  "CREATE INDEX idx_qb_safe_action_audit_started ON question_bank_safe_action_audit(started_at)",
  "CREATE INDEX idx_qb_startup_audit_checked ON question_bank_startup_audit(checked_at)",
  "CREATE INDEX idx_qb_write_journal_status ON question_bank_write_journal(status, created_at)",
];

for (const sql of schemaStatements) await connection.query(sql);
for (const sql of indexStatements) {
  try {
    await connection.query(sql);
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") throw error;
  }
}

port.on("message", async ({ id, sql, params = [] }) => {
  try {
    const [result] = await connection.query(sql, params.map((value) => value === undefined ? null : value));
    const payload = Array.isArray(result)
      ? result
      : {
          affectedRows: Number(result.affectedRows || 0),
          changedRows: Number(result.changedRows || 0),
          insertId: Number(result.insertId || 0),
        };
    notify({ id, ok: true, result: payload });
  } catch (error) {
    if (error?.code === "ER_DUP_KEYNAME") {
      notify({ id, ok: true, result: { affectedRows: 0, changedRows: 0, insertId: 0 } });
      return;
    }
    notify({
      id,
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: error?.code,
        errno: error?.errno,
        sqlState: error?.sqlState,
      },
    });
  }
});
port.start();
notify({ id: 0, ok: true, ready: true });

parentPort?.unref();
