'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, ArrowLeft, FileDown, FileText, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/lib/store/ui';

export function ReportsSection() {
  const { activeScanId, setActiveView } = useAppStore();
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'detailed' | 'executive'>('detailed');

  useEffect(() => {
    if (!activeScanId) {
      setActiveView('new-audit');
      return;
    }
    fetch(`/api/scans/${activeScanId}`)
      .then((r) => r.json())
      .then((d) => setScan(d.scan))
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

  if (!scan) {
    return <p className="text-muted-foreground">Failed to load scan.</p>;
  }

  if (scan.status !== 'completed') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Report not available</AlertTitle>
        <AlertDescription>
          Scan status is "{scan.status}". Reports can only be generated for completed scans.
        </AlertDescription>
      </Alert>
    );
  }

  const reportUrl = `/api/scans/${scan.id}/report?type=${reportType}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setActiveView('results')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to results
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">HTML Report Generator</h1>
        <p className="text-sm text-muted-foreground">Download a self-contained, printable HTML report for this scan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report options</CardTitle>
          <CardDescription>Choose the report type.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => setReportType('detailed')}
              className={`text-left p-4 rounded-md border-2 transition-colors ${reportType === 'detailed' ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}`}
            >
              <FileText className="h-5 w-5 mb-2" />
              <div className="font-medium">Detailed Technical Report</div>
              <p className="text-xs text-muted-foreground mt-1">All findings, evidence, and step-by-step fix instructions. Suitable for developers and SEO specialists.</p>
            </button>
            <button
              onClick={() => setReportType('executive')}
              className={`text-left p-4 rounded-md border-2 transition-colors ${reportType === 'executive' ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}`}
            >
              <FileText className="h-5 w-5 mb-2" />
              <div className="font-medium">Executive Summary Report</div>
              <p className="text-xs text-muted-foreground mt-1">Top critical/high findings, scores, and high-level recommendations. Suitable for stakeholders.</p>
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              <Button>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open report in new tab
              </Button>
            </a>
            <a href={reportUrl} download>
              <Button variant="outline">
                <FileDown className="h-4 w-4 mr-2" />
                Download HTML
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report features</CardTitle>
          <CardDescription>What's included in every generated report.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground">
            <li>✓ Self-contained: no external dependencies, works offline</li>
            <li>✓ Searchable, filterable issue tables</li>
            <li>✓ Color-coded severity labels</li>
            <li>✓ Expandable issue details with evidence and fix steps</li>
            <li>✓ Print-friendly CSS + print button</li>
            <li>✓ Table of contents with anchor links</li>
            <li>✓ Summary charts (SVG donuts + severity bar chart)</li>
            <li>✓ Provider capability matrix</li>
            <li>✓ Documented scan limitations and data sources</li>
            <li>✓ No API keys, tokens, or credentials embedded in the report</li>
            <li>✓ JSON export button for downstream tooling</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scan details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="text-sm grid sm:grid-cols-2 gap-2">
            <dt className="text-muted-foreground">Target URL</dt>
            <dd className="font-mono text-xs break-all">{scan.targetUrl}</dd>
            <dt className="text-muted-foreground">Scan ID</dt>
            <dd className="font-mono text-xs">{scan.id}</dd>
            <dt className="text-muted-foreground">Started</dt>
            <dd>{new Date(scan.startedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>{scan.completedAt ? new Date(scan.completedAt).toLocaleString() : '—'}</dd>
            <dt className="text-muted-foreground">Overall score</dt>
            <dd className="font-medium">{scan.overallScore ?? '—'} / 100</dd>
            <dt className="text-muted-foreground">Coverage</dt>
            <dd>{scan.coverage ?? '—'}%</dd>
            <dt className="text-muted-foreground">Issues</dt>
            <dd>{scan.issueCount} ({scan.criticalCount} critical, {scan.highCount} high)</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
