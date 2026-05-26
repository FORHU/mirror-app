import { NextRequest, NextResponse } from "next/server";
import { ROUTES, ROUTE_RULES } from "./navigation";

// Exact match for "/" to avoid matching every pathname; prefix match for all others
function matchesRoute(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(route + "/");
}

function matchesAny(pathname: string, routes: readonly string[]): boolean {
  return routes.some((r) => matchesRoute(pathname, r));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.cookies.get("mirror_session")?.value;

  if (!isLoggedIn && matchesAny(pathname, ROUTE_RULES.protected)) {
    return NextResponse.redirect(new URL(ROUTES.WELCOME, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
