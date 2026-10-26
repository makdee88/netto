const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// Ensure an isolated, clean ArrayBuffer copy (critical for sql.js WASM export buffers)
function toCleanBuffer(source: Uint8Array): ArrayBuffer {
  const clean = new Uint8Array(source.length);
  clean.set(source);
  return clean.buffer;
}

export async function encryptSqliteBytes(
  plainBytes: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(passphrase);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    toCleanBuffer(passwordBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toCleanBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toCleanBuffer(iv) },
    key,
    toCleanBuffer(plainBytes)
  );

  const cipherBytes = new Uint8Array(ciphertext);
  const fullPayload = new Uint8Array(SALT_BYTES + IV_BYTES + cipherBytes.byteLength);
  fullPayload.set(salt, 0);
  fullPayload.set(iv, SALT_BYTES);
  fullPayload.set(cipherBytes, SALT_BYTES + IV_BYTES);

  return fullPayload;
}

export async function decryptSqliteBytes(
  encryptedBytes: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  if (encryptedBytes.byteLength < SALT_BYTES + IV_BYTES) {
    throw new Error('Corrupted or invalid encrypted payload');
  }

  // Extract explicit isolated slices
  const salt = new Uint8Array(encryptedBytes.buffer, encryptedBytes.byteOffset, SALT_BYTES);
  const iv = new Uint8Array(encryptedBytes.buffer, encryptedBytes.byteOffset + SALT_BYTES, IV_BYTES);
  const cipherBytes = new Uint8Array(
    encryptedBytes.buffer,
    encryptedBytes.byteOffset + SALT_BYTES + IV_BYTES,
    encryptedBytes.byteLength - (SALT_BYTES + IV_BYTES)
  );

  const enc = new TextEncoder();
  const passwordBytes = enc.encode(passphrase);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    toCleanBuffer(passwordBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toCleanBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toCleanBuffer(iv) },
      key,
      toCleanBuffer(cipherBytes)
    );
    return new Uint8Array(plainBuffer);
  } catch (err) {
    console.error('Decryption authentication failed:', err);
    throw new Error('Incorrect passphrase or corrupted encrypted database');
  }
}

export function downloadEncryptedBlob(bytes: Uint8Array, vaultName: string) {
  const blob = new Blob([toCleanBuffer(bytes)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `netto_vault_${vaultName}_${new Date().toISOString().slice(0, 10)}.sqlite.enc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}