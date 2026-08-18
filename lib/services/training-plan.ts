import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey, getStartOfLocalWeekUtc, shiftLocalDateKey, DEFAULT_USER_TIMEZONE } from "@/lib/time";
import { ConflictError } from "@/lib/services/errors";
import { runIdempotentWrite, type WriteReceipt, type WriteSource } from "@/lib/idempotency";
import type { z } from "zod";
import { saveTrainingPlanSchema } from "@/lib/validation";

type TrainingPlanBody = z.infer<typeof saveTrainingPlanSchema>;

const planInclude = {
  slots: {
    orderBy: { plannedDate: "asc" as const },
    include: {
      workoutSession: {
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          sessionType: true,
          goal: true,
          sets: {
            orderBy: { completedAt: "asc" as const },
            select: {
              exercise: { select: { name: true } },
              weight: true,
              reps: true,
              completedAt: true
            }
          }
        }
      }
    }
  }
} as const;

function weekStartForDate(weekStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new ConflictError("weekStart must use YYYY-MM-DD.", "INVALID_WEEK_START");
  }
  const requested = new Date(`${weekStart}T12:00:00.000Z`);
  if (Number.isNaN(requested.getTime())) {
    throw new ConflictError("weekStart must be a valid calendar date.", "INVALID_WEEK_START");
  }
  const start = getStartOfLocalWeekUtc(requested);
  const normalized = getLocalDateKey(start, DEFAULT_USER_TIMEZONE);
  if (normalized !== weekStart) {
    throw new ConflictError(
      `weekStart must be a Monday in ${DEFAULT_USER_TIMEZONE}.`,
      "WEEK_START_MUST_BE_MONDAY"
    );
  }
  return start;
}

function slotDates(weekStart: string) {
  return new Set(
    Array.from({ length: 7 }, (_, index) =>
      shiftLocalDateKey(weekStart, index, DEFAULT_USER_TIMEZONE)
    )
  );
}

function validatePlanDates(body: TrainingPlanBody) {
  weekStartForDate(body.weekStart);
  const validDates = slotDates(body.weekStart);
  const seen = new Set<string>();

  for (const slot of body.slots) {
    if (!validDates.has(slot.plannedDate)) {
      throw new ConflictError(
        `plannedDate ${slot.plannedDate} is outside week ${body.weekStart}.`,
        "SLOT_OUTSIDE_WEEK"
      );
    }
    if (seen.has(slot.plannedDate)) {
      throw new ConflictError(
        `Only one training slot is allowed per date: ${slot.plannedDate}.`,
        "DUPLICATE_SLOT_DATE"
      );
    }
    seen.add(slot.plannedDate);
  }
}

function localWeekRange(weekStart: string) {
  const start = weekStartForDate(weekStart);
  const nextWeek = shiftLocalDateKey(weekStart, 7, DEFAULT_USER_TIMEZONE);
  const end = getStartOfLocalWeekUtc(new Date(`${nextWeek}T12:00:00.000Z`));
  return { start, end };
}

async function readPlan(weekStart: string) {
  const [plan, sessions] = await Promise.all([
    prisma.trainingWeek.findUnique({
      where: { weekStart },
      include: planInclude
    }),
    prisma.workoutSession.findMany({
      where: {
        startedAt: {
          gte: localWeekRange(weekStart).start,
          lt: localWeekRange(weekStart).end
        }
      },
      orderBy: { startedAt: "asc" },
      include: {
        sets: {
          orderBy: { completedAt: "asc" },
          include: { exercise: true }
        },
        planSlot: {
          select: {
            id: true,
            plannedDate: true,
            focus: true,
            status: true
          }
        }
      }
    })
  ]);

  const slots = plan?.slots ?? [];
  const today = getLocalDateKey(new Date(), DEFAULT_USER_TIMEZONE);
  const nextSlot =
    plan?.status === "active"
      ? slots.find((slot) => slot.status === "planned" && slot.plannedDate >= today) ??
        slots.find((slot) => slot.status === "planned") ??
        null
      : null;

  return {
    weekStart,
    weekEnd: shiftLocalDateKey(weekStart, 6, DEFAULT_USER_TIMEZONE),
    today,
    timezone: DEFAULT_USER_TIMEZONE,
    plan: plan
      ? {
          id: plan.id,
          objective: plan.objective,
          status: plan.status,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt
        }
      : null,
    slots,
    nextSlot,
    sessions
  };
}

