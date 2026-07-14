import { access, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const fixtureUrl = pathToFileURL(path.join(projectRoot, "store-assets", "promo", "index.html")).href;
const outputDirectory = path.join(projectRoot, "store-assets", "promotional");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
].filter(Boolean);
const formats = [
  { filename: "promo-small-440x280.png", height: 280, width: 440 },
  { filename: "promo-marquee-1400x560.png", height: 560, width: 1400 }
];

async function findChromeExecutable() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known installation path.
    }
  }
  throw new Error("Google Chrome was not found. Set CHROME_PATH and try again.");
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  executablePath: await findChromeExecutable(),
  headless: true,
  args: ["--force-color-profile=srgb"]
});

try {
  for (const format of formats) {
    const context = await browser.newContext({
      colorScheme: "dark",
      deviceScaleFactor: 1,
      locale: "en-US",
      viewport: { height: format.height, width: format.width }
    });

    try {
      const page = await context.newPage();
      await page.goto(fixtureUrl, { waitUntil: "load" });
      await page.waitForFunction(() => {
        const logo = document.querySelector(".brand-logo");
        return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
      });
      await page.evaluate(async () => document.fonts.ready);

      const outputPath = path.join(outputDirectory, format.filename);
      await page.screenshot({
        animations: "disabled",
        omitBackground: false,
        path: outputPath,
        type: "png"
      });
      process.stdout.write(`${outputPath}\n`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
