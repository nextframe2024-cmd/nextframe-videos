// Template for a REAL price provider.
//
// The hard part of a flight monitor (per the original post) is not the pipeline
// — it's scraping sites that change structure, throw CAPTCHAs and anti-bot
// challenges, and return partial data. That belongs behind this same interface.
//
// A production implementation typically:
//   1. Drives a headless browser (Playwright) with a realistic context.
//   2. Navigates to a results page (Skyscanner / Google Flights / a partner API).
//   3. Waits for prices to settle, then extracts the cheapest itineraries.
//   4. Handles CAPTCHA / blocks by backing off and respecting the cooldown.
//   5. Normalises currency and returns ok:false on any failure (never throws).
//
// It is intentionally left as a stub here because running a live, anti-bot-aware
// scraper is out of scope for this repo. Set PROVIDER=skyscanner and finish the
// TODO to go live.

import type { QuoteResult, SearchQuery } from "../types.ts";
import { buildDeepLink, type Provider } from "./base.ts";

export class SkyscannerProvider implements Provider {
  readonly name = "skyscanner";

  async quote(query: SearchQuery): Promise<QuoteResult> {
    const { route, departDate } = query;
    // TODO: launch Playwright, open buildDeepLink(...), scrape cheapest offers.
    return {
      query,
      provider: this.name,
      fetchedAt: new Date().toISOString(),
      ok: false,
      best: null,
      offers: [],
      error:
        "SkyscannerProvider is a stub. Implement Playwright scraping here. " +
        `Deep link: ${buildDeepLink(route.origin, route.destination, departDate)}`,
    };
  }
}
