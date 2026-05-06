import { prisma } from "@/lib/prisma";
import { getWhoopClientConfig } from "./config";
import { fetchWhoopRecoveriesPage, fetchWhoopSleepsPage } from "./health-context-fetch";
import { mapWhoopRecoveryToUpsert, mapWhoopSleepToUpsert } from "./health-context-map";
import { getValidWhoopAccessToken } from "./oauth";
import { WhoopSyncError, getErrorMessage } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";
import {
  scopeIncludesReadRecovery,
  scopeIncludesReadSleep
} from "./sync";

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

export type HealthContextSyncCounts = {
  sleepsFetched: number;
  sleepsInserted: number;
  sleepsUpdated: number;
  recoveriesFetched: number;
  recoveriesInserted: number;
  recoveriesUpdated: number;
  errors: string[];
};

function emptyCounts(): HealthContextSyncCounts {
  return {
    sleepsFetched: 0,
    sleepsInserted: 0,
    sleepsUpdated: 0,
    recoveriesFetched: 0,
    recoveriesInserted: 0,
    recoveriesUpdated: 0,
    errors: []
  };
}

export async function syncWhoopSleep({
  request,
  start,
  end,
  maxPages = 10,
  log: logMaybe,
  userId = null
}: {
  request?: Request;
  start?: string;
  end?: string;
  maxPages?: number;
  log?: SyncLogFn;
  userId?: string | null;
} = {}): Promise<HealthContextSyncCounts> {
  const log = logMaybe ?? ((_e: WhoopSyncLogEvent) => {});
  const out = emptyCounts();

  const { clientId, clientSecret } = getWhoopClientConfig(request);
  const { connection, accessToken } = await getValidWhoopAccessToken(
    { clientId, clientSecret },
    log
  );

  if (!scopeIncludesReadSleep(connection.scope)) {
    throw new WhoopSyncError(
      "WHOOP_SCOPE_MISSING",
      "WHOOP connection is missing read:sleep scope; reconnect with sleep access.",
      403,
      { scope: connection.scope }
    );
  }

  const whoopConnectionContext = {
    connectionScope: connection.scope ?? null,
    resource: "sleep" as const
  };

  let nextToken: string | undefined;
  let page = 0;

  do {
    const payload = await fetchWhoopSleepsPage({
      accessToken,
      start,
      end,
      nextToken,
      page: page + 1,
      log,
      whoopConnectionContext
    });

    for (const raw of payload.records ?? []) {
      out.sleepsFetched += 1;
      try {
        const row = mapWhoopSleepToUpsert(raw);
        if (!row) {
          out.errors.push("sleep: skip (missing id or valid timestamps)");
          continue;
        }
        const existing = await prisma.whoopSleep.findUnique({
          where: { sourceSleepId: row.sourceSleepId }
        });
        const { sourceSleepId, ...update } = row;
        await prisma.whoopSleep.upsert({
          where: { sourceSleepId },
          create: row,
          update
        });
        if (existing) out.sleepsUpdated += 1;
        else out.sleepsInserted += 1;
      } catch (e) {
        out.errors.push(`sleep row: ${getErrorMessage(e)}`);
      }
    }

    nextToken = payload.next_token;
    page += 1;
  } while (nextToken && page < maxPages);

  log({
    phase: "health_context_sleep_done",
    userId,
    ...out
  });

  return out;
}

export async function syncWhoopRecovery({
  request,
  start,
  end,
  maxPages = 10,
  log: logMaybe,
  userId = null
}: {
  request?: Request;
  start?: string;
  end?: string;
  maxPages?: number;
  log?: SyncLogFn;
  userId?: string | null;
} = {}): Promise<HealthContextSyncCounts> {
  const log = logMaybe ?? ((_e: WhoopSyncLogEvent) => {});
  const out = emptyCounts();

  const { clientId, clientSecret } = getWhoopClientConfig(request);
  const { connection, accessToken } = await getValidWhoopAccessToken(
    { clientId, clientSecret },
    log
  );

  if (!scopeIncludesReadRecovery(connection.scope)) {
    throw new WhoopSyncError(
      "WHOOP_SCOPE_MISSING",
      "WHOOP connection is missing read:recovery scope; reconnect with recovery access.",
      403,
      { scope: connection.scope }
    );
  }

  const whoopConnectionContext = {
    connectionScope: connection.scope ?? null,
    resource: "recovery" as const
  };

  let nextToken: string | undefined;
  let page = 0;

  do {
    const payload = await fetchWhoopRecoveriesPage({
      accessToken,
      start,
      end,
      nextToken,
      page: page + 1,
      log,
      whoopConnectionContext
    });

    for (const raw of payload.records ?? []) {
      out.recoveriesFetched += 1;
      try {
        const row = mapWhoopRecoveryToUpsert(raw);
        if (!row) {
          out.errors.push("recovery: skip (no cycle_id / id or timestamps)");
          continue;
        }
        const existing = await prisma.whoopRecovery.findUnique({
          where: { sourceRecoveryId: row.sourceRecoveryId }
        });
        const { sourceRecoveryId, ...update } = row;
        await prisma.whoopRecovery.upsert({
          where: { sourceRecoveryId },
          create: row,
          update
        });
        if (existing) out.recoveriesUpdated += 1;
        else out.recoveriesInserted += 1;
      } catch (e) {
        out.errors.push(`recovery row: ${getErrorMessage(e)}`);
      }
    }

    nextToken = payload.next_token;
    page += 1;
  } while (nextToken && page < maxPages);

  log({
    phase: "health_context_recovery_done",
    userId,
    ...out
  });

  return out;
}

/** Runs sleep then recovery sync; merges counts. One resource failing does not block the other. */
export async function syncWhoopHealthContext({
  request,
  start,
  end,
  maxPages = 10,
  log: logMaybe,
  userId = null
}: {
  request?: Request;
  start?: string;
  end?: string;
  maxPages?: number;
  log?: SyncLogFn;
  userId?: string | null;
} = {}): Promise<HealthContextSyncCounts> {
  const merged = emptyCounts();
  const log = logMaybe ?? ((_e: WhoopSyncLogEvent) => {});

  try {
    const sleepResult = await syncWhoopSleep({
      request,
      start,
      end,
      maxPages,
      log,
      userId
    });
    merged.sleepsFetched += sleepResult.sleepsFetched;
    merged.sleepsInserted += sleepResult.sleepsInserted;
    merged.sleepsUpdated += sleepResult.sleepsUpdated;
    merged.errors.push(...sleepResult.errors);
  } catch (e) {
    const msg = e instanceof WhoopSyncError ? `${e.code}: ${e.message}` : getErrorMessage(e);
    merged.errors.push(`sleep sync failed: ${msg}`);
  }

  try {
    const recoveryResult = await syncWhoopRecovery({
      request,
      start,
      end,
      maxPages,
      log,
      userId
    });
    merged.recoveriesFetched += recoveryResult.recoveriesFetched;
    merged.recoveriesInserted += recoveryResult.recoveriesInserted;
    merged.recoveriesUpdated += recoveryResult.recoveriesUpdated;
    merged.errors.push(...recoveryResult.errors);
  } catch (e) {
    const msg = e instanceof WhoopSyncError ? `${e.code}: ${e.message}` : getErrorMessage(e);
    merged.errors.push(`recovery sync failed: ${msg}`);
  }

  log({
    phase: "health_context_combined_done",
    userId,
    ...merged
  });

  return merged;
}
