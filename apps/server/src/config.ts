import { config } from "dotenv";
import { fileURLToPath } from "node:url";

import { parseServerEnv } from "./config-schema.ts";

export { getServerPort, parseServerEnv } from "./config-schema.ts";
export type { ServerEnv } from "./config-schema.ts";

config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

export const serverEnv = parseServerEnv(process.env);
