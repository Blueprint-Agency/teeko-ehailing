// Shared support-ticket presentation helpers — the i18n key + colour tone for
// each status, used by the "My tickets" screen (via components/SupportStatusPill).

import type { SupportStatus } from '@teeko/shared';

/** Status → i18n key. Covers the statuses a rider can see on their ticket. */
export const SUPPORT_STATUS_I18N: Record<SupportStatus, string> = {
  open: 'support.statusOpen',
  in_progress: 'support.statusInProgress',
  resolved: 'support.statusResolved',
  escalated: 'support.statusEscalated',
};

/** Tailwind background + text classes for a status pill, grouped by outcome. */
export function supportStatusTone(status: SupportStatus): { bg: string; text: string } {
  switch (status) {
    // Positive, terminal outcome.
    case 'resolved':
      return { bg: 'bg-primary-50', text: 'text-primary' };
    // Needs attention.
    case 'escalated':
      return { bg: 'bg-warning-50', text: 'text-warning-700' };
    // Being worked on.
    case 'in_progress':
      return { bg: 'bg-muted', text: 'text-ink-primary' };
    // Newly raised.
    default:
      return { bg: 'bg-muted', text: 'text-ink-secondary' };
  }
}
