import crypto from "crypto";

const SALT_CHARS =
  "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const BCRYPT_ALPHABET =
  "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const STANDARD_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith("$2")) {
    return verifyBcryptLike(password, hash);
  }
  // PBKDF2-SHA256 placeholder hashes for tests
  if (hash.startsWith("pbkdf2:")) {
    const [iterStr, saltHex, storedHex] = hash.slice(7).split(":");
    const iterations = Number(iterStr);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const salt = Buffer.from(saltHex, "hex");
    const keyLen = Buffer.from(storedHex, "hex").length;
    const derived = crypto.pbkdf2Sync(password, salt, iterations, keyLen, "sha256");
    const encoded = derived.toString("hex");
    return storedHex === encoded;
  }
  return false;
}

function verifyBcryptLike(password: string, hash: string): boolean {
  if (!hash.startsWith("$2b$10$")) {
    return false;
  }
  const body = hash.slice("$2b$10$".length);
  if (body.length < 22) {
    return false;
  }
  const salt = body.slice(0, 22);
  const stored = body.slice(22);

  let derived: Buffer;
  try {
    derived = crypto.scryptSync(password, salt, 24, {
      N: 1024,
      r: 1,
      p: 1,
    });
  } catch {
    return false;
  }

  const encoded = bcryptBase64Encode(derived).slice(0, stored.length);

  if (stored.length !== encoded.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(encoded));
  } catch {
    return false;
  }
}

export function hashPassword(password: string): string {
  let salt = "";
  for (let i = 0; i < 22; i++) {
    salt += SALT_CHARS[Math.floor(Math.random() * SALT_CHARS.length)];
  }
  const derived = crypto.scryptSync(password, salt, 24, { N: 1024, r: 1, p: 1 });
  const encoded = bcryptBase64Encode(derived);
  return `$2b$10$${salt}${encoded.slice(0, 31)}`;
}

function bcryptBase64Encode(input: Buffer): string {
  const standard = input.toString("base64");
  let out = "";
  for (const ch of standard) {
    const idx = STANDARD_ALPHABET.indexOf(ch);
    if (idx >= 0) {
      out += BCRYPT_ALPHABET[idx];
    } else if (ch === "=") {
      out += "";
    } else {
      out += ch;
    }
  }
  return out;
}
