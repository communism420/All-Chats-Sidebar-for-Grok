(() => {
  "use strict";

  const BRIDGE_FLAG = "__allChatsSidebarForGrokPageBridge";
  const REQUEST_ATTRIBUTE = "data-grok-show-all-chats-page-request";
  const RESPONSE_ATTRIBUTE = "data-grok-show-all-chats-page-response";
  const REQUEST_EVENT = "grok-show-all-chats-page-request";
  const CHANGE_ATTRIBUTE = "data-grok-show-all-chats-conversation-change";
  const CHANGE_EVENT = "grok-show-all-chats-conversation-change";
  const CHAT_PATH_PATTERN = /^\/(?:chat|chat-v1|chat-v2|c|conversation|grok\/chat)\/([^/?#]+)/i;
  const MAX_TURBOPACK_ATTEMPTS = 24;
  const STORE_CHANGE_DEBOUNCE_MS = 50;
  const NETWORK_HOOK_FLAG = "__allChatsSidebarForGrokNetworkHook";

  if (globalThis[BRIDGE_FLAG]) {
    return;
  }

  Object.defineProperty(globalThis, BRIDGE_FLAG, {
    configurable: false,
    value: true,
    writable: false
  });

  const state = {
    chatPageStore: null,
    conversationChangeTimer: 0,
    conversationStore: null,
    conversationStoreSnapshot: new Map(),
    conversationStoreSubscribed: null,
    conversationStoreUnsubscribe: null,
    nextAppRouter: null,
    prefetchedConversations: new Map(),
    prefetchedRoutes: new Set(),
    routingStore: null,
    turbopackAttempts: 0,
    turbopackPending: false
  };

  function pathSearchHash(url) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function extractConversationId(pathname) {
    const match = CHAT_PATH_PATTERN.exec(pathname || "");
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getStoreState(store) {
    try {
      return store && typeof store.getState === "function" ? store.getState() : null;
    } catch {
      return null;
    }
  }

  function isRoutingStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      snapshot.route &&
      typeof snapshot.route === "object" &&
      typeof snapshot.push === "function" &&
      typeof snapshot.replace === "function"
    );
  }

  function isConversationStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      typeof snapshot.fetchGetConversation === "function" &&
      snapshot.byId &&
      typeof snapshot.byId === "object"
    );
  }

  function isChatPageStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      "conversationId" in snapshot &&
      typeof snapshot.setConversationId === "function"
    );
  }

  function captureStoreCandidate(candidate) {
    if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) {
      return;
    }

    try {
      if (!state.chatPageStore) {
        const store = isChatPageStore(candidate) ? candidate : candidate.useChatPageStore;
        if (isChatPageStore(store)) {
          state.chatPageStore = store;
        }
      }

      if (!state.routingStore) {
        const store = isRoutingStore(candidate) ? candidate : candidate.useRoutingStore;
        if (isRoutingStore(store)) {
          state.routingStore = store;
        }
      }

      if (!state.conversationStore) {
        const store = isConversationStore(candidate) ? candidate : candidate.useConversationStore;
        if (isConversationStore(store)) {
          state.conversationStore = store;
          bindConversationStore(store);
        }
      }
    } catch {
      // Turbopack namespace proxies can throw while a chunk is loading.
    }
  }

  function captureStoresFromRuntime(runtime) {
    const moduleCache = runtime?.c;
    if (!moduleCache || typeof moduleCache !== "object") {
      return;
    }

    for (const moduleRecord of Object.values(moduleCache)) {
      captureStoreCandidate(moduleRecord?.exports);
      captureStoreCandidate(moduleRecord?.namespaceObject);
      if (state.routingStore && state.conversationStore && state.chatPageStore) {
        return;
      }
    }
  }

  function findTurbopackScript() {
    return [...document.scripts].find((script) => {
      const src = script.getAttribute("src") || "";
      return src.includes("/_next/") && /\.js(?:[?#]|$)/i.test(src);
    }) || null;
  }

  function captureGrokStores() {
    if (
      isRoutingStore(state.routingStore) &&
      isConversationStore(state.conversationStore) &&
      isChatPageStore(state.chatPageStore)
    ) {
      bindConversationStore(state.conversationStore);
      return true;
    }

    const turbopack = globalThis.TURBOPACK;
    if (
      !turbopack ||
      typeof turbopack.push !== "function" ||
      state.turbopackPending ||
      state.turbopackAttempts >= MAX_TURBOPACK_ATTEMPTS
    ) {
      return isRoutingStore(state.routingStore);
    }

    const script = findTurbopackScript();
    if (!script) {
      return isRoutingStore(state.routingStore);
    }

    state.turbopackAttempts += 1;
    state.turbopackPending = true;
    const moduleId = Symbol("all-chats-sidebar-for-grok-page-bridge");

    try {
      turbopack.push([
        script,
        moduleId,
        (runtime) => captureStoresFromRuntime(runtime)
      ]);

      const result = turbopack.push([
        script,
        {
          otherChunks: [],
          runtimeModuleIds: [moduleId]
        }
      ]);

      void Promise.resolve(result)
        .catch(() => undefined)
        .finally(() => {
          state.turbopackPending = false;
        });
    } catch {
      state.turbopackPending = false;
    }

    return isRoutingStore(state.routingStore);
  }

  function isNextRouter(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.push === "function" &&
      typeof value.replace === "function" &&
      (
        typeof value.prefetch === "function" ||
        typeof value.refresh === "function" ||
        typeof value.back === "function"
      )
    );
  }

  function findRouterInValue(value, seen = new Set(), depth = 0) {
    if (!value || depth > 3 || (typeof value !== "object" && typeof value !== "function")) {
      return null;
    }
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    if (isNextRouter(value)) {
      return value;
    }

    for (const key of ["router", "appRouter", "value", "current", "mutable"]) {
      try {
        const router = findRouterInValue(value[key], seen, depth + 1);
        if (router) {
          return router;
        }
      } catch {
        // Ignore getters from framework internals.
      }
    }

    return null;
  }

  function getReactFiber(node) {
    if (!node) {
      return null;
    }

    let keys = [];
    try {
      keys = Object.getOwnPropertyNames(node);
    } catch {
      return null;
    }

    const key = keys.find((name) => {
      return name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$");
    });
    return key ? node[key] : null;
  }

  function findRouterInFiber(fiber) {
    const seen = new Set();
    let current = fiber;

    while (current) {
      const candidates = [
        current.memoizedProps?.value,
        current.memoizedProps?.router,
        current.memoizedState,
        current.stateNode
      ];

      for (const candidate of candidates) {
        const router = findRouterInValue(candidate, seen);
        if (router) {
          return router;
        }
      }

      let dependency = current.dependencies?.firstContext || null;
      while (dependency) {
        const router = findRouterInValue(dependency.memoizedValue, seen);
        if (router) {
          return router;
        }
        dependency = dependency.next;
      }

      current = current.return;
    }

    return null;
  }

  function findNextAppRouter() {
    if (isNextRouter(state.nextAppRouter)) {
      return state.nextAppRouter;
    }

    const candidates = [
      document.querySelector("[data-grok-show-all-chats-sidebar='true']"),
      document.querySelector("[data-sidebar='sidebar']"),
      document.querySelector("[data-nextjs-scroll-focus-boundary]"),
      document.querySelector("main"),
      document.querySelector("#__next")?.firstElementChild,
      document.body?.firstElementChild
    ].filter(Boolean);

    for (const candidate of candidates) {
      let node = candidate;
      while (node && node !== document.documentElement) {
        const router = findRouterInFiber(getReactFiber(node));
        if (router) {
          state.nextAppRouter = router;
          return router;
        }
        node = node.parentElement;
      }
    }

    const fallbackNodes = document.querySelectorAll("main, [data-sidebar], a[href], button");
    for (let index = 0; index < Math.min(fallbackNodes.length, 160); index += 1) {
      const router = findRouterInFiber(getReactFiber(fallbackNodes[index]));
      if (router) {
        state.nextAppRouter = router;
        return router;
      }
    }

    return null;
  }

  function prefetchConversation(conversationId) {
    if (!conversationId || state.prefetchedConversations.has(conversationId)) {
      return state.prefetchedConversations.get(conversationId) || null;
    }

    captureGrokStores();
    const snapshot = getStoreState(state.conversationStore);
    if (!snapshot || typeof snapshot.fetchGetConversation !== "function") {
      return null;
    }

    let request;
    try {
      request = Promise.resolve(snapshot.fetchGetConversation(conversationId));
    } catch {
      return null;
    }

    state.prefetchedConversations.set(conversationId, request);
    if (state.prefetchedConversations.size > 100) {
      state.prefetchedConversations.delete(state.prefetchedConversations.keys().next().value);
    }
    void request.catch(() => {
      state.prefetchedConversations.delete(conversationId);
    });
    return request;
  }

  function prefetchRoute(url, conversationId) {
    const target = pathSearchHash(url);
    prefetchConversation(conversationId);

    if (state.prefetchedRoutes.has(target)) {
      return true;
    }

    const router = findNextAppRouter() || globalThis.next?.router;
    if (!router || typeof router.prefetch !== "function") {
      return false;
    }

    try {
      const result = router.prefetch(target);
      state.prefetchedRoutes.add(target);
      if (state.prefetchedRoutes.size > 100) {
        state.prefetchedRoutes.delete(state.prefetchedRoutes.values().next().value);
      }
      if (result && typeof result.catch === "function") {
        void result.catch(() => state.prefetchedRoutes.delete(target));
      }
      return true;
    } catch {
      state.prefetchedRoutes.delete(target);
      if (state.nextAppRouter === router) {
        state.nextAppRouter = null;
      }
      return false;
    }
  }

  function setChatPageConversationId(conversationId) {
    captureGrokStores();
    const snapshot = getStoreState(state.chatPageStore);
    if (!snapshot || typeof snapshot.setConversationId !== "function") {
      return false;
    }

    try {
      snapshot.setConversationId(conversationId || null);
      return true;
    } catch {
      return false;
    }
  }

  function getConversationRoute(conversationId) {
    const conversation = getStoreState(state.conversationStore)?.byId?.[conversationId];
    const workspaceId = conversation?.workspaces?.[0]?.workspaceId;
    if (workspaceId) {
      return {
        conversationId,
        page: "workspace",
        tab: "conversations",
        workspaceId
      };
    }

    return {
      conversationId,
      page: "chat",
      temporary: Boolean(conversation?.temporary)
    };
  }

  function tryNextAppNavigation(url) {
    const router = findNextAppRouter();
    if (!router) {
      return false;
    }

    try {
      const result = router.push(pathSearchHash(url), { scroll: false });
      if (result && typeof result.catch === "function") {
        void result.catch(() => {
          if (state.nextAppRouter === router) {
            state.nextAppRouter = null;
          }
        });
      }
      return true;
    } catch {
      if (state.nextAppRouter === router) {
        state.nextAppRouter = null;
      }
      return false;
    }
  }

  function tryNextPagesNavigation(url) {
    const router = globalThis.next?.router;
    if (!router || typeof router.push !== "function") {
      return false;
    }

    const target = pathSearchHash(url);
    try {
      const result = router.push(target, target, { scroll: false, shallow: false });
      if (result && typeof result.catch === "function") {
        void result.catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  function tryGrokStoreNavigation(conversationId, prefetchRequest) {
    captureGrokStores();
    const snapshot = getStoreState(state.routingStore);
    if (!snapshot || typeof snapshot.push !== "function") {
      return false;
    }

    const route = getConversationRoute(conversationId);
    try {
      snapshot.push(route);
    } catch {
      return false;
    }
    setChatPageConversationId(conversationId);

    if (route.page === "chat" && prefetchRequest && typeof prefetchRequest.then === "function") {
      void prefetchRequest.then((conversation) => {
        const workspaceId = conversation?.workspaces?.[0]?.workspaceId;
        const current = getStoreState(state.routingStore);
        if (
          workspaceId &&
          current?.route?.page === "chat" &&
          String(current.route.conversationId || "") === conversationId &&
          typeof current.replace === "function"
        ) {
          current.replace({
            conversationId,
            page: "workspace",
            tab: "conversations",
            workspaceId
          });
        }
      }).catch(() => undefined);
    }

    return true;
  }

  function navigateToConversation(url, conversationId) {
    state.nextAppRouter = null;
    const prefetchRequest = prefetchConversation(conversationId);
    prefetchRoute(url, conversationId);

    if (tryNextAppNavigation(url)) {
      return { method: "next-app", started: true };
    }
    if (tryNextPagesNavigation(url)) {
      return { method: "next-pages", started: true };
    }
    if (tryGrokStoreNavigation(conversationId, prefetchRequest)) {
      return { method: "grok-store", started: true };
    }
    return { method: "none", started: false };
  }

  function navigateHome(url) {
    state.nextAppRouter = null;
    if (tryNextAppNavigation(url)) {
      return { method: "next-app", started: true };
    }
    if (tryNextPagesNavigation(url)) {
      return { method: "next-pages", started: true };
    }

    captureGrokStores();
    const snapshot = getStoreState(state.routingStore);
    if (typeof snapshot?.push === "function") {
      try {
        snapshot.push({ page: "main" });
        setChatPageConversationId(null);
        return { method: "grok-store", started: true };
      } catch {
        // Fall through to a failed bridge response.
      }
    }
    return { method: "none", started: false };
  }

  function summarizeConversation(conversationId, conversation) {
    if (!conversationId || !conversation || typeof conversation !== "object") {
      return null;
    }

    const summary = {
      conversationId: String(conversationId),
      createTime: String(
        conversation.createTime || conversation.createdAt || conversation.create_time || ""
      ),
      modifyTime: String(
        conversation.modifyTime ||
        conversation.updateTime ||
        conversation.updatedAt ||
        conversation.modify_time ||
        ""
      ),
      title: String(conversation.title || conversation.conversationName || conversation.name || "")
    };
    if (Object.prototype.hasOwnProperty.call(conversation, "starred")) {
      summary.starred = Boolean(conversation.starred);
    }
    if (Object.prototype.hasOwnProperty.call(conversation, "temporary")) {
      summary.temporary = Boolean(conversation.temporary);
    }
    return summary;
  }

  function getConversationSummary(conversationId) {
    if (!conversationId) {
      return null;
    }

    try {
      const byId = getStoreState(state.conversationStore)?.byId;
      const conversation = byId instanceof Map ? byId.get(conversationId) : byId?.[conversationId];
      return summarizeConversation(conversationId, conversation);
    } catch {
      return null;
    }
  }

  function getConversationStoreSnapshot(store = state.conversationStore) {
    const snapshot = new Map();
    try {
      const byId = getStoreState(store)?.byId;
      const entries = byId instanceof Map ? [...byId.entries()] : Object.entries(byId || {});
      for (const [key, conversation] of entries) {
        const conversationId = String(
          conversation?.conversationId || conversation?.conversation_id || conversation?.id || key || ""
        );
        const summary = summarizeConversation(conversationId, conversation);
        if (summary) {
          snapshot.set(conversationId, summary);
        }
      }
    } catch {
      // Ignore transient store proxies while Grok updates its module graph.
    }
    return snapshot;
  }

  function emitConversationChange(payload) {
    const root = document.documentElement;
    if (!root) {
      return;
    }

    try {
      root.setAttribute(CHANGE_ATTRIBUTE, JSON.stringify(payload));
      document.dispatchEvent(new Event(CHANGE_EVENT));
    } finally {
      root.removeAttribute(CHANGE_ATTRIBUTE);
    }
  }

  function processConversationStoreChange() {
    state.conversationChangeTimer = 0;
    const previous = state.conversationStoreSnapshot;
    const next = getConversationStoreSnapshot();
    const conversations = [];
    const removedConversationIds = [];

    for (const [conversationId, summary] of next) {
      if (JSON.stringify(previous.get(conversationId)) !== JSON.stringify(summary)) {
        conversations.push(summary);
      }
    }
    for (const conversationId of previous.keys()) {
      if (!next.has(conversationId)) {
        removedConversationIds.push(conversationId);
      }
    }

    state.conversationStoreSnapshot = next;
    if (conversations.length || removedConversationIds.length) {
      emitConversationChange({
        conversations,
        removedConversationIds,
        source: "store"
      });
    }
  }

  function scheduleConversationStoreChange() {
    if (state.conversationChangeTimer) {
      globalThis.clearTimeout(state.conversationChangeTimer);
    }
    state.conversationChangeTimer = globalThis.setTimeout(
      processConversationStoreChange,
      STORE_CHANGE_DEBOUNCE_MS
    );
  }

  function bindConversationStore(store) {
    if (!store || state.conversationStoreSubscribed === store) {
      return;
    }

    try {
      state.conversationStoreUnsubscribe?.();
    } catch {
      // Ignore stale unsubscribe callbacks from replaced Grok stores.
    }
    if (state.conversationChangeTimer) {
      globalThis.clearTimeout(state.conversationChangeTimer);
      state.conversationChangeTimer = 0;
    }

    state.conversationStoreSubscribed = store;
    state.conversationStoreSnapshot = getConversationStoreSnapshot(store);
    state.conversationStoreUnsubscribe = null;
    if (typeof store.subscribe !== "function") {
      return;
    }

    try {
      const unsubscribe = store.subscribe(scheduleConversationStoreChange);
      if (typeof unsubscribe === "function") {
        state.conversationStoreUnsubscribe = unsubscribe;
      }
    } catch {
      // Network notifications remain available if the store cannot be subscribed to.
    }
  }

  function extractConversationIdFromApiPath(pathname) {
    const prefix = "/rest/app-chat/conversations/";
    if (!String(pathname || "").toLowerCase().startsWith(prefix)) {
      return "";
    }

    const segments = pathname.slice(prefix.length).split("/").filter(Boolean);
    const candidate = segments[0]?.toLowerCase() === "soft" ? segments[1] : segments[0];
    if (!candidate || ["create", "list", "new", "search"].includes(candidate.toLowerCase())) {
      return "";
    }
    try {
      return decodeURIComponent(candidate);
    } catch {
      return "";
    }
  }

  function getConversationMutationMetadata(input, init = {}) {
    try {
      const method = String(init.method || input?.method || "GET").toUpperCase();
      if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return null;
      }

      const inputUrl =
        typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
      const url = new URL(inputUrl, location.href);
      const path = url.pathname;
      const appChatPath = path.slice("/rest/app-chat/".length);
      if (
        url.origin !== location.origin ||
        !path.startsWith("/rest/app-chat/") ||
        !/(?:^|\/)(?:chats?|conversations?|responses?)(?:\/|$)/i.test(appChatPath)
      ) {
        return null;
      }

      return {
        conversationId: extractConversationIdFromApiPath(path),
        method,
        path
      };
    } catch {
      return null;
    }
  }

  function reportConversationMutation(metadata, status) {
    if (!metadata || status < 200 || status >= 400) {
      return;
    }
    emitConversationChange({
      mutation: { ...metadata, status },
      source: "network"
    });
  }

  function installNetworkHooks() {
    if (globalThis[NETWORK_HOOK_FLAG]) {
      return;
    }
    Object.defineProperty(globalThis, NETWORK_HOOK_FLAG, {
      configurable: false,
      value: true,
      writable: false
    });

    const nativeFetch = globalThis.fetch;
    if (typeof nativeFetch === "function") {
      try {
        globalThis.fetch = function (...args) {
          const metadata = getConversationMutationMetadata(args[0], args[1]);
          const request = Reflect.apply(nativeFetch, this, args);
          if (!metadata) {
            return request;
          }
          return Promise.resolve(request).then((response) => {
            reportConversationMutation(metadata, Number(response?.status || 0));
            return response;
          });
        };
      } catch {
        // Store notifications still work if fetch cannot be wrapped.
      }
    }

    const xhrPrototype = globalThis.XMLHttpRequest?.prototype;
    if (!xhrPrototype) {
      return;
    }
    const nativeOpen = xhrPrototype.open;
    const nativeSend = xhrPrototype.send;
    const metadataKey = Symbol("all-chats-sidebar-conversation-mutation");
    try {
      xhrPrototype.open = function (method, url, ...args) {
        this[metadataKey] = getConversationMutationMetadata({ method, url });
        return Reflect.apply(nativeOpen, this, [method, url, ...args]);
      };
      xhrPrototype.send = function (...args) {
        const metadata = this[metadataKey];
        if (metadata) {
          this.addEventListener(
            "loadend",
            () => reportConversationMutation(metadata, Number(this.status || 0)),
            { once: true }
          );
        }
        return Reflect.apply(nativeSend, this, args);
      };
    } catch {
      // Store and fetch notifications remain available if XHR cannot be wrapped.
    }
  }

  function getNavigationStatus() {
    captureGrokStores();
    const pathConversationId = extractConversationId(location.pathname);
    const routingSnapshot = getStoreState(state.routingStore);
    const routeConversationId =
      (routingSnapshot?.route?.page === "chat" || routingSnapshot?.route?.page === "workspace")
        ? String(routingSnapshot.route.conversationId || "")
        : "";
    const chatPageConversationId = String(
      getStoreState(state.chatPageStore)?.conversationId || ""
    );
    const activeConversationIds = [
      routeConversationId,
      pathConversationId
    ].filter((value, index, values) => value && values.indexOf(value) === index);
    const activeConversationId = pathConversationId || routeConversationId || chatPageConversationId;

    return {
      activeConversation: getConversationSummary(activeConversationId),
      activeConversationId,
      activeConversationIds
    };
  }

  function parseRequest(root) {
    const raw = root.getAttribute(REQUEST_ATTRIBUTE) || "";
    root.removeAttribute(REQUEST_ATTRIBUTE);
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function handleRequest() {
    const root = document.documentElement;
    if (!root) {
      return;
    }

    const request = parseRequest(root);
    const id = String(request?.id || "");
    let response = { id, method: "invalid", started: false };

    try {
      const url = new URL(String(request?.path || ""), location.origin);
      if (!id || url.origin !== location.origin) {
        throw new Error("Invalid navigation request");
      }

      if (request.action === "prefetch") {
        const conversationId = extractConversationId(url.pathname);
        response = {
          id,
          method: "prefetch",
          started: Boolean(conversationId && prefetchRoute(url, conversationId))
        };
      } else if (request.action === "navigate") {
        const conversationId = extractConversationId(url.pathname);
        if (!conversationId || conversationId !== String(request.conversationId || "")) {
          throw new Error("Invalid conversation request");
        }
        response = { id, ...navigateToConversation(url, conversationId) };
      } else if (request.action === "home" && url.pathname === "/") {
        response = { id, ...navigateHome(url) };
      } else if (request.action === "status") {
        response = {
          id,
          method: "status",
          started: true,
          ...getNavigationStatus()
        };
      }
    } catch {
      response = { id, method: "invalid", started: false };
    }

    root.setAttribute(RESPONSE_ATTRIBUTE, JSON.stringify(response));
  }

  document.addEventListener(REQUEST_EVENT, handleRequest, false);
  installNetworkHooks();
})();
