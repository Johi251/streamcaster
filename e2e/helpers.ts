/**
 * Shared E2E helpers: pair a sender and a receiver via the signaling worker.
 */
import { expect, type Page, type BrowserContext } from "@playwright/test";

export const SIGNALING_URL = process.env.E2E_SIGNALING_URL ?? "http://127.0.0.1:8787";

export function randomCode(): string {
  // Must match the app alphabet (no 0/O, no 1/I/L) or the receiver rejects it.
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let c = "";
  for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
  return c;
}

export async function openReceiver(context: BrowserContext, code: string): Promise<Page> {
  const page = await context.newPage();
  // ?code= rather than /r/<code>: the query form is a real file on every host,
  // the path form needs a server rewrite that Cloudflare Pages does not apply.
  await page.goto(`/r/?code=${code}`);
  await expect(page.locator("#room-code")).toHaveText(code);
  return page;
}

export async function openSender(context: BrowserContext, code: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#join=${code}`);
  // Deep link auto-connects; wait for the connected view.
  await expect(page.getByRole("heading", { name: "Cast a video" })).toBeVisible({ timeout: 20_000 });
  return page;
}

/** Pair and return both pages. Receiver must reach the connected state. */
export async function pair(
  context: BrowserContext,
  code = randomCode()
): Promise<{ receiver: Page; sender: Page }> {
  const receiver = await openReceiver(context, code);
  const sender = await openSender(context, code);
  // The receiver marks the connected state with the `connected` CSS class on
  // #status (its text is "Connected" in the shipped UI). Assert the class so
  // the check stays robust to wording tweaks.
  await expect(receiver.locator("#status")).toHaveClass(/connected/, { timeout: 20_000 });
  return { receiver, sender };
}

export async function castUrl(sender: Page, url: string): Promise<void> {
  await sender.locator("#url-input").fill(url);
  await sender.locator("#cast-url-btn").click();
}

/** Wait until the receiver's <video> has data and is advancing. */
export async function expectReceiverPlaying(receiver: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        receiver.evaluate(() => {
          const v = document.getElementById("player") as HTMLVideoElement | null;
          return !!v && v.readyState >= 2 && v.currentTime > 0;
        }),
      { timeout: 20_000 }
    )
    .toBe(true);
  const t1 = await receiver.evaluate(() => (document.getElementById("player") as HTMLVideoElement).currentTime);
  await receiver.waitForTimeout(1200);
  const t2 = await receiver.evaluate(() => (document.getElementById("player") as HTMLVideoElement).currentTime);
  expect(t2).toBeGreaterThan(t1);
}
