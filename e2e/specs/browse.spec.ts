import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { pair } from "../helpers";

/**
 * The in-page browser. The target is our own fixture page, so the spec is
 * deterministic and needs no third-party site: it covers the address bar, the
 * history stack and the bookmark list (incl. persistence). Ad blocking is
 * covered by the proxy unit tests — a live ad network is not testable here.
 */
const ORIGIN = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const FIXTURE = `${ORIGIN}/r/fixtures/page.html`;

test("browse: opens a page, keeps the address, bookmarks it", async ({ context }) => {
  const { sender } = await pair(context);

  await sender.locator("#browse-url").fill(FIXTURE);
  await sender.locator("#browse-open").click();

  // The address bar is set by us immediately; the iframe reports the same URL
  // back through the injected script, which must not mangle it.
  await expect(sender.locator("#browse-url")).toHaveValue(FIXTURE);
  await expect(sender.locator("#browse-frame")).toHaveAttribute(
    "src",
    new RegExp("/browse\\?url=")
  );

  // Nothing to go back to yet.
  await expect(sender.locator("#browse-back")).toBeDisabled();

  await sender.locator("#browse-star").click();
  await expect(sender.locator(".bm-chip")).toHaveCount(1);
  await expect(sender.locator("#browse-star")).toHaveText("★");
});

test("browse: bookmarks survive a reload", async ({ context }) => {
  const { receiver, sender } = await pair(context);
  const code = ((await receiver.locator("#room-code").textContent()) ?? "").trim();

  await sender.locator("#browse-url").fill(FIXTURE);
  await sender.locator("#browse-open").click();
  await sender.locator("#browse-star").click();
  await expect(sender.locator(".bm-chip")).toHaveCount(1);

  await sender.reload();
  await expect(sender.locator("#code-input")).toBeVisible();
  await sender.locator("#code-input").fill(code);
  await sender.locator("#connect-btn").click();

  await expect(sender.locator(".bm-chip")).toHaveCount(1);
  await sender.locator(".bm-del").click();
  await expect(sender.locator(".bm-chip")).toHaveCount(0);
});
