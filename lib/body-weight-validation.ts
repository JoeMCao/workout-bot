import { z } from "zod";
import { healthSampleFields } from "@/lib/health-sample-validation";

export const bodyWeightInput = z.object({
  ...healthSampleFields,
  value: healthSampleFields.value.optional(),
  // Compatibility for already-installed Shortcuts. New clients use value + sourceName.
  weight: healthSampleFields.value.optional(),
  sourceName: healthSampleFields.sourceName.optional(),
  unit: z.enum(["kg", "lb"]),
}).strict().superRefine((data, ctx) => {
  if ((data.value === undefined) === (data.weight === undefined)) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Supply value, or the legacy weight field, but not both" });
  }
  if (data.value !== undefined && data.sourceName === undefined) {
    ctx.addIssue({ code: "custom", path: ["sourceName"], message: "Source name is required" });
  }
}).transform(({ value, weight, unit, sourceName, measuredAt }) => ({
  source: "apple_health" as const,
  sourceName,
  weightKg: Math.round((value ?? weight!) * (unit === "lb" ? 0.45359237 : 1) * 1_000_000) / 1_000_000,
  measuredAt: new Date(measuredAt)
})).refine((value) => value.weightKg > 0 && value.weightKg <= 1000, "Weight is outside the supported range");
