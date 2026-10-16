'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, PlayCircle, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';
import { ConnectionStateBadge } from '@/components/audit/badges';
import type { ScanConfig, ValidationResult } from '@/lib/types';

interface ProviderInfo {
  metadata: {
    key: string;
    name: string;
    tier: string;
    authMethod: string;
    requiresCredentials: boolean;
  };
  configured: boolean;
  lastTestResult: { state: string; message: string } | null;
}

export function NewAuditSection() {
  const [targetUrl, setTargetUrl] = useState('');
  const [label, setLabel] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [maxDepth, setMaxDepth] = useState(3);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(10000);
  const [crawlConcurrency, setCrawlConcurrency] = useState(3);
  const [checkExternalLinks, setCheckExternalLinks] = useState(false);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [includeQueryParams, setIncludeQueryParams] = useState(false);
  const [respectRobotsTxt, setRespectRobotsTxt] = useState(true);
  const [useSitemapAsSeed, setUseSitemapAsSeed] = useState(true);
  const [requiredProviders, setRequiredProviders] = useState<string[]>([]);
  const [optionalProviders, setOptionalProviders] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ requiredResults: ValidationResult[]; optionalResults: ValidationResult[]; canStartScan: boolean; blockingReason?: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setActiveScanId, setActiveView } = useAppStore();

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers ?? []);
        // Auto-select free providers as optional (so user can opt out)
        const optionalDefaults = (d.providers ?? []).filter((p: ProviderInfo) => p.configured && p.metadata.tier !== 'paid').map((p: ProviderInfo) => p.metadata.key);
        setOptionalProviders(optionalDefaults);
      });
  }, []);

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    setValidation(null);
    try {
      const config: Partial<ScanConfig> = {
        targetUrl,
        maxPages,
        maxDepth,
        requestTimeoutMs,
        crawlConcurrency,
        checkExternalLinks,
        includeSubdomains,
        includeQueryParams,
        respectRobotsTxt,
        useSitemapAsSeed,
        requiredProviders,
        optionalProviders,
      };
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Validation failed');
      } else {
        setValidation(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setValidating(false);
    }
  };

  const handleStartScan = async () => {
    setStarting(true);
    setError(null);
    try {
      const config: Partial<ScanConfig> = {
        targetUrl,
        maxPages,
        maxDepth,
        requestTimeoutMs,
        crawlConcurrency,
        checkExternalLinks,
        includeSubdomains,
        includeQueryParams,
        respectRobotsTxt,
        useSitemapAsSeed,
        requiredProviders,
        optionalProviders,
        label,
      };
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to start scan');
        if (data.validation) {
          setValidation(data.validation);
        }
      } else {
        setActiveScanId(data.scanId);
        setActiveView('results');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const toggleProvider = (key: string, required: boolean) => {
    const target = required ? requiredProviders : optionalProviders;
    const other = required ? optionalProviders : requiredProviders;
    const updated = target.includes(key) ? target.filter((k) => k !== key) : [...target, key];
    const cleanedOther = other.filter((k) => k !== key);
    if (required) {
      setRequiredProviders(updated);
      setOptionalProviders(cleanedOther);
    } else {
      setOptionalProviders(updated);
      setRequiredProviders(cleanedOther);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New SEO Audit</h1>
        <p className="text-sm text-muted-foreground">Configure and run a comprehensive SEO audit on any publicly accessible website.</p>
      </div>

      {/* Target URL */}
      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
          <CardDescription>Enter the URL to audit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              placeholder="https://example.com/"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must be a publicly accessible http(s) URL. Private/internal IPs and metadata endpoints are blocked (SSRF protection).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input id="label" placeholder="Production homepage" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Crawl configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Crawl configuration</CardTitle>
          <CardDescription>Tune the crawler behavior. Defaults are sensible for most sites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max pages: {maxPages}</Label>
              <Slider value={[maxPages]} min={1} max={500} step={1} onValueChange={(v) => setMaxPages(v[0])} />
              <p className="text-xs text-muted-foreground">Hard limit on pages crawled per scan.</p>
            </div>
            <div className="space-y-2">
              <Label>Max depth: {maxDepth}</Label>
              <Slider value={[maxDepth]} min={1} max={10} step={1} onValueChange={(v) => setMaxDepth(v[0])} />
              <p className="text-xs text-muted-foreground">Number of link hops from the start URL.</p>
            </div>
            <div className="space-y-2">
              <Label>Request timeout: {(requestTimeoutMs / 1000).toFixed(1)}s</Label>
              <Slider value={[requestTimeoutMs]} min={3000} max={30000} step={1000} onValueChange={(v) => setRequestTimeoutMs(v[0])} />
            </div>
            <div className="space-y-2">
              <Label>Concurrency: {crawlConcurrency}</Label>
              <Slider value={[crawlConcurrency]} min={1} max={10} step={1} onValueChange={(v) => setCrawlConcurrency(v[0])} />
              <p className="text-xs text-muted-foreground">Parallel HTTP requests. Higher = faster but more server load.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer" htmlFor="robots">Respect robots.txt</Label>
                <p className="text-xs text-muted-foreground">Honor crawl directives</p>
              </div>
              <Switch id="robots" checked={respectRobotsTxt} onCheckedChange={setRespectRobotsTxt} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer" htmlFor="sitemap">Use sitemap as seed</Label>
                <p className="text-xs text-muted-foreground">Fetch /sitemap.xml</p>
              </div>
              <Switch id="sitemap" checked={useSitemapAsSeed} onCheckedChange={setUseSitemapAsSeed} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer" htmlFor="sub">Include subdomains</Label>
                <p className="text-xs text-muted-foreground">Crawl *.example.com</p>
              </div>
              <Switch id="sub" checked={includeSubdomains} onCheckedChange={setIncludeSubdomains} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer" htmlFor="qparams">Include query params</Label>
                <p className="text-xs text-muted-foreground">Distinct URLs per ?param</p>
              </div>
              <Switch id="qparams" checked={includeQueryParams} onCheckedChange={setIncludeQueryParams} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="cursor-pointer" htmlFor="ext">Check external links</Label>
                <p className="text-xs text-muted-foreground">Record (don't crawl) outbound</p>
              </div>
              <Switch id="ext" checked={checkExternalLinks} onCheckedChange={setCheckExternalLinks} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider selection */}
      <Card>
        <CardHeader>
          <CardTitle>Data providers</CardTitle>
          <CardDescription>
            Select which providers to require (block scan if they fail validation) or use optionally (best-effort).
            The internal crawler always runs — even with no providers selected (free-first mode).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No providers registered.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 text-xs font-medium text-muted-foreground px-2">
                <div>Provider</div>
                <div className="text-center">Required</div>
                <div className="text-center">Optional</div>
                <div className="text-center">Status</div>
              </div>
              {providers.map((p) => {
                const isReq = requiredProviders.includes(p.metadata.key);
                const isOpt = optionalProviders.includes(p.metadata.key);
                const tierLabel = p.metadata.tier.replace(/_/g, ' ');
                return (
                  <div key={p.metadata.key} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center rounded-md border p-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.metadata.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {tierLabel} · {p.metadata.authMethod}
                        {!p.configured && ' · not configured'}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Checkbox checked={isReq} onCheckedChange={() => toggleProvider(p.metadata.key, true)} disabled={!p.configured} />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox checked={isOpt} onCheckedChange={() => toggleProvider(p.metadata.key, false)} disabled={!p.configured} />
                    </div>
                    <div className="flex justify-center">
                      {p.lastTestResult ? (
                        <ConnectionStateBadge state={p.lastTestResult.state as any} />
                      ) : (
                        <Badge variant="secondary">N/A</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validate + start */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-scan validation</CardTitle>
          <CardDescription>
            Per spec: required providers MUST pass validation before the scan starts. Optional providers fail gracefully without blocking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button onClick={handleValidate} disabled={!targetUrl || validating} variant="outline">
              {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Validate providers
            </Button>
            <Button onClick={handleStartScan} disabled={!targetUrl || starting} className="flex-1">
              {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Start SEO Audit
            </Button>
          </div>

          {validation && (
            <div className="space-y-3">
              {validation.blockingReason && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Scan blocked</AlertTitle>
                  <AlertDescription>{validation.blockingReason}</AlertDescription>
                </Alert>
              )}
              {validation.canStartScan && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready to scan</AlertTitle>
                  <AlertDescription>All required providers passed validation. You can start the audit.</AlertDescription>
                </Alert>
              )}
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Provider</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">State</th>
                      <th className="text-left p-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.requiredResults.map((r) => (
                      <tr key={`req-${r.providerKey}`} className="border-t border-border">
                        <td className="p-2 font-medium">{r.providerKey}</td>
                        <td className="p-2"><Badge variant="destructive">Required</Badge></td>
                        <td className="p-2"><ConnectionStateBadge state={r.state} /></td>
                        <td className="p-2 text-xs">{r.message}</td>
                      </tr>
                    ))}
                    {validation.optionalResults.map((r) => (
                      <tr key={`opt-${r.providerKey}`} className="border-t border-border">
                        <td className="p-2 font-medium">{r.providerKey}</td>
                        <td className="p-2"><Badge variant="secondary">Optional</Badge></td>
                        <td className="p-2"><ConnectionStateBadge state={r.state} /></td>
                        <td className="p-2 text-xs">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
