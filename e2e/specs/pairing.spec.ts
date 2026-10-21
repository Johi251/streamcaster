import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { openReceiver, openSender, randomCode } from "../helpers";

test("receiver shows room code + QR and waits", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  await expect(receiver.locator("#status")).toHaveText("Waiting for sender…", { timeout: 15_000 });
  await expect(receiver.locator("#qr canvas")).toBeVisible();
});

test("sender joins by typing the code", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  const sender = await context.newPage();
  await sender.goto("/");
  await sender.locator("#code-input").fill(code);
  await sender.locator("#connect-btn").click();
  await expect(sender.getByRole("heading", { name: "Cast a video" })).toBeVisible({ timeout: 20_000 });
  await expect(receiver.locator("#status")).toHaveText("Sender connected", { timeout: 20_000 });
});

test("sender joins via #join= deep link (QR equivalent)", async ({ context }) => {
  const code = randomCode();
  const receiver = await openReceiver(context, code);
  const sender = await openSender(context, code);
  await expect(sender.locator("#conn-status")).toHaveText("connected");
  await expect(receiver.locator("#status")).toHaveText("Sender connected", { timeout: 20_000 });
});
