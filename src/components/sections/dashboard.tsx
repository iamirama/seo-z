'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Database, Globe, Loader2, TrendingUp } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';
import { scoreColorClass } from '@/components/audit/badges';
import Link from 'next/link';

interface DashboardData {
  totalWebsites: number;
  totalScans: number;
  openIssues: number;
  criticalOpen: number;
  highOpen: number;
  recentScans: Array<{
    id: string;
    targetUrl: string;
    status: string;
    overallScore: number | null;
    coverage: number | null;
    startedAt: string;
    completedAt: string | null;
    website: { url: string; name: string | null };
    issueCount: number;
    criticalCount: number;
    highCount: number;
  }>;
  providers: Array<{
    key: string;
    name: string;
    enabled: boolean;
    lastTest: any;
    lastSuccessAt: string | null;
  }>;
  websites: Array<{
    id: string;
    url: string;
    name: string | null;
    lastScanAt: string | null;
    lastScan: any;
  }>;
}

export function DashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { setActiveView, setActiveScanId } = useAppStore();

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground">Failed to load dashboard.</p>;
  }

  const openScan = (scanId: string) => {
    setActiveScanId(scanId);
    setActiveView('results');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">SEO audit overview across all your websites.</p>
      </div>

      {/* Top-level scorecards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Websites</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalWebsites}</div>
            <p className="text-xs text-muted-foreground">Audited sites</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total scans</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalScans}</div>
            <p className="text-xs text-muted-foreground">All-time scans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.openIssues}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 font-medium">{data.criticalOpen} critical</span>
              {' · '}
              <span className="text-orange-600 font-medium">{data.highOpen} high</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected providers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.providers.filter((p) => p.enabled).length}</div>
            <p className="text-xs text-muted-foreground">Of {data.providers.length} supported</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent scans */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent scans</CardTitle>
            <CardDescription>Click a scan to view detailed findings.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentScans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">No scans yet. Start your first audit.</p>
                <Button onClick={() => setActiveView('new-audit')}>
                  Start New Audit <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recentScans.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => openScan(scan.id)}
                    className="w-full text-left p-3 rounded-md border border-border hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <div className={`text-2xl font-bold ${scan.overallScore !== null ? scoreColorClass(scan.overallScore) : 'text-muted-foreground'}`}>
                      {scan.overallScore ?? '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{scan.targetUrl}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {new Date(scan.startedAt).toLocaleString()}
                        {scan.issueCount > 0 && <span>· {scan.issueCount} issues</span>}
                      </div>
                    </div>
                    <Badge variant={scan.status === 'completed' ? 'default' : scan.status === 'failed' ? 'destructive' : 'secondary'}>
                      {scan.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Provider connection health */}
        <Card>
          <CardHeader>
            <CardTitle>Provider health</CardTitle>
            <CardDescription>Connected data sources.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No providers configured.</p>
              ) : (
                data.providers.map((p) => {
                  const state = p.lastTest?.state ?? 'not_configured';
                  const stateLabel = state.replace(/_/g, ' ');
                  const stateClass = state === 'connected'
                    ? 'text-green-600'
                    : state === 'connected_with_limitations'
                    ? 'text-amber-600'
                    : state === 'not_configured'
                    ? 'text-gray-500'
                    : 'text-red-600';
                  return (
                    <div key={p.key} className="flex items-center justify-between text-sm border-b border-border pb-2">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.lastSuccessAt && (
                          <div className="text-xs text-muted-foreground">
                            Last OK: {new Date(p.lastSuccessAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${stateClass}`}>{stateLabel}</span>
                    </div>
                  );
                })
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setActiveView('api-settings')}>
                Configure providers <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Websites list */}
      <Card>
        <CardHeader>
          <CardTitle>Websites</CardTitle>
          <CardDescription>Sites you've audited.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.websites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No websites yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.websites.map((w) => (
                <div key={w.id} className="border border-border rounded-md p-3">
                  <div className="font-medium truncate">{w.name || w.url}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.url}</div>
                  {w.lastScan && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xl font-bold ${scoreColorClass(w.lastScan.overallScore)}`}>
                        {w.lastScan.overallScore}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {w.lastScan.issueCount} issues
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground border-t border-border pt-4">
        <p>
          <TrendingUp className="inline h-3 w-3 mr-1" />
          SEO scores are application-generated diagnostics, not official Google ranking scores. Use them to track improvements over time, not to benchmark against other sites.
        </p>
      </div>
    </div>
  );
}
