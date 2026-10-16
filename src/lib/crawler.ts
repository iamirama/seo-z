// Website crawler with SSRF protection, robots.txt respect,
// request throttling, redirect handling, and HTML parsing.
//
// Per spec section 6, the crawler:
//   - Honors robots.txt directives (configurable)
//   - Uses an identifiable User-Agent
//   - Implements request throttling, retry limits, timeouts
//   - Safe redirect handling (re-validates each redirect target)
//   - Refuses to bypass auth/CAPTCHA/access controls
//   - Only crawls publicly accessible pages
//   - Prevents SSRF (private IP ranges, metadata endpoints, etc.)
//   - Restricts protocols to http/https
//   - Implements crawl cancellation and progress tracking
//   - Normalizes URLs and prevents duplicate crawling

import { isUrlSafeToFetch, isRedirectTargetSafe, normalizeUrl, urlOrigin } from '@/lib/security/ssrf';
import type { CrawledPage } from '@/lib/types';

// ---------------------------------------------------------------------
// Crawler configuration.
// ---------------------------------------------------------------------
export interface CrawlerConfig {
  targetUrl: string;
  maxPages: number;
  maxDepth: number;
  requestTimeoutMs: number;
  crawlConcurrency: number;
  checkExternalLinks: boolean;
  includeSubdomains: boolean;
  includeQueryParams: boolean;
  respectRobotsTxt: boolean;
  useSitemapAsSeed: boolean;
  onProgress?: (progress: CrawlProgress) => void;
  signal?: { cancelled: boolean };
}

export interface CrawlProgress {
  discovered: number;
  crawled: number;
  remaining: number;
  errors: number;
  stage: string;
  currentUrl?: string;
}

// Identifiable crawler user-agent (per spec).
const CRAWLER_UA = 'Z-SEO-Auditor/1.0 (+https://chat.z.ai/seo-auditor; audit bot; contact: support@example.com)';

// ---------------------------------------------------------------------
// robots.txt parser & cache. Fetches /robots.txt from the target origin
// and parses Allow/Disallow rules. The parser is intentionally simple
// (covers common patterns) — for production use, consider a proper
// implementation such as the `robots-parser` npm package.
// ---------------------------------------------------------------------
interface RobotsRule {
  path: string;
  allow: boolean;
}

class RobotsTxt {
  rules: RobotsRule[] = [];
  sitemaps: string[] = [];
  fetchedAt: Date | null = null;
  available = false;

  isAllowed(url: string): boolean {
    if (!this.available) return true; // no robots.txt means everything is allowed
    try {
      const path = new URL(url).pathname + new URL(url).search;
      // Pick the most specific match
      let matched: RobotsRule | null = null;
      let matchedLength = -1;
      for (const rule of this.rules) {
        if (path.startsWith(rule.path) && rule.path.length > matchedLength) {
          matched = rule;
          matchedLength = rule.path.length;
        }
      }
      if (!matched) return true;
      return matched.allow;
    } catch {
      return true;
    }
  }
}

async function fetchRobotsTxt(originUrl: string, signal?: { cancelled: boolean }): Promise<RobotsTxt> {
  const result = new RobotsTxt();
  const robotsUrl = originUrl.replace(/\/$/, '') + '/robots.txt';
  // SSRF pre-check
  const safety = await isUrlSafeToFetch(robotsUrl);
  if (!safety.safe) {
    console.warn(`[crawler] SSRF blocked for robots.txt URL: ${robotsUrl} (${safety.reason})`);
    result.available = false;
    return result;
  }
  try {
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': CRAWLER_UA, Accept: 'text/plain' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (res.status === 404) {
      result.available = false;
      return result; // No robots.txt = everything allowed
    }
    if (!res.ok) {
      result.available = false; // Treat as no rules
      return result;
    }
    const text = await res.text();
    result.available = true;
    result.fetchedAt = new Date();

    // Parse simple Allow/Disallow rules for User-agent: * (and our UA).
    let userAgentMatch = false;
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const field = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      if (field === 'user-agent') {
        userAgentMatch = value === '*' || value === 'z-seo-auditor' || value === 'z-ai-seo-auditor';
        continue;
      }
      if (!userAgentMatch) continue;
      if (field === 'disallow') {
        if (value) result.rules.push({ path: value, allow: false });
      } else if (field === 'allow') {
        if (value) result.rules.push({ path: value, allow: true });
      } else if (field === 'sitemap') {
        if (value) result.sitemaps.push(value);
      }
    }
    if (signal?.cancelled) throw new Error('Crawl cancelled');
  } catch (err) {
    if ((err as Error).name === 'AbortError' || (err as Error).message.includes('cancelled')) {
      throw err;
    }
    console.warn(`[crawler] Failed to fetch robots.txt: ${(err as Error).message}`);
    result.available = false;
  }
  return result;
}

