# HF Discord Bot

A Discord.js bot with two slash commands:

- `/log-cheater user:<@user> cheating:<text> proof:<optional text or URL>` — records a report in `cheaters.json`.
- `/cheaters` — lists reports for the current server with pagination buttons.

## Setup

1. Install Node.js 18 or newer and run `npm install`.
2. Set `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID` in your environment (or copy `.env.example` to `.env` for local development).
3. Run `npm start`. The bot automatically registers the commands on startup. You can also run `npm run deploy` manually if desired.

Set `CLIENT_ID` to the **Application ID** from the Discord Developer Portal, not the bot token. Set `GUILD_ID` to the server ID where you want commands to appear immediately. Without `GUILD_ID`, commands register globally and may take a while to show up.

Invite/install the bot in the server with the `bot` and `applications.commands` scopes. Make sure the bot is actually in the same server as the `GUILD_ID` you configured.

## Deploying as a Render Web Service

Configure the Render service with:

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`
- **Health check path:** `/health` (optional)

The app listens on Render's `PORT` environment variable and binds to `0.0.0.0`. Render supplies `PORT` automatically.

Reports are stored locally in `cheaters.json`. Render's filesystem may not persist through restarts/redeploys unless you configure a persistent disk. Attach a disk and set `DATA_FILE` to a path on that disk to keep reports long-term.
