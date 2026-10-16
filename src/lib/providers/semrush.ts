// Semrush API provider.
// Commercial API. Requires a paid Semrush subscription with API access.
// Docs: https://developer.semrush.com/

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  KeywordData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://api.semrush.com';

class SemrushProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'semrush',
      name: 'Semrush API',
      description:
        'Retrieves domain and keyword analytics, organic search metrics, and competitor data. Commercial API; availability depends on the Semrush plan.',
      website: 'https://www.semrush.com/',
      apiDocs: 'https://developer.semrush.com/',
      pricingUrl: 'https://www.semrush.com/pricing/',
      tier: 'paid',
      authMethod: 'api_key',
      capabilities: { backlinks: true, keywords: true },
      requiresCredentials: true,
      limitations:
        'Semrush API access is a paid add-on and is NOT included in the free trial by default. Configure only if your account has API units available.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'apiKey',
          label: 'Semrush API Key',
          type: 'password',
          required: true,
          placeholder: '••••••••••',
          helpText: 'Generate under Semrush Dashboard → Profile → API units.',
        },
        {
          key: 'database',
          label: 'Database (country)',
          type: 'select',
          required: false,
          defaultValue: 'us',
          options: [
            { value: 'us', label: 'United States' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'ca', label: 'Canada' },
            { value: 'au', label: 'Australia' },
            { value: 'de', label: 'Germany' },
            { value: 'fr', label: 'France' },
            { value: 'es', label: 'Spain' },
            { value: 'it', label: 'Italy' },
            { value: 'br', label: 'Brazil' },
            { value: 'global', label: 'Global' },
          ],
        },
      ],
      authMethod: 'api_key',
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { backlinks: true, keywords: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.apiKey) missing.push('apiKey');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const apiKey = credentials.apiKey as string;
    // Cheap test: ping the user info endpoint
    try {
      const res = await fetch(`${API_BASE}/users/v1/account-info?key=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const json = (await res.json()) as any;
        const units = json.data?.api?.units ?? 'unknown';
        return { state: 'connected', message: `Connected — ${units} API units available.` };
      }
      if (res.status === 403) {
        return { state: 'permission_denied', message: 'Semrush API access denied (403) — check plan & units.' };
      }
      if (res.status === 401) {
        return { state: 'authentication_failed', message: 'Semrush API key rejected (401).' };
      }
      // Older Semrush endpoints return 200 with text errors; check body
      const body = await res.text();
      if (body.includes('insufficient')) {
        return { state: 'quota_exhausted', message: 'Semrush API units exhausted.' };
      }
      return { state: 'validation_inconclusive', message: `Semrush returned ${res.status}: ${body.slice(0, 200)}` };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const apiKey = ctx.credentials.apiKey as string;
    const database = (ctx.credentials.database as string) || 'us';
    const keywords: KeywordData[] = [];
    // Extract domain from targetUrl
    let domain: string;
    try {
      domain = new URL(ctx.targetUrl).hostname;
    } catch {
      return { data: null, error: 'Could not extract domain from target URL' };
    }
    try {
      // domain_organic_organic: top organic keywords for a domain
      const res = await fetch(
        `${API_BASE}/analytics/v1/?key=${encodeURIComponent(apiKey)}&type=domain_organic_organic&database=${encodeURIComponent(database)}&domain=${encodeURIComponent(domain)}&display_limit=100`,
      );
      const text = await res.text();
      if (!res.ok) {
        return { data: null, error: `Semrush returned ${res.status}: ${text.slice(0, 200)}` };
      }
      // Semrush returns CSV-ish / JSON depending on endpoint; we'll attempt JSON first
      try {
        const json = JSON.parse(text);
        const rows = json.data?.table?.rows ?? [];
        for (const r of rows.slice(0, 100)) {
          keywords.push({
            query: r.Kw ?? r.kw ?? 'unknown',
            impressions: 0,
            clicks: 0,
            ctr: 0,
            position: r.Po ?? r.po ?? 0,
            country: database,
          });
        }
      } catch {
        // Not JSON — try parsing as CSV with first row as header
        const lines = text.split('\n').filter(Boolean);
        if (lines.length > 1) {
          // first line is header
          for (const line of lines.slice(1, 101)) {
            const cols = line.split(';').map(c => c.replace(/^"|"$/g, ''));
            keywords.push({
              query: cols[0] ?? 'unknown',
              impressions: 0,
              clicks: 0,
              ctr: 0,
              position: parseFloat(cols[2] ?? '0') || 0,
              country: database,
            });
          }
        }
      }
      if (keywords.length === 0) {
        return { data: null, error: 'No keywords returned from Semrush.' };
      }
      return {
        data: {
          providerKey: 'semrush',
          fetchedAt: new Date().toISOString(),
          keywords,
          evidence: { source: 'semrush-v1', count: keywords.length, database },
        },
      };
    } catch (err) {
      return { data: null, error: `Semrush fetch failed: ${(err as Error).message}` };
    }
  }
}

export const semrushProvider = new SemrushProvider();
