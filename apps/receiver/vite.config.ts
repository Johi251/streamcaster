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
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
  },
});
