'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { setTokenGetter } from '@/lib/api'
import { useWebAuthStore } from '@/stores/authStore'

/**
 * Two jobs, kept in one component so their ordering is guaranteed:
 *
 * 1. Hand Clerk's `getToken` to `lib/api` so plain (non-hook) API calls can
 *    attach the driver's bearer token. getToken() returns a cached token and
 *    refreshes near expiry, so calling it per request is the intended usage.
 * 2. Rehydrate our own driver row for an existing Clerk session. The auth store
 *    is no longer persisted, so without this a page refresh would look
 *    signed-out to the client guards even though Clerk still holds the session.
 */
export function ClerkTokenBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const hydrate = useWebAuthStore((s) => s.hydrate)
  const clear = useWebAuthStore((s) => s.clear)

  useEffect(() => {
    if (!isLoaded) return
    setTokenGetter(() => getToken())
    return () => setTokenGetter(null)
  }, [getToken, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      // Token getter is registered by the effect above, which runs first.
      void hydrate()
    } else {
      clear()
    }
  }, [isLoaded, isSignedIn, hydrate, clear])

  return null
}
