# Workout Buddy private plugin

## Status and rollout

October 26, 2026: OAuth backend deployed, separate Auth0 application/API configured, and the private ChatGPT plugin connected. Coaching package version **1.1.0** is installed with one application and one skill. The existing Custom GPT and key-authenticated clients continue using their current routes. First real workout logging acceptance is still pending.

- [Private Workout Buddy plugin](https://chatgpt.com/plugins/plugin_asdk_app_6adf9b13da448191baf1ae624453c960).
- Auth0 public client ID: `tpc_te8o2jwE4fG8oQ5MXNsgCc`; API ID: `6adf98e3fd095ccf81332552`.
- Registered callback: `https://chatgpt.com/connector_platform_oauth_redirect`.
- Production code: merge commit `8fcc64273012e0c0e39c1bece66ce50d9d6598b9`, deployment `dpl_CxQ9eQXQpoLa5ikjtFF29jRfbdgh`.
- Verified live public discovery returns 200, anonymous MCP requests return a 401 OAuth challenge, and the legacy REST route still rejects anonymous requests. Auth0 consent completed for the owner with both Workout scopes and offline access. The plugin package upload succeeded and displays version 1.1.0.
- ChatGPT read-only acceptance completed: the plugin returned the latest completed strength workout and recent activity with dates and a completed response. The test explicitly prohibited creates, updates, deletes and sync. No synthetic production records were used. Exercise logging and retry acceptance remain for the next real workout.

Reproducible setup sequence:

1. Register a separate **Workout Buddy — ChatGPT** application and **Workout Buddy API** in the existing Auth0 tenant.
2. Add the five `WORKOUT_*` plugin settings below to the existing Workout Bot Vercel project; deploy the tested code.
3. Create a private custom MCP plugin in ChatGPT, register its exact callback in Auth0, and connect the owner's Google account.
4. Add the coaching skill and private references to that registered plugin; verify read-only history retrieval in ChatGPT.
5. Use the plugin for the next real exercise block. Verify one receipt, retry the same IDs safely, and check the saved history. Retire the old GPT only after acceptance.

No new hosting, database, authentication provider or paid plan is required. Auth0's existing account showed **Free, $0** on October 25; do not enable trial-only cross-app SSO or upgrade. Compass retains its separate application, audience, permissions, repository, deployment and database. WHOOP's existing OAuth integration is independent and stays in place.

## Separate authorization

- Tenant: `https://dev-32k7me6q5p2u0gvw.us.auth0.com/`.
- Workout resource/audience: `https://workout-bot-virid.vercel.app/api/plugin/mcp`.
- Auth0 API: RS256; `workout:read` (training/health history), `workout:write` (confirmed logging, corrections, requested deletes, WHOOP imports).
- Auth0 application: third-party Regular Web Application, authorization code with PKCE S256 and refresh tokens, `client_secret_post`.
- Reuse the existing Google connection; pin the same owner's Auth0 `sub` in Workout's environment. Never put the subject, client secret or tokens in Git.
- Use 15-minute access tokens and rotating refresh tokens (30-day idle / 90-day maximum, 10-second overlap), matching the proven Compass configuration. Request `offline_access` so reconnection is not needed every workout.
- Allow only this application's user-delegated access to the two Workout scopes; disable automatic future scope grants, anonymous access and machine-to-machine access. Do not give this client Compass permissions. Require consent and offline access on the API.
- Register only the exact ChatGPT callback shown during setup, without wildcards. The tenant already supports the OAuth `resource` parameter and issuer in authorization responses; do not change shared tenant settings speculatively.

The server verifies signature, issuer, Workout audience, expiry, owner and scopes on every request. Read-only tokens cannot execute mutation callbacks. Compass and API-key tokens are rejected by the OAuth endpoint. Existing `/api/mcp` and REST routes retain key authentication; the OAuth token is not accepted there.

## Vercel configuration

Existing project: `workout-bot`, production domain `workout-bot-virid.vercel.app`.

| Variable | Value |
| --- | --- |
| `WORKOUT_PLUGIN_ENABLED` | `true` only when ready; absent/false fails closed |
| `WORKOUT_MCP_RESOURCE` | `https://workout-bot-virid.vercel.app/api/plugin/mcp` |
| `WORKOUT_OAUTH_ISSUER` | `https://dev-32k7me6q5p2u0gvw.us.auth0.com/` |
| `WORKOUT_OAUTH_JWKS_URL` | `https://dev-32k7me6q5p2u0gvw.us.auth0.com/.well-known/jwks.json` |
| `WORKOUT_OAUTH_OWNER_SUBJECT` | Owner's exact Auth0 user ID; configure privately |

The Workout backend needs no Auth0 client secret; ChatGPT uses it at token exchange. Discovery is public at `/.well-known/oauth-protected-resource`. Authenticated MCP is stateless POST at `/api/plugin/mcp`. GET/DELETE return 405 after authentication. The endpoint bounds JSON to 256 KiB, allows the canonical origin/ChatGPT origin or no Origin header, and disables caching. Preview deployments need their own explicit resource if used for OAuth testing; production tokens are not for previews.

## Private coaching package

The GitHub repository is public. Personal coaching references are deliberately ignored by Git and must stay in a private ChatGPT plugin. The current local package copies the owner's existing `GPT/coach-mcp-instructions.txt` and local `GPT/coaching-policy.md`, preserving daily previews, full active exercise blocks, optional one-set mode, receipt-based logging and health source/date distinctions. Original in-progress GPT files were not changed.

On a fresh checkout, place the approved files at:

- `plugins/workout-buddy/skills/workout-buddy/references/mcp-coaching.md`
- `plugins/workout-buddy/skills/workout-buddy/references/coaching-policy.md`

Use relative links between these references. Packaging fails if either is missing; do not replace them with invented profile facts.

For an initial portable package:

```bash
npm run plugin:package -- --resource=https://workout-bot-virid.vercel.app/api/plugin/mcp --client-id=REGISTERED_PUBLIC_CLIENT_ID
```

For the registered ChatGPT plugin, save only its public identifiers in `plugins/workout-buddy/chatgpt-registration.json`:

```json
{"name":"EXACT_REGISTERED_PLUGIN_NAME","appId":"EXACT_APP_ID","version":"NEXT_VERSION"}
```

Then run `npm run plugin:package -- --chatgpt`. Upload the ZIP to that existing private plugin. It includes the registered app mapping and skill, avoiding a second OAuth connection. The ZIP goes under ignored `dist/`; do not commit or publish it. Keep secrets out of the package.

## Verification and rollback

`npm run test:plugin` uses ephemeral local signing keys, a loopback placeholder database URL and mocked service persistence. It verifies claims, metadata, HTTP boundaries, all 34 tools, write denial, concurrent permission isolation and legacy API-key compatibility. It does not touch Auth0, WHOOP or production records. Also run the production build and targeted lint.

Live acceptance: connect with Google, list tools, retrieve current time/plan/recent history, confirm the returned dates, and check an anonymous request still receives a challenge. Do not seed fake exercises or health records. During the first real workout, confirm one explicit exercise block, verify its saved rows, and ensure repeating “done” does not create another block.

To disable only the new connection, set `WORKOUT_PLUGIN_ENABLED=false` and redeploy, then disconnect/revoke the Workout client if necessary. Legacy clients, Compass and WHOOP settings are independent.

References: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins), [OAuth authentication](https://developers.openai.com/plugins/build/auth), [Connect to ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt).
