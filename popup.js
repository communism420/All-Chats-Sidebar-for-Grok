(() => {
  "use strict";

  const i18n = globalThis.GrokShowAllChatsI18n;
  if (!i18n || !globalThis.chrome?.storage?.sync) {
    return;
  }

  const title = document.getElementById("title");
  const languageLabel = document.getElementById("language-label");
  const languageSelect = document.getElementById("language");
  const status = document.getElementById("status");
  const privacyNotice = document.getElementById("privacy-notice");
  const sourceLink = document.getElementById("source-link");
  let currentPreference = "auto";
  let statusTimer = 0;

  languageSelect.disabled = true;

  function getAutomaticLanguageCandidates() {
    return [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language
    ];
  }

  function getUiLanguage(preference) {
    return i18n.resolveLanguage(preference, getAutomaticLanguageCandidates());
  }

  function translate(preference, key) {
    return i18n.translate(getUiLanguage(preference), key);
  }

  function createOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function render(preference) {
    const normalizedPreference = i18n.normalizePreference(preference);
    const uiLanguage = getUiLanguage(normalizedPreference);
    document.documentElement.lang = uiLanguage;
    document.title = i18n.translate(uiLanguage, "extensionName");
    title.textContent = document.title;
    languageLabel.textContent = i18n.translate(uiLanguage, "languageLabel");
    privacyNotice.textContent = i18n.translate(uiLanguage, "privacyNotice");
    sourceLink.textContent = i18n.translate(uiLanguage, "sourceCode");
    languageSelect.setAttribute("aria-label", languageLabel.textContent);
    languageSelect.replaceChildren(
      createOption("auto", i18n.translate(uiLanguage, "automaticLanguage")),
      ...i18n.SUPPORTED_LANGUAGES.map((language) => {
        return createOption(language, i18n.LANGUAGE_NAMES[language]);
      })
    );
    languageSelect.value = normalizedPreference;
  }

  function showStatus(key, tone = "default") {
    window.clearTimeout(statusTimer);
    status.textContent = key ? translate(currentPreference, key) : "";
    if (tone === "error") {
      status.setAttribute("data-tone", "error");
    } else {
      status.removeAttribute("data-tone");
    }

    if (key) {
      statusTimer = window.setTimeout(() => {
        status.textContent = "";
        status.removeAttribute("data-tone");
      }, 1600);
    }
  }

  function loadPreference() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ [i18n.STORAGE_KEY]: "auto" }, (result) => {
        if (chrome.runtime.lastError) {
          resolve("auto");
          return;
        }
        resolve(i18n.normalizePreference(result[i18n.STORAGE_KEY]));
      });
    });
  }

  function saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  languageSelect.addEventListener("change", async () => {
    const previousPreference = currentPreference;
    const nextPreference = i18n.normalizePreference(languageSelect.value);
    currentPreference = nextPreference;
    render(currentPreference);

    try {
      await saveSetting(i18n.STORAGE_KEY, currentPreference);
      showStatus("saved");
    } catch {
      currentPreference = previousPreference;
      render(currentPreference);
      showStatus("saveFailed", "error");
    }
  });

  render(currentPreference);
  void loadPreference().then((preference) => {
    currentPreference = preference;
    render(currentPreference);
    languageSelect.disabled = false;
  });
})();
