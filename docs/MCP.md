# Workout Bot MCP

The workout bot exposes a stateless Streamable HTTP MCP server at:

```text
https://<deployment-host>/api/mcp
```

The MCP endpoint is the canonical interface for the Mac mini agent and Compass. The existing REST/OpenAPI interface remains available for the phone GPT Action during the compatibility period.

## Authentication

MCP uses the same single-user bearer key as the REST API:

```http
Authorization: Bearer $WORKOUT_API_KEY
```

`WORKOUT_API_KEY` belongs only in the Mac mini agent's environment or secret configuration. WHOOP OAuth is separate: WHOOP client credentials and encrypted tokens remain server-side and are never returned by MCP.

## Mac mini client configuration

For a client that supports Streamable HTTP, configure the deployed URL and bearer token in the Mac mini agent's secret/configuration store. The exact file is client-specific; the shape is generally:

```json
{
  "mcpServers": {
    "workout-bot": {
      "url": "https://<deployment-host>/api/mcp",
      "headers": {
        "Authorization": "Bearer ${WORKOUT_API_KEY}"
      }
    }
  }
}
```

Do not commit the expanded token or a local `.env` file.

## Tool groups

Coach tools are the workout/session/history/weekly-plan tools. Compass tools are activity/recovery/WHOOP tools. The server does not maintain a Coach or Compass mode; the client controls its tool allowlist.

For planning, call `get_training_context` or `get_current_week_plan` before recommending a workout. Save an approved plan with `save_training_plan`; it stores dated focus slots and exercise names only. Pass the selected slot's ID as `planSlotId` to `start_workout_session`. Actual reps and weights remain in `ExerciseSet` rows and should be chosen from exercise history plus current readiness.

Writes that create sessions, sets, or activities require a unique `clientEventId`. The response includes a receipt with the persisted entity ID. Retrying the same event and payload returns `status: "replayed"`; reusing an event ID with different data fails without mutating the database.

WHOOP synchronization is explicit. `get_training_context` and `get_recovery_context` read persisted WHOOP data but never trigger a sync. After calling `sync_whoop_workouts` or `sync_whoop_recovery`, call the read tool again.

WHOOP workouts create or update `ActivitySession` records. They never create exercise sets.

## Local verification

With `WORKOUT_API_KEY` and `DATABASE_URL` set, start the app and connect an MCP Inspector or another Streamable HTTP client to `http://localhost:3000/api/mcp`. Verify that:

1. A request without the bearer key returns `401`.
2. An authenticated client can initialize and list tools.
3. A session and set write return receipts.
4. Retrying the same event returns `replayed` and does not add a second row.
