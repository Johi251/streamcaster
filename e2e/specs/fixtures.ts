import { test as base } from "@playwright/test";

/**
 * Every test gets a fresh browser context (separate storage, clean WebRTC).
 * Servers are managed by playwright.config.ts webServer entries.
 */
export const test = base.test.extend({});

export { expect } from "@playwright/test";
