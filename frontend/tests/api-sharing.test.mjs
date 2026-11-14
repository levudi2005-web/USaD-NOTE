import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
const unauthorizedEvents = [];
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {
  dispatchEvent: (event) => unauthorizedEvents.push(event.type),
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};

const { default: api } = await import("../src/js/modules/note/api.js");

test("public share password failures preserve the signed-in session", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    storage.clear();
    unauthorizedEvents.length = 0;
  });
  storage.set("note_auth_token", "signed-in-token");

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "Mật khẩu không chính xác" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    api.sharing.accessPublic("a".repeat(43), "incorrect"),
    (error) => error.passwordRequired === true && error.status === 401
  );
  assert.equal(storage.get("note_auth_token"), "signed-in-token");
  assert.deepEqual(unauthorizedEvents, []);

  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    return new Response("document bytes", {
      headers: { "content-type": "application/octet-stream" },
    });
  };
  const downloaded = await api.sharing.downloadPublic(
    "a".repeat(43),
    "correct"
  );
  assert.equal(await downloaded.text(), "document bytes");
});
