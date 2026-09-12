'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

import { AddPhoneGate } from '@/components/driver/AddPhoneGate'
import { useWebAuthStore } from '@/stores/authStore'

/**
 * Client-side route guard for the driver portal.
 *
 * We deliberately do NOT run Clerk's `clerkMiddleware`, because that needs
 * CLERK_SECRET_KEY and the secret belongs to the backend only. Protection is
 * therefore client-side: an unauthenticated visitor sees a loading state and is
 * redirected, and no driver data can leak either way because every read goes
 * through the API with a Clerk bearer token that the backend verifies
 * (driverClerkAuthVerify) independently of anything the browser claims.
 *
 * Being signed in is not the same as being allowed to drive — that is still
 * gated by driver_applications.state and admin EVP approval.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const { needsPhone, isAuthenticated, hydrating, hydrate } = useWebAuthStore()

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/auth/login')
  }, [isLoaded, isSignedIn, router])

  // The store is the only place that knows whether our row has a phone, and a
  // deep link straight to /dashboard may never have passed through a page that
  // hydrated it.
  useEffect(() => {
    if (isLoaded && isSignedIn && !isAuthenticated && !hydrating) void hydrate()
  }, [isLoaded, isSignedIn, isAuthenticated, hydrating, hydrate])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      </div>
    )
  }

  // R6 gate. Rendered in place of the page rather than redirected to, so there
  // is no URL that skips it — a driver with no number cannot reach the
  // dashboard. `needsPhone` only becomes true once the store has actually read
  // our row, so this never flashes while hydrating.
  if (needsPhone) return <AddPhoneGate />

  return <>{children}</>
}
