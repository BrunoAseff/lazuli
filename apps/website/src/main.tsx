import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";

import { App } from "./app.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import "./style.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const rootElement = document.querySelector("#app");

if (!rootElement) {
  throw new Error("App root element not found");
}

createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <App />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>,
);
