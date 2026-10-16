// Shared type definitions for the SEO audit application.
// These types are used across the crawler, audit modules, providers,
// API routes, and the frontend UI.

// =====================================================
// Severity levels for issues (per spec section 9).
// =====================================================
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

// =====================================================
// Confidence level for an issue finding.
// "confirmed"   = directly observed from raw HTTP/HTML evidence.
// "likely"      = strong signal but may require human review.
// "heuristic"   = rule-based estimation; do not treat as fact.
// =====================================================
export type Confidence = 'confirmed' | 'likely' | 'heuristic';

// =====================================================
// Audit categories (per spec section 7).
// =====================================================
export type AuditCategory =
  | 'technical'
  | 'onpage'
  | 'content'
  | 'performance'
  | 'backlinks'
  | 'keywords'
  | 'localseo';

// =====================================================
// Issue lifecycle status (per spec section 9).
// =====================================================
export type IssueStatus = 'open' | 'in_progress' | 'fixed' | 'ignored';

// =====================================================
// Effort estimate for fixing an issue.
// =====================================================
export type EffortLevel = 'quick' | 'moderate' | 'significant';

// =====================================================
// Provider connection states (per spec section 5).
// =====================================================
export type ProviderConnectionState =
  | 'connected'
  | 'connected_with_limitations'
  | 'authentication_failed'
  | 'permission_denied'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'service_unavailable'
  | 'not_configured'
  | 'validation_inconclusive';

// =====================================================
// Provider auth method.
// =====================================================
export type AuthMethod = 'api_key' | 'bearer' | 'oauth2' | 'none';

// =====================================================
// Provider pricing/access tier.
// =====================================================
export type ProviderTier =
  | 'free'                  // Genuinely free with usable API
  | 'free_tier_limited'     // Free quota then paid
  | 'paid'                  // Requires subscription
  | 'no_api'                // Tool without a public API (implement internally)
  | 'oauth_required';       // Requires user OAuth consent (GSC, GA, Bing)

// =====================================================
// Provider capability flags. Each provider declares which
// audit categories it can supply data for.
// =====================================================
export interface ProviderCapabilities {
  technical?: boolean;
  onpage?: boolean;
  content?: boolean;
  performance?: boolean;
  backlinks?: boolean;
  keywords?: boolean;
  localseo?: boolean;
}

// =====================================================
// Metadata describing a provider. Shown in the Settings UI
// and used by the provider registry.
// =====================================================
export interface ProviderMetadata {
  key: string;                    // Unique provider key (e.g. "pagespeed")
  name: string;                   // Display name
  description: string;
  website: string;
  apiDocs: string;
  pricingUrl: string;
  tier: ProviderTier;
  authMethod: AuthMethod;
  capabilities: ProviderCapabilities;
  // Whether credentials are required (some providers use no API key)
  requiresCredentials: boolean;
  // Optional: official limitation note shown in UI
  limitations?: string;
}

// =====================================================
// Result of a connection validation test.
// =====================================================
export interface ValidationResult {
  providerKey: string;
  state: ProviderConnectionState;
  message: string;
  // Whether the credential field is populated
  hasCredentials: boolean;
  // Whether a real test request was made
  testedAt: string | null;
  // Quota info if exposed
  quotaInfo?: ProviderQuotaInfo | null;
  // Suggested next action when failing
  suggestedAction?: string;
}

export interface ProviderQuotaInfo {
  used?: number;
  limit?: number;
  remaining?: number;
  resetsAt?: string;
  raw?: Record<string, unknown>;
}

// =====================================================
// Normalized SEO data returned by a provider.
// Providers transform their proprietary payloads into this
// common shape so the audit pipeline can consume uniformly.
// =====================================================
export interface NormalizedSEOData {
  providerKey: string;
  fetchedAt: string;
  // Performance data (PageSpeed/Lighthouse)
  performance?: PerformanceMetricData[];
  // Backlink data
  backlinks?: BacklinkData[];
  // Keyword / search visibility data
  keywords?: KeywordData[];
  // Indexing data
  indexing?: IndexingData;
  // Raw provider response kept for evidence (NO secrets!)
  evidence?: Record<string, unknown>;
}

