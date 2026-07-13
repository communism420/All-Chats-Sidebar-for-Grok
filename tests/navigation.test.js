"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.isConnected = true;
    this.parentElement = null;
    this.scrollTop = 0;
  }

  addEventListener() {}

  closest() {
    return null;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  matches() {
    return false;
  }

  querySelector() {
    return null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  removeEventListener() {}

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeHtmlElement extends FakeElement {}

globalThis.Element = FakeElement;
globalThis.HTMLElement = FakeHtmlElement;
globalThis.HTMLAnchorElement = class extends FakeHtmlElement {};
globalThis.HTMLButtonElement = class extends FakeHtmlElement {};
globalThis.MutationObserver = class {
  observe() {}
};
globalThis.CSS = { escape: (value) => String(value) };

const root = new FakeHtmlElement();
const sidebar = new FakeHtmlElement();
sidebar.parentElement = root;

const routerCalls = [];
const router = {
  back() {},
  prefetch(path) {
    routerCalls.push(["prefetch", path]);
  },
  push(path, options) {
    routerCalls.push(["push", path, options]);
  },
  replace() {}
};

sidebar["__reactFiber$navigationTest"] = {
  dependencies: null,
  memoizedProps: { value: router },
  memoizedState: null,
  return: null,
  stateNode: null
};

const documentTarget = new EventTarget();
documentTarget.body = new FakeHtmlElement();
documentTarget.body.firstElementChild = null;
documentTarget.documentElement = root;
documentTarget.querySelector = (selector) => {
  return selector.includes("grok-show-all-chats-sidebar") ? sidebar : null;
};
documentTarget.querySelectorAll = () => [];
documentTarget.scripts = [];
globalThis.document = documentTarget;

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "en-US", languages: ["en-US"] }
});

const fakeLocation = {
  hash: "",
  href: "https://grok.com/c/old",
  origin: "https://grok.com",
  pathname: "/c/old",
  search: ""
};
Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: fakeLocation
});

let timerSequence = 0;
const timers = new Map();
globalThis.window = {
  clearTimeout(id) {
    timers.delete(id);
  },
  requestAnimationFrame(callback) {
    callback();
    return 1;
  },
  setInterval() {
    return 0;
  },
  setTimeout(callback) {
    const id = ++timerSequence;
    timers.set(id, callback);
    return id;
  }
};

globalThis.GrokShowAllChatsI18n = {
  LANGUAGE_ATTRIBUTE: "data-language",
  LANGUAGE_CHANGE_EVENT: "language-change",
  normalizePreference: () => "auto",
  resolveLanguage: () => "en",
  translate: (language, key) => key
};

