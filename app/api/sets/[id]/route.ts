import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  displayExerciseName,
  normalizeExerciseName,
  updateSetSchema
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const existing = await prisma.exerciseSet.findUnique({
      where: { id },
      include: { exercise: true }
    });

    if (!existing) {
      return errorJson("Set not found", 404);
    }

    const body = updateSetSchema.parse(await parseJson(request));

    let exerciseId = existing.exerciseId;
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
      exerciseId = exercise.id;
    }

    const updated = await prisma.exerciseSet.update({
      where: { id },
      data: {
        exerciseId,
        setNumber:
          body.setNumber !== undefined ? body.setNumber : undefined,
        weight: body.weight !== undefined ? body.weight : undefined,
        reps: body.reps !== undefined ? body.reps : undefined,
        rpe: body.rpe !== undefined ? body.rpe : undefined,
        rir: body.rir !== undefined ? body.rir : undefined,
        painFlag: body.painFlag !== undefined ? body.painFlag : undefined,
        painNotes:
          body.painNotes !== undefined ? body.painNotes : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        completedAt:
          body.completedAt !== undefined
            ? new Date(body.completedAt)
            : undefined
      },
      include: { exercise: true }
    });

    return json({
      set: {
        id: updated.id,
        sessionId: updated.sessionId,
        exerciseId: updated.exerciseId,
        exercise: {
          id: updated.exercise.id,
          name: updated.exercise.name
        },
        setNumber: updated.setNumber,
        weight: updated.weight,
        reps: updated.reps,
        rpe: updated.rpe,
        rir: updated.rir,
        painFlag: updated.painFlag,
        painNotes: updated.painNotes,
        notes: updated.notes,
        completedAt: updated.completedAt,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
