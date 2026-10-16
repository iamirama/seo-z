// Standalone HTML report generator.
//
// Per spec section 10, the report is:
//   - Self-contained (CSS, JS, charts, and data embedded)
//   - Downloadable as a single .html file
//   - Works offline (no internet required, no app server required)
//   - Print-friendly with a print button
//   - Color-coded severity labels
//   - Searchable issue tables with category filters
//   - Expandable issue details
//   - Does NOT contain any API keys, tokens, cookies, or secrets
//
// The generator is a pure function that takes a fully-resolved
// report payload and returns an HTML string. The HTML includes:
//   - Inline <style> block with all CSS
//   - Inline <script> block with vanilla JS for filtering/search
//   - SVG charts (rendered as inline <svg>)
//   - All issue findings serialized to JSON in a <script type="application/json"> tag

import type { ScanSummary, IssueFinding, ScanConfig, CrawledPage, ProviderMetadata, ValidationResult } from '@/lib/types';

// ---------------------------------------------------------------------
// Input payload for the generator.
// ---------------------------------------------------------------------
export interface ReportPayload {
  scanId: string;
  websiteUrl: string;
  websiteName?: string;
  scannedAt: string;
  scanDurationMs: number;
  scanConfig: ScanConfig;
  summary: ScanSummary;
  issues: IssueFinding[];
  crawledPages: CrawledPage[];
  // Snapshot of provider connection states at scan time
  validation: {
    requiredResults: ValidationResult[];
    optionalResults: ValidationResult[];
  };
  // Provider metadata at report time
  providers: Array<{ metadata: ProviderMetadata; state: string; hasCredentials: boolean }>;
  reportType: 'executive' | 'detailed';
}

