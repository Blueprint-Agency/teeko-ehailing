import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormErrorProps {
  /** Renders nothing when empty, so callers can pass state straight through. */
  message?: string | null
  className?: string
}

/**
 * Form-level error banner for failures that don't belong to a single field —
 * Clerk rejecting a sign-up, a backend 500 during provisioning. Mirrors the
 * per-field treatment in `Input` so the two read as one system.
 */
export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-error)] bg-[var(--color-error-light)] px-3.5 py-3 text-sm text-[var(--color-error)]',
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span className="leading-snug">{message}</span>
    </div>
  )
}
