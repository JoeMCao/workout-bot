import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendNotesDedupe } from "@/lib/set-notes";
import {
  DEFAULT_USER_TIMEZONE,
  getServerNow,
  workoutSessionTimeSource
} from "@/lib/time";
import {
  patchSessionExerciseSetsSchema,
  sessionSignalsData,
  sessionSignalsSchema,
  updateSetSchema,
  updateSessionSchema,
  createSessionSchema,
  createSetSchema
} from "@/lib/validation";
import { runIdempotentWrite, type WriteReceipt, type WriteSource } from "@/lib/idempotency";
import { NotFoundError } from "@/lib/services/errors";
import { resolveApprovedExercise } from "@/lib/services/exercise-catalog";
import type { z } from "zod";

type DbClient = typeof prisma | Prisma.TransactionClient;
type SessionBody = z.infer<typeof createSessionSchema>;
type SessionUpdateBody = z.infer<typeof updateSessionSchema>;
type SignalsBody = z.infer<typeof sessionSignalsSchema>;
type SetBody = z.infer<typeof createSetSchema>;
type SetUpdateBody = z.infer<typeof updateSetSchema>;
type PatchExerciseBody = z.infer<typeof patchSessionExerciseSetsSchema>;

export const workoutSessionInclude = {
  planSlot: {
    select: {
      id: true,
      weekId: true,
      plannedDate: true,
      focus: true,
      status: true,
      exerciseNames: true,
      notes: true
    }
  },
  sets: {
    orderBy: { completedAt: "asc" as const },
    include: { exercise: true }
  }
} as const;

export const signalsSelect = {
  id: true,
  lowBackPain: true,
  lowBackPainSeverity: true,
  elbowIrritation: true,
  neckTightness: true,
  shoulderIrritation: true,
  fatigueLevel: true,
  motivationLevel: true,
  sorenessAreas: true,
  readinessNotes: true,
  whoopRecoveryScore: true,
  whoopSleepPerformance: true,
  whoopSleepEfficiency: true,
  whoopHrvRmssd: true,
  whoopRestingHeartRate: true,
  whoopStrainYesterday: true,
  whoopDataFetchedAt: true,
  whoopRaw: true,
  updatedAt: true
} as const;

export type WorkoutWriteResult<T> = {
  value: T;
  receipt: WriteReceipt | null;
};

function sessionCreateData(body: SessionBody) {
  const hasStartedAt = body.startedAt != null;
  return {
    startedAt: hasStartedAt ? new Date(body.startedAt!) : getServerNow(),
    timeSource: hasStartedAt
      ? workoutSessionTimeSource.userProvided
      : workoutSessionTimeSource.apiDefault,
    timezone: DEFAULT_USER_TIMEZONE,
    sessionType: body.sessionType,
    goal: body.goal,
    readinessScore: body.readinessScore,
    energy: body.energy,
    soreness: body.soreness,
    sleepQuality: body.sleepQuality,
    notes: body.notes,
    planSlot: body.planSlotId
      ? { connect: { id: body.planSlotId } }
      : undefined,
    ...sessionSignalsData(body)
  };
}

async function createWorkoutSessionRecord(db: DbClient, body: SessionBody) {
  const session = await db.workoutSession.create({
    data: sessionCreateData(body)
  });

  if (session.planSlotId) {
    await db.trainingSlot.update({
      where: { id: session.planSlotId },
      data: { status: "in_progress" }
    });
  }

  return session;
}

export async function createWorkoutSession(
  body: SessionBody,
  options?: { clientEventId?: string; source?: WriteSource }
): Promise<WorkoutWriteResult<Awaited<ReturnType<typeof createWorkoutSessionRecord>>>> {
  if (!options?.clientEventId) {
    return { value: await createWorkoutSessionRecord(prisma, body), receipt: null };
  }

  const result = await runIdempotentWrite({
    clientEventId: options.clientEventId,
    operation: "start_workout_session",
    entityType: "WorkoutSession",
    payload: body,
    source: options.source ?? "mcp",
    write: async (tx) => {
      const value = await createWorkoutSessionRecord(tx, body);
      return { entityId: value.id, value };
    },
    read: (db, entityId) => db.workoutSession.findUniqueOrThrow({
      where: { id: entityId }
    })
  });

  return result;
}

export async function getWorkoutSession(id: string) {
  const session = await prisma.workoutSession.findUnique({
    where: { id },
    include: workoutSessionInclude
  });
  if (!session) throw new NotFoundError("Session not found");
  return session;
}

export async function updateWorkoutSession(id: string, body: SessionUpdateBody) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id },
    select: { id: true, planSlotId: true }
  });
  if (!existing) throw new NotFoundError("Session not found");

  const session = await prisma.workoutSession.update({
    where: { id },
    data: {
      startedAt:
        body.startedAt !== undefined ? new Date(body.startedAt) : undefined,
      timeSource:
        body.startedAt !== undefined
          ? workoutSessionTimeSource.userProvided
          : undefined,
      endedAt:
        body.endedAt === null
          ? null
          : body.endedAt
            ? new Date(body.endedAt)
            : undefined,
      sessionType: body.sessionType,
      goal: body.goal,
      readinessScore: body.readinessScore,
      energy: body.energy,
      soreness: body.soreness,
      sleepQuality: body.sleepQuality,
      notes: body.notes,
      planSlot:
        body.planSlotId === null
          ? { disconnect: true }
          : body.planSlotId
            ? { connect: { id: body.planSlotId } }
            : undefined,
      ...sessionSignalsData(body)
    },
  });

  if (existing.planSlotId && existing.planSlotId !== session.planSlotId) {
    await prisma.trainingSlot.updateMany({
      where: { id: existing.planSlotId, status: "in_progress" },
      data: { status: "planned" }
    });
  }

  if (session.planSlotId) {
    await prisma.trainingSlot.update({
      where: { id: session.planSlotId },
      data: { status: session.endedAt ? "completed" : "in_progress" }
    });
  }

  return session;
}

