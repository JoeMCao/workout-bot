import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseLimit } from "@/lib/http";
import { getExerciseHistory } from "@/lib/services/workout";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name?.trim()) {
      return errorJson("Missing required query parameter: name", 400);
    }

    const limit = parseLimit(searchParams.get("limit"));
    const sets = await getExerciseHistory(name, limit);

    return json({
      query: name.trim(),
      sets: sets.map((set) => ({
        id: set.id,
        exerciseName: set.exercise.name,
        session: set.session,
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
        rir: set.rir,
        painFlag: set.painFlag,
        painNotes: set.painNotes,
        notes: set.notes,
        completedAt: set.completedAt
      }))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
