# HF Discord Bot

Moderation commands, public Roblox/Discord profile lookups, Bloxlink account-link review, and AI chat.

## Commands

- `/ping` — shows Discord interaction and gateway heartbeat latency.
- `/altchecker` — public Roblox/Discord profile lookup with optional cautious AI notes.
- `/accountchecker user:<member>` — checks a server member's Bloxlink Roblox link, reverse-linked Discord IDs within the configured server, account age, and Roblox banned flag. Signals form an unverified heuristic score, not proof, a probability, or an automated moderation decision.
- `/log-cheater` — log a report with optional alt status.
- `/cheaters` — paginated report list.
- `/removecheater` — removes reports for a user in this server; requires Manage Server.

## Configuration

Set `DISCORD_TOKEN` and `CLIENT_ID`; optionally set `GUILD_ID` for guild command registration. AI uses the existing `OPENAI_API_KEY` and optional `OPENAI_MODEL` (`gpt-4o-mini` by default).

For `/accountchecker`, set `BLOXLINK_API_KEY` and `DISCORD_GUILD_ID` to the server ID authorized for the Bloxlink API. If `DISCORD_GUILD_ID` is unset, the bot falls back to the existing `GUILD_ID`. The bot requests Bloxlink's guild-scoped `/discord-to-roblox` and `/roblox-to-discord` endpoints. Keep the API key secret and ensure Bloxlink is configured for the server.

The bot announces each identifiable deployment in Discord channel `1543612401017159700` (override with `BOT_UPDATE_CHANNEL_ID`). The bot needs View Channel, Send Messages, and Read Message History there. Render's `RENDER_GIT_COMMIT` or CI's `GITHUB_SHA` identifies a release; otherwise set `BOT_UPDATE_ID`. A recent-message marker prevents duplicate announcements on restarts of the same release.

## Render setup

Use Node, build command `npm install`, start command `npm start`; Render supplies `PORT`. Add the environment variables above in the Render dashboard and redeploy. Slash commands are registered automatically at startup.
