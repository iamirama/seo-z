// Audit pipeline. Each module consumes the crawled pages (and any
// provider-supplied data) and emits IssueFinding[] objects.
//
// Per spec section 7, audits are organized into categories:
//   A. Technical SEO
//   B. On-Page SEO
//   C. Content SEO
//   D. Performance and Core Web Vitals
//   E. Backlink Analysis
//   F. Keyword and Search Visibility
//
// Heuristics are documented inline. All thresholds are configurable
// below; values come from common industry references and Google's
// own documentation, but are NOT universal ranking rules.

import type {
  CrawledPage,
  IssueFinding,
  NormalizedSEOData,
  ScanConfig,
} from '@/lib/types';

// =====================================================================
// Configurable heuristic thresholds (per spec section 7.B).
// =====================================================================
export const AUDIT_THRESHOLDS = {
  titleMinLength: 30,
  titleMaxLength: 60,
  metaDescriptionMinLength: 70,
  metaDescriptionMaxLength: 160,
  contentMinWords: 300,    // pages below this are flagged as "potentially thin"
  contentRecommendedWords: 600,
  maxRedirectChain: 3,
  acceptableResponseTimeMs: 2000,
  poorResponseTimeMs: 4000,
  // Performance thresholds (per Google's Core Web Vitals guidance)
  goodLcp: 2500,           // ms
  poorLcp: 4000,
  goodInp: 200,
  poorInp: 500,
  goodCls: 0.1,
  poorCls: 0.25,
  goodFcp: 1800,
  poorFcp: 3000,
  goodTbt: 200,
  poorTbt: 600,
};

