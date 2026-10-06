import { buildApp } from "./app.ts";
import { getServerPort, serverEnv } from "./config.ts";

const app = buildApp(serverEnv);
let closing = false;

const close = async (signal: NodeJS.Signals) => {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, "server shutdown started");

  try {
    await app.close();
    app.log.info({ signal }, "server shutdown completed");
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ err: error, signal }, "server shutdown failed");
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

const start = async () => {
  try {
    await app.listen({
      host: serverEnv.SERVER_HOST,
      port: getServerPort(serverEnv),
    });
  } catch (error) {
    app.log.fatal({ err: error }, "server startup failed");
    process.exit(1);
  }
};

void start();
