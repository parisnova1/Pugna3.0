import { NextResponse, type NextRequest } from "next/server";

/**
 * Gates first-time (or long-absent) visitors into /onboarding. Deliberately
 * does NOT call next-auth's auth() here -- that would pull Prisma's
 * DB-touching jwt() callback onto the Edge runtime. Instead it treats the
 * mere presence of the session cookie as "already authenticated" (sufficient
 * with a Credentials-only provider: a session cookie can only exist on a
 * browser that already went through /account, which is itself exempt from
 * this gate) -- that check always wins, so a logged-in user never sees
 * onboarding regardless of the gate cookie below.
 *
 * The gate cookie itself is short-lived and slides forward on every
 * passthrough request. That means continuous browsing never re-triggers the
 * splash, but a guest who only ever clicked "Discover" (never signed up or
 * logged in) sees it again the next time they show up after being away
 * longer than ONBOARDING_COOKIE_MAX_AGE.
 */

const ONBOARDING_VERSION = "1";
const ONBOARDING_COOKIE = "pugna_onboarding_version";
const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 3; // 3 days of inactivity re-triggers onboarding
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// /onboarding (avoid self-redirect), /account (onboarding's own Sign In /
// Register destination -- gating it too would be circular and would break
// the existing returnTo flow), and /api (auth routes + polling endpoints).
const EXEMPT_PREFIXES = ["/onboarding", "/account", "/api"];

function isExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Only ever intercept real GET page navigations. Server Actions POST to
  // the current page's own URL -- leaving non-GET requests untouched means
  // no form/action anywhere in the app can be redirected into onboarding.
  if (request.method !== "GET") return NextResponse.next();

  // Skip static files (images, icons, etc.).
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next();

  if (isExempt(pathname)) return NextResponse.next();

  if (SESSION_COOKIES.some((name) => request.cookies.get(name))) {
    return NextResponse.next();
  }

  if (request.cookies.get(ONBOARDING_COOKIE)?.value === ONBOARDING_VERSION) {
    // Still within the gate window -- slide the expiry forward so continuous
    // browsing never gets interrupted, but real inactivity still lets it lapse.
    const response = NextResponse.next();
    response.cookies.set(ONBOARDING_COOKIE, ONBOARDING_VERSION, {
      path: "/",
      maxAge: ONBOARDING_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
    return response;
  }

  const returnTo = `${pathname}${search}`;
  const url = request.nextUrl.clone();
  url.pathname = "/onboarding";
  url.search = returnTo === "/" ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;

  const response = NextResponse.redirect(url);
  // Set in the same response that performs the redirect -- the visitor has
  // "seen" onboarding the moment they're sent there, so a refresh, back-nav,
  // or closing the tab without clicking anything never re-triggers the gate
  // within the window below.
  response.cookies.set(ONBOARDING_COOKIE, ONBOARDING_VERSION, {
    path: "/",
    maxAge: ONBOARDING_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
