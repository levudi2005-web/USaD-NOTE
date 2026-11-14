const encoder = new TextEncoder();
const passwordIterations = 310_000;

const encodeBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");

const decodeBase64Url = (value) => {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encodeHex = (bytes) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const secureEquals = (left, right) => {
  let mismatch = left.length ^ right.length;
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    mismatch |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return mismatch === 0;
};

export const createShareToken = () => {
  const token = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64Url(token);
};

export const hashShareToken = async (token) => {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) {
    throw new Error("Mã chia sẻ không hợp lệ.");
  }
  return encodeHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token)))
  );
};

export const hashSharePassword = async (password) => {
  if (password === null || password === "") return null;
  if (password.length < 8 || password.length > 256) {
    throw new Error("Mật khẩu chia sẻ phải dài từ 8 đến 256 ký tự.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: passwordIterations },
    key,
    256
  );
  return `pbkdf2-sha256$${passwordIterations}$${encodeBase64Url(salt)}$${encodeBase64Url(new Uint8Array(bits))}`;
};

export const verifySharePassword = async (password, encoded) => {
  if (!encoded) return true;
  const [algorithm, iterationsText, saltText, expectedText] =
    encoded.split("$");
  const iterations = Number(iterationsText);
  if (
    algorithm !== "pbkdf2-sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 1_000_000 ||
    !saltText ||
    !expectedText
  ) {
    throw new Error("Cấu hình mật khẩu chia sẻ không hợp lệ.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: decodeBase64Url(saltText),
        iterations,
      },
      key,
      256
    )
  );
  return secureEquals(actual, decodeBase64Url(expectedText));
};

export const isShareActive = (share, now = Date.now()) =>
  share.enabled &&
  !share.revoked_at &&
  (!share.expires_at || Date.parse(share.expires_at) > now);
