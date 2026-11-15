import { defineConfig } from "vite";

// Sender PWA served at "/" on Cloudflare Pages.
export default defineConfig({
  server: { port: 5173 },
  build: {
    // es2018 (not the modern default): widens sender support to older mobile
    // browsers; anything older gets the ES5 fallback overlay in index.html.
    target: "es2018",
    outDir: "dist",
    emptyOutDir: true,
  },
});
