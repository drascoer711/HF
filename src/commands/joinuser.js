const { SlashCommandBuilder } = require('discord.js');

const USER_ID = /^\d{1,20}$/;
const GAME_ID = /^[\w-]{1,128}$/;
const ROBLOX_API_HEADERS = {
  'user-agent': 'HF-Discord-Bot/1.0',
  accept: 'application/json',
};

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...ROBLOX_API_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404) return null;
  if (response.status === 429) throw new Error('Roblox is rate-limiting lookups. Please try again shortly.');
  if (!response.ok) throw new Error(`Roblox returned HTTP ${response.status}. Please try again later.`);
  return response.json();
}

async function findRobloxUser(input) {
  const value = input.trim();
  if (USER_ID.test(value)) {
    const profile = await getJson(`https://users.roblox.com/v1/users/${encodeURIComponent(value)}`);
    return profile ? { id: String(profile.id), username: profile.name || value } : null;
  }

  const result = await getJson('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usernames: [value], excludeBannedUsers: false }),
  });
  const user = result?.data?.[0];
  return user ? { id: String(user.id), username: user.name || value } : null;
}

async function getPresence(userId) {
  const result = await getJson('https://presence.roblox.com/v1/presence/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userIds: [Number(userId)] }),
  });
  return result?.userPresences?.[0] || null;
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\`*_{}\[\]()#+\-.!|>~]/g, '\\$&');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joinuser')
    .setDescription('Create a Roblox link to the current game server of a user')
    .addStringOption(option => option
      .setName('roblox-user')
      .setDescription('Roblox username or numeric user ID')
      .setMaxLength(20)
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const input = interaction.options.getString('roblox-user', true).trim();
      const user = await findRobloxUser(input);
      if (!user) {
        await interaction.editReply('I could not find that Roblox user. Check the username or user ID and try again.');
        return;
      }

      const presence = await getPresence(user.id);
      const placeId = String(presence?.placeId || '');
      const gameId = String(presence?.gameId || '');
      if (presence?.userPresenceType !== 2 || !/^\d{1,20}$/.test(placeId) || !GAME_ID.test(gameId)) {
        await interaction.editReply(`**${escapeMarkdown(user.username)}** is not currently in a joinable Roblox game server. They may be offline, in a private/restricted server, or have join access disabled.`);
        return;
      }

      // Use the live place and server instance from Roblox presence, not a guessed/default experience.
      const joinUrl = new URL(`https://www.roblox.com/games/${placeId}`);
      joinUrl.searchParams.set('gameInstanceId', gameId);
      await interaction.editReply({
        content: `**${escapeMarkdown(user.username)}** is currently playing. [Join their server](${joinUrl.toString()})\nRoblox place ID: \`${placeId}\`. Roblox privacy settings and server availability may still prevent joining.`,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error('Joinuser lookup failed:', error);
      await interaction.editReply(`Could not create a join link: ${error.message}`).catch(console.error);
    }
  },
};
