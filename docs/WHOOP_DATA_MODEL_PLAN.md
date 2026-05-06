# WHOOP & session data model plan (revised)

**Goals:** Preserve every existing row; avoid destructive migrations; align WHOOP and strength work under one clear model.

**Separation of concerns**

- **`ActivitySession`** = real-world session clock + shared physiology (WHOOP strain, HR, zones, etc.). Canonical category is **`type` + `modality`** (and optional **`sourceActivityType`** for the vendor string). WHOOP’s sport label is **not** proof that structured sets exist.
- **`WorkoutSession`** = structured strength data (exercises, sets, reps, weights, RPE). Create or link a **`WorkoutSession`** only when the user (or GPT) **logs** that structure—never infer sets from WHOOP unless the API explicitly includes them.
- **`relatedWorkoutSessionId`** links the two when both exist. WHOOP functional fitness / weightlifting with **no** logged sets stays **`ActivitySession` only** (`type: strength`, `modality` as normalized).

**Principles**

- **No drops** of `WorkoutSession`, `Exercise`, `ExerciseSet`, or existing `ActivitySession` rows.
- **No renames** of tables in Phase 1–2. `WorkoutSession` stays the DB name; UI/copy may say “strength session.”
- **Additive-only schema** until Phase 3 is explicitly approved, backed up, and verified.
- **Idempotent WHOOP imports:** same WHOOP workout ID must not create duplicate logical activity rows.
- **UTC storage;** matching and user-facing grouping use **`America/Los_Angeles`** (use existing `lib/time` helpers—avoid naive `toISOString().slice(0, 10)` for “today” semantics).

### Current implementation priority

Before expanding schema behavior further, complete WHOOP OAuth integration and inspect real WHOOP workout payloads.

Use actual WHOOP run / functional_fitness / weightlifting payloads to validate:

- activity types
- timestamps
- duration semantics
- strain fields
- heart-rate zones
- elevation metrics
- workout identifiers
- update behavior

Prefer validating assumptions against real API responses before introducing additional schema migrations or normalization rules.

---

## Current schema (baseline)

- **`WorkoutSession`:** strength sessions; `ExerciseSet` → exercises/reps/weights/RPE/etc.
- **`ActivitySession`:** cardio/recovery/etc.; already holds shared physiology fields (strain, HR, zones, distance, pace, elevation, calories, …).
- **Link already exists:** `ActivitySession.relatedWorkoutSessionId` → `WorkoutSession.id` (`WorkoutSession.linkedActivitySessions` is the inverse). **No second FK is required for Phase 1** unless you want a redundant reverse pointer for query ergonomics—if both sides are ever added, define **one** authoritative direction and treat the other as cached (or avoid duplication entirely).

- **WHOOP today:** `WhoopWorkoutMapping` (`whoopWorkoutId` **unique**) → optional `activitySessionId`; raw JSON in `mapping.raw`. Sync creates/updates `ActivitySession` and mapping rows.

**Activity ingestion preference:** **`POST /api/whoop/sync`** (after OAuth) is the default source of WHOOP-backed activities. **`POST /api/activity-sessions/from-whoop`** remains a **legacy / fallback** path (screenshot parse, failed sync, disconnected account, historical import)—do not remove; see OpenAPI and GPT instructions.

---

## Target conceptual model

| Layer | Responsibility |
|--------|----------------|
| **`ActivitySession`** | Time span + physiology + coarse activity metadata (type, modality, WHOOP metrics). |
| **`WorkoutSession`** | Strength-specific structure: exercises, sets, loads, RPE, strength notes. |
| **Link** | For a strength workout that also has WHOOP data: one **canonical** `ActivitySession` with `relatedWorkoutSessionId` set (1:1 in practice; enforce if needed via partial unique index on `relatedWorkoutSessionId` where not null). |

---

## Phase 1 — Non-destructive linking & backfill

**Allowed**

1. **Add columns** on `ActivitySession` / `WorkoutSession` only if strictly needed (e.g. `syncStatus`, `sourceWorkoutId`, JSON pointer—see below). Use nullable columns with safe defaults.
2. **Optional backfill only after review.** Do not automatically backfill historical `WorkoutSession` rows unless explicitly requested. Since there is currently only one historical `WorkoutSession`, manual inspection is preferred over bulk migration.

**Not allowed**

- Dropping or renaming tables/columns that hold production data.
- Moving or deleting `Exercise` / `ExerciseSet` data.
- Bulk `DELETE` / `TRUNCATE` as part of “cleanup.”

