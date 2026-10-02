import type { Logger } from "pino";

import type { AiCreditService } from "./ai-credit-service.ts";
import {
  AI_CREDIT_AUDIT_INTERVAL_MS,
  AI_CREDIT_RECONCILIATION_INTERVAL_MS,
} from "./ai-credit-config.ts";

export const createAiCreditReconciler = (
  service: Pick<AiCreditService, "findDivergentAccounts" | "reconcileStaleReservations">,
  logger: Pick<Logger, "error" | "info" | "warn">,
) => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let lastAuditAt = 0;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const released = await service.reconcileStaleReservations();
      if (released > 0) logger.info({ released }, "stale AI credit reservations released");
      if (Date.now() - lastAuditAt >= AI_CREDIT_AUDIT_INTERVAL_MS) {
        const divergences = await service.findDivergentAccounts();
        lastAuditAt = Date.now();
        if (divergences.length > 0)
          logger.warn(
            { accounts: divergences.map((entry) => entry.user_id) },
            "AI credit account cache differs from ledger",
          );
      }
    } catch (error) {
      logger.error({ err: error }, "AI credit reconciliation failed");
    } finally {
      running = false;
    }
  };

  return {
    start() {
      if (timer) return;
      void run();
      timer = setInterval(() => void run(), AI_CREDIT_RECONCILIATION_INTERVAL_MS);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
};
