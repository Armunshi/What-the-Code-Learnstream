import { test as base, type Page, type Request, type Response, type ConsoleMessage } from '@playwright/test';
import {
  writeTestLog,
  type NetworkEntry,
  type ConsoleEntry,
  type PageErrorEntry,
  type TestLogEntry,
} from '../lib/log-writer.js';
import { buildDuplicateFindings } from '../lib/duplicate-detection.js';

let nextId = 1;

export class NetworkLogger {
  private entries = new Map<Request, NetworkEntry>();
  private consoleEntries: (ConsoleEntry | PageErrorEntry)[] = [];

  onRequest(req: Request): void {
    this.entries.set(req, {
      id: nextId++,
      timestamp: new Date().toISOString(),
      method: req.method(),
      url: req.url(),
      requestBodySize: req.postDataBuffer()?.length ?? null,
      status: null,
      responseBodySize: null,
      bodySizeUnavailable: false,
      durationMs: null,
    });
  }

  async onResponse(req: Request, res: Response | null): Promise<void> {
    const entry = this.entries.get(req);
    if (!entry || !res) return;

    entry.status = res.status();

    try {
      const timing = req.timing();
      entry.durationMs =
        timing && timing.responseEnd >= 0 ? Math.round(timing.responseEnd) : null;
    } catch {
      entry.durationMs = null;
    }

    try {
      const body = await res.body();
      entry.responseBodySize = body.length;
    } catch {
      const contentLength = res.headers()['content-length'];
      if (contentLength) {
        entry.responseBodySize = Number(contentLength);
      } else {
        entry.responseBodySize = null;
        entry.bodySizeUnavailable = true;
      }
    }
  }

  onRequestFailed(req: Request): void {
    const entry = this.entries.get(req);
    if (entry) entry.bodySizeUnavailable = true;
  }

  onConsole(msg: ConsoleMessage): void {
    const loc = msg.location();
    this.consoleEntries.push({
      timestamp: new Date().toISOString(),
      type: msg.type(),
      text: msg.text(),
      location: loc ? { url: loc.url, lineNumber: loc.lineNumber, columnNumber: loc.columnNumber } : undefined,
    });
  }

  onPageError(err: Error): void {
    this.consoleEntries.push({
      timestamp: new Date().toISOString(),
      type: 'pageerror',
      message: err.message,
      stack: err.stack,
    });
  }

  /** All captured requests so far, response fields filled in where available. */
  getEntries(): NetworkEntry[] {
    return [...this.entries.values()];
  }

  getConsoleEntries(): (ConsoleEntry | PageErrorEntry)[] {
    return this.consoleEntries;
  }

  /**
   * Console/page errors only — the assertion most specs make: this must be
   * empty. Pass `ignore` (see lib/console-allowlist.ts) to exclude known,
   * accepted noise so it doesn't drown out a genuinely new error.
   */
  getConsoleErrors(ignore: RegExp[] = []): (ConsoleEntry | PageErrorEntry)[] {
    return this.consoleEntries.filter((e) => {
      if (e.type !== 'error' && e.type !== 'pageerror') return false;
      // "Failed to load resource" browser-level errors put the failing URL
      // in `location.url`, not in `text` — an allowlist pattern matching a
      // URL (e.g. a specific endpoint) needs both checked, or it silently
      // never matches this class of console entry.
      const text = 'text' in e ? e.text : e.message;
      const locationUrl = 'location' in e ? e.location?.url ?? '' : '';
      const haystack = `${text} ${locationUrl}`;
      return !ignore.some((pattern) => pattern.test(haystack));
    });
  }
}

function attach(page: Page, logger: NetworkLogger): void {
  page.on('request', (req) => logger.onRequest(req));
  page.on('requestfinished', async (req) => logger.onResponse(req, await req.response().catch(() => null)));
  page.on('requestfailed', (req) => logger.onRequestFailed(req));
  page.on('console', (msg) => logger.onConsole(msg));
  page.on('pageerror', (err) => logger.onPageError(err));
}

export const test = base.extend<{ networkLogger: NetworkLogger }>({
  networkLogger: async ({ page }, use, testInfo) => {
    const logger = new NetworkLogger();
    attach(page, logger);

    await use(logger);

    const network = logger.getEntries();
    const entry: TestLogEntry = {
      title: testInfo.title,
      status: testInfo.status ?? 'unknown',
      network,
      console: logger.getConsoleEntries(),
      duplicateFindings: buildDuplicateFindings(network),
    };
    writeTestLog(entry);
  },
});

export { expect } from '@playwright/test';
