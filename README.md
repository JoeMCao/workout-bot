# Workout Bot API

Minimal Next.js API for logging workouts from a Custom GPT Action.

## Stack

- Next.js App Router API routes under `app/api`
- PostgreSQL on Railway
- Prisma ORM
- TypeScript
- Zod validation
- Bearer API key auth with `WORKOUT_API_KEY`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env example:

```bash
cp .env.example .env
```

3. Fill in `.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
WORKOUT_API_KEY="replace-with-a-long-random-secret"
```

4. Create and apply the initial Prisma migration:

```bash
npx prisma migrate dev --name init
```

5. Start the dev server:

```bash
npm run dev
```

## Deployment Env Vars

In Vercel, set:

- `DATABASE_URL`: the public Railway PostgreSQL connection string.
- `WORKOUT_API_KEY`: a long random secret used by your Custom GPT Action as a bearer token.

From Railway, use the PostgreSQL connection URL. Prisma expects a URL like:

```bash
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

## Prisma Commands

Create a local migration:

```bash
npx prisma migrate dev --name init
```

Apply migrations in production:

```bash
npx prisma migrate deploy
```

Regenerate the Prisma client:

```bash
npx prisma generate
```

## API Auth

Every API route requires:

```http
Authorization: Bearer $WORKOUT_API_KEY
```

## Curl Examples

Create a session:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Authorization: Bearer $WORKOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "Pull",
    "goal": "Moderate volume back day",
    "readinessScore": 7,
    "energy": 7,
    "soreness": "mild hamstrings",
    "sleepQuality": "good"
  }'
```

Log a set:

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

End a session:

```bash
curl -X PATCH http://localhost:3000/api/sessions/SESSION_ID \
  -H "Authorization: Bearer $WORKOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endedAt": "2026-05-01T23:30:00.000Z",
    "notes": "Good session. No pain."
  }'
```

Fetch recent sessions:

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
curl "http://localhost:3000/api/openapi" \
  -H "Authorization: Bearer $WORKOUT_API_KEY"
```

## Custom GPT Action Setup

1. Deploy the app to Vercel.
2. Open `https://YOUR_VERCEL_DOMAIN/api/openapi` with the bearer header, or run the curl command above.
3. Paste the returned JSON into the Custom GPT Action schema editor.
4. Set Action authentication to API key or bearer token, using the same value as `WORKOUT_API_KEY`.
5. In your GPT instructions, tell it to create a session at workout start, log sets immediately after completion, call exercise history before prescribing loads, and end the session when finished.

## Exercise Name Behavior

Exercise lookup trims whitespace, collapses repeated spaces, and lowercases names for matching. The first display name is preserved, so `Lat Pulldown` and ` lat   pulldown ` resolve to the same exercise without overwriting old sets.
