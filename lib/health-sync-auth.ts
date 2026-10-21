import { timingSafeEqual } from "node:crypto";
import { errorJson } from "@/lib/http";

/** This key can only import weight and OMRON blood pressure/pulse; it never grants access to other coach routes. */
export function requireHealthSyncKey(request: Request) {
  const expected = process.env.WEIGHT_SYNC_KEY?.trim();
  if (!expected) return errorJson("Health sync is not configured", 503);
  const provided = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return errorJson("Unauthorized", 401);
  return null;
}
