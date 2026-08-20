import { describe, expect, it } from "vitest";

import { isPublicNetworkAddress } from "./remote-image.ts";

describe("remote image network validation", () => {
  it.each([
    ["127.0.0.1", 4],
    ["10.1.2.3", 4],
    ["169.254.169.254", 4],
    ["192.168.1.10", 4],
    ["::1", 6],
    ["fc00::1", 6],
    ["fe80::1", 6],
    ["::ffff:127.0.0.1", 6],
  ] as const)("blocks private or reserved address %s", (address, family) => {
    expect(isPublicNetworkAddress(address, family)).toBe(false);
  });

  it.each([
    ["1.1.1.1", 4],
    ["8.8.8.8", 4],
    ["2606:4700:4700::1111", 6],
  ] as const)("allows public address %s", (address, family) => {
    expect(isPublicNetworkAddress(address, family)).toBe(true);
  });
});
