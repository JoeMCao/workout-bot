# Apple Health sync: weight, OMRON blood pressure and pulse

One iPhone Shortcut uploads recent samples when you leave VeSync or OMRON Connect. No additional app or subscription is needed. This is intended to fit normal app use without a daily confirmation. Apple Health access can fail if the phone is locked; network errors and delayed source-app writes can also delay a reading. The next successful run retries the recent window.

## One-time iPhone setup

Create a Shortcut named **Sync Health to Coach** with four successive Find/Repeat blocks. Each block uses **Find Health Samples**, **Repeat with Each**, **Format Date**, and **Get Contents of URL**. Build and test one block before duplicating it.

| Block | Health sample type | Source filter | Unit | Upload URL path |
| --- | --- | --- | --- | --- |
| Weight | Weight | VeSync | lb (or kg) | `/api/body-weight/import` |
| Systolic | Systolic Blood Pressure | OMRON Connect's actual source name | mmHg | `/api/health-measurements/import` |
| Diastolic | Diastolic Blood Pressure | Same OMRON source | mmHg | `/api/health-measurements/import` |
| Pulse | Heart Rate | Same OMRON source | count/min (bpm) | `/api/health-measurements/import` |

Use **Heart Rate**, not Resting Heart Rate. The OMRON source filter is required for the three OMRON blocks; otherwise Apple Watch or WHOOP heart-rate samples could be mislabeled. UI labels can vary by iOS version. If the source filter or a required sample type is missing, inspect the actual action before enabling the automation.

For each block:

1. **Find Health Samples:** choose the table's type, source and unit. Start Date **in the last 7 days**; sort by Start Date, **Latest First**. Limit **3** for each type. Keeping each run to at most 12 uploads makes the app-close automation shorter. This prioritizes ongoing readings and retries the newest three samples per type; it is not a complete history import.
2. **Repeat with Each:** input = that block's Health Samples.
3. Inside Repeat, add **Format Date**. Input = **Repeat Item → Start Date**, Date Format = **ISO 8601**. Never use Current Date. Preserve the recorded seconds and timezone; do not format to just a day or minute.
4. Inside Repeat, add **Get Contents of URL**. Base URL = `https://workout-bot-virid.vercel.app`, plus the table's path. Method = **POST**. Header **Authorization** = `Bearer ` plus the dedicated import key from the private setup file. The same key works for all four blocks.
5. Request Body = **JSON**. Use the fields below. Numeric fields must be Number, not Text. Use Repeat Item's **Value** property, not a daily average.

Weight fields:

| Key | JSON type | Value |
| --- | --- | --- |
| `weight` | Number | Repeat Item → Value |
| `unit` | Text | `lb` (or `kg`, matching Find Health Samples) |
| `measuredAt` | Text | Format Date output |

OMRON fields (three separate blocks):

| Key | JSON type | Value |
| --- | --- | --- |
| `metric` | Text | `systolic`, `diastolic`, or `pulse`, matching this block |
| `value` | Number | Repeat Item → Value |
| `unit` | Text | `mmHg` for pressure; `bpm` for pulse |
| `sourceName` | Text | Exact OMRON source name selected in Find, e.g. `OMRON connect`. Use the same name in all three OMRON blocks. |
| `measuredAt` | Text | Format Date output |

Do not copy the example numbers below as real readings. Do not share a configured Shortcut containing the private key.

## Verify once, then automate

Temporarily add **Show Result** after each request within Repeat. Run while unlocked and grant the Shortcut access to Weight, Systolic Blood Pressure, Diastolic Blood Pressure and Heart Rate, plus permission to connect to Workout Bot. Check `ok: true`. The first pressure component may return the other component as null; it becomes complete only after both arrive.

Check one real reading from each device against Apple Health and the combined receiver: weight and units, both BP values, pulse, source, and measurement time. In particular, verify that the OMRON systolic and diastolic samples have exactly the same recorded time. Shortcuts does not send the HealthKit correlation ID; the receiver's exact-source/time match must be verified against the actual OMRON export. Mismatches remain incomplete rather than being paired by proximity.

Remove **Show Result** after testing. In Shortcuts → **Automation → + → App**, select **VeSync and OMRON Connect**, **Is Closed**, **Run Immediately** (older versions: turn off Ask Before Running). Choose **Sync Health to Coach**. If the picker only supports one app, create two automations pointing to the same Shortcut. Turn off Notify When Run if offered and desired. Avoid duplicating an existing weight-only automation.

Switching away from an app counts as closing; force-quitting is unnecessary. Let the device app finish updating before leaving it. Immediately locking the phone may prevent Health reads. Successful runs retry the newest three samples per type within the recent window, so an interrupted or late write can be recovered while it remains among those samples, without duplicate records. More than three missed readings of one type require a manual catch-up if you want all of them. Confirm the first actual automated upload before considering sync active.

## Coach access

`GET /api/health-measurements?limit=7` uses the existing coach API key and returns separate `weight`, `bloodPressure` and `pulse` sections, each with latest/recent readings. A missing latest is null. `bloodPressure.incompleteCount` counts stored unmatched components. Histories are capped at 30 per metric.

MCP: `get_health_measurements`. GPT Action: `getHealthMeasurements`. Re-import `https://workout-bot-virid.vercel.app/api/openapi` into the existing Custom GPT and publish the Action update. The combined read replaces the weight-only Action to stay within 30 operations; the weight-only REST/MCP interfaces and legacy WHOOP body-measurement interfaces remain available. Preserve unrelated unpublished coaching instructions.

The coach must use each reading's `measuredAt`. `receivedAt` is first import time; `fetchedAt` is query time. Pulse is an OMRON spot measurement, not WHOOP resting heart rate. It is returned separately and is not assumed to belong to a BP reading. This integration stores and retrieves measurements; it does not add interpretation, alerts or dashboards.

## Receiver contract

Weight retains its existing API. OMRON import accepts one component/sample:

```json
{"metric":"systolic","value":120,"unit":"mmHg","sourceName":"OMRON connect","measuredAt":"2026-10-20T07:35:00-07:00"}
```

Allowed metrics: systolic, diastolic, pulse. Allowed OMRON source names must start with the word OMRON. The source is supplied by the authenticated Shortcut, not independently verified by the backend. Timestamps require ISO 8601 with timezone; future timestamps beyond five minutes are rejected. Values must be positive finite numbers no greater than 500; these are input bounds, not clinical thresholds.

The existing `WEIGHT_SYNC_KEY` environment variable now authorizes both import routes; its name is retained to avoid changing an installed key. It does not authorize coach reads or any workout operations. Ordinary coach credentials cannot import measurements.

BP components are atomically upserted by exact source name and timestamp. Each update touches only one component. Only complete pairs appear in coach reads, with `pairingMethod: exact_source_and_timestamp`. Pulse is independently deduplicated by source and timestamp. Corrections replace the value without changing first import time. Deletions in Apple Health are not synchronized.

## Verification

Use a disposable local database named `workout_bot_health_test`, apply migrations, then run `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55441/workout_bot_health_test npm run test:health-sync`. Tests reject remote databases and other database names. Coverage includes source/unit/time validation, partial BP uploads, concurrency, source/time mismatches, retries, corrections, pulse separation, coach auth and Action count.

## References

- [Apple app automation triggers](https://support.apple.com/guide/shortcuts/apde31e9638b/ios)
- [Apple POST JSON requests](https://support.apple.com/guide/shortcuts/apd58d46713f/ios)
- [Apple blood pressure correlation](https://developer.apple.com/documentation/healthkit/hkcorrelationtypeidentifier/bloodpressure)
