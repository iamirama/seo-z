// List websites (CRUD: GET = list, POST = create).
import { db } from '@/lib/db';
import { isValidPublicUrl, normalizeUrl } from '@/lib/security/ssrf';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sites = await db.website.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      scans: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { id: true, status: true, overallScore: true, startedAt: true, completedAt: true, issueCount: true, criticalCount: true, highCount: true },
      },
    },
  });
  return Response.json({ websites: sites });
}

export async function POST(req: Request) {
  const body = await req.json() as { url: string; name?: string };
  if (!body.url) return Response.json({ error: 'URL is required' }, { status: 400 });
  const v = isValidPublicUrl(body.url);
  if (!v.valid || !v.normalized) {
    return Response.json({ error: `Invalid URL: ${v.reason}` }, { status: 400 });
  }
  const normalized = normalizeUrl(v.normalized, { includeQueryParams: false }) ?? v.normalized;
  const existing = await db.website.findUnique({ where: { url: normalized } });
  if (existing) {
    // Update name if provided
    if (body.name && body.name !== existing.name) {
      const updated = await db.website.update({ where: { id: existing.id }, data: { name: body.name } });
      return Response.json({ website: updated });
    }
    return Response.json({ website: existing });
  }
  const website = await db.website.create({
    data: { url: normalized, name: body.name ?? null },
  });
  return Response.json({ website });
}
