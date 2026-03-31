import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'fur_dentity_session';

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/reports/:path*', '/adoption/:path*', '/donation/:path*', '/users/:path*', '/pets/:path*', '/gps-devices/:path*', '/change-password'],
};
