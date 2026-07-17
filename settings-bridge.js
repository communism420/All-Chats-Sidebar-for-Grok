(() => {
  "use strict";

  const i18n = globalThis.GrokShowAllChatsI18n;
  const webExtension = globalThis.GrokShowAllChatsWebExtension;
  if (!i18n || !webExtension?.available) {
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

  async function loadLanguage() {
    try {
      const result = await webExtension.storage.get(
        webExtension.preferenceAreaName,
        { [i18n.STORAGE_KEY]: "auto" }
      );
      publishLanguage(result[i18n.STORAGE_KEY]);
    } catch {
      publishLanguage("auto");
    }
  }

  webExtension.addStorageChangeListener((changes, areaName) => {
    if (areaName !== webExtension.preferenceAreaName) {
      return;
    }

    if (changes[i18n.STORAGE_KEY]) {
      publishLanguage(changes[i18n.STORAGE_KEY].newValue);
    }
  });

  void loadLanguage();
})();
