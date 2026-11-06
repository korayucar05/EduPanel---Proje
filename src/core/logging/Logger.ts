export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

export type LogRecord = {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
};

export class Logger {
  private readonly records: LogRecord[] = [];
  constructor(private readonly scope = "e-Nstitü", private readonly maxRecords = 250) {}

  child(scope: string): Logger { return new Logger(`${this.scope}:${scope}`, this.maxRecords); }

  private write(level: LogLevel, message: string, context?: LogContext): LogRecord {
    const record = { timestamp: new Date().toISOString(), level, scope: this.scope, message, context };
    this.records.unshift(record);
    if (this.records.length > this.maxRecords) this.records.length = this.maxRecords;
    const writer = level === "error" ? console.error : level === "warn" ? console.warn : level === "debug" ? console.debug : console.info;
    writer(`[${record.scope}] ${message}`, context ?? "");
    return record;
  }

  debug(message: string, context?: LogContext) { return this.write("debug", message, context); }
  info(message: string, context?: LogContext) { return this.write("info", message, context); }
  warn(message: string, context?: LogContext) { return this.write("warn", message, context); }
  error(message: string, context?: LogContext) { return this.write("error", message, context); }
  history(): readonly LogRecord[] { return this.records; }
}

export const logger = new Logger();
