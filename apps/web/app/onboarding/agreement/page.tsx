'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/stores/onboardingStore'

const AGREEMENT_TEXT = `TEEKO DRIVER-PARTNER AGREEMENT

Last updated: 1 January 2026

This Driver-Partner Agreement ("Agreement") is entered into between Teeko Sdn. Bhd. ("Teeko", "we", "us") and you, the driver-partner ("Driver", "you").

1. NATURE OF RELATIONSHIP
You are an independent contractor and not an employee, agent, or partner of Teeko. Teeko provides a technology platform connecting riders with drivers. Teeko does not direct or control how you provide transportation services.

2. ELIGIBILITY AND LICENSING
You must hold a valid NRIC / MyKad, a Competent Driving Licence (CDL), a PSV-D Licence (E-hailing Licence) issued by APAD or LPKP, and a valid e-hailing insurance cover note at all times while using the Teeko platform. Your vehicle must comply with the age and condition requirements specified in the Vehicle Policy.

3. E-HAILING VEHICLE PERMIT (EVP)
Teeko will submit your EVP application to the relevant authority (APAD for West Malaysia / LPKP for East Malaysia) on your behalf after your documents are verified. You may not commence e-hailing operations until your EVP is approved and your Teeko account is activated.

4. COMMISSION AND PAYMENTS
Teeko charges a platform commission on completed trips as disclosed in the current fee schedule. Payments are made via bank transfer (DuitNow) on a T+1 cycle unless otherwise stated. Teeko reserves the right to adjust commission rates with 14 days' notice.

5. PDPA 2010 — DATA COLLECTION
By accepting this Agreement, you consent to the collection, use, and disclosure of your personal data for purposes including onboarding, EVP application, regulatory compliance, and communication. You have the right to access and correct your personal data. Data erasure requests may be submitted via the profile page.

6. CODE OF CONDUCT
You agree to treat all riders with respect, comply with all applicable traffic laws, maintain your vehicle in a safe and clean condition, and not engage in any discriminatory or abusive behaviour. Teeko may suspend or terminate your account for violations.

7. INSURANCE
You are responsible for maintaining valid e-hailing insurance for your vehicle. Teeko does not provide insurance coverage for your vehicle or personal liability.

8. TERMINATION
Either party may terminate this Agreement at any time. Teeko may immediately suspend or terminate your access to the platform if you breach this Agreement or applicable law.

9. LIMITATION OF LIABILITY
To the maximum extent permitted by Malaysian law, Teeko's total liability to you shall not exceed the total commissions earned in the 30 days preceding the event giving rise to the claim.

10. GOVERNING LAW
This Agreement is governed by the laws of Malaysia. Any disputes shall be subject to the exclusive jurisdiction of the courts of Malaysia.

By accepting this Agreement, you confirm that you have read, understood, and agree to be bound by these terms.`

export default function AgreementPage() {
  const router = useRouter()
  const { acceptAgreement, setStep } = useOnboardingStore()
  const [scrolled, setScrolled] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom) setScrolled(true)
  }

  const handleAccept = () => {
    acceptAgreement()
    setStep(1)
    router.push('/onboarding/personal-docs')
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="mb-2 font-display text-3xl text-[var(--color-navy)]">Driver Agreement</h1>
        <p className="text-[var(--color-muted)]">
          Please read the full agreement carefully before proceeding.
        </p>
      </div>

      {/* Scrollable T&C */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[420px] overflow-y-auto p-8"
        >
          <pre className="whitespace-pre-wrap font-body text-sm leading-7 text-[var(--color-text)]">
            {AGREEMENT_TEXT}
          </pre>
        </div>

        {/* Bottom */}
        <div className="rounded-b-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          {!scrolled && (
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              Scroll to the bottom to enable acceptance
            </div>
          )}

          <label
            className={`flex cursor-pointer items-start gap-3 transition-opacity ${!scrolled ? 'opacity-40' : 'opacity-100'}`}
          >
            <input
              type="checkbox"
              disabled={!scrolled}
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded accent-[var(--color-teal)]"
            />
            <span className="text-sm text-[var(--color-text)]">
              I have read and agree to the Teeko Driver-Partner Agreement and Terms of Service
            </span>
          </label>

          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={!accepted}
            onClick={handleAccept}
          >
            {accepted ? <><CheckCircle2 className="h-4 w-4" /> Accept & Continue</> : 'Accept & Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
