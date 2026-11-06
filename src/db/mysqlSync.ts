import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
  type MessagePort,
} from "node:worker_threads";

type QueryResponse = {
  id: number;
  ok: boolean;
  ready?: boolean;
  result?: any;
  error?: { message?: string; code?: string; errno?: number; sqlState?: string };
};

const translateSql = (source: string) => {
  let sql = String(source || "").trim();
  if (!sql) return "";

  if (/^PRAGMA\s+table_info\(([^)]+)\)/i.test(sql)) {
    const tableName = sql.match(/^PRAGMA\s+table_info\(([^)]+)\)/i)?.[1]?.replace(/["'`]/g, "") || "";
    return `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName.replace(/'/g, "''")}'
      ORDER BY ORDINAL_POSITION`;
  }
  if (/^PRAGMA\s+page_count/i.test(sql)) return `SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS page_count
    FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  if (/^PRAGMA\s+freelist_count/i.test(sql)) return "SELECT 0 AS freelist_count";
  if (/^PRAGMA\s+page_size/i.test(sql)) return "SELECT 1 AS page_size";
  if (/^PRAGMA\b/i.test(sql)) return "SELECT 1 AS ok";

  if (/\bFROM\s+sqlite_master\b/i.test(sql)) {
    const tableMatch = sql.match(/tbl_name\s*=\s*'([^']+)'/i);
    const tableFilter = tableMatch
      ? ` AND TABLE_NAME = '${tableMatch[1].replace(/'/g, "''")}'`
      : "";
    if (/SELECT\s+name\s*,\s*tbl_name\s+AS\s+tableName/i.test(sql)) {
      return `SELECT DISTINCT INDEX_NAME AS name, TABLE_NAME AS tableName
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME <> 'PRIMARY'${tableFilter}
        ORDER BY TABLE_NAME, INDEX_NAME`;
    }
    if (/SELECT\s+name\s*,\s*sql/i.test(sql)) {
      return `SELECT DISTINCT INDEX_NAME AS name, '' AS sql
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME <> 'PRIMARY'${tableFilter}
        ORDER BY INDEX_NAME`;
    }
    return `SELECT DISTINCT INDEX_NAME AS name
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME <> 'PRIMARY'${tableFilter}
      ORDER BY INDEX_NAME`;
  }

  if (/^EXPLAIN\s+QUERY\s+PLAN\s+/i.test(sql)) {
    sql = sql.replace(/^EXPLAIN\s+QUERY\s+PLAN\s+/i, "EXPLAIN ");
  }
  if (/^VACUUM\s+INTO\b/i.test(sql)) return "SELECT 1 AS ok";
  if (/^ANALYZE\s*;?$/i.test(sql)) return "SELECT 1 AS ok";
  if (/^ANALYZE\s+([A-Za-z0-9_]+)\s*;?$/i.test(sql)) {
    return sql.replace(/^ANALYZE\s+/i, "ANALYZE TABLE ");
  }
  if (/^CREATE\s+(?:TABLE|INDEX)\s+IF\s+NOT\s+EXISTS\s+question_bank_/i.test(sql)) {
    return "SELECT 1 AS ok";
  }
  if (/^ALTER\s+TABLE\s+question_bank_questions\s+ADD\s+COLUMN/i.test(sql)) {
    return "SELECT 1 AS ok";
  }

  sql = sql.replace(/^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+/i, "CREATE INDEX ");
  sql = sql.replace(/^BEGIN\s+IMMEDIATE\b/i, "START TRANSACTION");
  sql = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT IGNORE INTO");
  sql = sql.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, "REPLACE INTO");
  sql = sql.replace(/\bCOLLATE\s+NOCASE\b/gi, "COLLATE utf8mb4_unicode_ci");
  sql = sql.replace(/CAST\(([^)]+)\s+AS\s+TEXT\)/gi, "CAST($1 AS CHAR)");
  sql = sql.replace(/ON\s+CONFLICT\s*\([^)]+\)\s+DO\s+UPDATE\s+SET/gi, "ON DUPLICATE KEY UPDATE");
  sql = sql.replace(/\bexcluded\.([A-Za-z_][A-Za-z0-9_]*)\b/gi, "VALUES($1)");
  return sql;
};

