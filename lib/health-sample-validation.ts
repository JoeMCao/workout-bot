import { z } from "zod";

// Shared wire fields for all Apple Health uploads. Only units and metric-specific
// bounds differ; measurement time must never fall back to import time.
export const healthSampleFields = {
  value: z.number().finite().positive(),
  sourceName: z.string().trim().min(1).max(200),
  measuredAt: z.string().datetime({ offset: true }).pipe(z.string().refine(
    (value) => Date.parse(value) <= Date.now() + 5 * 60_000,
    "Measurement time cannot be in the future"
  ))
};
