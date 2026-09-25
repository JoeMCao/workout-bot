import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runIdempotentWrite, type WriteSource } from "@/lib/idempotency";
import { DEFAULT_USER_TIMEZONE } from "@/lib/time";
import {
  createSensationCheckInSchema, updateSensationCheckInSchema,
  sensationHistorySchema, sensationHistoryWindow, journalEventIdSchema
} from "@/lib/sensation-validation";
import { ConflictError, NotFoundError } from "@/lib/services/errors";

export async function createSensationCheckIn(
  input: z.infer<typeof createSensationCheckInSchema>,
  options: { clientEventId: string; source: WriteSource }
) {
  const body = createSensationCheckInSchema.parse(input);
  return runIdempotentWrite({
    clientEventId: journalEventIdSchema.parse(options.clientEventId),
    operation: "record_sensation_check_in", entityType: "SensationCheckIn",
    payload: body, source: options.source,
    write: async (tx) => {
      const value = await tx.sensationCheckIn.create({ data: {
        description: body.description,
        observedAt: body.observedAt ? new Date(body.observedAt) : undefined,
        timezone: body.timezone ?? DEFAULT_USER_TIMEZONE
      } });
      return { entityId: value.id, value };
    },
    read: async (db, id) => {
      const value = await db.sensationCheckIn.findUnique({ where: { id } });
      if (!value) throw new ConflictError("This check-in was deleted; a retry will not recreate it.", "CHECK_IN_DELETED");
      return value;
    }
  });
}

export async function updateSensationCheckIn(id: string, input: z.infer<typeof updateSensationCheckInSchema>) {
  const body = updateSensationCheckInSchema.parse(input);
  // updateMany avoids a read/write race with deletion, without leaking Prisma errors.
  return prisma.$transaction(async (tx) => {
    const result = await tx.sensationCheckIn.updateMany({ where: { id }, data: {
      ...body, observedAt: body.observedAt ? new Date(body.observedAt) : undefined
    } });
    if (!result.count) throw new NotFoundError("Sensation check-in not found");
    return tx.sensationCheckIn.findUniqueOrThrow({ where: { id } });
  });
}

export async function deleteSensationCheckIn(id: string) {
  // Keep the write receipt so an old create retry cannot resurrect a deleted entry.
  await prisma.sensationCheckIn.deleteMany({ where: { id } });
  return { ok: true, checkInId: id };
}

export async function getSensationHistory(input: z.infer<typeof sensationHistorySchema> = {}) {
  const window = sensationHistoryWindow(input);
  const dateFilter = { gte: window.start, lt: window.endExclusive };
  const activityWhere = {
    type: "mobility", modality: "iron_neck", startedAt: dateFilter
  } satisfies Prisma.ActivitySessionWhereInput;
  const [checkIns, sessions] = await prisma.$transaction([
    prisma.sensationCheckIn.findMany({
      where: { observedAt: dateFilter }, orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      take: window.limit + 1
    }),
    prisma.activitySession.findMany({
      where: activityWhere, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: window.limit + 1,
      select: { id: true, startedAt: true, timezone: true, durationMinutes: true,
        notes: true, relatedWorkoutSessionId: true }
    })
  ]);
  return {
    startDate: window.startDate, endDate: window.endDate, timezone: window.timezone,
    checkIns: checkIns.slice(0, window.limit), ironNeckSessions: sessions.slice(0, window.limit),
    truncated: { checkIns: checkIns.length > window.limit, ironNeckSessions: sessions.length > window.limit }
  };
}
