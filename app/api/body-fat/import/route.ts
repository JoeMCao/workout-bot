import { requireHealthSyncKey } from "@/lib/health-sync-auth";
import { errorJson, handleRouteError, json } from "@/lib/http";
import { importBodyFat } from "@/lib/services/body-fat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = requireHealthSyncKey(request);
  if (authError) return authError;
  try {
    const text = await request.text();
    if (text.length > 4096) return errorJson("Request body is too large", 413);
    let input: unknown;
    try { input = JSON.parse(text); } catch { return errorJson("Invalid JSON", 400); }
    return json({ ok: true, measurement: await importBodyFat(input) });
  } catch (error) {
    return handleRouteError(error);
  }
}
