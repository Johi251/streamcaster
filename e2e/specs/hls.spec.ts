import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { castUrl, expectReceiverPlaying, pair } from "../helpers";

const PROXY = process.env.E2E_PROXY_URL ?? "http://127.0.0.1:8788";

test("HLS media playlist plays via hls.js (no native HLS in Chromium)", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await castUrl(sender, `${baseURL}/r/media/sample.m3u8`);
  await expectReceiverPlaying(receiver);
});

test("HLS master playlist plays (variant rewrite path)", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await castUrl(sender, `${baseURL}/r/media/master.m3u8`);
  await expectReceiverPlaying(receiver);
});

test("HLS through the proxy /hls?url= rewrite plays end-to-end", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  const proxied = `${PROXY}/hls?url=${encodeURIComponent(`${baseURL}/r/media/sample.m3u8`)}`;
  await castUrl(sender, proxied);
  await expectReceiverPlaying(receiver);
});
