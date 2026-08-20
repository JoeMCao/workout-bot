import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import {
  createApprovedExercise,
  listApprovedExercises
} from "@/lib/services/exercise-catalog";
import { createApprovedExerciseSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    return json({ exercises: await listApprovedExercises() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createApprovedExerciseSchema.parse(await parseJson(request));
    const result = await createApprovedExercise(body, {
      source: "rest",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });
    return json(
      {
        exercise: {
          id: result.value.id,
          name: result.value.name,
          aliases: result.value.aliases.map((alias) => alias.name),
          setCount: 0,
          lastPerformedAt: null
        },
        receipt: result.receipt
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
