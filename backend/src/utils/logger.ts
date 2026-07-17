import env from "../config/env.js";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";
type LogMeta = unknown;

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, message: string, meta?: LogMeta): string {
  const base = `[${timestamp()}] [${level}] ${message}`;
  if (meta === undefined) return base;
  if (meta instanceof Error) {
    return `${base}\n${meta.stack ?? meta.message}`;
  }
  try {
    return `${base} ${JSON.stringify(meta)}`;
  } catch {
    return `${base} ${String(meta)}`;
  }
}

function writeOut(line: string): void {
  process.stdout.write(line + "\n");
}
function writeErr(line: string): void {
  process.stderr.write(line + "\n");
}

const logger = {
  info(message: string, meta?: LogMeta): void {
    writeOut(format("INFO", message, meta));
  },
  warn(message: string, meta?: LogMeta): void {
    writeErr(format("WARN", message, meta));
  },
  error(message: string, meta?: LogMeta): void {
    writeErr(format("ERROR", message, meta));
  },
  debug(message: string, meta?: LogMeta): void {
    if (!env.isProduction) {
      writeOut(format("DEBUG", message, meta));
    }
  },
};

export default logger;
