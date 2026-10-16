// SSRF (Server-Side Request Forgery) protection module.
// All HTTP requests made by the crawler and provider clients
// MUST pass through isUrlSafeToFetch() before being executed.
//
// Protections implemented (per spec section 6 + 15):
//   - Block localhost, loopback, link-local, private, reserved, multicast ranges.
//   - Block cloud metadata endpoints (169.254.169.254, fd00:ec2::1, etc.)
//   - Restrict protocols to http and https only.
//   - DNS rebinding defense: resolve the hostname once, verify the IP,
//     then connect to that resolved IP (callers must honor this).
//   - Block redirect-based bypasses by re-validating each redirect target.

import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { URL } from 'node:url';

// ---------------------------------------------------------------------
// Metadata endpoints to block by name or IP.
// ---------------------------------------------------------------------
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.aws.internal',
  '169.254.169.254', // AWS/GCP metadata
  'metadata.azure.com',
  '169.254.169.253', // GCP metadata alternate
  'fd00:ec2::254', // AWS IMDS IPv6
]);

// ---------------------------------------------------------------------
// Determine whether a parsed URL is safe to fetch from the server.
// Returns an object with `safe: boolean` and a `reason` for diagnostics.
// ---------------------------------------------------------------------
export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  resolvedIp?: string;
}

export async function isUrlSafeToFetch(rawUrl: string): Promise<UrlSafetyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL syntax' };
  }

  // Restrict protocols to http/https only.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Protocol "${parsed.protocol}" not allowed; only http and https are permitted` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Block obvious hostname blocklist.
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Hostname "${hostname}" is on the SSRF blocklist (internal/metadata endpoint)` };
  }

  // Block hostnames that look like raw IP literals pointing to private space.
  if (ipaddr.isValid(hostname)) {
    const addr = ipaddr.parse(hostname);
    if (isPrivateIp(addr)) {
      return { safe: false, reason: `IP "${hostname}" resolves to a private/reserved range` };
    }
  } else {
    // Resolve DNS for hostnames. If multiple A/AAAA records exist, ALL must be public.
    let resolved: string | null = null;
    try {
      const records = await lookup(hostname, { all: true });
      if (records.length === 0) {
        return { safe: false, reason: `Could not resolve hostname "${hostname}"` };
      }
      for (const r of records) {
        const addr = ipaddr.parse(r.address);
        if (isPrivateIp(addr)) {
          return { safe: false, reason: `Hostname "${hostname}" resolves to private/reserved IP ${r.address}` };
        }
        // Track first valid IP for caller use
        if (!resolved) resolved = r.address;
      }
    } catch (err) {
      return { safe: false, reason: `DNS resolution failed for "${hostname}": ${(err as Error).message}` };
    }
    return { safe: true, resolvedIp: resolved ?? undefined };
  }

  return { safe: true };
}

// ---------------------------------------------------------------------
// Check whether an ipaddr.js parsed address falls within private,
// loopback, link-local, or other reserved ranges.
// ---------------------------------------------------------------------
function isPrivateIp(addr: ipaddr.IPv4 | ipaddr.IPv6.IPv6): boolean {
  // IPv4
  if (addr.kind() === 'ipv4') {
    const v4 = addr as ipaddr.IPv4;
    const range = v4.range();
    if (range === 'private' || range === 'loopback' || range === 'linkLocal' || range === 'reserved' || range === 'multicast' || range === 'benchmarking') {
      return true;
    }
    return false;
  }
  // IPv6
  const v6 = addr as ipaddr.IPv6.IPv6;
  const v6range = v6.range();
  if (v6range === 'private' || v6range === 'loopback' || v6range === 'linkLocal' || v6range === 'uniqueLocal' || v6range === 'reserved' || v6range === 'multicast') {
    return true;
  }
  if (v6.toString() === 'fd00:ec2::254' || v6.toString() === '::1') {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------
// Re-validate a redirect target. Used after each fetch to ensure the
// new destination is also safe (defense against DNS rebinding).
// ---------------------------------------------------------------------
export async function isRedirectTargetSafe(rawUrl: string, originalHost: string): Promise<UrlSafetyResult> {
  const base = await isUrlSafeToFetch(rawUrl);
  if (!base.safe) return base;

  // Block redirect to a different origin than the requested site
  // (prevents the crawler from being tricked into hitting arbitrary hosts).
  // NOTE: This is intentionally restrictive. The crawler only follows
  // same-origin redirects by default. If you need cross-origin redirects,
  // pass an allowlist explicitly.
  try {
    const target = new URL(rawUrl);
    const original = new URL(originalHost);
    // Allow exact host match OR subdomain of original host
    if (target.hostname === original.hostname) return { safe: true };
    if (target.hostname.endsWith('.' + original.hostname)) return { safe: true };
    return {
      safe: false,
      reason: `Refusing cross-origin redirect from "${original.hostname}" to "${target.hostname}"`,
    };
  } catch {
    return { safe: false, reason: 'Redirect target is not a valid URL' };
  }
}

// ---------------------------------------------------------------------
// Validate that a user-supplied URL is well-formed and public-facing.
// Used in the scan form and provider config endpoints.
// ---------------------------------------------------------------------
export function isValidPublicUrl(rawUrl: string): { valid: boolean; normalized?: string; reason?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'URL is required' };
  }

  let withProto = rawUrl.trim();
  if (!/^https?:\/\//i.test(withProto)) {
    withProto = 'https://' + withProto;
  }

  let parsed: URL;
  try {
    parsed = new URL(withProto);
  } catch {
    return { valid: false, reason: 'Malformed URL — could not parse' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only http and https URLs are supported' };
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { valid: false, reason: 'Hostname appears to be local or invalid' };
  }

  // Block obvious internal hostnames at validation time.
  if (BLOCKED_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    return { valid: false, reason: 'Internal/local hostname blocked' };
  }

  return { valid: true, normalized: withProto };
}

// ---------------------------------------------------------------------
// Extract the origin (scheme + host) of a normalized URL.
// ---------------------------------------------------------------------
export function urlOrigin(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Normalize a URL: strip fragment, lowercase host, optionally drop
// query parameters, and remove trailing slashes from path.
// ---------------------------------------------------------------------
export function normalizeUrl(rawUrl: string, opts: { includeQueryParams?: boolean } = {}): string | null {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    if (!opts.includeQueryParams) {
      u.search = '';
    }
    // Strip trailing slash from non-root paths
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return null;
  }
}
