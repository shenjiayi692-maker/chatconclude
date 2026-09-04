import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function createBackgroundHarness() {
  const storage = {};
  const listeners = [];
  let fetchCalls = 0;

  const chrome = {
    storage: {
      local: {
        async get(keys) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            keyList.filter((key) => key in storage).map((key) => [key, storage[key]]),
          );
        },
        async set(values) {
          Object.assign(storage, values);
        },
        async remove(keys) {
          for (const key of keys) delete storage[key];
        },
      },
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
      onStartup: {
        addListener() {},
      },
    },
    alarms: {
      create() {},
      clear: async () => {},
      onAlarm: {
        addListener() {},
      },
    },
  };

  const context = vm.createContext({
    chrome,
    console,
    Date,
    fetch: async () => {
      fetchCalls += 1;
      return { ok: true, status: 200, json: async () => ({ saved: 1 }) };
    },
    setTimeout,
    clearTimeout,
  });

  async function send(message) {
    return new Promise((resolve, reject) => {
      const handled = listeners[0](message, {}, resolve);
      if (!handled) reject(new Error(`Unhandled message: ${message.type}`));
    });
  }

  return {
    context,
    storage,
    send,
    getFetchCalls: () => fetchCalls,
  };
}

test("未同意数据说明时，后台拒绝 INGEST 且不发起网络请求", async () => {
  const source = await readFile(new URL("../src/background.js", import.meta.url), "utf8");
  const harness = createBackgroundHarness();
  vm.runInContext(source, harness.context);

  const result = await harness.send({
    type: "INGEST",
    items: [{ id: "one", question: "Why?", answer: "Because." }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "no_consent");
  assert.equal(harness.getFetchCalls(), 0);
});

test("只有当前版本的主动同意会解锁上传链路", async () => {
  const source = await readFile(new URL("../src/background.js", import.meta.url), "utf8");
  const harness = createBackgroundHarness();
  vm.runInContext(source, harness.context);

  const stale = await harness.send({
    type: "GRANT_DATA_CONSENT",
    version: "old-version",
  });
  assert.equal(stale.ok, false);

  const accepted = await harness.send({
    type: "GRANT_DATA_CONSENT",
    version: "2026-07-30",
  });
  assert.equal(accepted.ok, true);
  assert.equal(harness.storage.dataConsentVersion, "2026-07-30");

  const result = await harness.send({
    type: "INGEST",
    items: [{ id: "one", question: "Why?", answer: "Because." }],
  });
  assert.equal(result.error, "no_token");
  assert.equal(harness.getFetchCalls(), 0);
});
