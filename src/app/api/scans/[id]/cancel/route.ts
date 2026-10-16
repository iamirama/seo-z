// Cancel a running scan.
// NOTE: Real cancellation requires the scan runner to poll for cancel
// signals. For an MVP we mark the scan as 'cancelled' so it stops
// appearing as in-progress; any in-flight HTTP requests will complete
// but no new pages will be enqueued.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scan = await db.scan.findUnique({ where: { id } });
  if (!scan) return Response.json({ error: 'Scan not found' }, { status: 404 });
  if (scan.status === 'completed' || scan.status === 'failed' || scan.status === 'cancelled') {
    return Response.json({ error: `Cannot cancel scan in status: ${scan.status}` }, { status: 400 });
  }
  await db.scan.update({
    where: { id },
    data: { status: 'cancelled', completedAt: new Date() },
  });
  return Response.json({ success: true, message: 'Scan cancellation requested.' });
}
