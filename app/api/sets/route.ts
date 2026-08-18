import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { createCompletedSet } from "@/lib/services/workout";
import { createSetSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createSetSchema.parse(await parseJson(request));
    const { value: set } = await createCompletedSet(body, {
      source: "rest",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });

    return json(
      {
        set: {
          id: set.id,
          sessionId: set.sessionId,
          exerciseId: set.exerciseId,
          exercise: {
            id: set.exercise.id,
            name: set.exercise.name
          },
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          rir: set.rir,
          painFlag: set.painFlag,
          painNotes: set.painNotes,
          notes: set.notes,
          completedAt: set.completedAt,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt
        }
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
