/// <reference types="vitest/config" />

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      outDir: "dist",
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "UseWebsocket",
      fileName: (format) =>
        format === "es" ? "index.js" : "index.cjs",
      formats: ["es", "cjs"],
    },
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      // Explicit named exports for CommonJS consumers (require / legacy bundlers).
      output: {
        exports: "named",
      },
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@tanstack/react-store",
        "@tanstack/store",
        "uuid",
        "fast-equals",
      ],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
    },
  },
});
