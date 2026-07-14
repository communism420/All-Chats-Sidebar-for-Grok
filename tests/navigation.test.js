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
  `  globalThis.__pageBridgeTestApi = {
    bindConversationStore,
    getConversationMutationMetadata,
    getNavigationStatus,
    navigateToConversation,
    processConversationStoreChange,
    state
  };
${pageBridgeMarker}
  return;`
);
vm.runInThisContext(instrumentedPageBridgeSource, { filename: "page-bridge.js" });

const observerMarker = "  const observer = new MutationObserver(scheduleRun);";
assert.ok(contentSource.includes(observerMarker), "Content test hook marker is missing");
const instrumentedContentSource = contentSource.replace(
  observerMarker,
  `  globalThis.__navigationTestApi = {
    applyConversationChangePayload,
    attemptConversationNavigation,
    beginNavigationScrollPreservation,
    flushRealtimeRefresh,
    getPageBridgeNavigationStatus,
    handleListScroll,
    isDeleteMutation,
    mergeConversation,
    reconcileConversationsWithApiSnapshot,
    refreshNewConversationFromApi,
    releaseNavigationScrollPreservation,
    settleNavigationScrollPreservation,
    state,
    syncActiveConversation,
    tryPageBridgeNavigation
  };
  return;\n\n${observerMarker}`
);
vm.runInThisContext(instrumentedContentSource, { filename: "content.js" });

const testApi = globalThis.__navigationTestApi;
const pageBridgeApi = globalThis.__pageBridgeTestApi;
assert.equal(testApi.isDeleteMutation({
  method: "DELETE",
  path: "/rest/app-chat/conversations/chat-42/messages/message-7"
}), false);
assert.equal(testApi.isDeleteMutation({
  method: "DELETE",
  path: "/rest/app-chat/conversations/soft/chat-42"
}), true);
assert.deepEqual(
  pageBridgeApi.getConversationMutationMetadata(
    "/rest/app-chat/conversations/chat%2042",
    { method: "PUT" }
  ),
  {
    conversationId: "chat 42",
    method: "PUT",
    path: "/rest/app-chat/conversations/chat%2042"
  }
);
assert.deepEqual(
  pageBridgeApi.getConversationMutationMetadata(
    "/rest/app-chat/conversations/soft/deleted-chat",
    { method: "DELETE" }
  ),
  {
    conversationId: "deleted-chat",
    method: "DELETE",
    path: "/rest/app-chat/conversations/soft/deleted-chat"
  }
);
assert.equal(
  pageBridgeApi.getConversationMutationMetadata(
    "/rest/app-chat/conversations/chat-42",
    { method: "GET" }
  ),
  null
);
assert.equal(
  pageBridgeApi.getConversationMutationMetadata(
    "https://example.com/rest/app-chat/conversations/chat-42",
    { method: "PUT" }
  ),
  null
);
assert.equal(
  pageBridgeApi.getConversationMutationMetadata(
    "/rest/app-chat/settings/theme",
    { method: "POST" }
  ),
  null
);
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

fakeLocation.pathname = "/c/newly-created";
fakeLocation.href = "https://grok.com/c/newly-created";
pageBridgeApi.state.conversationStore = null;
const insertedNewConversation = testApi.syncActiveConversation();
const pendingRefreshTimer = testApi.state.newConversationRefreshTimer;
assert.equal(insertedNewConversation, true);
assert.equal(testApi.state.conversations.has("newly-created"), true);
assert.equal(testApi.state.conversations.get("newly-created").title, "");
assert.equal(testApi.state.conversations.get("newly-created").fromApi, false);
assert.equal(testApi.state.newConversationRefreshId, "newly-created");
assert.equal(typeof timers.get(pendingRefreshTimer), "function");

pageBridgeApi.state.conversationStore = {
  getState: () => ({
    byId: {
      "newly-created": {
        conversationId: "newly-created",
        createTime: "2026-07-14T12:00:00.000Z",
        modifyTime: "2026-07-14T12:00:01.000Z",
        starred: false,
        title: "Freshly created conversation"
      }
    },
    fetchGetConversation() {}
  })
};
const activeStatus = pageBridgeApi.getNavigationStatus();
assert.equal(activeStatus.activeConversation?.title, "Freshly created conversation");
const synchronizedNewConversation = testApi.syncActiveConversation();
assert.equal(synchronizedNewConversation, true);
assert.equal(
  testApi.state.conversations.get("newly-created").title,
  "Freshly created conversation"
);
assert.equal(testApi.state.conversations.get("newly-created").fromApi, true);
assert.equal(testApi.state.newConversationRefreshId, "");
assert.equal(testApi.state.newConversationRefreshTimer, 0);
assert.equal(timers.has(pendingRefreshTimer), false);

