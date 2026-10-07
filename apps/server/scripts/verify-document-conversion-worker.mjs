import { Worker } from "node:worker_threads";

const workerUrl = new URL(
  "../dist/document-imports/document-conversion-thread.mjs",
  import.meta.url,
);
const worker = new Worker(workerUrl);

const timeout = setTimeout(() => {
  void worker.terminate();
  throw new Error("Document conversion worker did not respond during the build smoke check.");
}, 5_000);

worker.once("error", (error) => {
  clearTimeout(timeout);
  throw error;
});

worker.once("message", (message) => {
  clearTimeout(timeout);
  void worker.terminate();

  if (message?.type !== "error" || message?.error?.code !== "UNSUPPORTED_FILE_TYPE") {
    throw new Error("Document conversion worker returned an unexpected smoke-check response.");
  }
});

worker.postMessage({ mimeType: "application/x-lazuli-build-check", bytes: new Uint8Array() });
