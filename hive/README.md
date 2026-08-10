# Hive integration boundary

This folder keeps browser code, credentials, and the live verification command separate. The static GitHub Pages game loads `prism-hive-client.js`; it can send game results only to a server-side adapter. Hive keys and app secrets must never be committed or exposed to the browser.

## Browser contract

Deploy an adapter with four endpoints:

- `GET /login?returnUrl=` — starts Hive Web Login V1 and returns to the supplied game URL after verification.
- `POST /spike/write-read` — writes a supplied key/value to the Hive game data store and reads it back in the same request.
- `POST /runs` — accepts `{ stage, party, shotsUsed, totalDamage, elapsedMs }` and records the daily result.
- `GET /leaderboard?metric=` — returns the ordered daily results for `elapsedMs`, `shotsUsed`, or `totalDamage`.

The browser receives only the adapter URL through `window.PRISM_HIVE_CONFIG`; authentication keys, game data store public key, and provider credentials remain deployment secrets.

## Live spike

1. In Hive Console, create the Web Login AppID and register the deployed callback URI.
2. Create and enable Game Data Store for the same game, then place its public key in the adapter environment.
3. Configure one daily leaderboard with the desired reset policy.
4. Copy `hive/.env.example` to an untracked local env file and supply `HIVE_PROXY_URL`.
5. Run `node hive/spike.mjs`.

The command fails on any non-2xx response and only succeeds when write→read returns the exact nonce, then a score write and leaderboard read both complete. This is intentional: a local fallback must never be mistaken for a Hive integration test.

Official references: [Web Login V1](https://developers.hiveplatform.ai/en/v4.25.2.0/api/hive-server-api/web-login/getting-started/) and [Game Data Store](https://developers.hiveplatform.ai/en/v4.25.2.0/operation/game-data-store/).
