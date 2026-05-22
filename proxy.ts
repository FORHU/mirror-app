import { NextRequest, NextResponse } from "next/server";
import { ROUTES, ROUTE_RULES } from "./navigation";

const LOGIN_STEP_COOKIE = "mirror_login_step";
const FIT_STEP_COOKIE = "mirror_fit_step";

// Exact match for "/" to avoid matching every pathname; prefix match for all others
function matchesRoute(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(route + "/");
}

function matchesAny(pathname: string, routes: readonly string[]): boolean {
  return routes.some((r) => matchesRoute(pathname, r));
}

function sequenceIndex(pathname: string, sequence: readonly string[]): number {
  return sequence.findIndex((r) => matchesRoute(pathname, r));
}

function savedStep(request: NextRequest, cookie: string): number {
  return parseInt(request.cookies.get(cookie)?.value ?? "-1", 10);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.cookies.get("mirror_session")?.value;

  // ── 1. Auth guards (run before sequence checks) ────────────────────────────

  if (isLoggedIn && matchesAny(pathname, ROUTE_RULES.guestOnly)) {
    const res = NextResponse.redirect(new URL(ROUTES.LOGGED_IN, request.url));
    res.cookies.delete(LOGIN_STEP_COOKIE);
    return res;
  }

  if (!isLoggedIn && matchesAny(pathname, ROUTE_RULES.protected)) {
    return NextResponse.redirect(new URL(ROUTES.WELCOME, request.url));
  }

  // ── 2. Login sequence (guest users) ────────────────────────────────────────
  //
  // Cookie tracks highest step index reached.
  // Initial value -1 means no steps completed yet.
  //   step 0 (/)              — always accessible; unlocks step 1
  //   step 1 (/qrcode/…)     — requires step 0 completed
  //   step 2 (/waiting-login) — requires step 1 completed

  const loginIdx = sequenceIndex(pathname, ROUTE_RULES.sequences.login);
  if (loginIdx >= 0 && !isLoggedIn) {
    const progress = savedStep(request, LOGIN_STEP_COOKIE);
    if (loginIdx > progress + 1) {
      // Skipped ahead — send to first incomplete step
      const firstIncomplete = ROUTE_RULES.sequences.login[progress + 1];
      return NextResponse.redirect(new URL(firstIncomplete, request.url));
    }
    const res = NextResponse.next();
    res.cookies.set(LOGIN_STEP_COOKIE, String(Math.max(progress, loginIdx)), {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    return res;
  }

  // ── 3. Fit sequence (logged-in users) ──────────────────────────────────────
  //
  //   step 0 (/waiting-personalize)       — requires logged-in; unlocks step 1
  //   step 1 (/ai-recommendation-outfit)  — requires step 0 completed

  const fitIdx = sequenceIndex(pathname, ROUTE_RULES.sequences.fit);
  if (fitIdx >= 0 && isLoggedIn) {
    const progress = savedStep(request, FIT_STEP_COOKIE);
    if (fitIdx > progress + 1) {
      // Skipped ahead — send to first incomplete step
      const firstIncomplete = ROUTE_RULES.sequences.fit[progress + 1];
      return NextResponse.redirect(new URL(firstIncomplete, request.url));
    }
    const res = NextResponse.next();
    res.cookies.set(FIT_STEP_COOKIE, String(Math.max(progress, fitIdx)), {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
