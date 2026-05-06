import type { ActivitySession, WhoopWorkoutMapping } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerNow } from "@/lib/time";
import {
  activitySyncStatus,
  whoopWorkoutIsStrengthLike,
  whoopWorkoutToActivityData,
  whoopWorkoutToActivitySessionUpdateInput
} from "./adapter";
import { WHOOP_API_BASE_URL, getWhoopClientConfig } from "./config";
import { fetchWhoopWorkoutPage } from "./client";
import { getValidWhoopAccessToken } from "./oauth";
import { WhoopSyncError, getErrorMessage } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";
import { strengthUnlinkedResyncSyncStatusDecision } from "./strength-resync-sync-status";
import { resolveWhoopStrengthWorkoutMatch } from "./strength-match";
import type { WhoopWorkout } from "./types";
import { normalizeWhoopWorkoutRecord } from "./workout-normalize";

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

export type SyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** WHOOP rows newly written with syncStatus=needs_review in this batch. */
  needsReview: number;
};

function rawWorkout(workout: WhoopWorkout) {
  return workout as unknown as Prisma.InputJsonValue;
}

type UpsertOutcome = { action: "inserted" | "updated"; needsReview: boolean };

async function resyncExistingMappedActivity(
  workout: WhoopWorkout,
  mapping: WhoopWorkoutMapping,
  activity: ActivitySession,
  mappingBase: {
    connectionId: string;
    whoopUpdatedAt: Date;
    raw: Prisma.InputJsonValue;
  }
): Promise<UpsertOutcome> {
  const isStrength = whoopWorkoutIsStrengthLike(workout);

  const updateMapping = () =>
    prisma.whoopWorkoutMapping.update({
      where: { id: mapping.id },
      data: mappingBase
    });

  if (!isStrength) {
    await prisma.$transaction([
      prisma.activitySession.update({
        where: { id: activity.id },
        data: whoopWorkoutToActivitySessionUpdateInput(workout, { syncStatus: null })
      }),
      updateMapping()
    ]);
    return { action: "updated", needsReview: false };
  }

  if (activity.relatedWorkoutSessionId) {
    await prisma.$transaction([
      prisma.activitySession.update({
        where: { id: activity.id },
        data: whoopWorkoutToActivitySessionUpdateInput(workout, { syncStatus: null })
      }),
      updateMapping()
    ]);
    return { action: "updated", needsReview: false };
  }

  const match = await resolveWhoopStrengthWorkoutMatch(new Date(workout.start));
  const decision = strengthUnlinkedResyncSyncStatusDecision({
    match,
    activityId: activity.id
  });

  if (decision === "clear" && match.kind === "unique") {
    await prisma.$transaction(async (tx) => {
      await tx.activitySession.update({
        where: { id: activity.id },
        data: {
          ...whoopWorkoutToActivitySessionUpdateInput(workout, { syncStatus: null }),
          relatedWorkoutSession: { connect: { id: match.workout.id } }
        }
      });
      await tx.whoopWorkoutMapping.update({
        where: { id: mapping.id },
        data: mappingBase
      });
    });
    return { action: "updated", needsReview: false };
  }

  await prisma.$transaction([
    prisma.activitySession.update({
      where: { id: activity.id },
      data: {
        ...whoopWorkoutToActivitySessionUpdateInput(workout, {}),
        syncStatus: activitySyncStatus.needsReview
      }
    }),
    updateMapping()
  ]);
  return { action: "updated", needsReview: false };
}

