// Offline demo provider. Produces plausible, gently fluctuating prices so the
// whole pipeline (history -> detection -> email) is runnable without a network.
//
// Prices are derived from a per-route baseline plus a deterministic seasonal
// component and a small random jitter, so repeated scans yield a realistic
// price curve over time (with the occasional "deal").

import type { FlightOffer, QuoteResult, SearchQuery } from "../types.ts";
import { buildDeepLink, type Provider } from "./base.ts";

const BASELINES: Record<string, number> = {
  "HAN-BUD": 386,
  "SGN-BUD": 359,
};

const AIRLINES = ["China Eastern", "Qatar Airways", "Air China", "Turkish Airlines"];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // 0..1
}

export class MockProvider implements Provider {
  readonly name = "mock";

  async quote(query: SearchQuery): Promise<QuoteResult> {
    const { route, departDate } = query;
    const baseline = BASELINES[route.id] ?? 420;

    // Deterministic-per-hour seed so prices drift over time but are stable within a run.
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const seed = hashString(`${route.id}|${departDate}|${hourBucket}`);

    // +/- 18% wave plus an occasional dip to simulate a flash deal.
    const wave = (seed - 0.5) * 0.36;
    const flashDeal = seed > 0.92 ? -0.15 : 0;
    const price = Math.round(baseline * (1 + wave + flashDeal));

    const offers: FlightOffer[] = [];
    const stopCount = seed > 0.7 ? 1 : 1; // Vietnam->Budapest is always >=1 stop
    for (let i = 0; i < 3; i++) {
      const airline = AIRLINES[Math.floor(hashString(route.id + i + departDate) * AIRLINES.length)]!;
      offers.push({
        price: price + i * Math.round(20 + seed * 30),
        currency: query.currency,
        airline,
        stops: Math.min(stopCount + (i === 2 ? 1 : 0), query.maxStops + 1),
        durationMinutes: 900 + Math.round(seed * 360) + i * 45,
        deepLink: buildDeepLink(route.origin, route.destination, departDate),
      });
    }

    const eligible = offers
      .filter((o) => o.stops <= query.maxStops)
      .sort((a, b) => a.price - b.price);
    const best = eligible[0] ?? null;

    return {
      query,
      provider: this.name,
      fetchedAt: new Date().toISOString(),
      ok: true,
      best,
      offers,
    };
  }
}
