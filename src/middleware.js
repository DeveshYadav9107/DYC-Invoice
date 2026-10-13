// ─────────────────────────────────────────────────────────────────
// Next.js Middleware — Route protection & session gate
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'invoiceflow_session';

// Public routes that unauthenticated users can access
const PUBLIC_PATHS = ['/login', '/signup', '/api/auth/request-otp', '/api/auth/verify-otp'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  // Allow static files and internal Next.js assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // If user is authenticated and visits login/signup, redirect to dashboard
  if (hasSessionCookie && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If user is unauthenticated and visits protected routes, redirect to login
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (!hasSessionCookie && !isPublic && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
