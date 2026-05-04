const fs = require("node:fs");
const path = require("node:path");

const dotenv = require("dotenv");

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.join(process.cwd(), envFile);

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

async function main() {
  const apiKey = process.env.WORKOUT_API_KEY;
  const baseUrl = process.env.WORKOUT_API_BASE_URL ?? "http://localhost:3000";

  if (!apiKey) {
    throw new Error("WORKOUT_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/time`, {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  });
  const endedAt = Date.now();

  if (!response.ok) {
    throw new Error(`GET /api/time failed with status ${response.status}`);
  }

  const body = await response.json();
  const keys = Object.keys(body).sort();

  if (keys.join(",") !== "dbNow,timezone") {
    throw new Error(`Unexpected response keys: ${keys.join(",")}`);
  }

  const dbNowMs = Date.parse(body.dbNow);

  if (Number.isNaN(dbNowMs)) {
    throw new Error(`dbNow is not a valid ISO timestamp: ${body.dbNow}`);
  }

  const midpointMs = startedAt + (endedAt - startedAt) / 2;
  const driftMs = Math.abs(dbNowMs - midpointMs);

  console.log("dbNow:", body.dbNow);
  console.log("timezone:", body.timezone);
  console.log("driftMs:", Math.round(driftMs));

  if (driftMs > 2000) {
    throw new Error(`dbNow differs from server time by ${Math.round(driftMs)}ms`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
