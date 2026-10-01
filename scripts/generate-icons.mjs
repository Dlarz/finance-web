// Renders the app icon SVG to PNGs in all needed sizes using the bundled Chromium (no native image libs needed).
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const svg = readFileSync(resolve('scripts/icon.svg'), 'utf8');
const outDir = resolve('public/icons');
mkdirSync(outDir, { recursive: true });

// maskable icons need extra padding (safe zone = inner 80 %)
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-maskable-192.png', size: 192, pad: 0.12 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon-180.png', size: 180, pad: 0 },
  { file: 'favicon-32.png', size: 32, pad: 0 },
];

// Use the preinstalled Chromium when Playwright's own build is not downloaded.
const preinstalled = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  const inner = Math.round(t.size * (1 - 2 * t.pad));
  const html = `<!doctype html><html><body style="margin:0;background:#12151c;width:${t.size}px;height:${t.size}px;display:flex;align-items:center;justify-content:center;overflow:hidden">
    <div style="width:${inner}px;height:${inner}px">${svg.replace(/width="512" height="512"/, `width="${inner}" height="${inner}"`)}</div></body></html>`;
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(html);
  const buffer = await page.screenshot({ clip: { x: 0, y: 0, width: t.size, height: t.size }, omitBackground: false });
  writeFileSync(resolve(outDir, t.file), buffer);
  console.log(`wrote ${t.file}`);
}
await browser.close();

// favicon.svg with rounded corners for browser tabs
const favicon = svg.replace('<rect width="512" height="512" fill="#12151c"/>', '<rect width="512" height="512" rx="96" fill="#12151c"/>');
writeFileSync(resolve('public/favicon.svg'), favicon);
console.log('wrote favicon.svg');
