'use client';

import { cn } from '@/lib/utils';
import type { Severity, ProviderConnectionState } from '@/lib/types';

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', label: 'Critical' },
  high: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', label: 'High' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-300', label: 'Medium' },
  low: { bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', label: 'Low' },
  informational: { bg: 'bg-gray-100 dark:bg-gray-800/40', text: 'text-gray-600 dark:text-gray-300', label: 'Info' },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide', s.bg, s.text, className)}>
      {s.label}
    </span>
  );
}

const STATE_STYLES: Record<ProviderConnectionState, { bg: string; text: string }> = {
  connected: { bg: 'bg-green-100 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300' },
  connected_with_limitations: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300' },
  authentication_failed: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300' },
  permission_denied: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300' },
  rate_limited: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300' },
  quota_exhausted: { bg: 'bg-orange-100 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300' },
  service_unavailable: { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300' },
  not_configured: { bg: 'bg-gray-100 dark:bg-gray-800/40', text: 'text-gray-600 dark:text-gray-300' },
  validation_inconclusive: { bg: 'bg-gray-100 dark:bg-gray-800/40', text: 'text-gray-600 dark:text-gray-300' },
};

export function ConnectionStateBadge({ state, className }: { state: ProviderConnectionState; className?: string }) {
  const s = STATE_STYLES[state];
  const label = state.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', s.bg, s.text, className)}>
      {label}
    </span>
  );
}

// ScoreColor returns a Tailwind color class for a given 0-100 score.
export function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

export function scoreBgClass(score: number): string {
  if (score >= 80) return 'bg-green-600';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-600';
}
