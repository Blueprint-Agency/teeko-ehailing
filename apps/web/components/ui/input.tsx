import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-text)]"
          >
            {label}
            {props.required && <span className="ml-1 text-[var(--color-error)]">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'h-11 w-full rounded-[var(--radius-md)] border bg-white px-3.5 text-sm text-[var(--color-text)]',
            'placeholder:text-[var(--color-placeholder)]',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)] focus:ring-offset-0 focus:border-transparent',
            error
              ? 'border-[var(--color-error)] bg-[var(--color-error-light)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-border-dark)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="flex items-center gap-1 text-xs text-[var(--color-error)]">
            <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm7.25-3.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 6a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--color-muted)]">{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
