import Fastify from "fastify";
import pino from "pino";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { logRequest } from "./logger.ts";

describe("request log", () => {
  it("logs the route pattern and never the URL with its token", async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, done) {
        lines.push(String(chunk));
        done();
      },
    });
    const app = Fastify({ disableRequestLogging: true, loggerInstance: pino({}, sink) });
    app.addHook("onResponse", logRequest);
    app.get("/api/auth/*", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/api/auth/reset-password/SECRET-TOKEN?callbackURL=x" });
    await app.inject({ method: "GET", url: "/api/auth/verify-email?token=SECRET-JWT" });
    await app.close();

    const log = lines.join("");
    expect(log).not.toContain("SECRET");
    expect(log).toContain('"route":"/api/auth/*"');
    expect(log).toContain('"statusCode":200');
  });
});
