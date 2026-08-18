export const APP_NAME = "Lazúli";

export * from "./projects/project-contracts.ts";

export type ApiHealthResponse = {
  appName: typeof APP_NAME;
  status: "ok";
  timestamp: string;
};
