import { defineConfig } from "vite";

// Sender PWA served at "/" on Cloudflare Pages.
export default defineConfig({
  server: { port: 5173 },
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
  },
});
