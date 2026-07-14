(() => {
  "use strict";

  const BRIDGE_FLAG = "__allChatsSidebarForGrokPageBridge";
  const REQUEST_ATTRIBUTE = "data-grok-show-all-chats-page-request";
  const RESPONSE_ATTRIBUTE = "data-grok-show-all-chats-page-response";
  const REQUEST_EVENT = "grok-show-all-chats-page-request";
  const CHAT_PATH_PATTERN = /^\/(?:chat|chat-v1|chat-v2|c|conversation|grok\/chat)\/([^/?#]+)/i;
  const MAX_TURBOPACK_ATTEMPTS = 24;

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
    conversationStore: null,
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

  function getConversationSummary(conversationId) {
    if (!conversationId) {
      return null;
    }

    try {
      const byId = getStoreState(state.conversationStore)?.byId;
      const conversation = byId instanceof Map ? byId.get(conversationId) : byId?.[conversationId];
      if (!conversation || typeof conversation !== "object") {
        return null;
      }

      const summary = {
        conversationId,
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
      return summary;
    } catch {
      return null;
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
})();
