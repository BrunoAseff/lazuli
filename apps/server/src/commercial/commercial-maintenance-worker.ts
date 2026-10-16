import type { Logger } from "pino";

import type { CommercialMaintenanceService } from "./commercial-maintenance-service.ts";

const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const createCommercialMaintenanceWorker = (
  service: CommercialMaintenanceService,
  logger: Pick<Logger, "error" | "info">,
) => {
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await service.run();
      if (result) logger.info(result, "commercial maintenance completed");
    } catch (error) {
      logger.error({ err: error }, "commercial maintenance failed");
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (timer) return;
      void run();
      timer = setInterval(() => void run(), MAINTENANCE_INTERVAL_MS);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
};
