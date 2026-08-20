import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runIdempotentWrite, type WriteReceipt, type WriteSource } from "@/lib/idempotency";
import { ConflictError } from "@/lib/services/errors";
import { createApprovedExerciseSchema, displayExerciseName, normalizeExerciseName } from "@/lib/validation";
import { normalizeExerciseLookupName, rankExerciseSuggestions } from "@/lib/exercise-name";

type DbClient = typeof prisma | Prisma.TransactionClient;
type CreateApprovedExerciseBody = z.infer<typeof createApprovedExerciseSchema>;

async function unknownExerciseError(db: DbClient, name: string) {
  const exercises = await db.exercise.findMany({
    where: { status: "approved" },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
  const suggestions = rankExerciseSuggestions(name, exercises);
  const suggestionText = suggestions.length
    ? ` Closest approved exercises: ${suggestions.map((row) => row.name).join(", ")}.`
    : "";
  return new ConflictError(
    `Unknown exercise '${displayExerciseName(name)}'.${suggestionText} Use an approved exercise or explicitly ask the user to approve a new one before creating it.`,
    "UNKNOWN_EXERCISE"
  );
}

export async function resolveApprovedExercise(db: DbClient, name: string) {
  const alias = await db.exerciseAlias.findUnique({
    where: { normalizedName: normalizeExerciseLookupName(name) },
    include: { exercise: true }
  });

  if (alias?.exercise.status === "approved") return alias.exercise;
  throw await unknownExerciseError(db, name);
}

export async function listApprovedExercises(db: DbClient = prisma) {
  const exercises = await db.exercise.findMany({
    where: { status: "approved" },
    orderBy: { name: "asc" },
    include: {
      aliases: { orderBy: { name: "asc" } },
      sets: {
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true }
      },
      _count: { select: { sets: true } }
    }
  });

  return exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    aliases: exercise.aliases
      .map((alias) => alias.name)
      .filter((alias) => normalizeExerciseLookupName(alias) !== normalizeExerciseLookupName(exercise.name)),
    setCount: exercise._count.sets,
    lastPerformedAt: exercise.sets[0]?.completedAt ?? null
  }));
}

async function createApprovedExerciseRecord(
  db: Prisma.TransactionClient,
  body: CreateApprovedExerciseBody
) {
  const name = displayExerciseName(body.name);
  const aliasNames = [
    ...new Map(
      [name, ...(body.aliases ?? []).map(displayExerciseName)].map((aliasName) => [
        normalizeExerciseLookupName(aliasName),
        aliasName
      ])
    ).values()
  ];
  const normalizedAliases = aliasNames.map(normalizeExerciseLookupName);

  const existingAliases = await db.exerciseAlias.findMany({
    where: { normalizedName: { in: normalizedAliases } },
    include: { exercise: true }
  });
  if (existingAliases.length > 0) {
    throw new ConflictError(
      `Exercise name or alias already belongs to ${existingAliases[0].exercise.name}.`,
      "EXERCISE_ALIAS_EXISTS"
    );
  }

  const normalizedName = normalizeExerciseName(name);
  const inactive = await db.exercise.findUnique({ where: { normalizedName } });
  const exercise = inactive
    ? await db.exercise.update({
        where: { id: inactive.id },
        data: {
          name,
          status: "approved",
          aliases: {
            create: aliasNames.map((aliasName) => ({
              name: aliasName,
              normalizedName: normalizeExerciseLookupName(aliasName)
            }))
          }
        },
        include: { aliases: true }
      })
    : await db.exercise.create({
        data: {
          name,
          normalizedName,
          status: "approved",
          aliases: {
            create: aliasNames.map((aliasName) => ({
              name: aliasName,
              normalizedName: normalizeExerciseLookupName(aliasName)
            }))
          }
        },
        include: { aliases: true }
      });

  return exercise;
}

export type ApprovedExerciseWriteResult = {
  value: Awaited<ReturnType<typeof createApprovedExerciseRecord>>;
  receipt: WriteReceipt | null;
};

export async function createApprovedExercise(
  body: CreateApprovedExerciseBody,
  options?: { clientEventId?: string; source?: WriteSource }
): Promise<ApprovedExerciseWriteResult> {
  if (!body.userApproved) {
    throw new ConflictError(
      "A new exercise requires explicit user approval.",
      "EXERCISE_APPROVAL_REQUIRED"
    );
  }

  if (!options?.clientEventId) {
    const value = await prisma.$transaction((tx) => createApprovedExerciseRecord(tx, body));
    return { value, receipt: null };
  }

  return runIdempotentWrite({
    clientEventId: options.clientEventId,
    operation: "create_approved_exercise",
    entityType: "Exercise",
    payload: body,
    source: options.source ?? "mcp",
    write: async (tx) => {
      const value = await createApprovedExerciseRecord(tx, body);
      return { entityId: value.id, value };
    },
    read: (db, entityId) =>
      db.exercise.findUniqueOrThrow({
        where: { id: entityId },
        include: { aliases: true }
      })
  });
}
