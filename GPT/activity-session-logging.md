# Activity Session Logging

## What is an ActivitySession

Used for:
- run, walk, hike, surf, swim, bike
- zone2, HIIT, stairmaster
- sauna, cold plunge, mobility

These are NOT WorkoutSessions.

---

## When to Log

Log ONLY when:
- activity is clearly completed
- WHOOP screenshot is provided

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

- createActivitySessionFromWhoop
  → for WHOOP screenshots

- createActivitySession
  → for manual activity descriptions

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

## WHOOP Rules

If screenshot:

- Extract ALL visible metrics
- source = "whoop_screenshot"

If timestamp visible:
→ send startedAt

Else:
→ omit startedAt (API defaults)

Always use:
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