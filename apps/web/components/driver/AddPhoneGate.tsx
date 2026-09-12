'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone } from 'lucide-react'
import { resolveDriverPhone } from '@teeko/shared'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
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
  const { hydrate } = useWebAuthStore()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

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

        <label
          htmlFor="add-phone"
          className="mb-1.5 mt-6 block text-sm font-medium text-[var(--color-text)]"
        >
          {t('auth.register.phoneLabel')}
        </label>
        {/* Static '+60', not a picker: drivers are Malaysian mobiles only. */}
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3">
          <span className="shrink-0 font-medium text-[var(--color-text)]">+60</span>
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
            className="w-full bg-transparent py-2.5 text-[var(--color-text)] outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {t('auth.register.phoneHint')}
        </p>
        {error ? <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p> : null}

        <Button type="submit" variant="primary" size="md" className="mt-6 w-full" disabled={saving}>
          {saving ? '…' : t('auth.register.addPhoneCta')}
        </Button>
      </form>
    </div>
  )
}
