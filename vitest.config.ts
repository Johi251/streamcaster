import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
    environment: "node",
    // The `threads` pool transfers transformed modules in-memory. The default
    // `forks` pool writes them to a temp dir (%TEMP%\ssr\…), which sandboxed or
    // restricted filesystems can block (EPERM). Pure unit tests need no process
    // isolation, so threads is the safer, portable default here.
    pool: "threads",
  },
});
