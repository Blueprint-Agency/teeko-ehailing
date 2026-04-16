'use client'

import Link from 'next/link'
import { Bell, Download, RefreshCcw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/driver/Header'
import { StatusTracker } from '@/components/driver/StatusTracker'
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useApplicationStatusStore } from '@/stores/applicationStatusStore'
import { useWebAuthStore } from '@/stores/authStore'
import type { DocumentState } from '@teeko/shared/types'

function DocRow({ doc }: { doc: DocumentState }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{doc.label}</p>
        {doc.rejectionReason && (
          <p className="mt-0.5 truncate text-xs text-[var(--color-error)]">
            {doc.rejectionReason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusVariant(doc.status)}>{statusLabel(doc.status)}</Badge>
        {doc.status === 'rejected' && (
          <Link href={`/dashboard/resubmit/${doc.id}`}>
            <Button size="sm" variant="outline" className="text-xs">
              <RefreshCcw className="h-3 w-3" /> Resubmit
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { status, personalDocs, vehicleDocs, notifications, unreadCount, markAllRead } =
    useApplicationStatusStore()
  const { profile } = useWebAuthStore()

  const hasRejected = [...personalDocs, ...vehicleDocs].some((d) => d.status === 'rejected')

  return (
    <div className="min-h-screen">
      <Header showNav />

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Page header */}
        <div className="animate-fade-up mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[var(--color-navy)]">
              Application Status
            </h1>
            <p className="mt-1 text-[var(--color-muted)]">
              {profile ? `Welcome back, ${profile.fullName.split(' ')[0]}` : 'Track your onboarding progress'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-muted)] shadow-[var(--shadow-sm)] hover:text-[var(--color-text)]"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount} unread · Mark all read
            </button>
          )}
        </div>

        {/* Activated banner */}
        {status.accountStatus === 'active' && (
          <div className="animate-fade-up mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-xl)] bg-[var(--color-navy)] p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-[var(--color-teal)]" />
              <div>
                <p className="font-semibold text-white">Your account is activated!</p>
                <p className="text-sm text-white/60">Download the Teeko Driver app and start earning</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary">
                <Download className="h-4 w-4" /> App Store
              </Button>
              <Button size="sm" variant="outline" className="border-white/20 bg-transparent text-white">
                <Download className="h-4 w-4" /> Google Play
              </Button>
            </div>
          </div>
        )}

        {/* Rejected documents alert */}
        {hasRejected && (
          <div className="animate-fade-up mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error-light)] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-error)]" />
            <div>
              <p className="font-semibold text-[var(--color-error)]">Action required</p>
              <p className="text-sm text-[var(--color-error)]/80">
                One or more documents have been rejected. Please resubmit them to continue.
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
              <h2 className="mb-4 font-display text-xl text-[var(--color-navy)]">Notifications</h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No notifications yet</p>
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
                            {new Date(n.createdAt).toLocaleDateString('en-MY')}
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
            <h3 className="mb-1 font-semibold text-[var(--color-navy)]">Personal Documents</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">{personalDocs.length} documents</p>
            <div className="divide-y divide-[var(--color-border)]">
              {personalDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </div>

          {/* Vehicle docs */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h3 className="mb-1 font-semibold text-[var(--color-navy)]">Vehicle Documents</h3>
            <p className="mb-4 text-xs text-[var(--color-muted)]">{vehicleDocs.length} documents</p>
            <div className="divide-y divide-[var(--color-border)]">
              {vehicleDocs.map((doc) => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
