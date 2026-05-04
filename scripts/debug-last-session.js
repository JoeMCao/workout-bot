const fs = require("node:fs");
const path = require("node:path");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

function databaseHostLabel(databaseUrl) {
  if (!databaseUrl) {
    return "DATABASE_URL not configured";
  }

  try {
    const url = new URL(databaseUrl);
    return `${url.host}${url.pathname}`;
  } catch {
    return "DATABASE_URL is not a valid URL";
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  console.log("DATABASE_URL host:", databaseHostLabel(databaseUrl));

  if (!databaseUrl) {
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(databaseUrl)
  });

  try {
    const session = await prisma.workoutSession.findFirst({
      orderBy: { startedAt: "desc" },
      include: {
        sets: {
          orderBy: { completedAt: "asc" },
          include: {
            exercise: true
          }
        },
        linkedActivitySessions: true
      }
    });

    if (!session) {
      console.log("No WorkoutSession rows found.");
      return;
    }

    const exercises = Array.from(
      new Map(
        session.sets.map((set) => [
          set.exerciseId,
          {
            id: set.exercise.id,
            name: set.exercise.name
          }
        ])
      ).values()
    );

    console.log(
      JSON.stringify(
        {
          latestSession: {
            id: session.id,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            sessionType: session.sessionType,
            goal: session.goal,
            notes: session.notes
          },
          relatedCounts: {
            exercises: exercises.length,
            sets: session.sets.length,
            linkedActivitySessions: session.linkedActivitySessions.length
          },
          exercises,
          sets: session.sets.map((set) => ({
            id: set.id,
            exerciseId: set.exerciseId,
            exerciseName: set.exercise.name,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
            rir: set.rir,
            painFlag: set.painFlag,
            painNotes: set.painNotes,
            notes: set.notes,
            completedAt: set.completedAt
          })),
          linkedActivitySessions: session.linkedActivitySessions
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
