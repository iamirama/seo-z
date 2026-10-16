// SEO scoring system (per spec section 8).
//
// The score is computed per-category and rolled up to an overall score.
// Categories that produced no data are NOT penalized; the overall score
// is normalized to the categories that actually have findings.
//
// IMPORTANT: This score is an application-generated diagnostic metric,
// NOT an official Google ranking score. It is intended for
// comparison over time within a single website, not for benchmarking
// against other sites.

import type { IssueFinding, Severity, AuditCategory, ScanSummary } from '@/lib/types';

// =====================================================================
// Weights for each category. Used to roll up the overall score.
// =====================================================================
const CATEGORY_WEIGHTS: Record<string, number> = {
  technical: 30,
  onpage: 25,
  content: 15,
  performance: 15,
  backlinks: 10,
  keywords: 5,
};

// Per-severity penalty applied to the category score, NORMALIZED BY
// the number of crawled pages (issue density). This prevents a
// large multi-page site from being penalized disproportionately when
// the same root issue (e.g. "missing canonical") affects many pages.
//
// Density formula:
//   density = sum(severity_penalty * count) / pages_crawled
//   category_score = max(0, 100 - density * NORMALIZATION_FACTOR)
//
// NORMALIZATION_FACTOR caps how quickly the score degrades with density.
// =====================================================================
const SEVERITY_PENALTIES: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 5,
  low: 1,
  informational: 0, // informational findings don't penalize
};

// Scale factor that converts raw density into score deduction.
// A density of 1.0 (one "medium-equivalent" issue per page) reduces the
// category score by this much. We use 40 so a density of 1.0 yields a
// category score of 60 — flagged as needs improvement but not catastrophic.
const DENSITY_SCALE = 40;

// =====================================================================
// Extract the issue TYPE from a title by stripping any trailing URL.
// Many audit modules format titles like "Missing canonical tag:
// https://example.com/page" — we want to dedupe by "Missing canonical
// tag" so the same issue affecting 50 pages counts as ONE penalty.
// =====================================================================
function titleWithoutUrl(title: string): string {
  // Strip URL-like substrings (http:// or https://...)
  return title.replace(/https?:\/\/\S+/g, '').trim().toLowerCase();
}

