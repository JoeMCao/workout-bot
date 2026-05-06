import { randomBytes } from "node:crypto";
import type { WhoopConnection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerNow } from "@/lib/time";
import { WHOOP_PROVIDER, WHOOP_SCOPES, WHOOP_TOKEN_URL } from "./config";
import { decryptWhoopToken, encryptWhoopToken } from "./crypto";
import { WhoopSyncError, getErrorMessage } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";
import type { WhoopTokenResponse } from "./types";

const TOKEN_EXPIRY_BUFFER_MS = 60_000;

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

function redactTokenJsonForLogs(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const o = { ...(body as Record<string, unknown>) };
  if ("access_token" in o) o.access_token = "[redacted]";
  if ("refresh_token" in o) o.refresh_token = "[redacted]";
  return o;
}

export function generateWhoopOAuthState() {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

function expiresAtFromNow(expiresInSeconds: number) {
  return new Date(getServerNow().getTime() + expiresInSeconds * 1000);
}

async function postTokenRequest(
  params: Record<string, string>,
  log?: SyncLogFn
) {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params)
  });

  const body = await response.json().catch(() => null);

  log?.({
    phase: "whoop_token_http",
    ok: response.ok,
    status: response.status,
    responseBody: redactTokenJsonForLogs(body)
  });

  if (!response.ok) {
    throw new WhoopSyncError(
      "WHOOP_TOKEN_REFRESH_FAILED",
      `WHOOP token endpoint returned ${response.status}`,
      response.status === 401 || response.status === 403 ? 401 : 502,
      { httpStatus: response.status, body }
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
  },
  log?: SyncLogFn
) {
  let refreshPlain: string;
  try {
    refreshPlain = decryptWhoopToken(connection.refreshTokenEncrypted);
    log?.({ phase: "token_decrypt", field: "refresh", ok: true });
  } catch (error) {
    log?.({
      phase: "token_decrypt",
      field: "refresh",
      ok: false,
      error: getErrorMessage(error)
    });
    throw new WhoopSyncError(
      "WHOOP_TOKEN_DECRYPT_FAILED",
      "Could not decrypt stored WHOOP refresh token",
      401,
      { field: "refresh", cause: getErrorMessage(error) }
    );
  }

  const tokens = await postTokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshPlain,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "offline"
    },
    log
  );

  return upsertWhoopConnection(tokens);
}

export async function getValidWhoopAccessToken(
  {
    clientId,
    clientSecret
  }: {
    clientId: string;
    clientSecret: string;
  },
  log?: SyncLogFn
) {
  let connection: WhoopConnection | null;
  try {
    connection = await prisma.whoopConnection.findUnique({
      where: { provider: WHOOP_PROVIDER }
    });
  } catch (error) {
    log?.({ phase: "connection_lookup", ok: false, error: getErrorMessage(error) });
    throw new WhoopSyncError(
      "WHOOP_CONNECTION_LOOKUP_FAILED",
      getErrorMessage(error),
      500,
      { cause: getErrorMessage(error) }
    );
  }

  log?.({
    phase: "connection_lookup",
    ok: true,
    connectionFound: !!connection,
    connectionId: connection?.id ?? null,
    expiresAt: connection?.expiresAt?.toISOString() ?? null,
    whoopUserId: connection?.whoopUserId ?? null
  });

  if (!connection) {
    throw new WhoopSyncError(
      "WHOOP_CONNECTION_LOOKUP_FAILED",
      "No WHOOP connection row for this app (complete OAuth first)",
      401
    );
  }

  const shouldRefresh =
    connection.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= getServerNow().getTime();

  log?.({
    phase: "token_eval",
    shouldRefresh,
    expiresAt: connection.expiresAt.toISOString(),
    now: getServerNow().toISOString()
  });

  let validConnection = connection;
  if (shouldRefresh) {
    log?.({ phase: "token_refresh_attempt", refreshAttempted: true });
    validConnection = await refreshWhoopConnection(
      connection,
      { clientId, clientSecret },
      log
    );
    log?.({
      phase: "token_refresh_complete",
      connectionId: validConnection.id,
      newExpiresAt: validConnection.expiresAt.toISOString()
    });
  } else {
    log?.({ phase: "token_refresh_attempt", refreshAttempted: false });
  }

  let accessToken: string;
  try {
    accessToken = decryptWhoopToken(validConnection.accessTokenEncrypted);
    log?.({ phase: "token_decrypt", field: "access", ok: true });
  } catch (error) {
    log?.({
      phase: "token_decrypt",
      field: "access",
      ok: false,
      error: getErrorMessage(error)
    });
    throw new WhoopSyncError(
      "WHOOP_TOKEN_DECRYPT_FAILED",
      "Could not decrypt stored WHOOP access token",
      401,
      { field: "access", cause: getErrorMessage(error) }
    );
  }

  return {
    connection: validConnection,
    accessToken
  };
}
