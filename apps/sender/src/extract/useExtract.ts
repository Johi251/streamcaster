/**
 * UI wiring for the "Extract from page" flow:
 * paste page URL → probePage → candidate list → user picks → probeMedia →
 * returns a castable {url, mime} to main.ts.
 */

import { probePage, sourceLabel, type DetectOptions } from "./detect.js";
import { probeMedia, type MediaProbe } from "./probe.js";

const PROXY_ORIGIN = (import.meta.env.VITE_PROXY_URL as string | undefined) ?? "";

export interface ExtractResult {
  probe: MediaProbe;
  label: string;
}

/** Run extraction against a page URL and return the top verified candidate. */
export async function extractBest(pageUrl: string, signal?: AbortSignal): Promise<ExtractResult[]> {
  const opts: DetectOptions = { proxyOrigin: PROXY_ORIGIN, signal };
  const candidates = await probePage(pageUrl, opts);
  const results: ExtractResult[] = [];
  for (const c of candidates.slice(0, 5)) {
    try {
      const probe = await probeMedia(c.url);
      if (probe.playable !== "unsupported") {
        results.push({ probe, label: sourceLabel(c) });
      }
    } catch {
      // dead candidate — skip
    }
  }
  return results;
}
