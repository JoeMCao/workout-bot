import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isDebugEnabled,
  safeSearchParamsForDebug
} from "@/lib/api-debug";

export function middleware(request: NextRequest) {
  if (isDebugEnabled(request)) {
    const url = request.nextUrl;
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        service: "api",
        phase: "ingress",
        method: request.method,
        route: url.pathname.replace(/^\/api\//, ""),
        pathname: url.pathname,
        query: safeSearchParamsForDebug(url)
      })
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*"
};
