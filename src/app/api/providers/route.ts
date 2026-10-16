// List all available providers with their metadata + config shape + current status.
import { getAllProviderMetadata } from '@/lib/providers/registry';
import { db } from '@/lib/db';
import { getMaskedCredentials } from '@/lib/store/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = getAllProviderMetadata();
  const hydrated = await Promise.all(
    providers.map(async (p) => {
      const row = await db.providerConfig.findUnique({ where: { providerKey: p.metadata.key } });
      return {
        metadata: p.metadata,
        configShape: p.configShape,
        capabilities: p.capabilities,
        configured: !!row,
        enabled: row?.enabled ?? false,
        maskedCredentials: row ? await getMaskedCredentials(p.metadata.key) : null,
        lastTestResult: row?.lastTestResult ? JSON.parse(row.lastTestResult) : null,
        lastTestedAt: row?.lastTestedAt?.toISOString() ?? null,
        lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
        quotaInfo: row?.quotaInfo ? JSON.parse(row.quotaInfo) : null,
      };
    }),
  );
  return Response.json({ providers: hydrated });
}
