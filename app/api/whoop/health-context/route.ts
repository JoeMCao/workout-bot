import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json } from "@/lib/http";
import { queryWhoopHealthContextDays } from "@/lib/whoop/health-context-query";

/**
 * Read persisted WHOOP sleep + recovery rows by America/Los_Angeles calendar day.
 * Query: `date=YYYY-MM-DD` (default: today LA), `days=1..14` (default 1).
 */
export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date")?.trim() ?? undefined;
    const daysRaw = url.searchParams.get("days");
    const daysParsed = daysRaw != null ? Number(daysRaw) : undefined;

    const payload = await queryWhoopHealthContextDays({
      anchorDate: date,
      days: daysParsed
    });

    return json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
