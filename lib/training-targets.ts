import { z } from "zod";

export const weeklyTrainingTargetsSchema = z
  .object({
    strengthSessions: z.number().int().min(0).max(7).optional(),
    cardioSessions: z.number().int().min(0).max(14).optional(),
    zone2Minutes: z.number().int().min(0).max(600).optional(),
    heatSessions: z.number().int().min(0).max(14).optional(),
    heatMinutes: z.number().int().min(0).max(600).optional()
  })
  .strict();
