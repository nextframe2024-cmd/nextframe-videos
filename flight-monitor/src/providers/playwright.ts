// Live price provider that scrapes Google Flights with Playwright.
//
// This is the "hard part" the original post is about: real sites change
// structure, throw consent walls, CAPTCHAs and anti-bot challenges, and return
// partial data. The strategy here:
//   - one reusable browser per cycle (cheaper than launching per query),
//   - a realistic browser context (UA / locale / timezone / viewport),
//   - dismiss the Google consent wall when it appears,
//   - extract offers from role/aria attributes (more stable than CSS classes),
//   - NEVER throw: any block/timeout/empty result returns ok:false.
//
// Playwright is an optional dependency. Install it to use this provider:
//   npm install playwright && npx playwright install chromium
//
// Selectors on Google Flights do drift; treat the extraction step as the part
// most likely to need maintenance, and keep an eye on the logs.

import type { FlightOffer, QuoteResult, SearchQuery } from "../types.ts";
import { buildDeepLink, buildGoogleFlightsUrl, type Provider } from "./base.ts";
import { log } from "../logger.ts";

// Minimal structural types so this file type-checks without @types/playwright.
type Browser = { newContext(opts: unknown): Promise<BrowserContext>; close(): Promise<void> };
type BrowserContext = { newPage(): Promise<Page>; close(): Promise<void> };
type Page = {
  goto(url: string, opts?: unknown): Promise<unknown>;
  waitForSelector(sel: string, opts?: unknown): Promise<unknown>;
  getByRole(role: string, opts?: unknown): Locator;
  evaluate<T>(fn: () => T): Promise<T>;
  content(): Promise<string>;
  url(): string;
  close(): Promise<void>;
};
type Locator = { first(): Locator; click(opts?: unknown): Promise<void>; count(): Promise<number> };

type RawOffer = { price: number; airline: string; stops: number; durationMinutes?: number };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class PlaywrightProvider implements Provider {
  readonly name = "playwright";
  private headless: boolean;
  private navTimeoutMs: number;
  private locale: string;
  private browser: Browser | null = null;
  private launchFailed = false;

  constructor() {
    this.headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
    this.navTimeoutMs = Number(process.env.NAV_TIMEOUT_MS ?? 45000);
    this.locale = process.env.PW_LOCALE ?? "en-US";
  }

  private async getBrowser(): Promise<Browser | null> {
    if (this.browser) return this.browser;
    if (this.launchFailed) return null;
    let pw: { chromium: { launch(opts: unknown): Promise<Browser> } };
    try {
      pw = (await import("playwright")) as unknown as typeof pw;
    } catch {
      this.launchFailed = true;
      log.error("playwright not installed — run `npm install playwright && npx playwright install chromium`");
      return null;
    }
    try {
      this.browser = await pw.chromium.launch({
        headless: this.headless,
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      });
      return this.browser;
    } catch (err) {
      this.launchFailed = true;
      log.error("chromium launch failed (browser binary missing?)", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async quote(query: SearchQuery): Promise<QuoteResult> {
    const { route, departDate } = query;
    const fail = (error: string): QuoteResult => ({
      query,
      provider: this.name,
      fetchedAt: new Date().toISOString(),
      ok: false,
      best: null,
      offers: [],
      error,
    });

    const browser = await this.getBrowser();
    if (!browser) return fail("browser unavailable");

    const url = buildGoogleFlightsUrl({
      origin: route.origin,
      destination: route.destination,
      departDate,
      currency: query.currency,
    });

    let context: BrowserContext | null = null;
    try {
      context = await browser.newContext({
        userAgent: USER_AGENT,
        locale: this.locale,
        timezoneId: process.env.PW_TIMEZONE ?? "UTC",
        viewport: { width: 1366, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.navTimeoutMs });
      await dismissConsent(page);

      // Results render asynchronously; wait for the itinerary list to appear.
      await page.waitForSelector('li[role="listitem"], [role="list"] [role="listitem"]', {
        timeout: this.navTimeoutMs,
      });

      const raw = await extractOffers(page);
      if (raw.length === 0) {
        const blocked = /unusual traffic|not a robot|recaptcha/i.test(await page.content());
        return fail(blocked ? "anti-bot challenge" : "no offers parsed");
      }

      const deepLink = buildDeepLink(route.origin, route.destination, departDate);
      const offers: FlightOffer[] = raw
        .map((o) => ({
          price: o.price,
          currency: query.currency,
          airline: o.airline || "Unknown",
          stops: o.stops,
          durationMinutes: o.durationMinutes,
          deepLink,
        }))
        .filter((o) => o.stops <= query.maxStops)
        .sort((a, b) => a.price - b.price);

      const best = offers[0] ?? null;
      return {
        query,
        provider: this.name,
        fetchedAt: new Date().toISOString(),
        ok: best !== null,
        best,
        offers,
        error: best ? undefined : "no offer within max stops",
      };
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    } finally {
      await context?.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
  }
}

/** Click through the EU consent wall if Google shows one. */
async function dismissConsent(page: Page): Promise<void> {
  if (!/consent\.google\.com/.test(page.url())) return;
  for (const label of ["Reject all", "Accept all", "I agree"]) {
    try {
      const btn = page.getByRole("button", { name: label }).first();
      if ((await btn.count()) > 0) {
        await btn.click({ timeout: 5000 });
        return;
      }
    } catch {
      /* try the next label */
    }
  }
}

/**
 * Pull offers out of the results DOM. Google Flights labels each itinerary row
 * with an aria-label that contains the price ("From 318 US dollars"), the stop
 * count ("Nonstop" / "1 stop") and a duration ("16 hr 25 min"). Parsing the
 * aria-label is far more durable than relying on obfuscated CSS class names.
 */
async function extractOffers(page: Page): Promise<RawOffer[]> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('li[role="listitem"]'));
    const out: RawOffer[] = [];
    for (const row of rows) {
      const label = row.getAttribute("aria-label") ?? row.textContent ?? "";
      const priceMatch = label.match(/(\d[\d,]*)\s*(US dollars|USD|EUR|euros?|\$|€)/i);
      const altPrice = label.match(/[$€]\s?(\d[\d,]*)/);
      const rawPrice = priceMatch?.[1] ?? altPrice?.[1];
      if (!rawPrice) continue;
      const price = Number(rawPrice.replace(/,/g, ""));
      if (!Number.isFinite(price) || price <= 0) continue;

      let stops = 0;
      const stopMatch = label.match(/(\d+)\s*stop/i);
      if (/nonstop/i.test(label)) stops = 0;
      else if (stopMatch?.[1]) stops = Number(stopMatch[1]);
      else stops = 1; // unknown -> assume a connection

      let durationMinutes: number | undefined;
      const dur = label.match(/(\d+)\s*hr(?:\s*(\d+)\s*min)?/i);
      if (dur?.[1]) durationMinutes = Number(dur[1]) * 60 + Number(dur[2] ?? 0);

      const airlineMatch = label.match(/(?:with|on|operated by)\s+([A-Z][A-Za-z' ]+?)(?:\.|,| flight)/);
      const airline = airlineMatch?.[1]?.trim() ?? "";

      out.push({ price, airline, stops, durationMinutes });
    }
    return out;
  });
}
