import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { updateExerciseSet } from "@/lib/services/workout";
import { updateSetSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = updateSetSchema.parse(await parseJson(request));
    const updated = await updateExerciseSet(id, body);

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
