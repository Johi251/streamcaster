import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { openReceiver, openSender, randomCode } from "../helpers";

test("Cast button is hidden when the Cast framework is unavailable", async ({ browser, context }) => {
  // Force unavailability: a Firefox UA fails the castUaSupported() gate, so no
  // SDK script is injected and detect() resolves false even though the
  // gstatic endpoint is reachable from this network.
  const ffContext = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  });
  const code = randomCode();
  await openReceiver(context, code);
  const sender = await openSender(ffContext, code);
  await expect(sender.locator("#cast-chromecast-btn")).toHaveCount(0);
  await ffContext.close();
});

test("Cast button appears when the framework is present (stubbed)", async ({ context }) => {
  const code = randomCode();
  await openReceiver(context, code);
  const sender = await context.newPage();
  await sender.addInitScript(() => {
    // Minimal cast.framework stub — detect() short-circuits on window.cast.framework.
    (window as unknown as Record<string, unknown>).cast = { framework: {} };
  });
  await sender.goto(`/#join=${code}`);
  await expect(sender.getByRole("heading", { name: "Cast a video" })).toBeVisible({ timeout: 20_000 });
  await expect(sender.locator("#cast-chromecast-btn")).toBeVisible();
});
