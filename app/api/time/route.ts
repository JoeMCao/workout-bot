import { requireApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DbTimeRow = {
  dbNow: string;
};

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    console.info("[time] endpoint hit");

    const [row] = await prisma.$queryRawUnsafe<DbTimeRow[]>(
      `SELECT to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "dbNow"`
    );

    if (!row?.dbNow) {
      throw new Error("Database time query returned no rows");
    }

    console.info("[time] returned dbNow", {
      dbNow: row.dbNow
    });

    return Response.json({
      dbNow: row.dbNow,
      timezone: "America/Los_Angeles"
    });
  } catch (error) {
    console.error("[time] failed to fetch time", error);

    return Response.json(
      { error: "Failed to fetch time" },
      { status: 500 }
    );
  }
}
