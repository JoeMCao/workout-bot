import { NextRequest, NextResponse } from "next/server";
import { getWhoopClientConfig } from "@/lib/whoop/config";
import {
  exchangeWhoopAuthorizationCode,
  upsertWhoopConnection
} from "@/lib/whoop/oauth";

function dashboardRedirect(request: NextRequest, status: "connected" | "error") {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("whoop", status);
  return NextResponse.redirect(url);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set("whoop_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/api/auth/whoop"
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("whoop_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    const response = dashboardRedirect(request, "error");
    clearStateCookie(response);
    return response;
  }

  try {
    const { clientId, clientSecret, redirectUri } = getWhoopClientConfig(request);
    const tokens = await exchangeWhoopAuthorizationCode({
      code,
      clientId,
      clientSecret,
      redirectUri
    });
    await upsertWhoopConnection(tokens);

    const response = dashboardRedirect(request, "connected");
    clearStateCookie(response);
    return response;
  } catch (error) {
    console.error("[whoop] OAuth callback failed", error);
    const response = dashboardRedirect(request, "error");
    clearStateCookie(response);
    return response;
  }
}
