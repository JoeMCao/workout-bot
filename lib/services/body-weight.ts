import { prisma } from "@/lib/prisma";
import { bodyWeightInput } from "@/lib/body-weight-validation";

export async function importBodyWeight(input: unknown) {
  const data = bodyWeightInput.parse(input);
  // Atomic upsert makes retries safe. A corrected value at the same source/time replaces it.
  return prisma.bodyWeight.upsert({
    where: { source_measuredAt: { source: data.source, measuredAt: data.measuredAt } },
    create: data,
    update: { weightKg: data.weightKg }
  });
}

export async function getBodyWeight(limit = 7) {
  const records = await prisma.bodyWeight.findMany({
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    take: Math.min(30, Math.max(1, limit))
  });
  const measurements = records.map((row) => ({
    ...row, weightLb: Math.round(row.weightKg / 0.45359237 * 10) / 10
  }));
  return {
    latest: measurements[0] ?? null,
    measurements,
    fetchedAt: new Date().toISOString(),
    note: "measuredAt is the timestamp recorded in Apple Health; receivedAt is first import time. An old measurement is not evidence of a new weigh-in."
  };
}
