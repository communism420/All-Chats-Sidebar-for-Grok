(() => {
  "use strict";

  const promiseApi = globalThis.browser;
  const callbackApi = globalThis.chrome;
  let extensionOrigin = "";
  try {
    extensionOrigin = promiseApi?.runtime?.getURL?.("") ||
      callbackApi?.runtime?.getURL?.("") || "";
  } catch {
    // Browser-family detection falls back to the Firefox-only runtime API.
  }
  const isFirefox = extensionOrigin.startsWith("moz-extension://") ||
    typeof promiseApi?.runtime?.getBrowserInfo === "function";
  const api = isFirefox ? (promiseApi || callbackApi) : (callbackApi || promiseApi);
  const usesPromises = Boolean(promiseApi && api === promiseApi);
  const preferenceAreaName = isFirefox || !api?.storage?.sync ? "local" : "sync";
  const available = Boolean(api?.storage?.local && api?.storage?.[preferenceAreaName]);

  function getLastError() {
    const lastError = callbackApi?.runtime?.lastError;
    if (!lastError) {
      return null;
    }
    return new Error(lastError.message || String(lastError));
  }

  function callStorage(areaName, method, argument) {
    const area = api?.storage?.[areaName];
    if (!area || typeof area[method] !== "function") {
      return Promise.reject(new Error(`Extension storage area is unavailable: ${areaName}`));
    }

    if (usesPromises) {
      try {
        return Promise.resolve(area[method](argument));
      } catch (error) {
        return Promise.reject(error);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        area[method](argument, (result) => {
          const error = getLastError();
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function addStorageChangeListener(listener) {
    const event = api?.storage?.onChanged;
    if (!event?.addListener || typeof listener !== "function") {
      return () => {};
    }

    event.addListener(listener);
    return () => {
      try {
        event.removeListener?.(listener);
      } catch {
        // Listener cleanup is best-effort when an extension context is closing.
      }
    };
  }

  globalThis.GrokShowAllChatsWebExtension = Object.freeze({
    addStorageChangeListener,
    available,
    browserFamily: isFirefox ? "firefox" : "chromium",
    preferenceAreaName,
    storage: Object.freeze({
      get(areaName, defaults) {
        return callStorage(areaName, "get", defaults);
      },
      remove(areaName, keys) {
        return callStorage(areaName, "remove", keys);
      },
      set(areaName, values) {
        return callStorage(areaName, "set", values);
      }
    })
  });
})();
