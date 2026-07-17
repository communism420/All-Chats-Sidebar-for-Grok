"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("webext.js", "utf8");

function createChangeEvent() {
  const listeners = new Set();
  return {
    addListener(listener) {
      listeners.add(listener);
    },
    emit(changes, areaName) {
      for (const listener of listeners) {
        listener(changes, areaName);
      }
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    size() {
      return listeners.size;
    }
  };
}

function loadAdapter(globals) {
  const context = vm.createContext({ ...globals });
  vm.runInContext(source, context, { filename: "webext.js" });
  return context.GrokShowAllChatsWebExtension;
}

function createCallbackStorageArea(data, runtime) {
  return {
    get(defaults, callback) {
      callback({ ...defaults, ...data });
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
      callback();
    },
    set(values, callback) {
      Object.assign(data, values);
      callback();
    },
    failNext(message) {
      runtime.lastError = { message };
    }
  };
}

function createPromiseStorageArea(data) {
  return {
    async get(defaults) {
      return { ...defaults, ...data };
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
    },
    async set(values) {
      Object.assign(data, values);
    }
  };
}

async function testChromiumCallbackApi() {
  const runtime = {
    getURL: () => "chrome-extension://test/",
    lastError: null
  };
  const changes = createChangeEvent();
  const localData = {};
  const syncData = {};
  const local = createCallbackStorageArea(localData, runtime);
  const sync = createCallbackStorageArea(syncData, runtime);
  const adapter = loadAdapter({
    chrome: {
      runtime,
      storage: { local, onChanged: changes, sync }
    }
  });

  assert.equal(adapter.available, true);
  assert.equal(adapter.browserFamily, "chromium");
  assert.equal(adapter.preferenceAreaName, "sync");

  await adapter.storage.set("sync", { interfaceLanguage: "de" });
  assert.deepEqual(
    { ...(await adapter.storage.get("sync", { interfaceLanguage: "auto" })) },
    { interfaceLanguage: "de" }
  );
  await adapter.storage.remove("sync", "interfaceLanguage");
  assert.deepEqual(
    { ...(await adapter.storage.get("sync", { interfaceLanguage: "auto" })) },
    { interfaceLanguage: "auto" }
  );

  let observedArea = "";
  const removeListener = adapter.addStorageChangeListener((changeSet, areaName) => {
    observedArea = `${areaName}:${changeSet.interfaceLanguage.newValue}`;
  });
  changes.emit({ interfaceLanguage: { newValue: "fr" } }, "sync");
  assert.equal(observedArea, "sync:fr");
  removeListener();
  assert.equal(changes.size(), 0);

  sync.failNext("Storage denied");
  await assert.rejects(
    adapter.storage.set("sync", { interfaceLanguage: "es" }),
    /Storage denied/
  );
  runtime.lastError = null;
}

async function testFirefoxPromiseApi() {
  const changes = createChangeEvent();
  const localData = {};
  const syncData = {};
  const adapter = loadAdapter({
    browser: {
      runtime: {
        getBrowserInfo: async () => ({ name: "Firefox" }),
        getURL: () => "moz-extension://test/"
      },
      storage: {
        local: createPromiseStorageArea(localData),
        onChanged: changes,
        sync: createPromiseStorageArea(syncData)
      }
    }
  });

  assert.equal(adapter.available, true);
  assert.equal(adapter.browserFamily, "firefox");
  assert.equal(adapter.preferenceAreaName, "local");
  await adapter.storage.set(adapter.preferenceAreaName, { interfaceLanguage: "uk" });
  assert.deepEqual(
    { ...(await adapter.storage.get("local", { interfaceLanguage: "auto" })) },
    { interfaceLanguage: "uk" }
  );
  assert.deepEqual(syncData, {});
}

async function testPromiseNamespaceInChromium() {
  const callbackData = {};
  const callbackRuntime = {
    getURL: () => "chrome-extension://callback/",
    lastError: null
  };
  const adapter = loadAdapter({
    browser: {
      runtime: { getURL: () => "chrome-extension://test/" },
      storage: {
        local: createPromiseStorageArea({}),
        onChanged: createChangeEvent(),
        sync: createPromiseStorageArea({})
      }
    },
    chrome: {
      runtime: callbackRuntime,
      storage: {
        local: createCallbackStorageArea({}, callbackRuntime),
        onChanged: createChangeEvent(),
        sync: createCallbackStorageArea(callbackData, callbackRuntime)
      }
    }
  });

  assert.equal(adapter.browserFamily, "chromium");
  assert.equal(adapter.preferenceAreaName, "sync");
  await adapter.storage.set("sync", { source: "callback" });
  assert.deepEqual(callbackData, { source: "callback" });
}

async function testUnavailableApi() {
  const adapter = loadAdapter({});
  assert.equal(adapter.available, false);
  await assert.rejects(adapter.storage.get("local", {}), /unavailable/);
}

void testChromiumCallbackApi()
  .then(testFirefoxPromiseApi)
  .then(testPromiseNamespaceInChromium)
  .then(testUnavailableApi)
  .then(() => {
    console.log("Chromium and Firefox WebExtension adapter tests passed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