// =====================================================================
// Compute a category score from its findings, normalized by the number
// of crawled pages AND deduplicated by issue title PREFIX (without URL)
// so the same underlying problem (e.g. "Missing canonical") is not
// double-counted when it affects many pages.
// Returns 0-100.
//
// If pagesCrawled is 0 or undefined, falls back to raw deduction
// (single-page scan), capped at 100/0.
// =====================================================================
export function computeCategoryScore(findings: IssueFinding[], pagesCrawled: number = 1): number {
  // Deduplicate by title prefix (same issue affecting multiple URLs counts once)
  const seenTitles = new Set<string>();
  const deduped: IssueFinding[] = [];
  for (const f of findings) {
    const key = titleWithoutUrl(f.title);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    deduped.push(f);
  }

  // Count severity totals on deduped list
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
  for (const f of deduped) counts[f.severity]++;

  const rawPenalty = (counts.critical * SEVERITY_PENALTIES.critical) +
                     (counts.high * SEVERITY_PENALTIES.high) +
                     (counts.medium * SEVERITY_PENALTIES.medium) +
                     (counts.low * SEVERITY_PENALTIES.low);

  // For single-page scans or very small scans, use raw deduction (capped)
  if (pagesCrawled <= 1) {
    return Math.max(0, Math.min(100, Math.round(100 - rawPenalty)));
  }

  // Density = average penalty per page crawled
  const density = rawPenalty / pagesCrawled;
  const score = 100 - density * DENSITY_SCALE;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// =====================================================================
// Compute the overall SEO health score.
//
// Process:
//   1. For each category with data, compute its 0-100 score.
//   2. Apply category weights to roll up to a 0-100 overall.
//   3. Normalize: divide by the sum of weights of categories that
//      have data (so missing categories don't drag the score down).
//
// Coverage % = (categories with data / total categories) * 100
// =====================================================================
export function computeOverallScore(
  findingsByCategory: Record<AuditCategory, IssueFinding[]>,
  hasData: Record<AuditCategory, boolean>,
  pagesCrawled: number = 1,
): { overallScore: number; categoryScores: ScanSummary['categoryScores']; coverage: number } {
  const categoryScores: ScanSummary['categoryScores'] = {
    technical: 0,
    onpage: 0,
    content: 0,
    performance: 0,
    offpage: 0,
    coverage: 0,
  };

  // Map "backlinks" + "keywords" + "localseo" into "offpage" rollup
  let weightedSum = 0;
  let totalWeight = 0;

  // Off-page rollup: backlinks + keywords combined
  const offpageFindings: IssueFinding[] = [
    ...(findingsByCategory.backlinks ?? []),
    ...(findingsByCategory.keywords ?? []),
    ...(findingsByCategory.localseo ?? []),
  ];
  const hasOffpageData = hasData.backlinks || hasData.keywords || hasData.localseo;
  if (hasOffpageData) {
    // Off-page score uses raw deduction (backlink counts don't scale with pages)
    // and dedup by title prefix
    const seenTitles = new Set<string>();
    let offpageScore = 100;
    for (const f of offpageFindings) {
      const key = titleWithoutUrl(f.title);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      offpageScore -= SEVERITY_PENALTIES[f.severity];
    }
    offpageScore = Math.max(0, Math.min(100, Math.round(offpageScore)));
    categoryScores.offpage = offpageScore;
    weightedSum += offpageScore * (CATEGORY_WEIGHTS.backlinks + CATEGORY_WEIGHTS.keywords);
    totalWeight += CATEGORY_WEIGHTS.backlinks + CATEGORY_WEIGHTS.keywords;
  }

  // Individual categories — density-based for crawled-data categories
  const individualCats: AuditCategory[] = ['technical', 'onpage', 'content', 'performance'];
  for (const cat of individualCats) {
    if (hasData[cat]) {
      // Performance doesn't scale with crawled pages (one Lighthouse run per strategy)
      // so we use raw deduction for performance; density-based for the rest.
      const pagesForCategory = cat === 'performance' ? 1 : pagesCrawled;
      const s = computeCategoryScore(findingsByCategory[cat] ?? [], pagesForCategory);
      (categoryScores as any)[cat] = s;
      weightedSum += s * (CATEGORY_WEIGHTS[cat] ?? 0);
      totalWeight += CATEGORY_WEIGHTS[cat] ?? 0;
    }
  }

  // Coverage = % of expected categories with data
  // Total expected = technical + onpage + content + performance + offpage (5)
  const expectedCategories = 5;
  let presentCategories = 0;
  for (const cat of individualCats) if (hasData[cat]) presentCategories++;
  if (hasOffpageData) presentCategories++;
  const coverage = Math.round((presentCategories / expectedCategories) * 100);
  categoryScores.coverage = coverage;

  const overallScore = totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);
  return { overallScore, categoryScores, coverage };
}

// =====================================================================
// Build the full ScanSummary object.
// =====================================================================
export function buildSummary(
  allFindings: IssueFinding[],
  findingsByCategory: Record<AuditCategory, IssueFinding[]>,
  hasData: Record<AuditCategory, boolean>,
  providersUsed: string[],
  providersUnavailable: Array<{ key: string; reason: string }>,
  scanDurationMs: number,
  pagesCrawled: number = 1,
): ScanSummary {
  const { overallScore, categoryScores, coverage } = computeOverallScore(findingsByCategory, hasData, pagesCrawled);

  const countsByCategory = {
    technical: findingsByCategory.technical?.length ?? 0,
    onpage: findingsByCategory.onpage?.length ?? 0,
    content: findingsByCategory.content?.length ?? 0,
    performance: findingsByCategory.performance?.length ?? 0,
    backlinks: findingsByCategory.backlinks?.length ?? 0,
    keywords: findingsByCategory.keywords?.length ?? 0,
    localseo: findingsByCategory.localseo?.length ?? 0,
  } as Record<AuditCategory, number>;

  const countsBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  } as Record<Severity, number>;
  for (const f of allFindings) countsBySeverity[f.severity]++;

  // Document scan limitations
  const limitations: string[] = [];
  if (!hasData.backlinks && !hasData.keywords) {
    limitations.push('Backlink and keyword analysis unavailable. Configure Search Console, Bing Webmaster, or a commercial provider (Ahrefs/Moz/Semrush) for full coverage.');
  }
  if (!hasData.performance) {
    limitations.push('Performance data unavailable. Configure Google PageSpeed Insights to enable Core Web Vitals analysis.');
  }
  for (const p of providersUnavailable) {
    limitations.push(`${p.key}: ${p.reason}`);
  }
  limitations.push('Scores are application-generated diagnostics, not official Google ranking scores.');
  limitations.push('Length thresholds (title, meta description, content) are heuristic defaults, not universal ranking rules.');

  return {
    overallScore,
    coverage,
    categoryScores,
    countsByCategory,
    countsBySeverity,
    providersUsed,
    providersUnavailable,
    scanDurationMs,
    limitations,
  };
}
