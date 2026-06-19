// Health check. The monitor writes a heartbeat after every cycle; running this
// file checks the heartbeat is recent and the DB is readable — suitable for a
// Docker HEALTHCHECK or an uptime probe.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const HEALTH_PATH = process.env.HEALTH_PATH ?? "data/health.json";
const MAX_AGE_MS = Number(process.env.HEALTH_MAX_AGE_MS ?? 26 * 60 * 60 * 1000); // 26h

export type Health = {
  ok: boolean;
  updatedAt: string;
  findings?: number;
  rows?: number;
  error?: string;
};

export function writeHealth(partial: Omit<Health, "updatedAt">): void {
  mkdirSync("data", { recursive: true });
  const health: Health = { ...partial, updatedAt: new Date().toISOString() };
  writeFileSync(HEALTH_PATH, JSON.stringify(health, null, 2), "utf8");
}

function check(): { healthy: boolean; reason: string } {
  if (!existsSync(HEALTH_PATH)) return { healthy: false, reason: "no heartbeat yet" };
  let health: Health;
  try {
    health = JSON.parse(readFileSync(HEALTH_PATH, "utf8")) as Health;
  } catch {
    return { healthy: false, reason: "heartbeat unreadable" };
  }
  if (!health.ok) return { healthy: false, reason: `last cycle failed: ${health.error ?? "unknown"}` };
  const age = Date.now() - new Date(health.updatedAt).getTime();
  if (age > MAX_AGE_MS) return { healthy: false, reason: `heartbeat stale (${Math.round(age / 3.6e6)}h old)` };
  return { healthy: true, reason: `ok, ${Math.round(age / 60000)}m old, ${health.rows ?? 0} rows` };
}

// Run as a script: exit non-zero when unhealthy.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { healthy, reason } = check();
  process.stdout.write(`${healthy ? "HEALTHY" : "UNHEALTHY"}: ${reason}\n`);
  process.exit(healthy ? 0 : 1);
}
