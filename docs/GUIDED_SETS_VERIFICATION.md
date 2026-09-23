# Guided set acceptance checks

Use synthetic conversations in GPT Preview; explicitly prohibit real API calls and actual workout writes. Inspect intended action timing and payloads. The database suite separately verifies the real write behavior.

| Scenario | Expected behavior |
| --- | --- |
| Proposal: chest press set 1/3, 40 lb x 12; user: done | Pending 40 x 12; no tool calls; propose set 2 |
| Set 2 proposal 40 x 12; user: only 10 reps | Pending 40 x 10; no save; propose next set |
| Set 3 proposal 40 x 10; user: done | One batch with all three actual sets, each with a stable event ID |
| Proposal 40 x 12; user: used 35 | Confirm 35 x 12 only |
| Proposal 40 x 12; user: I'll use 35 | Revise proposal without marking completion |
| Proposal 40 x 10–12; user: done | Ask actual reps; do not invent 10 or 12 |
| No outstanding set; user: done | Clarify, no invented completion |
| User corrects a pending set | Edit pending values, no write |
| User corrects a saved set | Existing correction operation, no duplicate row |
| Outstanding set 3; user: exercise done | Save only earlier confirmed sets; do not infer set 3 |
| Outstanding set 3; user: done, exercise done | Confirm set 3 and flush once |
| User says next exercise | Save confirmed sets for the exercise being left |
| Alternating a superset | Keep both movements pending until finished; no save on each switch |
| User says save now mid-exercise | Save only confirmed pending sets, continue numbering |
| User says workout done early | Flush all pending confirmed sets, then reconcile/finish/verify |
| Batch save times out | Keep pending data; retry unchanged IDs/payload before correcting |
| Unknown exercise rejected | Retain pending data and obtain approval; no single-set fallback |
| User reports 20x12x3 | Three rows with separate IDs; one batch at the save boundary |

Do not publish instructions that still make routing.md or a global retrieval gate override this workflow. Import the deployed Action schema before publishing the live instructions.

## Verification on 2026-09-23

- Existing suite: 39 tests passed. Disposable PostgreSQL batch suite: 11 tests passed, including concurrent retries and transaction rollback. Lint, TypeScript and production build passed.
- MCP HTTP: verified batch registration, three-set persistence, replay and duplicate-event rejection against the disposable database.
- Production: deployed `dpl_GPTWsg4ZruxaC9HSymeqZAbKM2ux` to `https://workout-bot-virid.vercel.app`. Schema exposes `logExerciseSets`; unauthorized and invalid empty-batch requests were rejected without creating workout data. Vercel error-log query returned no logs.
- GPT editor initially rejected the batch action description for exceeding 300 characters. Shortened it to 234 characters, added a regression assertion and re-imported; the editor accepted the operation without that error.
- Live instructions verified at 7,849 characters including the trailing newline; published with the editor's `GPT actualizado` confirmation. Existing knowledge uploads remain, with explicit precedence for the new guided workflow.
- No-write, multi-turn GPT Preview: 40 lb x 12 proposal -> “Done” -> pending 40 x 12 and next proposal; “Only 10 reps” -> pending 40 x 10; final “Done” -> one intended `logExerciseSets` payload with three rows (40 x 12, 40 x 10, 40 x 12). No API calls were made.
- Separate early-finish simulation included only confirmed sets 1 and 2, excluding proposed set 3. These are simulated conversational checks, not a real workout write through ChatGPT. Real persistence was tested separately through REST and MCP on the isolated database.

## Session-start regression on 2026-09-23

Production logs showed two POST /api/sessions failures (15:11 and 15:12 Pacific): Prisma P2025 from a nonexistent TrainingSlot referenced by planSlotId. Database time, recent-session reads and current-plan reads remained healthy.

Added explicit missing/occupied-slot recovery errors, atomic session/slot writes for REST calls without an event ID, and direct foreign-key assignment so a nested one-to-one connect cannot detach an existing workout. Isolated tests cover missing IDs with and without receipts, corrected retries, valid mapped creation, replay, preservation of occupied slots and concurrent starts. The expanded integration suite passes 12 tests; the existing suite passes 39 tests.
