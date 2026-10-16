// Audit orchestrator.
//
// This module ties together: crawler, provider validation, provider
// data fetch, audit modules, scoring, and persistence.
//
// Flow (per spec section 5):
//   1. Pre-scan validation: validate required providers; block scan if any required fails.
//   2. Crawl the website (always — the crawler is free-first).
//   3. Fetch data from validated optional providers (best-effort).
//   4. Run audit modules on crawled + provider data.
//   5. Compute scores and build summary.
//   6. Persist to DB.

import { db } from '@/lib/db';
import { crawlWebsite, CrawlerConfig } from '@/lib/crawler';
import { getProvider } from '@/lib/providers/registry';
import { getDecryptedCredentials, validateProviderByKey } from '@/lib/store/providers';
import { auditTechnical, auditOnPage, auditContent, auditPerformance, auditBacklinks, auditKeywords } from '@/lib/audit';
import { buildSummary } from '@/lib/scoring';
import { normalizeUrl, urlOrigin, isValidPublicUrl } from '@/lib/security/ssrf';
import type { IssueFinding, NormalizedSEOData, ScanConfig, ValidationResult, AuditCategory } from '@/lib/types';

// ---------------------------------------------------------------------
// Pre-scan validation gate.
// ---------------------------------------------------------------------
export interface PreScanValidationResult {
  requiredResults: ValidationResult[];
  optionalResults: ValidationResult[];
  canStartScan: boolean;       // true if at least one method (crawler) is available
  blockingReason?: string;     // set when blocked
}

export async function preScanValidation(config: ScanConfig): Promise<PreScanValidationResult> {
  // Required providers must all pass.
  const requiredResults = await Promise.all(config.requiredProviders.map((k) => validateProviderByKey(k)));
  // Optional providers best-effort
  const optionalResults = await Promise.all(config.optionalProviders.map((k) => validateProviderByKey(k)));

  // Check whether any required provider failed
  const failedRequired = requiredResults.filter((r) => r.state !== 'connected' && r.state !== 'connected_with_limitations');
  // Free crawler is always available (the floor of "free-first mode").
  // If the user marked no provider as required, OR all required passed, we can proceed.
  let canStartScan = true;
  let blockingReason: string | undefined;
  if (failedRequired.length > 0) {
    canStartScan = false;
    blockingReason = `Required providers failed validation: ${failedRequired.map((r) => r.providerKey).join(', ')}. Fix credentials in Settings or remove from required list.`;
  }
  return { requiredResults, optionalResults, canStartScan, blockingReason };
}

// ---------------------------------------------------------------------
// Run the full audit. This is called from the API route after
// pre-scan validation passes.
// ---------------------------------------------------------------------
export interface RunAuditOptions {
  scanId: string;
  websiteId: string;
  config: ScanConfig;
}

