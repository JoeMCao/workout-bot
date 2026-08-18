import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { patchSessionExerciseSets } from "@/lib/services/workout";
import { patchSessionExerciseSetsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string; exerciseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id: sessionId, exerciseId: pathExerciseId } = await context.params;
    const body = patchSessionExerciseSetsSchema.parse(await parseJson(request));
    const updatedSets = await patchSessionExerciseSets(
      sessionId,
      pathExerciseId,
      body
    );
    const targetExerciseId = updatedSets[0]?.exerciseId ?? pathExerciseId;

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
