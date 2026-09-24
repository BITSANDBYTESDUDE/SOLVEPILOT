import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Keys whose values must never reach the log sink. Matched case-insensitively
 * against the full key name so nested secrets are redacted as well.
 */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|api[-_]?key|authorization|cookie|session|credential|signature|private[-_]?key)/i;

const REDACTED = "[redacted]";

function currentLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function redact(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth > 6) return "[truncated]";

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, seen, depth + 1));
  }
  if (seen.has(value)) return "[circular]";
  seen.add(value);

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(nested, seen, depth + 1);
  }
  return output;
}

function serializeError(error: unknown): LogContext | undefined {
  if (error === undefined) return undefined;
  const redacted = redact(error, new WeakSet<object>(), 0);
  return redacted && typeof redacted === "object" ? (redacted as LogContext) : { error: redacted };
}

function write(level: LogLevel, scope: string, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    scope,
    message,
    ...(context ? { context: redact(context, new WeakSet<object>(), 0) as LogContext } : {}),
  };

  const line = `${JSON.stringify(entry)}\n`;
  if (level === "error" || level === "warn") {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
  child(scope: string): Logger;
}

/**
 * Minimal structured logger with secret redaction.
 *
 * Server-only by design: internal details must never be shipped to the browser
 * (see engineering principle "never expose sensitive internal errors to users").
 */
export function createLogger(scope = "app"): Logger {
  return {
    debug: (message, context) => write("debug", scope, message, context),
    info: (message, context) => write("info", scope, message, context),
    warn: (message, context) => write("warn", scope, message, context),
    error: (message, error, context) =>
      write("error", scope, message, { ...context, ...serializeError(error) }),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

export const logger = createLogger("solvepilot");
