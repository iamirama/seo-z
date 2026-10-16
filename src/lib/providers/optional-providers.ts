// DataForSEO, SerpApi, and Majestic providers — three additional optional
// commercial providers declared in the spec (section 3.J).
// These are registered with full metadata and minimal but functional
// connection-test implementations, so the Settings UI can render them
// and the pre-scan gate can validate them when the user configures them.

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  ProviderConnectionState,
} from '@/lib/types';

// =====================================================
// DataForSEO
// =====================================================
class DataForSEOProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'dataforseo',
      name: 'DataForSEO API',
      description:
        'Provides SERP, keyword research, backlink, and competitor data. Paid per-task pricing model; free sandbox environment available for limited testing.',
      website: 'https://dataforseo.com/',
      apiDocs: 'https://docs.dataforseo.com/',
      pricingUrl: 'https://dataforseo.com/pricing',
      tier: 'paid',
      authMethod: 'api_key',
      capabilities: { keywords: true, backlinks: true },
      requiresCredentials: true,
      limitations:
        'Per-task pricing. Sandbox environment has separate endpoints and limited data — production requires funded account.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        { key: 'login', label: 'API Login (email)', type: 'text', required: true, placeholder: 'you@example.com' },
        { key: 'password', label: 'API Password', type: 'password', required: true, placeholder: '••••••••••' },
      ],
      authMethod: 'api_key',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { keywords: true, backlinks: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.login) missing.push('login');
    if (!credentials.password) missing.push('password');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const token = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');
    try {
      // Light endpoint: user account info
      const res = await fetch('https://api.dataforseo.com/v3/merchant/merchant_info/about', {
        headers: { Authorization: `Basic ${token}` },
      });
      if (res.status === 200) return { state: 'connected', message: 'DataForSEO credentials valid.' };
      if (res.status === 401) return { state: 'authentication_failed', message: 'DataForSEO credentials rejected (401).' };
      return { state: 'validation_inconclusive', message: `Unexpected ${res.status}.` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(_ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    return { data: null, error: 'DataForSEO data fetch not implemented in MVP — provider is configured for connectivity tests.' };
  }
}
export const dataForSeoProvider = new DataForSEOProvider();

// =====================================================
// SerpApi
// =====================================================
class SerpApiProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'serpapi',
      name: 'SerpApi',
      description:
        'Aggregates search engine result pages (Google, Bing, Baidu, etc.) for keyword research and rank tracking. Free tier offers 100 searches/month.',
      website: 'https://serpapi.com/',
      apiDocs: 'https://serpapi.com/search-api',
      pricingUrl: 'https://serpapi.com/pricing',
      tier: 'free_tier_limited',
      authMethod: 'api_key',
      capabilities: { keywords: true },
      requiresCredentials: true,
      limitations:
        'Free tier: 100 searches/month. Higher tiers paid. Returns SERP HTML/JSON, not raw search console data.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        { key: 'apiKey', label: 'SerpApi API Key', type: 'password', required: true, placeholder: '••••••••••' },
      ],
      authMethod: 'api_key',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { keywords: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.apiKey) missing.push('apiKey');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const apiKey = credentials.apiKey as string;
    try {
      const res = await fetch(`https://serpapi.com/account?api_key=${encodeURIComponent(apiKey)}`);
      if (res.status === 200) {
        const json = (await res.json()) as any;
        const remaining = json.total_searches_left ?? 'unknown';
        return { state: 'connected', message: `Connected — ${remaining} searches remaining.` };
      }
      if (res.status === 403) return { state: 'authentication_failed', message: 'SerpApi key rejected (403).' };
      return { state: 'validation_inconclusive', message: `SerpApi returned ${res.status}.` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(_ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    return { data: null, error: 'SerpApi SERP scraping requires additional keyword list input — not in MVP scope.' };
  }
}
export const serpApiProvider = new SerpApiProvider();

// =====================================================
// Majestic
// =====================================================
class MajesticProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'majestic',
      name: 'Majestic API',
      description:
        'Backlink index provider with Trust Flow, Citation Flow, and referring domain metrics. Commercial API; pricing requires Majestic subscription.',
      website: 'https://majestic.com/',
      apiDocs: 'https://majestic.com/support/api',
      pricingUrl: 'https://majestic.com/pricing',
      tier: 'paid',
      authMethod: 'api_key',
      capabilities: { backlinks: true },
      requiresCredentials: true,
      limitations:
        'Majestic API access is a paid add-on. Free Majestic account includes only browser-based tools, NOT API access.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        { key: 'apiKey', label: 'Majestic API Key', type: 'password', required: true, placeholder: '••••••••••' },
        { key: 'privateKey', label: 'Private Key (for OpenApps)', type: 'password', required: false },
      ],
      authMethod: 'api_key',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { backlinks: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.apiKey) missing.push('apiKey');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const apiKey = credentials.apiKey as string;
    // Majestic API uses XML responses and a Cmd=GetIndexItemInfo pattern
    try {
      const res = await fetch(`https://api.majestic.com/api/json?app_api_key=${encodeURIComponent(apiKey)}&cmd=GetIndexItemInfo&item0=example.com&items=1`);
      if (res.status === 200) {
        const json = (await res.json()) as any;
        if (json.Code === 0 || json.Code === '0') return { state: 'connected', message: 'Majestic credentials valid.' };
        return { state: 'authentication_failed', message: `Majestic returned error code ${json.Code}: ${json.ErrorMessage ?? 'unknown'}` };
      }
      return { state: 'validation_inconclusive', message: `Majestic returned ${res.status}.` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(_ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    return { data: null, error: 'Majestic backlink fetch not implemented in MVP — provider is configured for connectivity tests.' };
  }
}
export const majesticProvider = new MajesticProvider();
