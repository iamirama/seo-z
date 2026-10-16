// Save / update / delete provider credentials.
import { saveProviderConfig, deleteProviderConfig } from '@/lib/store/providers';
import { getProvider } from '@/lib/providers/registry';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name: providerKey } = await params;
  const provider = getProvider(providerKey);
  if (!provider) {
    return Response.json({ error: `Unknown provider: ${providerKey}` }, { status: 404 });
  }
  const body = await req.json() as { credentials?: Record<string, unknown> };
  if (!body.credentials || typeof body.credentials !== 'object') {
    return Response.json({ error: 'credentials object is required' }, { status: 400 });
  }
  // Static validation: required fields present?
  const validation = provider.validateConfiguration(body.credentials);
  if (!validation.valid) {
    return Response.json({
      error: 'Configuration validation failed',
      missingFields: validation.missingFields,
      invalidFields: validation.invalidFields,
    }, { status: 400 });
  }
  try {
    await saveProviderConfig(providerKey, body.credentials);
    return Response.json({ success: true, message: 'Configuration saved. Use Test Connection to verify live connectivity.' });
  } catch (err) {
    return Response.json({ error: `Failed to save configuration: ${(err as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name: providerKey } = await params;
  const provider = getProvider(providerKey);
  if (!provider) {
    return Response.json({ error: `Unknown provider: ${providerKey}` }, { status: 404 });
  }
  try {
    await deleteProviderConfig(providerKey);
    return Response.json({ success: true, message: 'Configuration removed.' });
  } catch (err) {
    return Response.json({ error: `Failed to remove configuration: ${(err as Error).message}` }, { status: 500 });
  }
}
