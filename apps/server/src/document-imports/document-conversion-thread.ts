import { parentPort } from "node:worker_threads";

import { convertDocument } from "./document-converters.ts";

if (!parentPort) throw new Error("document conversion thread requires a parent port");

parentPort.once("message", async ({ mimeType, bytes }: { mimeType: string; bytes: Uint8Array }) => {
  try {
    const result = await convertDocument(mimeType, bytes, async (current, total) => {
      parentPort!.postMessage({ type: "progress", current, total });
    });
    parentPort!.postMessage({ type: "result", result });
  } catch (error) {
    parentPort!.postMessage({
      type: "error",
      error: {
        code:
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "IMPORT_CONVERSION_FAILED",
        retryable:
          error && typeof error === "object" && "retryable" in error
            ? Boolean(error.retryable)
            : false,
      },
    });
  }
});
