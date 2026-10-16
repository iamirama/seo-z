// Dashboard data endpoint. Returns aggregate stats across all
// websites + scans for the main dashboard view.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Total websites
  const totalWebsites = await db.website.count();
  // Total scans
  const totalScans = await db.scan.count();
  // Recent scans (last 10)
  const recentScans = await db.scan.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
    include: { website: true },
  });
  // Total issues (open)
  const openIssues = await db.issue.count({ where: { status: 'open' } });
  const criticalOpen = await db.issue.count({ where: { status: 'open', severity: 'critical' } });
  const highOpen = await db.issue.count({ where: { status: 'open', severity: 'high' } });
  // Provider connection summary
  const providerConfigs = await db.providerConfig.findMany({
    select: { providerKey: true, enabled: true, lastTestResult: true, lastSuccessAt: true, displayName: true },
  });
  const providers = providerConfigs.map((p) => ({
    key: p.providerKey,
    name: p.displayName,
    enabled: p.enabled,
    lastTest: p.lastTestResult ? JSON.parse(p.lastTestResult) : null,
    lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
  }));
  // Latest score per website
  const websites = await db.website.findMany({
    include: {
      scans: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        where: { status: 'completed' },
        select: { id: true, overallScore: true, coverage: true, startedAt: true, issueCount: true, criticalCount: true, highCount: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });

  return Response.json({
    totalWebsites,
    totalScans,
    openIssues,
    criticalOpen,
    highOpen,
    recentScans: recentScans.map((s) => ({
      id: s.id,
      targetUrl: s.targetUrl,
      status: s.status,
      overallScore: s.overallScore,
      coverage: s.coverage,
      startedAt: s.startedAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
      website: { url: s.website?.url, name: s.website?.name },
      issueCount: s.issueCount,
      criticalCount: s.criticalCount,
      highCount: s.highCount,
    })),
    providers,
    websites: websites.map((w) => ({
      id: w.id,
      url: w.url,
      name: w.name,
      lastScanAt: w.lastScanAt?.toISOString() ?? null,
      lastScan: w.scans[0] ?? null,
    })),
  });
}
