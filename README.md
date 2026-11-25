# HF Discord Bot

A Discord.js bot with slash commands:

- `/log-cheater user:<ID or mention> cheating:<text> proof:<optional text or URL> alt-status:<optional>` — records a report in the current server.
- `/cheaters` — lists reports for the current server with pagination buttons.
- `/removecheater user-id:<ID or mention>` — removes all reports for that user in the current server. Requires **Manage Server** permission.
- `/altchecker roblox-user:<optional> discord-user-id:<optional>` — fetches available public Roblox and/or Discord profile fields and gives cautious AI notes. Use **Ask a follow-up** to ask another question about the same public profile data.

## Privacy and interpretation

Altchecker only uses public profile information returned by the platforms and does not access private messages, private account data, or hidden records. It does **not** determine whether two accounts belong to the same person or declare an account to be an alt: public profile data cannot reliably prove account ownership. AI notes are fallible context, not evidence or a moderation verdict. Lookup replies and follow-ups are ephemeral and visible only to the command user. Follow-up data is held in memory for up to 10 minutes and is not written to the report store.

AI analysis is optional. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`) to enable it. Without a key, profile lookups still work and the bot displays a notice instead of AI analysis. Review the AI provider's data policies before enabling it; the fetched public profile fields and follow-up question are sent to the configured provider for analysis.

## Setup

1. Install Node.js 18 or newer and run `npm install`.
2. Set `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID` in your environment (or copy `.env.example` to `.env` for local development). Add the AI variables only if enabling AI.
3. Run `npm start`. The bot automatically registers slash commands on startup.

For user ID options, paste the Discord ID or mention. To copy an ID, enable Developer Mode in Discord, then use **Copy User ID**. `CLIENT_ID` is the Application ID from the Discord Developer Portal. `GUILD_ID` is the server ID where commands should appear immediately; without it, global registration can take time.

Invite/install the bot in the server with the `bot` and `applications.commands` scopes. Make sure the bot is in the server matching `GUILD_ID`.

## Deploying as a Render Web Service

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** `DISCORD_TOKEN`, `CLIENT_ID`, optionally `GUILD_ID`, and optionally `OPENAI_API_KEY` / `OPENAI_MODEL`
- **Health check path:** `/health` (optional)

The app listens on Render's `PORT` environment variable and binds to `0.0.0.0`. Render supplies `PORT` automatically.

Reports are stored locally in `cheaters.json`. Render's filesystem may not persist through restarts/redeploys unless you configure a persistent disk. Attach a disk and set `DATA_FILE` to a path on that disk to keep reports long-term.
