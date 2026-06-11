/**
 * Generate PWA raster icons from the brand SVG sources (Phase 11).
 *
 * Outputs (committed to public/icons so the build needs no image step):
 *   - icon-192.png            "any" purpose, 192×192
 *   - icon-512.png            "any" purpose, 512×512
 *   - icon-maskable-192.png   "maskable" purpose, full-bleed, 192×192
 *   - icon-maskable-512.png   "maskable" purpose, full-bleed, 512×512
 *   - apple-touch-icon.png    iOS home-screen, 180×180, opaque (no alpha)
 *
 * Run: node scripts/generate-pwa-icons.mjs
 * Re-run whenever the source SVGs (or real brand art, O-2) change.
 *
 * sharp ships transitively with Next.js (image optimization); no new dependency.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "public", "icons");

const standardSvg = await readFile(join(here, "pwa-icon-source.svg"));
const maskableSvg = await readFile(join(here, "pwa-icon-source-maskable.svg"));

await mkdir(outDir, { recursive: true });

async function png(svg, size, file, { flatten = false } = {}) {
  let pipe = sharp(svg, { density: 384 }).resize(size, size);
  if (flatten) {
    // apple-touch-icon must be opaque (iOS shows black behind alpha otherwise).
    pipe = pipe.flatten({ background: "#E63946" });
  }
  await pipe.png().toFile(join(outDir, file));
  console.log(`  ✓ ${file} (${size}×${size})`);
}

console.log("Generating PWA icons →", outDir);
await png(standardSvg, 192, "icon-192.png");
await png(standardSvg, 512, "icon-512.png");
await png(maskableSvg, 192, "icon-maskable-192.png");
await png(maskableSvg, 512, "icon-maskable-512.png");
await png(standardSvg, 180, "apple-touch-icon.png", { flatten: true });
console.log("Done.");
