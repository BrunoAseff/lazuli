export const APP_NAME = "Lazúli";

export type ApiHealthResponse = {
  appName: typeof APP_NAME;
  status: "ok";
  timestamp: string;
};
