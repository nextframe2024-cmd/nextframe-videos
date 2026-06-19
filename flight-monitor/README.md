# ✈️ Flight Monitor

A small, self-contained agent that watches flight prices 24/7. It scans a set of
routes and dates on a schedule, stores every price in **SQLite**, detects
**new all-time lows**, **abnormal drops** and **deals**, and sends **one daily
summary** instead of flooding you with alerts.

Built to track the cheapest **Vietnam → Budapest** flights around **23 Jul 2026**
(one stop is fine — there are no direct flights on that route anyway), but the
routes and dates are fully configurable.

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
| `ROUTES` | `HAN-BUD,SGN-BUD` | Comma list of `ORIGIN-DESTINATION` IATA pairs |
| `DEPART_DATE` | `2026-07-23` | Target departure date (YYYY-MM-DD) |
| `DATE_WINDOW_DAYS` | `2` | Also scan ± this many days around the target |
| `MAX_STOPS` | `1` | Max stops to consider |
| `DROP_THRESHOLD` | `0.12` | Drop ≥ 12% vs last price → abnormal-drop |
| `DEAL_PRICE` | `300` | Price ≤ this → deal |
| `PROVIDER` | `mock` | `mock` or `skyscanner` (stub) |
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

## Going live with a real provider

`src/providers/mock.ts` generates plausible prices offline. To scrape real data,
implement `src/providers/skyscanner.stub.ts` (or a new provider) against the
`Provider` interface — typically with Playwright driving Skyscanner / Google
Flights, handling CAPTCHA and partial results — then set `PROVIDER=skyscanner`.
Everything downstream (history, detection, digest, health) stays the same.

## Docker / Coolify

```bash
docker compose up -d --build      # runs the 24/7 loop with a HEALTHCHECK
```

The SQLite DB, summaries and heartbeat persist under `./data`. In Coolify, point
a service at this folder, set the env vars, and it runs unattended.