class MySqlSyncStatement {
  private readonly database: MySqlSyncDatabase;
  private readonly sql: string;

  constructor(database: MySqlSyncDatabase, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  private parameters(values: any[]) {
    return values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  }

  all(...values: any[]) {
    const result = this.database.execute(this.sql, this.parameters(values));
    return Array.isArray(result) ? result : [];
  }

  get(...values: any[]) {
    return this.all(...values)[0];
  }

  run(...values: any[]) {
    const result = this.database.execute(this.sql, this.parameters(values));
    return {
      changes: Number(result?.affectedRows || result?.changedRows || 0),
      lastInsertRowid: Number(result?.insertId || 0),
    };
  }
}

export class MySqlSyncDatabase {
  private readonly signal = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
  private readonly port: MessagePort;
  private readonly worker: Worker;
  private nextId = 1;

  constructor() {
    const required = ["LEGACY_DB_HOST", "LEGACY_DB_DATABASE", "LEGACY_DB_USERNAME", "LEGACY_DB_PASSWORD"];
    const missing = required.filter((name) => !String(process.env[name] || "").trim());
    if (missing.length > 0) throw new Error(`MySQL bağlantı ayarları eksik: ${missing.join(", ")}`);

    const channel = new MessageChannel();
    this.port = channel.port1;
    this.worker = new Worker(new URL("./mysqlSyncWorker.mjs", import.meta.url), {
      workerData: {
        port: channel.port2,
        signal: this.signal.buffer,
        config: {
          host: process.env.LEGACY_DB_HOST,
          port: Number(process.env.LEGACY_DB_PORT || 3306),
          database: process.env.LEGACY_DB_DATABASE,
          user: process.env.LEGACY_DB_USERNAME,
          password: process.env.LEGACY_DB_PASSWORD,
        },
      },
      transferList: [channel.port2],
    });
    const ready = this.waitForResponse(0, 60_000);
    if (!ready.ready) throw new Error("Senkron MySQL işçisi başlatılamadı.");
  }

  private waitForResponse(id: number, timeoutMs: number): QueryResponse {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const packet = receiveMessageOnPort(this.port)?.message as QueryResponse | undefined;
      if (packet) {
        if (packet.id !== id) throw new Error(`MySQL yanıt sırası bozuldu (${packet.id}/${id}).`);
        if (!packet.ok) {
          const error = new Error(packet.error?.message || "MySQL sorgusu başarısız.") as Error & { code?: string };
          error.code = packet.error?.code;
          throw error;
        }
        Atomics.store(this.signal, 0, 0);
        return packet;
      }
      const remaining = Math.max(1, deadline - Date.now());
      Atomics.wait(this.signal, 0, 0, remaining);
    }
    throw new Error(`MySQL sorgusu ${timeoutMs} ms içinde tamamlanmadı.`);
  }

  execute(sourceSql: string, params: any[] = []) {
    const sql = translateSql(sourceSql);
    if (!sql) return { affectedRows: 0, changedRows: 0, insertId: 0 };
    const id = this.nextId++;
    Atomics.store(this.signal, 0, 0);
    this.port.postMessage({ id, sql, params });
    return this.waitForResponse(id, 120_000).result;
  }

  prepare(sql: string) {
    return new MySqlSyncStatement(this, sql);
  }

  exec(sql: string) {
    this.execute(sql);
    return this;
  }

  transaction<T extends (...args: any[]) => any>(callback: T) {
    return (...args: Parameters<T>): ReturnType<T> => {
      this.exec("START TRANSACTION");
      try {
        const result = callback(...args);
        this.exec("COMMIT");
        return result;
      } catch (error) {
        try { this.exec("ROLLBACK"); } catch {}
        throw error;
      }
    };
  }

  close() {
    this.port.close();
    void this.worker.terminate();
  }
}
