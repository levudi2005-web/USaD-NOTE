import assert from "node:assert/strict";
import test from "node:test";
import {
  createShareToken,
  hashSharePassword,
  hashShareToken,
  isShareActive,
  verifySharePassword,
} from "../supabase/functions/_shared/share-security.js";

test("share tokens are unpredictable format values and only their hash is persisted", async () => {
  const first = createShareToken();
  const second = createShareToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
  const hash = await hashShareToken(first);
  assert.match(hash, /^[0-9a-f]{64}$/u);
  assert.notEqual(hash, first);
  await assert.rejects(() => hashShareToken("sequential-document-id"));
});

test("share passwords verify correctly and reject weak values", async () => {
  const encoded = await hashSharePassword("valid-password");

  assert.match(encoded, /^pbkdf2-sha256\$/u);
  assert.equal(await verifySharePassword("valid-password", encoded), true);
  assert.equal(await verifySharePassword("incorrect-password", encoded), false);
  assert.equal(await hashSharePassword(null), null);
  await assert.rejects(() => hashSharePassword("short"));
});

test("expired, revoked, and disabled shares are inactive", () => {
  const now = Date.now();
  const active = { enabled: true, revoked_at: null, expires_at: null };

  assert.equal(isShareActive(active, now), true);
  assert.equal(
    isShareActive(
      { ...active, expires_at: new Date(now - 1).toISOString() },
      now
    ),
    false
  );
  assert.equal(
    isShareActive({ ...active, revoked_at: new Date().toISOString() }, now),
    false
  );
  assert.equal(isShareActive({ ...active, enabled: false }, now), false);
});
