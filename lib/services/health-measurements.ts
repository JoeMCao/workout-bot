import { prisma } from "@/lib/prisma";
import { omronInput } from "@/lib/omron-validation";
import { getBodyWeight } from "@/lib/services/body-weight";

export async function importOmronMeasurement(input: unknown) {
  const sample = omronInput.parse(input);
  const identity = { sourceName: sample.sourceName, measuredAt: new Date(sample.measuredAt) };
  const where = { sourceName_measuredAt: identity };
  if (sample.metric === "pulse") {
    return prisma.omronPulse.upsert({
      where, create: { ...identity, bpm: sample.value }, update: { bpm: sample.value }
    });
  }
  // Each atomic update touches only the supplied component. Concurrent uploads cannot
  // erase the other half. No nearest-time matching or daily-average pairing is used.
  const component = sample.metric === "systolic" ? { systolic: sample.value } : { diastolic: sample.value };
  return prisma.bloodPressure.upsert({ where, create: { ...identity, ...component }, update: component });
}

export async function getHealthMeasurements(limit = 7) {
  const take = Math.min(30, Math.max(1, limit));
  const [weight, pressures, pulses, incompleteCount] = await Promise.all([
    getBodyWeight(take),
    prisma.bloodPressure.findMany({
      where: { systolic: { not: null }, diastolic: { not: null } },
      orderBy: [{ measuredAt: "desc" }, { id: "desc" }], take
    }),
    prisma.omronPulse.findMany({ orderBy: [{ measuredAt: "desc" }, { id: "desc" }], take }),
    prisma.bloodPressure.count({ where: { OR: [{ systolic: null }, { diastolic: null }] } })
  ]);
  const bloodPressure = pressures.map((row) => ({
    ...row, source: "apple_health", unit: "mmHg", pairingMethod: "exact_source_and_timestamp"
  }));
  const pulse = pulses.map((row) => ({ ...row, source: "apple_health", unit: "bpm" }));
  return {
    weight,
    bloodPressure: { latest: bloodPressure[0] ?? null, measurements: bloodPressure, incompleteCount },
    pulse: { latest: pulse[0] ?? null, measurements: pulse },
    fetchedAt: new Date().toISOString(),
    note: "Use measuredAt for each measurement, not receivedAt or fetchedAt. BP components are matched by exact OMRON source and timestamp, not a HealthKit correlation ID; unmatched components are excluded and counted. Pulse is an OMRON spot measurement, not WHOOP resting heart rate, and is not assumed to belong to a BP reading."
  };
}
