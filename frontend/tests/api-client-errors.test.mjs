import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { api } from "../src/js/modules/note/api.js";

const originalFetch = globalThis.fetch;
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = originalLocalStorage;
  }
});

test("reports a useful message when the Vite proxy returns HTTP 502", async () => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        detail:
          "Không kết nối được tới FastAPI. Hãy kiểm tra backend và VITE_API_PROXY_TARGET.",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );

  await assert.rejects(api.sync.bootstrap(), (error) => {
    assert.equal(error.status, 502);
    assert.match(error.message, /FastAPI/);
    return true;
  });
});

test("reports a useful message when the backend cannot be reached", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  await assert.rejects(api.sync.bootstrap(), /Không kết nối được tới API/);
});

test("reports a timeout instead of a generic network failure", async () => {
  globalThis.fetch = async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  };

  await assert.rejects(api.sync.bootstrap(), /thời gian chờ/);
});