export async function runAudit(opts: RunAuditOptions): Promise<void> {
  const { scanId, websiteId, config } = opts;
  const startTime = Date.now();

  // Mark scan as running
  await db.scan.update({
    where: { id: scanId },
    data: { status: 'running' },
  });

  // Capture validation snapshot (required + optional)
  const validation = await preScanValidation(config);
  await db.scan.update({
    where: { id: scanId },
    data: {
      validation: JSON.stringify({
        requiredResults: validation.requiredResults,
        optionalResults: validation.optionalResults,
      }),
    },
  });

  if (!validation.canStartScan) {
    await db.scan.update({
      where: { id: scanId },
      data: { status: 'failed', errorMessage: validation.blockingReason ?? 'Pre-scan validation failed', completedAt: new Date() },
    });
    return;
  }

  // Validate the target URL
  const urlValidation = isValidPublicUrl(config.targetUrl);
  if (!urlValidation.valid) {
    await db.scan.update({
      where: { id: scanId },
      data: { status: 'failed', errorMessage: `Invalid target URL: ${urlValidation.reason}`, completedAt: new Date() },
    });
    return;
  }
  const targetUrl = urlValidation.normalized!;

  // --------------------------------------------------------------
  // 1. CRAWL
  // --------------------------------------------------------------
  const origin = urlOrigin(targetUrl);
  if (!origin) {
    await db.scan.update({
      where: { id: scanId },
      data: { status: 'failed', errorMessage: 'Could not determine origin URL', completedAt: new Date() },
    });
    return;
  }

  const crawlerConfig: CrawlerConfig = {
    targetUrl,
    maxPages: config.maxPages,
    maxDepth: config.maxDepth,
    requestTimeoutMs: config.requestTimeoutMs,
    crawlConcurrency: config.crawlConcurrency,
    checkExternalLinks: config.checkExternalLinks,
    includeSubdomains: config.includeSubdomains,
    includeQueryParams: config.includeQueryParams,
    respectRobotsTxt: config.respectRobotsTxt,
    useSitemapAsSeed: config.useSitemapAsSeed,
    onProgress: (progress) => {
      // Persist progress to the scan row
      db.scan.update({
        where: { id: scanId },
        data: {
          pagesDiscovered: progress.discovered,
          pagesCrawled: progress.crawled,
          errorsEncountered: progress.errors,
        },
      }).catch(() => { /* ignore progress errors */ });
    },
  };

  let crawledPages;
  try {
    const crawlResult = await crawlWebsite(crawlerConfig);
    crawledPages = crawlResult.pages;
  } catch (err) {
    await db.scan.update({
      where: { id: scanId },
      data: { status: 'failed', errorMessage: `Crawl failed: ${(err as Error).message}`, completedAt: new Date() },
    });
    return;
  }

  // Persist crawled pages
  for (const page of crawledPages) {
    await db.scanPage.create({
      data: {
        scanId,
        url: page.url,
        finalUrl: page.finalUrl ?? null,
        statusCode: page.statusCode ?? null,
        title: page.title ?? null,
        titleLength: page.titleLength ?? 0,
        metaDescription: page.metaDescription ?? null,
        metaDescriptionLength: page.metaDescriptionLength ?? 0,
        canonical: page.canonical ?? null,
        h1Count: page.h1Count,
        h2Count: page.h2Count,
        h3Count: page.h3Count,
        headingHierarchyOk: page.headingHierarchyOk,
        wordCount: page.wordCount,
        imageCount: page.imageCount,
        imagesWithoutAlt: page.imagesWithoutAlt,
        internalLinks: page.internalLinks,
        externalLinks: page.externalLinks,
        robotsAllowed: page.robotsAllowed,
        indexable: page.indexable,
        schemaTypes: JSON.stringify(page.schemaTypes),
        openGraphValid: page.openGraphValid,
        twitterCardValid: page.twitterCardValid,
        securityHeaders: JSON.stringify(page.securityHeaders),
        hreflangValid: page.hreflangValid,
        mixedContent: page.mixedContent,
        isHttps: page.isHttps,
        redirectChain: page.redirectChain.length,
        contentType: page.contentType ?? null,
        responseTimeMs: page.responseTimeMs ?? null,
      },
    });
  }

  // --------------------------------------------------------------
  // 2. PROVIDER DATA FETCH
  // --------------------------------------------------------------
  const allProviderKeys = Array.from(new Set([...config.requiredProviders, ...config.optionalProviders]));
  const providersUsed: string[] = [];
  const providersUnavailable: Array<{ key: string; reason: string }> = [];
  const providerDataByProvider: Record<string, NormalizedSEOData> = {};

  for (const providerKey of allProviderKeys) {
    const provider = getProvider(providerKey);
    if (!provider) {
      providersUnavailable.push({ key: providerKey, reason: 'Unknown provider' });
      continue;
    }
    const creds = await getDecryptedCredentials(providerKey);
    if (!creds) {
      providersUnavailable.push({ key: providerKey, reason: 'Not configured' });
      continue;
    }
    // Verify provider is still valid (re-validate at scan start)
    const v = await validateProviderByKey(providerKey);
    if (v.state !== 'connected' && v.state !== 'connected_with_limitations') {
      providersUnavailable.push({ key: providerKey, reason: v.message });
      continue;
    }
    try {
      const result = await provider.fetchSEOData({
        targetUrl,
        config,
        credentials: creds,
        log: (level, msg, meta) => console[level](`[provider:${providerKey}]`, msg, meta ?? ''),
      });
      if (result.data) {
        providerDataByProvider[providerKey] = result.data;
        providersUsed.push(providerKey);
      } else {
        providersUnavailable.push({ key: providerKey, reason: result.error ?? 'No data returned' });
      }
    } catch (err) {
      const normalized = provider.normalizeError(err);
      providersUnavailable.push({ key: providerKey, reason: normalized.message });
    }
  }

  // Aggregate performance data (from PageSpeed if available)
  let performanceData: NormalizedSEOData | null = null;
  if (providerDataByProvider['pagespeed']) {
    performanceData = providerDataByProvider['pagespeed'];
    // Persist performance metrics
    for (const m of performanceData.performance ?? []) {
      await db.performanceMetric.create({
        data: {
          scanId,
          url: m.url,
          strategy: m.strategy,
          lcp: m.lcp ?? null,
          inp: m.inp ?? null,
          cls: m.cls ?? null,
          fcp: m.fcp ?? null,
          tbt: m.tbt ?? null,
          speedIndex: m.speedIndex ?? null,
          performanceScore: m.performanceScore ?? null,
          accessibilityScore: m.accessibilityScore ?? null,
          bestPracticesScore: m.bestPracticesScore ?? null,
          seoScore: m.seoScore ?? null,
          hasFieldData: m.hasFieldData,
          opportunities: m.opportunities ? JSON.stringify(m.opportunities) : null,
          diagnostics: m.diagnostics ? JSON.stringify(m.diagnostics) : null,
        },
      });
    }
  }

  // Aggregate backlink data
  let backlinkData: NormalizedSEOData | null = null;
  let backlinkProviderName = '';
  for (const key of ['ahrefs', 'moz', 'majestic']) {
    if (providerDataByProvider[key]) {
      backlinkData = providerDataByProvider[key];
      backlinkProviderName = key;
      // Persist backlinks
      for (const b of backlinkData.backlinks ?? []) {
        await db.backlinkRecord.create({
          data: {
            scanId,
            source: key,
            referringDomain: b.referringDomain ?? null,
            referringUrl: b.referringUrl ?? null,
            anchorText: b.anchorText ?? null,
            linkType: b.linkType ?? null,
            firstSeen: b.firstSeen ?? null,
            lastVisited: b.lastVisited ?? null,
            domainRating: b.domainRating ?? null,
            urlRating: b.urlRating ?? null,
            raw: JSON.stringify(b),
          },
        });
      }
      break;
    }
  }

  // Aggregate keyword data
  let keywordData: NormalizedSEOData | null = null;
  let keywordProviderName = '';
  for (const key of ['searchconsole', 'bing', 'semrush']) {
    if (providerDataByProvider[key]) {
      keywordData = providerDataByProvider[key];
      keywordProviderName = key;
      // Persist keywords
      for (const k of keywordData.keywords ?? []) {
        await db.keywordRecord.create({
          data: {
            scanId,
            source: key,
            query: k.query,
            page: k.page ?? null,
            impressions: k.impressions,
            clicks: k.clicks,
            ctr: k.ctr,
            position: k.position,
            dateRange: k.dateRange ?? null,
            country: k.country ?? null,
          },
        });
      }
      break;
    }
  }

  // --------------------------------------------------------------
  // 3. RUN AUDIT MODULES
  // --------------------------------------------------------------
  const technicalFindings = auditTechnical(crawledPages, config);
  const onpageFindings = auditOnPage(crawledPages, config);
  const contentFindings = auditContent(crawledPages, config);
  const performanceFindings = auditPerformance(performanceData);
  const backlinkFindings = auditBacklinks(backlinkData, backlinkProviderName);
  const keywordFindings = auditKeywords(keywordData, keywordProviderName);

  const findingsByCategory: Record<AuditCategory, IssueFinding[]> = {
    technical: technicalFindings,
    onpage: onpageFindings,
    content: contentFindings,
    performance: performanceFindings,
    backlinks: backlinkFindings,
    keywords: keywordFindings,
    localseo: [],
  };

  const hasData: Record<AuditCategory, boolean> = {
    technical: crawledPages.length > 0,
    onpage: crawledPages.some((p) => p.statusCode === 200),
    content: crawledPages.some((p) => p.statusCode === 200 && p.wordCount > 0),
    performance: !!performanceData,
    backlinks: !!backlinkData,
    keywords: !!keywordData,
    localseo: false, // not implemented in MVP
  };

  const allFindings = [
    ...technicalFindings,
    ...onpageFindings,
    ...contentFindings,
    ...performanceFindings,
    ...backlinkFindings,
    ...keywordFindings,
  ];

  const summary = buildSummary(
    allFindings,
    findingsByCategory,
    hasData,
    providersUsed,
    providersUnavailable,
    Date.now() - startTime,
    crawledPages.length,
  );

  // --------------------------------------------------------------
  // 4. PERSIST FINDINGS + SUMMARY
  // --------------------------------------------------------------
  // Insert all issues in batches to avoid SQLite parameter limit
  const batchSize = 50;
  for (let i = 0; i < allFindings.length; i += batchSize) {
    const batch = allFindings.slice(i, i + batchSize);
    await Promise.all(batch.map((f) => db.issue.create({
      data: {
        scanId,
        websiteId,
        title: f.title,
        category: f.category,
        severity: f.severity,
        confidence: f.confidence,
        affectedUrl: f.affectedUrl ?? null,
        description: f.description,
        whyItMatters: f.whyItMatters,
        evidence: JSON.stringify(f.evidence),
        recommendation: f.recommendation,
        steps: JSON.stringify(f.steps),
        effort: f.effort,
        priority: f.priority,
        status: 'open',
        source: f.source,
      },
    })));
  }

  await db.scan.update({
    where: { id: scanId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      overallScore: summary.overallScore,
      coverage: summary.coverage,
      summary: JSON.stringify(summary),
      categoryScores: JSON.stringify(summary.categoryScores),
      issueCount: allFindings.length,
      criticalCount: summary.countsBySeverity.critical,
      highCount: summary.countsBySeverity.high,
      mediumCount: summary.countsBySeverity.medium,
      lowCount: summary.countsBySeverity.low,
      informationalCount: summary.countsBySeverity.informational,
      pagesDiscovered: crawledPages.length,
      pagesCrawled: crawledPages.length,
      errorsEncountered: crawledPages.filter((p) => p.error).length,
      providersSnapshot: JSON.stringify({ providersUsed, providersUnavailable }),
    },
  });

  // Update website lastScanAt
  await db.website.update({
    where: { id: websiteId },
    data: { lastScanAt: new Date(), url: normalizeUrl(targetUrl, { includeQueryParams: false }) ?? targetUrl },
  });
}
