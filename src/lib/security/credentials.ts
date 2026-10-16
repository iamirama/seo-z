// Encrypted credential storage for provider configurations.
// Secrets are NEVER stored in plaintext. We use AES-256-GCM with a
// key sourced from the CREDENTIAL_ENCRYPTION_KEY environment variable.
//
// Storage flow:
//   1. User submits credentials via Settings UI (POST /api/providers/[name]).
//   2. Server validates input shape.
//   3. Server calls encryptCredentials() with the credentials object.
//   4. Encrypted ciphertext + IV + auth tag are persisted to ProviderConfig.
//   5. Original plaintext is dropped from memory.
//
// Retrieval flow:
//   1. Provider module calls decryptCredentials(providerKey).
//   2. Decryption happens server-side only.
//   3. Plaintext is used for one HTTP request then discarded.
//
// Security notes (per spec section 15):
//   - The encryption key NEVER leaves the server environment.
//   - Plaintext credentials are NEVER exposed to the frontend.
//   - API responses always mask credentials (e.g. "••••••••• last 4: ab12").
//   - The dev key in .env.example is a placeholder; production MUST set a
//     strong random key (32 bytes / 64 hex chars).

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length
const KEY_LENGTH = 32; // 256 bits

// ---------------------------------------------------------------------
// Resolve the encryption key from the environment. Falls back to a
// development-only key when missing. This fallback will be loud
// (logged) so production deployments can detect misconfiguration.
// ---------------------------------------------------------------------
function getEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    // Generate a deterministic dev key when none is set so the app
    // still runs locally. This is NOT for production use.
    console.warn('[security] CREDENTIAL_ENCRYPTION_KEY not set — using insecure dev key. Set a 64-char hex string in production.');
    return crypto.createHash('sha256').update('dev-only-key-do-not-use-in-production').digest();
  }
  // Accept either hex or base64 strings
  let buf: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    buf = Buffer.from(raw, 'hex');
  } else {
    buf = Buffer.from(raw, 'base64');
  }
  if (buf.length !== KEY_LENGTH) {
    throw new Error(`CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes; got ${buf.length}`);
  }
  return buf;
}

export interface EncryptedPayload {
  encryptedData: string; // base64 ciphertext
  iv: string;            // base64 IV
  authTag: string;       // base64 GCM auth tag
}

// ---------------------------------------------------------------------
// Encrypt an arbitrary JSON-serializable credentials object.
// ---------------------------------------------------------------------
export function encryptCredentials(creds: Record<string, unknown>): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(creds), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// ---------------------------------------------------------------------
// Decrypt a previously-encrypted credentials object.
// ---------------------------------------------------------------------
export function decryptCredentials(payload: EncryptedPayload): Record<string, unknown> {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const encrypted = Buffer.from(payload.encryptedData, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// ---------------------------------------------------------------------
// Mask a credential string for display in the UI.
// Returns something like "••••••••••ab12" — never the full value.
// ---------------------------------------------------------------------
export function maskCredential(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  const last4 = value.slice(-4);
  return '••••••••••' + last4;
}

// ---------------------------------------------------------------------
// Mask all sensitive fields in a credentials object for UI display.
// Keys named like "apiKey", "token", "secret", "password", "clientSecret"
// are masked; other fields (e.g. "clientId") are returned as-is so the
// user can identify which integration is configured.
// ---------------------------------------------------------------------
export function maskCredentialsForDisplay(creds: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    const lk = k.toLowerCase();
    if (lk.includes('secret') || lk.includes('password') || lk.includes('token') || lk.includes('apikey') || lk.includes('api_key')) {
      out[k] = maskCredential(typeof v === 'string' ? v : String(v ?? ''));
    } else if (typeof v === 'string') {
      // OAuth client IDs, scopes, etc. — partially mask
      out[k] = v.length > 30 ? v.slice(0, 8) + '••••' + v.slice(-4) : v;
    } else {
      out[k] = String(v ?? '');
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Generate a fresh, secure encryption key. Useful for first-time setup.
// ---------------------------------------------------------------------
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
