import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runIdempotentWrite, type WriteReceipt, type WriteSource } from "@/lib/idempotency";
import { activitySessionTimeSource, getServerNow } from "@/lib/time";
import {
  activitySessionCreateData,
  activitySessionUpdateData,
  createActivitySessionSchema,
  updateActivitySessionSchema
} from "@/lib/validation";
import { NotFoundError } from "@/lib/services/errors";
import type { z } from "zod";

type DbClient = typeof prisma | Prisma.TransactionClient;
type ActivityBody = z.infer<typeof createActivitySessionSchema>;
type ActivityUpdateBody = z.infer<typeof updateActivitySessionSchema>;

export const activityInclude = {
  relatedWorkoutSession: {
    select: {
      id: true,
      startedAt: true,
      timeSource: true,
      timezone: true,
      sessionType: true,
      goal: true
    }
  }
} as const;

export type ActivityWriteResult<T> = {
  value: T;
  receipt: WriteReceipt | null;
};

function activityMeta(
  body: ActivityBody,
  mode: "manual" | "whoop"
) {
  const hasStartedAt = body.startedAt != null;
  return {
    startedAt: hasStartedAt ? new Date(body.startedAt!) : getServerNow(),
    timeSource: hasStartedAt
      ? mode === "whoop"
        ? activitySessionTimeSource.whoopScreenshot
        : activitySessionTimeSource.userProvided
      : activitySessionTimeSource.apiDefault
  };
}

async function ensureRelatedWorkout(
  db: DbClient,
  relatedWorkoutSessionId: string | null | undefined
) {
  if (!relatedWorkoutSessionId) return;
  const workout = await db.workoutSession.findUnique({
    where: { id: relatedWorkoutSessionId },
    select: { id: true }
  });
  if (!workout) throw new NotFoundError("Workout session not found");
}

async function createActivityRecord(
  db: DbClient,
  body: ActivityBody,
  mode: "manual" | "whoop"
) {
  await ensureRelatedWorkout(db, body.relatedWorkoutSessionId);
  return db.activitySession.create({
    data: activitySessionCreateData(body, activityMeta(body, mode))
  });
}

export async function createActivitySession(
  body: ActivityBody,
  options?: {
    clientEventId?: string;
    source?: WriteSource;
    mode?: "manual" | "whoop";
  }
): Promise<ActivityWriteResult<Awaited<ReturnType<typeof createActivityRecord>>>> {
  const mode = options?.mode ?? "manual";
  if (!options?.clientEventId) {
    return {
      value: await createActivityRecord(prisma, body, mode),
      receipt: null
    };
  }

  return runIdempotentWrite({
    clientEventId: options.clientEventId,
    operation:
      mode === "whoop"
        ? "import_whoop_activity_fallback"
        : "record_activity_session",
    entityType: "ActivitySession",
    payload: body,
    source: options.source ?? "mcp",
    write: async (tx) => {
      const value = await createActivityRecord(tx, body, mode);
      return { entityId: value.id, value };
    },
    read: (db, entityId) => db.activitySession.findUniqueOrThrow({
      where: { id: entityId },
      include: activityInclude
    })
  });
}

export async function listRecentActivitySessions({
  limit = 20,
  type
}: {
  limit?: number;
  type?: string;
} = {}) {
  return prisma.activitySession.findMany({
    where: {
      relatedWorkoutSessionId: null,
      ...(type ? { type } : {})
    },
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    include: activityInclude
  });
}

export async function getActivitySession(id: string) {
  const activity = await prisma.activitySession.findUnique({
    where: { id },
    include: activityInclude
  });
  if (!activity) throw new NotFoundError("Activity not found");
  return activity;
}

export async function updateActivitySession(
  id: string,
  body: ActivityUpdateBody
) {
  const existing = await prisma.activitySession.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!existing) throw new NotFoundError("Activity not found");

  await ensureRelatedWorkout(prisma, body.relatedWorkoutSessionId);
  return prisma.activitySession.update({
    where: { id },
    data: activitySessionUpdateData(body),
    include: activityInclude
  });
}

export async function deleteActivitySession(id: string) {
  const existing = await prisma.activitySession.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!existing) throw new NotFoundError("Activity not found");
  await prisma.activitySession.delete({ where: { id } });
  return { ok: true, activityId: id };
}
