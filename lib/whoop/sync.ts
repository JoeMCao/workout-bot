import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerNow } from "@/lib/time";
import { getWhoopClientConfig } from "./config";
import { fetchWhoopWorkoutPage } from "./client";
import { getValidWhoopAccessToken } from "./oauth";
import { whoopWorkoutToActivityData } from "./adapter";
import type { WhoopWorkout } from "./types";

type SyncResult = {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
};

function rawWorkout(workout: WhoopWorkout) {
  return workout as unknown as Prisma.InputJsonValue;
}

async function upsertWhoopWorkout(connectionId: string, workout: WhoopWorkout) {
  const data = whoopWorkoutToActivityData(workout);
  const existing = await prisma.whoopWorkoutMapping.findUnique({
    where: { whoopWorkoutId: workout.id }
  });

  if (existing?.activitySessionId) {
    await prisma.$transaction([
      prisma.activitySession.update({
        where: { id: existing.activitySessionId },
        data
      }),
      prisma.whoopWorkoutMapping.update({
        where: { id: existing.id },
        data: {
          connectionId,
          whoopUpdatedAt: new Date(workout.updated_at),
          raw: rawWorkout(workout)
        }
      })
    ]);

    return "updated" as const;
  }

  if (existing) {
    await prisma.$transaction(async (tx) => {
      const activity = await tx.activitySession.create({ data });
      await tx.whoopWorkoutMapping.update({
        where: { id: existing.id },
        data: {
          connectionId,
          activitySessionId: activity.id,
          whoopUpdatedAt: new Date(workout.updated_at),
          raw: rawWorkout(workout)
        }
      });
    });

    return "updated" as const;
  }

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activitySession.create({ data });
    await tx.whoopWorkoutMapping.create({
      data: {
        connectionId,
        whoopWorkoutId: workout.id,
        whoopUpdatedAt: new Date(workout.updated_at),
        activitySessionId: activity.id,
        raw: rawWorkout(workout)
      }
    });
  });

  return "inserted" as const;
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
    skipped: 0
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

        const action = await upsertWhoopWorkout(connection.id, workout);
        result[action] += 1;

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
      workoutCount: 0
    };
  }

  return {
    connected: true,
    lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
    lastSyncError: connection.lastSyncError,
    expiresAt: connection.expiresAt.toISOString(),
    workoutCount: connection._count.workoutMappings
  };
}
