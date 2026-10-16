# SEO Auditor — Professional SEO Audit & Analysis

A modern, professional web application that performs comprehensive SEO audits for any publicly accessible website. Built with Next.js 16, TypeScript, Tailwind CSS, Prisma, and a modular provider integration layer.

## Features

- **Free-first mode**: works without any paid SEO subscription using the internal technical SEO crawler + Google PageSpeed Insights (free API).
- **Modular provider integration** with 10 supported providers:
  - Free / Free-tier: Google PageSpeed Insights, Bing Webmaster Tools
  - OAuth-required: Google Search Console, Google Analytics Data API (GA4)
  - Commercial (optional): Ahrefs, Semrush, Moz, DataForSEO, SerpApi, Majestic
- **Mandatory pre-scan validation gate**: required providers MUST pass real connection tests before a scan starts. Optional providers fail gracefully.
- **Comprehensive audit**: Technical SEO, On-Page SEO, Content Analysis, Performance / Core Web Vitals, Backlink Analysis, Keyword / Search Visibility.
- **Actionable recommendations**: every finding includes evidence, why it matters, step-by-step fix instructions, effort estimate, and priority.
- **Standalone HTML reports**: self-contained, downloadable, print-friendly, with searchable issue tables and a JSON export option.
- **Scan history & comparison**: track improvements over time and compare two scans.
- **Security**: AES-256-GCM encrypted credential storage, backend-only secret access, SSRF protection, robots.txt respect, identifiable crawler User-Agent.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Recharts, Lucide icons
- **Backend**: Next.js server-side API routes, modular provider integration layer
- **Database**: SQLite via Prisma ORM (file-based, no external DB required)
- **Crawler**: Internal SSRF-protected HTML crawler (no external dependencies)
- **Reporting**: Server-generated standalone HTML templates with embedded CSS, JS, and data

## Project Structure

```
.
├── prisma/
│   └── schema.prisma              # Database schema (Website, Scan, Issue, ProviderConfig, etc.)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Main shell with sidebar + sections
│   │   ├── layout.tsx              # Root layout
│   │   └── api/                    # REST API routes
│   │       ├── dashboard/          # Dashboard summary
│   │       ├── providers/          # Provider list, save, delete
│   │       │   └── [name]/test/    # Connection validation
│   │       ├── scans/              # Scan lifecycle
│   │       │   └── [id]/           # Scan details, report, cancel
│   │       │       └── report/     # HTML report generator
│   │       ├── scans/compare/      # Scan comparison
│   │       ├── validate/           # Pre-scan validation endpoint
│   │       └── websites/           # Website CRUD
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── sections/                # Dashboard, NewAudit, Results, Recommendations, Reports, History, ApiSettings, AppSettings
│   │   ├── audit/badges.tsx         # SeverityBadge, ConnectionStateBadge
│   │   └── ui/                     # shadcn/ui components
│   └── lib/
│       ├── types.ts                # Shared TypeScript types
│       ├── crawler.ts              # SSRF-protected website crawler
│       ├── scoring.ts              # SEO scoring system
│       ├── audit/
│       │   ├── index.ts            # Audit modules (Technical, OnPage, Content, Performance, Backlink, Keyword)
│       │   └── orchestrator.ts     # Audit pipeline coordinator
│       ├── providers/               # Provider integrations
│       │   ├── base.ts              # BaseProvider abstract class + validateProvider helper
│       │   ├── registry.ts          # Provider registry
│       │   ├── pagespeed.ts         # Google PageSpeed Insights
│       │   ├── searchconsole.ts    # Google Search Console (OAuth)
│       │   ├── analytics.ts         # Google Analytics Data API (GA4, OAuth)
│       │   ├── bing.ts              # Bing Webmaster Tools
│       │   ├── ahrefs.ts            # Ahrefs (paid)
│       │   ├── semrush.ts           # Semrush (paid)
│       │   ├── moz.ts               # Moz (paid)
│       │   └── optional-providers.ts # DataForSEO, SerpApi, Majestic
│       ├── report/
│       │   └── generator.ts        # Standalone HTML report generator
│       ├── security/
│       │   ├── ssrf.ts              # SSRF protection + URL validation
│       │   └── credentials.ts      # AES-256-GCM encryption
│       ├── store/
│       │   ├── providers.ts        # Provider config CRUD (encrypted)
│       │   └── ui.ts               # Zustand UI store
│       ├── db.ts                   # Prisma client singleton
│       └── utils.ts                # cn() Tailwind helper
├── .env.example                    # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

## Setup & Installation

### Prerequisites

- Node.js 18+ or Bun 1.0+
- An SQLite-capable filesystem (no external DB required)

### Install

```bash
# Install dependencies
bun install

