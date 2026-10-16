// Google Analytics Data API provider (GA4).
// Requires OAuth 2.0 with analytics.readonly scope and a configured property ID.
// Docs: https://developers.google.com/analytics/devguides/reporting/data/v1

import { BaseProvider, ProviderConfigShape, ProviderFetchContext } from '@/lib/providers/base';
import type {
  ProviderMetadata,
  ProviderCapabilities,
  NormalizedSEOData,
  ProviderConnectionState,
} from '@/lib/types';

class GoogleAnalyticsProvider extends BaseProvider {
  getMetadata(): ProviderMetadata {
    return {
      key: 'analytics',
      name: 'Google Analytics Data API (GA4)',
      description:
        'Retrieves organic search traffic metrics, landing-page performance, and engagement data. Requires OAuth 2.0 with analytics.readonly scope and a GA4 property ID.',
      website: 'https://analytics.google.com/',
      apiDocs: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
      pricingUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
      tier: 'oauth_required',
      authMethod: 'oauth2',
      capabilities: { keywords: true },
      requiresCredentials: true,
      limitations:
        'Requires GA4 property and OAuth consent. Does NOT directly measure rankings. Metrics are engagement, not search position.',
    };
  }
  getConfigShape(): ProviderConfigShape {
    return {
      fields: [
        { key: 'clientId', label: 'OAuth Client ID', type: 'text', required: true, placeholder: 'xxxx.apps.googleusercontent.com' },
        { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', required: true },
        { key: 'refreshToken', label: 'Refresh Token', type: 'password', required: false, placeholder: '1//…' },
        { key: 'propertyId', label: 'GA4 Property ID', type: 'text', required: true, placeholder: '123456789', helpText: 'Numeric property ID from GA4 Admin → Property Settings.' },
      ],
      authMethod: 'oauth2',
      oauthMetadata: {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        redirectUri: '/api/providers/analytics/oauth/callback',
      },
    };
  }
  getCapabilities(): ProviderCapabilities {
    return { keywords: true };
  }
  validateConfiguration(credentials: Record<string, unknown>) {
    const missing: string[] = [];
    if (!credentials.clientId) missing.push('clientId');
    if (!credentials.clientSecret) missing.push('clientSecret');
    if (!credentials.propertyId) missing.push('propertyId');
    return { valid: missing.length === 0, missingFields: missing, invalidFields: [] };
  }
  async testConnection(credentials: Record<string, unknown>): Promise<{ state: ProviderConnectionState; message: string; quotaInfo?: null }> {
    const refreshToken = credentials.refreshToken as string | undefined;
    if (!refreshToken) {
      return { state: 'not_configured', message: 'OAuth flow not completed.' };
    }
    try {
      // Use token endpoint to refresh and verify
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: credentials.clientId as string,
          client_secret: credentials.clientSecret as string,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (tokenRes.status === 401 || tokenRes.status === 400) {
        return { state: 'authentication_failed', message: 'GA4 OAuth refresh failed.' };
      }
      if (!tokenRes.ok) {
        return { state: 'service_unavailable', message: `GA4 token endpoint returned ${tokenRes.status}` };
      }
      return { state: 'connected', message: 'Connected — OAuth tokens valid.' };
    } catch (err) {
      return { state: 'service_unavailable', message: `Network error: ${(err as Error).message}` };
    }
  }
  async fetchSEOData(_ctx: ProviderFetchContext): Promise<{ data: NormalizedSEOData | null; error?: string }> {
    // Note: GA4 Data API integration requires complex JSON request bodies
    // for runReport. For MVP this provider is registered but fetch is
    // intentionally conservative — returns null with a clear reason.
    return { data: null, error: 'GA4 Data API fetch not implemented in MVP. Provider is configured and tested for connectivity.' };
  }
}

export const googleAnalyticsProvider = new GoogleAnalyticsProvider();
