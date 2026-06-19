import type { QuoteResult, SearchQuery } from "../types.ts";

/** A price source. Implement this to plug in a real scraper or API. */
export interface Provider {
  readonly name: string;
  /** Fetch the cheapest offers for one query. Must never throw — return ok:false instead. */
  quote(query: SearchQuery): Promise<QuoteResult>;
  /** Optional: release resources (e.g. close a browser) at the end of a cycle. */
  close?(): Promise<void>;
}

/** Build a Google Flights search URL for a one-way trip. */
export function buildGoogleFlightsUrl(query: {
  origin: string;
  destination: string;
  departDate: string;
  currency: string;
}): string {
  const q = `Flights to ${query.destination} from ${query.origin} oneway on ${query.departDate}`;
  const params = new URLSearchParams({ q, curr: query.currency, hl: "en", gl: "us" });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

export function buildDeepLink(origin: string, destination: string, departDate: string): string {
  // Skyscanner one-way deep link uses YYMMDD.
  const ymd = departDate.replaceAll("-", "").slice(2);
  return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${ymd}/`;
}