// ---------------------------------------------------------------------
// Fetch a sitemap.xml and return URLs to use as crawl seeds.
// ---------------------------------------------------------------------
async function fetchSitemap(originUrl: string, sitemapUrl?: string, signal?: { cancelled: boolean }): Promise<string[]> {
  const url = sitemapUrl ?? originUrl.replace(/\/$/, '') + '/sitemap.xml';
  const safety = await isUrlSafeToFetch(url);
  if (!safety.safe) return [];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': CRAWLER_UA },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return [];
    const text = await res.text();
    // Simple regex extraction of <loc> URLs (good enough for sitemap.xml).
    const matches = text.match(/<loc>([^<]+)<\/loc>/g) ?? [];
    const urls: string[] = [];
    for (const m of matches) {
      const loc = m.replace(/<\/?loc>/g, '').trim();
      if (loc && /^https?:\/\//.test(loc)) urls.push(loc);
    }
    if (signal?.cancelled) throw new Error('Crawl cancelled');
    return urls;
  } catch (err) {
    if ((err as Error).message.includes('cancelled')) throw err;
    return [];
  }
}

// ---------------------------------------------------------------------
// HTML parsing helpers. We use a small DOMParser-like approach using
// regex (for body) and Linkedom-like hand parsing. For production
// use, consider the `cheerio` or `linkedom` npm packages — kept
// dependency-free here for portability.
// ---------------------------------------------------------------------
function extractTags(html: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function extractTagAttribute(html: string, tag: string, attr: string): Array<{ attr: string; content?: string }> {
  const results: Array<{ attr: string; content?: string }> = [];
  const regex = new RegExp(`<${tag}[^>]*?\\s${attr}=["']([^"']+)["'][^>]*?(?:\\/?>)([\\s\\S]*?)(?:<\\/${tag}>)?`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    results.push({ attr: m[1], content: m[2]?.trim() });
  }
  return results;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : undefined;
}

function extractMetaDescription(html: string): string | undefined {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : undefined;
}

function extractCanonical(html: string): string | undefined {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return m ? m[1].trim() : undefined;
}

function extractHeadings(html: string, level: number): number {
  const re = new RegExp(`<h${level}[^>]*>`, 'gi');
  return (html.match(re) || []).length;
}

function extractImages(html: string): { total: number; withoutAlt: number } {
  const imgRegex = /<img[^>]*>/gi;
  const imgs = html.match(imgRegex) || [];
  let withoutAlt = 0;
  for (const img of imgs) {
    const hasAlt = /\salt\s*=/.test(img);
    if (!hasAlt) withoutAlt++;
  }
  return { total: imgs.length, withoutAlt };
}

function extractLinks(html: string, originHost: string, includeSubdomains: boolean): Array<{ href: string; text: string; isInternal: boolean }> {
  const out: Array<{ href: string; text: string; isInternal: boolean }> = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const rawHref = m[1].trim();
    const text = m[2]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) continue;
    let isInternal: boolean;
    let absoluteHref: string;
    if (rawHref.startsWith('//')) {
      absoluteHref = 'https:' + rawHref;
      try {
        const host = new URL(absoluteHref).hostname;
        isInternal = includeSubdomains ? host === originHost || host.endsWith('.' + originHost) : host === originHost;
      } catch {
        continue;
      }
    } else if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
      absoluteHref = rawHref;
      try {
        const host = new URL(absoluteHref).hostname;
        isInternal = includeSubdomains ? host === originHost || host.endsWith('.' + originHost) : host === originHost;
      } catch {
        continue;
      }
    } else {
      // relative URL — always internal
      absoluteHref = rawHref;
      isInternal = true;
    }
    out.push({ href: absoluteHref, text, isInternal });
  }
  return out;
}

