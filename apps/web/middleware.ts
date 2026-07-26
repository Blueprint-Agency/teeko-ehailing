import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose'

// ---------------------------------------------------------------------------
// Server-side route gating WITHOUT Clerk's secret key.
//
// We do not use `clerkMiddleware()`: it requires CLERK_SECRET_KEY, and the
// secret belongs to the backend only (apps/backend, CLERK_DRIVER_SECRET_KEY).
// Verifying a Clerk session JWT needs only the instance's PUBLIC key, which
// Clerk publishes as JWKS — so we verify the signature here, locally, with no
// secret and no network hop to our own API.
//
// This is defence in depth, not the enforcement point. The backend independently
// verifies the bearer token on every request (driverClerkAuthVerify), so nothing
// here can be talked around by a forged cookie.
// ---------------------------------------------------------------------------

const PROTECTED = ['/onboarding', '/dashboard', '/profile']

/**
 * Clerk publishable keys encode the instance's Frontend API host:
 * `pk_test_<base64("my-app-123.clerk.accounts.dev$")>`. Deriving it means no
 * extra env var, and it is impossible for the JWKS host to drift out of sync
 * with the key the browser signs in against.
 */
function frontendApiHost(): string | null {
  const explicit = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  if (explicit) return explicit.replace(/^https?:\/\//, '')

  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const match = pk ? /^pk_(?:test|live)_(.+)$/.exec(pk) : null
  if (!match) return null
  try {
    // Trailing '$' is part of Clerk's encoding, not the hostname.
    return atob(match[1]).replace(/\$+$/, '') || null
  } catch {
    return null
  }
}

const host = frontendApiHost()
const issuer = host ? `https://${host}` : null
// Module-scoped so jose caches the fetched key set across requests.
const jwks = host ? createRemoteJWKSet(new URL(`https://${host}/.well-known/jwks.json`)) : null

function redirectToLogin(request: NextRequest) {
  const url = new URL('/auth/login', request.url)
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  // Misconfiguration (missing/malformed publishable key) must not lock every
  // driver out of the portal. Fall through to the RequireAuth client guard and
  // the backend's own token check, which remain authoritative.
  if (!jwks || !issuer) {
    console.warn('[middleware] no Clerk frontend API resolved; skipping server-side gate')
    return NextResponse.next()
  }

  const token = request.cookies.get('__session')?.value
  if (!token) return redirectToLogin(request)

  try {
    await jwtVerify(token, jwks, { issuer, clockTolerance: '5s' })
    return NextResponse.next()
  } catch (err) {
    // jose validates the signature BEFORE the claims, so ERR_JWT_EXPIRED proves
    // the token is genuinely ours — just stale. Clerk session tokens live ~60s
    // and are refreshed by the client SDK, so an expired cookie is the normal
    // state on a cold navigation after idle. Redirecting here would log drivers
    // out constantly; instead let the page render and let RequireAuth refresh
    // the session (and redirect if it truly is gone).
    if (err instanceof joseErrors.JWTExpired) {
      return NextResponse.next()
    }
    // Bad signature, wrong issuer, malformed token — not a real session.
    return redirectToLogin(request)
  }
}

export const config = {
  matcher: ['/onboarding/:path*', '/dashboard/:path*', '/profile/:path*'],
}
