// Base provider interface. Every provider module implements this
// contract so the audit pipeline can treat them uniformly.
//
// Per spec section 14, the interface conceptually mirrors:
//   getProviderMetadata()
//   validateConfiguration()
//   testConnection()
//   getCapabilities()
//   checkQuota()
//   fetchSEOData()
//   normalizeError()
//
// We use real method names and structures that fit TypeScript.

import type {
  ProviderMetadata,
  ProviderCapabilities,
  ProviderQuotaInfo,
  NormalizedSEOData,
  ValidationResult,
  ProviderConnectionState,
  ScanConfig,
} from '@/lib/types';

// ---------------------------------------------------------------------
// Provider configuration shape. Each provider declares its expected
// credential fields so the Settings UI can render the right inputs.
// ---------------------------------------------------------------------
export interface ProviderConfigField {
  key: string;          // e.g. "apiKey"
  label: string;        // e.g. "API Key"
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  // For select type
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

// ---------------------------------------------------------------------
// Configuration shape returned by a provider for UI rendering.
// ---------------------------------------------------------------------
export interface ProviderConfigShape {
  fields: ProviderConfigField[];
  // Authentication method required (already in metadata but also here for convenience)
  authMethod: string;
  // Whether OAuth consent URL is needed (Google services)
  oauthMetadata?: {
    authorizeUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    redirectUri?: string;
  };
}

// ---------------------------------------------------------------------
// Context object passed to fetchSEOData(). Contains the scan target,
// user configuration, and any helper callbacks.
// ---------------------------------------------------------------------
export interface ProviderFetchContext {
  targetUrl: string;        // The website being audited
  config: ScanConfig;       // The full scan configuration
  // Resolved credentials (decrypted from ProviderConfig row)
  credentials: Record<string, unknown>;
  // Optional logger
  log?: (level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------
// Abstract provider base class. Subclasses MUST implement all
// abstract methods. Concrete providers live in lib/providers/*.ts.
// ---------------------------------------------------------------------
export abstract class BaseProvider {
  abstract getMetadata(): ProviderMetadata;
  abstract getConfigShape(): ProviderConfigShape;
  abstract getCapabilities(): ProviderCapabilities;

  // Validate that required credential fields are present and well-formed.
  // Returns { valid, missingFields[], invalidFields[] }.
  abstract validateConfiguration(credentials: Record<string, unknown>): {
    valid: boolean;
    missingFields: string[];
    invalidFields: Array<{ field: string; reason: string }>;
  };

  // Perform a real, lightweight connectivity test against the provider.
  // MUST NOT be a fake check (e.g. "is the API key field populated").
  // Returns the connection state + a human-readable message.
  abstract testConnection(credentials: Record<string, unknown>): Promise<{
    state: ProviderConnectionState;
    message: string;
    quotaInfo?: ProviderQuotaInfo | null;
  }>;

  // Fetch SEO data for the audit. Returns a NormalizedSEOData object.
  // If the provider cannot supply data, it returns null + a reason.
  abstract fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }>;

  // Normalize a provider-specific error into a stable shape. Used by
  // the audit pipeline to display consistent error messages.
  // Default implementation returns the raw error message.
  normalizeError(err: unknown): { state: ProviderConnectionState; message: string } {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      return { state: 'authentication_failed', message: 'Authentication failed — verify API key/token' };
    }
    if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
      return { state: 'permission_denied', message: 'Permission denied — account lacks required access' };
    }
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return { state: 'rate_limited', message: 'Rate limit exceeded — try again later' };
    }
    if (msg.toLowerCase().includes('quota')) {
      return { state: 'quota_exhausted', message: 'API quota exhausted — top up credits or wait for reset' };
    }
    if (msg.toLowerCase().includes('econnrefused') || msg.toLowerCase().includes('etimedout') || msg.toLowerCase().includes('enotfound')) {
      return { state: 'service_unavailable', message: 'Could not reach the provider service' };
    }
    return { state: 'validation_inconclusive', message: msg };
  }
}

// ---------------------------------------------------------------------
// Result returned by validateProvider() helper.
// ---------------------------------------------------------------------
export interface FullValidationResult extends ValidationResult {
  metadata: ProviderMetadata;
}

// ---------------------------------------------------------------------
// Helper: run a full validation flow for a provider.
// This is the entry point used by the pre-scan validation gate
// and the Settings "Test Connection" button.
// ---------------------------------------------------------------------
export async function validateProvider(
  provider: BaseProvider,
  credentials: Record<string, unknown> | null,
): Promise<FullValidationResult> {
  const metadata = provider.getMetadata();
  const now = new Date().toISOString();

  // If the provider requires no credentials (e.g. public robots.txt tool),
  // short-circuit to "connected".
  if (!metadata.requiresCredentials) {
    return {
      providerKey: metadata.key,
      state: 'connected',
      message: 'No credentials required for this provider.',
      hasCredentials: true,
      testedAt: now,
      suggestedAction: undefined,
    };
  }

  if (!credentials || Object.keys(credentials).length === 0) {
    return {
      providerKey: metadata.key,
      state: 'not_configured',
      message: 'No credentials configured. Enter API key/token in Settings.',
      hasCredentials: false,
      testedAt: null,
      suggestedAction: 'Open Settings and add the provider credentials.',
    };
  }

  // 1) Static validation: required fields present?
  const configValidation = provider.validateConfiguration(credentials);
  if (!configValidation.valid) {
    const missing = configValidation.missingFields.join(', ');
    const invalid = configValidation.invalidFields.map(f => `${f.field}: ${f.reason}`).join('; ');
    return {
      providerKey: metadata.key,
      state: 'not_configured',
      message: `Invalid configuration. Missing: ${missing || 'none'}. Invalid: ${invalid || 'none'}.`,
      hasCredentials: true,
      testedAt: now,
      suggestedAction: 'Correct the highlighted fields in Settings.',
    };
  }

  // 2) Live connection test.
  try {
    const test = await provider.testConnection(credentials);
    return {
      providerKey: metadata.key,
      state: test.state,
      message: test.message,
      hasCredentials: true,
      testedAt: now,
      quotaInfo: test.quotaInfo ?? undefined,
      suggestedAction: test.state === 'connected' ? undefined : 'See provider documentation link in Settings.',
    };
  } catch (err) {
    const normalized = provider.normalizeError(err);
    return {
      providerKey: metadata.key,
      state: normalized.state,
      message: normalized.message,
      hasCredentials: true,
      testedAt: now,
      suggestedAction: 'Retry validation; if the issue persists, check provider status.',
    };
  }
}
