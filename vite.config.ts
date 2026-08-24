import { defineConfig } from "vite-plus";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/website/src", import.meta.url)),
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
    include: [
      "apps/**/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "packages/**/src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
  },
});
