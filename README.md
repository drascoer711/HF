# HF Discord Bot

A Discord.js bot with two slash commands:

- `/log-cheater user:<@user> reason:<text> proof:<url or text>` — records a cheater report in `cheaters.json`
- `/cheaters` — lists reports with pagination buttons

## Setup

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`.
4. Run `npm run deploy` to register slash commands.
5. Run `npm start`.

For faster testing, set `GUILD_ID`. Omit it to register commands globally.
