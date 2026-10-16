'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, ListChecks } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';
import { SeverityBadge } from '@/components/audit/badges';
import type { IssueFinding, EffortLevel } from '@/lib/types';

const EFFORT_RANK: Record<EffortLevel, number> = { quick: 1, moderate: 2, significant: 3 };

export function RecommendationsSection() {
  const { activeScanId, setActiveView } = useAppStore();
  const [issues, setIssues] = useState<IssueFinding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeScanId) {
      setActiveView('new-audit');
      return;
    }
    fetch(`/api/scans/${activeScanId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setIssues(d.issues);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeScanId]);

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

  if (error || !issues) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load</AlertTitle>
        <AlertDescription>{error || 'Unknown error'}</AlertDescription>
      </Alert>
    );
  }

  // Sort by severity then priority then effort (quick wins first within same priority)
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
  const sorted = [...issues].sort((a, b) => {
    if (severityRank[a.severity] !== severityRank[b.severity]) return severityRank[a.severity] - severityRank[b.severity];
    if (b.priority !== a.priority) return b.priority - a.priority;
    return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
  });

  // Quick wins = quick effort + (critical or high)
  const quickWins = sorted.filter((i) => i.effort === 'quick' && (i.severity === 'critical' || i.severity === 'high'));
  const highImpact = sorted.filter((i) => !quickWins.includes(i) && (i.severity === 'critical' || i.severity === 'high'));
  const longTerm = sorted.filter((i) => !quickWins.includes(i) && !highImpact.includes(i));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveView('results')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to results
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Actionable Recommendations</h1>
        <p className="text-sm text-muted-foreground">
          Prioritized action plan grouped by impact and effort. Each finding includes step-by-step fix instructions, evidence, and documentation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-green-600" />
            Quick Wins ({quickWins.length})
          </CardTitle>
          <CardDescription>High-impact issues that take minimal effort to fix.</CardDescription>
        </CardHeader>
        <CardContent>
          {quickWins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quick wins found.</p>
          ) : (
            <ol className="space-y-3">
              {quickWins.map((issue, i) => (
                <li key={i} className="border-l-4 border-green-500 pl-3">
                  <RecommendationItem issue={issue} index={i + 1} />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>High-Impact Issues ({highImpact.length})</CardTitle>
          <CardDescription>Critical and high-severity findings requiring focused attention.</CardDescription>
        </CardHeader>
        <CardContent>
          {highImpact.length === 0 ? (
            <p className="text-sm text-muted-foreground">No high-impact issues. Your site is in good shape.</p>
          ) : (
            <ol className="space-y-3">
              {highImpact.map((issue, i) => (
                <li key={i} className="border-l-4 border-red-500 pl-3">
                  <RecommendationItem issue={issue} index={i + 1} />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Long-term Improvements ({longTerm.length})</CardTitle>
          <CardDescription>Medium, low, and informational findings for incremental optimization.</CardDescription>
        </CardHeader>
        <CardContent>
          {longTerm.length === 0 ? (
            <p className="text-sm text-muted-foreground">No further improvements identified.</p>
          ) : (
            <ol className="space-y-3">
              {longTerm.map((issue, i) => (
                <li key={i} className="border-l-4 border-blue-400 pl-3">
                  <RecommendationItem issue={issue} index={i + 1} />
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationItem({ issue, index }: { issue: IssueFinding; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-2 py-1"
        aria-expanded={expanded}
      >
        <span className="text-xs text-muted-foreground mt-1">#{index}</span>
        <SeverityBadge severity={issue.severity} />
        <div className="flex-1 min-w-0">
          <div className="font-medium">{issue.title}</div>
          {issue.affectedUrl && <div className="text-xs text-muted-foreground truncate">{issue.affectedUrl}</div>}
        </div>
        <Badge variant="outline" className="capitalize">{issue.effort}</Badge>
      </button>
      {expanded && (
        <div className="mt-2 space-y-3 text-sm pl-6">
          <p><strong>Why it matters:</strong> <span className="text-muted-foreground">{issue.whyItMatters}</span></p>
          <p><strong>Recommendation:</strong> <span className="text-muted-foreground">{issue.recommendation}</span></p>
          <div>
            <strong>Steps:</strong>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground mt-1">
              {issue.steps.map((s, i) => <li key={i}><strong>{s.step}:</strong> {s.detail}</li>)}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
