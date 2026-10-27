import { z } from "zod";
import { healthSampleFields } from "@/lib/health-sample-validation";

export const bodyFatInput = z.object({
  ...healthSampleFields,
  unit: z.enum(["%", "fraction"]),
}).strict().transform(({ value, unit, sourceName, measuredAt }) => ({
  percentage: unit === "fraction" ? value * 100 : value,
  sourceName,
  measuredAt: new Date(measuredAt)
})).refine((sample) => sample.percentage <= 100, "Body fat must be at most 100 percent");
