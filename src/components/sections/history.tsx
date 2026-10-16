'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, History, ArrowLeft, GitCompare } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';
import { scoreColorClass } from '@/components/audit/badges';

interface ScanListItem {
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
}

export function HistorySection() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const { setActiveScanId, setActiveView } = useAppStore();

  useEffect(() => {
    fetch('/api/scans?limit=100')
      .then((r) => r.json())
      .then((d) => setScans(d.scans ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openScan = (id: string) => {
    setActiveScanId(id);
    setActiveView('results');
  };

  const handleCompare = async () => {
    if (!selectedA || !selectedB) return;
    setCompareLoading(true);
    setCompareResult(null);
    try {
      const res = await fetch(`/api/scans/compare?a=${selectedA}&b=${selectedB}`);
      const data = await res.json();
      if (!res.ok) {
        setCompareResult({ error: data.error || 'Comparison failed' });
      } else {
        setCompareResult(data);
      }
    } catch (err) {
      setCompareResult({ error: (err as Error).message });
    } finally {
      setCompareLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedA === id) setSelectedA(null);
    else if (selectedB === id) setSelectedB(null);
    else if (!selectedA) setSelectedA(id);
    else if (!selectedB) setSelectedB(id);
    else setSelectedB(id); // Replace B if both already set
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scan History</h1>
          <p className="text-sm text-muted-foreground">All past scans. Click to view details, or compare two scans.</p>
        </div>
        <Button variant={compareMode ? 'default' : 'outline'} onClick={() => { setCompareMode(!compareMode); setSelectedA(null); setSelectedB(null); setCompareResult(null); }}>
          <GitCompare className="h-4 w-4 mr-1" />
          {compareMode ? 'Exit compare' : 'Compare scans'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : scans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No scans yet.</p>
            <Button className="mt-3" onClick={() => setActiveView('new-audit')}>Start your first audit</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{scans.length} scans</CardTitle>
            {compareMode && (
              <CardDescription>
                Select two scans to compare. Selected: {selectedA ? '1' : '0'} of 2 (first), {selectedB ? '1' : '0'} of 2 (second).
                {selectedA && selectedB && <Button size="sm" className="ml-2" onClick={handleCompare} disabled={compareLoading}>Compare</Button>}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scans.map((scan) => {
                const isSelA = selectedA === scan.id;
                const isSelB = selectedB === scan.id;
                return (
                  <button
                    key={scan.id}
                    onClick={() => compareMode ? toggleSelect(scan.id) : openScan(scan.id)}
                    className={`w-full text-left p-3 rounded-md border transition-colors flex items-center gap-3 ${
                      isSelA ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' :
                      isSelB ? 'border-green-500 bg-green-50 dark:bg-green-950/30' :
                      'border-border hover:bg-accent'
                    }`}
                  >
                    <div className={`text-2xl font-bold ${scan.overallScore !== null ? scoreColorClass(scan.overallScore) : 'text-muted-foreground'}`}>
                      {scan.overallScore ?? '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{scan.targetUrl}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(scan.startedAt).toLocaleString()}
                        {scan.coverage != null && ` · ${scan.coverage}% coverage`}
                        {scan.issueCount > 0 && ` · ${scan.issueCount} issues`}
                      </div>
                    </div>
                    {compareMode && (
                      <Badge variant={isSelA ? 'default' : isSelB ? 'secondary' : 'outline'}>
                        {isSelA ? 'A' : isSelB ? 'B' : '—'}
                      </Badge>
                    )}
                    <Badge variant={scan.status === 'completed' ? 'default' : scan.status === 'failed' ? 'destructive' : 'secondary'}>
                      {scan.status}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {compareLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {compareResult && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison results</CardTitle>
            <CardDescription>Differences between the two scans.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {compareResult.error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Comparison failed</AlertTitle>
                <AlertDescription>{compareResult.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="border border-border rounded p-3">
                    <div className="text-xs text-muted-foreground">Scan A</div>
                    <div className="text-sm font-mono">{new Date(compareResult.scan1.startedAt).toLocaleString()}</div>
                    <div className="text-2xl font-bold mt-1">Score: {compareResult.scan1.overallScore ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Coverage: {compareResult.scan1.coverage ?? '—'}%</div>
                  </div>
                  <div className="border border-border rounded p-3">
                    <div className="text-xs text-muted-foreground">Scan B (later)</div>
                    <div className="text-sm font-mono">{new Date(compareResult.scan2.startedAt).toLocaleString()}</div>
                    <div className="text-2xl font-bold mt-1">Score: {compareResult.scan2.overallScore ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">Coverage: {compareResult.scan2.coverage ?? '—'}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="border border-border rounded p-3">
                    <div className={`text-3xl font-bold ${(compareResult.scoreChange ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {compareResult.scoreChange >= 0 ? '+' : ''}{compareResult.scoreChange}
                    </div>
                    <div className="text-xs text-muted-foreground">Score change</div>
                  </div>
                  <div className="border border-border rounded p-3">
                    <div className="text-3xl font-bold">{compareResult.summary.newCount}</div>
                    <div className="text-xs text-muted-foreground">New issues</div>
                  </div>
                  <div className="border border-border rounded p-3">
                    <div className="text-3xl font-bold text-green-600">{compareResult.summary.resolvedCount}</div>
                    <div className="text-xs text-muted-foreground">Resolved</div>
                  </div>
                </div>
                {compareResult.summary.persistentCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {compareResult.summary.persistentCount} persistent issue(s) found in both scans.
                  </p>
                )}
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Comparison is keyed on issue title + affected URL. Provider availability changes between scans can affect counts — an issue may appear "resolved" simply because a provider stopped reporting it. Review the Scan Limitations section in each scan for context.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
