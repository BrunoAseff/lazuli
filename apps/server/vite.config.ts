import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    clean: true,
    deps: { alwaysBundle: [/^@lazuli\/shared$/] },
    entry: [
      "src/index.ts",
      "src/migrate.ts",
      "src/commercial/commercial-admin.ts",
      "src/commercial/commercial-reconcile.ts",
      "src/document-imports/document-conversion-thread.ts",
    ],
    format: "esm",
    outDir: "dist",
    platform: "node",
    sourcemap: true,
    target: "node22",
  },
});
