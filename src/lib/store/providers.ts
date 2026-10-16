// Provider configuration storage layer.
//
// Server-side CRUD for provider credentials. Secrets are encrypted
// before persistence; plaintext is never returned to the frontend.
//
// Functions here are only safe to call from server code (API routes
// or 'use server' actions). They MUST NOT be imported into client
// components.

import { db } from '@/lib/db';
import { encryptCredentials, decryptCredentials, maskCredentialsForDisplay } from '@/lib/security/credentials';
import { getProvider } from '@/lib/providers/registry';
import { validateProvider } from '@/lib/providers/base';
import type { ValidationResult } from '@/lib/types';

// ---------------------------------------------------------------------
// Save (or update) provider credentials. Encrypts then persists.
// ---------------------------------------------------------------------
export async function saveProviderConfig(providerKey: string, credentials: Record<string, unknown>): Promise<void> {
  const provider = getProvider(providerKey);
  if (!provider) throw new Error(`Unknown provider: ${providerKey}`);

  const { encryptedData, iv, authTag } = encryptCredentials(credentials);

  const existing = await db.providerConfig.findUnique({ where: { providerKey } });
  if (existing) {
    await db.providerConfig.update({
      where: { providerKey },
      data: {
        encryptedData,
        iv,
        authTag,
        displayName: provider.getMetadata().name,
        authMethod: provider.getMetadata().authMethod,
        enabled: true,
        updatedAt: new Date(),
      },
    });
  } else {
    await db.providerConfig.create({
      data: {
        providerKey,
        encryptedData,
        iv,
        authTag,
        displayName: provider.getMetadata().name,
        authMethod: provider.getMetadata().authMethod,
        enabled: true,
      },
    });
  }
}

// ---------------------------------------------------------------------
// Delete stored credentials (Disconnect).
// ---------------------------------------------------------------------
export async function deleteProviderConfig(providerKey: string): Promise<void> {
  await db.providerConfig.deleteMany({ where: { providerKey } });
}

// ---------------------------------------------------------------------
// Decrypt credentials for a provider. Returns null when not configured.
// ---------------------------------------------------------------------
export async function getDecryptedCredentials(providerKey: string): Promise<Record<string, unknown> | null> {
  const row = await db.providerConfig.findUnique({ where: { providerKey } });
  if (!row) return null;
  try {
    return decryptCredentials({
      encryptedData: row.encryptedData,
      iv: row.iv,
      authTag: row.authTag,
    });
  } catch (err) {
    console.error(`[credentials] Failed to decrypt ${providerKey}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Return masked credentials for display in the UI.
// Never exposes the underlying plaintext secrets.
// ---------------------------------------------------------------------
export async function getMaskedCredentials(providerKey: string): Promise<Record<string, string> | null> {
  const creds = await getDecryptedCredentials(providerKey);
  if (!creds) return null;
  return maskCredentialsForDisplay(creds);
}

// ---------------------------------------------------------------------
// Persist a connection-test result on the provider config row.
// ---------------------------------------------------------------------
export async function saveProviderTestResult(providerKey: string, result: ValidationResult): Promise<void> {
  const data = {
    lastTestResult: JSON.stringify(result),
    lastTestedAt: result.testedAt ? new Date(result.testedAt) : new Date(),
    lastSuccessAt: result.state === 'connected' || result.state === 'connected_with_limitations' ? new Date() : undefined,
    quotaInfo: result.quotaInfo ? JSON.stringify(result.quotaInfo) : null,
    updatedAt: new Date(),
  };
  if (data.lastSuccessAt === undefined) delete (data as any).lastSuccessAt;
  await db.providerConfig.updateMany({
    where: { providerKey },
    data,
  });
}

// ---------------------------------------------------------------------
// Run the live validation flow for a provider. Reads encrypted creds
// from DB, decrypts, runs the provider's validateProvider() helper,
// persists the result, and returns the result to the caller.
// ---------------------------------------------------------------------
export async function validateProviderByKey(providerKey: string): Promise<ValidationResult> {
  const provider = getProvider(providerKey);
  if (!provider) {
    return {
      providerKey,
      state: 'not_configured',
      message: `Unknown provider: ${providerKey}`,
      hasCredentials: false,
      testedAt: null,
    };
  }
  const creds = await getDecryptedCredentials(providerKey);
  const result = await validateProvider(provider, creds);
  await saveProviderTestResult(providerKey, result);
  return result;
}

// ---------------------------------------------------------------------
// Bulk-validate a list of providers. Used by the pre-scan gate.
// ---------------------------------------------------------------------
export async function validateProviders(providerKeys: string[]): Promise<ValidationResult[]> {
  return Promise.all(providerKeys.map((k) => validateProviderByKey(k)));
}