async function upsertWhoopWorkout(
  connectionId: string,
  workout: WhoopWorkout
): Promise<UpsertOutcome> {
  let mapping = await prisma.whoopWorkoutMapping.findUnique({
    where: { whoopWorkoutId: workout.id }
  });

  const mappingBase = {
    connectionId,
    whoopUpdatedAt: new Date(workout.updated_at),
    raw: rawWorkout(workout)
  };

  if (mapping?.activitySessionId) {
    const activity = await prisma.activitySession.findUnique({
      where: { id: mapping.activitySessionId }
    });
    if (activity) {
      return resyncExistingMappedActivity(workout, mapping, activity, mappingBase);
    }
    await prisma.whoopWorkoutMapping.update({
      where: { id: mapping.id },
      data: { activitySessionId: null }
    });
    mapping = await prisma.whoopWorkoutMapping.findUnique({
      where: { whoopWorkoutId: workout.id }
    });
  }

  const existing = mapping;

  const baseCreate = whoopWorkoutToActivityData(workout);
  const isStrength = whoopWorkoutIsStrengthLike(workout);

  async function attachMapping(activityId: string, tx: Prisma.TransactionClient) {
    if (existing) {
      await tx.whoopWorkoutMapping.update({
        where: { id: existing.id },
        data: { ...mappingBase, activitySessionId: activityId }
      });
    } else {
      await tx.whoopWorkoutMapping.create({
        data: {
          ...mappingBase,
          whoopWorkoutId: workout.id,
          activitySessionId: activityId
        }
      });
    }
  }

  if (!isStrength) {
    await prisma.$transaction(async (tx) => {
      const activity = await tx.activitySession.create({
        data: { ...baseCreate, syncStatus: null }
      });
      await attachMapping(activity.id, tx);
    });
    return { action: existing ? "updated" : "inserted", needsReview: false };
  }

  const match = await resolveWhoopStrengthWorkoutMatch(new Date(workout.start));

  if (match.kind === "unique") {
    const shell = match.shell;
    if (shell) {
      await prisma.$transaction(async (tx) => {
        await tx.activitySession.update({
          where: { id: shell.id },
          data: {
            ...whoopWorkoutToActivitySessionUpdateInput(workout, { syncStatus: null }),
            relatedWorkoutSession: { connect: { id: match.workout.id } }
          }
        });
        await attachMapping(shell.id, tx);
      });
      return { action: existing ? "updated" : "inserted", needsReview: false };
    }

    await prisma.$transaction(async (tx) => {
      const activity = await tx.activitySession.create({
        data: {
          ...baseCreate,
          syncStatus: null,
          relatedWorkoutSession: { connect: { id: match.workout.id } }
        }
      });
      await attachMapping(activity.id, tx);
    });
    return { action: existing ? "updated" : "inserted", needsReview: false };
  }

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activitySession.create({
      data: {
        ...baseCreate,
        syncStatus: activitySyncStatus.needsReview
      }
    });
    await attachMapping(activity.id, tx);
  });
  return { action: existing ? "updated" : "inserted", needsReview: true };
}

function wrapPersistError(error: unknown, whoopWorkoutId: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaCode = error.code;
    const http = prismaCode === "P2002" ? 409 : 500;
    const syncCode =
      prismaCode === "P2002"
        ? "WHOOP_PERSIST_FAILED_UNIQUE"
        : "WHOOP_PERSIST_FAILED_PRISMA";
    throw new WhoopSyncError(syncCode, error.message, http, {
      prismaCode,
      meta: error.meta,
      whoopWorkoutId
    });
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new WhoopSyncError(
      "WHOOP_PERSIST_FAILED_VALIDATION",
      error.message,
      500,
      { whoopWorkoutId }
    );
  }

  throw new WhoopSyncError(
    "WHOOP_PERSIST_FAILED",
    getErrorMessage(error),
    500,
    { whoopWorkoutId, cause: getErrorMessage(error) }
  );
}

export async function syncWhoopWorkouts({
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
  /** Optional correlation id (e.g. `x-user-id`); WHOOP row is still single-tenant. */
  userId?: string | null;
} = {}): Promise<SyncResult> {
  const log = logMaybe ?? ((_e: WhoopSyncLogEvent) => {});

  log({
    phase: "sync_request",
    start: start ?? null,
    end: end ?? null,
    maxPages,
    userId
  });

  let connectionId: string | undefined;

  try {
    let clientId: string;
    let clientSecret: string;
    try {
      ({ clientId, clientSecret } = getWhoopClientConfig(request));
    } catch (error) {
      throw new WhoopSyncError(
        "WHOOP_CONFIG_FAILED",
        getErrorMessage(error),
        503,
        { cause: getErrorMessage(error) }
      );
    }

    const { connection, accessToken } = await getValidWhoopAccessToken(
      { clientId, clientSecret },
      log
    );
    connectionId = connection.id;

    const result: SyncResult = {
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      needsReview: 0
    };
    let nextToken: string | undefined;
    let page = 0;

    const whoopConnectionContext = {
      connectionScope: connection.scope ?? null,
      readWorkout: scopeIncludesReadWorkout(connection.scope)
    };

    do {
      const payload = await fetchWhoopWorkoutPage({
        accessToken,
        start,
        end,
        nextToken,
        page: page + 1,
        log,
        whoopConnectionContext
      });

      for (const raw of payload.records ?? []) {
        result.fetched += 1;
        const workout = normalizeWhoopWorkoutRecord(raw, log);

        if (!workout) {
          result.skipped += 1;
          continue;
        }

        log({
          phase: "persist_workout_start",
          connectionId,
          whoopWorkoutId: workout.id
        });

        try {
          const outcome = await upsertWhoopWorkout(connection.id, workout);
          result[outcome.action] += 1;
          if (outcome.needsReview) result.needsReview += 1;
          log({
            phase: "persist_workout_complete",
            connectionId,
            whoopWorkoutId: workout.id,
            action: outcome.action,
            needsReview: outcome.needsReview
          });
        } catch (error) {
          log({
            phase: "persist_workout_error",
            connectionId,
            whoopWorkoutId: workout.id,
            message: getErrorMessage(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          wrapPersistError(error, workout.id);
        }

        if (workout.user_id != null) {
          log({
            phase: "db_write",
            step: "whoop_connection_whoop_user_id",
            connectionId,
            whoopUserId: workout.user_id
          });
          await prisma.whoopConnection.update({
            where: { id: connection.id },
            data: { whoopUserId: workout.user_id }
          });
        }
      }

      nextToken = payload.next_token;
      page += 1;
    } while (nextToken && page < maxPages);

    log({
      phase: "connection_sync_meta",
      step: "success",
      connectionId,
      lastSyncAt: getServerNow().toISOString()
    });

    await prisma.whoopConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: getServerNow(),
        lastSyncError: null
      }
    });

    return result;
  } catch (error) {
    log({
      phase: "sync_fatal",
      userId,
      connectionId: connectionId ?? null,
      message: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
      code: error instanceof WhoopSyncError ? error.code : undefined
    });

    if (connectionId) {
      const msg =
        error instanceof WhoopSyncError
          ? `${error.code}: ${error.message}`
          : getErrorMessage(error);
      await prisma.whoopConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncError: msg.slice(0, 2000)
        }
      });
    }

    throw error;
  }
}

