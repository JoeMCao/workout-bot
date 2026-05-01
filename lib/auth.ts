import { errorJson } from "@/lib/http";

export function requireApiKey(request: Request) {
  const expected = process.env.WORKOUT_API_KEY;

  if (!expected) {
    return errorJson("WORKOUT_API_KEY is not configured", 500);
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token !== expected) {
    return errorJson("Unauthorized", 401);
  }

  return null;
}
