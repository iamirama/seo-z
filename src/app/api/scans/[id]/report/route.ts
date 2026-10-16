// Generate and return the standalone HTML report for a completed scan.
import { db } from '@/lib/db';
import { generateHtmlReport, ReportPayload } from '@/lib/report/generator';
import { getAllProviderMetadata } from '@/lib/providers/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const reportType = (url.searchParams.get('type') ?? 'detailed') as 'executive' | 'detailed';

  const scan = await db.scan.findUnique({
    where: { id },
    include: { website: true },
  });
  if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });
  if (scan.status !== 'completed') {
    return Response.json({ error: `Scan not completed (status: ${scan.status})` }, { status: 400 });
  }

  // Load issues
  const issuesRaw = await db.issue.findMany({
    where: { scanId: id },
    orderBy: [{ severity: 'asc' }, { priority: 'desc' }],
  });
  const issues = issuesRaw.map((i) => ({
    title: i.title,
    category: i.category as any,
    severity: i.severity as any,
    confidence: i.confidence as any,
    affectedUrl: i.affectedUrl ?? undefined,
    description: i.description,
    whyItMatters: i.whyItMatters,
    evidence: i.evidence ? JSON.parse(i.evidence) : [],
    recommendation: i.recommendation,
    steps: i.steps ? JSON.parse(i.steps) : [],
    effort: i.effort as any,
    priority: i.priority,
    source: i.source,
    status: i.status as any,
    documentationLinks: [],
  }));

  // Load crawled pages (basic metadata only)
  const pagesRaw = await db.scanPage.findMany({
    where: { scanId: id },
    take: 1000,
  });
  const crawledPages = pagesRaw.map((p) => ({
    url: p.url,
    finalUrl: p.finalUrl ?? undefined,
    statusCode: p.statusCode ?? undefined,
    contentType: p.contentType ?? undefined,
    responseTimeMs: p.responseTimeMs ?? undefined,
    redirectChain: [],
    title: p.title ?? undefined,
    titleLength: p.titleLength ?? 0,
    metaDescription: p.metaDescription ?? undefined,
    metaDescriptionLength: p.metaDescriptionLength ?? 0,
    canonical: p.canonical ?? undefined,
    h1Count: p.h1Count,
    h2Count: p.h2Count,
    h3Count: p.h3Count,
    headingHierarchyOk: p.headingHierarchyOk,
    wordCount: p.wordCount,
    imageCount: p.imageCount,
    imagesWithoutAlt: p.imagesWithoutAlt,
    internalLinks: p.internalLinks,
    externalLinks: p.externalLinks,
    discoveredLinks: [],
    robotsAllowed: p.robotsAllowed,
    indexable: p.indexable,
    schemaTypes: p.schemaTypes ? JSON.parse(p.schemaTypes) : [],
    openGraphValid: p.openGraphValid,
    twitterCardValid: p.twitterCardValid,
    securityHeaders: p.securityHeaders ? JSON.parse(p.securityHeaders) : {},
    hreflangValid: p.hreflangValid,
    mixedContent: p.mixedContent,
    isHttps: p.isHttps,
  }));

  // Load providers metadata + current state
  const allProviderMeta = getAllProviderMetadata();
  const validation = scan.validation ? JSON.parse(scan.validation) : { requiredResults: [], optionalResults: [] };
  const providerStateMap: Record<string, { state: string; hasCredentials: boolean }> = {};
  for (const r of [...(validation.requiredResults ?? []), ...(validation.optionalResults ?? [])]) {
    providerStateMap[r.providerKey] = { state: r.state, hasCredentials: r.hasCredentials };
  }
  const providers = allProviderMeta.map((p) => ({
    metadata: p.metadata,
    state: providerStateMap[p.metadata.key]?.state ?? 'not_configured',
    hasCredentials: providerStateMap[p.metadata.key]?.hasCredentials ?? false,
  }));

  // Compose summary
  const summary = scan.summary ? JSON.parse(scan.summary) : {
    overallScore: scan.overallScore ?? 0,
    coverage: scan.coverage ?? 0,
    categoryScores: scan.categoryScores ? JSON.parse(scan.categoryScores) : { technical: 0, onpage: 0, content: 0, performance: 0, offpage: 0, coverage: 0 },
    countsByCategory: {},
    countsBySeverity: {},
    providersUsed: [],
    providersUnavailable: [],
    scanDurationMs: 0,
    limitations: [],
  };

  const payload: ReportPayload = {
    scanId: scan.id,
    websiteUrl: scan.targetUrl,
    websiteName: scan.website?.name ?? scan.website?.url,
    scannedAt: scan.startedAt.toISOString(),
    scanDurationMs: scan.completedAt ? scan.completedAt.getTime() - scan.startedAt.getTime() : 0,
    scanConfig: JSON.parse(scan.config),
    summary,
    issues,
    crawledPages,
    validation,
    providers,
    reportType,
  };

  const html = generateHtmlReport(payload);

  const filename = `seo-audit-${scan.website?.url ? new URL(scan.website.url).hostname : 'report'}-${scan.id.slice(-8)}.html`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
