const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const USER_ID = /^\d{1,20}$/;
const GAME_ID = /^[\w-]{1,128}$/;
const ERROR_CHANNEL_ID = '1543612401017159700';
const ROBLOX_API_HEADERS = {
  'user-agent': 'HF-Discord-Bot/1.0',
  accept: 'application/json',
};

async function getJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...ROBLOX_API_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(4_000),
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

async function logError(interaction, error) {
  try {
    const channel = await interaction.client.channels.fetch(ERROR_CHANNEL_ID);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') return;

    const input = interaction.options.getString('roblox-user', true) || '';
    const details = [
      '**Join-user lookup error**',
      `**Server:** ${interaction.guild?.name || 'Direct message'} (${interaction.guildId || 'none'})`,
      `**User:** ${interaction.user.tag} (${interaction.user.id})`,
      `**Input:** \`${String(input).slice(0, 100).replace(/`/g, '')}\``,
      `**Error:** ${String(error?.stack || error?.message || error).slice(0, 1200)}`,
      `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
    ].join('\n');

    await channel.send({ content: details.slice(0, 1900), allowedMentions: { parse: [] } });
  } catch (logError) {
    console.error('Could not write Joinuser error log:', logError);
  }
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
    try {
      // Acknowledge immediately with a normal ephemeral response so the command
      // does not sit on Discord's loading indicator while Roblox is queried.
      await interaction.reply({ content: 'Looking up that Roblox user and their current game…', ephemeral: true });

      const input = interaction.options.getString('roblox-user', true).trim();
      const user = await findRobloxUser(input);
      if (!user) {
        await interaction.editReply({ content: 'I could not find that Roblox user. Check the username or user ID and try again.' });
        return;
      }

      const presence = await getPresence(user.id);
      const placeId = String(presence?.placeId || '');
      const gameId = String(presence?.gameId || '');
      if (presence?.userPresenceType !== 2 || !/^\d{1,20}$/.test(placeId) || !GAME_ID.test(gameId)) {
        await interaction.editReply({
          content: '',
          embeds: [new EmbedBuilder()
            .setTitle('No joinable Roblox server found')
            .setColor(0xFEE75C)
            .setDescription(`**${user.username}** is not currently in a joinable Roblox game server. They may be offline, in a private/restricted server, or have join access disabled.`)
            .addFields({ name: 'User ID', value: user.id })],
        });
        return;
      }

      const joinUrl = new URL(`https://www.roblox.com/games/${placeId}`);
      joinUrl.searchParams.set('gameInstanceId', gameId);
      await interaction.editReply({
        content: '',
        embeds: [new EmbedBuilder()
          .setTitle('Join Roblox server')
          .setColor(0x57F287)
          .setDescription(`**${user.username}** is currently in a joinable Roblox game server.`)
          .addFields(
            { name: 'Join link', value: `[Open the server in Roblox](${joinUrl.toString()})` },
            { name: 'Roblox place ID', value: placeId, inline: true },
            { name: 'Server instance', value: `\`${gameId}\``, inline: false },
          )
          .setFooter({ text: 'The link must still pass Roblox privacy, friend, and server-availability settings.' })],
      });
    } catch (error) {
      console.error('Joinuser lookup failed:', error);
      const message = error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Could not create a join link: the Roblox lookup timed out. Please try again.'
        : `Could not create a join link: ${error.message || 'unexpected lookup error'}`;

      // Prioritize completing the Discord interaction; logging must never delay the reply.
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message, embeds: [] }).catch(replyError => {
          console.error('Could not send Joinuser error reply:', replyError);
        });
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(replyError => {
          console.error('Could not acknowledge Joinuser interaction:', replyError);
        });
      }
      void logError(interaction, error);
    }
  },
};
