# Workout Bot API

A lightweight workout memory layer for a Custom GPT coach.

Workout Bot API lets you talk to a GPT from your phone during training while the API quietly stores the data that matters: sessions, exercises, sets, readiness, pain signals, fatigue, soreness, and WHOOP-style recovery metrics. The goal is simple: give an AI coach enough structured history to prescribe better workouts than a stateless chat ever could.

## What It Does

- Logs workout sessions from a Custom GPT Action.
- Captures every completed set with exercise name, load, reps, RPE, RIR, pain flags, and notes.
- Stores session-level readiness signals such as low back pain, elbow irritation, neck tightness, fatigue, motivation, and soreness areas.
- Supports WHOOP-related recovery fields for sleep, HRV, resting heart rate, strain, and raw payloads.
- Retrieves recent sessions and exercise history so a GPT can adjust training based on real history.
- Exposes a public OpenAPI `3.1.0` schema for easy Custom GPT Action import.
- Protects all workout data routes with a private bearer API key.

## Why This Exists

Most workout trackers are built for screens, dashboards, and manual taps. This project is built for conversation. You can tell your GPT coach what you just did between sets, ask what to do next, and let the API preserve the structured training record behind the scenes.

That makes the GPT useful across sessions. It can see recent performance, avoid exercises that bothered your back or elbows, adjust volume when fatigue is high, and reference previous loads before prescribing the next set.

## Tech Stack

- Next.js App Router API routes under `app/api`
- PostgreSQL on Railway
- Prisma ORM
- TypeScript
- Zod validation
- Vercel deployment
- Bearer API key auth with `WORKOUT_API_KEY`

## Core Endpoints

- `POST /api/sessions`: create a workout session, including optional readiness signals.
- `PATCH /api/sessions/:id`: update session details, notes, end time, and signals.
- `POST /api/sessions/:id/signals`: update only readiness/recovery signals mid-workout.
- `GET /api/sessions/:id/signals`: fetch only readiness/recovery signals.
- `POST /api/sets`: log a completed set and auto-create the exercise if needed.
- `GET /api/sessions/recent?limit=10`: fetch recent sessions with exercises, sets, and signals.
- `GET /api/exercises/history?name=lat%20pulldown&limit=10`: fetch recent set history for an exercise.
- `GET /api/openapi`: public OpenAPI schema for GPT Actions.

## Security Model

Every route except `GET /api/openapi` requires:

```http
Authorization: Bearer $WORKOUT_API_KEY
```

Use a long random value for `WORKOUT_API_KEY` and set the same value in Vercel and your Custom GPT Action authentication settings.

## Local Setup

Install dependencies:

```bash
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

Fill in:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
WORKOUT_API_KEY="replace-with-a-long-random-secret"
```

Apply migrations:

```bash
npx prisma migrate dev
```

Start the app:

```bash
npm run dev
```

## Deployment

Deploy to Vercel and set these environment variables:

- `DATABASE_URL`: Railway PostgreSQL public connection string.
- `WORKOUT_API_KEY`: private bearer token for your Custom GPT Action.

Run production migrations when needed:

```bash
npx prisma migrate deploy
```

## Custom GPT Action Setup

1. Deploy the app to Vercel.
2. Open `https://YOUR_VERCEL_DOMAIN/api/openapi`.
3. Paste the returned JSON into the Custom GPT Action schema editor.
4. Configure Action authentication as bearer/API key auth using `WORKOUT_API_KEY`.
5. In your GPT instructions, tell it to create a session at workout start, log sets after completion, check exercise history before prescribing loads, update readiness signals when pain or fatigue changes, and end the session when done.

## Example Requests

Create a session with readiness signals:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer $WORKOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "Pull",
    "goal": "Moderate volume back day",
    "readinessScore": 7,
    "energy": 7,
    "sleepQuality": "good",
    "lowBackPain": false,
    "elbowIrritation": "mild",
    "neckTightness": "moderate",
    "fatigueLevel": "high",
    "sorenessAreas": ["mid-back", "hamstrings"],
    "readinessNotes": "Slept poorly, low back feels okay"
  }'
```

Log a completed set:

```bash
curl -X POST http://localhost:3000/api/sets \
  -H "Authorization: Bearer $WORKOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID",
    "exerciseName": "Lat Pulldown",
    "setNumber": 1,
    "weight": 120,
    "reps": 10,
    "rpe": 8
  }'
```

Update signals mid-workout:

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/signals \
  -H "Authorization: Bearer $WORKOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lowBackPain": true,
    "lowBackPainSeverity": "mild",
    "elbowIrritation": "none",
    "fatigueLevel": "high",
    "readinessNotes": "Back felt tight during warmup"
  }'
```

Fetch recent sessions with signals:

```bash
curl "http://localhost:3000/api/sessions/recent?limit=10" \
  -H "Authorization: Bearer $WORKOUT_API_KEY"
```

Fetch exercise history:

```bash
curl "http://localhost:3000/api/exercises/history?name=lat%20pulldown&limit=10" \
  -H "Authorization: Bearer $WORKOUT_API_KEY"
```

Fetch the OpenAPI schema:

```bash
curl "http://localhost:3000/api/openapi"
```

## Data Notes

Exercise names are lightly normalized for lookup: whitespace is trimmed, repeated spaces are collapsed, and matching is lowercase. The original display name is preserved, so `Lat Pulldown` and ` lat   pulldown ` resolve to the same exercise without overwriting historical sets.

Historical sets are append-only through the public API. Logging a new set never overwrites old set data.
