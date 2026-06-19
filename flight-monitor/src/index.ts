// Entry point: run one scan cycle and deliver the daily summary.
//
//   npm run scan            # scan + store + summary
//   npm run summary         # rebuild & deliver summary only (no new scan)

import { loadConfig } from "./config.ts";
import { PriceStore } from "./db.ts";
import { runScanCycle } from "./scan.ts";
import { buildSummary, deliver } from "./notify.ts";
import { writeHealth } from "./health.ts";
import { log } from "./logger.ts";

async function main(): Promise<void> {
  const summaryOnly = process.argv.includes("--summary-only");
  const cfg = loadConfig();
  const store = new PriceStore(cfg.dbPath);
  try {
    const findings = summaryOnly ? [] : (await runScanCycle(cfg, store)).findings;
    const summary = buildSummary(cfg, store, findings);
    await deliver(cfg, summary);
    writeHealth({ ok: true, findings: findings.length, rows: store.count() });
  } catch (err) {
    log.error("scan cycle crashed", { error: err instanceof Error ? err.stack : String(err) });
    writeHealth({ ok: false, error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    store.close();
  }
}

await main();
