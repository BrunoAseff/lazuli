import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // BlockNote's internal controls join the product icon family without patching node_modules.
      "lucide-react": fileURLToPath(new URL("./src/components/icons.tsx", import.meta.url)),
      "react-icons/ri": fileURLToPath(
        new URL("./src/components/editor-icons.tsx", import.meta.url),
      ),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.WEBSITE_PORT ?? 3000),
  },
});
