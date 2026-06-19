import type { QuoteResult, SearchQuery } from "../types.ts";

/** A price source. Implement this to plug in a real scraper or API. */
export interface Provider {
  readonly name: string;
  /** Fetch the cheapest offers for one query. Must never throw — return ok:false instead. */
  quote(query: SearchQuery): Promise<QuoteResult>;
}

export function buildDeepLink(origin: string, destination: string, departDate: string): string {
  // Skyscanner one-way deep link uses YYMMDD.
  const ymd = departDate.replaceAll("-", "").slice(2);
  return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${ymd}/`;
}
