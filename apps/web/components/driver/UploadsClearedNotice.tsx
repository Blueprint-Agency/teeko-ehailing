'use client'

import { useTranslation } from 'react-i18next'
import { RefreshCcw, X } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboardingStore'

/**
 * Shown after a reload wiped the in-memory document Files. The wizard already
 * bounces the driver back to the docs step; without this it just looks like the
 * site forgot them. Hidden again on dismiss or the next upload.
 */
export function UploadsClearedNotice() {
  const { t } = useTranslation()
  const uploadsCleared = useOnboardingStore((s) => s.uploadsCleared)
  const dismiss = useOnboardingStore((s) => s.dismissUploadsCleared)

  if (!uploadsCleared) return null

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
    >
      <RefreshCcw className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium">{t('onboarding.uploadsCleared.title')}</p>
        <p className="mt-0.5 text-amber-700">{t('onboarding.uploadsCleared.body')}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.dismiss')}
        className="-m-1 rounded p-1 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