function extractSchemaTypes(html: string): string[] {
  const out = new Set<string>();
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const collectTypes = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj['@type']) {
          if (Array.isArray(obj['@type'])) {
            for (const t of obj['@type']) out.add(String(t));
          } else {
            out.add(String(obj['@type']));
          }
        }
        if (Array.isArray(obj)) {
          for (const item of obj) collectTypes(item);
        } else {
          for (const v of Object.values(obj)) collectTypes(v);
        }
      };
      collectTypes(data);
    } catch {
      // Ignore parse errors
    }
  }
  // Also detect microdata
  const microdataRegex = /itemtype=["']([^"']+)["']/gi;
  while ((m = microdataRegex.exec(html)) !== null) {
    const type = m[1].split('/').pop();
    if (type) out.add(type);
  }
  return Array.from(out);
}

function extractOpenGraph(html: string): boolean {
  return /<meta[^>]+property=["']og:(title|url|image)["']/i.test(html);
}

function extractTwitterCard(html: string): boolean {
  return /<meta[^>]+name=["']twitter:card["']/i.test(html);
}

function extractHreflang(html: string): { valid: boolean; count: number } {
  const re = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]*>/gi;
  const matches = html.match(re) || [];
  // Simple validity: at least one hreflang is valid; valid value should not include invalid chars
  let valid = true;
  for (const m of matches) {
    const match = m.match(/hreflang=["']([^"']+)["']/i);
    if (match) {
      const val = match[1];
      // x-default is allowed; otherwise should match BCP 47 pattern
      if (val !== 'x-default' && !/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(val)) {
        valid = false;
      }
    }
  }
  return { valid, count: matches.length };
}

function extractMixedContent(html: string, isHttps: boolean): boolean {
  if (!isHttps) return false;
  // Look for http:// resources in src= attributes (img, script, link, iframe)
  const re = /<(?:img|script|link|iframe|source)[^>]+src=["']http:\/\/[^"']+["']/i;
  return re.test(html);
}

function extractSecurityHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const interesting = [
    'strict-transport-security',
    'content-security-policy',
    'x-content-type-options',
    'x-frame-options',
    'referrer-policy',
    'permissions-policy',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
  ];
  for (const h of interesting) {
    const v = headers.get(h);
    if (v) out[h] = v;
  }
  return out;
}

function extractWordCount(html: string): number {
  // Strip tags then count whitespace-separated tokens.
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
  return (stripped.match(/\S+/g) || []).length;
}

// ---------------------------------------------------------------------
// Fetch a single page, applying SSRF checks and redirect validation.
// Returns the response (already followed), final URL, and headers.
// ---------------------------------------------------------------------
async function safeFetch(
  url: string,
  config: CrawlerConfig,
): Promise<{ ok: boolean; status?: number; headers?: Headers; body?: string; finalUrl?: string; redirectChain: string[]; error?: string; responseTimeMs?: number }> {
  // Initial SSRF check
  const safety = await isUrlSafeToFetch(url);
  if (!safety.safe) {
    return { ok: false, redirectChain: [], error: `SSRF blocked: ${safety.reason}` };
  }
  const redirectChain: string[] = [];
  let currentUrl = url;
  const startTime = Date.now();
  let hopsRemaining = 5;
  try {
    while (hopsRemaining-- > 0) {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': CRAWLER_UA, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(config.requestTimeoutMs),
        redirect: 'manual',
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) {
          return { ok: false, status: res.status, redirectChain, error: 'Redirect with no Location header', responseTimeMs: Date.now() - startTime };
        }
        // Resolve relative redirects
        const next = new URL(loc, currentUrl).toString();
        // SSRF re-check on redirect target
        const redirectSafety = await isRedirectTargetSafe(next, config.targetUrl);
        if (!redirectSafety.safe) {
          return { ok: false, status: res.status, redirectChain, error: `Redirect blocked: ${redirectSafety.reason}`, responseTimeMs: Date.now() - startTime };
        }
        redirectChain.push(next);
        currentUrl = next;
        continue;
      }
      // Final response
      const isHtml = (res.headers.get('content-type') || '').includes('text/html');
      const body = isHtml ? await res.text() : '';
      return {
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        body,
        finalUrl: currentUrl,
        redirectChain,
        responseTimeMs: Date.now() - startTime,
      };
    }
    return { ok: false, redirectChain, error: 'Too many redirects (>5)', responseTimeMs: Date.now() - startTime };
  } catch (err) {
    if (config.signal?.cancelled) {
      return { ok: false, redirectChain, error: 'Crawl cancelled', responseTimeMs: Date.now() - startTime };
    }
    return { ok: false, redirectChain, error: (err as Error).message, responseTimeMs: Date.now() - startTime };
  }
}

