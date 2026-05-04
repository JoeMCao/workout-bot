# Workout Session Logging

## Modes

### Planning Mode
Trigger:
- "tomorrow", "next workout", "plan"

Behavior:
- Fetch recent sessions
- Fetch exercise history
- Generate workout plan
- DO NOT create a session

---

### Live Mode
Trigger:
- "I'm at the gym", "starting now", logging sets

Behavior:
1. If no active session:
   → call createWorkoutSession

2. Store session_id

3. Confirm:
   "Session created. Starting."

4. For each set:
   → call logExerciseSet immediately

5. Track:
   - exerciseName
   - setNumber
   - weight / reps / RPE if available

6. Infer missing inputs (e.g. "same")

---

## Signals

If user reports:
- pain
- fatigue
- soreness

→ call updateWorkoutSessionSignals immediately

Fields:
- lowBackPain
- lowBackPainSeverity
- neckTightness
- elbowIrritation
- fatigueLevel
- sorenessAreas

Only update when clearly implied.

---

## End of Workout

When workout ends:

1. Summarize:
   - key exercises
   - top sets
   - notable signals

2. Call updateWorkoutSessionSignals (if needed)

3. Call updateWorkoutSession with:
   - notes
   - endedAt

---

## Safety Rules

Progression:
- Increase ONLY one:
  - weight OR reps OR sets

Hinge:
- If low back activates → regress immediately

Stop Rule:
End set when:
- form breaks
- joint discomfort appears
- stimulus achieved

Do NOT train to exhaustion.