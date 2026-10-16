'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, RotateCw, FileText, Clock, ArrowLeft } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';
import { SeverityBadge, ConnectionStateBadge, scoreColorClass } from '@/components/audit/badges';
import type { AuditCategory, IssueFinding, Severity } from '@/lib/types';

interface ScanDetail {
  scan: any;
  issues: IssueFinding[];
  counts: { pages: number; backlinks: number; keywords: number; performanceMetrics: number; issues: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical SEO',
  onpage: 'On-Page SEO',
  content: 'Content Analysis',
  performance: 'Performance & Core Web Vitals',
  backlinks: 'Backlink Analysis',
  keywords: 'Keyword & Search Visibility',
  localseo: 'Local SEO',
};

export function ResultsSection() {
  const { activeScanId, setActiveView } = useAppStore();
  const [data, setData] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScan = useCallback(() => {
    if (!activeScanId) {
      setActiveView('new-audit');
      return;
    }
    fetch(`/api/scans/${activeScanId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeScanId, setActiveView]);

  useEffect(() => { loadScan(); }, [loadScan]);

  if (!activeScanId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No scan selected.</p>
        <Button onClick={() => setActiveView('new-audit')}>Start a new audit</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load scan</AlertTitle>
        <AlertDescription>{error || 'Unknown error'}</AlertDescription>
      </Alert>
    );
  }

  const { scan, issues, counts } = data;
  const summary = scan.summary || {};

  // Group issues by category
  const issuesByCategory: Record<string, IssueFinding[]> = {};
  for (const i of issues) {
    if (!issuesByCategory[i.category]) issuesByCategory[i.category] = [];
    issuesByCategory[i.category].push(i);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveView('dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="ghost" size="sm" onClick={loadScan}>
          <RotateCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveView('reports')}>
          <FileText className="h-4 w-4 mr-1" /> Report
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Audit Results</h1>
        <p className="text-sm text-muted-foreground truncate">{scan.targetUrl}</p>
      </div>

      {/* Status banner */}
      {scan.status !== 'completed' && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Scan status: {scan.status}</AlertTitle>
          <AlertDescription>
            {scan.status === 'running' && 'Scan in progress. Refresh to see updated results.'}
            {scan.status === 'pending' && 'Scan starting. Please wait...'}
            {scan.status === 'failed' && `Scan failed: ${scan.errorMessage ?? 'Unknown error'}`}
            {scan.status === 'cancelled' && 'Scan was cancelled.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Score summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overall SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${scoreColorClass(scan.overallScore ?? 0)}`}>{scan.overallScore ?? '—'}</div>
            <p className="text-xs text-muted-foreground">/ 100</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Data coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold ${scoreColorClass(scan.coverage ?? 0)}`}>{scan.coverage ?? 0}%</div>
            <p className="text-xs text-muted-foreground">of expected categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pages crawled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{scan.pagesCrawled}</div>
            <p className="text-xs text-muted-foreground">of {scan.pagesDiscovered} discovered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Issues found</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{scan.issueCount}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">{scan.criticalCount} critical</span>
              {' · '}
              <span className="text-orange-600">{scan.highCount} high</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category scores */}
      {scan.categoryScores && (
        <Card>
          <CardHeader>
            <CardTitle>Category scores</CardTitle>
            <CardDescription>Breakdown by audit category. Categories without data are excluded from the overall score.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(scan.categoryScores).map(([cat, score]) => (
                <div key={cat} className="text-center p-2 border border-border rounded">
                  <div className={`text-2xl font-bold ${scoreColorClass(score as number)}`}>{score as number}</div>
                  <div className="text-xs text-muted-foreground capitalize">{cat}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings by category */}
      <Tabs defaultValue="critical">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="critical">Critical ({scan.criticalCount})</TabsTrigger>
          <TabsTrigger value="high">High ({scan.highCount})</TabsTrigger>
          <TabsTrigger value="medium">Medium ({scan.mediumCount})</TabsTrigger>
          <TabsTrigger value="low">Low ({scan.lowCount})</TabsTrigger>
          <TabsTrigger value="informational">Info ({scan.informationalCount})</TabsTrigger>
          <TabsTrigger value="all">All ({issues.length})</TabsTrigger>
        </TabsList>

        {(['critical', 'high', 'medium', 'low', 'informational', 'all'] as (string | 'all')[]).map((sev) => {
          const filtered = sev === 'all' ? issues : issues.filter((i) => i.severity === sev);
          return (
            <TabsContent key={sev} value={sev} className="mt-4">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No {sev === 'all' ? '' : sev + ' '}issues found.</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((issue, i) => (
                    <IssueCard key={i} issue={issue} />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Provider snapshot */}
      {scan.validation && (
        <Card>
          <CardHeader>
            <CardTitle>Provider connection snapshot</CardTitle>
            <CardDescription>State of each provider at scan time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-2">
              {[...(scan.validation.requiredResults ?? []), ...(scan.validation.optionalResults ?? [])].map((r: any) => (
                <div key={r.providerKey} className="flex items-center justify-between p-2 border border-border rounded">
                  <div>
                    <div className="font-medium text-sm">{r.providerKey}</div>
                    <div className="text-xs text-muted-foreground">{r.message}</div>
                  </div>
                  <ConnectionStateBadge state={r.state} />
                </div>
              ))}
              {(!scan.validation.requiredResults?.length && !scan.validation.optionalResults?.length) && (
                <p className="text-sm text-muted-foreground">No providers configured. Scan ran in free-first mode using the internal crawler.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Limitations */}
      {summary.limitations?.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Scan limitations</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1 mt-2">
              {summary.limitations.map((l: string, i: number) => <li key={i} className="text-xs">{l}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: IssueFinding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <CardContent className="p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left flex items-start gap-3"
          aria-expanded={expanded}
        >
          <SeverityBadge severity={issue.severity} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{issue.title}</div>
            {issue.affectedUrl && <div className="text-xs text-muted-foreground truncate">{issue.affectedUrl}</div>}
          </div>
          <Badge variant="outline" className="capitalize">{issue.category}</Badge>
          <Badge variant="secondary">{issue.confidence}</Badge>
          <Badge variant="outline" className="capitalize">{issue.effort}</Badge>
          <span className="text-xs text-muted-foreground">{issue.priority}</span>
        </button>
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">Description</div>
              <p className="text-muted-foreground">{issue.description}</p>
            </div>
            <div>
              <div className="font-medium mb-1">Why it matters</div>
              <p className="text-muted-foreground">{issue.whyItMatters}</p>
            </div>
            <div>
              <div className="font-medium mb-1">Recommendation</div>
              <p className="text-muted-foreground">{issue.recommendation}</p>
            </div>
            <div>
              <div className="font-medium mb-1">Steps to fix</div>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                {issue.steps.map((s, i) => <li key={i}><strong>{s.step}:</strong> {s.detail}</li>)}
              </ol>
            </div>
            <div>
              <div className="font-medium mb-1">Evidence</div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                {issue.evidence.map((e, i) => <li key={i}><em>{e.source}:</em> {e.detail}</li>)}
              </ul>
            </div>
            {issue.documentationLinks?.length ? (
              <div>
                <div className="font-medium mb-1">Documentation</div>
                <ul className="list-disc pl-5 space-y-1 text-xs">
                  {issue.documentationLinks.map((d, i) => <li key={i}><a href={d.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">{d.label}</a></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
