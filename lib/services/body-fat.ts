import { prisma } from "@/lib/prisma";
import { bodyFatInput } from "@/lib/body-fat-validation";

export async function importBodyFat(input: unknown) {
  const data = bodyFatInput.parse(input);
  return prisma.bodyFat.upsert({
    where: { sourceName_measuredAt: { sourceName: data.sourceName, measuredAt: data.measuredAt } },
    create: data,
    update: { percentage: data.percentage }
  });
}

export async function getBodyFat(limit = 7) {
  const records = await prisma.bodyFat.findMany({
    orderBy: [{ measuredAt: "desc" }, { id: "desc" }],
    take: Math.min(30, Math.max(1, limit))
  });
  const measurements = records.map((row) => ({ ...row, source: "apple_health", unit: "%" }));
  return { latest: measurements[0] ?? null, measurements };
}