const bridgeChanges = [];
documentTarget.addEventListener("grok-show-all-chats-conversation-change", () => {
  bridgeChanges.push(JSON.parse(
    root.getAttribute("data-grok-show-all-chats-conversation-change")
  ));
});
let conversationStoreState = {
  byId: {
    tracked: {
      conversationId: "tracked",
      modifyTime: "2026-07-14T14:00:00.000Z",
      starred: false,
      title: "A much longer old title"
    }
  },
  fetchGetConversation() {}
};
const observedConversationStore = {
  getState: () => conversationStoreState,
  subscribe: () => () => {}
};
pageBridgeApi.state.conversationStore = observedConversationStore;
pageBridgeApi.bindConversationStore(observedConversationStore);
conversationStoreState = {
  ...conversationStoreState,
  byId: {
    tracked: {
      conversationId: "tracked",
      modifyTime: "2026-07-14T14:01:00.000Z",
      starred: true,
      title: "Short title"
    },
    "store-created": {
      conversationId: "store-created",
      modifyTime: "2026-07-14T14:02:00.000Z",
      starred: false,
      title: "Created without a reload"
    }
  }
};
pageBridgeApi.processConversationStoreChange();
assert.equal(bridgeChanges.length, 1);
assert.equal(bridgeChanges[0].source, "store");
assert.deepEqual(
  bridgeChanges[0].conversations.map((conversation) => conversation.conversationId),
  ["tracked", "store-created"]
);
assert.equal(
  bridgeChanges[0].conversations.find((conversation) => conversation.conversationId === "tracked").starred,
  true
);

conversationStoreState = {
  ...conversationStoreState,
  byId: {
    "store-created": conversationStoreState.byId["store-created"]
  }
};
pageBridgeApi.processConversationStoreChange();
assert.deepEqual(bridgeChanges[1].removedConversationIds, ["tracked"]);
assert.equal(root.getAttribute("data-grok-show-all-chats-conversation-change"), null);

async function testNewConversationApiRefresh() {
  fakeLocation.pathname = "/c/api-created";
  fakeLocation.href = "https://grok.com/c/api-created";
  pageBridgeApi.state.conversationStore = null;
  assert.equal(testApi.syncActiveConversation(), true);

  const scheduledRefreshTimer = testApi.state.newConversationRefreshTimer;
  window.clearTimeout(scheduledRefreshTimer);
  testApi.state.newConversationRefreshTimer = 0;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    json: async () => ({
      conversations: [
        {
          conversationId: "api-created",
          createTime: "2026-07-14T13:00:00.000Z",
          modifyTime: "2026-07-14T13:00:02.000Z",
          starred: false,
          title: "Conversation returned by the history API"
        }
      ]
    }),
    ok: true
  });

  try {
    await testApi.refreshNewConversationFromApi("api-created");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    testApi.state.conversations.get("api-created").title,
    "Conversation returned by the history API"
  );
  assert.equal(testApi.state.conversations.get("api-created").fromApi, true);
  assert.equal(testApi.state.newConversationRefreshId, "");
  assert.equal(testApi.state.newConversationRefreshTimer, 0);
}

