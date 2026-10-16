// Get scan details by ID.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await db.scan.findUnique({
    where: { id },
    include: { website: true },
  });
  if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });

  // Load related data (paginated for large scans)
  const issues = await db.issue.findMany({
    where: { scanId: id },
    orderBy: [{ severity: 'asc' }, { priority: 'desc' }],
  });

  const pagesCount = await db.scanPage.count({ where: { scanId: id } });
  const backlinksCount = await db.backlinkRecord.count({ where: { scanId: id } });
  const keywordsCount = await db.keywordRecord.count({ where: { scanId: id } });
  const perfMetricsCount = await db.performanceMetric.count({ where: { scanId: id } });

  // Parse summary JSON
  const summary = scan.summary ? JSON.parse(scan.summary) : null;
  const categoryScores = scan.categoryScores ? JSON.parse(scan.categoryScores) : null;
  const validation = scan.validation ? JSON.parse(scan.validation) : null;
  const providersSnapshot = scan.providersSnapshot ? JSON.parse(scan.providersSnapshot) : null;

  // Parse issue JSON fields (evidence, steps)
  const parsedIssues = issues.map((i) => ({
    ...i,
    evidence: i.evidence ? JSON.parse(i.evidence) : [],
    steps: i.steps ? JSON.parse(i.steps) : [],
  }));

  return Response.json({
    scan: {
      ...scan,
      summary,
      categoryScores,
      validation,
      providersSnapshot,
    },
    issues: parsedIssues,
    counts: {
      pages: pagesCount,
      backlinks: backlinksCount,
      keywords: keywordsCount,
      performanceMetrics: perfMetricsCount,
      issues: issues.length,
    },
  });
}
