import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:       'bg-[var(--color-border)] text-[var(--color-text)]',
        teal:          'bg-[var(--color-teal-light)] text-[var(--color-teal-dark)]',
        navy:          'bg-[var(--color-navy)] text-white',
        success:       'bg-emerald-50 text-emerald-700',
        warning:       'bg-amber-50 text-amber-700',
        error:         'bg-[var(--color-error-light)] text-[var(--color-error)]',
        info:          'bg-blue-50 text-blue-700',
        pending:       'bg-slate-100 text-slate-600',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

// Helper: maps document/stage status → badge variant
export function statusVariant(status: string): BadgeProps['variant'] {
  switch (status) {
    case 'approved': case 'active': return 'success'
    case 'rejected': case 'suspended': return 'error'
    case 'under_review': case 'in_progress': case 'submitted': return 'info'
    case 'uploaded': return 'teal'
    case 'pending': case 'pending_activation': case 'not_started': return 'pending'
    default: return 'default'
  }
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    empty: 'Not uploaded',
    uploaded: 'Uploaded',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    pending: 'Pending',
    in_progress: 'Under Review',
    not_started: 'Not Started',
    submitted: 'Submitted',
    pending_activation: 'Pending Activation',
    active: 'Active',
    suspended: 'Suspended',
  }
  return labels[status] ?? status
}
