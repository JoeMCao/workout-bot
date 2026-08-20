import { getServerNow } from "@/lib/time";
import { syncWhoopHealthContext } from "@/lib/whoop/health-context-sync";
import { getWhoopStatus, syncWhoopWorkouts } from "@/lib/whoop/sync";
import { timestampIsStale } from "./refresh-staleness";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function refreshWhoopIfStale({
  now = getServerNow(),
  maxAgeMinutes = 60,
  lookbackDays = 8
}: {
  now?: Date;
  maxAgeMinutes?: number;
  lookbackDays?: number;
} = {}) {
  const status = await getWhoopStatus();
  if (!status.connected) {
    return { attempted: false, workoutsRefreshed: false, healthRefreshed: false };
  }

  const shouldRefreshWorkouts =
    status.readWorkout && timestampIsStale(status.lastSyncAt, now, maxAgeMinutes);
  const shouldRefreshHealth =
    (status.readSleep || status.readRecovery) &&
    timestampIsStale(status.lastHealthContextAt, now, maxAgeMinutes);

  if (!shouldRefreshWorkouts && !shouldRefreshHealth) {
    return { attempted: false, workoutsRefreshed: false, healthRefreshed: false };
  }

  const start = new Date(now.getTime() - lookbackDays * DAY_MS).toISOString();
  const end = now.toISOString();
  const errors: string[] = [];
  let workoutsRefreshed = false;
  let healthRefreshed = false;

  if (shouldRefreshWorkouts) {
    try {
      await syncWhoopWorkouts({ start, end, maxPages: 3 });
      workoutsRefreshed = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "WHOOP workout sync failed");
    }
  }

  if (shouldRefreshHealth) {
    try {
      const result = await syncWhoopHealthContext({ start, end, maxPages: 3 });
      healthRefreshed = result.errors.length === 0;
      errors.push(...result.errors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "WHOOP health sync failed");
    }
  }

  return {
    attempted: true,
    workoutsRefreshed,
    healthRefreshed,
    errors
  };
}
