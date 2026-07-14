import { createServer } from "node:http";
import { access, readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const fixturePath = path.join(projectRoot, "store-assets", "fixture", "index.html");
const outputDirectory = path.join(projectRoot, "store-assets", "screenshots");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
].filter(Boolean);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"]
]);

function resolveRequestPath(requestPath) {
  if (requestPath === "/" || requestPath.startsWith("/c/")) {
    return fixturePath;
  }

  const decodedPath = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolvedPath = path.resolve(projectRoot, decodedPath);
  const relativePath = path.relative(projectRoot, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return resolvedPath;
}

async function startFixtureServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const requestedFile = resolveRequestPath(requestUrl.pathname);
      if (!requestedFile) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const content = await readFile(requestedFile);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes.get(path.extname(requestedFile).toLowerCase()) || "application/octet-stream"
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not determine the fixture server port.");
  }
  return { server, url: `http://127.0.0.1:${address.port}/c/demo-launch` };
}

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

async function waitForExtensionUi(page) {
  await page.waitForFunction(() => {
    const rows = document.querySelectorAll("[data-grok-show-all-chats-row='true']");
    const status = document.querySelector("[data-grok-show-all-chats-status='true']");
    return rows.length >= 20 && status?.textContent === "";
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const content = document.querySelector("[data-sidebar='content']");
    if (content instanceof HTMLElement) {
      content.scrollTop = 0;
    }
  });
}

async function saveScreenshot(page, filename) {
  const outputPath = path.join(outputDirectory, filename);
  await page.screenshot({ path: outputPath, type: "png" });
  return outputPath;
}

const { server, url } = await startFixtureServer();
let browser;

try {
  await mkdir(outputDirectory, { recursive: true });
  browser = await chromium.launch({
    executablePath: await findChromeExecutable(),
    headless: true,
    args: ["--force-color-profile=srgb"]
  });
  const context = await browser.newContext({
    colorScheme: "dark",
    deviceScaleFactor: 1,
    locale: "en-US",
    viewport: { height: 800, width: 1280 }
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });
  await waitForExtensionUi(page);

  const files = [];
  files.push(await saveScreenshot(page, "01-complete-chat-history.png"));

  const actionRow = page.locator("[data-grok-show-all-chats-row='true'][data-conversation-id='demo-engineering']");
  await actionRow.hover();
  await actionRow.locator("[data-grok-show-all-chats-menu-button='true']").click();
  await page.locator("[data-grok-show-all-chats-menu='true']").waitFor({ state: "visible" });
  files.push(await saveScreenshot(page, "02-chat-actions-menu.png"));

  await page.keyboard.press("Escape");
  const resizeHandle = page.locator("[data-grok-show-all-chats-resize-handle='true']");
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) {
    throw new Error("The sidebar resize handle is not visible.");
  }
  await page.mouse.move(handleBox.x + handleBox.width / 2, 420);
  await page.mouse.down();
  await page.mouse.move(500, 420, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const sidebar = document.querySelector("[data-grok-show-all-chats-sidebar='true']");
    return sidebar instanceof HTMLElement && sidebar.getBoundingClientRect().width >= 490;
  });
  await page.evaluate(() => {
    const content = document.querySelector("[data-sidebar='content']");
    if (content instanceof HTMLElement) {
      content.scrollTop = 0;
    }
  });
  await resizeHandle.focus();
  files.push(await saveScreenshot(page, "03-resizable-wide-sidebar.png"));

  for (const file of files) {
    process.stdout.write(`${file}\n`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
