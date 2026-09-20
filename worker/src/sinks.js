/**
 * Where a parsed lead goes.
 *
 * The sink is swappable on purpose: today it appends to a throwaway Google
 * Sheet, and pointing it at the real tables later is a change in one place.
 */

/** Writes to a Google Apps Script web app that appends rows to a Sheet. */
class SheetsSink {
  constructor({ url, token }) {
    this.url = url;
    this.token = token;
  }

  async write(leads) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.token, leads }),
    });

    const body = await response.text().catch(() => '');

    if (!response.ok) {
      throw new Error(`sheets sink HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    // An Apps Script web app answers 200 even when it refuses the request, so
    // the body is the only signal that the rows were actually appended.
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error(`sheets sink returned non-JSON: ${body.slice(0, 200)}`);
    }
    if (result.ok !== true) {
      throw new Error(`sheets sink refused: ${result.error ?? 'unknown'}`);
    }
  }
}

/** Fallback for local runs: prints the lead so `wrangler tail` shows it. */
class LogSink {
  async write(leads) {
    for (const lead of leads) console.log('lead', JSON.stringify(lead));
  }
}

export function selectSink(env) {
  if (env.SHEETS_WEBAPP_URL) {
    return new SheetsSink({
      url: env.SHEETS_WEBAPP_URL,
      token: env.SHEETS_TOKEN,
    });
  }
  return new LogSink();
}
