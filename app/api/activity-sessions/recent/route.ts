import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseLimit } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { activityTypeSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 20, 50);
    const typeParam = searchParams.get("type");

    let type: string | undefined;
    if (typeParam) {
      const parsed = activityTypeSchema.safeParse(typeParam);
      if (!parsed.success) {
        return errorJson("Invalid type query parameter", 400);
      }
      type = parsed.data;
    }

    const activities = await prisma.activitySession.findMany({
      where: type ? { type } : undefined,
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        relatedWorkoutSession: {
          select: {
            id: true,
            startedAt: true,
            timeSource: true,
            timezone: true,
            sessionType: true,
            goal: true
          }
        }
      }
    });

    return json({ activities });
  } catch (error) {
    return handleRouteError(error);
  }
}
