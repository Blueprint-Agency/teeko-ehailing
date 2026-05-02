'use client'

import Link from 'next/link'
import { Bell, Download, RefreshCcw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/driver/Header'
import { StatusTracker } from '@/components/driver/StatusTracker'
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApplicationStatusStore } from '@/stores/applicationStatusStore'
import { useWebAuthStore } from '@/stores/authStore'
import type { DocumentState } from '@teeko/shared/types'

function DocRow({ doc }: { doc: DocumentState }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{doc.label}</p>
        {doc.rejectionReason && (
          <p className="mt-0.5 text-xs text-[var(--color-error)]">
            {doc.rejectionReason}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Badge variant={statusVariant(doc.status)}>{statusLabel(doc.status)}</Badge>
        {doc.status === 'rejected' && (
          <Link href={`/dashboard/resubmit/${doc.id}`}>
            <Button size="sm" variant="outline" className="text-xs">
              <RefreshCcw className="h-3 w-3" /> {t('dashboard.resubmit')}
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { status, personalDocs, vehicleDocs, notifications, unreadCount, markAllRead } =
    useApplicationStatusStore()
  const { profile } = useWebAuthStore()

  const hasRejected = [...personalDocs, ...vehicleDocs].some((d) => d.status === 'rejected')

  if (!status) {
    return (
      <div className="min-h-screen">
        <Header showNav />
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <p className="text-sm text-[var(--color-muted)]">{t('common.loading')}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header showNav />

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        {/* Page header */}
        <div className="animate-fade-up mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[var(--color-navy)]">
              {t('dashboard.title')}
            </h1>
            <p className="mt-1 text-[var(--color-muted)]">
              {profile 
                ? `${t('auth.login.title')}, ${profile.fullName.split(' ')[0]}` 
                : t('dashboard.subtitle')}
            </p>
          </div>
          {unreadCount > 0 && profile && (
            <button
              onClick={() => markAllRead(profile.id)}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-muted)] shadow-[var(--shadow-sm)] hover:text-[var(--color-text)]"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount} {t('nav.notifications')} · {t('common.submit')}
            </button>
          )}
        </div>

        {/* Activated banner */}
        {status.accountStatus === 'active' && (
          <div className="animate-fade-up mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-[var(--color-navy)] p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-[var(--color-teal)]" />
              <div>
                <p className="font-semibold text-white">{t('dashboard.accountStatus')}: {t('dashboard.stages.active')}</p>
                <p className="text-sm text-white/60">{t('dashboard.downloadBanner')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary">
                <Download className="h-4 w-4" /> {t('onboarding.confirmation.appStore')}
              </Button>
              <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white">
                <Download className="h-4 w-4" /> {t('onboarding.confirmation.googlePlay')}
              </Button>
            </div>
          </div>
        )}

        {/* Rejected documents alert */}
        {hasRejected && (
          <div className="animate-fade-up mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error-light)] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-error)]" />
            <div>
              <p className="font-semibold text-[var(--color-error)]">{t('dashboard.stages.rejected')}</p>
              <p className="text-sm text-[var(--color-error)]/80">
                {t('dashboard.rejectionReason')}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Status tracker — left column */}
          <div className="animate-fade-up animate-delay-100 lg:col-span-3">
            <StatusTracker status={status} />
          </div>

          {/* Notifications — right column */}
          <div className="animate-fade-up animate-delay-200 lg:col-span-2">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-md)]">
              <h2 className="mb-4 font-display text-xl text-[var(--color-navy)]">{t('nav.notifications')}</h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">{t('common.loading')}</p>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {notifications.map((n) => (
                    <div key={n.id} className={`py-3 ${!n.read ? 'opacity-100' : 'opacity-60'}`}>
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-teal)]" />
                        )}
                        <div className={!n.read ? '' : 'pl-4'}>
                          <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                          <p className="text-xs text-[var(--color-muted)]">{n.body}</p>
                          <p className="mt-1 text-xs text-[var(--color-placeholder)]">
                            {new Date(n.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-MY' : i18n.language)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Document details */}
        <div className="animate-fade-up animate-delay-300 mt-6 grid gap-6 sm:grid-cols-2">
          {/* Personal docs */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h3 className="mb-1 font-semibold text-[var(--color-navy)]">{t('onboarding.personalDocs.title')}</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">{personalDocs.length} {t('common.optional')}</p>
            <div className="divide-y divide-[var(--color-border)]">
              {personalDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </div>

          {/* Vehicle docs */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h3 className="mb-1 font-semibold text-[var(--color-navy)]">{t('onboarding.vehicleDocs.title')}</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">{vehicleDocs.length} {t('common.optional')}</p>
            <div className="divide-y divide-[var(--color-border)]">
              {vehicleDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
