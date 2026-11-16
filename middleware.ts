import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const SETUP_ERROR = `<!doctype html><html><body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 16px;color:#0f172a">
<h1 style="font-size:20px">Server configuration missing</h1>
<p>The Supabase environment variables are not set for this deployment.</p>
<p>In Vercel: <b>Project → Settings → Environment Variables</b>, add
<code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>,
then <b>Deployments → ⋯ → Redeploy</b>.</p></body></html>`;

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
    return new NextResponse(SETUP_ERROR, { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    user = null; // auth service unreachable → treat as signed out (protected pages redirect to login)
  }
  const path = request.nextUrl.pathname;
  const area = ['student', 'teacher', 'admin'].find((r) => path === `/${r}` || path.startsWith(`/${r}/`));
  if (area && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/login/${area}`;
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
