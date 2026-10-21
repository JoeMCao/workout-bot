# Apple Health weight sync

The setup now covers weight plus OMRON blood pressure and pulse in one Shortcut. Follow [Apple Health sync](APPLE_HEALTH_SYNC.md).

The weight-only endpoints remain supported: `POST /api/body-weight/import` and `GET /api/body-weight`. The importer accepts `{ weight, unit: "lb" | "kg", measuredAt }`; use the dedicated import key. Reads use the coach key. `measuredAt` must be the original Health sample's timestamp with timezone, not the time the Shortcut runs.

If you already installed a weight-only Shortcut, extend or replace it using the combined guide and disable duplicate automations. The same import key now accepts the approved OMRON metrics as well.