async function testRealtimeConversationSync() {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalFetch = globalThis.fetch;
  window.requestAnimationFrame = () => 1;
  testApi.state.listScrollTop = 777;

  try {
    testApi.mergeConversation({
      conversationId: "live-change",
      createTime: "2026-07-14T15:00:00.000Z",
      fromApi: true,
      href: "/c/live-change",
      modifyTime: "2026-07-14T15:00:00.000Z",
      seenInApi: true,
      source: "api",
      starred: false,
      title: "A much longer old conversation title"
    });
    testApi.applyConversationChangePayload({
      conversations: [{
        conversationId: "live-change",
        modifyTime: "2026-07-14T15:01:00.000Z",
        starred: true,
        title: "Short title"
      }],
      source: "store"
    }, { broadcast: false });

    const updatedConversation = testApi.state.conversations.get("live-change");
    assert.equal(updatedConversation.title, "Short title");
    assert.equal(updatedConversation.starred, true);
    assert.equal(updatedConversation.modifyTime, "2026-07-14T15:01:00.000Z");
    assert.equal(testApi.state.listScrollTop, 777);
    testApi.mergeConversation({
      conversationId: "live-change",
      fromApi: false,
      href: "/c/live-change",
      source: "dom",
      title: "A much longer stale native sidebar title"
    });
    assert.equal(testApi.state.conversations.get("live-change").title, "Short title");
    testApi.applyConversationChangePayload({
      mutation: {
        conversationId: "live-change",
        method: "PUT",
        path: "/rest/app-chat/conversations/live-change",
        status: 200
      },
      source: "network"
    }, { broadcast: false });
    assert.equal(testApi.state.realtimeConversationIds.has("live-change"), false);

    testApi.applyConversationChangePayload({
      conversations: [{
        conversationId: "event-created",
        modifyTime: "2026-07-14T15:02:00.000Z",
        starred: false,
        title: "Created from a store event"
      }],
      source: "store"
    }, { broadcast: false });
    assert.equal(
      testApi.state.conversations.get("event-created").title,
      "Created from a store event"
    );

    testApi.applyConversationChangePayload({
      conversations: [{
        conversationId: "event-created",
        temporary: true,
        title: "Created from a store event"
      }],
      source: "store"
    }, { broadcast: false });
    assert.equal(testApi.state.conversations.has("event-created"), false);
    testApi.applyConversationChangePayload({
      conversations: [{
        conversationId: "event-created",
        temporary: false,
        title: "Saved conversation"
      }],
      source: "store"
    }, { broadcast: false });
    assert.equal(testApi.state.conversations.has("event-created"), true);

    testApi.applyConversationChangePayload({
      mutation: {
        conversationId: "event-created",
        method: "DELETE",
        path: "/rest/app-chat/conversations/soft/event-created",
        status: 200
      },
      source: "network"
    }, { broadcast: false });
    assert.equal(testApi.state.conversations.has("event-created"), false);
    assert.equal(testApi.state.suppressedConversationIds.has("event-created"), true);
    assert.equal(testApi.mergeConversation({
      conversationId: "event-created",
      fromApi: false,
      href: "/c/event-created",
      source: "dom",
      title: "Stale native row"
    }), false);
    assert.equal(testApi.state.conversations.has("event-created"), false);

    testApi.mergeConversation({
      conversationId: "store-removed",
      fromApi: true,
      href: "/c/store-removed",
      seenInApi: true,
      source: "api",
      title: "Removed somewhere else"
    });
    testApi.applyConversationChangePayload({
      removedConversationIds: ["store-removed"],
      source: "store"
    }, { broadcast: false });
    window.clearTimeout(testApi.state.realtimeRefreshTimer);
    testApi.state.realtimeRefreshTimer = 0;
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      text: async () => ""
    });
    await testApi.flushRealtimeRefresh();
    assert.equal(testApi.state.conversations.has("store-removed"), false);
    assert.equal(testApi.state.suppressedConversationIds.has("store-removed"), true);

    testApi.mergeConversation({
      conversationId: "snapshot-removed",
      fromApi: true,
      href: "/c/snapshot-removed",
      seenInApi: true,
      source: "api",
      title: "Missing from the complete API snapshot"
    });
    const fetchedConversationIds = new Set(testApi.state.conversations.keys());
    fetchedConversationIds.delete("snapshot-removed");
    testApi.reconcileConversationsWithApiSnapshot(fetchedConversationIds);
    assert.equal(testApi.state.conversations.has("snapshot-removed"), false);
    assert.equal(testApi.state.suppressedConversationIds.has("snapshot-removed"), true);
  } finally {
    globalThis.fetch = originalFetch;
    window.requestAnimationFrame = originalRequestAnimationFrame;
  }
}

void testNewConversationApiRefresh()
  .then(testRealtimeConversationSync)
  .then(() => {
    console.log("Navigation, scroll preservation, and live conversation sync tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
