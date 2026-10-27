import { z } from "zod";
import { healthSampleFields } from "@/lib/health-sample-validation";

export const omronInput = z.object({
  ...healthSampleFields,
  metric: z.enum(["systolic", "diastolic", "pulse"]),
  value: healthSampleFields.value.max(500),
  unit: z.enum(["mmHg", "bpm"]),
  sourceName: healthSampleFields.sourceName.regex(/^omron\b/i, "Only OMRON-sourced samples are supported")
}).strict().refine(
  (sample) => sample.unit === (sample.metric === "pulse" ? "bpm" : "mmHg"),
  "Blood pressure must use mmHg and pulse must use bpm"
);
