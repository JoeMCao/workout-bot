import { z } from "zod";
import { DEFAULT_USER_TIMEZONE, getLocalDateKey, getStartOfLocalDateUtc } from "./time.ts";

export const journalEventIdSchema = z.string().trim().min(1).max(200);
const timezone = z.string().refine((value) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; }
  catch { return false; }
}, "Use a valid IANA timezone");

export const createSensationCheckInSchema = z.object({
  // Validate without trimming or rewriting the user's words.
  description: z.string().min(1).max(10000).refine((value) => value.trim().length > 0,
    "Provide an observation"),
  observedAt: z.string().datetime({ offset: true }).optional(),
  timezone: timezone.optional()
}).strict();

export const recordSensationCheckInSchema = createSensationCheckInSchema.extend({
  clientEventId: journalEventIdSchema
});

export const updateSensationCheckInSchema = createSensationCheckInSchema.partial().refine(
  (body) => Object.values(body).some((value) => value !== undefined),
  "Provide at least one field to update"
);

export const sensationHistorySchema = z.object({
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  limit: z.number().int().min(1).max(500).optional()
}).strict().superRefine((body, ctx) => {
  if (Boolean(body.startDate) !== Boolean(body.endDate)) {
    ctx.addIssue({ code: "custom", message: "Provide both startDate and endDate" });
  }
  if (body.startDate && body.endDate && body.startDate > body.endDate) {
    ctx.addIssue({ code: "custom", message: "startDate must not be after endDate" });
  }
});

// Calendar arithmetic must not depend on the server's local timezone or DST.
function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function sensationHistoryWindow(input: z.infer<typeof sensationHistorySchema>, now = new Date()) {
  const parsed = sensationHistorySchema.parse(input);
  const endDate = parsed.endDate ?? getLocalDateKey(now);
  const startDate = parsed.startDate ?? shiftDate(endDate, -27);
  return {
    startDate, endDate, timezone: DEFAULT_USER_TIMEZONE,
    start: getStartOfLocalDateUtc(startDate),
    endExclusive: getStartOfLocalDateUtc(shiftDate(endDate, 1)),
    limit: parsed.limit ?? 200
  };
}