### Backfill (existing `WorkoutSession` without a linked activity)

Backfill is optional and should not run automatically.

Preferred order of operations:

1. Complete WHOOP OAuth.
2. Fetch and inspect real WHOOP payloads.
3. Validate how strength-like WHOOP activities map to the current schema.
4. Only then decide whether historical `WorkoutSession` rows need corresponding `ActivitySession` shells.

Because there is currently only one historical `WorkoutSession`, manual inspection and linking is acceptable.

For each `WorkoutSession` that has **no** `ActivitySession` with `relatedWorkoutSessionId = WorkoutSession.id`:

1. **Create** `ActivitySession`:
   - **`startedAt`:** `WorkoutSession.startedAt` (fallback: `WorkoutSession.createdAt` if you ever need it—schema uses `startedAt` as required).
   - **`endedAt`:** `WorkoutSession.endedAt` if present.
   - **`durationMinutes`:** derive from `endedAt - startedAt` when both exist; else leave null (there is **no** `durationMinutes` on `WorkoutSession` today).
   - **`type`:** add **`strength`** to validated activity types (`lib/validation.ts`, OpenAPI) **or** temporarily use **`other`** with `modality` = `weightlifting` / `functional_fitness` until `strength` is rolled out everywhere—pick one strategy and keep API consistent.
   - **`modality`:** e.g. `weightlifting` / `functional_fitness` as appropriate.
   - **`source`:** e.g. `manual` or derive from `WorkoutSession.timeSource` if you map it; **do not** reference a non-existent `WorkoutSession.source` field.
   - **`notes`:** optional copy/summary from `WorkoutSession.notes` if desired.
   - **`relatedWorkoutSessionId`:** set to this `WorkoutSession.id`.
2. **Preserve** all `WorkoutSession`, `Exercise`, `ExerciseSet` rows unchanged.

**Verification:** Row counts: `WorkoutSession` unchanged; `ActivitySession` count increases by backfill amount; every backfilled activity has correct `relatedWorkoutSessionId`.

**Implemented command (Phase 1):** after deploying the `strength` activity type and analytics filters, run once per database (with `DATABASE_URL` set):

```bash
npm run backfill:strength-activities
```

The script is idempotent: it only creates rows for `WorkoutSession` records that have no linked `ActivitySession`.

This command should not run automatically as part of migrations or startup. Run it manually only after verifying the expected behavior against the current database state.

---

## Phase 2 — WHOOP import behavior

**Implementation status (server sync):** `POST /api/whoop/sync` applies the rules below. Ambiguous matches do **not** block the sync: they produce **`ActivitySession.syncStatus = needs_review`** with no `relatedWorkoutSessionId`. Resolving ambiguity is a **manual or GPT-assisted** follow-up (e.g. PATCH activity to set `relatedWorkoutSessionId`, then clear `syncStatus`). Constants: `WHOOP_STRENGTH_MATCH_WINDOW_MS` (±2h) and `activitySyncStatus.needsReview` in `lib/whoop/adapter.ts`; matching in `lib/whoop/strength-match.ts`.

### Cardio / non-strength (runs, bike, surf, stairmaster, etc.)

- **Continue** creating/updating **`ActivitySession`** only (adapter + sync).
- Keep **`relatedWorkoutSessionId`** null unless a strength rule links a unique **`WorkoutSession`**.

### Strength-like WHOOP activities (functional fitness / weightlifting)

1. Resolve **Los Angeles calendar day** for the WHOOP workout start (`getLocalDateKey`, `America/Los_Angeles`).
2. **Match** candidates:
   - `WorkoutSession` with `startedAt` within **±2 hours** of WHOOP start **and** on that LA calendar day.
   - If exactly one: **unique** match.
   - If zero: **no match**.
   - If more than one on that LA day in the window: **ambiguous**.
3. **Unique + existing ActivitySession shell** (e.g. Phase 1 backfill): **update** that row with WHOOP metrics, **`syncStatus` cleared**, ensure **`relatedWorkoutSessionId`** is set.
4. **Unique + no shell:** **create** **`ActivitySession`** linked to that **`WorkoutSession`**, WHOOP metrics, **`syncStatus` null**.
5. **Ambiguous or no match:** **create** standalone **`ActivitySession`** with WHOOP metrics and **`syncStatus: needs_review`** (dashboard + `GET /api/whoop/status` expose **`needsReviewActivityCount`**; each sync returns **`needsReview`** count).

