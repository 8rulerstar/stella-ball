# Hive live-spike runbook

## Current state

The project has a browser-to-adapter boundary and a strict three-part verification command. It is intentionally **not marked integrated** until a real Hive Console AppID, data-store public key, and deployed adapter URL are configured. No secret or fake-success implementation is stored in this repository.

## Required console work

1. Create the game project and a Web Login AppID in Hive Console.
2. Register the adapter callback URI and the same URI in the selected IdP (Google is sufficient).
3. Create Game Data Store, copy its public key, and enable that key in App Center for this AppID.
4. Create the daily leaderboard policy for at least `elapsedMs`, `shotsUsed`, and `totalDamage`.
5. Deploy a small server-side adapter that implements the four endpoints documented in [hive/README.md](hive/README.md). Keep `HIVE_APP_SECRET` and the data-store key only in deployment secrets.

## Verification gate

Run the configured `node hive/spike.mjs` command three times. Each execution must complete:

1. game data write → exact value readback;
2. score submission;
3. leaderboard query.

Save the three command outputs in the presentation evidence folder after a real console run. If the gate does not pass after three focused attempts, the documented fallback is login-only single-player submission; do not pretend that a local response is a Hive result.
