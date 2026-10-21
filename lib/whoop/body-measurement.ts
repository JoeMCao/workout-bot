import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { WHOOP_API_BASE_URL, WHOOP_PROVIDER, getWhoopClientConfig } from "./config";
import { getValidWhoopAccessToken } from "./oauth";
import { WhoopSyncError } from "./sync-error";

const bodyMeasurementSchema = z.object({
  weight_kilogram: z.number().finite().positive(),
  height_meter: z.number().finite().positive(),
  max_heart_rate: z.number().finite().positive()
});

/** Fetch the current saved measurements; WHOOP supplies no measurement timestamp. */
export async function getWhoopBodyMeasurement() {
  const connection = await prisma.whoopConnection.findUnique({
    where: { provider: WHOOP_PROVIDER },
    select: { scope: true }
  });
  if (!connection?.scope?.split(/[\s,]+/).includes("read:body_measurement")) {
    throw new WhoopSyncError(
      "WHOOP_BODY_MEASUREMENT_RECONNECT_REQUIRED",
      "Reconnect WHOOP at /api/auth/whoop/start to grant body measurement access.",
      409
    );
  }

  const { accessToken } = await getValidWhoopAccessToken(getWhoopClientConfig());
  let response: Response;
  try {
    response = await fetch(`${WHOOP_API_BASE_URL}/v2/user/measurement/body`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new WhoopSyncError("WHOOP_BODY_MEASUREMENT_UNAVAILABLE", "Could not reach WHOOP for body measurements. Try again later.", 502);
  }
  if (!response.ok) {
    const reconnect = response.status === 401 || response.status === 403;
    throw new WhoopSyncError(
      reconnect ? "WHOOP_BODY_MEASUREMENT_RECONNECT_REQUIRED" : "WHOOP_BODY_MEASUREMENT_UNAVAILABLE",
      reconnect
        ? "Reconnect WHOOP at /api/auth/whoop/start to grant body measurement access."
        : `WHOOP body measurements are unavailable (HTTP ${response.status}). Try again later.`,
      reconnect ? 409 : 502
    );
  }
  const parsed = bodyMeasurementSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new WhoopSyncError("WHOOP_BODY_MEASUREMENT_INVALID", "WHOOP returned incomplete or invalid body measurements.", 502);
  }
  return {
    source: "whoop" as const,
    weightKg: parsed.data.weight_kilogram,
    weightLb: Math.round(parsed.data.weight_kilogram * 2.2046226218 * 10) / 10,
    heightMeters: parsed.data.height_meter,
    maxHeartRate: parsed.data.max_heart_rate,
    fetchedAt: new Date().toISOString(),
    measuredAt: null
  };
}
