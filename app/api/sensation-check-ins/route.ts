import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { recordSensationCheckInSchema } from "@/lib/sensation-validation";
import { createSensationCheckIn } from "@/lib/services/sensation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const { clientEventId, ...body } = recordSensationCheckInSchema.parse(await parseJson(request));
    const result = await createSensationCheckIn(body, { clientEventId, source: "rest" });
    return json({ checkIn: result.value, receipt: result.receipt }, result.receipt.status === "created" ? 201 : 200);
  } catch (error) { return handleRouteError(error); }
}
