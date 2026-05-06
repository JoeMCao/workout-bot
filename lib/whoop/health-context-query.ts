import type { WhoopRecovery, WhoopSleep } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_USER_TIMEZONE,
  getLocalDateKey,
  getServerNow,
  shiftLocalDateKey
} from "@/lib/time";

export type WhoopHealthContextDay = {
  localDate: string;
  sleep: WhoopSleep | null;
  recovery: WhoopRecovery | null;
};

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function queryWhoopHealthContextDays(options: {
  /** `YYYY-MM-DD` in America/Los_Angeles semantics for anchoring the window. */
  anchorDate?: string;
  /** Inclusive number of calendar days ending at `anchorDate`. Clamped 1–14. */
  days?: number;
}): Promise<{
  timezone: string;
  anchorDate: string;
  days: number;
  context: WhoopHealthContextDay[];
}> {
  let days = options.days ?? 1;
  if (!Number.isFinite(days) || days < 1) days = 1;
  if (days > 14) days = 14;

  const anchorDate =
    options.anchorDate && isYmd(options.anchorDate)
      ? options.anchorDate
      : getLocalDateKey(getServerNow(), DEFAULT_USER_TIMEZONE);

  const context: WhoopHealthContextDay[] = [];

  for (let i = 0; i < days; i++) {
    const localDate = shiftLocalDateKey(
      anchorDate,
      -(days - 1 - i),
      DEFAULT_USER_TIMEZONE
    );

    const [sleep, recovery] = await Promise.all([
      prisma.whoopSleep.findFirst({
        where: { localDate },
        orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }]
      }),
      prisma.whoopRecovery.findFirst({
        where: { localDate },
        orderBy: { updatedAt: "desc" }
      })
    ]);

    context.push({ localDate, sleep, recovery });
  }

  return {
    timezone: DEFAULT_USER_TIMEZONE,
    anchorDate,
    days,
    context
  };
}
