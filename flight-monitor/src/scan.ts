// Orchestrates one scan cycle: query every route/date, store results, detect findings.

import type { Config } from "./config.ts";
import { buildQueries } from "./config.ts";
import { PriceStore } from "./db.ts";
import { getProvider } from "./providers/index.ts";
import { analyze } from "./analyze.ts";
import type { Finding, PricePoint } from "./types.ts";
import { log } from "./logger.ts";

export type ScanResult = {
  findings: Finding[];
  ok: number;
  failed: number;
  total: number;
};

export async function runScanCycle(cfg: Config, store: PriceStore): Promise<ScanResult> {
  const provider = getProvider(cfg.provider, cfg.providerCooldownMs);
  const queries = buildQueries(cfg);
  const findings: Finding[] = [];
  let ok = 0;
  let failed = 0;

  log.info("scan started", {
    provider: cfg.provider,
    routes: cfg.routeSpecs.length,
    queries: queries.length,
  });

  try {
    for (const query of queries) {
      const { id: routeId } = query.route;
      const { departDate } = query;

      // Read history BEFORE inserting the new point.
      const previousPrice = store.previousPrice(routeId, departDate);
      const previousAllTimeLow = store.allTimeLow(routeId, departDate);

      const result = await provider.quote(query);
      if (!result.ok || !result.best) {
        failed++;
        log.warn("quote failed", { routeId, departDate, error: result.error });
        continue;
      }
      ok++;
      const best = result.best;

      const point: PricePoint = {
        routeId,
        departDate,
        provider: result.provider,
        price: best.price,
        currency: best.currency,
        airline: best.airline,
        stops: best.stops,
        deepLink: best.deepLink ?? null,
        fetchedAt: result.fetchedAt,
      };
      store.insert(point);

      const newFindings = analyze({
        routeId,
        departDate,
        current: best,
        previousPrice,
        previousAllTimeLow,
        dropThreshold: cfg.dropThreshold,
        dealPrice: cfg.dealPrice,
      });
      for (const f of newFindings) {
        log.info("finding", { kind: f.kind, routeId, departDate, msg: f.message });
        findings.push(f);
      }
    }
  } finally {
    // Release provider resources (e.g. close the Playwright browser).
    await provider.close?.();
  }

  log.info("scan finished", { ok, failed, findings: findings.length, totalRows: store.count() });
  return { findings, ok, failed, total: queries.length };
}
