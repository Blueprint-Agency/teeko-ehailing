import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/onboarding', '/dashboard', '/profile']
const AUTH_ROUTES = ['/auth/login', '/auth/verify', '/auth/register']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // In v0.1, auth is stored in sessionStorage (client-side only).
  // Middleware cannot read sessionStorage — protection is enforced client-side.
  // This middleware is a placeholder for v1.0 when JWT cookies are introduced.

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
