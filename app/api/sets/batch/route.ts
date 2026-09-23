import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { createCompletedSets } from "@/lib/services/workout";
import { createSetsBatchSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const body = createSetsBatchSchema.parse(await parseJson(request));
    const result = await createCompletedSets(body, "rest");
    return json(result, result.receipts.every((receipt) => receipt.status === "replayed") ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
