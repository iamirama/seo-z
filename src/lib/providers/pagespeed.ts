// Google PageSpeed Insights API provider.
// Free API with generous quota. Requires an API key from Google Cloud Console.
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started
// Pricing: free, but subject to standard Google API quotas.

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  PerformanceMetricData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

class PageSpeedProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'pagespeed',
      name: 'Google PageSpeed Insights',
      description:
        'Measures mobile and desktop performance, retrieves Lighthouse results, and analyzes Core Web Vitals when field data is available. Free API with quota; API key required.',
      website: 'https://pagespeed.web.dev/',
      apiDocs: 'https://developers.google.com/speed/docs/insights/v5/get-started',
      pricingUrl: 'https://developers.google.com/speed/docs/insights/v5/get-started',
      tier: 'free_tier_limited',
      authMethod: 'api_key',
      capabilities: {
        performance: true,
      },
      requiresCredentials: true,
      limitations:
        'Free quota (default 25,000 requests/day per project). Lab data is fetched on every request; field data is only returned when available for the queried URL.',
    };
  }

  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'apiKey',
          label: 'Google API Key',
          type: 'password',
          required: true,
          placeholder: 'AIza…',
          helpText:
            'Create a project at https://console.cloud.google.com/, enable "PageSpeed Insights API", then create an API key under Credentials.',
        },
      ],
      authMethod: 'api_key',
    };
  }

  getCapabilities(): ProviderCapabilities {
    return { performance: true };
  }

  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    const invalid: Array<{ field: string; reason: string }> = [];
    const apiKey = credentials.apiKey as string | undefined;
    if (!apiKey) {
      missing.push('apiKey');
    } else if (apiKey.length < 20) {
      invalid.push({ field: 'apiKey', reason: 'API key looks too short — should be ~39 chars' });
    }
    return { valid: missing.length === 0 && invalid.length === 0, missingFields: missing, invalidFields: invalid };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<{
    state: ProviderConnectionState;
    message: string;
    quotaInfo?: { used?: number; limit?: number; remaining?: number; resetsAt?: string } | null;
  }> {
    const apiKey = credentials.apiKey as string;
    // The cheapest test: query the PageSpeed API for a known-stable URL.
    // If the key is invalid we'll get a 400/403; if valid we'll get 200.
    const testUrl = 'https://www.example.com';
    const url = `${API_BASE}?url=${encodeURIComponent(testUrl)}&strategy=mobile&key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.status === 200) {
        return {
          state: 'connected',
          message: 'API key is valid; PageSpeed Insights is reachable.',
          quotaInfo: null,
        };
      }
      if (res.status === 403) {
        const body = await res.text();
        return {
          state: 'authentication_failed',
          message: `API key rejected by Google (403). ${body.slice(0, 200)}`,
        };
      }
      if (res.status === 429) {
        return { state: 'rate_limited', message: 'Rate limited (429). Try again later or reduce scan size.' };
      }
      const body = await res.text();
      return {
        state: 'validation_inconclusive',
        message: `Unexpected response ${res.status}. ${body.slice(0, 200)}`,
      };
    } catch (err) {
      return {
        state: 'service_unavailable',
        message: `Network error reaching PageSpeed API: ${(err as Error).message}`,
      };
    }
  }

  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const apiKey = ctx.credentials.apiKey as string;
    const strategies = ctx.config.performanceStrategies ?? ['mobile', 'desktop'];
    const metrics: PerformanceMetricData[] = [];

    for (const strategy of strategies) {
      const url = `${API_BASE}?url=${encodeURIComponent(ctx.targetUrl)}&strategy=${strategy}&key=${encodeURIComponent(apiKey)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          ctx.log?.('warn', `PageSpeed ${strategy} returned ${res.status}`, { target: ctx.targetUrl });
          continue;
        }
        const json = (await res.json()) as any;
        const metric = parseLighthouseResult(json, ctx.targetUrl, strategy);
        metrics.push(metric);
      } catch (err) {
        ctx.log?.('error', `PageSpeed ${strategy} failed`, { err: (err as Error).message });
      }
    }

    if (metrics.length === 0) {
      return { data: null, error: 'No performance metrics could be fetched from PageSpeed Insights.' };
    }

    return {
      data: {
        providerKey: 'pagespeed',
        fetchedAt: new Date().toISOString(),
        performance: metrics,
        evidence: { source: 'pagespeed-v5' },
      },
    };
  }
}

