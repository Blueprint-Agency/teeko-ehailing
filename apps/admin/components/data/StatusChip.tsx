'use client';
import { Chip } from '@mui/material';

const STATUS_MAP: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  active:      { label: 'Active',      color: 'success' },
  inactive:    { label: 'Inactive',    color: 'default' },
  pending:     { label: 'Pending',     color: 'warning' },
  suspended:   { label: 'Suspended',   color: 'error' },
  banned:      { label: 'Banned',      color: 'error' },
  flagged:     { label: 'Flagged',     color: 'warning' },
  completed:   { label: 'Completed',   color: 'success' },
  cancelled:   { label: 'Cancelled',   color: 'error' },
  in_progress: { label: 'In Progress', color: 'info' },
  processed:   { label: 'Processed',   color: 'success' },
  failed:      { label: 'Failed',      color: 'error' },
  open:        { label: 'Open',        color: 'warning' },
  resolved:    { label: 'Resolved',    color: 'success' },
  escalated:   { label: 'Escalated',   color: 'error' },
  approved:    { label: 'Approved',    color: 'success' },
  rejected:    { label: 'Rejected',    color: 'error' },
  expired:     { label: 'Expired',     color: 'error' },
  not_applied: { label: 'Not Applied', color: 'default' },
};

export function StatusChip({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={config.label} color={config.color} size="small" />;
}
