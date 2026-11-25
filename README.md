# HF Discord Bot

The bot has moderation slash commands, Roblox/Discord public-profile lookup, and an AI chat assistant.

## AI chat

- DM the bot to chat privately.
- In a server, mention the bot or reply to one of its messages.
- It uses `OPENAI_API_KEY` and the optional `OPENAI_MODEL` (defaults to `gpt-4o-mini`). No new AI environment variables are needed.
- Conversation history is kept separately for each user in each channel and saved to `conversations.json`, alongside the report data. It survives restarts only when that file is on persistent storage. The bot sends up to the latest 40 messages as context; this is persistent recent memory, not literally unlimited memory.
- Addressed messages are sent to the configured OpenAI API for a response. Avoid sharing passwords, tokens, or other sensitive information.

**Discord setup requirement:** In the Discord Developer Portal, open your application → **Bot** → **Privileged Gateway Intents** and enable **Message Content Intent**. The code also requests this intent. Without enabling it, the bot cannot read message text and chat replies will not work. The bot needs to be invited to the server with the `bot` and `applications.commands` scopes.

## Commands

- `/log-cheater user:<ID or mention> cheating:<text> proof:<optional text or URL> alt-status:<optional>` — logs a report for this server.
- `/cheaters` — paginated report list.
- `/removecheater user-id:<ID or mention>` — removes reports for that user in this server; requires **Manage Server**.
- `/altchecker roblox-user:<optional> discord-user-id:<optional>` — public profile details and cautious AI notes, with a follow-up question button. It does not determine whether accounts belong to the same person.

## Deploy on Render Web Service

Use Node, build command `npm install`, start command `npm start`, and set `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`. Keep the existing `OPENAI_API_KEY` and optionally `OPENAI_MODEL` values. Render provides `PORT` automatically; health check path `/health` is optional.

To persist reports and AI conversation memory, attach a persistent disk and set the existing `DATA_FILE` value to a path on that disk, for example `/var/data/cheaters.json`. The conversation file is saved next to it as `/var/data/conversations.json`. Without a persistent disk, Render may discard these files on restart or redeploy.