**Re-sync:** Existing mappings refresh WHOOP metrics on the same **`ActivitySession`**. **`syncStatus`** is **not** cleared blindly: for strength-like rows it is cleared only when **`relatedWorkoutSessionId`** is already set, or when the matcher finds a **unique** link for this activity (including “this row is the shell”), or when the client clears it via **PATCH**. Standalone unlinked strength stays **`needs_review`** across re-syncs if the match is still ambiguous or missing. Non-strength rows use **`syncStatus: null`**. See **`strengthUnlinkedResyncSyncStatusDecision`** in `lib/whoop/strength-resync-sync-status.ts`.

**Strength detail** stays on **`WorkoutSession` + sets**; WHOOP does not create or infer sets.

### Shared metrics on `ActivitySession`

Most of this **already exists** (`strain`, `avgHeartRate`, `maxHeartRate`, `minHeartRate`, `calories`, `distanceMeters`, `paceSecondsPerKm`, `elevationGainMeters` / `elevationLossMeters`, `zone0Minutes`–`zone5Minutes`).  

**Gaps vs. your target (optional migrations):**

- **`sourceWorkoutId`:** e.g. WHOOP workout id string on `ActivitySession` for quick lookup **or** continue relying on **`WhoopWorkoutMapping.whoopWorkoutId`** as the system of record (preferred to avoid duplication). If you add `sourceWorkoutId`, pair with **`source` = `whoop_api`** semantics.
- **`rawPayloadJson`:** today stored on **`WhoopWorkoutMapping.raw`**; optionally mirror or denormalize—avoid two divergent copies without a clear rule for which wins.

### Idempotency

- **Today:** `@@unique([whoopWorkoutId])` on `WhoopWorkoutMapping` ensures one mapping row per WHOOP workout; sync updates the same `ActivitySession` when linked.
- **Optional:** `@@unique([source, sourceWorkoutId])` on `ActivitySession` **only if** you introduce those columns and want DB-level enforcement; otherwise keep uniqueness on the mapping table to avoid duplicate WHOOP imports.

---

## Phase 3 — Optional rename (`WorkoutSession` → `StrengthSession`)

**Only when Phase 1–2 are stable and a backup exists.**

- Prefer **`@map`** / Prisma `rename` patterns that emit **`ALTER TABLE ... RENAME`** (or equivalent), **never** drop/recreate tables.
- **Reject** any generated migration that **`DROP TABLE`** `WorkoutSession`, `Exercise`, or `ExerciseSet`.
- **Process:** backup → staging → row-count / checksum verification → production.

---

## GPT workflow (high level)

When the user says they finished a run/workout:

1. `GET /api/time` for authoritative “now.”
2. Fetch recent WHOOP workouts (last 3–6 hours)—via existing sync + read or a dedicated query path.
3. Match to `ActivitySession` / `WorkoutSession` using LA date + time window; surface ambiguity to the user.
4. On confirm: upsert **`ActivitySession`**, set **`relatedWorkoutSessionId`** when strength, persist raw WHOOP data (mapping + optional fields), **no duplicate** for same `whoopWorkoutId`.

---

## Testing checklist

- [ ] All **`WorkoutSession`** rows unchanged count after Phase 1 migration script (except optional new nullable FKs if you add any).
- [ ] All **exercises/sets** unchanged.
- [ ] Backfill creates **`ActivitySession`** rows with correct **`relatedWorkoutSessionId`**.
- [x] WHOOP **run** → **`ActivitySession`** only; no stray **`WorkoutSession`**.
- [x] WHOOP **functional fitness** → links when exactly one **`WorkoutSession`** matches LA day + ±2h; otherwise **`syncStatus: needs_review`**.
- [x] Re-import same WHOOP id → **update**, not second activity (via mapping + sync logic).

---

## Summary: preserving the database

| Risk | Mitigation |
|------|------------|
| Lost strength data | Never drop/replace `WorkoutSession` / set tables; only additive columns. |
| Broken links | Use existing **`relatedWorkoutSessionId`**; add reverse FK only with a documented sync rule. |
| Duplicate WHOOP rows | Keep **`WhoopWorkoutMapping`** unique on `whoopWorkoutId`; sync upserts. |
| Validation drift | Add **`strength`** (or use **`other` + modality**) consistently in Zod + OpenAPI. |
| Wrong “day” matching | LA timezone helpers only; no UTC date slicing for user day. |

This revision **intentionally aligns Phase 1 with the schema you already have** (`ActivitySession` → `WorkoutSession`) so you do not introduce a redundant `WorkoutSession.activitySessionId` unless you explicitly want two pointers and a sync invariant.
