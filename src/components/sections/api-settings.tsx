'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ExternalLink, Plug, Save, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ConnectionStateBadge } from '@/components/audit/badges';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

interface ProviderInfo {
  metadata: {
    key: string;
    name: string;
    description: string;
    website: string;
    apiDocs: string;
    pricingUrl: string;
    tier: string;
    authMethod: string;
    requiresCredentials: boolean;
    capabilities: Record<string, boolean>;
    limitations?: string;
  };
  configShape: { fields: ProviderField[]; authMethod: string };
  capabilities: Record<string, boolean>;
  configured: boolean;
  enabled: boolean;
  maskedCredentials: Record<string, string> | null;
  lastTestResult: { state: string; message: string } | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  quotaInfo: any;
}

export function ApiSettingsSection() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load of providers list
  useEffect(() => {
    let cancelled = false;
    fetch('/api/providers')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProviders(d.providers ?? []); })
      .catch(() => { if (!cancelled) setProviders([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const load = () => {
    setLoading(true);
    fetch('/api/providers')
      .then((r) => r.json())
      .then((d) => setProviders(d.providers ?? []))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API &amp; Service Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure SEO data providers. Credentials are encrypted (AES-256-GCM) on the backend and never exposed to the browser.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Security notice</AlertTitle>
        <AlertDescription className="text-xs">
          API keys are stored encrypted in the database. They are decrypted only at the moment of use, server-side, for outbound API requests. They are never returned in API responses, error messages, logs, or downloadable reports.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => (
            <ProviderCard key={p.metadata.key} provider={p} onChanged={load} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Provider capability matrix</CardTitle>
          <CardDescription>Which categories each provider can supply data for.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-border p-2 text-left">Provider</th>
                  <th className="border border-border p-2">Tech</th>
                  <th className="border border-border p-2">On-Page</th>
                  <th className="border border-border p-2">Content</th>
                  <th className="border border-border p-2">Perf</th>
                  <th className="border border-border p-2">Backlinks</th>
                  <th className="border border-border p-2">Keywords</th>
                  <th className="border border-border p-2">Local</th>
                  <th className="border border-border p-2">Tier</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.metadata.key}>
                    <td className="border border-border p-2 font-medium">{p.metadata.name}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.technical ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.onpage ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.content ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.performance ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.backlinks ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.keywords ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.capabilities.localseo ? '✓' : '—'}</td>
                    <td className="border border-border p-2 text-center">{p.metadata.tier.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}

function ProviderCard({ provider, onChanged }: { provider: ProviderInfo; onChanged: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initialize form with masked credentials (for "edit" hint)
  useEffect(() => {
    if (provider.maskedCredentials) {
      const init: Record<string, string> = {};
      for (const [k, v] of Object.entries(provider.maskedCredentials)) {
        // Leave masked values in the form; user can type a new value to overwrite
        init[k] = v;
      }
      setValues(init);
    } else {
      // Set defaults for select fields
      const init: Record<string, string> = {};
      for (const f of provider.configShape.fields) {
        if (f.defaultValue) init[f.key] = f.defaultValue;
      }
      setValues(init);
    }
  }, [provider.metadata.key, provider.maskedCredentials]);

  const handleSave = async () => {
    setSaving(true);
    // Check required fields
    const missing: string[] = [];
    const creds: Record<string, unknown> = {};
    for (const f of provider.configShape.fields) {
      const v = values[f.key];
      if (f.required && !v) {
        missing.push(f.label);
        continue;
      }
      // Skip placeholder-masked values — don't send them
      if (v && v.includes('•••')) continue;
      if (v) creds[f.key] = v;
    }
    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(', ')}`);
      setSaving(false);
      return;
    }
    if (Object.keys(creds).length === 0 && provider.configured) {
      toast.info('No changes to save.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`/api/providers/${provider.metadata.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials: creds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save');
      } else {
        toast.success('Configuration saved. Use Test Connection to verify live connectivity.');
        onChanged();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch(`/api/providers/${provider.metadata.key}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Test failed');
      } else {
        const state = data.result.state;
        if (state === 'connected') {
          toast.success(data.result.message);
        } else if (state === 'connected_with_limitations') {
          toast.warning(data.result.message);
        } else {
          toast.error(data.result.message);
        }
        onChanged();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove all credentials for ${provider.metadata.name}?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/providers/${provider.metadata.key}`, { method: 'DELETE' });
      toast.success('Configuration removed.');
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {provider.metadata.name}
              {provider.metadata.tier === 'paid' && <Badge variant="destructive">Paid</Badge>}
              {provider.metadata.tier === 'free_tier_limited' && <Badge variant="secondary">Free tier</Badge>}
              {provider.metadata.tier === 'free' && <Badge className="bg-green-100 text-green-700">Free</Badge>}
              {provider.metadata.tier === 'oauth_required' && <Badge variant="outline">OAuth</Badge>}
              {provider.metadata.tier === 'no_api' && <Badge variant="secondary">No API</Badge>}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">{provider.metadata.description}</CardDescription>
          </div>
          {provider.lastTestResult && <ConnectionStateBadge state={provider.lastTestResult.state as any} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Links */}
        <div className="flex gap-3 text-xs">
          <a href={provider.metadata.website} target="_blank" rel="noopener" className="text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Website
          </a>
          <a href={provider.metadata.apiDocs} target="_blank" rel="noopener" className="text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> API docs
          </a>
          <a href={provider.metadata.pricingUrl} target="_blank" rel="noopener" className="text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Pricing
          </a>
        </div>

        {/* Limitations */}
        {provider.metadata.limitations && (
          <p className="text-xs text-muted-foreground italic">{provider.metadata.limitations}</p>
        )}

        {/* Last test result */}
        {provider.lastTestResult && (
          <div className="text-xs p-2 bg-muted/30 rounded">
            <div><strong>Last test:</strong> {provider.lastTestResult.message}</div>
            {provider.lastTestedAt && <div className="text-muted-foreground">Tested: {new Date(provider.lastTestedAt).toLocaleString()}</div>}
            {provider.lastSuccessAt && <div className="text-muted-foreground">Last success: {new Date(provider.lastSuccessAt).toLocaleString()}</div>}
            {provider.quotaInfo && <div className="text-muted-foreground">Quota: {JSON.stringify(provider.quotaInfo)}</div>}
          </div>
        )}

        {/* Form */}
        {!provider.metadata.requiresCredentials ? (
          <p className="text-xs text-muted-foreground">No credentials required.</p>
        ) : (
          <div className="space-y-3">
            {provider.configShape.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={`${provider.metadata.key}-${f.key}`} className="text-xs">
                  {f.label} {f.required && <span className="text-red-600">*</span>}
                </Label>
                {f.type === 'select' ? (
                  <select
                    id={`${provider.metadata.key}-${f.key}`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={values[f.key] ?? f.defaultValue ?? ''}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  >
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input
                    id={`${provider.metadata.key}-${f.key}`}
                    type={f.type === 'password' ? 'password' : f.type === 'url' ? 'url' : 'text'}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="text-sm"
                  />
                )}
                {f.helpText && <p className="text-[10px] text-muted-foreground">{f.helpText}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {provider.metadata.requiresCredentials && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !provider.configured}>
            {testing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plug className="h-3 w-3 mr-1" />}
            Test
          </Button>
          {provider.configured && (
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
