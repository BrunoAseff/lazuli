import { defineConfig } from "vite-plus";

export default defineConfig({
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
