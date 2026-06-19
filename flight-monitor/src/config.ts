// Loads configuration from the environment and expands it into search queries.

import type { Route, SearchQuery } from "./types.ts";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** A route together with its own target departure date and scan window. */
export type RouteSpec = {
  route: Route;
  targetDate: string;
  dates: string[];
};

/**
 * Parse "HAN-BUD@2026-07-23,BUD-TLV@2026-08-03" into route specs. The "@date"
 * is optional; routes without one fall back to `defaultDate`. Each route gets
 * its own ± `windowDays` scan window, so different routes can target different
 * dates in a single cycle.
 */
function parseRoutes(raw: string, defaultDate: string, windowDays: number): RouteSpec[] {
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .map((entry) => {
      const [pair, date] = entry.split("@");
      const [origin, destination] = (pair ?? "").split("-");
      if (!origin || !destination) {
        throw new Error(`Invalid route "${entry}" — expected ORIGIN-DESTINATION[@YYYY-MM-DD], e.g. HAN-BUD@2026-07-23`);
      }
      const route: Route = { id: `${origin}-${destination}`, origin, destination };
      const targetDate = date ?? defaultDate;
      return { route, targetDate, dates: dateWindow(targetDate, windowDays) };
    });
}

/** Returns YYYY-MM-DD strings for [target - window, target + window]. */
function dateWindow(target: string, windowDays: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    throw new Error(`Departure date must be YYYY-MM-DD, got "${target}"`);
  }
  const base = new Date(`${target}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) throw new Error(`Invalid departure date "${target}"`);
  const out: string[] = [];
  for (let d = -windowDays; d <= windowDays; d++) {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + d);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export type Config = {
  routeSpecs: RouteSpec[];
  maxStops: number;
  currency: string;
  dropThreshold: number;
  dealPrice: number;
  provider: string;
  providerCooldownMs: number;
  email: {
    to: string;
    from: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
  };
  dbPath: string;
};

export function loadConfig(): Config {
  const defaultDate = env("DEPART_DATE", "2026-07-23");
  const windowDays = num("DATE_WINDOW_DAYS", 2);
  const routeSpecs = parseRoutes(
    env("ROUTES", "HAN-BUD@2026-07-23,SGN-BUD@2026-07-23,BUD-TLV@2026-08-03"),
    defaultDate,
    windowDays,
  );
  return {
    routeSpecs,
    maxStops: num("MAX_STOPS", 1),
    currency: env("CURRENCY", "USD"),
    dropThreshold: num("DROP_THRESHOLD", 0.12),
    dealPrice: num("DEAL_PRICE", 300),
    provider: env("PROVIDER", "mock"),
    providerCooldownMs: num("PROVIDER_COOLDOWN_MS", 4000),
    email: {
      to: env("EMAIL_TO", ""),
      from: env("EMAIL_FROM", "Flight Monitor <bot@example.com>"),
      smtpHost: env("SMTP_HOST", ""),
      smtpPort: num("SMTP_PORT", 587),
      smtpUser: env("SMTP_USER", ""),
      smtpPass: env("SMTP_PASS", ""),
    },
    dbPath: env("DB_PATH", "data/prices.db"),
  };
}

/** Expand each route over its own date window into the full set of queries. */
export function buildQueries(cfg: Config): SearchQuery[] {
  const queries: SearchQuery[] = [];
  for (const spec of cfg.routeSpecs) {
    for (const departDate of spec.dates) {
      queries.push({ route: spec.route, departDate, maxStops: cfg.maxStops, currency: cfg.currency });
    }
  }
  return queries;
}
