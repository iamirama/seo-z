// Provider registry: central catalog of all SEO provider integrations.
//
// Per spec section 3, the application supports a modular integration
// system so additional providers can be added later. To add a new
// provider:
//   1. Create src/lib/providers/<name>.ts exporting a BaseProvider instance.
//   2. Register it in the PROVIDER_REGISTRY below.
//   3. The Settings UI, validation gate, and audit pipeline will
//      pick it up automatically.

import { BaseProvider } from '@/lib/providers/base';
import { pagespeedProvider } from '@/lib/providers/pagespeed';
import { searchConsoleProvider } from '@/lib/providers/searchconsole';
import { googleAnalyticsProvider } from '@/lib/providers/analytics';
import { bingProvider } from '@/lib/providers/bing';
import { ahrefsProvider } from '@/lib/providers/ahrefs';
import { semrushProvider } from '@/lib/providers/semrush';
import { mozProvider } from '@/lib/providers/moz';
import {
  dataForSeoProvider,
  serpApiProvider,
  majesticProvider,
} from '@/lib/providers/optional-providers';

// Ordered list of providers. Order determines display in the Settings UI.
export const PROVIDER_REGISTRY: BaseProvider[] = [
  // Free-first providers (top of the list)
  pagespeedProvider,
  searchConsoleProvider,
  googleAnalyticsProvider,
  bingProvider,
  // Commercial providers
  ahrefsProvider,
  semrushProvider,
  mozProvider,
  // Optional / additional
  dataForSeoProvider,
  serpApiProvider,
  majesticProvider,
];

// Lookup map for fast access by key.
const PROVIDER_MAP: Record<string, BaseProvider> = Object.fromEntries(
  PROVIDER_REGISTRY.map((p) => [p.getMetadata().key, p]),
);

export function getProvider(key: string): BaseProvider | undefined {
  return PROVIDER_MAP[key];
}

// Get all provider metadata (for UI rendering without exposing instances).
export function getAllProviderMetadata() {
  return PROVIDER_REGISTRY.map((p) => ({
    metadata: p.getMetadata(),
    configShape: p.getConfigShape(),
    capabilities: p.getCapabilities(),
  }));
}

// Default required providers — what we consider the absolute minimum
// for a meaningful scan (free-first mode). The user can override these
// per scan, but if ALL providers are unavailable the scan is blocked.
export const DEFAULT_REQUIRED_PROVIDERS: string[] = [];
// Note: the free technical crawler is always available even with zero
// providers configured. So even with no required providers, a basic
// crawl-based audit still runs.
