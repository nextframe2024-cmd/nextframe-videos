// Offline demo provider. Produces plausible, gently fluctuating prices so the
// whole pipeline (history -> detection -> email) is runnable without a network.
//
// Prices are derived from a per-route baseline plus a deterministic seasonal
// component and a small random jitter, so repeated scans yield a realistic
// price curve over time (with the occasional "deal").

import type { FlightOffer, QuoteResult, SearchQuery } from "../types.ts";
import { buildDeepLink, type Provider } from "./base.ts";

type RouteInfo = { base: number; direct: boolean; airlines: string[] };

const ROUTE_INFO: Record<string, RouteInfo> = {
  "HAN-BUD": { base: 386, direct: false, airlines: ["China Eastern", "Qatar Airways", "Air China"] },
  "SGN-BUD": { base: 359, direct: false, airlines: ["Turkish Airlines", "China Southern", "Qatar Airways"] },
  "BUD-TLV": { base: 95, direct: true, airlines: ["Wizz Air", "El Al", "Ryanair"] },
};

const DEFAULT_INFO: RouteInfo = {
  base: 420,
  direct: false,
  airlines: ["China Eastern", "Qatar Airways", "Air China", "Turkish Airlines"],
};

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
    const info = ROUTE_INFO[route.id] ?? DEFAULT_INFO;

    // Deterministic-per-hour seed so prices drift over time but are stable within a run.
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const seed = hashString(`${route.id}|${departDate}|${hourBucket}`);

    // +/- 18% wave plus an occasional dip to simulate a flash deal.
    const wave = (seed - 0.5) * 0.36;
    const flashDeal = seed > 0.92 ? -0.15 : 0;
    const price = Math.round(info.base * (1 + wave + flashDeal));

    // Short, direct-served routes can have 0-stop offers; long-haul starts at 1.
    const minStops = info.direct ? 0 : 1;
    const baseDuration = info.direct ? 210 : 900;

    const offers: FlightOffer[] = [];
    for (let i = 0; i < 3; i++) {
      const airline = info.airlines[Math.floor(hashString(route.id + i + departDate) * info.airlines.length)]!;
      offers.push({
        price: price + i * Math.round(15 + seed * 30),
        currency: query.currency,
        airline,
        // The cheapest option may add a connection; later options add stops/price.
        stops: minStops + (i === 2 ? 1 : 0),
        durationMinutes: baseDuration + Math.round(seed * 240) + i * 45,
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
