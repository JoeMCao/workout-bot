import { randomBytes } from "node:crypto";
import type { WhoopConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerNow } from "@/lib/time";
import { WHOOP_PROVIDER, WHOOP_SCOPES, WHOOP_TOKEN_URL } from "./config";
import { decryptWhoopToken, encryptWhoopToken } from "./crypto";
import type { WhoopTokenResponse } from "./types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

export function generateWhoopOAuthState() {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

function expiresAtFromNow(expiresInSeconds: number) {
  return new Date(getServerNow().getTime() + expiresInSeconds * 1000);
}

async function postTokenRequest(params: Record<string, string>) {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `WHOOP token request failed (${response.status}): ${JSON.stringify(body)}`
    );
  }

  return body as WhoopTokenResponse;
}

export async function exchangeWhoopAuthorizationCode({
  code,
  clientId,
  clientSecret,
  redirectUri
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  return postTokenRequest({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });
}

export async function upsertWhoopConnection(tokens: WhoopTokenResponse) {
  return prisma.whoopConnection.upsert({
    where: { provider: WHOOP_PROVIDER },
    create: {
      provider: WHOOP_PROVIDER,
      accessTokenEncrypted: encryptWhoopToken(tokens.access_token),
      refreshTokenEncrypted: encryptWhoopToken(tokens.refresh_token),
      tokenType: tokens.token_type,
      scope: tokens.scope ?? WHOOP_SCOPES.join(" "),
      expiresAt: expiresAtFromNow(tokens.expires_in),
      lastSyncError: null
    },
    update: {
      accessTokenEncrypted: encryptWhoopToken(tokens.access_token),
      refreshTokenEncrypted: encryptWhoopToken(tokens.refresh_token),
      tokenType: tokens.token_type,
      scope: tokens.scope ?? WHOOP_SCOPES.join(" "),
      expiresAt: expiresAtFromNow(tokens.expires_in),
      lastSyncError: null
    }
  });
}

export async function refreshWhoopConnection(
  connection: WhoopConnection,
  {
    clientId,
    clientSecret
  }: {
    clientId: string;
    clientSecret: string;
  }
) {
  const tokens = await postTokenRequest({
    grant_type: "refresh_token",
    refresh_token: decryptWhoopToken(connection.refreshTokenEncrypted),
    client_id: clientId,
    client_secret: clientSecret,
    scope: "offline"
  });

  return upsertWhoopConnection(tokens);
}

export async function getValidWhoopAccessToken({
  clientId,
  clientSecret
}: {
  clientId: string;
  clientSecret: string;
}) {
  const connection = await prisma.whoopConnection.findUnique({
    where: { provider: WHOOP_PROVIDER }
  });

  if (!connection) {
    throw new Error("WHOOP is not connected");
  }

  const shouldRefresh =
    connection.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= getServerNow().getTime();
  const validConnection = shouldRefresh
    ? await refreshWhoopConnection(connection, { clientId, clientSecret })
    : connection;

  return {
    connection: validConnection,
    accessToken: decryptWhoopToken(validConnection.accessTokenEncrypted)
  };
}
