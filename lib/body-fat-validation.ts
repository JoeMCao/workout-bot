import { z } from "zod";

export const bodyFatInput = z.object({
  value: z.number().finite().positive(),
  unit: z.enum(["%", "fraction"]),
  sourceName: z.string().trim().min(1).max(200),
  measuredAt: z.string().datetime({ offset: true }).refine(
    (value) => Date.parse(value) <= Date.now() + 5 * 60_000,
    "Measurement time cannot be in the future"
  )
}).strict().transform(({ value, unit, sourceName, measuredAt }) => ({
  percentage: unit === "fraction" ? value * 100 : value,
  sourceName,
  measuredAt: new Date(measuredAt)
})).refine((sample) => sample.percentage <= 100, "Body fat must be at most 100 percent");