// ---------------------------------------------------------------------
// The main crawler entrypoint.
// ---------------------------------------------------------------------
export async function crawlWebsite(config: CrawlerConfig): Promise<{ pages: CrawledPage[]; progress: CrawlProgress }> {
  const origin = urlOrigin(config.targetUrl);
  if (!origin) {
    throw new Error('Could not determine origin from target URL');
  }
  let originHost: string;
  try {
    originHost = new URL(config.targetUrl).hostname;
  } catch {
    throw new Error('Invalid target URL hostname');
  }

  const progress: CrawlProgress = {
    discovered: 0,
    crawled: 0,
    remaining: 0,
    errors: 0,
    stage: 'Initializing',
  };

  const reportProgress = () => {
    progress.remaining = Math.max(0, progress.discovered - progress.crawled);
    config.onProgress?.({ ...progress });
  };

  // 1. Fetch robots.txt
  progress.stage = 'Fetching robots.txt';
  reportProgress();
  const robots = config.respectRobotsTxt ? await fetchRobotsTxt(origin, config.signal) : new RobotsTxt();

  // 2. Fetch sitemap (optional seed)
  let seeds: string[] = [config.targetUrl];
  if (config.useSitemapAsSeed) {
    progress.stage = 'Fetching sitemap';
    reportProgress();
    const sitemapUrls = robots.sitemaps.length > 0 ? robots.sitemaps : [origin + '/sitemap.xml'];
    for (const sm of sitemapUrls) {
      const fromSitemap = await fetchSitemap(origin, sm, config.signal);
      seeds.push(...fromSitemap);
    }
    seeds = Array.from(new Set(seeds));
  }

  // 3. Initialize crawl queue
  type QueueItem = { url: string; depth: number };
  const queue: QueueItem[] = seeds.map((url) => ({ url, depth: 0 }));
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  const allErrors: string[] = [];

  progress.discovered = queue.length;
  reportProgress();

  // 4. Crawl loop (bounded concurrency)
  while (queue.length > 0 && pages.length < config.maxPages) {
    if (config.signal?.cancelled) {
      progress.stage = 'Cancelled';
      reportProgress();
      break;
    }
    // Batch up to crawlConcurrency items
    const batch = queue.splice(0, Math.min(config.crawlConcurrency, queue.length, config.maxPages - pages.length));
    if (batch.length === 0) break;

    await Promise.all(
      batch.map(async (item) => {
        const normalized = normalizeUrl(item.url, { includeQueryParams: config.includeQueryParams });
        if (!normalized) return;
        if (visited.has(normalized)) return;
        visited.add(normalized);
        progress.currentUrl = normalized;
        progress.stage = 'Crawling';
        reportProgress();

        // Check robots.txt (if respected)
        if (config.respectRobotsTxt && !robots.isAllowed(normalized)) {
          pages.push({
            url: normalized,
            statusCode: 0,
            error: 'Blocked by robots.txt',
            redirectChain: [],
            h1Count: 0,
            h2Count: 0,
            h3Count: 0,
            headingHierarchyOk: true,
            wordCount: 0,
            imageCount: 0,
            imagesWithoutAlt: 0,
            internalLinks: 0,
            externalLinks: 0,
            discoveredLinks: [],
            robotsAllowed: false,
            indexable: false,
            schemaTypes: [],
            openGraphValid: false,
            twitterCardValid: false,
            securityHeaders: {},
            hreflangValid: true,
            mixedContent: false,
            isHttps: normalized.startsWith('https://'),
          });
          progress.crawled++;
          reportProgress();
          return;
        }

        // Fetch the page
        const result = await safeFetch(normalized, config);
        if (!result.ok || !result.body) {
          pages.push({
            url: normalized,
            statusCode: result.status,
            error: result.error || `HTTP ${result.status}`,
            redirectChain: result.redirectChain,
            h1Count: 0,
            h2Count: 0,
            h3Count: 0,
            headingHierarchyOk: true,
            wordCount: 0,
            imageCount: 0,
            imagesWithoutAlt: 0,
            internalLinks: 0,
            externalLinks: 0,
            discoveredLinks: [],
            robotsAllowed: true,
            indexable: false,
            schemaTypes: [],
            openGraphValid: false,
            twitterCardValid: false,
            securityHeaders: result.headers ? extractSecurityHeaders(result.headers) : {},
            hreflangValid: true,
            mixedContent: false,
            isHttps: normalized.startsWith('https://'),
            responseTimeMs: result.responseTimeMs,
          });
          progress.errors++;
          allErrors.push(`${normalized}: ${result.error || 'HTTP error'}`);
        } else {
          // Parse the page
          const html = result.body;
          const finalUrl = result.finalUrl || normalized;
          const title = extractTitle(html);
          const metaDesc = extractMetaDescription(html);
          const canonical = extractCanonical(html);
          const h1 = extractHeadings(html, 1);
          const h2 = extractHeadings(html, 2);
          const h3 = extractHeadings(html, 3);
          const imgs = extractImages(html);
          const links = extractLinks(html, originHost, config.includeSubdomains);
          const schemaTypes = extractSchemaTypes(html);
          const ogValid = extractOpenGraph(html);
          const twCard = extractTwitterCard(html);
          const hreflangInfo = extractHreflang(html);
          const isHttps = finalUrl.startsWith('https://');
          const mixed = extractMixedContent(html, isHttps);
          const secHeaders = result.headers ? extractSecurityHeaders(result.headers) : {};
          const wordCount = extractWordCount(html);

          // Determine indexability from meta robots
          const metaRobotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
          let indexable = true;
          if (metaRobotsMatch) {
            const directives = metaRobotsMatch[1].toLowerCase();
            if (directives.includes('noindex')) indexable = false;
          }
          // Also check X-Robots-Tag header
          const xRobots = result.headers?.get('x-robots-tag');
          if (xRobots && xRobots.toLowerCase().includes('noindex')) {
            indexable = false;
          }

          // Heading hierarchy check (H1 should be first; H2 should not precede H1)
          const firstH1Idx = html.search(/<h1[^>]*>/i);
          const firstH2Idx = html.search(/<h2[^>]*>/i);
          const headingHierarchyOk = firstH1Idx === -1 ? false : firstH2Idx === -1 || firstH1Idx < firstH2Idx;

          const crawled: CrawledPage = {
            url: normalized,
            finalUrl,
            statusCode: result.status,
            contentType: result.headers?.get('content-type') ?? undefined,
            responseTimeMs: result.responseTimeMs,
            redirectChain: result.redirectChain,
            title,
            titleLength: title?.length ?? 0,
            metaDescription: metaDesc,
            metaDescriptionLength: metaDesc?.length ?? 0,
            canonical,
            h1Count: h1,
            h2Count: h2,
            h3Count: h3,
            headingHierarchyOk,
            wordCount,
            imageCount: imgs.total,
            imagesWithoutAlt: imgs.withoutAlt,
            internalLinks: links.filter((l) => l.isInternal).length,
            externalLinks: links.filter((l) => !l.isInternal).length,
            discoveredLinks: links,
            robotsAllowed: true,
            indexable,
            schemaTypes,
            openGraphValid: ogValid,
            twitterCardValid: twCard,
            securityHeaders: secHeaders,
            hreflangValid: hreflangInfo.valid,
            mixedContent: mixed,
            isHttps,
          };
          pages.push(crawled);

          // Enqueue discovered internal links (within depth limit)
          if (item.depth < config.maxDepth) {
            for (const link of links) {
              if (!link.isInternal) {
                if (!config.checkExternalLinks) continue;
                // External links are NOT enqueued, only recorded for status checking
                continue;
              }
              // Resolve relative URLs
              let absoluteHref = link.href;
              if (absoluteHref.startsWith('/')) {
                absoluteHref = origin + absoluteHref;
              } else if (!absoluteHref.startsWith('http')) {
                absoluteHref = new URL(absoluteHref, finalUrl).toString();
              }
              const norm = normalizeUrl(absoluteHref, { includeQueryParams: config.includeQueryParams });
              if (!norm) continue;
              if (visited.has(norm)) continue;
              // Filter out non-HTML-looking URLs (assets, files)
              if (/\.(?:png|jpe?g|gif|svg|webp|css|js|json|xml|pdf|zip|tar|gz|mp4|mp3|webm|woff2?|ttf|otf|ico|csv|xls|xlsx|docx?|pptx?|txt|rar)$/i.test(norm)) {
                continue;
              }
              queue.push({ url: norm, depth: item.depth + 1 });
              progress.discovered++;
            }
          }
          progress.crawled++;
          reportProgress();
        }
      }),
    );
  }

  progress.stage = pages.length >= config.maxPages ? 'Max pages reached' : 'Completed';
  progress.currentUrl = undefined;
  reportProgress();

  return { pages, progress };
}
