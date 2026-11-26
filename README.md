# HF Discord Bot

Moderation commands, public Roblox/Discord profile lookup, and an AI chat assistant.

## Commands

- `/ping` — shows Discord interaction and gateway heartbeat latency.
- `/altchecker` — choose a Discord user directly or enter a Discord ID/mention; optionally include a Roblox username or numeric ID. It displays public profile fields immediately, then adds cautious AI notes when available. It cannot determine whether accounts belong to the same person.
- `/log-cheater` — log a report with optional alt status.
- `/cheaters` — paginated report list.
- `/removecheater` — removes reports for a user in this server; requires Manage Server.

The bot uses `OPENAI_API_KEY` and optional `OPENAI_MODEL` (defaults to `gpt-4o-mini`). AI analysis is best-effort; profile results are shown even if the AI API is slow or unavailable.

## Render setup

Use Node, build command `npm install`, start command `npm start`, and set `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`. Keep the existing AI environment variables. Render supplies `PORT` automatically.

After merging and redeploying, restart Discord or re-open slash command suggestions if `/ping` or the new `/altchecker` Discord-user option does not appear. For fast command updates, set a correct `GUILD_ID`.
