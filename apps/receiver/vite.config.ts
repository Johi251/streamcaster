import { defineConfig } from "vite";

// Receiver is served under /r/ on Cloudflare Pages (sender sits at /).
export default defineConfig({
  base: "/r/",
  server: {
    port: 5174,
    // Local dev routing: /r/<CODE> -> index.html
    proxy: {},
  },
  build: {
    // es2018 (not the modern default): keeps the receiver playable on older
    // TV browsers (updated Fire OS 5 Silk ≈ Chromium 59-63, old Tizen/webOS).
    // Browsers older than that get the ES5 fallback overlay in index.html.
    target: "es2018",
    outDir: "dist",
    emptyOutDir: true,
  },
});
