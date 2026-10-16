'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, Database, Server, Globe, Lock } from 'lucide-react';

export function AppSettingsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application Settings</h1>
        <p className="text-sm text-muted-foreground">System information and security configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> System</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid sm:grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Application</dt>
            <dd>Z-SEO-Auditor v1.0</dd>
            <dt className="text-muted-foreground">Framework</dt>
            <dd>Next.js 16 + TypeScript</dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd>SQLite via Prisma ORM</dd>
            <dt className="text-muted-foreground">Crawler</dt>
            <dd>Internal (SSRF-protected)</dd>
            <dt className="text-muted-foreground">Encryption</dt>
            <dd>AES-256-GCM (credentials)</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security configuration</CardTitle>
          <CardDescription>Security features enabled by default.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Encrypted credential storage.</strong> AES-256-GCM with key sourced from environment variable. Plaintext never persisted.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Backend-only secret access.</strong> API keys/tokens are never returned in API responses, error messages, or logs. Frontend receives only masked values.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>SSRF protection.</strong> The crawler refuses to fetch private IP ranges (10.x, 172.16-31.x, 192.168.x), loopback, link-local, and cloud metadata endpoints. Redirect targets are re-validated to prevent DNS rebinding bypasses.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Protocol restriction.</strong> Only http:// and https:// protocols are permitted. All others (file://, ftp://, etc.) are rejected.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Identifiable crawler user-agent.</strong> The crawler sends <code className="bg-muted px-1 py-0.5 text-xs">Z-SEO-Auditor/1.0</code> in its User-Agent header.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>robots.txt respect.</strong> Honors <code className="bg-muted px-1 py-0.5 text-xs">User-agent: *</code> Allow/Disallow directives. Can be disabled per-scan.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Database className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Per-website data isolation.</strong> Scans, issues, and findings are scoped to a website record. Each website has its own scan history.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Globe className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <div>
                <strong>Pre-scan validation gate.</strong> Required providers are validated before a scan starts. Failed validation blocks the scan unless the user explicitly marks providers as optional.
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The overall SEO health score is a weighted average of category scores:
          </p>
          <ul className="mt-2 text-sm space-y-1">
            <li><Badge variant="outline">Technical SEO</Badge> — weight: 30%</li>
            <li><Badge variant="outline">On-Page SEO</Badge> — weight: 25%</li>
            <li><Badge variant="outline">Content</Badge> — weight: 15%</li>
            <li><Badge variant="outline">Performance</Badge> — weight: 15%</li>
            <li><Badge variant="outline">Off-Page (backlinks + keywords)</Badge> — weight: 15%</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Each category starts at 100 and deducts per-issue penalties: critical -25, high -12, medium -6, low -2, informational 0.
            Categories without data are excluded from the roll-up rather than counted as zero, so missing data does not penalize the score.
          </p>
          <Alert className="mt-3">
            <AlertTitle>Important</AlertTitle>
            <AlertDescription className="text-xs">
              This score is an application-generated diagnostic metric, NOT an official Google ranking score. Use it to track improvements over time within a single website, not to benchmark against other sites.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Free-first mode</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The application remains useful without any paid SEO subscriptions. The internal crawler performs real technical SEO audits (broken links, missing metadata, canonical issues, schema validation, security headers, etc.) and Google PageSpeed Insights is free with quota.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Commercial providers (Ahrefs, Semrush, Moz, Majestic) are optional add-ons. Their absence is clearly reported in scan results — never fabricated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
