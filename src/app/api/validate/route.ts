// Pre-scan validation endpoint. Validates the configured providers
// against a proposed scan config WITHOUT starting the scan.
import { preScanValidation } from '@/lib/audit/orchestrator';
import { isValidPublicUrl } from '@/lib/security/ssrf';
import type { ScanConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json() as Partial<ScanConfig> & { targetUrl: string };
  if (!body.targetUrl) return Response.json({ error: 'targetUrl is required' }, { status: 400 });
  const v = isValidPublicUrl(body.targetUrl);
  if (!v.valid || !v.normalized) {
    return Response.json({ error: `Invalid URL: ${v.reason}` }, { status: 400 });
  }
  const config: ScanConfig = {
    targetUrl: v.normalized,
    maxPages: body.maxPages ?? 50,
    maxDepth: body.maxDepth ?? 3,
    requestTimeoutMs: body.requestTimeoutMs ?? 10000,
    crawlConcurrency: body.crawlConcurrency ?? 3,
    checkExternalLinks: body.checkExternalLinks ?? false,
    includeSubdomains: body.includeSubdomains ?? false,
    includeQueryParams: body.includeQueryParams ?? false,
    respectRobotsTxt: body.respectRobotsTxt ?? true,
    useSitemapAsSeed: body.useSitemapAsSeed ?? true,
    requiredProviders: body.requiredProviders ?? [],
    optionalProviders: body.optionalProviders ?? [],
    performanceStrategies: body.performanceStrategies ?? ['mobile', 'desktop'],
  };

  const validation = await preScanValidation(config);
  return Response.json({
    canStartScan: validation.canStartScan,
    blockingReason: validation.blockingReason,
    requiredResults: validation.requiredResults,
    optionalResults: validation.optionalResults,
  });
}