// =====================================================================
// A. TECHNICAL SEO AUDIT
// =====================================================================
export function auditTechnical(pages: CrawledPage[], config: ScanConfig): IssueFinding[] {
  const findings: IssueFinding[] = [];

  for (const page of pages) {
    // 1. HTTP errors (4xx, 5xx)
    if (page.statusCode && page.statusCode >= 400) {
      const severity = page.statusCode >= 500 ? 'critical' : 'high';
      findings.push({
        title: `HTTP ${page.statusCode} on ${page.url}`,
        category: 'technical',
        severity,
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: `The page returned a ${page.statusCode} status code, indicating it is unavailable or there is a server error.`,
        whyItMatters:
          'Search engines cannot index pages that return 4xx/5xx status codes. Users who follow internal or external links to this URL will see an error page instead of your content, harming UX and search visibility.',
        evidence: [
          { source: 'crawler', detail: `HTTP status: ${page.statusCode}` },
          ...(page.error ? [{ source: 'crawler', detail: page.error }] : []),
        ],
        recommendation:
          page.statusCode >= 500
            ? 'Investigate server logs for the failing route, check application health, and ensure the page is generated correctly.'
            : 'Fix the broken link or restore the page. If the page is permanently gone, configure a 301 redirect to a relevant replacement.',
        steps: [
          { step: 'Identify referring links', detail: 'Use the internal links audit to find pages linking to this URL.' },
          { step: 'Decide action', detail: 'Restore the page or set up a 301 redirect to the closest relevant content.' },
          { step: 'Update internal links', detail: 'If the URL changed, update internal links to point to the new location.' },
        ],
        effort: 'moderate',
        priority: page.statusCode >= 500 ? 95 : 80,
        source: 'crawler',
        documentationLinks: [
          { label: 'HTTP status codes (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status' },
        ],
      });
    }

    // 2. Redirect chains
    if (page.redirectChain && page.redirectChain.length > 1) {
      findings.push({
        title: `Redirect chain (${page.redirectChain.length} hops) on ${page.url}`,
        category: 'technical',
        severity: page.redirectChain.length > 3 ? 'high' : 'medium',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: `The page redirects through ${page.redirectChain.length} intermediate URLs before reaching the final destination.`,
        whyItMatters:
          'Each redirect hop adds latency and dilutes link equity. Long chains slow down crawlers and users, and reduce the SEO value passed through to the final page.',
        evidence: [
          { source: 'crawler', detail: `Chain: ${[page.url, ...page.redirectChain].join(' → ')}` },
        ],
        recommendation: 'Replace multi-hop redirects with a single direct redirect from the original URL to the final destination.',
        steps: [
          { step: 'Audit redirect rules', detail: 'Check your server config (.htaccess, nginx, CDN) for chained redirects.' },
          { step: 'Update rule', detail: 'Change the rule to redirect directly to the final URL.' },
        ],
        effort: 'quick',
        priority: 60,
        source: 'crawler',
      });
    }

    // 3. HTTP -> HTTPS problems (page is HTTP)
    if (!page.isHttps && !page.url.startsWith('https://')) {
      findings.push({
        title: `Page served over HTTP (not HTTPS): ${page.url}`,
        category: 'technical',
        severity: 'high',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'This page is served over an unencrypted HTTP connection.',
        whyItMatters:
          'HTTPS is a ranking signal and a security requirement. Modern browsers mark HTTP pages as "Not Secure", which erodes user trust and can impact search rankings.',
        evidence: [{ source: 'crawler', detail: 'URL scheme: http' }],
        recommendation: 'Install an SSL/TLS certificate and configure the server to redirect all HTTP requests to HTTPS.',
        steps: [
          { step: 'Obtain certificate', detail: 'Use Let\'s Encrypt (free) or your hosting provider.' },
          { step: 'Install & configure', detail: 'Install the certificate on the server or CDN.' },
          { step: 'Force HTTPS', detail: 'Add a 301 redirect from HTTP to HTTPS for all routes.' },
          { step: 'Update internal links', detail: 'Update sitemap, canonical tags, and internal links to use https://.' },
        ],
        effort: 'moderate',
        priority: 85,
        source: 'crawler',
        documentationLinks: [
          { label: 'HTTPS on Google Search Central', url: 'https://developers.google.com/search/docs/crawling-indexing/secure-your-site' },
        ],
      });
    }

    // 4. Mixed content
    if (page.mixedContent) {
      findings.push({
        title: `Mixed content on ${page.url}`,
        category: 'technical',
        severity: 'high',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page is served over HTTPS but loads some resources (images, scripts, styles) over HTTP.',
        whyItMatters:
          'Browsers block active mixed content (scripts, iframes) and warn about passive mixed content (images). This breaks functionality and may cause the page to be flagged as insecure, which can hurt search visibility and conversions.',
        evidence: [{ source: 'crawler', detail: 'Detected http:// resources in img/script/link tags' }],
        recommendation: 'Update all internal asset URLs to use https:// (or protocol-relative //).',
        steps: [
          { step: 'Find offending URLs', detail: 'Use browser DevTools → Security tab to list mixed resources.' },
          { step: 'Update references', detail: 'Change http:// to https:// in HTML, CSS, and JS.' },
          { step: 'Add CSP', detail: 'Add a Content-Security-Policy header with upgrade-insecure-requests.' },
        ],
        effort: 'quick',
        priority: 75,
        source: 'crawler',
      });
    }

    // 5. robots.txt blocked pages (informational)
    if (!page.robotsAllowed) {
      findings.push({
        title: `Page blocked by robots.txt: ${page.url}`,
        category: 'technical',
        severity: 'informational',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page is disallowed for crawlers in the robots.txt file.',
        whyItMatters:
          'Pages blocked by robots.txt will not be crawled by search engines. This is intentional for some pages (admin, search results) but a problem if blocking indexable content.',
        evidence: [{ source: 'crawler', detail: 'Blocked by robots.txt rule' }],
        recommendation: 'Verify that blocking this page is intentional. If the page should be indexed, remove the disallow rule.',
        steps: [{ step: 'Review robots.txt', detail: 'Open /robots.txt and inspect the disallow rules.' }],
        effort: 'quick',
        priority: 30,
        source: 'crawler',
      });
    }

    // 6. Non-indexable pages (noindex)
    if (page.robotsAllowed && !page.indexable) {
      findings.push({
        title: `Page has noindex directive: ${page.url}`,
        category: 'technical',
        severity: 'low',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page contains a noindex directive (meta robots or X-Robots-Tag header).',
        whyItMatters:
          'Pages with noindex are dropped from search indexes. This is correct for thank-you pages, internal search, admin pages — but a critical error for pages meant to rank.',
        evidence: [{ source: 'crawler', detail: 'Detected noindex in meta robots or X-Robots-Tag' }],
        recommendation: 'If this page should appear in search, remove the noindex directive.',
        steps: [{ step: 'Find the directive', detail: 'Check <meta name="robots" content="noindex"> or X-Robots-Tag header.' }],
        effort: 'quick',
        priority: 50,
        source: 'crawler',
      });
    }

    // 7. Missing canonical tags (only on successful HTML pages)
    if (page.statusCode && page.statusCode === 200 && !page.canonical) {
      findings.push({
        title: `Missing canonical tag: ${page.url}`,
        category: 'technical',
        severity: 'medium',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page does not declare a canonical URL.',
        whyItMatters:
          'Without a canonical tag, search engines must guess which URL variation is the "main" one. This can lead to duplicate content issues and split ranking signals across URL variants (e.g. with/without trailing slash, with/without query params).',
        evidence: [{ source: 'crawler', detail: 'No <link rel="canonical"> found in <head>' }],
        recommendation: 'Add <link rel="canonical" href="https://…"> to the <head> of every indexable page.',
        steps: [
          { step: 'Determine canonical URL', detail: 'Pick the preferred URL variant (https, no trailing slash, no query params unless meaningful).' },
          { step: 'Add tag', detail: 'Insert <link rel="canonical" href="PREFERRED_URL" /> in <head>.' },
        ],
        effort: 'quick',
        priority: 65,
        source: 'crawler',
        documentationLinks: [
          { label: 'Canonical tags (Google)', url: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls' },
        ],
      });
    }

    // 8. Missing security headers
    const missingSecurityHeaders = ['strict-transport-security', 'content-security-policy', 'x-content-type-options'].filter(
      (h) => !page.securityHeaders[h],
    );
    if (page.statusCode === 200 && missingSecurityHeaders.length > 0) {
      findings.push({
        title: `Missing security headers on ${page.url}: ${missingSecurityHeaders.join(', ')}`,
        category: 'technical',
        severity: 'low',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: `The page is missing important security response headers: ${missingSecurityHeaders.join(', ')}.`,
        whyItMatters:
          'Security headers protect users from XSS, clickjacking, MIME-sniffing attacks, and downgrade attacks. While not a direct ranking factor, they affect user safety and trust signals.',
        evidence: missingSecurityHeaders.map((h) => ({ source: 'crawler', detail: `Missing header: ${h}` })),
        recommendation: 'Configure the server/CDN to emit the missing security headers on all responses.',
        steps: missingSecurityHeaders.map((h) => ({ step: `Add ${h}`, detail: `Configure server to emit the ${h} header.` })),
        effort: 'quick',
        priority: 25,
        source: 'crawler',
      });
    }

    // 9. Slow server response time
    if (page.responseTimeMs && page.responseTimeMs > AUDIT_THRESHOLDS.poorResponseTimeMs) {
      findings.push({
        title: `Slow server response time (${page.responseTimeMs}ms) on ${page.url}`,
        category: 'technical',
        severity: page.responseTimeMs > AUDIT_THRESHOLDS.poorResponseTimeMs * 2 ? 'medium' : 'low',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: `The server took ${page.responseTimeMs}ms to respond to the request, exceeding the ${AUDIT_THRESHOLDS.poorResponseTimeMs}ms threshold.`,
        whyItMatters:
          'Slow server response time (TTFB) is the foundation of page performance. Google recommends TTFB under 800ms. Slow responses hurt crawl budget, user experience, and conversion rates.',
        evidence: [{ source: 'crawler', detail: `Response time: ${page.responseTimeMs}ms` }],
        recommendation: 'Optimize server performance: enable caching, use a CDN, optimize database queries, upgrade hosting.',
        steps: [
          { step: 'Profile', detail: 'Use server profiling tools to identify slow queries or expensive operations.' },
          { step: 'Add caching', detail: 'Implement page caching, object caching, and CDN edge caching.' },
          { step: 'Optimize DB', detail: 'Index slow queries, consider read replicas for high-traffic sites.' },
        ],
        effort: 'significant',
        priority: 50,
        source: 'crawler',
      });
    }

    // 10. Hreflang errors
    if (!page.hreflangValid) {
      findings.push({
        title: `Invalid hreflang value on ${page.url}`,
        category: 'technical',
        severity: 'medium',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page declares hreflang alternate links with invalid language codes.',
        whyItMatters:
          'Invalid hreflang values are ignored by Google. This can prevent proper localization and may result in the wrong language version being shown to users.',
        evidence: [{ source: 'crawler', detail: 'Invalid hreflang format detected' }],
        recommendation: 'Use BCP 47 language codes (e.g. en, en-US, fr-CA) and include an x-default fallback.',
        steps: [{ step: 'Audit hreflang values', detail: 'Open the page source and review all hreflang attributes.' }],
        effort: 'quick',
        priority: 55,
        source: 'crawler',
      });
    }
  }

  // 11. Duplicate titles across pages
  const titleGroups = new Map<string, string[]>();
  for (const page of pages) {
    if (page.title && page.statusCode === 200) {
      const key = page.title.toLowerCase().trim();
      if (!titleGroups.has(key)) titleGroups.set(key, []);
      titleGroups.get(key)!.push(page.url);
    }
  }
  for (const [title, urls] of titleGroups.entries()) {
    if (urls.length > 1) {
      findings.push({
        title: `Duplicate title "${title}" across ${urls.length} pages`,
        category: 'technical',
        severity: urls.length > 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        affectedUrl: urls[0],
        description: `The title "${title}" appears on ${urls.length} different pages.`,
        whyItMatters:
          'Duplicate titles confuse search engines about which page is most relevant for the topic, can cause keyword cannibalization, and produce unhelpful search results.',
        evidence: urls.slice(0, 10).map((u) => ({ source: 'crawler', detail: u })),
        recommendation: 'Write a unique, descriptive title for each page reflecting its specific content.',
        steps: [{ step: 'Rewrite titles', detail: 'Make each title unique and descriptive of the page content.' }],
        effort: 'moderate',
        priority: 70,
        source: 'crawler',
      });
    }
  }

  return findings;
}

// =====================================================================
// B. ON-PAGE SEO AUDIT
// =====================================================================
export function auditOnPage(pages: CrawledPage[], _config: ScanConfig): IssueFinding[] {
  const findings: IssueFinding[] = [];
  for (const page of pages) {
    if (page.statusCode !== 200) continue;

    // 1. Missing title tag
    if (!page.title) {
      findings.push({
        title: `Missing title tag on ${page.url}`,
        category: 'onpage',
        severity: 'critical',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page does not have a <title> element in the <head>.',
        whyItMatters:
          'Title tags are the primary text shown in search results and a key relevance signal for search engines. Missing titles mean missed ranking opportunities and poor SERP appearance.',
        evidence: [{ source: 'crawler', detail: 'No <title> element found in <head>' }],
        recommendation: 'Add a unique, descriptive <title> of 50-60 characters to every page.',
        steps: [{ step: 'Add title', detail: 'Insert <title>Page Topic | Brand</title> in <head>.' }],
        effort: 'quick',
        priority: 95,
        source: 'crawler',
      });
    } else {
      // 2. Title length issues
      if (page.titleLength < AUDIT_THRESHOLDS.titleMinLength) {
        findings.push({
          title: `Title too short (${page.titleLength} chars) on ${page.url}`,
          category: 'onpage',
          severity: 'low',
          confidence: 'heuristic',
          affectedUrl: page.url,
          description: `The title "${page.title}" is only ${page.titleLength} characters, below the recommended minimum of ${AUDIT_THRESHOLDS.titleMinLength}.`,
          whyItMatters:
            'Short titles may not provide enough context to users or search engines. They may also appear unprofessional in search results.',
          evidence: [{ source: 'crawler', detail: `Title length: ${page.titleLength}` }],
          recommendation: 'Expand the title to include more descriptive keywords and the brand name.',
          steps: [{ step: 'Rewrite title', detail: 'Aim for 50-60 characters including primary keyword + brand.' }],
          effort: 'quick',
          priority: 40,
          source: 'crawler',
        });
      } else if (page.titleLength > AUDIT_THRESHOLDS.titleMaxLength) {
        findings.push({
          title: `Title too long (${page.titleLength} chars) on ${page.url}`,
          category: 'onpage',
          severity: 'low',
          confidence: 'heuristic',
          affectedUrl: page.url,
          description: `The title is ${page.titleLength} characters; Google typically truncates titles beyond ~60 characters.`,
          whyItMatters:
            'Long titles get truncated in search results, potentially hiding important keywords from users. Google may also rewrite them, reducing control over your SERP appearance.',
          evidence: [{ source: 'crawler', detail: `Title length: ${page.titleLength}` }],
          recommendation: 'Trim the title to 50-60 characters, keeping the primary keyword near the start.',
          steps: [{ step: 'Trim title', detail: 'Move the brand to the end and prioritize the primary keyword.' }],
          effort: 'quick',
          priority: 35,
          source: 'crawler',
        });
      }
    }

    // 3. Missing meta description
    if (!page.metaDescription) {
      findings.push({
        title: `Missing meta description on ${page.url}`,
        category: 'onpage',
        severity: 'high',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page does not have a meta description.',
        whyItMatters:
          'Meta descriptions appear under the title in search results and influence click-through rate. Google will auto-generate one when missing, but you lose control over the SERP copy.',
        evidence: [{ source: 'crawler', detail: 'No <meta name="description"> tag' }],
        recommendation: 'Write a unique meta description of 120-160 characters summarizing the page content.',
        steps: [{ step: 'Write description', detail: 'Insert <meta name="description" content="…"> in <head>.' }],
        effort: 'moderate',
        priority: 75,
        source: 'crawler',
      });
    } else {
      // 4. Meta description length issues
      if (page.metaDescriptionLength < AUDIT_THRESHOLDS.metaDescriptionMinLength) {
        findings.push({
          title: `Meta description too short (${page.metaDescriptionLength} chars) on ${page.url}`,
          category: 'onpage',
          severity: 'low',
          confidence: 'heuristic',
          affectedUrl: page.url,
          description: `The meta description is only ${page.metaDescriptionLength} characters; aim for ${AUDIT_THRESHOLDS.metaDescriptionMinLength}-${AUDIT_THRESHOLDS.metaDescriptionMaxLength}.`,
          whyItMatters:
            'Short descriptions may be ignored by Google in favor of auto-generated snippets. They also waste SERP real estate.',
          evidence: [{ source: 'crawler', detail: `Length: ${page.metaDescriptionLength}` }],
          recommendation: 'Expand the description to 120-160 characters with compelling copy and relevant keywords.',
          steps: [{ step: 'Rewrite', detail: 'Add benefit-driven copy with a call to action.' }],
          effort: 'moderate',
          priority: 40,
          source: 'crawler',
        });
      } else if (page.metaDescriptionLength > AUDIT_THRESHOLDS.metaDescriptionMaxLength) {
        findings.push({
          title: `Meta description too long (${page.metaDescriptionLength} chars) on ${page.url}`,
          category: 'onpage',
          severity: 'low',
          confidence: 'heuristic',
          affectedUrl: page.url,
          description: `The meta description is ${page.metaDescriptionLength} characters; Google truncates beyond ${AUDIT_THRESHOLDS.metaDescriptionMaxLength}.`,
          whyItMatters:
            'Truncated descriptions cut off your message. Users see "…" instead of the complete call-to-action.',
          evidence: [{ source: 'crawler', detail: `Length: ${page.metaDescriptionLength}` }],
          recommendation: 'Trim to under 160 characters while keeping the most compelling part first.',
          steps: [{ step: 'Trim', detail: 'Edit to 140-160 characters with key info up front.' }],
          effort: 'quick',
          priority: 35,
          source: 'crawler',
        });
      }
    }

    // 5. Missing H1
    if (page.h1Count === 0) {
      findings.push({
        title: `Missing H1 heading on ${page.url}`,
        category: 'onpage',
        severity: 'high',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page has no <h1> heading element.',
        whyItMatters:
          'The H1 is a key structural and semantic signal. It tells search engines and screen readers what the page is about. Missing H1 hurts both SEO and accessibility.',
        evidence: [{ source: 'crawler', detail: 'No <h1> found on page' }],
        recommendation: 'Add a single descriptive <h1> near the top of the <body>, mirroring or expanding the title tag.',
        steps: [{ step: 'Add H1', detail: 'Insert <h1>Primary topic of the page</h1> as the first heading.' }],
        effort: 'quick',
        priority: 80,
        source: 'crawler',
      });
    } else if (page.h1Count > 1) {
      // Multiple H1s — informational in HTML5 but worth flagging
      findings.push({
        title: `Multiple H1 headings (${page.h1Count}) on ${page.url}`,
        category: 'onpage',
        severity: 'low',
        confidence: 'heuristic',
        affectedUrl: page.url,
        description: `The page has ${page.h1Count} <h1> elements. HTML5 allows this but it can dilute topical focus.`,
        whyItMatters:
          'While HTML5 technically permits multiple H1s, best practice is one H1 per page to clearly signal the page\'s primary topic to search engines and assistive tech.',
        evidence: [{ source: 'crawler', detail: `H1 count: ${page.h1Count}` }],
        recommendation: 'Keep one H1 as the page\'s main heading; demote others to H2.',
        steps: [{ step: 'Audit headings', detail: 'Identify which H1 is the primary topic and convert others to H2.' }],
        effort: 'quick',
        priority: 35,
        source: 'crawler',
      });
    }

    // 6. Heading hierarchy issues
    if (!page.headingHierarchyOk) {
      findings.push({
        title: `Heading hierarchy issue on ${page.url}`,
        category: 'onpage',
        severity: 'medium',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'An H2 (or higher) heading appears before the first H1 on the page.',
        whyItMatters:
          'Improper heading order confuses screen readers and search engines about content structure. It can affect accessibility compliance and content interpretation.',
        evidence: [{ source: 'crawler', detail: 'H2 detected before first H1' }],
        recommendation: 'Ensure the H1 appears first, then H2s nest under it, H3s under H2s, etc.',
        steps: [{ step: 'Reorder headings', detail: 'Move the H1 above all H2 elements in the source order.' }],
        effort: 'quick',
        priority: 50,
        source: 'crawler',
      });
    }

    // 7. Images without alt text
    if (page.imagesWithoutAlt > 0) {
      findings.push({
        title: `${page.imagesWithoutAlt} image(s) without alt text on ${page.url}`,
        category: 'onpage',
        severity: page.imagesWithoutAlt > 5 ? 'high' : 'medium',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: `The page has ${page.imagesWithoutAlt} of ${page.imageCount} images without an alt attribute.`,
        whyItMatters:
          'Alt text describes images for screen readers (accessibility) and helps search engines understand image content (image SEO). Missing alt is an accessibility failure (WCAG) and missed SEO opportunity.',
        evidence: [{ source: 'crawler', detail: `${page.imagesWithoutAlt}/${page.imageCount} images missing alt` }],
        recommendation: 'Add descriptive alt text to all meaningful images. Use empty alt="" for purely decorative images.',
        steps: [
          { step: 'Identify images', detail: 'Use browser DevTools or an accessibility checker to find images missing alt.' },
          { step: 'Write alt text', detail: 'Describe the image content and purpose in 1-2 sentences.' },
        ],
        effort: 'moderate',
        priority: 60,
        source: 'crawler',
        documentationLinks: [
          { label: 'Image alt text (W3C)', url: 'https://www.w3.org/WAI/tutorials/images/' },
        ],
      });
    }

    // 8. Missing Open Graph
    if (!page.openGraphValid) {
      findings.push({
        title: `Missing Open Graph metadata on ${page.url}`,
        category: 'onpage',
        severity: 'low',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page does not declare complete Open Graph metadata (og:title, og:url, og:image).',
        whyItMatters:
          'Open Graph tags control how your page appears when shared on social media (Facebook, LinkedIn, Slack, etc.). Missing OG tags result in poor social share previews.',
        evidence: [{ source: 'crawler', detail: 'No og:title/og:url/og:image detected' }],
        recommendation: 'Add og:title, og:description, og:url, and og:image meta tags in the <head>.',
        steps: [
          { step: 'Add tags', detail: 'Insert <meta property="og:title" content="…"> etc. in <head>.' },
          { step: 'Set image', detail: 'Use a 1200x630 image for og:image.' },
        ],
        effort: 'moderate',
        priority: 30,
        source: 'crawler',
      });
    }

    // 9. Missing structured data
    if (page.schemaTypes.length === 0) {
      findings.push({
        title: `No structured data (Schema.org) on ${page.url}`,
        category: 'onpage',
        severity: 'low',
        confidence: 'confirmed',
        affectedUrl: page.url,
        description: 'The page does not contain any JSON-LD or microdata structured data.',
        whyItMatters:
          'Structured data helps search engines understand your content and unlock rich results (reviews, FAQ, breadcrumbs, sitelinks). Without it, you miss enhanced SERP features.',
        evidence: [{ source: 'crawler', detail: 'No JSON-LD scripts or microdata itemtype attributes detected' }],
        recommendation: 'Add JSON-LD structured data appropriate to the page type (Article, BreadcrumbList, Organization, FAQPage, Product, etc.).',
        steps: [
          { step: 'Identify type', detail: 'Determine the Schema.org type that fits the page (Article, Product, FAQ, etc.).' },
          { step: 'Add JSON-LD', detail: 'Insert <script type="application/ld+json">{…}</script> in <head> or <body>.' },
          { step: 'Validate', detail: 'Test with Google\'s Rich Results Test: https://search.google.com/test/rich-results' },
        ],
        effort: 'moderate',
        priority: 35,
        source: 'crawler',
        documentationLinks: [
          { label: 'Schema.org full reference', url: 'https://schema.org/' },
          { label: 'Structured data docs (Google)', url: 'https://developers.google.com/search/docs/appearance/structured-data' },
        ],
      });
    }

    // 10. Poor internal linking
    if (page.internalLinks < 3) {
      findings.push({
        title: `Low internal linking (${page.internalLinks} links) on ${page.url}`,
        category: 'onpage',
        severity: 'low',
        confidence: 'heuristic',
        affectedUrl: page.url,
        description: `The page has only ${page.internalLinks} internal links. Most pages benefit from at least 3-5 internal links for context.`,
        whyItMatters:
          'Internal links distribute link equity and help search engines discover related content. Pages with very few internal links may be deprioritized in crawl budget and ranking.',
        evidence: [{ source: 'crawler', detail: `Internal link count: ${page.internalLinks}` }],
        recommendation: 'Add contextual internal links to relevant related pages, especially from high-traffic pages.',
        steps: [{ step: 'Identify related content', detail: 'Find topically related pages and link to them with descriptive anchor text.' }],
        effort: 'moderate',
        priority: 30,
        source: 'crawler',
      });
    }
  }
  return findings;
}

// =====================================================================
// C. CONTENT SEO AUDIT
// =====================================================================
export function auditContent(pages: CrawledPage[], _config: ScanConfig): IssueFinding[] {
  const findings: IssueFinding[] = [];
  for (const page of pages) {
    if (page.statusCode !== 200) continue;

    // 1. Thin content
    if (page.wordCount > 0 && page.wordCount < AUDIT_THRESHOLDS.contentMinWords) {
      findings.push({
        title: `Thin content (${page.wordCount} words) on ${page.url}`,
        category: 'content',
        severity: page.wordCount < 100 ? 'high' : 'medium',
        confidence: 'heuristic',
        affectedUrl: page.url,
        description: `The page has only ${page.wordCount} words of body content, below the ${AUDIT_THRESHOLDS.contentMinWords}-word heuristic minimum.`,
        whyItMatters:
          'Pages with very little content offer limited value to users and may be considered thin content by search engines. They typically rank poorly and waste crawl budget.',
        evidence: [{ source: 'crawler', detail: `Word count: ${page.wordCount}` }],
        recommendation: 'Expand the content to fully cover the topic, or consider merging with a related page.',
        steps: [
          { step: 'Audit content', detail: 'Identify what users would want to know about the topic.' },
          { step: 'Expand', detail: 'Add comprehensive sections answering common questions.' },
          { step: 'Or merge', detail: 'If the page is redundant, 301 redirect to a more comprehensive page.' },
        ],
        effort: 'significant',
        priority: 55,
        source: 'crawler',
      });
    } else if (page.wordCount > 0 && page.wordCount < AUDIT_THRESHOLDS.contentRecommendedWords) {
      findings.push({
        title: `Below-recommended content length (${page.wordCount} words) on ${page.url}`,
        category: 'content',
        severity: 'low',
        confidence: 'heuristic',
        affectedUrl: page.url,
        description: `The page has ${page.wordCount} words. Most informational pages benefit from ${AUDIT_THRESHOLDS.contentRecommendedWords}+ words.`,
        whyItMatters:
          'Long-form content tends to perform better for informational queries because it covers the topic comprehensively. However, length alone does not guarantee quality.',
        evidence: [{ source: 'crawler', detail: `Word count: ${page.wordCount}` }],
        recommendation: 'Consider expanding the content with additional sections, examples, or related subtopics.',
        steps: [{ step: 'Review SERP', detail: 'Look at top-ranking pages for the same topic to gauge appropriate depth.' }],
        effort: 'moderate',
        priority: 30,
        source: 'crawler',
      });
    }
  }

  // 2. Duplicate content detection (simhash-like — title + first words match)
  // For MVP: flag pages with identical titles AND word counts
  const groups = new Map<string, string[]>();
  for (const page of pages) {
    if (page.statusCode !== 200 || !page.title || page.wordCount === 0) continue;
    const key = `${page.title.toLowerCase().trim()}|${page.wordCount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(page.url);
  }
  for (const [key, urls] of groups.entries()) {
    if (urls.length > 1) {
      const title = key.split('|')[0];
      findings.push({
        title: `Potential duplicate content: ${urls.length} pages share title and length`,
        category: 'content',
        severity: 'medium',
        confidence: 'likely',
        affectedUrl: urls[0],
        description: `${urls.length} pages share the same title ("${title}") and word count, suggesting near-duplicate content.`,
        whyItMatters:
          'Near-duplicate content can confuse search engines about which page to rank, dilute link equity, and waste crawl budget. Google may consolidate these pages into one URL of its choosing.',
        evidence: urls.slice(0, 10).map((u) => ({ source: 'crawler', detail: u })),
        recommendation: 'Differentiate the pages (unique angles, deeper content) OR consolidate via 301 redirect to a canonical version.',
        steps: [
          { step: 'Compare pages', detail: 'Open each URL and compare content angle.' },
          { step: 'Consolidate', detail: 'If pages are truly duplicates, 301 redirect all but one to the canonical URL.' },
          { step: 'Differentiate', detail: 'If topics overlap but are distinct, expand each to be clearly unique.' },
        ],
        effort: 'moderate',
        priority: 55,
        source: 'crawler',
      });
    }
  }

  return findings;
}

// =====================================================================
// D. PERFORMANCE / CORE WEB VITALS AUDIT
// =====================================================================
export function auditPerformance(performanceData: NormalizedSEOData | null): IssueFinding[] {
  const findings: IssueFinding[] = [];
  if (!performanceData || !performanceData.performance) {
    findings.push({
      title: 'Performance data unavailable',
      category: 'performance',
      severity: 'informational',
      confidence: 'confirmed',
      description: 'No performance metrics could be retrieved. Configure Google PageSpeed Insights to enable performance auditing.',
      whyItMatters:
        'Performance is a confirmed ranking signal and a critical UX factor. Without performance data, this audit cannot identify optimization opportunities.',
      evidence: [{ source: 'system', detail: 'No provider supplied performance data' }],
      recommendation: 'Configure Google PageSpeed Insights in Settings (free API).',
      steps: [{ step: 'Open Settings', detail: 'Add a Google API key with PageSpeed Insights enabled.' }],
      effort: 'quick',
      priority: 20,
      source: 'system',
    });
    return findings;
  }

  for (const metric of performanceData.performance) {
    const { url, strategy, lcp, inp, cls, fcp, tbt, performanceScore, hasFieldData } = metric;
    const strategyLabel = strategy === 'mobile' ? 'Mobile' : 'Desktop';

    // LCP
    if (lcp !== undefined && lcp > AUDIT_THRESHOLDS.poorLcp) {
      findings.push({
        title: `Poor LCP (${(lcp / 1000).toFixed(2)}s) on ${url} (${strategyLabel})`,
        category: 'performance',
        severity: lcp > AUDIT_THRESHOLDS.poorLcp * 1.5 ? 'high' : 'medium',
        confidence: hasFieldData ? 'confirmed' : 'likely',
        affectedUrl: url,
        description: `Largest Contentful Paint is ${lcp}ms; poor when > ${AUDIT_THRESHOLDS.poorLcp}ms.${hasFieldData ? ' (field data from CrUX)' : ' (lab data from Lighthouse)'}`,
        whyItMatters:
          'LCP measures perceived loading speed. Poor LCP correlates with higher bounce rates and lower search rankings. Google uses LCP as a Core Web Vital.',
        evidence: [{ source: 'pagespeed', detail: `LCP: ${lcp}ms (${hasFieldData ? 'field' : 'lab'})` }],
        recommendation: 'Optimize server response, preload the LCP element, compress images, remove render-blocking resources.',
        steps: [
          { step: 'Identify LCP element', detail: 'Use Lighthouse or Chrome DevTools to find which element is largest.' },
          { step: 'Optimize that resource', detail: 'Preload it, compress it, serve via CDN.' },
          { step: 'Reduce TTFB', detail: 'Optimize server, use CDN edge caching.' },
        ],
        effort: 'significant',
        priority: 75,
        source: 'pagespeed',
        documentationLinks: [{ label: 'Optimize LCP (Google)', url: 'https://web.dev/articles/lcp' }],
      });
    } else if (lcp !== undefined && lcp > AUDIT_THRESHOLDS.goodLcp && lcp <= AUDIT_THRESHOLDS.poorLcp) {
      findings.push({
        title: `LCP needs improvement (${(lcp / 1000).toFixed(2)}s) on ${url} (${strategyLabel})`,
        category: 'performance',
        severity: 'low',
        confidence: hasFieldData ? 'confirmed' : 'likely',
        affectedUrl: url,
        description: `LCP is ${lcp}ms; between ${AUDIT_THRESHOLDS.goodLcp}ms (good) and ${AUDIT_THRESHOLDS.poorLcp}ms (poor).`,
        whyItMatters: 'Marginal LCP scores are at risk of becoming "poor" with minor changes. Optimization now prevents future regressions.',
        evidence: [{ source: 'pagespeed', detail: `LCP: ${lcp}ms` }],
        recommendation: 'Apply the same optimizations as for poor LCP — preload LCP resource, optimize images.',
        steps: [{ step: 'Audit', detail: 'Run Lighthouse and review LCP element.' }],
        effort: 'moderate',
        priority: 40,
        source: 'pagespeed',
      });
    }

    // INP
    if (inp !== undefined && inp > AUDIT_THRESHOLDS.poorInp) {
      findings.push({
        title: `Poor INP (${inp}ms) on ${url} (${strategyLabel})`,
        category: 'performance',
        severity: 'high',
        confidence: hasFieldData ? 'confirmed' : 'likely',
        affectedUrl: url,
        description: `Interaction to Next Paint is ${inp}ms; poor when > ${AUDIT_THRESHOLDS.poorInp}ms.`,
        whyItMatters:
          'INP measures interactivity. High INP means users perceive the page as unresponsive. INP replaced FID as a Core Web Vital in March 2024.',
        evidence: [{ source: 'pagespeed', detail: `INP: ${inp}ms` }],
        recommendation: 'Reduce JavaScript execution time, break up long tasks, use a web worker for heavy computation.',
        steps: [
          { step: 'Find long tasks', detail: 'Use DevTools Performance tab to identify tasks > 50ms.' },
          { step: 'Optimize', detail: 'Defer non-critical JS, code-split, lazy-load below-the-fold widgets.' },
        ],
        effort: 'significant',
        priority: 70,
        source: 'pagespeed',
        documentationLinks: [{ label: 'Optimize INP (Google)', url: 'https://web.dev/articles/inp' }],
      });
    }

    // CLS
    if (cls !== undefined && cls > AUDIT_THRESHOLDS.poorCls) {
      findings.push({
        title: `Poor CLS (${cls.toFixed(3)}) on ${url} (${strategyLabel})`,
        category: 'performance',
        severity: 'medium',
        confidence: hasFieldData ? 'confirmed' : 'likely',
        affectedUrl: url,
        description: `Cumulative Layout Shift is ${cls.toFixed(3)}; poor when > ${AUDIT_THRESHOLDS.poorCls}.`,
        whyItMatters:
          'CLS measures visual stability. High CLS causes content to jump as the page loads, frustrating users and increasing accidental clicks. It is a Core Web Vital.',
        evidence: [{ source: 'pagespeed', detail: `CLS: ${cls.toFixed(3)}` }],
        recommendation: 'Reserve space for images/ads/embeds, avoid inserting content above existing content, preload fonts.',
        steps: [
          { step: 'Set dimensions', detail: 'Always set width/height on images and aspect-ratio CSS.' },
          { step: 'Reserve ad slots', detail: 'Pre-define ad container sizes.' },
          { step: 'Preload fonts', detail: 'Use <link rel="preload" as="font">.' },
        ],
        effort: 'moderate',
        priority: 60,
        source: 'pagespeed',
        documentationLinks: [{ label: 'Optimize CLS (Google)', url: 'https://web.dev/articles/cls' }],
      });
    }

    // Opportunities from Lighthouse
    if (metric.opportunities) {
      for (const opp of metric.opportunities.slice(0, 10)) {
        if ((opp.savingsMs ?? 0) > 500) {
          findings.push({
            title: `${opp.title} on ${url} (${strategyLabel})`,
            category: 'performance',
            severity: opp.savingsMs! > 2000 ? 'medium' : 'low',
            confidence: 'likely',
            affectedUrl: url,
            description: `${opp.description || opp.title}. Estimated savings: ${opp.savingsMs}ms.`,
            whyItMatters: `Lighthouse estimates this opportunity could save ${opp.savingsMs}ms of load time.`,
            evidence: [{ source: 'pagespeed', detail: `Opportunity: ${opp.id}, savings: ${opp.savingsMs}ms` }],
            recommendation: opp.description || 'Apply the recommended optimization.',
            steps: [{ step: 'Review details', detail: opp.title }],
            effort: 'moderate',
            priority: 35,
            source: 'pagespeed',
          });
        }
      }
    }

    // Overall performance score
    if (performanceScore !== undefined && performanceScore < 50) {
      findings.push({
        title: `Low Lighthouse performance score (${performanceScore}/100) on ${url} (${strategyLabel})`,
        category: 'performance',
        severity: 'high',
        confidence: 'likely',
        affectedUrl: url,
        description: `Lighthouse performance score is ${performanceScore}/100 (poor: <50).`,
        whyItMatters: 'A low Lighthouse score indicates multiple performance issues affecting user experience and search rankings.',
        evidence: [{ source: 'pagespeed', detail: `Performance score: ${performanceScore}` }],
        recommendation: 'Run Lighthouse in Chrome DevTools to see the full audit report with specific recommendations.',
        steps: [{ step: 'Run Lighthouse', detail: 'Open DevTools → Lighthouse tab → run report.' }],
        effort: 'significant',
        priority: 70,
        source: 'pagespeed',
      });
    }
  }
  return findings;
}

// =====================================================================
// E. BACKLINK AUDIT (uses Ahrefs/Moz/etc when configured)
// =====================================================================
export function auditBacklinks(providerData: NormalizedSEOData | null, providerName: string): IssueFinding[] {
  const findings: IssueFinding[] = [];
  if (!providerData || !providerData.backlinks || providerData.backlinks.length === 0) {
    findings.push({
      title: 'Backlink data unavailable',
      category: 'backlinks',
      severity: 'informational',
      confidence: 'confirmed',
      description: 'No backlink data could be retrieved. Backlink analysis requires a commercial SEO provider (Ahrefs, Moz, Majestic).',
      whyItMatters:
        'Backlinks remain a strong ranking signal. Without a backlink data source, this audit cannot identify referring domains, anchor text distribution, or new/lost links.',
      evidence: [{ source: 'system', detail: 'No provider supplied backlink data' }],
      recommendation: 'Configure Ahrefs, Moz, or Majestic in Settings (all require paid subscriptions).',
      steps: [{ step: 'Open Settings', detail: 'Configure a backlink provider with valid API credentials.' }],
      effort: 'quick',
      priority: 15,
      source: 'system',
    });
    return findings;
  }

  const backlinks = providerData.backlinks;
  // Note: do not label backlinks as "toxic" arbitrarily
  // We just report on the volume and notable features

  // Low backlink count
  if (backlinks.length < 10) {
    findings.push({
      title: `Low backlink count (${backlinks.length} reported by ${providerName})`,
      category: 'backlinks',
      severity: 'medium',
      confidence: 'likely',
      description: `${providerName} reports ${backlinks.length} backlinks pointing to this site. Note: this is a partial index, not the entire web.`,
      whyItMatters:
        'A low backlink count may indicate limited link popularity, which can affect ranking competitiveness. However, quality matters more than quantity.',
      evidence: [{ source: providerName, detail: `Backlinks reported: ${backlinks.length}` }],
      recommendation: 'Focus on earning high-quality, topically relevant backlinks through content marketing, digital PR, and partnerships.',
      steps: [
        { step: 'Audit existing backlinks', detail: 'Identify your strongest referring domains.' },
        { step: 'Find link opportunities', detail: 'Research competitor backlinks; pursue similar sources.' },
        { step: 'Create linkable assets', detail: 'Publish original research, tools, or guides that attract natural links.' },
      ],
      effort: 'significant',
      priority: 50,
      source: providerName,
      documentationLinks: [{ label: 'Link building best practices (Google)', url: 'https://developers.google.com/search/docs/crawling-indexing/link-practices' }],
    });
  }

  // Anchor text diversity
  const anchors = new Set(backlinks.map((b) => b.anchorText?.toLowerCase()).filter(Boolean));
  if (backlinks.length > 0 && anchors.size / backlinks.length < 0.2) {
    findings.push({
      title: `Low anchor text diversity (only ${anchors.size} unique anchors across ${backlinks.length} backlinks)`,
      category: 'backlinks',
      severity: 'medium',
      confidence: 'likely',
      description: `Most backlinks use the same anchor text, suggesting an over-optimized link profile.`,
      whyItMatters:
        'Over-optimized anchor text is a signal of unnatural link building and may trigger Google\'s spam algorithms. Natural backlink profiles have diverse anchors including branded, naked URL, and partial-match anchors.',
      evidence: [{ source: providerName, detail: `${anchors.size} unique anchors / ${backlinks.length} backlinks` }],
      recommendation: 'Diversify anchor text by earning natural editorial links rather than keyword-stuffed links.',
      steps: [
        { step: 'Audit anchor distribution', detail: 'Group anchors by type (branded, exact match, partial, generic).' },
        { step: 'Adjust strategy', detail: 'Pursue natural link building methods that produce branded anchors.' },
      ],
      effort: 'significant',
      priority: 45,
      source: providerName,
    });
  }

  return findings;
}

// =====================================================================
// F. KEYWORD / SEARCH VISIBILITY AUDIT
// =====================================================================
export function auditKeywords(providerData: NormalizedSEOData | null, providerName: string): IssueFinding[] {
  const findings: IssueFinding[] = [];
  if (!providerData || !providerData.keywords || providerData.keywords.length === 0) {
    findings.push({
      title: 'Search visibility data unavailable',
      category: 'keywords',
      severity: 'informational',
      confidence: 'confirmed',
      description: `No search performance data could be retrieved. Keyword analysis requires Search Console, Bing Webmaster, or a commercial keyword API.`,
      whyItMatters:
        'Without search visibility data, this audit cannot identify which queries drive traffic, which pages underperform, or where keyword opportunities exist.',
      evidence: [{ source: 'system', detail: 'No provider supplied keyword data' }],
      recommendation: 'Authorize Google Search Console (requires ownership of the audited site) or Bing Webmaster Tools in Settings.',
      steps: [{ step: 'Open Settings', detail: 'Configure Search Console (OAuth) or Bing Webmaster (API key).' }],
      effort: 'quick',
      priority: 15,
      source: 'system',
    });
    return findings;
  }

  const keywords = providerData.keywords;
  // High impressions, low CTR
  const lowCtr = keywords.filter((k) => k.impressions > 100 && k.ctr < 1.0);
  for (const kw of lowCtr.slice(0, 5)) {
    findings.push({
      title: `Low CTR on "${kw.query}" (${kw.ctr.toFixed(1)}%, ${kw.impressions} impressions)`,
      category: 'keywords',
      severity: 'medium',
      confidence: 'confirmed',
      description: `The query "${kw.query}" generates ${kw.impressions} impressions but only ${kw.ctr.toFixed(1)}% CTR.`,
      whyItMatters:
        'A high-impression / low-CTR query suggests the page is showing up in search but users aren\'t clicking. This often means the title or description is not compelling, or the query intent doesn\'t match the page.',
      evidence: [{ source: providerName, detail: `Query: ${kw.query}, impressions: ${kw.impressions}, CTR: ${kw.ctr}%, position: ${kw.position.toFixed(1)}` }],
      recommendation: 'Improve the title tag and meta description to better match the query intent and entice clicks.',
      steps: [
        { step: 'Review SERP', detail: `Search Google for "${kw.query}" and see how your snippet compares to competitors.` },
        { step: 'Rewrite title/description', detail: 'Make them more compelling and aligned with query intent.' },
      ],
      effort: 'quick',
      priority: 55,
      source: providerName,
    });
  }

  // High position queries with low impressions (potential opportunity)
  const highPosition = keywords.filter((k) => k.position > 0 && k.position < 10 && k.impressions < 50);
  for (const kw of highPosition.slice(0, 5)) {
    findings.push({
      title: `"${kw.query}" ranks on page 1 (position ${k.position.toFixed(1)}) but has low impressions (${k.impressions})`,
      category: 'keywords',
      severity: 'low',
      confidence: 'likely',
      description: `The query "${kw.query}" appears on the first page of search results at position ${k.position.toFixed(1)}, but generates only ${k.impressions} impressions.`,
      whyItMatters:
        'Low impressions despite a high position suggests the query has low search volume OR your pages are being filtered (e.g. by country, personalization). It may also indicate an opportunity to expand content for related higher-volume queries.',
      evidence: [{ source: providerName, detail: `Position: ${kw.position}, impressions: ${kw.impressions}` }],
      recommendation: 'Check the query\'s search volume with a keyword tool. Consider expanding the page to target related queries.',
      steps: [{ step: 'Check volume', detail: 'Use Google Keyword Planner or a commercial tool to verify search volume.' }],
      effort: 'moderate',
      priority: 30,
      source: providerName,
    });
  }

  return findings;
}
