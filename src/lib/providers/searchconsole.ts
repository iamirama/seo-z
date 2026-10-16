// Google Search Console API provider.
// Requires OAuth 2.0 — user must authorize a Google property they own.
// Docs: https://developers.google.com/webmaster-tools/v1/api_reference_index
//
// This provider is configured-but-not-connected by default. It only
// becomes "connected" after the OAuth flow is completed and the user
// has at least one verified property.

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  KeywordData,
  ProviderConnectionState,
} from '@/lib/types';

const API_BASE = 'https://www.googleapis.com/webmasters/v3';
const TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

class SearchConsoleProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'searchconsole',
      name: 'Google Search Console',
      description:
        'Retrieves search impressions, clicks, CTR, and average position for verified properties. Requires OAuth 2.0 — the user must authorize a property they own.',
      website: 'https://search.google.com/search-console/',
      apiDocs: 'https://developers.google.com/webmaster-tools/v1/api_reference_index',
      pricingUrl: 'https://developers.google.com/webmaster-tools/v1/api_reference_index',
      tier: 'oauth_required',
      authMethod: 'oauth2',
      capabilities: {
        keywords: true,
        technical: true, // indexing status, sitemaps
      },
      requiresCredentials: true,
      limitations:
        'Only available for properties the user has verified in Search Console. OAuth flow must be completed manually. Data is delayed by ~2 days.',
    };
  }

  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        {
          key: 'clientId',
          label: 'OAuth Client ID',
          type: 'text',
          required: true,
          placeholder: 'xxxx.apps.googleusercontent.com',
          helpText: 'Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console. Add the redirect URI shown below to the authorized redirect URIs.',
        },
        {
          key: 'clientSecret',
          label: 'OAuth Client Secret',
          type: 'password',
          required: true,
          placeholder: 'GOCSPX-…',
        },
        {
          key: 'refreshToken',
          label: 'Refresh Token',
          type: 'password',
          required: false,
          placeholder: '1//…',
          helpText: 'Obtained after completing OAuth consent flow. Leave empty if you have not yet authorized.',
        },
        {
          key: 'siteUrl',
          label: 'Site URL (verified property)',
          type: 'url',
          required: false,
          placeholder: 'sc-domain:example.com or https://example.com/',
        },
      ],
      authMethod: 'oauth2',
      oauthMetadata: {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        redirectUri: '/api/providers/searchconsole/oauth/callback',
      },
    };
  }

  getCapabilities(): ProviderCapabilities {
    return { keywords: true, technical: true };
  }

  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    const invalid: Array<{ field: string; reason: string }> = [];
    const clientId = credentials.clientId as string | undefined;
    const clientSecret = credentials.clientSecret as string | undefined;
    if (!clientId) missing.push('clientId');
    else if (!clientId.includes('.apps.googleusercontent.com')) invalid.push({ field: 'clientId', reason: 'Does not look like a Google OAuth Client ID' });
    if (!clientSecret) missing.push('clientSecret');
    // refreshToken may be empty if user has not completed OAuth yet
    return { valid: missing.length === 0 && invalid.length === 0, missingFields: missing, invalidFields: invalid };
  }

  async testConnection(credentials: Record<string, unknown>): Promise<{
    state: ProviderConnectionState;
    message: string;
    quotaInfo?: null;
  }> {
    const clientId = credentials.clientId as string;
    const clientSecret = credentials.clientSecret as string;
    const refreshToken = credentials.refreshToken as string | undefined;

    if (!refreshToken) {
      return {
        state: 'not_configured',
        message: 'OAuth flow not completed. Click "Authorize" to consent.',
      };
    }

    // Exchange refresh token for an access token, then verify scope.
    try {
      const tokenRes = await fetch(TOKEN_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (tokenRes.status === 401 || tokenRes.status === 400) {
        return { state: 'authentication_failed', message: 'OAuth refresh failed — verify client ID/secret and refresh token' };
      }
      if (!tokenRes.ok) {
        return { state: 'service_unavailable', message: `Google OAuth endpoint returned ${tokenRes.status}` };
      }
      const tokens = (await tokenRes.json()) as any;
      const accessToken = tokens.access_token;

      // List sites to confirm Search Console API access.
      const sitesRes = await fetch(`${API_BASE}/sites`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (sitesRes.status === 403) {
        return { state: 'permission_denied', message: 'Token lacks Search Console scope — re-authorize with webmasters.readonly' };
      }
      if (!sitesRes.ok) {
        return { state: 'service_unavailable', message: `Search Console sites endpoint returned ${sitesRes.status}` };
      }
      const sitesJson = (await sitesRes.json()) as any;
      const siteCount = sitesJson.siteEntry?.length ?? 0;
      if (siteCount === 0) {
        return {
          state: 'connected_with_limitations',
          message: 'Connected but no verified properties found. Add a property in Search Console.',
        };
      }
      return {
        state: 'connected',
        message: `Connected — ${siteCount} verified propert${siteCount === 1 ? 'y' : 'ies'} available.`,
      };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }

  async fetchSEOData(ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    const clientId = ctx.credentials.clientId as string;
    const clientSecret = ctx.credentials.clientSecret as string;
    const refreshToken = ctx.credentials.refreshToken as string | undefined;
    const siteUrl = (ctx.credentials.siteUrl as string) || ctx.targetUrl;

    if (!refreshToken) {
      return { data: null, error: 'OAuth not completed — cannot fetch Search Console data.' };
    }

    try {
      // Refresh access token
      const tokenRes = await fetch(TOKEN_INFO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (!tokenRes.ok) {
        return { data: null, error: `Could not refresh OAuth token: ${tokenRes.status}` };
      }
      const tokens = (await tokenRes.json()) as any;
      const accessToken = tokens.access_token;

      // Determine the site URL — must match a verified property.
      const siteToQuery = siteUrl.startsWith('sc-domain:') ? siteUrl : (ctx.targetUrl.replace(/\/$/, '') + '/');

      // Query search analytics for the last 28 days.
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 27);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const body = {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 1000,
      };

      const res = await fetch(
        `${API_BASE}/sites/${encodeURIComponent(siteToQuery)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (res.status === 403) {
        return { data: null, error: 'Permission denied for Search Console query.' };
      }
      if (!res.ok) {
        return { data: null, error: `Search Console query returned ${res.status}` };
      }

      const json = (await res.json()) as any;
      const rows: any[] = json.rows ?? [];
      const keywords: KeywordData[] = rows.map((r) => ({
        query: r.keys[0],
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
        ctr: (r.ctr ?? 0) * 100,
        position: r.position ?? 0,
        dateRange: `${fmt(startDate)} to ${fmt(endDate)}`,
        country: 'global',
      }));

      return {
        data: {
          providerKey: 'searchconsole',
          fetchedAt: new Date().toISOString(),
          keywords,
          evidence: { source: 'searchconsole-v3', rowCount: rows.length },
        },
      };
    } catch (err) {
      return { data: null, error: `Search Console fetch failed: ${(err as Error).message}` };
    }
  }
}

export const searchConsoleProvider = new SearchConsoleProvider();
