import { requireApiKey } from "@/lib/auth";
import { DEFAULT_USER_TIMEZONE } from "@/lib/time";
import { getDatabaseTime } from "@/lib/services/workout";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    console.info("[time] endpoint hit");

    const dbNow = await getDatabaseTime();

    console.info("[time] returned dbNow", {
      dbNow
    });

    return Response.json({
      dbNow,
      timezone: DEFAULT_USER_TIMEZONE
    });
  } catch (error) {
    console.error("[time] failed to fetch time", error);

    return Response.json(
      { error: "Failed to fetch time" },
      { status: 500 }
    );
  }
}
