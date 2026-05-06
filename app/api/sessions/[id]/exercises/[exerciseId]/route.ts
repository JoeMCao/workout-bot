import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { appendNotesDedupe } from "@/lib/set-notes";
import {
  displayExerciseName,
  normalizeExerciseName,
  patchSessionExerciseSetsSchema
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string; exerciseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id: sessionId, exerciseId: pathExerciseId } = await context.params;

    const session = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { id: true }
    });
    if (!session) {
      return errorJson("Session not found", 404);
    }

    const body = patchSessionExerciseSetsSchema.parse(await parseJson(request));

    const sets = await prisma.exerciseSet.findMany({
      where: { sessionId, exerciseId: pathExerciseId },
      orderBy: { completedAt: "asc" }
    });

    if (sets.length === 0) {
      return errorJson("No sets found for this session and exercise", 404);
    }

    let targetExerciseId = pathExerciseId;
    if (body.exerciseName !== undefined) {
      const exerciseName = displayExerciseName(body.exerciseName);
      const normalizedName = normalizeExerciseName(body.exerciseName);
      const exercise = await prisma.exercise.upsert({
        where: { normalizedName },
        create: {
          name: exerciseName,
          normalizedName
        },
        update: {}
      });
      targetExerciseId = exercise.id;
    }

    const replaceNotes = body.replaceNotes === true;
    const appendNotes = body.appendNotes;

    await prisma.$transaction(async (tx) => {
      for (const row of sets) {
        const nextNotes =
          appendNotes === undefined
            ? undefined
            : replaceNotes
              ? appendNotes
              : appendNotesDedupe(row.notes, appendNotes);

        await tx.exerciseSet.update({
          where: { id: row.id },
          data: {
            exerciseId: targetExerciseId,
            ...(nextNotes !== undefined ? { notes: nextNotes } : {})
          }
        });
      }
    });

    const updatedSets = await prisma.exerciseSet.findMany({
      where: { sessionId, exerciseId: targetExerciseId },
      orderBy: { completedAt: "asc" },
      include: { exercise: true }
    });

    return json({
      sessionId,
      exerciseId: targetExerciseId,
      updatedCount: updatedSets.length,
      sets: updatedSets.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        exerciseId: s.exerciseId,
        exercise: { id: s.exercise.id, name: s.exercise.name },
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        rir: s.rir,
        painFlag: s.painFlag,
        painNotes: s.painNotes,
        notes: s.notes,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
