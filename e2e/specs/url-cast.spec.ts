import { expect } from "@playwright/test";
import { test } from "./fixtures";
import { castUrl, expectReceiverPlaying, pair } from "../helpers";

test("mp4 URL cast plays on the receiver", async ({ context, baseURL }) => {
  const { receiver, sender } = await pair(context);
  await castUrl(sender, `${baseURL}/r/media/sample.mp4`);
  await expectReceiverPlaying(receiver);
});
