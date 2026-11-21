import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import { blockNoteIcons, editorIconModule } from "./vite/blocknote-icons.ts";

export default defineConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [react(), tailwindcss(), blockNoteIcons()],
  // BlockNote is pre-bundled in development: its icons are swapped there too.
  optimizeDeps: {
    rolldownOptions: { external: [editorIconModule], plugins: [blockNoteIcons()] },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // BlockNote's shadcn controls import lucide-react: they join the product icon family.
      "lucide-react": fileURLToPath(new URL("./src/components/icons.tsx", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEBSITE_PORT ?? 3000),
  },
});
