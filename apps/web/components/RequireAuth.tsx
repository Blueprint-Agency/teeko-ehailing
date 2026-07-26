'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

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

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/auth/login')
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
