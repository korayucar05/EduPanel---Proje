import "dotenv/config";
import mysql, {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

type LegacyQueryResult = {
  rows: any[];
  rowCount: number;
  insertId?: number;
  affectedRows?: number;
};

const requiredEnvironment = [
  "LEGACY_DB_HOST",
  "LEGACY_DB_DATABASE",
  "LEGACY_DB_USERNAME",
  "LEGACY_DB_PASSWORD",
] as const;

const assertConfiguration = () => {
  const missing = requiredEnvironment.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length > 0) {
    throw new Error(`MySQL bağlantı ayarları eksik: ${missing.join(", ")}`);
  }
};

const mysqlPool = mysql.createPool({
  host: process.env.LEGACY_DB_HOST || "localhost",
  port: Number(process.env.LEGACY_DB_PORT || 3306),
  database: process.env.LEGACY_DB_DATABASE,
  user: process.env.LEGACY_DB_USERNAME,
  password: process.env.LEGACY_DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: Math.max(2, Number(process.env.LEGACY_DB_POOL_SIZE || 10)),
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
});

const normalizeQuery = (text: string, values: readonly unknown[] = []) => {
  const orderedValues: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_placeholder, rawIndex: string) => {
    orderedValues.push(values[Number(rawIndex) - 1]);
    return "?";
  });
  return {
    sql,
    values: orderedValues.length > 0 ? orderedValues : [...values],
  };
};

const execute = async (
  executor: Pick<PoolConnection, "execute" | "query"> | typeof mysqlPool,
  text: string,
  values: readonly unknown[] = [],
): Promise<LegacyQueryResult> => {
  assertConfiguration();
  const normalized = normalizeQuery(text, values);
  const transactionCommand = /^\s*(?:START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;?\s*$/i.test(normalized.sql);
  const useTextProtocol = transactionCommand || normalized.values.length === 0;
  const [result] = useTextProtocol
    ? await executor.query<RowDataPacket[] | ResultSetHeader>(normalized.sql)
    : await executor.execute<RowDataPacket[] | ResultSetHeader>(normalized.sql, normalized.values);

  if (Array.isArray(result)) {
    return { rows: result, rowCount: result.length };
  }

  return {
    rows: [],
    rowCount: result.affectedRows,
    insertId: result.insertId,
    affectedRows: result.affectedRows,
  };
};

export const pool = {
  async connect() {
    assertConfiguration();
    const connection = await mysqlPool.getConnection();
    return {
      query: (text: string, values?: readonly unknown[]) => execute(connection, text, values),
      release: () => connection.release(),
    };
  },
  query: (text: string, values?: readonly unknown[]) => execute(mysqlPool, text, values),
  end: () => mysqlPool.end(),
};