# Copy the env template and set your encryption key
cp .env.example .env
# Generate a strong encryption key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output into .env as CREDENTIAL_ENCRYPTION_KEY

# Push the database schema
bun run db:push

# Start the dev server
bun run dev
# Visit http://localhost:3000
```

## API Configuration

Open the **API & Services** section in the sidebar to configure each provider:

1. Click the provider's documentation link to obtain an API key / OAuth credentials.
2. Enter credentials in the form. The key is encrypted (AES-256-GCM) before persistence.
3. Click **Save** to persist.
4. Click **Test** to run a real connection validation against the provider's API.
5. The validation result determines whether the provider can be selected for scans.

### Free-first Setup

The minimum configuration for a useful scan:
- **Google PageSpeed Insights** (free, requires Google API key)
- No other providers required — the internal crawler runs by default

### Recommended Add-ons

- **Google Search Console** (free, requires OAuth): keyword & search visibility data
- **Bing Webmaster Tools** (free, requires API key): cross-search-engine visibility
- **Ahrefs / Semrush / Moz** (paid): backlink data

## API Reference

### Websites
- `GET /api/websites` — list websites
- `POST /api/websites` — create/upsert website

### Scans
- `GET /api/scans?websiteId=X&limit=N` — list scans
- `POST /api/scans` — start a new scan (validates first; runs audit in background)
- `GET /api/scans/[id]` — get scan details + issues
- `POST /api/scans/[id]/cancel` — cancel a running scan
- `GET /api/scans/[id]/report?type=detailed|executive` — generate & download HTML report
- `GET /api/scans/compare?a=ID1&b=ID2` — compare two scans

### Providers
- `GET /api/providers` — list all providers with current state
- `POST /api/providers/[name]` — save credentials
- `DELETE /api/providers/[name]` — remove credentials
- `POST /api/providers/[name]/test` — run live connection validation

### Validation & Dashboard
- `POST /api/validate` — pre-scan validation (does not start a scan)
- `GET /api/dashboard` — dashboard summary (websites, recent scans, provider health)

## Provider Capability Matrix

| Provider                | Tech | On-Page | Content | Perf | Backlinks | Keywords | Local | Tier             |
|-------------------------|------|---------|---------|------|-----------|----------|-------|------------------|
| PageSpeed Insights      | —    | —       | —       | ✓    | —         | —        | —     | Free tier        |
| Search Console          | ✓    | —       | —       | —    | —         | ✓        | —     | OAuth required   |
| Google Analytics GA4    | —    | —       | —       | —    | —         | ✓        | —     | OAuth required   |
| Bing Webmaster         | —    | —       | —       | —    | —         | ✓        | —     | Free tier        |
| Ahrefs                  | —    | —       | —       | —    | ✓         | ✓        | —     | Paid             |
| Semrush                 | —    | —       | —       | —    | ✓         | ✓        | —     | Paid             |
| Moz                     | —    | —       | —       | —    | ✓         | —        | —     | Paid             |
| DataForSEO              | —    | —       | —       | —    | ✓         | ✓        | —     | Paid             |
| SerpApi                 | —    | —       | —       | —    | —         | ✓        | —     | Free tier (100/m) |
| Majestic                | —    | —       | —       | —    | ✓         | —        | —     | Paid             |

## Security Notes

- **AES-256-GCM encryption** for credentials with key from `CREDENTIAL_ENCRYPTION_KEY` env var.
- **Backend-only secret access** — credentials are never returned in API responses, logs, or reports.
- **SSRF protection** — crawler blocks private IP ranges, metadata endpoints, and re-validates redirect targets.
- **Protocol restriction** — only http:// and https:// URLs are crawled.
- **robots.txt respect** — honors User-agent: * Allow/Disallow rules (configurable per scan).
- **Identifiable User-Agent** — `Z-SEO-Auditor/1.0` declared in all crawler requests.
- **Request throttling** — configurable concurrency, timeouts, and retry limits prevent server overload.

## Free-tier Limitations

- **Internal crawler**: 1-500 pages per scan (user-configurable). Each scan is bounded to avoid overwhelming target servers.
- **PageSpeed Insights**: 25,000 requests/day per Google Cloud project (default quota).
- **SerpApi**: 100 searches/month on the free tier.
- **Bing Webmaster**: requires verified site ownership; data limited to Bing search traffic.
- **Ahrefs / Semrush / Moz / Majestic**: no free API access; full backlink/keyword analysis requires paid subscription.
- **Google Search Console / Analytics**: requires user OAuth consent for each verified property.

## SEO Scoring Rules

Overall score = weighted average of category scores. Each category starts at 100 and deducts per-issue penalties:

| Severity       | Penalty |
|----------------|---------|
| Critical       | -25     |
| High           | -12     |
| Medium         | -6      |
| Low            | -2      |
| Informational  | 0       |

Category weights: Technical 30%, On-Page 25%, Content 15%, Performance 15%, Off-Page (backlinks + keywords) 15%.

Categories without data are excluded from the roll-up rather than counted as zero, so missing data does not penalize the score.

**Note:** This score is an application-generated diagnostic metric, NOT an official Google ranking score. Use it to track improvements over time within a single website, not to benchmark against other sites.

## Development & Production Commands

```bash
# Development (auto-reload on file change)
bun run dev

