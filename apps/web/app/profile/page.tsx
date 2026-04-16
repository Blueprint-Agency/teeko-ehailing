'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Globe, Shield, LogOut, ChevronRight, Save } from 'lucide-react'
import { Header } from '@/components/driver/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWebAuthStore } from '@/stores/authStore'
import { useLanguageStore } from '@/stores/languageStore'
import type { Locale } from '@teeko/shared/types'

const LANGUAGES: { value: Locale; label: string; native: string }[] = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ms', label: 'Bahasa Malaysia', native: 'Bahasa Malaysia' },
  { value: 'zh', label: 'Mandarin (Simplified)', native: '中文 (简体)' },
  { value: 'ta', label: 'Tamil', native: 'தமிழ்' },
]

export default function ProfilePage() {
  const router = useRouter()
  const { profile, logout, updateProfile } = useWebAuthStore()
  const { locale, setLocale } = useLanguageStore()
  const [saved, setSaved] = useState(false)
  const [fullName, setFullName] = useState(profile?.fullName ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')

  const handleSave = () => {
    updateProfile({ fullName, email })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <div className="min-h-screen">
      <Header showNav />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="animate-fade-up mb-8">
          <h1 className="font-display text-3xl text-[var(--color-navy)]">My Profile</h1>
          <p className="mt-1 text-[var(--color-muted)]">Manage your account details and preferences</p>
        </div>

        {/* Avatar */}
        <div className="animate-fade-up mb-8 flex items-center gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-navy)] text-2xl font-display text-white">
            {(profile?.fullName ?? 'D')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--color-navy)]">{profile?.fullName ?? 'Driver'}</p>
            <p className="text-sm text-[var(--color-muted)]">{profile?.email ?? '—'}</p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-teal-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-teal-dark)]">
              Driver-Partner
            </span>
          </div>
        </div>

        {/* Personal Info */}
        <section className="animate-fade-up animate-delay-100 mb-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-4">
            <User className="h-4 w-4 text-[var(--color-muted)]" />
            <h2 className="font-semibold text-[var(--color-navy)]">Personal Information</h2>
          </div>
          <div className="space-y-5 p-6">
            <Input
              label="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text)]">Phone number</label>
              <div className="flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-sm text-[var(--color-muted)]">
                {profile?.phone ?? '—'}
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Phone number cannot be changed. Contact support if needed.
              </p>
            </div>

            <Button
              variant={saved ? 'outline' : 'primary'}
              size="md"
              onClick={handleSave}
              className={saved ? 'border-emerald-300 text-emerald-700' : ''}
            >
              {saved ? (
                <><Shield className="h-4 w-4" /> Saved</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </section>

        {/* Language */}
        <section className="animate-fade-up animate-delay-200 mb-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-4">
            <Globe className="h-4 w-4 text-[var(--color-muted)]" />
            <h2 className="font-semibold text-[var(--color-navy)]">Language Preference</h2>
          </div>
          <div className="p-6">
            <div className="grid gap-2 sm:grid-cols-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setLocale(lang.value)}
                  className={`flex items-center justify-between rounded-[var(--radius-md)] border p-3 text-left transition-all ${
                    locale === lang.value
                      ? 'border-[var(--color-teal)] bg-[var(--color-teal-light)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-dark)]'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">{lang.label}</p>
                    <p className="text-xs text-[var(--color-muted)]">{lang.native}</p>
                  </div>
                  {locale === lang.value && (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-teal-dark)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Security & Legal */}
        <section className="animate-fade-up animate-delay-300 mb-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-4">
            <Shield className="h-4 w-4 text-[var(--color-muted)]" />
            <h2 className="font-semibold text-[var(--color-navy)]">Security & Legal</h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {[
              { label: 'Change password', desc: 'Update your account password' },
              { label: 'Request data erasure (PDPA)', desc: 'Submit a request to delete your personal data' },
            ].map((item) => (
              <button
                key={item.label}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[var(--color-surface)]"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-muted)]">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
              </button>
            ))}
          </div>
        </section>

        {/* Logout */}
        <Button
          variant="outline"
          size="lg"
          className="w-full border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error-light)] hover:border-[var(--color-error)]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </main>
    </div>
  )
}
