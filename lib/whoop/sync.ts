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
import { getWhoopClientConfig } from "./config";
import { fetchWhoopWorkoutPage } from "./client";
import { getValidWhoopAccessToken } from "./oauth";
import { strengthUnlinkedResyncSyncStatusDecision } from "./strength-resync-sync-status";
import { resolveWhoopStrengthWorkoutMatch } from "./strength-match";
import type { WhoopWorkout } from "./types";

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

export async function syncWhoopWorkouts({
  request,
  start,
  end,
  maxPages = 10
}: {
  request?: Request;
  start?: string;
  end?: string;
  maxPages?: number;
} = {}): Promise<SyncResult> {
  const { clientId, clientSecret } = getWhoopClientConfig(request);
  const { connection, accessToken } = await getValidWhoopAccessToken({
    clientId,
    clientSecret
  });
  const result: SyncResult = {
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    needsReview: 0
  };
  let nextToken: string | undefined;
  let page = 0;

  try {
    do {
      const payload = await fetchWhoopWorkoutPage({
        accessToken,
        start,
        end,
        nextToken
      });

      for (const workout of payload.records ?? []) {
        result.fetched += 1;

        if (!workout.id || !workout.start || !workout.end) {
          result.skipped += 1;
          continue;
        }

        const outcome = await upsertWhoopWorkout(connection.id, workout);
        result[outcome.action] += 1;
        if (outcome.needsReview) result.needsReview += 1;

        if (workout.user_id) {
          await prisma.whoopConnection.update({
            where: { id: connection.id },
            data: { whoopUserId: workout.user_id }
          });
        }
      }

      nextToken = payload.next_token;
      page += 1;
    } while (nextToken && page < maxPages);

    await prisma.whoopConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: getServerNow(),
        lastSyncError: null
      }
    });

    return result;
  } catch (error) {
    await prisma.whoopConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncError: error instanceof Error ? error.message : "WHOOP sync failed"
      }
    });

    throw error;
  }
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

  if (!connection) {
    return {
      connected: false,
      lastSyncAt: null,
      lastSyncError: null,
      expiresAt: null,
      workoutCount: 0,
      needsReviewActivityCount: 0
    };
  }

  const needsReviewActivityCount = await prisma.activitySession.count({
    where: { syncStatus: activitySyncStatus.needsReview }
  });

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    expiresAt: connection.expiresAt.toISOString(),
    workoutCount: connection._count.workoutMappings,
    needsReviewActivityCount
  };
}