export function grantedScopesList(scope: string | null | undefined) {
  if (!scope?.trim()) return [];
  return scope.split(/[\s,]+/).filter(Boolean);
}

function scopeIncludesReadWorkout(scope: string | null | undefined) {
  return grantedScopesList(scope).includes("read:workout");
}

export function scopeIncludesReadSleep(scope: string | null | undefined) {
  return grantedScopesList(scope).includes("read:sleep");
}

export function scopeIncludesReadRecovery(scope: string | null | undefined) {
  return grantedScopesList(scope).includes("read:recovery");
}

/** WHOOP OpenAPI server URL + collection path (query string added per request in `fetchWhoopWorkoutPage`). */
const WHOOP_WORKOUT_COLLECTION_PATH = "/v2/activity/workout";

function whoopDeploymentDiagnostics() {
  return {
    whoopDeveloperApiBase: WHOOP_API_BASE_URL,
    whoopWorkoutCollectionUrl:
      `${WHOOP_API_BASE_URL.replace(/\/$/, "")}${WHOOP_WORKOUT_COLLECTION_PATH}`,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null
  };
}

export async function getWhoopStatus() {
  const connection = await prisma.whoopConnection.findUnique({
    where: { provider: "whoop" },
    include: {
      _count: {
        select: { workoutMappings: true }
      }
    }
  });

  const diag = whoopDeploymentDiagnostics();

  if (!connection) {
    return {
      connected: false,
      lastSyncAt: null,
      lastSyncError: null,
      expiresAt: null,
      workoutCount: 0,
      /** Rows in `WhoopWorkoutMapping` (WHOOP ids we have seen); not the same as ActivitySession count. */
      whoopActivitySessionCount: 0,
      needsReviewActivityCount: 0,
      scope: null as string | null,
      readWorkout: false,
      readSleep: false,
      readRecovery: false,
      lastHealthContextAt: null as string | null,
      ...diag
    };
  }

  const [needsReviewActivityCount, whoopActivitySessionCount] = await Promise.all([
    prisma.activitySession.count({
      where: { syncStatus: activitySyncStatus.needsReview }
    }),
    prisma.activitySession.count({ where: { source: "whoop_api" } })
  ]);

  let lastHealthContextAt: string | null = null;
  try {
    const [latestSleep, latestRecovery] = await Promise.all([
      prisma.whoopSleep.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true }
      }),
      prisma.whoopRecovery.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true }
      })
    ]);
    const tSleep = latestSleep?.updatedAt?.getTime() ?? 0;
    const tRec = latestRecovery?.updatedAt?.getTime() ?? 0;
    lastHealthContextAt =
      tSleep > 0 || tRec > 0
        ? new Date(Math.max(tSleep, tRec)).toISOString()
        : null;
  } catch {
    lastHealthContextAt = null;
  }

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    expiresAt: connection.expiresAt.toISOString(),
    workoutCount: connection._count.workoutMappings,
    whoopActivitySessionCount,
    needsReviewActivityCount,
    scope: connection.scope ?? null,
    readWorkout: scopeIncludesReadWorkout(connection.scope),
    readSleep: scopeIncludesReadSleep(connection.scope),
    readRecovery: scopeIncludesReadRecovery(connection.scope),
    lastHealthContextAt,
    ...diag
  };
}