// ---------------------------------------------------------------------
// Parse a PageSpeed Insights v5 response into our normalized shape.
// The response has two parts:
//   - lighthouseResult: lab data (always present)
//   - loadingExperience: field data (only when Google has CrUX data for this URL)
// ---------------------------------------------------------------------
function parseLighthouseResult(json: any, targetUrl: string, strategy: 'mobile' | 'desktop'): PerformanceMetricData {
  const lh = json.lighthouseResult ?? {};
  const audits = lh.audits ?? {};
  const cats = lh.categories ?? {};
  const catScore = (id: string): number | undefined => {
    const c = cats[id];
    if (!c || typeof c.score !== 'number') return undefined;
    return Math.round(c.score * 100);
  };
  const auditValue = (id: string): number | undefined => {
    const a = audits[id];
    if (!a) return undefined;
    if (typeof a.numericValue === 'number') return a.numericValue;
    return undefined;
  };
  const fieldData = json.loadingExperience ?? undefined;
  const hasFieldData = !!fieldData && !!fieldData.metrics && Object.keys(fieldData.metrics).length > 0;

  // Extract field-data values when present
  let fieldLcp: number | undefined;
  let fieldCls: number | undefined;
  let fieldInp: number | undefined;
  let fieldFcp: number | undefined;
  if (hasFieldData && fieldData.metrics) {
    const m = fieldData.metrics;
    if (m.LARGEST_CONTENTFUL_PAINT) fieldLcp = m.LARGEST_CONTENTFUL_PAINT.percentile;
    if (m.CUMULATIVE_LAYOUT_SHIFT_SCORE) fieldCls = m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile;
    if (m.INTERACTION_TO_NEXT_PAINT) fieldInp = m.INTERACTION_TO_NEXT_PAINT.percentile;
    if (m.FIRST_CONTENTFUL_PAINT) fieldFcp = m.FIRST_CONTENTFUL_PAINT.percentile;
  }

  // Opportunities: render-blocking, unused JS/CSS, image optimization
  const opportunities: PerformanceMetricData['opportunities'] = [];
  for (const audit of Object.values<any>(audits)) {
    if (audit.details && audit.details.type === 'opportunity' && audit.details.overallSavingsMs) {
      opportunities.push({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        savingsMs: audit.details.overallSavingsMs,
        displayValue: audit.displayValue,
      });
    }
  }

  // Diagnostics: notable issues that don't have savingsMs
  const diagnostics: PerformanceMetricData['diagnostics'] = [];
  for (const audit of Object.values<any>(audits)) {
    if (audit.details && audit.details.type === 'diagnostic' && audit.score && audit.score < 1) {
      diagnostics.push({
        id: audit.id,
        title: audit.title,
        description: audit.description,
        value: audit.displayValue,
      });
    }
  }

  return {
    url: targetUrl,
    strategy,
    lcp: fieldLcp ?? auditValue('largest-contentful-paint'),
    inp: fieldInp ?? auditValue('interaction-to-next-paint'),
    cls: fieldCls ?? auditValue('cumulative-layout-shift'),
    fcp: fieldFcp ?? auditValue('first-contentful-paint'),
    tbt: auditValue('total-blocking-time'),
    speedIndex: auditValue('speed-index'),
    performanceScore: catScore('performance'),
    accessibilityScore: catScore('accessibility'),
    bestPracticesScore: catScore('best-practices'),
    seoScore: catScore('seo'),
    hasFieldData,
    opportunities: opportunities.slice(0, 50), // cap for storage
    diagnostics: diagnostics.slice(0, 50),
  };
}

export const pagespeedProvider = new PageSpeedProvider();
