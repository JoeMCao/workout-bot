import { z } from "zod";

export const omronInput = z.object({
  metric: z.enum(["systolic", "diastolic", "pulse"]),
  value: z.number().finite().positive().max(500),
  unit: z.enum(["mmHg", "bpm"]),
  sourceName: z.string().trim().min(1).max(200).regex(/^omron\b/i, "Only OMRON-sourced samples are supported"),
  measuredAt: z.string().datetime({ offset: true }).refine(
    (value) => Date.parse(value) <= Date.now() + 5 * 60_000,
    "Measurement time cannot be in the future"
  )
}).strict().refine(
  (sample) => sample.unit === (sample.metric === "pulse" ? "bpm" : "mmHg"),
  "Blood pressure must use mmHg and pulse must use bpm"
);
