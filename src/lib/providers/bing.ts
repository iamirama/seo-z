// Bing Webmaster Tools API provider.
// Requires an API key from Bing Webmaster Tools. The user must have
// a verified site in their Bing Webmaster Tools account.
// Docs: https://learn.microsoft.com/en-us/bingwebmaster/

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  KeywordData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

class BingWebmasterProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'bing',
      name: 'Bing Webmaster Tools',
      description:
        'Retrieves supported search performance data, queries, and pages from Bing. The user must have a verified site in Bing Webmaster Tools. Free API key required.',
      website: 'https://www.bing.com/webmasters/',
      apiDocs: 'https://learn.microsoft.com/en-us/bingwebmaster/',
      pricingUrl: 'https://www.bing.com/webmasters/',
      tier: 'free_tier_limited',
      authMethod: 'api_key',
      capabilities: { keywords: true },
      requiresCredentials: true,
      limitations:
        'Only returns data for sites the user has verified in Bing Webmaster Tools. Coverage depends on Bing search traffic.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'apiKey',
          label: 'Bing Webmaster API Key',
          type: 'password',
          required: true,
          placeholder: 'Bing…',
          helpText: 'Sign in to Bing Webmaster Tools → Settings → API access → Generate API key.',
        },
        {
          key: 'siteUrl',
          label: 'Verified site URL',
          type: 'url',
          required: true,
          placeholder: 'https://example.com/',
        },
      ],
      authMethod: 'api_key',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { keywords: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    const invalid: Array<{ field: string; reason: string }> = [];
    if (!credentials.apiKey) missing.push('apiKey');
    if (!credentials.siteUrl) missing.push('siteUrl');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: invalid };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const apiKey = credentials.apiKey as string;
    // Cheap test: list sites
    try {
      const res = await fetch(`${API_BASE}/GetUserSites?apikey=${encodeURIComponent(apiKey)}`);
      const json = (await res.json()) as any;
      if (json.ErrorCode === 0) {
        const sites = json.d?.SiteList ?? [];
        return { state: sites.length ? 'connected' : 'connected_with_limitations', message: `Connected — ${sites.length} sites available.` };
      }
      return { state: 'authentication_failed', message: `Bing API error: ${json.ErrorMessage ?? 'unknown'}` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const apiKey = ctx.credentials.apiKey as string;
    const siteUrl = (ctx.credentials.siteUrl as string) || ctx.targetUrl;
    const keywords: KeywordData[] = [];
    try {
      // Query keywords for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 29);
      const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
      const res = await fetch(
        `${API_BASE}/GetQueryStats?siteUrl=${encodeURIComponent(siteUrl)}&startDate=${fmt(startDate)}&endDate=${fmt(endDate)}&apikey=${encodeURIComponent(apiKey)}`,
      );
      const json = (await res.json()) as any;
      if (json.ErrorCode === 0) {
        const rows = json.d ?? [];
        for (const r of rows.slice(0, 500)) {
          keywords.push({
            query: r.Query,
            impressions: r.Impressions ?? 0,
            clicks: r.Clicks ?? 0,
            ctr: r.CTR ?? 0,
            position: r.AvgPosition ?? 0,
            dateRange: `${fmt(startDate)} to ${fmt(endDate)}`,
            country: 'global',
          });
        }
      }
      if (keywords.length === 0) {
        return { data: null, error: 'No keyword data available from Bing Webmaster Tools.' };
      }
      return {
        data: {
          providerKey: 'bing',
          fetchedAt: new Date().toISOString(),
          keywords,
          evidence: { source: 'bing-webmaster-v2' },
        },
      };
    } catch (err) {
      return { data: null, error: `Bing fetch failed: ${(err as Error).message}` };
    }
  }
}

export const bingProvider = new BingWebmasterProvider();
