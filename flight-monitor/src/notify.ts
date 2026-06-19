// Builds a daily digest and delivers it: email if SMTP is configured, otherwise
// the summary is written to data/summaries/ (and always echoed to the log).
//
// One digest a day beats a flood of per-event alerts (per the original post).

import { mkdirSync, writeFileSync } from "node:fs";
import type { Config } from "./config.ts";
import { PriceStore } from "./db.ts";
import type { Finding } from "./types.ts";
import { log } from "./logger.ts";

const FINDING_EMOJI: Record<string, string> = {
  "all-time-low": "🟢",
  "abnormal-drop": "🔻",
  deal: "🔥",
};

export function buildSummary(cfg: Config, store: PriceStore, findings: Finding[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const bests = store.latestBestPerRoute();
  const lines: string[] = [];

  lines.push(`# ✈️ Flight Monitor — daily summary ${today}`);
  lines.push("");
  const routeList = cfg.routeSpecs
    .map((s) => `${s.route.id} (~${s.targetDate})`)
    .join(", ");
  lines.push(`Watching: **${routeList}** · ±${(cfg.routeSpecs[0]?.dates.length ?? 1) >> 1}d · max stops: **${cfg.maxStops}** · provider: **${cfg.provider}**`);
  lines.push("");

  lines.push("## Cheapest right now");
  lines.push("");
  lines.push("| Route | Best price | Date | Airline | Stops | All-time low |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const b of bests) {
    const atl = store.allTimeLow(b.routeId, b.departDate);
    lines.push(
      `| ${b.routeId} | **${b.price} ${b.currency}** | ${b.departDate} | ${b.airline} | ${b.stops} | ${atl ?? "—"} |`,
    );
  }
  lines.push("");

  lines.push("## Findings");
  lines.push("");
  if (findings.length === 0) {
    lines.push("_No new lows, drops, or deals this cycle._");
  } else {
    for (const f of findings) {
      const emoji = FINDING_EMOJI[f.kind] ?? "•";
      const link = f.current.deepLink ? ` — [book](${f.current.deepLink})` : "";
      lines.push(`- ${emoji} **${f.routeId}** (${f.departDate}): ${f.message}${link}`);
    }
  }
  lines.push("");
  lines.push(`_${store.count()} price points stored._`);
  lines.push("");
  return lines.join("\n");
}

export async function deliver(cfg: Config, summary: string): Promise<void> {
  const sent = await trySendEmail(cfg, summary);
  if (!sent) {
    const dir = "data/summaries";
    mkdirSync(dir, { recursive: true });
    const path = `${dir}/summary-${new Date().toISOString().slice(0, 10)}.md`;
    writeFileSync(path, summary, "utf8");
    log.info("summary written to file (email not configured/available)", { path });
  }
}

async function trySendEmail(cfg: Config, summary: string): Promise<boolean> {
  const { to, from, smtpHost, smtpPort, smtpUser, smtpPass } = cfg.email;
  if (!to || !smtpHost) {
    log.debug("email skipped: EMAIL_TO or SMTP_HOST not set");
    return false;
  }
  let nodemailer: typeof import("nodemailer");
  try {
    nodemailer = await import("nodemailer");
  } catch {
    log.warn("nodemailer not installed — run `npm install` to enable email");
    return false;
  }
  try {
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
    await transport.sendMail({
      from,
      to,
      subject: `✈️ Flight Monitor — ${new Date().toISOString().slice(0, 10)}`,
      text: summary,
    });
    log.info("daily summary emailed", { to });
    return true;
  } catch (err) {
    log.error("email send failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
