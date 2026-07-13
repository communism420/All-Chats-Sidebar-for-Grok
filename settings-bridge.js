(() => {
  "use strict";

  const i18n = globalThis.GrokShowAllChatsI18n;
  if (!i18n || !globalThis.chrome?.storage?.sync) {
    return;
  }

  function publishLanguage(preference) {
    const root = document.documentElement;
    if (!root) {
      document.addEventListener("readystatechange", () => publishLanguage(preference), { once: true });
      return;
    }

    root.setAttribute(i18n.LANGUAGE_ATTRIBUTE, i18n.normalizePreference(preference));
    root.dispatchEvent(new Event(i18n.LANGUAGE_CHANGE_EVENT));
  }

  function loadLanguage() {
    chrome.storage.sync.get({ [i18n.STORAGE_KEY]: "auto" }, (result) => {
      if (chrome.runtime.lastError) {
        publishLanguage("auto");
        return;
      }
      publishLanguage(result[i18n.STORAGE_KEY]);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes[i18n.STORAGE_KEY]) {
      publishLanguage(changes[i18n.STORAGE_KEY].newValue);
    }
  });

  loadLanguage();
})();
