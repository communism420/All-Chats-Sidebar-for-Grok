(() => {
  "use strict";

  const API_PATH = "/rest/app-chat/conversations";
  const PAGE_SIZE = 100;
  const MAX_PAGES_PER_LOAD = 50;
  const MUTATION_THROTTLE_MS = 250;
  const REFRESH_INTERVAL_MS = 120000;
  const NAVIGATION_RETRY_DELAY_MS = 120;
  const NAVIGATION_CONFIRM_DELAY_MS = 450;
  const NAVIGATION_RETRY_LIMIT = 16;
  const NAVIGATION_SCROLL_PRESERVE_MS = 2500;
  const NAVIGATION_SCROLL_SETTLE_MS = 350;
  const MAX_TURBOPACK_BRIDGE_ATTEMPTS = 12;
  const MENU_EDGE_MARGIN = 8;
  const MENU_VERTICAL_GAP = 6;
  const SIDEBAR_WIDTH_STORAGE_KEY = "chatListWidth";
  const SIDEBAR_WIDTH_VIEWPORT_MARGIN_PX = 48;
  const SIDEBAR_WIDTH_HOST_DEPTH = 5;
  const SIDEBAR_RESIZE_HANDLE_INSIDE_PX = 2;
  const SIDEBAR_WIDTH_KEYBOARD_STEP_PX = 24;
  const SIDEBAR_WIDTH_KEYBOARD_LARGE_STEP_PX = 64;
  const SIDEBAR_WIDTH_SAVE_DELAY_MS = 200;
  const PAGE_BRIDGE_REQUEST_ATTRIBUTE = "data-grok-show-all-chats-page-request";
  const PAGE_BRIDGE_RESPONSE_ATTRIBUTE = "data-grok-show-all-chats-page-response";
  const PAGE_BRIDGE_REQUEST_EVENT = "grok-show-all-chats-page-request";

  const SHOW_ALL_PATTERNS = [
    /\bshow\s+all\b/i,
    /\bsee\s+all\b/i,
    /\bview\s+all\b/i,
    /показать\s+(все|всё)/i,
    /посмотреть\s+(все|всё)/i,
    /показати\s+(все|усе)/i,
    /\b(?:mostrar|ver)\s+tod[oa]s?\b/i,
    /\b(?:mostrar|ver)\s+tud[oa]\b/i,
    /\b(?:alle|alles)\s+anzeigen\b/i,
    /\b(?:afficher\s+tout|tout\s+afficher|voir\s+tout)\b/i
  ];

  const HISTORY_HINT_PATTERNS = [
    /\btoday\b/i,
    /\byesterday\b/i,
    /\bearlier\b/i,
    /\bprevious\b/i,
    /сегодня/i,
    /вчера/i,
    /ранее/i,
    /сьогодні/i,
    /вчора/i,
    /раніше/i,
    /\bhoy\b/i,
    /\bayer\b/i,
    /\banteriores?\b/i,
    /\bheute\b/i,
    /\bgestern\b/i,
    /\bfrüher\b/i,
    /\bhoje\b/i,
    /\bontem\b/i,
    /\baujourd['’]hui\b/i,
    /\bhier\b/i,
    /\bplus\s+tôt\b/i
  ];

  const NAV_HINT_PATTERNS = [
    /\bnew\s+chat\b/i,
    /\bsearch\b/i,
    /новый\s+чат/i,
    /поиск/i,
    /новий\s+чат/i,
    /пошук/i,
    /\bnuevo\s+chat\b/i,
    /\b(?:buscar|búsqueda)\b/i,
    /\bneuer\s+chat\b/i,
    /\bsuchen\b/i,
    /\bnovo\s+chat\b/i,
    /\bpesquisar\b/i,
    /\bnouveau\s+chat\b/i,
    /\brechercher\b/i
  ];

  const EXCLUDED_TITLE_PATTERNS = [
    /^\s*$/,
    /^\s*(search|new chat|imagine|build)\s*$/i,
    /^\s*(поиск|новый чат|навыки и коннекторы)\s*$/i,
    /^\s*(пошук|новий чат|навички та конектори)\s*$/i,
    /^\s*(buscar|búsqueda|nuevo chat|habilidades y conectores)\s*$/i,
    /^\s*(suchen|neuer chat|fähigkeiten und konnektoren)\s*$/i,
    /^\s*(pesquisar|novo chat|habilidades e conectores)\s*$/i,
    /^\s*(rechercher|nouveau chat|compétences et connecteurs)\s*$/i,
    /^\s*(show|see|view)\s+all\s*$/i,
    /^\s*показать\s+(все|всё)\s*$/i,
    /^\s*показати\s+(все|усе)\s*$/i,
    /^\s*(mostrar|ver)\s+(tod[oa]s?|tud[oa])\s*$/i,
    /^\s*(alle|alles)\s+anzeigen\s*$/i,
    /^\s*(afficher\s+tout|tout\s+afficher|voir\s+tout)\s*$/i
  ];

  const CHAT_PATH_PATTERN = /^\/(?:chat|chat-v1|chat-v2|c|conversation|grok\/chat)\/([^/?#]+)/i;
  const i18n = globalThis.GrokShowAllChatsI18n;
  if (!i18n) {
    return;
  }

  function getAutomaticLanguageCandidates() {
    return [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language,
      document.documentElement.lang
    ];
  }

  function getLanguagePreferenceFromPage() {
    return i18n.normalizePreference(
      document.documentElement.getAttribute(i18n.LANGUAGE_ATTRIBUTE) || "auto"
    );
  }

  const initialLanguagePreference = getLanguagePreferenceFromPage();

  const state = {
    apiDone: false,
    apiError: "",
    apiLoading: false,
    apiStarted: false,
    chatPageStore: null,
    conversations: new Map(),
    currentLocationKey: getLocationKey(),
    language: i18n.resolveLanguage(initialLanguagePreference, getAutomaticLanguageCandidates()),
    languagePreference: initialLanguagePreference,
    lastRenderSignature: "",
    listScrollTop: 0,
    menu: null,
    menuButton: null,
    menuConversationId: "",
    nativeHistory: null,
    navigationPendingTarget: "",
    navigationRetryTimer: 0,
    navigationScrollReleaseTimer: 0,
    navigationScrollSettling: false,
    navigationScrollTarget: "",
    navigationScrollTop: 0,
    navigationSequence: 0,
    nextAppRouter: null,
    nextPageToken: "",
    panel: null,
    prefetchedConversations: new Map(),
    prefetchedRoutes: new Set(),
    pageBridgeSequence: 0,
    preferredSidebarWidthPixels: 0,
    renderScheduled: false,
    resizeDrag: null,
    resizeHandle: null,
    routingStore: null,
    runInProgress: false,
    scrollElement: null,
    sequence: 0,
    sidebar: null,
    sidebarWidthBasePixels: 0,
    sidebarWidthHosts: [],
    sidebarWidthPixels: 0,
    sidebarWidthSidebar: null,
    conversationStore: null,
    turbopackBridgeAttempts: 0,
    turbopackBridgePending: false,
    widthSaveTimer: 0
  };

  function t(key, replacements) {
    return i18n.translate(state.language, key, replacements);
  }

  function scheduleImmediateRun() {
    window.requestAnimationFrame(() => {
      void run();
    });
  }

  function applyLanguagePreference(preference) {
    const nextPreference = i18n.normalizePreference(preference);
    const nextLanguage = i18n.resolveLanguage(nextPreference, getAutomaticLanguageCandidates());
    if (state.languagePreference === nextPreference && state.language === nextLanguage) {
      return;
    }

    state.languagePreference = nextPreference;
    state.language = nextLanguage;
    closeChatMenu();
    state.lastRenderSignature = "";
    scheduleImmediateRun();
  }

  function handleLanguagePreferenceChange() {
    applyLanguagePreference(getLanguagePreferenceFromPage());
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getLabel(element) {
    if (!element) {
      return "";
    }

    return normalizeText(
      [
        element.innerText,
        element.textContent,
        element.getAttribute?.("aria-label"),
        element.getAttribute?.("title")
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function getLocationKey() {
    return `${location.origin}${location.pathname}${location.search}${location.hash}`;
  }

  function hasPattern(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function extractConversationIdFromPath(pathname) {
    const match = CHAT_PATH_PATTERN.exec(pathname || "");
    return match ? decodeURIComponent(match[1]) : "";
  }

  function hrefForConversationId(conversationId) {
    return `/c/${encodeURIComponent(conversationId)}`;
  }

  function pathSearchHash(url) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function requestPageBridge(action, url, conversationId = "") {
    const root = document.documentElement;
    if (!root) {
      return null;
    }

    const id = `${Date.now().toString(36)}-${++state.pageBridgeSequence}`;
    const request = {
      action,
      conversationId,
      id,
      path: pathSearchHash(url)
    };

    root.setAttribute(PAGE_BRIDGE_REQUEST_ATTRIBUTE, JSON.stringify(request));
    root.removeAttribute(PAGE_BRIDGE_RESPONSE_ATTRIBUTE);
    document.dispatchEvent(new Event(PAGE_BRIDGE_REQUEST_EVENT));

    const rawResponse = root.getAttribute(PAGE_BRIDGE_RESPONSE_ATTRIBUTE) || "";
    root.removeAttribute(PAGE_BRIDGE_REQUEST_ATTRIBUTE);
    root.removeAttribute(PAGE_BRIDGE_RESPONSE_ATTRIBUTE);

    try {
      const response = JSON.parse(rawResponse);
      return response?.id === id ? response : null;
    } catch {
      return null;
    }
  }

  function tryPageBridgeNavigation(url, conversationId) {
    return Boolean(requestPageBridge("navigate", url, conversationId)?.started);
  }

  function tryPageBridgeHomeNavigation(url) {
    return Boolean(requestPageBridge("home", url)?.started);
  }

  function requestPageBridgePrefetch(url, conversationId) {
    requestPageBridge("prefetch", url, conversationId);
  }

  function getPageBridgeNavigationStatus() {
    return requestPageBridge("status", new URL(location.href));
  }

  function isRouterLike(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.push === "function" &&
      typeof value.replace === "function"
    );
  }

  function findRouterInValue(value, seen = new Set(), depth = 0) {
    if (!value || depth > 2 || (typeof value !== "object" && typeof value !== "function")) {
      return null;
    }

    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    if (isRouterLike(value)) {
      return value;
    }

    const likelyKeys = ["router", "appRouter", "value", "current", "mutable"];
    for (const key of likelyKeys) {
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

    const fiberKey = Object.keys(node).find((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"));
    return fiberKey ? node[fiberKey] : null;
  }

  function findRouterInFiber(fiber) {
    const seen = new Set();
    let current = fiber;

    while (current) {
      const directCandidates = [
        current.memoizedProps?.value,
        current.memoizedProps?.router,
        current.memoizedState,
        current.stateNode
      ];

      for (const candidate of directCandidates) {
        const router = findRouterInValue(candidate, seen);
        if (router) {
          return router;
        }
      }

      let contextDependency = current.dependencies?.firstContext || null;
      while (contextDependency) {
        const router = findRouterInValue(contextDependency.memoizedValue, seen);
        if (router) {
          return router;
        }
        contextDependency = contextDependency.next;
      }

      current = current.return;
    }

    return null;
  }

  function findNextAppRouter(startNode) {
    if (isRouterLike(state.nextAppRouter)) {
      return state.nextAppRouter;
    }

    const startCandidates = [
      startNode,
      state.panel,
      state.sidebar,
      document.querySelector("main"),
      document.body
    ].filter(Boolean);

    for (const node of startCandidates) {
      const router = findRouterInFiber(getReactFiber(node));
      if (router) {
        state.nextAppRouter = router;
        return router;
      }
    }

    return null;
  }

  function getStoreState(store) {
    try {
      return store && typeof store.getState === "function" ? store.getState() : null;
    } catch {
      return null;
    }
  }

  function isGrokRoutingStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      snapshot.route &&
      typeof snapshot.route === "object" &&
      typeof snapshot.push === "function" &&
      typeof snapshot.replace === "function"
    );
  }

  function isGrokConversationStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      typeof snapshot.fetchGetConversation === "function" &&
      snapshot.byId &&
      typeof snapshot.byId === "object"
    );
  }

  function isGrokChatPageStore(store) {
    const snapshot = getStoreState(store);
    return Boolean(
      snapshot &&
      "conversationId" in snapshot &&
      typeof snapshot.setConversationId === "function"
    );
  }

  function captureGrokStoresFromCandidate(candidate) {
    if (!candidate || (typeof candidate !== "object" && typeof candidate !== "function")) {
      return;
    }

    try {
      if (!state.chatPageStore) {
        const chatPageStore = isGrokChatPageStore(candidate)
          ? candidate
          : candidate.useChatPageStore;
        if (isGrokChatPageStore(chatPageStore)) {
          state.chatPageStore = chatPageStore;
        }
      }

      if (!state.routingStore) {
        const routingStore = isGrokRoutingStore(candidate)
          ? candidate
          : candidate.useRoutingStore;
        if (isGrokRoutingStore(routingStore)) {
          state.routingStore = routingStore;
        }
      }

      if (!state.conversationStore) {
        const conversationStore = isGrokConversationStore(candidate)
          ? candidate
          : candidate.useConversationStore;
        if (isGrokConversationStore(conversationStore)) {
          state.conversationStore = conversationStore;
        }
      }
    } catch {
      // Some Turbopack namespace proxies can throw while a chunk is loading.
    }
  }

  function captureGrokStoresFromRuntime(runtime) {
    const moduleCache = runtime?.c;
    if (!moduleCache || typeof moduleCache !== "object") {
      return;
    }

    for (const moduleRecord of Object.values(moduleCache)) {
      captureGrokStoresFromCandidate(moduleRecord?.exports);
      captureGrokStoresFromCandidate(moduleRecord?.namespaceObject);
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

  function maybeCaptureGrokStores() {
    if (
      isGrokRoutingStore(state.routingStore) &&
      isGrokConversationStore(state.conversationStore) &&
      isGrokChatPageStore(state.chatPageStore)
    ) {
      return true;
    }

    const turbopack = globalThis.TURBOPACK;
    if (
      !turbopack ||
      typeof turbopack.push !== "function" ||
      state.turbopackBridgePending ||
      state.turbopackBridgeAttempts >= MAX_TURBOPACK_BRIDGE_ATTEMPTS
    ) {
      return isGrokRoutingStore(state.routingStore);
    }

    const script = findTurbopackScript();
    if (!script) {
      return isGrokRoutingStore(state.routingStore);
    }

    state.turbopackBridgeAttempts += 1;
    state.turbopackBridgePending = true;
    const bridgeModuleId = Symbol("grok-show-all-chats-routing-bridge");

    try {
      turbopack.push([
        script,
        bridgeModuleId,
        (runtime) => captureGrokStoresFromRuntime(runtime)
      ]);

      const bridgeResult = turbopack.push([
        script,
        {
          otherChunks: [],
          runtimeModuleIds: [bridgeModuleId]
        }
      ]);

      void Promise.resolve(bridgeResult)
        .catch(() => undefined)
        .finally(() => {
          state.turbopackBridgePending = false;
        });
    } catch {
      state.turbopackBridgePending = false;
    }

    return isGrokRoutingStore(state.routingStore);
  }

  function prefetchConversation(conversationId) {
    if (!conversationId || state.prefetchedConversations.has(conversationId)) {
      return state.prefetchedConversations.get(conversationId) || null;
    }

    maybeCaptureGrokStores();
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

  function isExcludedTitle(title) {
    return EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
  }

  function conversationFromAnchor(anchor) {
    if (anchor.closest("[data-grok-show-all-chats-panel='true']")) {
      return null;
    }

    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return null;
    }

    if (url.origin !== location.origin) {
      return null;
    }

    const conversationId = extractConversationIdFromPath(url.pathname);
    if (!conversationId) {
      return null;
    }

    const title = normalizeText(anchor.innerText || anchor.textContent || anchor.getAttribute("aria-label"));
    if (isExcludedTitle(title)) {
      return null;
    }

    return {
      conversationId,
      createTime: "",
      fromApi: false,
      href: `${url.pathname}${url.search}`,
      modifyTime: "",
      source: "dom",
      title
    };
  }

  function conversationFromApi(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const conversationId = normalizeText(raw.conversationId || raw.conversation_id || raw.id);
    if (!conversationId) {
      return null;
    }

    const title = normalizeText(raw.title || raw.conversationName || raw.name);
    const conversation = {
      conversationId,
      createTime: normalizeText(raw.createTime || raw.createdAt || raw.create_time),
      fromApi: true,
      href: hrefForConversationId(conversationId),
      modifyTime: normalizeText(raw.modifyTime || raw.updateTime || raw.updatedAt || raw.modify_time),
      source: "api",
      title
    };

    if (Object.prototype.hasOwnProperty.call(raw, "starred")) {
      conversation.starred = Boolean(raw.starred);
    }

    return conversation;
  }

  function collectDomConversations(root) {
    const conversations = [];

    root.querySelectorAll?.("a[href]").forEach((anchor) => {
      const conversation = conversationFromAnchor(anchor);
      if (conversation) {
        conversations.push(conversation);
      }
    });

    return conversations;
  }

  function titleLooksTruncated(title) {
    return /(?:\.\.\.|…)\s*$/.test(title);
  }

  function chooseTitle(existingTitle, nextTitle) {
    if (!existingTitle) {
      return nextTitle;
    }
    if (!nextTitle) {
      return existingTitle;
    }
    if (titleLooksTruncated(existingTitle) && !titleLooksTruncated(nextTitle)) {
      return nextTitle;
    }
    if (!titleLooksTruncated(existingTitle) && titleLooksTruncated(nextTitle)) {
      return existingTitle;
    }
    return nextTitle.length > existingTitle.length ? nextTitle : existingTitle;
  }

  function mergeConversation(conversation) {
    if (!conversation?.conversationId) {
      return false;
    }

    const existing = state.conversations.get(conversation.conversationId);
    if (!existing) {
      state.conversations.set(conversation.conversationId, {
        ...conversation,
        sequence: state.sequence
      });
      state.sequence += 1;
      return true;
    }

    state.conversations.set(conversation.conversationId, {
      ...existing,
      ...conversation,
      createTime: conversation.createTime || existing.createTime,
      fromApi: Boolean(existing.fromApi || conversation.fromApi || conversation.source === "api"),
      href: conversation.source === "dom" ? conversation.href : existing.href || conversation.href,
      modifyTime: conversation.modifyTime || existing.modifyTime,
      sequence: existing.sequence,
      starred: typeof conversation.starred === "boolean" ? conversation.starred : existing.starred,
      title: conversation.source === "api" && conversation.title ? conversation.title : chooseTitle(existing.title, conversation.title)
    });
    return true;
  }

  function mergeConversations(conversations) {
    let changed = false;
    for (const conversation of conversations) {
      changed = mergeConversation(conversation) || changed;
    }
    return changed;
  }

  function scoreSidebar(element) {
    if (!isVisible(element)) {
      return -1;
    }

    const rect = element.getBoundingClientRect();
    if (rect.height < 280 || rect.width < 160 || rect.width > 540 || rect.left > 140) {
      return -1;
    }

    const text = getLabel(element).slice(0, 6000);
    let score = 0;

    if (hasPattern(text, NAV_HINT_PATTERNS)) {
      score += 6;
    }
    if (hasPattern(text, HISTORY_HINT_PATTERNS)) {
      score += 5;
    }
    if (hasPattern(text, SHOW_ALL_PATTERNS)) {
      score += 4;
    }
    if (element.matches("aside, nav, [role='navigation']")) {
      score += 3;
    }
    if (rect.left < 60) {
      score += 2;
    }

    const chatCount = collectDomConversations(element).length;
    if (chatCount >= 2) {
      score += Math.min(chatCount, 8);
    }

    return score;
  }

  function findLikelySidebar() {
    if (state.sidebar && document.contains(state.sidebar) && isVisible(state.sidebar)) {
      return state.sidebar;
    }

    const selectors = [
      "aside",
      "nav",
      "[role='navigation']",
      "[data-sidebar]",
      "[data-testid*='sidebar' i]",
      "[class*='sidebar' i]"
    ];

    const candidates = new Set();
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((element) => candidates.add(element));
      } catch {
        // Older Chromium builds can reject case-insensitive attribute selectors.
      }
    }

    document.querySelectorAll("body > div, main ~ div, div").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.left <= 100 && rect.width >= 160 && rect.width <= 540 && rect.height >= 300) {
        candidates.add(element);
      }
    });

    return [...candidates]
      .map((element) => ({ element, score: scoreSidebar(element) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function findShowAllControl(root) {
    const candidates = root.querySelectorAll("button, [role='button'], a[href], [tabindex]");

    return [...candidates].find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const tagName = element.tagName.toLowerCase();
      const href = element.getAttribute("href");
      if (href && href !== "#" && !href.toLowerCase().startsWith("javascript:")) {
        return false;
      }

      if (element.disabled || element.getAttribute("aria-disabled") === "true") {
        return false;
      }

      const text = getLabel(element);
      return text.length <= 80 && (tagName === "button" || element.getAttribute("role") === "button" || element.tabIndex >= 0) && hasPattern(text, SHOW_ALL_PATTERNS);
    }) || null;
  }

  function findNativeHistoryContainer(sidebar, showAllControl) {
    if (!sidebar) {
      return null;
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    let best = null;

    if (showAllControl && sidebar.contains(showAllControl)) {
      let current = showAllControl.parentElement;

      while (current && current !== sidebar && current !== document.body) {
        if (current.matches("[data-sidebar='content'], [data-sidebar='header'], [data-sidebar='footer']")) {
          break;
        }

        const rect = current.getBoundingClientRect();
        const text = getLabel(current).slice(0, 4000);
        const chatCount = collectDomConversations(current).length;
        const hasHistoryShape = chatCount >= 2 || hasPattern(text, HISTORY_HINT_PATTERNS);
        const hasTopNavigation = hasPattern(text, NAV_HINT_PATTERNS);
        const hasReasonableWidth = rect.width >= sidebarRect.width * 0.55;
        const hasReasonableHeight = rect.height >= 90;

        if (hasHistoryShape && !hasTopNavigation && hasReasonableWidth && hasReasonableHeight) {
          best = current;
        }

        current = current.parentElement;
      }
    }

    if (best) {
      return best;
    }

    return findHistoryContainerFromChatAnchors(sidebar);
  }

  function findHistoryContainerFromChatAnchors(sidebar) {
    const anchors = [...sidebar.querySelectorAll("a[href]")]
      .filter((anchor) => !anchor.closest("[data-grok-show-all-chats-panel='true']"))
      .filter((anchor) => conversationFromAnchor(anchor));

    if (anchors.length === 0) {
      return null;
    }

    const candidates = new Map();
    for (const anchor of anchors) {
      let current = anchor.parentElement;
      while (current && current !== sidebar && current !== document.body) {
        if (current.matches("[data-sidebar='content'], [data-sidebar='header'], [data-sidebar='footer']")) {
          break;
        }

        const existing = candidates.get(current) || 0;
        candidates.set(current, existing + 1);
        current = current.parentElement;
      }
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const minimumCount = Math.min(2, anchors.length);
    return [...candidates.entries()]
      .map(([element, count]) => {
        const rect = element.getBoundingClientRect();
        const text = getLabel(element).slice(0, 4000);
        const style = window.getComputedStyle(element);
        const scrollable = /(auto|scroll|overlay)/i.test(style.overflowY) || element.scrollHeight > element.clientHeight + 12;
        const topNavPenalty = hasPattern(text, NAV_HINT_PATTERNS) ? 100 : 0;
        const widthOk = rect.width >= sidebarRect.width * 0.55 && rect.width <= sidebarRect.width + 40;
        const heightOk = rect.height >= 80;
        const leftOk = rect.left >= sidebarRect.left - 8 && rect.left <= sidebarRect.left + 60;
        const score = count * 10 + (scrollable ? 8 : 0) + Math.min(rect.height / 80, 8) - topNavPenalty;

        return { element, score: count >= minimumCount && widthOk && heightOk && leftOk ? score : -1 };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function findSidebarContent(sidebar, nativeHistory) {
    const nativeContent = nativeHistory?.closest?.("[data-sidebar='content']");
    if (nativeContent instanceof HTMLElement && sidebar.contains(nativeContent)) {
      return nativeContent;
    }

    const candidates = [...sidebar.querySelectorAll("[data-sidebar='content']")]
      .filter((element) => element instanceof HTMLElement)
      .filter((element) => !element.closest("[data-grok-show-all-chats-panel='true']"));

    return candidates
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const historyScore = collectDomConversations(element).length * 20;
        const sizeScore = Math.min(rect.height, 1000) + Math.min(rect.width, 500);
        return { element, score: historyScore + sizeScore };
      })
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function ensurePanel(sidebar, showAllControl) {
    const nativeHistory = findNativeHistoryContainer(sidebar, showAllControl);
    const sidebarContent = findSidebarContent(sidebar, nativeHistory);

    if (state.panel && document.contains(state.panel) && sidebar.contains(state.panel)) {
      if (nativeHistory && nativeHistory !== state.panel && state.panel.nextElementSibling !== nativeHistory) {
        nativeHistory.before(state.panel);
      } else if (!nativeHistory && sidebarContent && state.panel.parentElement !== sidebarContent) {
        sidebarContent.append(state.panel);
      }
      state.nativeHistory = nativeHistory || state.nativeHistory;
      syncScrollElement(state.panel);
      return state.panel;
    }

    const panel = document.createElement("section");
    panel.setAttribute("data-grok-show-all-chats-panel", "true");
    panel.setAttribute("data-sidebar", "group");
    panel.setAttribute("aria-label", t("allChatsAria"));
    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("focusin", handlePanelNavigationIntent);
    panel.addEventListener("pointerdown", handlePanelNavigationIntent);
    panel.addEventListener("pointerover", handlePanelNavigationIntent);
    state.panel = panel;
    state.lastRenderSignature = "";

    if (nativeHistory?.parentElement && nativeHistory !== sidebar) {
      nativeHistory.before(panel);
      state.nativeHistory = nativeHistory;
      syncScrollElement(panel);
      return panel;
    }

    if (sidebarContent) {
      sidebarContent.append(panel);
      state.nativeHistory = null;
      syncScrollElement(panel);
      return panel;
    }

    const footer = sidebar.querySelector(":scope > [data-sidebar='footer']");
    if (footer) {
      footer.before(panel);
    } else if (showAllControl && sidebar.contains(showAllControl)) {
      const anchor = showAllControl.parentElement || showAllControl;
      anchor.before(panel);
    } else {
      sidebar.append(panel);
    }
    state.nativeHistory = null;
    syncScrollElement(panel);
    return panel;
  }

  function parseTime(value) {
    if (!value) {
      return 0;
    }

    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }

  function sortedConversations() {
    return [...state.conversations.values()].sort((a, b) => {
      if (Boolean(a.starred) !== Boolean(b.starred)) {
        return a.starred ? -1 : 1;
      }

      const timeA = parseTime(a.modifyTime || a.createTime);
      const timeB = parseTime(b.modifyTime || b.createTime);
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.sequence - b.sequence;
    });
  }

  function partitionConversations(conversations) {
    const pinned = [];
    const history = [];

    for (const conversation of conversations) {
      (conversation.starred ? pinned : history).push(conversation);
    }

    return { history, pinned };
  }

  function normalizeSidebarWidth(value) {
    const width = Number(value);
    return Number.isFinite(width) && width > 0 ? Math.round(width) : 0;
  }

  function findSidebarWidthHosts(sidebar) {
    const hosts = [];
    const sidebarRect = sidebar.getBoundingClientRect();
    let current = sidebar;

    for (let depth = 0; depth < SIDEBAR_WIDTH_HOST_DEPTH && current; depth += 1) {
      if (current === document.body || current === document.documentElement) {
        break;
      }
      if (!(current instanceof HTMLElement)) {
        break;
      }

      const rect = current.getBoundingClientRect();
      const matchesSidebarWidth = Math.abs(rect.width - sidebarRect.width) <= 24;
      const matchesSidebarEdge = Math.abs(rect.left - sidebarRect.left) <= 12;
      const coversSidebar = rect.height >= sidebarRect.height * 0.65;
      if (current !== sidebar && (!matchesSidebarWidth || !matchesSidebarEdge || !coversSidebar)) {
        break;
      }

      hosts.push(current);
      current = current.parentElement;
    }

    return hosts;
  }

  function getSidebarWidthBounds() {
    const minimum = Math.max(160, state.sidebarWidthBasePixels || 0);
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || minimum;
    const maximum = Math.max(minimum, Math.floor(viewportWidth - SIDEBAR_WIDTH_VIEWPORT_MARGIN_PX));
    return { maximum, minimum };
  }

  function updateResizeHandleAccessibility() {
    if (!(state.resizeHandle instanceof HTMLElement)) {
      return;
    }

    const { maximum, minimum } = getSidebarWidthBounds();
    const current = Math.min(maximum, Math.max(minimum, state.sidebarWidthPixels || minimum));
    const label = t("resizeChatListAria");
    state.resizeHandle.setAttribute("aria-label", label);
    state.resizeHandle.setAttribute("aria-valuemax", String(maximum));
    state.resizeHandle.setAttribute("aria-valuemin", String(minimum));
    state.resizeHandle.setAttribute("aria-valuenow", String(current));
    state.resizeHandle.setAttribute("aria-valuetext", `${current} px`);
    state.resizeHandle.title = label;
  }

  function updateSidebarResizeHandlePosition(panel = state.panel) {
    const handle = state.resizeHandle;
    const sidebar = state.sidebarWidthSidebar;
    if (
      !(handle instanceof HTMLElement) ||
      !(sidebar instanceof HTMLElement) ||
      !(panel instanceof HTMLElement) ||
      !document.contains(sidebar) ||
      !document.contains(panel)
    ) {
      if (handle instanceof HTMLElement) {
        handle.hidden = true;
      }
      return;
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
    const top = Math.max(0, sidebarRect.top);
    const bottom = Math.min(viewportHeight, sidebarRect.bottom);
    const left = Math.min(
      Math.max(0, viewportWidth - SIDEBAR_RESIZE_HANDLE_INSIDE_PX),
      Math.max(0, sidebarRect.right - SIDEBAR_RESIZE_HANDLE_INSIDE_PX)
    );
    const height = Math.max(0, bottom - top);

    handle.hidden = height < 8 || sidebarRect.width <= 0;
    handle.style.height = `${Math.round(height)}px`;
    handle.style.left = `${Math.round(left)}px`;
    handle.style.top = `${Math.round(top)}px`;
  }

  function clearSidebarWidthLayout() {
    if (state.resizeDrag) {
      const pointerId = state.resizeDrag.pointerId;
      state.resizeDrag = null;
      document.documentElement.removeAttribute("data-grok-show-all-chats-resizing");
      try {
        state.resizeHandle?.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }

    state.resizeHandle?.remove();
    for (const host of state.sidebarWidthHosts) {
      host.removeAttribute?.("data-grok-show-all-chats-width-host");
      host.style?.removeProperty("--grok-show-all-chats-sidebar-width");
    }

    state.sidebarWidthSidebar?.removeAttribute?.("data-grok-show-all-chats-resizable");
    state.resizeHandle = null;
    state.sidebarWidthBasePixels = 0;
    state.sidebarWidthHosts = [];
    state.sidebarWidthPixels = 0;
    state.sidebarWidthSidebar = null;
  }

  function applySidebarWidth(width, { remember = false } = {}) {
    if (!(state.sidebarWidthSidebar instanceof HTMLElement)) {
      return 0;
    }

    const { maximum, minimum } = getSidebarWidthBounds();
    const normalizedWidth = normalizeSidebarWidth(width) || minimum;
    const desiredWidth = Math.min(maximum, Math.max(minimum, normalizedWidth));
    const widthValue = `${desiredWidth}px`;
    const layoutIsCurrent = state.sidebarWidthPixels === desiredWidth &&
      state.sidebarWidthSidebar.getAttribute("data-grok-show-all-chats-resizable") === "true" &&
      state.sidebarWidthHosts.every((host) => {
        return host.getAttribute("data-grok-show-all-chats-width-host") === "true" &&
          host.style.getPropertyValue("--grok-show-all-chats-sidebar-width") === widthValue;
      });
    if (!layoutIsCurrent) {
      state.sidebarWidthSidebar.setAttribute("data-grok-show-all-chats-resizable", "true");
      for (const host of state.sidebarWidthHosts) {
        host.setAttribute("data-grok-show-all-chats-width-host", "true");
        host.style.setProperty("--grok-show-all-chats-sidebar-width", widthValue);
      }
      state.sidebarWidthPixels = desiredWidth;
    }

    if (remember) {
      state.preferredSidebarWidthPixels = desiredWidth;
    }
    updateResizeHandleAccessibility();
    updateSidebarResizeHandlePosition();
    return desiredWidth;
  }

  function updateSidebarWidthLayout(sidebar) {
    if (state.sidebarWidthSidebar !== sidebar) {
      clearSidebarWidthLayout();
      const rect = sidebar.getBoundingClientRect();
      state.sidebarWidthSidebar = sidebar;
      state.sidebarWidthBasePixels = Math.max(160, Math.ceil(rect.width || sidebar.clientWidth || 0));
      state.sidebarWidthHosts = findSidebarWidthHosts(sidebar);
    }

    const preferredWidth = state.preferredSidebarWidthPixels || state.sidebarWidthBasePixels;
    applySidebarWidth(preferredWidth);
  }

  function useSidebarWidthStorage(action, value) {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) {
      return;
    }

    const callback = () => {
      void globalThis.chrome?.runtime?.lastError;
    };
    try {
      if (action === "remove") {
        storage.remove(SIDEBAR_WIDTH_STORAGE_KEY, callback);
      } else {
        storage.set({ [SIDEBAR_WIDTH_STORAGE_KEY]: value }, callback);
      }
    } catch {
      // Resizing remains available even when extension storage is unavailable.
    }
  }

  function queueSidebarWidthSave() {
    window.clearTimeout(state.widthSaveTimer);
    state.widthSaveTimer = window.setTimeout(() => {
      state.widthSaveTimer = 0;
      if (state.preferredSidebarWidthPixels > 0) {
        useSidebarWidthStorage("set", state.preferredSidebarWidthPixels);
      } else {
        useSidebarWidthStorage("remove");
      }
    }, SIDEBAR_WIDTH_SAVE_DELAY_MS);
  }

  function commitSidebarWidth() {
    state.preferredSidebarWidthPixels = state.sidebarWidthPixels > state.sidebarWidthBasePixels
      ? state.sidebarWidthPixels
      : 0;
    queueSidebarWidthSave();
  }

  function resetSidebarWidth() {
    window.clearTimeout(state.widthSaveTimer);
    state.widthSaveTimer = 0;
    state.preferredSidebarWidthPixels = 0;
    applySidebarWidth(state.sidebarWidthBasePixels);
    useSidebarWidthStorage("remove");
  }

  function handleSidebarResizePointerDown(event) {
    if (event.button !== 0 || (event.pointerType && event.isPrimary === false)) {
      return;
    }

    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement) || !state.sidebarWidthPixels) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    state.resizeDrag = {
      pointerId: event.pointerId,
      startWidth: state.sidebarWidthPixels,
      startX: event.clientX
    };
    document.documentElement.setAttribute("data-grok-show-all-chats-resizing", "true");
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Window-level listeners still keep mouse dragging functional.
    }
    try {
      handle.focus({ preventScroll: true });
    } catch {
      handle.focus();
    }
  }

  function handleSidebarResizePointerMove(event) {
    if (!state.resizeDrag || event.pointerId !== state.resizeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    const nextWidth = state.resizeDrag.startWidth + event.clientX - state.resizeDrag.startX;
    applySidebarWidth(nextWidth, { remember: true });
  }

  function finishSidebarResize(event) {
    if (!state.resizeDrag || event.pointerId !== state.resizeDrag.pointerId) {
      return;
    }

    event.preventDefault();
    state.resizeDrag = null;
    document.documentElement.removeAttribute("data-grok-show-all-chats-resizing");
    try {
      state.resizeHandle?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already have been released by the browser.
    }
    commitSidebarWidth();
    state.lastRenderSignature = "";
    scheduleImmediateRun();
  }

  function handleSidebarResizeKeyDown(event) {
    const { maximum, minimum } = getSidebarWidthBounds();
    const step = event.shiftKey
      ? SIDEBAR_WIDTH_KEYBOARD_LARGE_STEP_PX
      : SIDEBAR_WIDTH_KEYBOARD_STEP_PX;
    let nextWidth = 0;

    if (event.key === "ArrowLeft") {
      nextWidth = state.sidebarWidthPixels - step;
    } else if (event.key === "ArrowRight") {
      nextWidth = state.sidebarWidthPixels + step;
    } else if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      resetSidebarWidth();
      return;
    } else if (event.key === "End") {
      nextWidth = maximum;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    applySidebarWidth(Math.min(maximum, Math.max(minimum, nextWidth)), { remember: true });
    commitSidebarWidth();
  }

  function ensureSidebarResizeHandle(panel) {
    let handle = state.resizeHandle;
    if (!(handle instanceof HTMLElement)) {
      handle = document.createElement("div");
      handle.setAttribute("data-grok-show-all-chats-resize-handle", "true");
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "vertical");
      handle.tabIndex = 0;
      handle.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        resetSidebarWidth();
      });
      handle.addEventListener("keydown", handleSidebarResizeKeyDown);
      handle.addEventListener("lostpointercapture", finishSidebarResize);
      handle.addEventListener("pointerdown", handleSidebarResizePointerDown);
      state.resizeHandle = handle;
    }

    updateResizeHandleAccessibility();
    if (handle.parentElement !== document.documentElement) {
      document.documentElement.append(handle);
    }
    updateSidebarResizeHandlePosition(panel);
    return handle;
  }

  function loadSidebarWidthPreference() {
    const storage = globalThis.chrome?.storage?.local;
    if (!storage) {
      return;
    }

    try {
      storage.get({ [SIDEBAR_WIDTH_STORAGE_KEY]: 0 }, (settings) => {
        if (globalThis.chrome?.runtime?.lastError) {
          return;
        }
        state.preferredSidebarWidthPixels = normalizeSidebarWidth(
          settings?.[SIDEBAR_WIDTH_STORAGE_KEY]
        );
        scheduleImmediateRun();
      });
    } catch {
      // The native sidebar width remains the default when storage cannot be read.
    }
  }

  function handleSidebarWidthStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes?.[SIDEBAR_WIDTH_STORAGE_KEY] || state.resizeDrag) {
      return;
    }

    state.preferredSidebarWidthPixels = normalizeSidebarWidth(
      changes[SIDEBAR_WIDTH_STORAGE_KEY].newValue
    );
    if (state.sidebarWidthSidebar && document.contains(state.sidebarWidthSidebar)) {
      applySidebarWidth(state.preferredSidebarWidthPixels || state.sidebarWidthBasePixels);
    }
    scheduleImmediateRun();
  }

  function setNativeHistoryVisibility(showAllControl) {
    const shouldReplaceNativeHistory = state.conversations.size > 0;

    if (state.panel && document.contains(state.panel)) {
      state.panel.removeAttribute("data-grok-show-all-chats-panel-hidden");
    }

    if (state.nativeHistory && document.contains(state.nativeHistory)) {
      if (shouldReplaceNativeHistory) {
        state.nativeHistory.setAttribute("data-grok-show-all-chats-native-hidden", "true");
      } else {
        state.nativeHistory.removeAttribute("data-grok-show-all-chats-native-hidden");
      }
    }

    if (showAllControl && document.contains(showAllControl)) {
      if (shouldReplaceNativeHistory) {
        showAllControl.setAttribute("data-grok-show-all-chats-hidden", "true");
      } else {
        showAllControl.removeAttribute("data-grok-show-all-chats-hidden");
      }
    }
  }

  function getScrollElement(panel = state.panel) {
    const sidebarContent = panel?.closest?.("[data-sidebar='content']");
    if (sidebarContent instanceof HTMLElement) {
      return sidebarContent;
    }

    const list = panel?.querySelector?.("[data-grok-show-all-chats-list='true']");
    return list instanceof HTMLElement ? list : null;
  }

  function syncScrollElement(panel = state.panel) {
    const nextScrollElement = getScrollElement(panel);
    if (panel instanceof HTMLElement) {
      const usesSidebarScroll = nextScrollElement instanceof HTMLElement &&
        nextScrollElement.matches("[data-sidebar='content']");
      panel.setAttribute(
        "data-grok-show-all-chats-scroll-host",
        usesSidebarScroll ? "sidebar" : "list"
      );
    }

    if (nextScrollElement === state.scrollElement) {
      return nextScrollElement;
    }

    state.scrollElement?.removeEventListener("scroll", handleListScroll);
    state.scrollElement = nextScrollElement;
    state.scrollElement?.addEventListener("scroll", handleListScroll, { passive: true });
    return nextScrollElement;
  }

  function getCurrentListScrollTop(panel = state.panel) {
    const scrollElement = getScrollElement(panel);
    return scrollElement instanceof HTMLElement ? scrollElement.scrollTop : state.listScrollTop;
  }

  function rememberListScrollTop(panel = state.panel) {
    state.listScrollTop = getCurrentListScrollTop(panel);
  }

  function restoreListScrollTop(panel, scrollTop) {
    const nextScrollTop = Math.max(0, Number(scrollTop) || 0);
    state.listScrollTop = nextScrollTop;
    const scrollElement = syncScrollElement(panel);
    if (!(scrollElement instanceof HTMLElement)) {
      return;
    }

    scrollElement.scrollTop = nextScrollTop;
    window.requestAnimationFrame(() => {
      if (scrollElement.isConnected) {
        scrollElement.scrollTop = nextScrollTop;
      }
    });
  }

  function restorePreservedNavigationScroll(panel = state.panel) {
    if (!state.navigationScrollTarget) {
      return;
    }
    restoreListScrollTop(panel, state.navigationScrollTop);
  }

  function releaseNavigationScrollPreservation(panel = state.panel) {
    if (state.navigationScrollReleaseTimer) {
      window.clearTimeout(state.navigationScrollReleaseTimer);
      state.navigationScrollReleaseTimer = 0;
    }

    const preservedScrollTop = state.navigationScrollTop;
    const preservedTarget = state.navigationScrollTarget;
    state.navigationScrollSettling = false;
    state.navigationScrollTarget = "";
    state.navigationScrollTop = 0;
    if (state.navigationPendingTarget === preservedTarget) {
      state.navigationPendingTarget = "";
    }
    restoreListScrollTop(panel, preservedScrollTop);
  }

  function beginNavigationScrollPreservation(conversationId) {
    rememberListScrollTop();
    state.navigationScrollTop = state.listScrollTop;
    state.navigationScrollSettling = false;
    state.navigationScrollTarget = conversationId;

    if (state.navigationScrollReleaseTimer) {
      window.clearTimeout(state.navigationScrollReleaseTimer);
    }
    state.navigationScrollReleaseTimer = window.setTimeout(() => {
      state.navigationScrollReleaseTimer = 0;
      releaseNavigationScrollPreservation();
    }, NAVIGATION_SCROLL_PRESERVE_MS);
  }

  function settleNavigationScrollPreservation(conversationId, panel = state.panel) {
    if (!state.navigationScrollTarget || state.navigationScrollTarget !== conversationId) {
      return;
    }

    clearNavigationRetry();
    restorePreservedNavigationScroll(panel);
    if (state.navigationScrollSettling) {
      return;
    }
    state.navigationScrollSettling = true;
    if (state.navigationScrollReleaseTimer) {
      window.clearTimeout(state.navigationScrollReleaseTimer);
    }
    state.navigationScrollReleaseTimer = window.setTimeout(() => {
      state.navigationScrollReleaseTimer = 0;
      restorePreservedNavigationScroll(panel);
      window.requestAnimationFrame(() => {
        if (state.navigationScrollTarget === conversationId) {
          releaseNavigationScrollPreservation(panel);
        }
      });
    }, NAVIGATION_SCROLL_SETTLE_MS);
  }

  function handleListScroll(event) {
    if (event.currentTarget instanceof HTMLElement) {
      if (state.navigationScrollTarget) {
        const scrollElement = event.currentTarget;
        const preservedScrollTop = state.navigationScrollTop;
        if (Math.abs(scrollElement.scrollTop - preservedScrollTop) > 1) {
          window.requestAnimationFrame(() => {
            if (state.navigationScrollTarget && scrollElement.isConnected) {
              scrollElement.scrollTop = preservedScrollTop;
            }
          });
        }
        return;
      }
      state.listScrollTop = event.currentTarget.scrollTop;
    }
    closeChatMenu();
    updateSidebarResizeHandlePosition();
  }

  function markRenderDirty() {
    state.lastRenderSignature = "";
    scheduleRun();
  }

  function getConversationById(conversationId) {
    return state.conversations.get(conversationId) || null;
  }

  function updateLocalConversation(conversationId, patch) {
    const existing = getConversationById(conversationId);
    if (!existing) {
      return null;
    }

    state.conversations.set(conversationId, {
      ...existing,
      ...patch,
      conversationId,
      modifyTime: patch.modifyTime || existing.modifyTime
    });
    markRenderDirty();
    return existing;
  }

  function restoreLocalConversation(conversation) {
    if (!conversation?.conversationId) {
      return;
    }

    state.conversations.set(conversation.conversationId, conversation);
    markRenderDirty();
  }

  function removeLocalConversation(conversationId) {
    const existing = getConversationById(conversationId);
    if (!existing) {
      return null;
    }

    state.conversations.delete(conversationId);
    markRenderDirty();
    return existing;
  }

  function getChatMenuButtonFromEvent(event) {
    const button = event.target?.closest?.("[data-grok-show-all-chats-menu-button='true']");
    if (!(button instanceof HTMLButtonElement)) {
      return null;
    }

    const conversationId = button.dataset.conversationId || "";
    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return null;
    }

    return { button, conversation };
  }

  function messageFromError(error) {
    return error instanceof Error && error.message ? error.message : t("unknownError");
  }

  function alertActionError(translationKey, error) {
    window.alert(t(translationKey, { message: messageFromError(error) }));
  }

  async function requestConversationApi(path, { method = "GET", body } = {}) {
    const headers = {
      Accept: "application/json"
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(new URL(path, location.origin).href, {
      cache: "no-store",
      credentials: "include",
      headers,
      method,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await response.text();
    if (!response.ok) {
      const error = new Error(text ? `HTTP ${response.status}: ${text.slice(0, 180)}` : `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (!text) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return JSON.parse(text);
    }

    return text;
  }

  function conversationPath(conversationId) {
    return `${API_PATH}/${encodeURIComponent(String(conversationId))}`;
  }

  function softDeleteConversationPath(conversationId) {
    return `${API_PATH}/soft/${encodeURIComponent(String(conversationId))}`;
  }

  async function updateConversationOnServer(conversationId, body) {
    return requestConversationApi(conversationPath(conversationId), {
      body,
      method: "PUT"
    });
  }

  async function softDeleteConversationOnServer(conversationId) {
    return requestConversationApi(softDeleteConversationPath(conversationId), {
      method: "DELETE"
    });
  }

  function conversationFromActionResponse(data) {
    const raw = data?.conversation || data?.result?.conversation || data?.data?.conversation || data?.result || data?.data || data;
    return conversationFromApi(raw);
  }

  function applyServerConversation(data) {
    const conversation = conversationFromActionResponse(data);
    if (!conversation) {
      return;
    }

    mergeConversation(conversation);
    markRenderDirty();
  }

  function closeChatMenu({ restoreFocus = false } = {}) {
    const menu = state.menu;
    const button = state.menuButton;
    const menuConversationId = state.menuConversationId;

    state.menu = null;
    state.menuButton = null;
    state.menuConversationId = "";

    if (button instanceof HTMLButtonElement) {
      button.setAttribute("aria-expanded", "false");
    }

    if (menuConversationId) {
      state.panel?.querySelectorAll("[data-grok-show-all-chats-menu-button='true']").forEach((currentButton) => {
        if (currentButton instanceof HTMLButtonElement && currentButton.dataset.conversationId === menuConversationId) {
          currentButton.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (menu instanceof HTMLElement) {
      menu.remove();
    }

    if (restoreFocus && button instanceof HTMLButtonElement && button.isConnected) {
      button.focus({ preventScroll: true });
    }
  }

  function positionChatMenu(menu, button) {
    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width || 220;
    const menuHeight = menuRect.height || 150;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

    const left = Math.min(
      viewportWidth - menuWidth - MENU_EDGE_MARGIN,
      Math.max(MENU_EDGE_MARGIN, buttonRect.right - menuWidth)
    );
    const preferredTop = buttonRect.bottom + MENU_VERTICAL_GAP;
    const top = preferredTop + menuHeight <= viewportHeight - MENU_EDGE_MARGIN
      ? preferredTop
      : Math.max(MENU_EDGE_MARGIN, buttonRect.top - menuHeight - MENU_VERTICAL_GAP);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }

  function createChatMenuItem(label, action, { danger = false } = {}) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("data-grok-show-all-chats-menu-item", "true");
    item.setAttribute("role", "menuitem");
    item.textContent = label;

    if (danger) {
      item.setAttribute("data-grok-show-all-chats-menu-danger", "true");
    }

    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void action();
    });

    return item;
  }

  function openChatMenu(button, conversation) {
    if (state.menu && state.menuConversationId === conversation.conversationId) {
      closeChatMenu({ restoreFocus: true });
      return;
    }

    closeChatMenu();
    rememberListScrollTop();

    const menu = document.createElement("div");
    menu.setAttribute("data-grok-show-all-chats-menu", "true");
    menu.setAttribute("role", "menu");
    menu.dataset.conversationId = conversation.conversationId;
    menu.append(
      createChatMenuItem(t("openNewTab"), () => openConversationInNewTab(conversation.conversationId)),
      createChatMenuItem(t("rename"), () => renameConversation(conversation.conversationId)),
      createChatMenuItem(t(conversation.starred ? "unpin" : "pin"), () => togglePinConversation(conversation.conversationId)),
      createChatMenuItem(t("delete"), () => deleteConversation(conversation.conversationId), { danger: true })
    );

    state.menu = menu;
    state.menuButton = button;
    state.menuConversationId = conversation.conversationId;
    button.setAttribute("aria-expanded", "true");

    document.body.append(menu);
    positionChatMenu(menu, button);
  }

  function openConversationInNewTab(conversationId) {
    closeChatMenu();

    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return;
    }

    const url = new URL(conversation.href || hrefForConversationId(conversationId), location.origin);
    window.open(url.href, "_blank", "noopener,noreferrer");
  }

  async function renameConversation(conversationId) {
    closeChatMenu();

    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return;
    }

    const nextTitleInput = window.prompt(t("renamePrompt"), conversation.title || "");
    if (nextTitleInput === null) {
      return;
    }

    const title = normalizeText(nextTitleInput).slice(0, 180);
    if (!title || title === conversation.title) {
      return;
    }

    const previous = updateLocalConversation(conversationId, { title });
    const body = { title };
    if (typeof conversation.starred === "boolean") {
      body.starred = conversation.starred;
    }

    try {
      applyServerConversation(await updateConversationOnServer(conversationId, body));
    } catch (error) {
      if (previous) {
        restoreLocalConversation(previous);
      }
      alertActionError("renameError", error);
    }
  }

  async function togglePinConversation(conversationId) {
    closeChatMenu();

    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return;
    }

    const starred = !Boolean(conversation.starred);
    const previous = updateLocalConversation(conversationId, { starred });

    try {
      applyServerConversation(await updateConversationOnServer(conversationId, { starred }));
    } catch (error) {
      if (previous) {
        restoreLocalConversation(previous);
      }
      alertActionError(starred ? "pinError" : "unpinError", error);
    }
  }

  async function deleteConversation(conversationId) {
    closeChatMenu();

    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return;
    }

    const title = conversation.title || t("untitledChat");
    if (!window.confirm(t("deleteConfirm", { title }))) {
      return;
    }

    const previous = removeLocalConversation(conversationId);

    try {
      await softDeleteConversationOnServer(conversationId);
      if (conversationId === getCurrentConversationId()) {
        navigateToHomeSeamlessly();
      }
    } catch (error) {
      if (previous) {
        restoreLocalConversation(previous);
      }
      alertActionError("deleteError", error);
    }
  }

  function handleDocumentPointerDown(event) {
    if (!state.menu) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      closeChatMenu();
      return;
    }

    if (state.menu.contains(target) || state.menuButton?.contains?.(target)) {
      return;
    }

    closeChatMenu();
  }

  function handleDocumentKeyDown(event) {
    if (!state.menu || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeChatMenu({ restoreFocus: true });
  }

  function isPlainPrimaryClick(event) {
    return event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey;
  }

  function getNavigableLinkFromEvent(event) {
    const link = event.target?.closest?.("[data-grok-show-all-chats-link='true']");
    if (!(link instanceof HTMLAnchorElement)) {
      return null;
    }

    if (link.target && link.target.toLowerCase() !== "_self") {
      return null;
    }

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !extractConversationIdFromPath(url.pathname)) {
      return null;
    }

    return { link, url };
  }

  function markNavigatingLink(link) {
    state.panel?.querySelectorAll("[data-grok-show-all-chats-active='true'], [data-grok-show-all-chats-navigating='true'], [aria-current='page']").forEach((element) => {
      element.removeAttribute("data-grok-show-all-chats-active");
      element.removeAttribute("aria-current");
      element.removeAttribute("data-grok-show-all-chats-navigating");
    });

    const row = link.closest("[data-grok-show-all-chats-row='true']");
    if (row instanceof HTMLElement) {
      row.setAttribute("data-grok-show-all-chats-active", "true");
      row.setAttribute("data-grok-show-all-chats-navigating", "true");
    } else {
      link.setAttribute("data-grok-show-all-chats-active", "true");
      link.setAttribute("data-grok-show-all-chats-navigating", "true");
    }
    link.setAttribute("aria-current", "page");
  }

  function tryNextPagesRouterNavigation(url) {
    const router = window.next?.router;
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

  function tryNextAppRouterNavigation(url, sourceNode) {
    const router = findNextAppRouter(sourceNode);
    if (!router || typeof router.push !== "function") {
      return false;
    }

    try {
      const result = router.push(pathSearchHash(url), { scroll: false });
      if (result && typeof result.catch === "function") {
        void result.catch(() => undefined);
      }
      return true;
    } catch {
      if (state.nextAppRouter === router) {
        state.nextAppRouter = null;
      }
      return false;
    }
  }

  function tryNextRouterPrefetch(url, sourceNode) {
    const target = pathSearchHash(url);
    if (state.prefetchedRoutes.has(target)) {
      return;
    }

    const router = findNextAppRouter(sourceNode) || window.next?.router;
    if (!router || typeof router.prefetch !== "function") {
      return;
    }

    try {
      const result = router.prefetch(target);
      state.prefetchedRoutes.add(target);
      if (state.prefetchedRoutes.size > 100) {
        state.prefetchedRoutes.delete(state.prefetchedRoutes.values().next().value);
      }
      if (result && typeof result.catch === "function") {
        void result.catch(() => {
          state.prefetchedRoutes.delete(target);
        });
      }
    } catch {
      state.prefetchedRoutes.delete(target);
      if (state.nextAppRouter === router) {
        state.nextAppRouter = null;
      }
    }
  }

  function tryGrokRoutingStoreNavigation(route, prefetchRequest = null, sequence = state.navigationSequence) {
    maybeCaptureGrokStores();
    const snapshot = getStoreState(state.routingStore);
    if (!snapshot || typeof snapshot.push !== "function") {
      return false;
    }

    try {
      snapshot.push(route);
      setChatPageConversationId(getConversationIdFromRoute(route) || null);
      if (route.page === "chat") {
        resolveConversationWorkspace(String(route.conversationId || ""), prefetchRequest, sequence);
      }
      return true;
    } catch {
      return false;
    }
  }

  function getConversationIdFromRoute(route) {
    if (
      (route?.page === "chat" || route?.page === "workspace") &&
      route.conversationId
    ) {
      return String(route.conversationId);
    }

    return "";
  }

  function getCurrentConversationId() {
    const bridgeConversationId = String(
      getPageBridgeNavigationStatus()?.activeConversationId || ""
    );
    if (bridgeConversationId) {
      return bridgeConversationId;
    }

    const pathConversationId = extractConversationIdFromPath(location.pathname);
    if (pathConversationId) {
      return pathConversationId;
    }

    const route = getStoreState(state.routingStore)?.route;
    const routeConversationId = getConversationIdFromRoute(route);
    if (routeConversationId) {
      return routeConversationId;
    }

    if (route && route.page !== "unknown") {
      return "";
    }

    const chatPageConversationId = getStoreState(state.chatPageStore)?.conversationId;
    return chatPageConversationId ? String(chatPageConversationId) : "";
  }

  function setChatPageConversationId(conversationId) {
    maybeCaptureGrokStores();
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

  function getStoredConversation(conversationId) {
    return getStoreState(state.conversationStore)?.byId?.[conversationId] || null;
  }

  function getWorkspaceRoute(conversationId, conversation = getStoredConversation(conversationId)) {
    const workspaceId = conversation?.workspaces?.[0]?.workspaceId;
    if (!workspaceId) {
      return null;
    }

    return {
      conversationId,
      page: "workspace",
      tab: "conversations",
      workspaceId
    };
  }

  function getConversationRoute(conversationId) {
    const conversation = getStoredConversation(conversationId);
    return getWorkspaceRoute(conversationId, conversation) || {
      conversationId,
      page: "chat",
      temporary: Boolean(conversation?.temporary)
    };
  }

  function refreshAfterNavigation() {
    scheduleImmediateRun();
  }

  function resolveConversationWorkspace(conversationId, request, sequence) {
    if (!request || typeof request.then !== "function") {
      return;
    }

    void request.then((conversation) => {
      if (sequence !== state.navigationSequence) {
        return;
      }

      const route = getStoreState(state.routingStore)?.route;
      if (route?.page !== "chat" || String(route.conversationId || "") !== conversationId) {
        return;
      }

      const workspaceRoute = getWorkspaceRoute(conversationId, conversation);
      const routingSnapshot = getStoreState(state.routingStore);
      if (!workspaceRoute || typeof routingSnapshot?.replace !== "function") {
        return;
      }

      try {
        routingSnapshot.replace(workspaceRoute);
        refreshAfterNavigation();
      } catch {
        // The chat route remains usable if workspace resolution cannot replace it.
      }
    }).catch(() => undefined);
  }

  function clearNavigationRetry() {
    if (state.navigationRetryTimer) {
      window.clearTimeout(state.navigationRetryTimer);
      state.navigationRetryTimer = 0;
    }
  }

  function isConversationRouteActive(conversationId) {
    const bridgeStatus = getPageBridgeNavigationStatus();
    if (
      Array.isArray(bridgeStatus?.activeConversationIds) &&
      bridgeStatus.activeConversationIds.includes(conversationId)
    ) {
      return true;
    }

    if (extractConversationIdFromPath(location.pathname) === conversationId) {
      return true;
    }

    const route = getStoreState(state.routingStore)?.route;
    return getConversationIdFromRoute(route) === conversationId;
  }

  function tryConversationNavigation(url, link, conversationId, route, prefetchRequest, sequence) {
    if (tryPageBridgeNavigation(url, conversationId)) {
      return true;
    }

    if (tryNextAppRouterNavigation(url, link)) {
      return true;
    }
    if (tryNextPagesRouterNavigation(url)) {
      return true;
    }
    return tryGrokRoutingStoreNavigation(route, prefetchRequest, sequence);
  }

  function attemptConversationNavigation({
    attemptsRemaining,
    conversationId,
    link,
    prefetchRequest,
    route,
    sequence,
    url,
  }) {
    if (sequence !== state.navigationSequence) {
      return;
    }

    if (isConversationRouteActive(conversationId)) {
      clearNavigationRetry();
      if (state.navigationPendingTarget === conversationId) {
        state.navigationPendingTarget = "";
      }
      refreshAfterNavigation();
      settleNavigationScrollPreservation(conversationId);
      return;
    }

    const navigationStarted = tryConversationNavigation(
      url,
      link,
      conversationId,
      route,
      prefetchRequest,
      sequence
    );
    if (navigationStarted) {
      clearNavigationRetry();
      refreshAfterNavigation();
      state.navigationRetryTimer = window.setTimeout(() => {
        state.navigationRetryTimer = 0;
        if (sequence !== state.navigationSequence) {
          return;
        }
        if (state.navigationPendingTarget === conversationId) {
          state.navigationPendingTarget = "";
        }
        refreshAfterNavigation();
        if (isConversationRouteActive(conversationId)) {
          settleNavigationScrollPreservation(conversationId);
        }
      }, NAVIGATION_CONFIRM_DELAY_MS);
      return;
    }

    if (attemptsRemaining <= 0) {
      clearNavigationRetry();
      if (state.navigationPendingTarget === conversationId) {
        state.navigationPendingTarget = "";
      }
      releaseNavigationScrollPreservation();
      state.lastRenderSignature = "";
      scheduleRun();
      return;
    }

    clearNavigationRetry();
    state.navigationRetryTimer = window.setTimeout(() => {
      state.navigationRetryTimer = 0;
      attemptConversationNavigation({
        attemptsRemaining: attemptsRemaining - 1,
        conversationId,
        link,
        prefetchRequest,
        route,
        sequence,
        url
      });
    }, NAVIGATION_RETRY_DELAY_MS);
  }

  function navigateSeamlessly(url, link) {
    const conversationId = extractConversationIdFromPath(url.pathname);
    if (!conversationId) {
      return;
    }

    if (state.navigationPendingTarget === conversationId) {
      markNavigatingLink(link);
      restorePreservedNavigationScroll();
      return;
    }

    if (
      !state.navigationPendingTarget &&
      getCurrentConversationId() === conversationId &&
      isConversationRouteActive(conversationId)
    ) {
      clearNavigationRetry();
      if (state.navigationScrollTarget) {
        releaseNavigationScrollPreservation();
      }
      scheduleRun();
      return;
    }

    beginNavigationScrollPreservation(conversationId);
    markNavigatingLink(link);
    state.navigationPendingTarget = conversationId;
    state.navigationSequence += 1;
    clearNavigationRetry();
    const sequence = state.navigationSequence;
    const prefetchRequest = prefetchConversation(conversationId);
    const route = getConversationRoute(conversationId);
    attemptConversationNavigation({
      attemptsRemaining: NAVIGATION_RETRY_LIMIT,
      conversationId,
      link,
      prefetchRequest,
      route,
      sequence,
      url
    });
  }

  function attemptHomeNavigation(url, sequence, attemptsRemaining) {
    if (sequence !== state.navigationSequence) {
      return;
    }

    const route = getStoreState(state.routingStore)?.route;
    if (location.pathname === "/" && (!route || route.page === "main")) {
      clearNavigationRetry();
      scheduleRun();
      return;
    }

    const navigationStarted =
      tryPageBridgeHomeNavigation(url) ||
      tryNextAppRouterNavigation(url, state.panel || document.body) ||
      tryNextPagesRouterNavigation(url) ||
      tryGrokRoutingStoreNavigation({ page: "main" });

    if (navigationStarted) {
      clearNavigationRetry();
      refreshAfterNavigation();
      return;
    }

    if (attemptsRemaining <= 0) {
      clearNavigationRetry();
      scheduleRun();
      return;
    }

    clearNavigationRetry();
    state.navigationRetryTimer = window.setTimeout(() => {
      state.navigationRetryTimer = 0;
      attemptHomeNavigation(url, sequence, attemptsRemaining - 1);
    }, NAVIGATION_RETRY_DELAY_MS);
  }

  function navigateToHomeSeamlessly() {
    const url = new URL("/", location.origin);
    const currentRoute = getStoreState(state.routingStore)?.route;
    if (url.href === location.href && (!currentRoute || currentRoute.page === "main")) {
      scheduleRun();
      return;
    }

    state.navigationSequence += 1;
    state.navigationPendingTarget = "";
    clearNavigationRetry();
    if (state.navigationScrollTarget) {
      releaseNavigationScrollPreservation();
    }
    attemptHomeNavigation(url, state.navigationSequence, NAVIGATION_RETRY_LIMIT);
  }

  function handlePanelClick(event) {
    const menuTarget = getChatMenuButtonFromEvent(event);
    if (menuTarget) {
      event.preventDefault();
      event.stopPropagation();
      openChatMenu(menuTarget.button, menuTarget.conversation);
      return;
    }

    if (!isPlainPrimaryClick(event)) {
      return;
    }

    const target = getNavigableLinkFromEvent(event);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    target.link.blur();
    navigateSeamlessly(target.url, target.link);
  }

  function handlePanelNavigationIntent(event) {
    const target = getNavigableLinkFromEvent(event);
    if (!target) {
      return;
    }

    const conversationId = extractConversationIdFromPath(target.url.pathname);
    requestPageBridgePrefetch(target.url, conversationId);
    prefetchConversation(conversationId);
    tryNextRouterPrefetch(target.url, target.link);
  }

  function createConversationRow(conversation, currentConversationId) {
    const title = conversation.title || t("untitledChat");
    const row = document.createElement("div");
    row.setAttribute("data-grok-show-all-chats-row", "true");
    row.setAttribute("role", "listitem");
    row.dataset.conversationId = conversation.conversationId;

    const link = document.createElement("a");
    link.setAttribute("data-grok-show-all-chats-link", "true");
    link.dataset.conversationId = conversation.conversationId;
    link.href = conversation.href || hrefForConversationId(conversation.conversationId);
    link.title = title;
    link.textContent = title;

    if (conversation.conversationId === currentConversationId) {
      link.setAttribute("aria-current", "page");
      row.setAttribute("data-grok-show-all-chats-active", "true");
    }

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.setAttribute("data-grok-show-all-chats-menu-button", "true");
    menuButton.setAttribute("aria-haspopup", "menu");
    menuButton.setAttribute("aria-expanded", state.menuConversationId === conversation.conversationId ? "true" : "false");
    menuButton.setAttribute("aria-label", t("chatMenuAria", { title }));
    menuButton.dataset.conversationId = conversation.conversationId;
    menuButton.textContent = "\u22ef";

    row.append(link, menuButton);
    return row;
  }

  function appendConversationRows(list, conversations, currentConversationId) {
    for (const conversation of conversations) {
      list.append(createConversationRow(conversation, currentConversationId));
    }
  }

  function appendConversationGroups(list, pinnedConversations, historyConversations, currentConversationId) {
    appendConversationRows(list, pinnedConversations, currentConversationId);

    if (pinnedConversations.length && historyConversations.length) {
      const historyHeading = document.createElement("div");
      historyHeading.setAttribute("data-grok-show-all-chats-section-heading", "true");
      historyHeading.setAttribute("aria-level", "3");
      historyHeading.setAttribute("role", "heading");
      historyHeading.textContent = t("history");
      list.append(historyHeading);
    }

    appendConversationRows(list, historyConversations, currentConversationId);
  }

  function renderPanel(sidebar, showAllControl) {
    if (!sidebar) {
      return;
    }

    if (state.sidebar && state.sidebar !== sidebar) {
      clearSidebarWidthLayout();
    }
    state.sidebar = sidebar;
    sidebar.setAttribute("data-grok-show-all-chats-sidebar", "true");
    mergeConversations(collectDomConversations(sidebar));

    const panel = ensurePanel(sidebar, showAllControl);
    panel.setAttribute("aria-label", t("allChatsAria"));
    updateSidebarWidthLayout(sidebar);
    ensureSidebarResizeHandle(panel);
    if (state.resizeDrag) {
      return;
    }

    const conversations = sortedConversations();
    const { history: historyConversations, pinned: pinnedConversations } = partitionConversations(conversations);
    setNativeHistoryVisibility(showAllControl);
    const previousScrollTop = state.navigationScrollTarget
      ? state.navigationScrollTop
      : panel.childElementCount > 0
        ? getCurrentListScrollTop(panel)
        : state.listScrollTop;

    const routeConversationId = getCurrentConversationId();
    const currentConversationId = state.navigationScrollTarget || routeConversationId;
    const signature = JSON.stringify({
      currentConversationId,
      done: state.apiDone,
      error: state.apiError,
      language: state.language,
      ids: conversations.map((conversation) => [
        conversation.conversationId,
        conversation.title,
        conversation.modifyTime,
        conversation.createTime,
        conversation.href,
        Boolean(conversation.starred)
      ]),
      loading: state.apiLoading
    });

    if (signature === state.lastRenderSignature && panel.childElementCount > 0) {
      if (state.navigationScrollTarget === routeConversationId) {
        settleNavigationScrollPreservation(routeConversationId, panel);
      }
      return;
    }
    state.lastRenderSignature = signature;

    const heading = document.createElement("div");
    heading.id = "grok-show-all-chats-heading";
    heading.setAttribute("data-grok-show-all-chats-heading", "true");
    heading.setAttribute("aria-busy", state.apiLoading ? "true" : "false");
    heading.setAttribute("aria-level", "2");
    heading.setAttribute("role", "heading");

    const headingTitle = document.createElement("span");
    headingTitle.textContent = t(pinnedConversations.length ? "pinned" : "history");
    heading.append(headingTitle);

    if (state.apiLoading) {
      const loadingIndicator = document.createElement("span");
      loadingIndicator.setAttribute("data-grok-show-all-chats-loading", "true");
      loadingIndicator.setAttribute("aria-hidden", "true");
      heading.append(loadingIndicator);
    }

    const status = document.createElement("div");
    status.setAttribute("data-grok-show-all-chats-status", "true");
    if (state.apiError) {
      status.setAttribute("data-grok-show-all-chats-status-tone", "error");
      status.setAttribute("role", "alert");
      status.textContent = state.conversations.size
        ? t("partialHistoryError")
        : t("historyError");
    } else if (state.apiLoading && conversations.length === 0) {
      status.setAttribute("role", "status");
      status.textContent = t("loadingHistory");
    } else {
      status.textContent = state.apiDone ? "" : t("waitingHistory");
    }

    const list = document.createElement("div");
    list.setAttribute("data-grok-show-all-chats-list", "true");
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", t("allChatsAria"));
    list.setAttribute("aria-busy", state.apiLoading ? "true" : "false");

    if (conversations.length === 0 && !state.apiLoading) {
      const empty = document.createElement("div");
      empty.setAttribute("data-grok-show-all-chats-empty", "true");
      empty.textContent = state.apiError ? t("signedInRequired") : t("noChats");
      list.append(empty);
    } else {
      appendConversationGroups(list, pinnedConversations, historyConversations, currentConversationId);
    }

    panel.replaceChildren(heading, status, list);
    restoreListScrollTop(panel, previousScrollTop);
    if (state.navigationScrollTarget === routeConversationId) {
      settleNavigationScrollPreservation(routeConversationId, panel);
    }
    updateSidebarResizeHandlePosition(panel);
  }

  function getConversationListFromResponse(data) {
    const list = data?.conversations || data?.result?.conversations || data?.data?.conversations || data?.items;
    return Array.isArray(list) ? list : [];
  }

  function getNextPageTokenFromResponse(data) {
    return normalizeText(
      data?.nextPageToken ||
      data?.result?.nextPageToken ||
      data?.data?.nextPageToken ||
      data?.next_page_token
    );
  }

  async function fetchConversationPage(pageToken) {
    const url = new URL(API_PATH, location.origin);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.href, {
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json"
      },
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function loadConversationsFromApi({ reset = false } = {}) {
    if (state.apiLoading) {
      return;
    }

    state.apiStarted = true;
    state.apiLoading = true;
    state.apiError = "";

    if (reset) {
      state.apiDone = false;
      state.nextPageToken = "";
    }

    scheduleRun();

    try {
      let pageToken = state.nextPageToken;
      let pagesLoaded = 0;

      while (pagesLoaded < MAX_PAGES_PER_LOAD) {
        const data = await fetchConversationPage(pageToken);
        const conversations = getConversationListFromResponse(data)
          .map(conversationFromApi)
          .filter(Boolean);

        mergeConversations(conversations);
        pagesLoaded += 1;

        pageToken = getNextPageTokenFromResponse(data);
        state.nextPageToken = pageToken;
        state.apiDone = !pageToken;
        scheduleRun();

        if (!pageToken) {
          break;
        }
      }

      if (state.nextPageToken) {
        state.apiError = t("historyTooLarge");
      }
    } catch (error) {
      state.apiError = error instanceof Error ? error.message : t("unknownError");
    } finally {
      state.apiLoading = false;
      scheduleRun();
    }
  }

  function maybeStartApiLoad() {
    if (!state.apiStarted) {
      void loadConversationsFromApi();
    }
  }

  function maybeRefreshApiLoad() {
    if (!state.apiStarted || state.apiLoading) {
      return;
    }

    void loadConversationsFromApi({ reset: true });
  }

  async function run() {
    if (state.runInProgress) {
      return;
    }

    state.runInProgress = true;
    try {
      maybeCaptureGrokStores();

      const nextLocationKey = getLocationKey();
      if (nextLocationKey !== state.currentLocationKey) {
        state.currentLocationKey = nextLocationKey;
        state.lastRenderSignature = "";
      }

      const sidebar = findLikelySidebar();
      if (!sidebar) {
        if (state.sidebarWidthSidebar && !document.contains(state.sidebarWidthSidebar)) {
          clearSidebarWidthLayout();
        }
        return;
      }

      const showAllControl = findShowAllControl(sidebar);
      maybeStartApiLoad();
      renderPanel(sidebar, showAllControl);
    } finally {
      state.runInProgress = false;
    }
  }

  function scheduleRun() {
    if (state.renderScheduled) {
      return;
    }

    state.renderScheduled = true;
    window.setTimeout(() => {
      state.renderScheduled = false;
      void run();
    }, MUTATION_THROTTLE_MS);
  }

  const observer = new MutationObserver(scheduleRun);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const languageObserver = new MutationObserver(handleLanguagePreferenceChange);
  languageObserver.observe(document.documentElement, {
    attributeFilter: ["lang", i18n.LANGUAGE_ATTRIBUTE],
    attributes: true
  });

  document.documentElement.addEventListener(i18n.LANGUAGE_CHANGE_EVENT, handleLanguagePreferenceChange);
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
  document.addEventListener("keydown", handleDocumentKeyDown, true);
  window.addEventListener("pointermove", handleSidebarResizePointerMove, { passive: false });
  window.addEventListener("pointerup", finishSidebarResize, { passive: false });
  window.addEventListener("pointercancel", finishSidebarResize, { passive: false });
  window.addEventListener("popstate", scheduleRun);
  window.addEventListener("focus", scheduleRun);
  window.addEventListener("resize", () => {
    closeChatMenu();
    if (state.sidebarWidthSidebar && document.contains(state.sidebarWidthSidebar)) {
      applySidebarWidth(state.preferredSidebarWidthPixels || state.sidebarWidthBasePixels);
    }
    scheduleRun();
  });
  window.addEventListener("scroll", () => {
    closeChatMenu();
    updateSidebarResizeHandlePosition();
  }, true);
  window.setInterval(scheduleRun, 1000);
  window.setInterval(maybeRefreshApiLoad, REFRESH_INTERVAL_MS);

  globalThis.chrome?.storage?.onChanged?.addListener(handleSidebarWidthStorageChange);
  loadSidebarWidthPreference();
  scheduleRun();
})();
