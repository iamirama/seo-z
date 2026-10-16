// Compare two scans of the same website.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scanA = url.searchParams.get('a');
  const scanB = url.searchParams.get('b');
  if (!scanA || !scanB) {
    return Response.json({ error: 'Both ?a=<scanId> and ?b=<scanId> are required' }, { status: 400 });
  }

  const [scan1, scan2] = await Promise.all([
    db.scan.findUnique({ where: { id: scanA }, include: { website: true } }),
    db.scan.findUnique({ where: { id: scanB }, include: { website: true } }),
  ]);
  if (!scan1 || !scan2) {
    return Response.json({ error: 'One or both scans not found' }, { status: 404 });
  }
  if (scan1.websiteId !== scan2.websiteId) {
    return Response.json({ error: 'Cannot compare scans from different websites' }, { status: 400 });
  }

  // Load issues from both scans, keyed by title+affectedUrl
  const [issues1, issues2] = await Promise.all([
    db.issue.findMany({ where: { scanId: scan1.id } }),
    db.issue.findMany({ where: { scanId: scan2.id } }),
  ]);

  const keyOf = (i: { title: string; affectedUrl: string | null }) => `${i.title}|${i.affectedUrl ?? ''}`;
  const map1 = new Map(issues1.map((i) => [keyOf(i), i]));
  const map2 = new Map(issues2.map((i) => [keyOf(i), i]));

  const allKeys = new Set<string>([...map1.keys(), ...map2.keys()]);
  const newlyDiscovered: any[] = [];
  const resolved: any[] = [];
  const persistent: any[] = [];

  for (const k of allKeys) {
    const inA = map1.get(k);
    const inB = map2.get(k);
    if (!inA && inB) {
      newlyDiscovered.push(inB);
    } else if (inA && !inB) {
      resolved.push(inA);
    } else if (inA && inB) {
      persistent.push({ before: inA, after: inB });
    }
  }

  return Response.json({
    scan1: { id: scan1.id, startedAt: scan1.startedAt, overallScore: scan1.overallScore, coverage: scan1.coverage },
    scan2: { id: scan2.id, startedAt: scan2.startedAt, overallScore: scan2.overallScore, coverage: scan2.coverage },
    scoreChange: (scan2.overallScore ?? 0) - (scan1.overallScore ?? 0),
    coverageChange: (scan2.coverage ?? 0) - (scan1.coverage ?? 0),
    newlyDiscovered,
    resolved,
    persistent,
    summary: {
      newCount: newlyDiscovered.length,
      resolvedCount: resolved.length,
      persistentCount: persistent.length,
    },
  });
}
