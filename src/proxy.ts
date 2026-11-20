import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next 16 renamed the `middleware` file convention to `proxy`. Same semantics,
 * except the runtime is always Node rather than Edge.
 *
 * This is an optimistic check only. It keeps signed-out visitors out of the
 * admin shell, but it is not the authorisation boundary — RLS is. Every admin
 * page still has to fetch its own data through a client that carries the user's
 * session.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin');
  const isLoginRoute = request.nextUrl.pathname === '/login';

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // The query too, so a link with board filters (such as the daily digest's)
    // still shows the filtered board after signing in. The login page passes
    // `next` through `safeNextPath`, which keeps it on this site.
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
};
