// Genera los iconos PNG de la PWA a partir de los SVG de public/icons (usa Chromium de Playwright).
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const out = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon.svg", "apple-touch-icon.png", 180],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, dst, size] of out) {
  const svg = await readFile(new URL(`../public/icons/${src}`, import.meta.url), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${dst}`, import.meta.url).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("✓", dst);
}
await browser.close();
