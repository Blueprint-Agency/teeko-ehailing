// Shared dispute presentation helpers — the i18n key + colour tone for each
// dispute status, used by both the receipt screen and the "My reports" screen
// (via components/DisputeStatusPill).

import type { DisputeStatus } from '@teeko/shared';

/** Status → i18n key. Covers the full backend `dispute_status` lifecycle. */
export const DISPUTE_STATUS_I18N: Record<DisputeStatus, string> = {
  open: 'dispute.statusOpen',
  under_review: 'dispute.statusUnderReview',
  escalated: 'dispute.statusEscalated',
  resolved: 'dispute.statusResolved',
  rejected: 'dispute.statusRejected',
  refund_pending: 'dispute.statusRefundPending',
  refund_processing: 'dispute.statusRefundProcessing',
  refund_completed: 'dispute.statusRefundCompleted',
  refund_failed: 'dispute.statusRefundFailed',
};

/** Tailwind background + text classes for a status pill, grouped by outcome. */
export function disputeStatusTone(status: DisputeStatus): { bg: string; text: string } {
  switch (status) {
    // Positive, terminal outcomes.
    case 'resolved':
    case 'refund_completed':
      return { bg: 'bg-primary-50', text: 'text-primary' };
    // Refund in flight — amber "in progress".
    case 'refund_pending':
    case 'refund_processing':
      return { bg: 'bg-warning-50', text: 'text-warning-700' };
    // Closed without action in the rider's favour.
    case 'rejected':
    case 'refund_failed':
      return { bg: 'bg-muted', text: 'text-ink-secondary' };
    // Still being worked on (open / under_review / escalated).
    default:
      return { bg: 'bg-muted', text: 'text-ink-primary' };
  }
}
