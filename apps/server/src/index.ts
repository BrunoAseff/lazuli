import { buildApp } from "./app.ts";
import { serverEnv } from "./config.ts";

const app = buildApp(serverEnv);

const start = async () => {
  try {
    await app.listen({
      host: serverEnv.SERVER_HOST,
      port: serverEnv.SERVER_PORT,
    });
  } catch (error) {
    app.log.fatal({ error }, "server startup failed");
    process.exit(1);
  }
};

void start();
