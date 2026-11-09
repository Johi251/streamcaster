import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { openReceiver, openSender, randomCode } from "../helpers";

test("receiver shows room code + QR and waits", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  await expect(receiver.locator("#status")).toHaveText("Waiting for sender…", { timeout: 15_000 });
  await expect(receiver.locator("#qr-box img")).toBeVisible();
});

test("sender joins by typing the code", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  const sender = await context.newPage();
  await sender.goto("/");
  await sender.locator("#code-input").fill(code);
  await sender.locator("#connect-btn").click();
  await expect(sender.getByRole("heading", { name: "Cast a video" })).toBeVisible({ timeout: 20_000 });
  await expect(receiver.locator("#status")).toHaveClass(/connected/, { timeout: 20_000 });
});

test("sender joins via #join= deep link (QR equivalent)", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  const sender = await openSender(context, code);
  await expect(sender.locator("#conn-status")).toHaveText("connected");
  await expect(receiver.locator("#status")).toHaveClass(/connected/, { timeout: 20_000 });
});

/**
 * Regression: "connected" used to mean "my socket opened", so a deep link with
 * a stale code showed the full connected UI against an empty room while the TV
 * kept saying "Waiting for sender" — and the code field was unreachable.
 */
test("sender waits instead of claiming connected when no receiver is there", async ({ context }) => {
  const code = randomCode();
  const sender = await context.newPage();
  await sender.goto(`/#join=${code}`);
  await expect(sender.locator("#conn-status")).toHaveText("waiting", { timeout: 20_000 });
  await expect(sender.locator("#url-input")).toHaveCount(0);
  await expect(sender.locator(".wait-code")).toHaveText(code);
  // …and flips over on its own once the TV turns up.
  await openReceiver(context, code);
  await expect(sender.locator("#conn-status")).toHaveText("connected", { timeout: 20_000 });
});

test("deep link is consumed so a reload returns to the code entry", async ({ context }) => {
  const code = randomCode();
  const sender = await context.newPage();
  await sender.goto(`/#join=${code}`);
  await expect(sender.locator("#conn-status")).toHaveText("waiting", { timeout: 20_000 });
  await expect(sender).toHaveURL(/^[^#]*$/);
  await sender.reload();
  await expect(sender.locator("#code-input")).toBeVisible();
});

/**
 * Regression (D7 hardening): a malformed `#join=` value must never
 * auto-connect. It is prefilled only, the chip stays "offline", and the code
 * entry stays reachable so the user can correct it.
 */
test("malformed #join= deep link is prefilled but never auto-connects", async ({ context }) => {
  const sender = await context.newPage();
  await sender.goto("/#join=AB"); // too short — not a valid room code
  await expect(sender.locator("#code-input")).toBeVisible({ timeout: 15_000 });
  await expect(sender.locator("#code-input")).toHaveValue("AB");
  await expect(sender.locator("#conn-status")).toHaveText("offline");
  await expect(sender.locator("#connect-btn")).toBeVisible();
});
