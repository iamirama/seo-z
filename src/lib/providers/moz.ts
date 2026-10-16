// Moz API provider.
// Commercial API. Requires Moz API access (paid subscription).
// Docs: https://moz.com/products/api

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  BacklinkData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://api.moz.com/json/1';

class MozProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'moz',
      name: 'Moz API',
      description:
        'Retrieves domain authority, page authority, and backlink metrics. Moz API access is a paid add-on; the free Moz account does NOT include API access by default.',
      website: 'https://moz.com/',
      apiDocs: 'https://moz.com/products/api',
      pricingUrl: 'https://moz.com/products/api/pricing',
      tier: 'paid',
      authMethod: 'bearer',
      capabilities: { backlinks: true },
      requiresCredentials: true,
      limitations:
        'Moz API requires a paid plan. Free Moz community accounts do NOT include API access. Without an active Moz API plan, this provider stays disconnected.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'accessToken',
          label: 'Moz Access Token',
          type: 'password',
          required: true,
          placeholder: '••••••••••',
          helpText: 'Generate under Moz Dashboard → API → Manage tokens. Requires Moz Pro or Moz API subscription.',
        },
      ],
      authMethod: 'bearer',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { backlinks: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.accessToken) missing.push('accessToken');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const token = credentials.accessToken as string;
    try {
      const res = await fetch(`${API_BASE}/user/v1/account-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        const json = (await res.json()) as any;
        return { state: 'connected', message: `Connected — ${json.result?.rows ?? 'unknown'} rows remaining.` };
      }
      if (res.status === 401) return { state: 'authentication_failed', message: 'Moz access token rejected (401).' };
      if (res.status === 402 || res.status === 403) {
        return { state: 'quota_exhausted', message: `Moz API plan/credits insufficient (${res.status}).` };
      }
      return { state: 'validation_inconclusive', message: `Unexpected response ${res.status}.` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const token = ctx.credentials.accessToken as string;
    const backlinks: BacklinkData[] = [];
    let domain: string;
    try {
      domain = new URL(ctx.targetUrl).hostname;
    } catch {
      return { data: null, error: 'Could not extract domain from target URL' };
    }
    try {
      const res = await fetch(`${API_BASE}/links/v1/backlinks?target=${encodeURIComponent(`domain:${domain}`)}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        return { data: null, error: `Moz backlinks endpoint returned ${res.status}` };
      }
      const json = (await res.json()) as any;
      const rows = json.results ?? [];
      for (const r of rows.slice(0, 100)) {
        backlinks.push({
          referringDomain: r.sourceDomain,
          referringUrl: r.sourcePage,
          anchorText: r.anchorText,
          linkType: r.nofollow === true ? 'nofollow' : 'dofollow',
          domainRating: r.sourceDomainAuthority,
          urlRating: r.sourcePageAuthority,
        });
      }
      if (backlinks.length === 0) {
        return { data: null, error: 'No backlinks returned from Moz.' };
      }
      return {
        data: {
          providerKey: 'moz',
          fetchedAt: new Date().toISOString(),
          backlinks,
          evidence: { source: 'moz-v4', count: backlinks.length },
        },
      };
    } catch (err) {
      return { data: null, error: `Moz fetch failed: ${(err as Error).message}` };
    }
  }
}

export const mozProvider = new MozProvider();