export interface PerformanceMetricData {
  url: string;
  strategy: 'mobile' | 'desktop';
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  tbt?: number;
  speedIndex?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  hasFieldData: boolean;
  opportunities?: Array<{
    id: string;
    title: string;
    description?: string;
    savingsMs?: number;
    displayValue?: string;
  }>;
  diagnostics?: Array<{
    id: string;
    title: string;
    description?: string;
    value?: string;
  }>;
}

export interface BacklinkData {
  referringDomain?: string;
  referringUrl?: string;
  anchorText?: string;
  linkType?: string;
  firstSeen?: string;
  lastVisited?: string;
  domainRating?: number;
  urlRating?: number;
}

export interface KeywordData {
  query: string;
  page?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  dateRange?: string;
  country?: string;
}

export interface IndexingData {
  indexedPages?: number;
  notIndexedPages?: number;
  blockedResources?: string[];
}

// =====================================================
// Crawler result for a single page.
// =====================================================
export interface CrawledPage {
  url: string;
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  responseTimeMs?: number;
  redirectChain: string[];
  // Extracted on-page signals
  title?: string;
  titleLength?: number;
  metaDescription?: string;
  metaDescriptionLength?: number;
  canonical?: string;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  headingHierarchyOk: boolean;
  wordCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  // Discovered links (for crawl queue)
  discoveredLinks: Array<{ href: string; text: string; isInternal: boolean }>;
  // Indexability
  robotsAllowed: boolean;
  indexable: boolean;
  // Structured data
  schemaTypes: string[];
  openGraphValid: boolean;
  twitterCardValid: boolean;
  // Security
  securityHeaders: Record<string, string>;
  hreflangValid: boolean;
  mixedContent: boolean;
  isHttps: boolean;
  // Errors during fetch (network, parse, etc.)
  error?: string;
}

// =====================================================
// Issue finding (the canonical shape used by audit modules).
// =====================================================
export interface IssueFinding {
  title: string;
  category: AuditCategory;
  severity: Severity;
  confidence: Confidence;
  affectedUrl?: string;
  description: string;
  whyItMatters: string;
  evidence: Array<{ source: string; detail: string }>;
  recommendation: string;
  steps: Array<{ step: string; detail: string }>;
  effort: EffortLevel;
  priority: number;            // 0-100, higher = more urgent
  source: string;              // provider key or "crawler"
  // Optional CMS-specific instructions
  cmsInstructions?: Array<{ cms: string; instructions: string }>;
  // Optional documentation links
  documentationLinks?: Array<{ label: string; url: string }>;
}

// =====================================================
// Scan configuration chosen by the user.
// =====================================================
export interface ScanConfig {
  targetUrl: string;
  maxPages: number;            // default 50
  maxDepth: number;            // default 3
  requestTimeoutMs: number;    // default 10000
  crawlConcurrency: number;    // default 3
  checkExternalLinks: boolean; // default false
  includeSubdomains: boolean; // default false
  includeQueryParams: boolean; // default false
  respectRobotsTxt: boolean;  // default true
  useSitemapAsSeed: boolean;  // default true
  // Selected providers (which to require/optionally use)
  requiredProviders: string[]; // must validate or scan blocked
  optionalProviders: string[]; // best-effort, do not block on failure
  // Performance strategy
  performanceStrategies: Array<'mobile' | 'desktop'>;
  // Name/label for the scan
  label?: string;
}

export const DEFAULT_SCAN_CONFIG: Partial<ScanConfig> = {
  maxPages: 50,
  maxDepth: 3,
  requestTimeoutMs: 10000,
  crawlConcurrency: 3,
  checkExternalLinks: false,
  includeSubdomains: false,
  includeQueryParams: false,
  respectRobotsTxt: true,
  useSitemapAsSeed: true,
  performanceStrategies: ['mobile', 'desktop'],
};

// =====================================================
// Overall scan result object (stored as JSON in Scan.summary).
// =====================================================
export interface ScanSummary {
  overallScore: number;
  coverage: number;
  categoryScores: {
    technical: number;
    onpage: number;
    content: number;
    performance: number;
    offpage: number;
    coverage: number;
  };
  countsByCategory: Record<AuditCategory, number>;
  countsBySeverity: Record<Severity, number>;
  providersUsed: string[];
  providersUnavailable: Array<{ key: string; reason: string }>;
  scanDurationMs: number;
  limitations: string[];
}

// =====================================================
// Scan status values stored in Scan.status column.
// =====================================================
export type ScanStatus =
  | 'pending'
  | 'validating'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
