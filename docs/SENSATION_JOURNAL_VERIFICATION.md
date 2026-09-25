# Finger sensation journal verification

## Conversation acceptance

Use synthetic, **no-write** conversations in GPT Preview; do not persist fictional symptoms or routines to production. Database and real MCP persistence checks run on the isolated local database instead.

1. A clear report about left/right fingers and normal grip produces `recordSensationCheckIn` with the original description and a stable event ID. No required score or follow-up questionnaire.
2. “Small Iron Neck session, eight rounds” saves one mobility activity with `modality: iron_neck`, those notes, and no invented minutes. “Full version” works without inventing a routine definition.
3. A combined routine-and-sensation report produces two writes; an uncertain write retries its original ID/payload and partial success is disclosed.
4. “I might do Iron Neck” and hypothetical sensation examples produce no writes. An explicit request not to save is respected.
5. At workout start, retrieve sensation history; offer an optional finger check-in only if today's update is absent. Ordinary set confirmations remain batched.
6. A fresh conversation asks about finger changes and retrieves persisted observations and Iron Neck sessions. Preserve uncertainty and differences between hands; missing entries are unknown and chronology is not proof of causation.
7. A correction updates the identified observation, retaining its time unless that time is being corrected. A new later sensation creates another entry.

## Automated checks

- `npm test`: 41 passed, including exact text preservation, validation and LA calendar/DST boundaries.
- `npm run test:sensations` against disposable local `workout_bot_sensation_test`: 9 passed (suite plus 8 scenarios). Covers authentication, malformed requests, verbatim text, backdating, multiple observations/day, timestamps, concurrent/replayed/conflicting writes, routines without duration, history filtering/truncation, corrections, deletion, deleted replay and GPT Action schema contracts.
- Real HTTP MCP checks on the disposable database: tool discovery, creation, replay, fresh stateless retrieval of exact text plus routine, invalid correction/range, correction, deletion and rejected deleted replay passed.
- Production build and lint passed. Public schema contains 30 unique operations; all operation descriptions fit the GPT editor's 300-character limit.

## Release

Release status is recorded after deployment and live GPT verification below.
