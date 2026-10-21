import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseLimit } from "@/lib/http";
import { getBodyWeight } from "@/lib/services/body-weight";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    return json(await getBodyWeight(parseLimit(new URL(request.url).searchParams.get("limit"), 7, 30)));
  } catch (error) {
    return handleRouteError(error);
  }
}
