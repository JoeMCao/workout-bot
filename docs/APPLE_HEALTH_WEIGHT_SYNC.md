# Apple Health weight sync

The iPhone reads dated weight samples after the user leaves VeSync and sends them directly to Workout Bot. No third-party export app, subscription, or historical backfill is required. The first run may send recent readings to make retries reliable.

## API

`POST /api/body-weight/import` accepts one sample:

```json
{"weight":180,"unit":"lb","measuredAt":"2026-10-20T07:35:00-07:00"}
```

Use `Authorization: Bearer <WEIGHT_SYNC_KEY>` with a dedicated secret. This key can only write weight; the ordinary coach key cannot import weight. Supply a numeric weight, `kg` or `lb`, and the Health sample's Start Date formatted as ISO 8601 with timezone. Never use Current Date or the sync time. Date-only and timezone-free values are rejected.

The server converts to kg, keeps `measuredAt` separate from first `receivedAt`, and atomically upserts on Apple Health source plus measurement timestamp. Repeated imports do not create duplicates or change first import time; a corrected weight at the same timestamp replaces the value. Deletions in Apple Health are not synchronized.

`GET /api/body-weight?limit=7` uses the existing coach API key and returns `latest` (null before first sync), recent `measurements` (up to 30), and retrieval time. Latest is determined by measurement time, not upload order. MCP exposes `get_body_weight`.

The GPT Action schema exposes `getBodyWeight` in place of `getWhoopBodyMeasurement` to remain within 30 operations. The previous WHOOP REST endpoint and MCP tool remain available. Re-import `/api/openapi` in the existing Custom GPT and publish to enable the new Action. Do not replace unrelated unpublished coaching edits.

## One-time iPhone setup

1. Create a Shortcut named **Sync Weight to Coach**.
2. Add **Find Health Samples**, Type **Weight**, Start Date **in the last 7 days**, Unit **lb** (or kg, matching the request below). Sort by Start Date, latest first, limit 14. If available, filter Source to VeSync. Use individual samples, not daily averages.
3. Add **Repeat with Each** using Health Samples.
4. Inside Repeat, add **Format Date**. Select Repeat Item, tap its variable token, and choose **Start Date**. Set Date Format to **ISO 8601**. Do not leave the input as Current Date.
5. Inside Repeat, add **Get Contents of URL**, URL `https://workout-bot-virid.vercel.app/api/body-weight/import`, Method **POST**.
6. Add header **Authorization**, value `Bearer ` followed by the dedicated weight-sync key from the private setup file. Do not put the key in the URL or share the configured Shortcut publicly.
7. Set Request Body to **JSON**. Add three fields:
   - `weight`: Number; select Repeat Item and its **Value** property.
   - `unit`: Text; `lb` (or `kg` if selected in Find Health Samples).
   - `measuredAt`: Text; select the output of Format Date.
8. For the first test only, add **Show Result** inside Repeat after the request, selecting the request output. Run while unlocked, allow Weight read access and the request to the Workout Bot domain. Verify `ok: true` and compare the returned measurement time and weight with VeSync/Apple Health.
9. Remove **Show Result** after verification so normal runs have no dialogs. An optional failure-only notification can check the response's `ok` field, but is not required for the basic sync.
10. In Shortcuts → **Automation → + → App**, choose **VeSync**, **Is Closed** only, and **Run Immediately** (on older versions, disable Ask Before Running). Select **Sync Weight to Coach**. Turn off Notify When Run if offered and desired.

Is Closed also fires when switching away from VeSync; force-quitting is not required. Let VeSync finish updating before leaving it. If you lock the phone immediately, Apple Health access may fail; the next successful run re-sends the recent window. Delayed VeSync writes are likewise picked up by later runs. No daily confirmation is intended, but phone/network/Health restrictions can interrupt a run. Confirm the first real automation run before treating this as active.

## Validation

`TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/workout_bot_weight_test npm run test:weight` runs real REST/database tests on a disposable local database. Apply migrations first. Tests refuse remote databases and any other database name.

## References

- Apple app trigger: https://support.apple.com/guide/shortcuts/apde31e9638b/ios
- Apple POST JSON requests: https://support.apple.com/guide/shortcuts/apd58d46713f/ios