// ---------------------------------------------------------------------
// Generate the standalone HTML report.
// ---------------------------------------------------------------------
export function generateHtmlReport(payload: ReportPayload): string {
  const {
    scanId,
    websiteUrl,
    websiteName,
    scannedAt,
    scanDurationMs,
    scanConfig,
    summary,
    issues,
    crawledPages,
    validation,
    providers,
    reportType,
  } = payload;

  // Color palette for severity badges
  const severityColor: Record<string, string> = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#2563eb',
    informational: '#6b7280',
  };

  const severityBg: Record<string, string> = {
    critical: '#fef2f2',
    high: '#fff7ed',
    medium: '#fefce8',
    low: '#eff6ff',
    informational: '#f9fafb',
  };

  // Escape HTML special characters in user-supplied strings
  const esc = (s: string | undefined): string => {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  // Build SVG donut chart for category scores
  const donutChart = (label: string, score: number, color: string): string => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const stroke = score >= 80 ? '#16a34a' : score >= 60 ? '#ca8a04' : score >= 40 ? '#ea580c' : '#dc2626';
    return `
    <div class="donut">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="8"/>
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${stroke}" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 50 50)"/>
        <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="700" fill="${stroke}">${score}</text>
      </svg>
      <div class="donut-label">${esc(label)}</div>
    </div>`;
  };

  // Bar chart for severity counts
  const severityBars = (): string => {
    const max = Math.max(1, ...Object.values(summary.countsBySeverity));
    const colors: Record<string, string> = severityColor;
    return Object.entries(summary.countsBySeverity)
      .map(([sev, count]) => {
        const pct = (count / max) * 100;
        return `
        <div class="sev-bar">
          <div class="sev-label">${esc(sev)}</div>
          <div class="sev-track"><div class="sev-fill" style="width: ${pct}%; background: ${colors[sev]};"></div></div>
          <div class="sev-count">${count}</div>
        </div>`;
      })
      .join('');
  };

  // Filterable issue table
  const issueRows = issues
    .map(
      (issue, i) => `
      <tr class="issue-row" data-category="${esc(issue.category)}" data-severity="${esc(issue.severity)}" data-status="${esc(issue.confidence)}">
        <td>
          <button class="issue-toggle" data-idx="${i}" aria-expanded="false">▶</button>
        </td>
        <td><span class="badge badge-sev badge-sev-${esc(issue.severity)}" style="background:${severityBg[issue.severity]}; color:${severityColor[issue.severity]};">${esc(issue.severity)}</span></td>
        <td>${esc(issue.category)}</td>
        <td><strong>${esc(issue.title)}</strong>${issue.affectedUrl ? `<br><small class="muted">${esc(issue.affectedUrl)}</small>` : ''}</td>
        <td>${esc(issue.confidence)}</td>
        <td>${esc(issue.effort)}</td>
        <td>${issue.priority}</td>
      </tr>
      <tr class="issue-detail" data-idx="${i}" hidden>
        <td colspan="7">
          <div class="detail-grid">
            <div><strong>Description:</strong><br>${esc(issue.description)}</div>
            <div><strong>Why it matters:</strong><br>${esc(issue.whyItMatters)}</div>
            <div><strong>Recommendation:</strong><br>${esc(issue.recommendation)}</div>
            <div><strong>Steps:</strong><ol>${issue.steps.map((s) => `<li><strong>${esc(s.step)}:</strong> ${esc(s.detail)}</li>`).join('')}</ol></div>
            <div><strong>Evidence:</strong><ul>${issue.evidence.map((e) => `<li><em>${esc(e.source)}:</em> ${esc(e.detail)}</li>`).join('')}</ul></div>
            ${issue.documentationLinks?.length ? `<div><strong>Documentation:</strong><ul>${issue.documentationLinks.map((d) => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.label)}</a></li>`).join('')}</ul></div>` : ''}
          </div>
        </td>
      </tr>`,
    )
    .join('');

  // Provider connection table
  const providerRows = providers
    .map(
      (p) => `
      <tr>
        <td>${esc(p.metadata.name)}</td>
        <td><span class="badge badge-state-${p.state}">${esc(p.state)}</span></td>
        <td>${p.hasCredentials ? 'Yes' : 'No'}</td>
        <td>${esc(p.metadata.tier)}</td>
        <td><a href="${esc(p.metadata.website)}" target="_blank" rel="noopener">Website</a> · <a href="${esc(p.metadata.apiDocs)}" target="_blank" rel="noopener">Docs</a></td>
      </tr>`,
    )
    .join('');

  // Crawl summary table
  const crawlStats = `
    <tr><td>Target URL</td><td>${esc(websiteUrl)}</td></tr>
    <tr><td>Max pages</td><td>${scanConfig.maxPages}</td></tr>
    <tr><td>Max depth</td><td>${scanConfig.maxDepth}</td></tr>
    <tr><td>Pages discovered</td><td>${summary.providersUsed.length === 0 ? crawledPages.length : crawledPages.length}</td></tr>
    <tr><td>Pages crawled</td><td>${crawledPages.length}</td></tr>
    <tr><td>Errors</td><td>${crawledPages.filter(p => p.error).length}</td></tr>
    <tr><td>Respect robots.txt</td><td>${scanConfig.respectRobotsTxt ? 'Yes' : 'No'}</td></tr>
    <tr><td>Sitemap as seed</td><td>${scanConfig.useSitemapAsSeed ? 'Yes' : 'No'}</td></tr>
    <tr><td>Include subdomains</td><td>${scanConfig.includeSubdomains ? 'Yes' : 'No'}</td></tr>
    <tr><td>Check external links</td><td>${scanConfig.checkExternalLinks ? 'Yes' : 'No'}</td></tr>
    <tr><td>Scan duration</td><td>${(scanDurationMs / 1000).toFixed(1)}s</td></tr>`;

  // Required vs optional validation results
  const validationRows = [
    ...validation.requiredResults.map((r) => ({ ...r, kind: 'Required' })),
    ...validation.optionalResults.map((r) => ({ ...r, kind: 'Optional' })),
  ].map((r) => `
    <tr>
      <td>${esc(r.kind)}</td>
      <td>${esc(r.providerKey)}</td>
      <td><span class="badge badge-state-${r.state}">${esc(r.state)}</span></td>
      <td>${esc(r.message)}</td>
    </tr>`).join('');

  // Limitations list
  const limitationsList = summary.limitations.map((l) => `<li>${esc(l)}</li>`).join('');

  // Top critical / high findings summary (executive view)
  const criticalHigh = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 10);
  const criticalHighList = criticalHigh.map((i) => `
    <li class="exec-issue">
      <span class="badge badge-sev badge-sev-${esc(i.severity)}" style="background:${severityBg[i.severity]}; color:${severityColor[i.severity]};">${esc(i.severity)}</span>
      <strong>${esc(i.title)}</strong>
      ${i.affectedUrl ? `<small class="muted">— ${esc(i.affectedUrl)}</small>` : ''}
      <div class="exec-rec"><em>Fix:</em> ${esc(i.recommendation)}</div>
    </li>`).join('');

  // Data sources & timestamps
  const dataSources = [
    ...summary.providersUsed.map((p) => `<tr><td>${esc(p)}</td><td>Provider API</td><td>${esc(scannedAt)}</td></tr>`),
    `<tr><td>Internal crawler</td><td>Direct HTTP fetch + HTML parsing</td><td>${esc(scannedAt)}</td></tr>`,
  ].join('');

  // Critical findings count
  const criticalCount = summary.countsBySeverity.critical;
  const highCount = summary.countsBySeverity.high;

  // Issue JSON for client-side filtering
  const issueJson = JSON.stringify(issues.map((i) => ({
    title: i.title,
    category: i.category,
    severity: i.severity,
    confidence: i.confidence,
    affectedUrl: i.affectedUrl,
    description: i.description,
    whyItMatters: i.whyItMatters,
    recommendation: i.recommendation,
    steps: i.steps,
    evidence: i.evidence,
    effort: i.effort,
    priority: i.priority,
    source: i.source,
    documentationLinks: i.documentationLinks,
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report — ${esc(websiteName || websiteUrl)} — ${esc(scannedAt)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.55; color: #18181b; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px; background: #fff; min-height: 100vh; }
    h1, h2, h3, h4 { color: #18181b; margin-top: 0; }
    h1 { font-size: 28px; border-bottom: 3px solid #18181b; padding-bottom: 12px; margin-bottom: 24px; }
    h2 { font-size: 22px; margin-top: 32px; margin-bottom: 16px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    h3 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; }
    .header-meta { color: #71717a; font-size: 13px; margin-bottom: 24px; }
    .header-meta strong { color: #18181b; }
    .score-summary { display: flex; gap: 24px; flex-wrap: wrap; align-items: center; margin: 24px 0; padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; }
    .donut { text-align: center; }
    .donut-label { font-size: 12px; color: #52525b; margin-top: 4px; }
    .score-overall { font-size: 64px; font-weight: 800; line-height: 1; }
    .score-overall-label { color: #71717a; font-size: 14px; }
    .coverage-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin-top: 6px; overflow: hidden; }
    .coverage-fill { height: 100%; background: #16a34a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .badge-sev { padding: 3px 10px; }
    .badge-state-connected, .badge-state-connected_with_limitations { background: #dcfce7; color: #166534; }
    .badge-state-not_configured, .badge-state-validation_inconclusive { background: #f3f4f6; color: #52525b; }
    .badge-state-authentication_failed, .badge-state-permission_denied, .badge-state-service_unavailable { background: #fee2e2; color: #b91c1c; }
    .badge-state-rate_limited, .badge-state-quota_exhausted { background: #fef3c7; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th { background: #f4f4f5; padding: 8px 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600; }
    td { padding: 8px 12px; border: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) { background: #fafafa; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; align-items: center; }
    .filters label { font-size: 12px; color: #52525b; margin-right: 4px; }
    .filters select, .filters input { padding: 6px 10px; border: 1px solid #d4d4d8; border-radius: 4px; font-size: 13px; }
    .issue-toggle { background: none; border: none; cursor: pointer; font-size: 12px; padding: 0; }
    .issue-detail td { background: #fafafa; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; }
    @media (max-width: 700px) { .detail-grid { grid-template-columns: 1fr; } }
    .detail-grid > div { padding: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 4px; }
    .muted { color: #71717a; font-size: 12px; }
    .toc { background: #fafafa; padding: 16px 24px; border-radius: 8px; margin: 24px 0; }
    .toc ol { margin: 0; padding-left: 20px; }
    .toc li { margin: 4px 0; }
    .toc a { color: #2563eb; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .exec-issue { padding: 10px; background: #fafafa; border-left: 3px solid #dc2626; margin-bottom: 8px; }
    .exec-rec { color: #52525b; font-size: 13px; margin-top: 4px; }
    .sev-bar { display: grid; grid-template-columns: 80px 1fr 40px; gap: 8px; align-items: center; margin-bottom: 6px; }
    .sev-track { height: 12px; background: #f4f4f5; border-radius: 6px; overflow: hidden; }
    .sev-fill { height: 100%; }
    .sev-count { font-weight: 600; text-align: right; }
    .nav { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 8px 24px; margin: -24px -24px 16px; z-index: 10; display: flex; gap: 8px; align-items: center; }
    .nav button { padding: 6px 14px; border: 1px solid #d4d4d8; background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .nav button:hover { background: #f4f4f5; }
    .nav-spacer { flex: 1; }
    .nav-brand { font-weight: 700; font-size: 14px; color: #18181b; }
    .alert { padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
    .alert-critical { background: #fef2f2; color: #b91c1c; border-left: 4px solid #dc2626; }
    .alert-info { background: #eff6ff; color: #1e40af; border-left: 4px solid #2563eb; }
    .alert-warning { background: #fef3c7; color: #92400e; border-left: 4px solid #f59e0b; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #71717a; font-size: 12px; text-align: center; }
    @media print {
      .nav { display: none; }
      .filters { display: none; }
      .issue-detail[hidden] { display: table-row !important; }
      .issue-detail td { background: #fff !important; }
      body { background: #fff; }
      .container { box-shadow: none; }
      .issue-toggle { display: none; }
      a { color: #18181b; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <span class="nav-brand">SEO Audit Report</span>
      <span class="nav-spacer"></span>
      <button onclick="window.print()">Print</button>
      <button onclick="downloadJson()">Download JSON</button>
    </nav>

    <h1>SEO Audit Report</h1>
    <div class="header-meta">
      <strong>Website:</strong> ${esc(websiteName || websiteUrl)}<br>
      <strong>URL:</strong> ${esc(websiteUrl)}<br>
      <strong>Scanned:</strong> ${esc(scannedAt)}<br>
      <strong>Report type:</strong> ${esc(reportType)}<br>
      <strong>Scan ID:</strong> <code>${esc(scanId)}</code>
    </div>

    <div class="toc">
      <strong>Table of Contents</strong>
      <ol>
        <li><a href="#exec">Executive Summary</a></li>
        <li><a href="#scores">SEO Scores</a></li>
        <li><a href="#severity">Issue Severity Breakdown</a></li>
        <li><a href="#critical">Critical &amp; High-Priority Findings</a></li>
        <li><a href="#issues">All Findings (Searchable)</a></li>
        <li><a href="#crawl">Crawl Configuration &amp; Results</a></li>
        <li><a href="#providers">Provider Connection Summary</a></li>
        <li><a href="#limitations">Scan Limitations</a></li>
        <li><a href="#sources">Data Sources &amp; Timestamps</a></li>
        <li><a href="#definitions">Definitions &amp; Scoring Rules</a></li>
      </ol>
    </div>

    <section id="exec">
      <h2>1. Executive Summary</h2>
      <p>This report summarizes the SEO audit performed on <strong>${esc(websiteUrl)}</strong> at <strong>${esc(scannedAt)}</strong>. The audit covers ${crawledPages.length} crawled pages${summary.providersUsed.length ? ` and data from ${summary.providersUsed.length} external provider(s)` : ''}. Overall data coverage: <strong>${summary.coverage}%</strong>.</p>
      ${criticalCount > 0 ? `<div class="alert alert-critical"><strong>${criticalCount} critical issue${criticalCount === 1 ? '' : 's'}</strong> require immediate attention. See section 4 for details.</div>` : ''}
      ${highCount > 0 ? `<div class="alert alert-warning"><strong>${highCount} high-priority issue${highCount === 1 ? '' : 's'}</strong> should be addressed in the near term.</div>` : ''}
      ${criticalCount === 0 && highCount === 0 ? `<div class="alert alert-info">No critical or high-priority issues were detected. Review lower-severity findings to fine-tune your SEO.</div>` : ''}
      <p><strong>Overall SEO health score:</strong> ${summary.overallScore}/100. <em>This is an application-generated diagnostic metric, not an official Google ranking score.</em></p>
      <p><strong>Data coverage:</strong> ${summary.coverage}%. Categories without available data are not penalized in the score.</p>
      <p><strong>Scan duration:</strong> ${(scanDurationMs / 1000).toFixed(1)} seconds.</p>
    </section>

    <section id="scores">
      <h2>2. SEO Scores</h2>
      <div class="score-summary">
        <div>
          <div class="score-overall" style="color: ${summary.overallScore >= 80 ? '#16a34a' : summary.overallScore >= 60 ? '#ca8a04' : summary.overallScore >= 40 ? '#ea580c' : '#dc2626'};">${summary.overallScore}</div>
          <div class="score-overall-label">Overall SEO Health (0-100)</div>
        </div>
        ${donutChart('Technical', summary.categoryScores.technical, '#2563eb')}
        ${donutChart('On-Page', summary.categoryScores.onpage, '#16a34a')}
        ${donutChart('Content', summary.categoryScores.content, '#ca8a04')}
        ${donutChart('Performance', summary.categoryScores.performance, '#ea580c')}
        ${donutChart('Off-Page', summary.categoryScores.offpage, '#9333ea')}
        <div>
          <div class="score-overall" style="color: #16a34a;">${summary.coverage}%</div>
          <div class="score-overall-label">Data Coverage</div>
          <div class="coverage-bar"><div class="coverage-fill" style="width: ${summary.coverage}%;"></div></div>
        </div>
      </div>
      <p class="muted">Scores are normalized to the categories that produced real data. Categories without available data (e.g. backlinks when no commercial provider is configured) are excluded from the score calculation rather than counted as zero.</p>
    </section>

    <section id="severity">
      <h2>3. Issue Severity Breakdown</h2>
      <div>${severityBars()}</div>
      <p class="muted">Total issues: <strong>${issues.length}</strong> across all categories.</p>
    </section>

    <section id="critical">
      <h2>4. Critical &amp; High-Priority Findings</h2>
      ${criticalHigh.length > 0 ? `<ul style="list-style: none; padding: 0;">${criticalHighList}</ul>` : '<p>No critical or high-priority findings.</p>'}
    </section>

    <section id="issues">
      <h2>5. Complete Findings List</h2>
      <p>Filter and search through all ${issues.length} findings below. Click a row to expand full details.</p>
      <div class="filters">
        <label for="f-sev">Severity:</label>
        <select id="f-sev" onchange="applyFilters()">
          <option value="">All</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>
        <label for="f-cat">Category:</label>
        <select id="f-cat" onchange="applyFilters()">
          <option value="">All</option>
          <option value="technical">Technical</option>
          <option value="onpage">On-Page</option>
          <option value="content">Content</option>
          <option value="performance">Performance</option>
          <option value="backlinks">Backlinks</option>
          <option value="keywords">Keywords</option>
        </select>
        <label for="f-src">Source:</label>
        <select id="f-src" onchange="applyFilters()">
          <option value="">All</option>
          <option value="crawler">Internal crawler</option>
          <option value="pagespeed">PageSpeed Insights</option>
          <option value="searchconsole">Search Console</option>
          <option value="bing">Bing Webmaster</option>
          <option value="ahrefs">Ahrefs</option>
          <option value="semrush">Semrush</option>
          <option value="moz">Moz</option>
        </select>
        <label for="f-q">Search:</label>
        <input type="text" id="f-q" placeholder="Filter by keyword..." oninput="applyFilters()" style="flex: 1; min-width: 200px;">
        <span id="f-count" class="muted"></span>
      </div>
      <table id="issues-table">
        <thead>
          <tr>
            <th></th>
            <th>Severity</th>
            <th>Category</th>
            <th>Issue</th>
            <th>Confidence</th>
            <th>Effort</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows || '<tr><td colspan="7" style="text-align:center; color:#71717a;">No issues detected.</td></tr>'}
        </tbody>
      </table>
    </section>

    <section id="crawl">
      <h2>6. Crawl Configuration &amp; Results</h2>
      <table>
        <thead><tr><th>Setting</th><th>Value</th></tr></thead>
        <tbody>${crawlStats}</tbody>
      </table>
    </section>

    <section id="providers">
      <h2>7. Provider Connection Summary</h2>
      <p>This section documents which providers were configured, validated, and successfully returned data during this scan.</p>
      <h3>Pre-Scan Validation Results</h3>
      <table>
        <thead><tr><th>Required/Optional</th><th>Provider</th><th>State</th><th>Message</th></tr></thead>
        <tbody>${validationRows || '<tr><td colspan="4">No providers configured. Scan ran in free-first mode using the internal crawler.</td></tr>'}</tbody>
      </table>
      <h3>Provider Capability Matrix</h3>
      <table>
        <thead><tr><th>Provider</th><th>State</th><th>Credentials</th><th>Tier</th><th>Links</th></tr></thead>
        <tbody>${providerRows}</tbody>
      </table>
      <p class="muted">Providers used in this scan: <strong>${summary.providersUsed.length ? esc(summary.providersUsed.join(', ')) : 'None (free-first mode)'}</strong>.</p>
      ${summary.providersUnavailable.length ? `<p class="muted">Providers unavailable: ${esc(summary.providersUnavailable.map((p) => `${p.key} (${p.reason})`).join('; '))}</p>` : ''}
    </section>

    <section id="limitations">
      <h2>8. Scan Limitations</h2>
      <ul>${limitationsList || '<li>None.</li>'}</ul>
    </section>

    <section id="sources">
      <h2>9. Data Sources &amp; Timestamps</h2>
      <table>
        <thead><tr><th>Source</th><th>Type</th><th>Retrieved at</th></tr></thead>
        <tbody>${dataSources}</tbody>
      </table>
    </section>

    <section id="definitions">
      <h2>10. Definitions &amp; Scoring Rules</h2>
      <h3>Severity Levels</h3>
      <ul>
        <li><strong>Critical:</strong> Issue prevents indexing or breaks user/SEO fundamentals (e.g. HTTP 5xx, missing title).</li>
        <li><strong>High:</strong> Issue significantly impacts SEO or UX (e.g. missing H1, missing meta description).</li>
        <li><strong>Medium:</strong> Issue requires attention but does not block SEO (e.g. duplicate title, slow response).</li>
        <li><strong>Low:</strong> Minor issue or optimization opportunity.</li>
        <li><strong>Informational:</strong> Observation that does not require action but is worth noting.</li>
      </ul>
      <h3>Confidence Levels</h3>
      <ul>
        <li><strong>Confirmed:</strong> Directly observed from raw HTTP/HTML evidence.</li>
        <li><strong>Likely:</strong> Strong signal but may require human review.</li>
        <li><strong>Heuristic:</strong> Rule-based estimation; treat as a guideline, not fact.</li>
      </ul>
      <h3>Score Calculation</h3>
      <p>The overall SEO health score is computed as a weighted average of category scores. Each category starts at 100 and deducts per-issue penalties (critical: -25, high: -12, medium: -6, low: -2, informational: 0). Categories without data are excluded from the roll-up rather than counted as zero. Score weights: Technical 30%, On-Page 25%, Content 15%, Performance 15%, Off-Page (backlinks + keywords) 15%.</p>
      <p class="muted"><em>This score is an application-generated diagnostic metric, not an official Google ranking score. Use it to compare scans over time within a single website, not to benchmark against other sites.</em></p>
    </section>

    <div class="footer">
      Generated by Z-SEO-Auditor. Report is self-contained and works offline. No API keys or credentials are embedded in this file.
    </div>
  </div>

  <script type="application/json" id="issues-data">${issueJson.replace(/</g, '\\u003c')}</script>
  <script>
    // Expand/collapse issue details
    document.querySelectorAll('.issue-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = btn.getAttribute('data-idx');
        var detail = document.querySelector('.issue-detail[data-idx="' + idx + '"]');
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', !expanded);
        btn.textContent = expanded ? '▶' : '▼';
        detail.hidden = expanded;
      });
    });

    // Filter table
    function applyFilters() {
      var sev = document.getElementById('f-sev').value;
      var cat = document.getElementById('f-cat').value;
      var src = document.getElementById('f-src').value;
      var q = (document.getElementById('f-q').value || '').toLowerCase();
      var rows = document.querySelectorAll('#issues-table .issue-row');
      var visible = 0;
      rows.forEach(function(row) {
        var match = true;
        if (sev && row.getAttribute('data-severity') !== sev) match = false;
        if (cat && row.getAttribute('data-category') !== cat) match = false;
        if (src) {
          var issueData = JSON.parse(document.getElementById('issues-data').textContent);
          var idx = parseInt(row.querySelector('.issue-toggle').getAttribute('data-idx'), 10);
          if (issueData[idx] && issueData[idx].source !== src) match = false;
        }
        if (q) {
          var text = row.textContent.toLowerCase();
          if (text.indexOf(q) === -1) match = false;
        }
        row.style.display = match ? '' : 'none';
        // Hide paired detail row when filtered out
        var idx = row.querySelector('.issue-toggle').getAttribute('data-idx');
        var detail = document.querySelector('.issue-detail[data-idx="' + idx + '"]');
        if (detail) detail.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      document.getElementById('f-count').textContent = visible + ' / ' + rows.length + ' shown';
    }
    applyFilters();

    function downloadJson() {
      var data = JSON.parse(document.getElementById('issues-data').textContent);
      var blob = new Blob([JSON.stringify({
        scanId: ${JSON.stringify(scanId)},
        websiteUrl: ${JSON.stringify(websiteUrl)},
        scannedAt: ${JSON.stringify(scannedAt)},
        summary: ${JSON.stringify(summary)},
        issues: data,
      }, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'seo-audit-' + ${JSON.stringify(scanId)} + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;
}
