const PBKDF2_ITERATIONS = 600_000;
const VAULT_FORMAT_VERSION = 1;

export interface PayrollVaultKeys {
  encryptionKey: CryptoKey;
  lookupKey: CryptoKey;
}

export interface VaultCiphertext {
  iv: string;
  ciphertext: string;
}

function requireWebCrypto(): Crypto {
  if (
    typeof globalThis.crypto === 'undefined' ||
    !globalThis.crypto.subtle ||
    typeof globalThis.crypto.getRandomValues !== 'function'
  ) {
    throw new Error(
      'رمزنگاری امن در این محیط در دسترس نیست. نرم‌افزار را در بستر HTTPS یا localhost اجرا کنید.'
    );
  }
  return globalThis.crypto;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

export function createVaultSalt(): Uint8Array {
  return requireWebCrypto().getRandomValues(new Uint8Array(16));
}

export async function derivePayrollVaultKeys(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS
): Promise<PayrollVaultKeys> {
  if (passphrase.length < 12) {
    throw new Error('عبارت عبور باید حداقل ۱۲ نویسه داشته باشد.');
  }
  if (!Number.isInteger(iterations) || iterations < 600_000 || iterations > 2_000_000) {
    throw new Error('پارامتر مشتق‌سازی کلید معتبر نیست.');
  }

  const webCrypto = requireWebCrypto();
  const passwordMaterial = await webCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derived = new Uint8Array(
    await webCrypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: asArrayBuffer(salt),
        iterations,
        hash: 'SHA-256',
      },
      passwordMaterial,
      512
    )
  );

  const encryptionBytes = derived.slice(0, 32);
  const lookupBytes = derived.slice(32, 64);
  derived.fill(0);

  try {
    const [encryptionKey, lookupKey] = await Promise.all([
      webCrypto.subtle.importKey(
        'raw',
        encryptionBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      ),
      webCrypto.subtle.importKey(
        'raw',
        lookupBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      ),
    ]);

    return { encryptionKey, lookupKey };
  } finally {
    encryptionBytes.fill(0);
    lookupBytes.fill(0);
  }
}

export async function encryptVaultPayload<T>(
  keys: PayrollVaultKeys,
  recordId: string,
  value: T
): Promise<VaultCiphertext> {
  const webCrypto = requireWebCrypto();
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await webCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(iv),
      additionalData: new TextEncoder().encode(recordId),
      tagLength: 128,
    },
    keys.encryptionKey,
    plaintext
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVaultPayload<T>(
  keys: PayrollVaultKeys,
  recordId: string,
  encrypted: VaultCiphertext
): Promise<T> {
  const webCrypto = requireWebCrypto();
  const plaintext = await webCrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: asArrayBuffer(fromBase64(encrypted.iv)),
      additionalData: new TextEncoder().encode(recordId),
      tagLength: 128,
    },
    keys.encryptionKey,
    asArrayBuffer(fromBase64(encrypted.ciphertext))
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

async function hmacToken(keys: PayrollVaultKeys, value: string): Promise<string> {
  const signature = await requireWebCrypto().subtle.sign(
    'HMAC',
    keys.lookupKey,
    new TextEncoder().encode(value)
  );
  return toBase64(new Uint8Array(signature))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function createOpaqueRecordId(
  keys: PayrollVaultKeys,
  kind: 'employee' | 'employeeMaster' | 'payrollRun',
  identifier: string
): Promise<string> {
  return hmacToken(keys, 'record:' + kind + ':' + identifier).then(
    (token) => kind + ':' + token
  );
}

export function createPersonnelCodeToken(
  keys: PayrollVaultKeys,
  personnelCode: string
): Promise<string> {
  return hmacToken(keys, 'personnel-code:' + personnelCode.trim());
}

export function getVaultFormatVersion(): number {
  return VAULT_FORMAT_VERSION;
}

export function getVaultKdfIterations(): number {
  return PBKDF2_ITERATIONS;
}
