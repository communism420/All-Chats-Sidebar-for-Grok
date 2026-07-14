import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(projectRoot, "store-assets", "fixture", "index.html");
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
  const resolvedPath = path.resolve(projectRoot, decodeURIComponent(requestPath).replace(/^\/+/, ""));
  const relativePath = path.relative(projectRoot, resolvedPath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath) ? null : resolvedPath;
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

async function waitForConversation(page, conversationId, title) {
  await page.waitForFunction(({ id, expectedTitle }) => {
    const row = document.querySelector(
      `[data-grok-show-all-chats-row='true'][data-conversation-id='${CSS.escape(id)}']`
    );
    return row?.textContent?.includes(expectedTitle);
  }, { id: conversationId, expectedTitle: title });
}

const { server, url } = await startFixtureServer();
let browser;
let context;

try {
  browser = await chromium.launch({
    executablePath: await findChromeExecutable(),
    headless: true,
    args: ["--force-color-profile=srgb"]
  });
  context = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    viewport: { height: 800, width: 1280 }
  });
  const page = await context.newPage();
  const secondPage = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  secondPage.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "load" });
  await secondPage.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => (
    document.querySelectorAll("[data-grok-show-all-chats-row='true']").length >= 26
  ));
  await secondPage.waitForFunction(() => (
    document.querySelectorAll("[data-grok-show-all-chats-row='true']").length >= 26
  ));

  const initialScrollTop = await page.evaluate(() => {
    window.__realtimeSyncTestPageMarker = "still-loaded";
    const content = document.querySelector("[data-sidebar='content']");
    if (!(content instanceof HTMLElement)) {
      throw new Error("Sidebar scroll container is missing.");
    }
    content.scrollTop = Math.min(360, content.scrollHeight - content.clientHeight);
    return content.scrollTop;
  });
  assert.ok(initialScrollTop > 0, "The fixture sidebar must be scrollable.");

  await page.evaluate(async () => {
    await fetch("/rest/app-chat/conversations/demo-writing", {
      body: JSON.stringify({
        modifyTime: "2026-07-14T18:00:00.000Z",
        starred: true,
        title: "Tiny live title"
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    });
  });
  await waitForConversation(page, "demo-writing", "Tiny live title");
  assert.equal(
    await page.locator("[data-grok-show-all-chats-row='true']").first().getAttribute("data-conversation-id"),
    "demo-writing",
    "A newly pinned and recently modified conversation must move immediately."
  );
  const scrollTopAfterUpdate = await page.evaluate(() => (
    document.querySelector("[data-sidebar='content']")?.scrollTop || 0
  ));
  assert.ok(
    Math.abs(scrollTopAfterUpdate - initialScrollTop) <= 2,
    `Live updates must preserve scroll position (${initialScrollTop} -> ${scrollTopAfterUpdate}).`
  );

  await secondPage.evaluate(() => {
    window.__syncChannelMessages = [];
    window.__syncProbeChannel = new BroadcastChannel("all-chats-sidebar-for-grok-sync-v1");
    window.__syncProbeChannel.addEventListener("message", (event) => {
      window.__syncChannelMessages.push(event.data);
    });
  });
  await secondPage.evaluate(() => {
    const conversation = window.__fixtureConversations.find(
      (item) => item.conversationId === "demo-energy"
    );
    Object.assign(conversation, {
      modifyTime: "2026-07-14T18:00:30.000Z",
      starred: true,
      title: "Synchronized across Grok tabs"
    });
  });
  await page.evaluate(async () => {
    await fetch("/rest/app-chat/conversations/demo-energy", {
      body: JSON.stringify({
        modifyTime: "2026-07-14T18:00:30.000Z",
        starred: true,
        title: "Synchronized across Grok tabs"
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT"
    });
  });
  await secondPage.waitForFunction(() => window.__syncChannelMessages.some(
    (message) => message.conversationIds?.includes("demo-energy")
  ));
  await secondPage.bringToFront();
  await secondPage.waitForTimeout(1500);
  const secondPageRequests = await secondPage.evaluate(() => window.__fixtureRequests);
  assert.ok(
    secondPageRequests.some((request) => (
      request.method === "GET" &&
      request.path === "/rest/app-chat/conversations/demo-energy"
    )),
    `The second tab did not refresh the changed conversation: ${JSON.stringify(secondPageRequests)}`
  );
  await waitForConversation(secondPage, "demo-energy", "Synchronized across Grok tabs");

  await page.evaluate(async () => {
    await fetch("/rest/app-chat/conversations", {
      body: JSON.stringify({
        conversationId: "live-created",
        modifyTime: "2026-07-14T18:01:00.000Z",
        title: "Created live without reloading"
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  });
  await waitForConversation(page, "live-created", "Created live without reloading");

  await page.evaluate(async () => {
    await fetch("/rest/app-chat/conversations/soft/demo-office", { method: "DELETE" });
  });
  await page.waitForFunction(() => !document.querySelector(
    "[data-grok-show-all-chats-row='true'][data-conversation-id='demo-office']"
  ));
  await page.waitForTimeout(1300);
  assert.equal(
    await page.locator(
      "[data-grok-show-all-chats-row='true'][data-conversation-id='demo-office']"
    ).count(),
    0,
    "A stale native-history link must not restore a deleted conversation."
  );
  assert.equal(
    await page.evaluate(() => window.__realtimeSyncTestPageMarker),
    "still-loaded",
    "Conversation changes must not reload the page."
  );
  assert.deepEqual(pageErrors, []);
  process.stdout.write("Chromium live conversation sync test passed.\n");
} finally {
  await context?.close();
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
