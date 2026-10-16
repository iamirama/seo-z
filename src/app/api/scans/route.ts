// Scan lifecycle: GET = list scans, POST = start a new scan.
import { db } from '@/lib/db';
import { isValidPublicUrl, normalizeUrl } from '@/lib/security/ssrf';
import { preScanValidation } from '@/lib/audit/orchestrator';
import type { ScanConfig } from '@/lib/types';
import { DEFAULT_SCAN_CONFIG } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const websiteId = url.searchParams.get('websiteId');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  const scans = await db.scan.findMany({
    where: websiteId ? { websiteId } : undefined,
    orderBy: { startedAt: 'desc' },
    take: Math.min(limit, 200),
    include: { website: true },
  });
  return Response.json({ scans });
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<ScanConfig> & { targetUrl: string; websiteId?: string };
  if (!body.targetUrl) return Response.json({ error: 'targetUrl is required' }, { status: 400 });

  // Validate URL
  const v = isValidPublicUrl(body.targetUrl);
  if (!v.valid || !v.normalized) {
    return Response.json({ error: `Invalid URL: ${v.reason}` }, { status: 400 });
  }
  const targetUrl = v.normalized;
  const normalized = normalizeUrl(targetUrl, { includeQueryParams: false }) ?? targetUrl;

  // Build full scan config (merging defaults)
  const config: ScanConfig = {
    targetUrl,
    maxPages: body.maxPages ?? DEFAULT_SCAN_CONFIG.maxPages!,
    maxDepth: body.maxDepth ?? DEFAULT_SCAN_CONFIG.maxDepth!,
    requestTimeoutMs: body.requestTimeoutMs ?? DEFAULT_SCAN_CONFIG.requestTimeoutMs!,
    crawlConcurrency: body.crawlConcurrency ?? DEFAULT_SCAN_CONFIG.crawlConcurrency!,
    checkExternalLinks: body.checkExternalLinks ?? DEFAULT_SCAN_CONFIG.checkExternalLinks!,
    includeSubdomains: body.includeSubdomains ?? DEFAULT_SCAN_CONFIG.includeSubdomains!,
    includeQueryParams: body.includeQueryParams ?? DEFAULT_SCAN_CONFIG.includeQueryParams!,
    respectRobotsTxt: body.respectRobotsTxt ?? DEFAULT_SCAN_CONFIG.respectRobotsTxt!,
    useSitemapAsSeed: body.useSitemapAsSeed ?? DEFAULT_SCAN_CONFIG.useSitemapAsSeed!,
    requiredProviders: body.requiredProviders ?? [],
    optionalProviders: body.optionalProviders ?? [],
    performanceStrategies: body.performanceStrategies ?? DEFAULT_SCAN_CONFIG.performanceStrategies!,
    label: body.label,
  };

  // Resolve/create the Website record
  let website = body.websiteId ? await db.website.findUnique({ where: { id: body.websiteId } }) : null;
  if (!website) {
    website = await db.website.upsert({
      where: { url: normalized },
      update: { name: body.label ?? null },
      create: { url: normalized, name: body.label ?? null },
    });
  }

  // Run pre-scan validation
  const validation = await preScanValidation(config);

  if (!validation.canStartScan) {
    return Response.json({
      error: 'Pre-scan validation failed',
      blockingReason: validation.blockingReason,
      validation: {
        requiredResults: validation.requiredResults,
        optionalResults: validation.optionalResults,
      },
    }, { status: 400 });
  }

  // Create the scan row
  const scan = await db.scan.create({
    data: {
      websiteId: website.id,
      targetUrl,
      status: 'pending',
      config: JSON.stringify(config),
      validation: JSON.stringify({
        requiredResults: validation.requiredResults,
        optionalResults: validation.optionalResults,
      }),
    },
  });

  // Run the audit in the background (Next.js will keep the process alive
  // for the route's maxDuration; for very long scans a proper job queue
  // would be needed, but for an MVP this is sufficient).
  // We use a fire-and-forget Promise with error capture.
  const { runAudit } = await import('@/lib/audit/orchestrator');
  // Fire and forget
  runAudit({ scanId: scan.id, websiteId: website.id, config })
    .catch(async (err) => {
      console.error(`[scan ${scan.id}] Audit failed:`, err);
      await db.scan.update({
        where: { id: scan.id },
        data: { status: 'failed', errorMessage: `Audit crashed: ${(err as Error).message}`, completedAt: new Date() },
      });
    });

  return Response.json({
    scanId: scan.id,
    websiteId: website.id,
    status: 'pending',
    validation: {
      requiredResults: validation.requiredResults,
      optionalResults: validation.optionalResults,
    },
    message: 'Scan started. Poll GET /api/scans/[id] for progress.',
  });
}
