import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

// All raster variants are generated from the same versioned SVG.
const require = createRequire(new URL("../apps/server/package.json", import.meta.url));
const sharp = require("sharp");
const directory = new URL("../apps/website/public/", import.meta.url);
const source = await readFile(new URL("favicon.svg", directory));
for (const [name, size] of [
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
]) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(new URL(`${name}.png`, directory).pathname);
}
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((bytes, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(bytes.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
});
await writeFile(new URL("favicon.ico", directory), Buffer.concat([header, ...images]));
