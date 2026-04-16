'use client'

import Link from 'next/link'
import { Bell, User, LogOut, ChevronDown } from 'lucide-react'
import { useWebAuthStore } from '@/stores/authStore'
import { useApplicationStatusStore } from '@/stores/applicationStatusStore'
import { useLanguageStore } from '@/stores/languageStore'
import { cn } from '@/lib/utils'
import type { Locale } from '@teeko/shared/types'

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'ms', label: 'BM' },
  { value: 'zh', label: '中文' },
  { value: 'ta', label: 'தமிழ்' },
]

interface HeaderProps {
  variant?: 'light' | 'navy'
  showNav?: boolean
}

export function Header({ variant = 'light', showNav = true }: HeaderProps) {
  const { isAuthenticated, logout } = useWebAuthStore()
  const { unreadCount } = useApplicationStatusStore()
  const { locale, setLocale } = useLanguageStore()

  const isNavy = variant === 'navy'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b backdrop-blur-md',
        isNavy
          ? 'bg-[var(--color-navy)]/95 border-white/10'
          : 'bg-white/95 border-[var(--color-border)]'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-teal)]">
            <span className="font-display text-sm font-bold text-[var(--color-navy)]">T</span>
          </div>
          <span
            className={cn(
              'font-display text-xl',
              isNavy ? 'text-white' : 'text-[var(--color-navy)]'
            )}
          >
            Teeko
          </span>
          <span
            className={cn(
              'hidden rounded-full px-2 py-0.5 text-xs font-medium sm:block',
              isNavy
                ? 'bg-white/10 text-white/70'
                : 'bg-[var(--color-teal-light)] text-[var(--color-teal-dark)]'
            )}
          >
            Driver Portal
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Language picker */}
          <div className="relative">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className={cn(
                'appearance-none rounded-[var(--radius-md)] border px-3 py-1.5 pr-6 text-xs font-medium',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-teal)]',
                'cursor-pointer',
                isNavy
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
              )}
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value} className="text-[var(--color-text)] bg-white">
                  {l.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className={cn(
                'pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2',
                isNavy ? 'text-white/60' : 'text-[var(--color-muted)]'
              )}
            />
          </div>

          {showNav && isAuthenticated && (
            <>
              {/* Notifications */}
              <Link
                href="/dashboard"
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition-colors',
                  isNavy
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                )}
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-error)] text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Profile */}
              <Link
                href="/profile"
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition-colors',
                  isNavy
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]'
                )}
              >
                <User className="h-4.5 w-4.5" />
              </Link>

              {/* Logout */}
              <button
                onClick={logout}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition-colors',
                  isNavy
                    ? 'text-white/60 hover:bg-white/10 hover:text-white'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-error)]'
                )}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}

          {showNav && !isAuthenticated && (
            <Link
              href="/auth/login"
              className={cn(
                'rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-colors',
                isNavy
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-navy)]'
              )}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
