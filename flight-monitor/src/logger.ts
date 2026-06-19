// Tiny structured logger. Supports text (human) and json (machine) output.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const format = (process.env.LOG_FORMAT ?? "text").toLowerCase();
const minLevel: Level = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
const threshold = LEVELS[minLevel] ?? LEVELS.info;

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  if (format === "json") {
    process.stdout.write(JSON.stringify({ ts, level, msg, ...fields }) + "\n");
    return;
  }
  const tail = fields && Object.keys(fields).length > 0 ? " " + JSON.stringify(fields) : "";
  const line = `${ts} ${level.toUpperCase().padEnd(5)} ${msg}${tail}\n`;
  (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
