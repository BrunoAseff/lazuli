import { expect, it } from "vitest";
import config from "../vite.config.ts";

it("bundles the TypeScript workspace package and all its subpath exports", () => {
  const pack = Array.isArray(config.pack) ? config.pack[0] : config.pack;
  const patterns = pack!.deps!.alwaysBundle as RegExp[];
  for (const name of [
    "@lazuli/shared",
    "@lazuli/shared/legal/documents",
    "@lazuli/shared/future/path",
  ])
    expect(patterns.some((pattern) => pattern.test(name))).toBe(true);
  expect(patterns.some((pattern) => pattern.test("@lazuli/shared-other"))).toBe(false);
});
