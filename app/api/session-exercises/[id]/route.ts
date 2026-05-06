import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { appendSessionExerciseNotes, serializeWorkoutSessionExercise } from "@/lib/workout-session-exercise";
import { updateSessionExerciseSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = updateSessionExerciseSchema.parse(await parseJson(request));

    const existing = await prisma.workoutSessionExercise.findUnique({
      where: { id },
      include: { exercise: true }
    });

    if (!existing) {
      return errorJson("Session exercise not found", 404);
    }

    const data: {
      displayName?: string | null;
      notes?: string | null;
    } = {};

    if (body.displayName !== undefined) {
      data.displayName = body.displayName;
    }

    if (body.clearNotes) {
      data.notes = null;
    } else if (body.notes !== undefined) {
      data.notes = body.replaceNotes
        ? body.notes
        : appendSessionExerciseNotes(existing.notes, body.notes);
    }

    const updated = await prisma.workoutSessionExercise.update({
      where: { id },
      data,
      include: { exercise: true }
    });

    return json({ sessionExercise: serializeWorkoutSessionExercise(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}
