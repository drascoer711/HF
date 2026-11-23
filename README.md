# HF Discord Bot

A Discord.js bot with two slash commands:

- `/log-cheater user:<@user> cheating:<text> proof:<optional text or URL>` — records a report in `cheaters.json`.
- `/cheaters` — lists reports for the current server with pagination buttons.

## Setup

1. Install Node.js 18 or newer and run `npm install`.
2. Set `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID` in your environment (or copy `.env.example` to `.env` for local development).
3. Run `npm run deploy` once to register the slash commands, then run `npm start`.

Setting `GUILD_ID` registers commands to that server for faster testing. Without it, commands are registered globally and can take time to appear.

## Deploying as a Render Web Service

This bot includes a small HTTP health server so it can run as a Render **Web Service**. In Render, configure:

- **Runtime:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Environment variables:** `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`
- **Health check path:** `/health` (optional)

The app listens on Render's `PORT` environment variable and binds to `0.0.0.0`. You do not need to set `PORT` manually in Render. For local use, it defaults to `10000`; you can set `PORT` if that port is occupied.

The health endpoint returns HTTP 200 after Discord is connected and HTTP 503 while the bot is starting. The root path `/` provides the same health check.

### Important: report storage

Reports are stored in the local `cheaters.json` file. A Render Web Service's filesystem is not persistent across all redeploys/restarts unless a persistent disk is configured. Attach a persistent disk and set `DATA_FILE` to a file path on that disk before relying on this bot for long-term records. Without persistent storage, reports may be lost when the service restarts or redeploys.
