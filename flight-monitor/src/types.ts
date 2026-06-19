// Shared domain types for the flight monitor.

export type Route = {
  /** Stable id, e.g. "HAN-BUD". */
  id: string;
  /** Origin IATA code, e.g. "HAN". */
  origin: string;
  /** Destination IATA code, e.g. "BUD". */
  destination: string;
};

export type SearchQuery = {
  route: Route;
  /** Departure date, YYYY-MM-DD. */
  departDate: string;
  /** Maximum number of stops allowed. */
  maxStops: number;
  currency: string;
};

export type FlightOffer = {
  price: number;
  currency: string;
  airline: string;
  stops: number;
  durationMinutes?: number;
  deepLink?: string;
};

/** Result of asking a provider for the cheapest offers for one query. */
export type QuoteResult = {
  query: SearchQuery;
  provider: string;
  /** ISO timestamp of when the quote was fetched. */
  fetchedAt: string;
  ok: boolean;
  best: FlightOffer | null;
  offers: FlightOffer[];
  error?: string;
};

/** A price observation as stored in / read from the database. */
export type PricePoint = {
  routeId: string;
  departDate: string;
  provider: string;
  price: number;
  currency: string;
  airline: string;
  stops: number;
  deepLink: string | null;
  fetchedAt: string;
};

export type FindingKind = "all-time-low" | "abnormal-drop" | "deal";

export type Finding = {
  kind: FindingKind;
  routeId: string;
  departDate: string;
  message: string;
  current: FlightOffer;
  previousPrice?: number;
  allTimeLow?: number;
};
