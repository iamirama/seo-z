// Quick check: how many unique issue titles vs total issues?
import { db } from '@/lib/db';

async function main() {
  const scans = await db.scan.findMany({
    where: { targetUrl: { contains: 'iana.org' } },
    orderBy: { startedAt: 'desc' },
    take: 1,
  });
  if (scans.length === 0) {
    console.log('No iana scan found');
    return;
  }
  const scan = scans[0];
  console.log(`Latest iana scan: ${scan.id} (started ${scan.startedAt.toISOString()})`);
  console.log(`Overall score: ${scan.overallScore}, coverage: ${scan.coverage}`);
  console.log(`Issues: ${scan.issueCount}, critical=${scan.criticalCount}, high=${scan.highCount}, medium=${scan.mediumCount}, low=${scan.lowCount}, info=${scan.informationalCount}`);

  // Count unique titles
  const issues = await db.issue.findMany({ where: { scanId: scan.id } });
  const uniqueTitles = new Set(issues.map((i) => i.title));
  console.log(`\nTotal issues: ${issues.length}, unique titles: ${uniqueTitles.size}`);
  console.log(`\nTop 10 issue titles by count:`);

  const counts = new Map<string, number>();
  for (const i of issues) {
    counts.set(i.title, (counts.get(i.title) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [title, count] of sorted.slice(0, 10)) {
    console.log(`  [${count}] ${title.slice(0, 100)}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
