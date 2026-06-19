// Provider registry plus a polite, per-provider request cooldown wrapper.

import type { QuoteResult, SearchQuery } from "../types.ts";
import type { Provider } from "./base.ts";
import { MockProvider } from "./mock.ts";
import { SkyscannerProvider } from "./skyscanner.stub.ts";
import { log } from "../logger.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wraps a provider so consecutive requests are spaced by at least cooldownMs. */
class CooldownProvider implements Provider {
  readonly name: string;
  private last = 0;
  private inner: Provider;
  private cooldownMs: number;
  constructor(inner: Provider, cooldownMs: number) {
    this.inner = inner;
    this.cooldownMs = cooldownMs;
    this.name = inner.name;
  }

  async quote(query: SearchQuery): Promise<QuoteResult> {
    const wait = this.last + this.cooldownMs - Date.now();
    if (wait > 0) {
      log.debug("provider cooldown", { provider: this.name, waitMs: wait });
      await sleep(wait);
    }
    this.last = Date.now();
    try {
      return await this.inner.quote(query);
    } catch (err) {
      // A provider must never crash a scan cycle.
      return {
        query,
        provider: this.name,
        fetchedAt: new Date().toISOString(),
        ok: false,
        best: null,
        offers: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export function getProvider(name: string, cooldownMs: number): Provider {
  let inner: Provider;
  switch (name.toLowerCase()) {
    case "mock":
      inner = new MockProvider();
      break;
    case "skyscanner":
      inner = new SkyscannerProvider();
      break;
    default:
      log.warn("unknown provider, falling back to mock", { requested: name });
      inner = new MockProvider();
  }
  return new CooldownProvider(inner, cooldownMs);
}
