import { lookup } from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList } from "node:net";

import { IMAGE_MAX_BYTES } from "@lazuli/shared";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const)
  blockedAddresses.addSubnet(network, prefix, "ipv6");

export type RemoteImageErrorCode =
  | "BLOCKED_ADDRESS"
  | "INVALID_URL"
  | "SOURCE_REJECTED"
  | "TOO_LARGE"
  | "UNAVAILABLE";

export class RemoteImageError extends Error {
  constructor(public readonly code: RemoteImageErrorCode) {
    super(code);
  }
}

export const isPublicNetworkAddress = (address: string, family: 4 | 6) =>
  !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");

const validateUrl = (value: URL) => {
  if (
    (value.protocol !== "http:" && value.protocol !== "https:") ||
    value.username ||
    value.password ||
    (value.port && value.port !== (value.protocol === "https:" ? "443" : "80"))
  )
    throw new RemoteImageError("INVALID_URL");
};

const resolveAddress = async (hostname: string) => {
  let addresses: Array<{ address: string; family: 4 | 6 }>;
  try {
    addresses = (await lookup(hostname, { all: true, verbatim: true })) as Array<{
      address: string;
      family: 4 | 6;
    }>;
  } catch {
    throw new RemoteImageError("UNAVAILABLE");
  }
  if (
    addresses.length === 0 ||
    addresses.some(
      (address) =>
        (address.family !== 4 && address.family !== 6) ||
        !isPublicNetworkAddress(address.address, address.family),
    )
  )
    throw new RemoteImageError("BLOCKED_ADDRESS");
  return addresses[0]!;
};

type DownloadResult = { buffer: Buffer } | { redirect: URL };

const downloadOnce = async (url: URL): Promise<DownloadResult> => {
  validateUrl(url);
  const address = await resolveAddress(url.hostname);
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const pinnedLookup: NonNullable<RequestOptions["lookup"]> = (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      const done = callback as unknown as (
        error: NodeJS.ErrnoException | null,
        addresses: Array<{ address: string; family: number }>,
      ) => void;
      done(null, [address]);
      return;
    }
    const done = callback as unknown as (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void;
    done(null, address.address, address.family);
  };

  return new Promise((resolve, reject) => {
    const request = transport(
      url,
      {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
          "user-agent": "Lazuli/1.0 image importer",
        },
        lookup: pinnedLookup,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          try {
            resolve({ redirect: new URL(response.headers.location, url) });
          } catch {
            reject(new RemoteImageError("INVALID_URL"));
          }
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(
            new RemoteImageError(
              status === 401 || status === 403 ? "SOURCE_REJECTED" : "UNAVAILABLE",
            ),
          );
          return;
        }

        const declaredSize = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(declaredSize) && declaredSize > IMAGE_MAX_BYTES) {
          response.destroy();
          reject(new RemoteImageError("TOO_LARGE"));
          return;
        }

        const chunks: Buffer[] = [];
        let byteSize = 0;
        response.on("data", (chunk: Buffer) => {
          byteSize += chunk.byteLength;
          if (byteSize > IMAGE_MAX_BYTES) {
            response.destroy(new RemoteImageError("TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => resolve({ buffer: Buffer.concat(chunks, byteSize) }));
        response.on("error", reject);
      },
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () =>
      request.destroy(new RemoteImageError("UNAVAILABLE")),
    );
    request.on("error", reject);
    request.end();
  });
};

export const downloadRemoteImage = async (source: string) => {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new RemoteImageError("INVALID_URL");
  }
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const result = await downloadOnce(url);
    if ("buffer" in result) return { buffer: result.buffer, sourceUrl: url };
    url = result.redirect;
  }
  throw new RemoteImageError("UNAVAILABLE");
};