const pageBridgeSource = fs.readFileSync("page-bridge.js", "utf8");
const contentSource = fs.readFileSync("content.js", "utf8");
assert.doesNotMatch(
  `${pageBridgeSource}\n${contentSource}`,
  /location\.(?:assign|replace)\s*\(|(?:window\.)?location\.href\s*=/,
  "Chat navigation must not contain a hard-navigation fallback"
);

const pageBridgeMarker = "  document.addEventListener(REQUEST_EVENT, handleRequest, false);";
assert.ok(pageBridgeSource.includes(pageBridgeMarker), "Page bridge test hook marker is missing");
const instrumentedPageBridgeSource = pageBridgeSource.replace(
  pageBridgeMarker,
  `  globalThis.__pageBridgeTestApi = { navigateToConversation, state };
${pageBridgeMarker}`
);
vm.runInThisContext(instrumentedPageBridgeSource, { filename: "page-bridge.js" });

const observerMarker = "  const observer = new MutationObserver(scheduleRun);";
assert.ok(contentSource.includes(observerMarker), "Content test hook marker is missing");
const instrumentedContentSource = contentSource.replace(
  observerMarker,
  `  globalThis.__navigationTestApi = {
    attemptConversationNavigation,
    beginNavigationScrollPreservation,
    getPageBridgeNavigationStatus,
    handleListScroll,
    releaseNavigationScrollPreservation,
    settleNavigationScrollPreservation,
    state,
    tryPageBridgeNavigation
  };
  return;\n\n${observerMarker}`
);
vm.runInThisContext(instrumentedContentSource, { filename: "content.js" });

const testApi = globalThis.__navigationTestApi;
const pageBridgeApi = globalThis.__pageBridgeTestApi;
const navigationStarted = testApi.tryPageBridgeNavigation(
  new URL("/c/chat-42", location.origin),
  "chat-42"
);
assert.equal(navigationStarted, true);
assert.deepEqual(
  routerCalls.find((call) => call[0] === "push"),
  ["push", "/c/chat-42", { scroll: false }]
);
assert.equal(root.getAttribute("data-grok-show-all-chats-page-request"), null);
assert.equal(root.getAttribute("data-grok-show-all-chats-page-response"), null);

fakeLocation.pathname = "/c/chat-42";
fakeLocation.href = "https://grok.com/c/chat-42";
const status = testApi.getPageBridgeNavigationStatus();
assert.equal(status.activeConversationId, "chat-42");
assert.deepEqual(status.activeConversationIds, ["chat-42"]);

const chatPageUpdates = [];
pageBridgeApi.state.chatPageStore = {
  getState: () => ({
    conversationId: "chat-42",
    setConversationId: (conversationId) => chatPageUpdates.push(conversationId)
  })
};
const directNavigation = pageBridgeApi.navigateToConversation(
  new URL("/c/chat-with-next-router", location.origin),
  "chat-with-next-router"
);
assert.deepEqual(directNavigation, { method: "next-app", started: true });
assert.deepEqual(
  chatPageUpdates,
  [],
  "Next router navigation must not also mutate Grok's chat-page store"
);

fakeLocation.pathname = "/c/old";
fakeLocation.href = "https://grok.com/c/old";
const pushCountBeforeConfirmation = routerCalls.filter((call) => call[0] === "push").length;
const navigationSequence = ++testApi.state.navigationSequence;
testApi.state.navigationPendingTarget = "chat-99";
const originalRequestAnimationFrame = window.requestAnimationFrame;
window.requestAnimationFrame = () => 1;
testApi.attemptConversationNavigation({
  attemptsRemaining: 4,
  conversationId: "chat-99",
  link: sidebar,
  prefetchRequest: null,
  route: { conversationId: "chat-99", page: "chat", temporary: false },
  sequence: navigationSequence,
  url: new URL("/c/chat-99", location.origin)
});

const confirmationTimer = testApi.state.navigationRetryTimer;
const confirmationCallback = timers.get(confirmationTimer);
assert.equal(typeof confirmationCallback, "function");
timers.delete(confirmationTimer);
confirmationCallback();
window.requestAnimationFrame = originalRequestAnimationFrame;
assert.equal(
  routerCalls.filter((call) => call[0] === "push").length,
  pushCountBeforeConfirmation + 1,
  "A started navigation must never be issued again by its confirmation timer"
);
assert.equal(testApi.state.navigationRetryTimer, 0);
assert.equal(testApi.state.navigationPendingTarget, "");

const scrollHost = new FakeHtmlElement();
scrollHost.matches = (selector) => selector === "[data-sidebar='content']";
const panel = new FakeHtmlElement();
panel.closest = (selector) => {
  return selector === "[data-sidebar='content']" ? scrollHost : null;
};
testApi.state.panel = panel;

scrollHost.scrollTop = 624;
testApi.beginNavigationScrollPreservation("chat-42");
assert.equal(testApi.state.navigationScrollTop, 624);

scrollHost.scrollTop = 0;
testApi.handleListScroll({ currentTarget: scrollHost });
assert.equal(scrollHost.scrollTop, 624);
assert.equal(testApi.state.listScrollTop, 624);

testApi.settleNavigationScrollPreservation("chat-42", panel);
const createdTimerCount = timerSequence;
testApi.settleNavigationScrollPreservation("chat-42", panel);
assert.equal(
  timerSequence,
  createdTimerCount,
  "Repeated renders must not postpone scroll release"
);

const settleTimer = testApi.state.navigationScrollReleaseTimer;
const settleCallback = timers.get(settleTimer);
assert.equal(typeof settleCallback, "function");
timers.delete(settleTimer);
settleCallback();

assert.equal(scrollHost.scrollTop, 624);
assert.equal(testApi.state.navigationScrollTarget, "");
assert.equal(testApi.state.navigationScrollSettling, false);

console.log("Navigation bridge and scroll-preservation regression tests passed.");
