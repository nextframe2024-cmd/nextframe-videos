// Turns a fresh quote (plus history) into findings: new lows, abnormal drops, deals.

import type { Finding, FlightOffer } from "./types.ts";

export type AnalyzeInput = {
  routeId: string;
  departDate: string;
  current: FlightOffer;
  /** Most recent price before this observation, or null if first time. */
  previousPrice: number | null;
  /** Lowest price ever seen before this observation, or null if first time. */
  previousAllTimeLow: number | null;
  dropThreshold: number;
  dealPrice: number;
};

export function analyze(input: AnalyzeInput): Finding[] {
  const { routeId, departDate, current, previousPrice, previousAllTimeLow } = input;
  const findings: Finding[] = [];
  const price = current.price;

  // New all-time low (strictly below the previous record).
  if (previousAllTimeLow !== null && price < previousAllTimeLow) {
    findings.push({
      kind: "all-time-low",
      routeId,
      departDate,
      message: `New all-time low ${price} ${current.currency} (was ${previousAllTimeLow})`,
      current,
      allTimeLow: price,
    });
  }

  // Abnormal drop relative to the previous observation.
  if (previousPrice !== null && previousPrice > 0) {
    const dropFrac = (previousPrice - price) / previousPrice;
    if (dropFrac >= input.dropThreshold) {
      findings.push({
        kind: "abnormal-drop",
        routeId,
        departDate,
        message: `Dropped ${(dropFrac * 100).toFixed(0)}% to ${price} ${current.currency} (from ${previousPrice})`,
        current,
        previousPrice,
      });
    }
  }

  // Absolute deal threshold.
  if (price <= input.dealPrice) {
    findings.push({
      kind: "deal",
      routeId,
      departDate,
      message: `Deal: ${price} ${current.currency} <= ${input.dealPrice}`,
      current,
    });
  }

  return findings;
}
