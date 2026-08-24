import { parentPort } from "node:worker_threads";

import { convertDocument, ImportConversionError } from "./document-converters.ts";

if (!parentPort) throw new Error("document conversion thread requires a parent port");

parentPort.once("message", async ({ mimeType, bytes }: { mimeType: string; bytes: Uint8Array }) => {
  try {
    const result = await convertDocument(mimeType, bytes, async (current, total) => {
      parentPort!.postMessage({ type: "progress", current, total });
    });
    parentPort!.postMessage({ type: "result", result });
  } catch (error) {
    const known = error instanceof ImportConversionError;
    parentPort!.postMessage({
      type: "error",
      error: {
        code: known ? error.code : "IMPORT_CONVERSION_FAILED",
        message: error instanceof Error ? error.message : "Document conversion failed",
        retryable: known ? error.retryable : true,
      },
    });
  }
});
