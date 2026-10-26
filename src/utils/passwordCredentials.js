const ITERATIONS = 100000;

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value) {
  return Uint8Array.from(value.match(/.{2}/g) || [], (byte) => Number.parseInt(byte, 16));
}

export async function createPasswordCredential(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("A proteção de senha não está disponível neste navegador.");
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );

  return { salt: toHex(salt), hash: toHex(new Uint8Array(bits)) };
}

export async function verifyPasswordCredential(password, credential) {
  if (!credential?.salt || !credential?.hash || !globalThis.crypto?.subtle) return false;

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: fromHex(credential.salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const calculatedHash = toHex(new Uint8Array(bits));
  if (calculatedHash.length !== credential.hash.length) return false;

  let difference = 0;
  for (let index = 0; index < calculatedHash.length; index += 1) {
    difference |= calculatedHash.charCodeAt(index) ^ credential.hash.charCodeAt(index);
  }
  return difference === 0;
}
