// SQLite price-history store, backed by Node's built-in node:sqlite module.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PricePoint } from "./types.ts";

export class PriceStore {
  private db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id    TEXT    NOT NULL,
        depart_date TEXT    NOT NULL,
        provider    TEXT    NOT NULL,
        price       REAL    NOT NULL,
        currency    TEXT    NOT NULL,
        airline     TEXT    NOT NULL,
        stops       INTEGER NOT NULL,
        deep_link   TEXT,
        fetched_at  TEXT    NOT NULL
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_route_date ON price_history (route_id, depart_date, fetched_at);",
    );
  }

  insert(p: PricePoint): void {
    this.db
      .prepare(
        `INSERT INTO price_history
           (route_id, depart_date, provider, price, currency, airline, stops, deep_link, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        p.routeId,
        p.departDate,
        p.provider,
        p.price,
        p.currency,
        p.airline,
        p.stops,
        p.deepLink,
        p.fetchedAt,
      );
  }

  /** Lowest price ever recorded for a route+date (null if none yet). */
  allTimeLow(routeId: string, departDate: string): number | null {
    const row = this.db
      .prepare(
        "SELECT MIN(price) AS lo FROM price_history WHERE route_id = ? AND depart_date = ?",
      )
      .get(routeId, departDate) as { lo: number | null } | undefined;
    return row?.lo ?? null;
  }

  /** Most recent price recorded for a route+date before now (null if none). */
  previousPrice(routeId: string, departDate: string): number | null {
    const row = this.db
      .prepare(
        `SELECT price FROM price_history
          WHERE route_id = ? AND depart_date = ?
          ORDER BY fetched_at DESC, id DESC
          LIMIT 1`,
      )
      .get(routeId, departDate) as { price: number } | undefined;
    return row?.price ?? null;
  }

  /** Cheapest current observation per route, taken from the latest fetch batch. */
  latestBestPerRoute(): PricePoint[] {
    const rows = this.db
      .prepare(
        `WITH ranked AS (
           SELECT *,
                  ROW_NUMBER() OVER (
                    PARTITION BY route_id
                    ORDER BY price ASC, fetched_at DESC
                  ) AS rn
           FROM price_history
           WHERE fetched_at >= (SELECT MAX(fetched_at) FROM price_history) -- latest cycle window
              OR fetched_at >= datetime((SELECT MAX(fetched_at) FROM price_history), '-1 hour')
         )
         SELECT route_id, depart_date, provider, price, currency, airline, stops, deep_link, fetched_at
         FROM ranked WHERE rn = 1
         ORDER BY route_id`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map(rowToPoint);
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM price_history").get() as { c: number };
    return row.c;
  }

  close(): void {
    this.db.close();
  }
}

function rowToPoint(r: Record<string, unknown>): PricePoint {
  return {
    routeId: String(r.route_id),
    departDate: String(r.depart_date),
    provider: String(r.provider),
    price: Number(r.price),
    currency: String(r.currency),
    airline: String(r.airline),
    stops: Number(r.stops),
    deepLink: r.deep_link === null ? null : String(r.deep_link),
    fetchedAt: String(r.fetched_at),
  };
}
