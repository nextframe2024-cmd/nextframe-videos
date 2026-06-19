# ✈️ Flight Monitor

A small, self-contained agent that watches flight prices 24/7. It scans a set of
routes and dates on a schedule, stores every price in **SQLite**, detects
**new all-time lows**, **abnormal drops** and **deals**, and sends **one daily
summary** instead of flooding you with alerts.

Ships preconfigured to track the cheapest **Vietnam → Budapest** flights around
**23 Jul 2026** (one stop is fine — there are no direct flights on that route
anyway) plus **Budapest → Tel Aviv** around **3 Aug 2026**. Each route carries
its own target date, and everything is configurable.

> Inspired by the "AI flight monitoring agent" idea: the easy part is the
> pipeline; the hard part is scraping real sites with anti-bot/CAPTCHA. The
> scraping lives behind a `Provider` interface so you can plug in Playwright
> later. A working offline `mock` provider ships by default.

## Highlights

- **Zero install to run.** Uses Node ≥ 22.18 built-ins only — `node:sqlite` for
  storage and native TypeScript execution. `npm install` is optional (only adds
  email via `nodemailer`).
- **Price history in SQLite** with all-time-low / previous-price queries.
- **Detection**: new all-time low, abnormal drop (configurable %), deal (absolute price).
- **Daily digest** by email (SMTP) or written to `data/summaries/` if email is off.
- **Pluggable providers** with a **per-provider cooldown** to stay polite / avoid blocks.
- **Health check** heartbeat for Docker `HEALTHCHECK` / uptime probes.
- **Docker + Compose** for Coolify / any host. Structured (text or JSON) logs.

## Quick start

```bash
cd flight-monitor
cp .env.example .env          # edit routes/dates/thresholds/email
npm run scan                  # one scan cycle + summary
cat data/summaries/summary-*.md
```

Other commands:

```bash
npm run loop        # run forever on an interval (24/7 mode)
npm run summary     # rebuild & send the summary without a new scan
npm run health      # exit 0 if healthy, non-zero otherwise
npm test            # unit tests for the detection logic
npm run typecheck   # full TypeScript check (needs `npm i -D typescript`)
```

## Configuration (`.env`)

| Var | Default | Meaning |
| --- | --- | --- |
| `ROUTES` | `HAN-BUD@2026-07-23,SGN-BUD@2026-07-23,BUD-TLV@2026-08-03` | Comma list of `ORIGIN-DESTINATION[@YYYY-MM-DD]`; the per-route `@date` is optional |
| `DEPART_DATE` | `2026-07-23` | Default date for routes given without an `@date` |
| `DATE_WINDOW_DAYS` | `2` | Also scan ± this many days around each route's date |
| `MAX_STOPS` | `1` | Max stops to consider |
| `DROP_THRESHOLD` | `0.12` | Drop ≥ 12% vs last price → abnormal-drop |
| `DEAL_PRICE` | `300` | Price ≤ this → deal |
| `PROVIDER` | `mock` | `mock`, `playwright` (live Google Flights), or `skyscanner` (stub) |
| `PROVIDER_COOLDOWN_MS` | `4000` | Min gap between provider requests |
| `EMAIL_TO` / `SMTP_*` | — | Set to email the digest; otherwise it's written to a file |
| `SCAN_INTERVAL_MS` | `21600000` | Loop interval (6h) for `npm run loop` |

## How it works

```
config (routes × dates)
        │  buildQueries()
        ▼
   Provider.quote()  ──(cooldown)──►  cheapest offer per query
        │
        ▼
   SQLite price_history  ──►  analyze(prev, all-time-low, thresholds)
        │                              │
        ▼                              ▼
   daily summary  ◄───────────────  findings (low / drop / deal)
        │
        ▼
   email  or  data/summaries/*.md   +   data/health.json heartbeat
```

## Live scraping (Playwright → Google Flights)

`src/providers/playwright.ts` is a real provider that drives a headless Chromium
against Google Flights, dismisses the consent wall, and extracts the cheapest
itineraries from each result row's `aria-label` (more durable than obfuscated
CSS classes). Everything downstream — history, detection, digest, health —
stays identical; only the data source changes.

```bash
npm install                 # pulls in playwright (optional dep)
npm run install:browser     # downloads the Chromium binary
PROVIDER=playwright npm run scan
```

Tuning lives in `.env`: `HEADLESS`, `NAV_TIMEOUT_MS`, `PW_LOCALE`, `PW_TIMEZONE`,
and `PROVIDER_COOLDOWN_MS` (keep this generous — a few seconds — to stay polite
and reduce blocks).

**Reality check (per the original post):** consumer flight sites run aggressive
anti-bot defences (Cloudflare, CAPTCHA, consent walls) and change their DOM
often. From a datacenter IP the page may return a challenge instead of results —
the provider detects this and returns `ok:false` so the cycle keeps going. Run
it from a residential/private host (as in the post) for best results, treat the
extraction selectors as the part most likely to need maintenance, and consider
a partner API (Amadeus/Kiwi) if you need higher reliability. `src/providers/skyscanner.stub.ts`
remains as a template for adding another source.

## Docker / Coolify

```bash
docker compose up -d --build      # runs the 24/7 loop with a HEALTHCHECK
```

The SQLite DB, summaries and heartbeat persist under `./data`. In Coolify, point
a service at this folder, set the env vars, and it runs unattended.