# Lint
bun run lint

# Database
bun run db:push        # Push schema to SQLite
bun run db:generate    # Regenerate Prisma client
bun run db:migrate     # Create & apply migration
bun run db:reset       # Drop & recreate (destructive)

# Production build & start (not used in the sandbox preview)
bun run build
bun run start
```

## Deployment

This is a standard Next.js 16 app and can be deployed to any Node.js-capable host (Vercel, Netlify, Railway, Fly.io, your own server, Docker, etc.).

Key deployment checklist:
1. Set `DATABASE_URL` to a persistent writable path.
2. Set `CREDENTIAL_ENCRYPTION_KEY` to a strong random 64-hex-char value. NEVER reuse across environments.
3. Set up periodic SQLite backups if using the default file-based DB.
4. Configure a reverse proxy (Caddy, nginx) with HTTPS in front of the Next.js server.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Scan immediately fails with "Pre-scan validation failed" | Required provider credentials missing or invalid | Open Settings → fix credentials → re-run scan |
| Scan runs but reports "Backlink data unavailable" | No backlink provider configured | Configure Ahrefs/Moz/Majestic (all paid) |
| Crawler reports "SSRF blocked" for a target | URL resolves to a private IP or metadata endpoint | Use a public URL; verify DNS resolves to a public IP |
| PageSpeed API returns 403 | API key invalid or PageSpeed Insights API not enabled in Google Cloud project | Re-check the API key; enable the API in Google Cloud Console |
| Search Console returns "permission denied" | OAuth token lacks `webmasters.readonly` scope | Re-authorize with the correct scope |
| HTML report fails to open | Browser blocks local file with JS | Use "Open in new tab" from the app instead of saving & opening from disk |

## License

MIT
# seo-z
