'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'
import { resolveDriverPhone } from '@teeko/shared'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-error'
import { FieldError, fieldStateClasses } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useWebAuthStore } from '@/stores/authStore'

/**
 * The R6 gate for the portal: an account that predates required-phone-at-
 * registration, or one whose sign-up was interrupted between the Clerk step and
 * the number write.
 *
 * Rendered *in place of* the dashboard rather than as a route, so there is no
 * URL to skip it with and no back button to dismiss it. A NULL phone silently
 * degrades a trip — the rider's in-trip call button has nothing to dial — and
 * the number sits on the APAD/JPJ operator record.
 *
 * No OTP: there is no existing number to protect. The server refuses to
 * overwrite an existing number here, so this cannot be used to bypass the
 * review queue a real change has to go through.
 */
export function AddPhoneGate() {
  const { t } = useTranslation()
  const { hydrate, phoneWriteError, setPhoneWriteError } = useWebAuthStore()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  // Registration's phone write failed and sent us here. Show why, once — a
  // later visit to the gate (legacy account, no number) has no reason to give.
  const [reason] = useState(phoneWriteError)
  useEffect(() => {
    if (phoneWriteError) setPhoneWriteError(null)
  }, [phoneWriteError, setPhoneWriteError])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)

    // Same function the API uses, so the inline message and the server's
    // verdict can never disagree.
    const resolved = resolveDriverPhone({ nationalNumber: phone })
    if (!resolved.ok) {
      setError(
        resolved.error === 'phone_country_not_allowed'
          ? t('auth.register.phoneCountryNotAllowed')
          : t('auth.register.phoneInvalid'),
      )
      return
    }

    setSaving(true)
    try {
      await api.setInitialPhone(phone.trim())
      // The gate keys off `needsPhone`, so re-hydrating is what dismisses it.
      await hydrate()
    } catch {
      setError(t('auth.register.phoneSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8"
      >
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-teal)]/10">
          <Phone className="h-5 w-5 text-[var(--color-teal)]" aria-hidden />
        </div>

        <h1 className="text-xl font-semibold text-[var(--color-text)]">
          {t('auth.register.addPhoneTitle')}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {t('auth.register.addPhoneBody')}
        </p>
        <FormError message={reason} className="mt-4" />

        <label
          htmlFor="add-phone"
          className="mb-1.5 mt-6 block text-sm font-medium text-[var(--color-text)]"
        >
          {t('auth.register.phoneLabel')}
        </label>
        {/* Static '+60', not a picker: drivers are Malaysian mobiles only. */}
        <div
          className={cn(
            'flex h-11 items-center gap-2 rounded-[var(--radius-md)] border bg-white px-3.5 transition-all duration-150',
            'focus-within:border-transparent focus-within:ring-2 focus-within:ring-[var(--color-teal)]',
            fieldStateClasses(error),
          )}
        >
          <span className="shrink-0 text-sm font-medium text-[var(--color-text)]">+60</span>
          <span className="h-5 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />
          <input
            id="add-phone"
            type="tel"
            autoComplete="tel"
            autoFocus
            placeholder="12-345 6789"
            maxLength={24}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (error) setError(undefined)
            }}
            className="w-full bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-placeholder)]"
          />
        </div>
        <FieldError error={error} className="mt-1.5" />
        {!error && (
          <p className="mt-1.5 text-xs text-[var(--color-muted)]">{t('auth.register.phoneHint')}</p>
        )}

        <Button type="submit" variant="primary" size="md" className="mt-6 w-full" disabled={saving}>
          {saving ? '…' : t('auth.register.addPhoneCta')}
        </Button>
      </form>
    </div>
  )
}
