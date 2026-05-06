# Activity Session Logging

## Preferred vs legacy WHOOP ingest

**Preferred (default):** WHOOP is connected → `getWhoopConnectionStatus` → `syncWhoopWorkouts` → read recent `ActivitySession` rows → confirm match with the user. This is the normal path for “I finished my run / workout.”

**Legacy / fallback only:** `createActivitySessionFromWhoop` when OAuth sync is unavailable, sync failed, no matching activity after sync, or the user explicitly provides screenshot-parse data. Not the primary ingestion path; kept for recovery and backward compatibility.

---

## What is an ActivitySession

Used for:
- run, walk, hike, surf, swim, bike
- zone2, HIIT, stairmaster
- sauna, cold plunge, mobility

These are NOT WorkoutSessions.

---

## When to Log

Log ONLY when:
- activity is clearly completed, and
- you have a path: **WHOOP sync + recent activities** (preferred), or **legacy from-whoop** only if sync cannot be used (see above)

Do NOT log when:
- planning
- vague references
- user is asking questions

If unclear:
→ ask: "Do you want me to log this activity?"

---

## Mandatory Logging Rule

If activity is detected:

1. Extract structured data
2. Call API
3. THEN respond

Interpretation without API call = failure

If API fails:
- retry once
- if still failing → say "Logging failed"

---

## Tool Selection

Use:

- getWhoopConnectionStatus + syncWhoopWorkouts + getRecentActivitySessions
  → default when the user finished an activity and WHOOP may have the data

- createActivitySessionFromWhoop
  → **legacy / fallback only:** screenshot parse, failed sync, disconnected WHOOP, or historical manual import (`whoop_screenshot`)

- createActivitySession
  → for manual activity descriptions (non-WHOOP)

---

## Data Extraction

Extract when available:

- type
- durationMinutes
- intensity
- avgHeartRate
- maxHeartRate
- calories
- distanceMeters
- elevationGainMeters
- elevationLossMeters
- paceSecondsPerKm
- or input aliases: elevationGainFeet, paceMinutesPerMile, paceMinutesPerKm, paceSecondsPerMile
- strain
- zone0–zone5 minutes
- notes

Canonical storage:
- pace is stored as paceSecondsPerKm; convert if needed or send one pace alias
- elevation gain is stored as elevationGainMeters; send elevationGainFeet only when source is in feet
- elevationLossMeters is explicit descent/loss only; never infer it from elevation gain

Partial data is OK.
Do NOT block logging.

---

## WHOOP Rules (legacy screenshot path)

Use this section **only** when using `createActivitySessionFromWhoop` (fallback), not when using OAuth sync.

If screenshot / parsed card:

- Extract ALL visible metrics
- source = "whoop_screenshot"

If timestamp visible:
→ send startedAt

Else:
→ omit startedAt (API defaults)

Call:
→ createActivitySessionFromWhoop

---

## Context Linking

If activity happens during a live workout:
→ attach using relatedWorkoutSessionId

Else:
→ create standalone ActivitySession

---

## Duplicate Prevention

If similar activity was just logged:
→ ask:
"Log as new or update existing?"

---

## Response Format

After successful log:

Respond with:
- activity type
- date
- duration
- short interpretation

Keep under 3 lines.