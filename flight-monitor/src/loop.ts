// Long-running loop for 24/7 operation: run a scan cycle, deliver the summary,
// sleep, repeat. Handles SIGINT/SIGTERM for a clean shutdown under Docker.

import { loadConfig } from "./config.ts";
import { PriceStore } from "./db.ts";
import { runScanCycle } from "./scan.ts";
import { buildSummary, deliver } from "./notify.ts";
import { writeHealth } from "./health.ts";
import { log } from "./logger.ts";

const INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS ?? 6 * 60 * 60 * 1000); // 6h
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = true;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log.info("shutdown requested", { signal: sig });
    running = false;
  });
}

async function once(): Promise<void> {
  const cfg = loadConfig();
  const store = new PriceStore(cfg.dbPath);
  try {
    const { findings } = await runScanCycle(cfg, store);
    const summary = buildSummary(cfg, store, findings);
    await deliver(cfg, summary);
    writeHealth({ ok: true, findings: findings.length, rows: store.count() });
  } catch (err) {
    log.error("cycle failed", { error: err instanceof Error ? err.message : String(err) });
    writeHealth({ ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    store.close();
  }
}

log.info("monitor loop online", { intervalMs: INTERVAL_MS });
while (running) {
  await once();
  if (!running) break;
  log.info("sleeping until next cycle", { nextInMin: Math.round(INTERVAL_MS / 60000) });
  // Sleep in short slices so signals are handled promptly.
  const wakeAt = Date.now() + INTERVAL_MS;
  while (running && Date.now() < wakeAt) await sleep(Math.min(1000, wakeAt - Date.now()));
}
log.info("monitor loop stopped");