async function savePlanRecord(db: Prisma.TransactionClient, body: TrainingPlanBody) {
  validatePlanDates(body);

  const week = await db.trainingWeek.upsert({
    where: { weekStart: body.weekStart },
    create: {
      weekStart: body.weekStart,
      timezone: DEFAULT_USER_TIMEZONE,
      objective: body.objective,
      status: body.status ?? "active"
    },
    update: {
      objective: body.objective,
      status: body.status
    },
    select: { id: true }
  });

  const existing = await db.trainingSlot.findMany({
    where: { weekId: week.id },
    select: { id: true, plannedDate: true, status: true }
  });
  const incomingDates = new Set(body.slots.map((slot) => slot.plannedDate));

  for (const slot of body.slots) {
    const previous = existing.find((row) => row.plannedDate === slot.plannedDate);
    await db.trainingSlot.upsert({
      where: {
        weekId_plannedDate: {
          weekId: week.id,
          plannedDate: slot.plannedDate
        }
      },
      create: {
        weekId: week.id,
        plannedDate: slot.plannedDate,
        focus: slot.focus,
        status: slot.status ?? "planned",
        exerciseNames:
          slot.exerciseNames === undefined
            ? undefined
            : (slot.exerciseNames as Prisma.InputJsonValue),
        notes: slot.notes
      },
      update: {
        focus: slot.focus,
        status: slot.status ?? previous?.status ?? "planned",
        exerciseNames:
          slot.exerciseNames === undefined
            ? undefined
            : (slot.exerciseNames as Prisma.InputJsonValue),
        notes: slot.notes
      }
    });
  }

  const stalePlannedSlots = existing
    .filter((slot) => !incomingDates.has(slot.plannedDate) && slot.status === "planned")
    .map((slot) => slot.id);
  if (stalePlannedSlots.length > 0) {
    await db.trainingSlot.updateMany({
      where: { id: { in: stalePlannedSlots } },
      data: { status: "skipped" }
    });
  }

  return week.id;
}

export async function getTrainingPlan(options: { weekStart?: string } = {}) {
  const weekStart = options.weekStart ?? getLocalDateKey(getStartOfLocalWeekUtc());
  weekStartForDate(weekStart);
  return readPlan(weekStart);
}

export type TrainingPlanWriteResult = {
  value: Awaited<ReturnType<typeof getTrainingPlan>>;
  receipt: WriteReceipt | null;
};

export async function saveTrainingPlan(
  body: TrainingPlanBody,
  options?: { clientEventId?: string; source?: WriteSource }
): Promise<TrainingPlanWriteResult> {
  validatePlanDates(body);

  if (!options?.clientEventId) {
    await prisma.$transaction((tx) => savePlanRecord(tx, body));
    return { value: await readPlan(body.weekStart), receipt: null };
  }

  const result = await runIdempotentWrite({
    clientEventId: options.clientEventId,
    operation: "save_training_plan",
    entityType: "TrainingWeek",
    payload: body,
    source: options.source ?? "mcp",
    write: async (tx) => {
      const entityId = await savePlanRecord(tx, body);
      return { entityId, value: { entityId } };
    },
    read: async (db, entityId) => {
      const week = await db.trainingWeek.findUniqueOrThrow({
        where: { id: entityId },
        select: { id: true }
      });
      return { entityId: week.id };
    }
  });

  return { value: await readPlan(body.weekStart), receipt: result.receipt };
}