export async function getWorkoutSignals(id: string) {
  const signals = await prisma.workoutSession.findUnique({
    where: { id },
    select: signalsSelect
  });
  if (!signals) throw new NotFoundError("Session not found");
  return signals;
}

export async function updateWorkoutSignals(id: string, body: SignalsBody) {
  const existing = await prisma.workoutSession.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!existing) throw new NotFoundError("Session not found");

  return prisma.workoutSession.update({
    where: { id },
    data: sessionSignalsData(body),
    select: signalsSelect
  });
}

export async function getRecentWorkoutSessions(limit = 10) {
  return prisma.workoutSession.findMany({
    orderBy: { startedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    include: workoutSessionInclude
  });
}

export async function getExerciseHistory(name: string, limit = 10) {
  const exercise = await resolveApprovedExercise(prisma, name);
  return prisma.exerciseSet.findMany({
    where: { exerciseId: exercise.id },
    orderBy: { completedAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
    include: {
      exercise: true,
      session: {
        select: { id: true, startedAt: true, sessionType: true, goal: true }
      }
    }
  });
}

function setData(body: SetBody, exerciseId: string) {
  return {
    sessionId: body.sessionId,
    exerciseId,
    setNumber: body.setNumber,
    weight: body.weight,
    reps: body.reps,
    rpe: body.rpe,
    rir: body.rir,
    painFlag: body.painFlag ?? false,
    painNotes: body.painNotes,
    notes: body.notes,
    completedAt: body.completedAt ? new Date(body.completedAt) : undefined
  };
}

async function createSetRecord(db: DbClient, body: SetBody) {
  const session = await db.workoutSession.findUnique({
    where: { id: body.sessionId },
    select: { id: true }
  });
  if (!session) throw new NotFoundError("Session not found");

  const exercise = await resolveApprovedExercise(db, body.exerciseName);

  return db.exerciseSet.create({
    data: setData(body, exercise.id),
    include: { exercise: true }
  });
}

export async function createCompletedSet(
  body: SetBody,
  options?: { clientEventId?: string; source?: WriteSource }
): Promise<WorkoutWriteResult<Awaited<ReturnType<typeof createSetRecord>>>> {
  if (!options?.clientEventId) {
    return { value: await createSetRecord(prisma, body), receipt: null };
  }

  return runIdempotentWrite({
    clientEventId: options.clientEventId,
    operation: "log_completed_set",
    entityType: "ExerciseSet",
    payload: body,
    source: options.source ?? "mcp",
    write: async (tx) => {
      const value = await createSetRecord(tx, body);
      return { entityId: value.id, value };
    },
    read: (db, entityId) => db.exerciseSet.findUniqueOrThrow({
      where: { id: entityId },
      include: { exercise: true }
    })
  });
}

export async function updateExerciseSet(id: string, body: SetUpdateBody) {
  const existing = await prisma.exerciseSet.findUnique({
    where: { id },
    select: { id: true, exerciseId: true }
  });
  if (!existing) throw new NotFoundError("Set not found");

  let exerciseId = existing.exerciseId;
  if (body.exerciseName !== undefined) {
    const exercise = await resolveApprovedExercise(prisma, body.exerciseName);
    exerciseId = exercise.id;
  }

  return prisma.exerciseSet.update({
    where: { id },
    data: {
      exerciseId,
      setNumber: body.setNumber !== undefined ? body.setNumber : undefined,
      weight: body.weight !== undefined ? body.weight : undefined,
      reps: body.reps !== undefined ? body.reps : undefined,
      rpe: body.rpe !== undefined ? body.rpe : undefined,
      rir: body.rir !== undefined ? body.rir : undefined,
      painFlag: body.painFlag !== undefined ? body.painFlag : undefined,
      painNotes: body.painNotes !== undefined ? body.painNotes : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      completedAt:
        body.completedAt !== undefined
          ? new Date(body.completedAt)
          : undefined
    },
    include: { exercise: true }
  });
}

export async function patchSessionExerciseSets(
  sessionId: string,
  exerciseId: string,
  body: PatchExerciseBody
) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    select: { id: true }
  });
  if (!session) throw new NotFoundError("Session not found");

  const sets = await prisma.exerciseSet.findMany({
    where: { sessionId, exerciseId },
    orderBy: { completedAt: "asc" }
  });
  if (sets.length === 0) {
    throw new NotFoundError("No sets found for this session and exercise");
  }

  let targetExerciseId = exerciseId;
  if (body.exerciseName !== undefined) {
    const exercise = await resolveApprovedExercise(prisma, body.exerciseName);
    targetExerciseId = exercise.id;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of sets) {
      const nextNotes =
        body.appendNotes === undefined
          ? undefined
          : body.replaceNotes === true
            ? body.appendNotes
            : appendNotesDedupe(row.notes, body.appendNotes);

      await tx.exerciseSet.update({
        where: { id: row.id },
        data: {
          exerciseId: targetExerciseId,
          ...(nextNotes !== undefined ? { notes: nextNotes } : {})
        }
      });
    }
  });

  return prisma.exerciseSet.findMany({
    where: { sessionId, exerciseId: targetExerciseId },
    orderBy: { completedAt: "asc" },
    include: { exercise: true }
  });
}

export async function getDatabaseTime() {
  const [row] = await prisma.$queryRaw<Array<{ dbNow: string }>>`
    SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "dbNow"
  `;
  if (!row?.dbNow) throw new Error("Database time query returned no rows");
  return row.dbNow;
}
