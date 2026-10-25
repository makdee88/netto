const MAGIC_HEADER = new TextEncoder().encode('NETTOV02'); // 8 bytes header

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSqliteBytes(rawSqlite: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, rawSqlite);
  const ciphertext = new Uint8Array(encryptedBuf);

  // Format: [8B MAGIC][16B SALT][12B IV][CIPHERTEXT]
  const packed = new Uint8Array(8 + 16 + 12 + ciphertext.byteLength);
  packed.set(MAGIC_HEADER, 0);
  packed.set(salt, 8);
  packed.set(iv, 24);
  packed.set(ciphertext, 36);
  return packed;
}

export async function decryptSqliteBytes(packed: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const header = new TextDecoder().decode(packed.slice(0, 8));
  if (header !== 'NETTOV02') {
    throw new Error('Invalid or unencrypted Netto vault file.');
  }
  const salt = packed.slice(8, 24);
  const iv = packed.slice(24, 36);
  const ciphertext = packed.slice(36);

  const key = await deriveKey(passphrase, salt);
  try {
    const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new Uint8Array(decryptedBuf);
  } catch {
    throw new Error('Incorrect Master Passphrase! Decryption failed.');
  }
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToUint8(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
