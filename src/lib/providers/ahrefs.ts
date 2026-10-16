// Ahrefs API provider.
// Commercial API. Requires a paid Ahrefs subscription and API token.
// Docs: https://docs.ahrefs.com/

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  BacklinkData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://api.ahrefs.com/v3';

class AhrefsProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'ahrefs',
      name: 'Ahrefs API',
      description:
        'Retrieves backlink data, referring domains, anchor text, and domain-level SEO metrics. Commercial API; pricing and credits depend on the Ahrefs subscription tier.',
      website: 'https://ahrefs.com/',
      apiDocs: 'https://docs.ahrefs.com/',
      pricingUrl: 'https://ahrefs.com/pricing',
      tier: 'paid',
      authMethod: 'bearer',
      capabilities: { backlinks: true, keywords: true },
      requiresCredentials: true,
      limitations:
        'Ahrefs API is commercial. Free trial accounts may have very limited credits. Without an active plan with API access, this provider stays disconnected.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'apiToken',
          label: 'Ahrefs API Token',
          type: 'password',
          required: true,
          placeholder: '••••••••••',
          helpText: 'Available under Ahrefs Dashboard → API → API tokens (requires Standard plan or above with API access).',
        },
      ],
      authMethod: 'bearer',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { backlinks: true, keywords: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.apiToken) missing.push('apiToken');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const token = credentials.apiToken as string;
    try {
      // Cheap test: account info endpoint
      const res = await fetch(`${API_BASE}/account-info`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        const json = (await res.json()) as any;
        const rows = json.usageData?.rowsLeft ?? 'unknown';
        return { state: 'connected', message: `Connected — ${rows} API rows remaining.` };
      }
      if (res.status === 401) return { state: 'authentication_failed', message: 'Ahrefs API token rejected (401).' };
      if (res.status === 402 || res.status === 403) {
        return { state: 'quota_exhausted', message: `Plan does not allow API access or credits exhausted (${res.status}).` };
      }
      return { state: 'validation_inconclusive', message: `Unexpected response ${res.status}.` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const token = ctx.credentials.apiToken as string;
    const backlinks: BacklinkData[] = [];
    try {
      // Fetch backlinks pointing to the target site
      const res = await fetch(
        `${API_BASE}/backlinks?target=${encodeURIComponent(ctx.targetUrl)}&mode=domain&limit=100&output=json`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        return { data: null, error: `Ahrefs backlinks endpoint returned ${res.status}` };
      }
      const json = (await res.json()) as any;
      const refs = json.backlinks ?? [];
      for (const r of refs.slice(0, 100)) {
        backlinks.push({
          referringDomain: r.referring_domain,
          referringUrl: r.url_from,
          anchorText: r.anchor,
          linkType: r.links_internal === 'true' ? 'internal' : r.nofollow ? 'nofollow' : 'dofollow',
          firstSeen: r.first_seen,
          lastVisited: r.last_visited,
          domainRating: r.domain_rating,
          urlRating: r.url_rating,
        });
      }
      if (backlinks.length === 0) {
        return { data: null, error: 'No backlinks returned from Ahrefs.' };
      }
      return {
        data: {
          providerKey: 'ahrefs',
          fetchedAt: new Date().toISOString(),
          backlinks,
          evidence: { source: 'ahrefs-v3', count: backlinks.length },
        },
      };
    } catch (err) {
      return { data: null, error: `Ahrefs fetch failed: ${(err as Error).message}` };
    }
  }
}

export const ahrefsProvider = new AhrefsProvider();
