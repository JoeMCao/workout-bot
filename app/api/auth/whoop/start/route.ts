import { NextRequest, NextResponse } from "next/server";
import {
  WHOOP_AUTHORIZATION_URL,
  WHOOP_SCOPES,
  getWhoopClientConfig
} from "@/lib/whoop/config";
import { generateWhoopOAuthState } from "@/lib/whoop/oauth";

export async function GET(request: NextRequest) {
  const { clientId, redirectUri } = getWhoopClientConfig(request);
  const state = generateWhoopOAuthState();
  const url = new URL(WHOOP_AUTHORIZATION_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_SCOPES.join(" "));
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("whoop_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    maxAge: 10 * 60,
    path: "/api/auth/whoop"
  });

  return response;
}
