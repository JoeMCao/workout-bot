import { z } from "zod";

export const bodyWeightInput = z.object({
  weight: z.number().finite().positive(),
  unit: z.enum(["kg", "lb"]),
  measuredAt: z.string().datetime({ offset: true }).refine(
    (value) => Date.parse(value) <= Date.now() + 5 * 60_000,
    "Measurement time cannot be in the future"
  )
}).strict().transform(({ weight, unit, measuredAt }) => ({
  source: "apple_health" as const,
  weightKg: Math.round((unit === "lb" ? weight * 0.45359237 : weight) * 1_000_000) / 1_000_000,
  measuredAt: new Date(measuredAt)
})).refine((value) => value.weightKg > 0 && value.weightKg <= 1000, "Weight is outside the supported range");
