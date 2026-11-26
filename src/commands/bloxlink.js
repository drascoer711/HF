const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const DISCORD_ID = /^\d{17,20}$/;
const ROBLOX_ID = /^\d{1,20}$/;

async function getLinkedRobloxId(discordId) {
  const apiKey = process.env.BLOXLINK_API_KEY;
  if (!apiKey) {
    throw new Error('Bloxlink lookup is not configured. Add BLOXLINK_API_KEY to the bot environment.');
  }

  const response = await fetch(
    `https://api.blox.link/v4/public/discord-to-roblox/${encodeURIComponent(discordId)}`,
    {
      method: 'GET',
      headers: {
        authorization: apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (response.status === 404) return null;
  if (response.status === 401 || response.status === 403) {
    throw new Error('Bloxlink rejected the API key or it lacks permission. Check BLOXLINK_API_KEY.');
  }
  if (response.status === 429) throw new Error('Bloxlink rate limit reached. Try again shortly.');
  if (!response.ok) throw new Error(`Bloxlink returned HTTP ${response.status}. Try again later.`);

  const result = await response.json();
  // The documented public API response uses user.primaryAccount; tolerate
  // user.robloxId as well. Validate before building a Roblox profile URL.
  const linkedId = result?.user?.primaryAccount ?? result?.user?.robloxId ?? result?.robloxId;
  if (!linkedId || !ROBLOX_ID.test(String(linkedId))) return null;
  return String(linkedId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bloxlink')
    .setDescription('Look up a Discord user’s Roblox account linked through Bloxlink')
    .addUserOption(option => option
      .setName('user')
      .setDescription('Discord user to look up')
      .setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    await interaction.deferReply({ ephemeral: true });

    try {
      const robloxId = await getLinkedRobloxId(user.id);
      if (!robloxId) {
        await interaction.editReply({
          content: `Bloxlink did not return a linked Roblox account for **${user.username}**. This may mean no account is linked or the lookup is unavailable.`,
        });
        return;
      }

      const profile = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(robloxId)}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'user-agent': 'HF-Discord-Bot/1.0' },
      });
      let username = null;
      if (profile.ok) {
        const details = await profile.json();
        username = details.name || null;
      }

      const embed = new EmbedBuilder()
        .setTitle('Bloxlink account lookup')
        .setColor(0x5865F2)
        .setDescription(`Bloxlink returned a Roblox account linked to **${user.username}**. This reflects Bloxlink’s link data only; it does not prove account ownership or identify alternate accounts.`)
        .addFields({
          name: 'Linked Roblox account',
          value: `${username ? `**Username:** ${username}\n` : ''}**Roblox user ID:** ${robloxId}\n[View Roblox profile](https://www.roblox.com/users/${robloxId}/profile)`,
        });

      await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('Bloxlink command failed:', error);
      await interaction.editReply({ content: `Bloxlink lookup failed: ${error.message}` }).catch(console.error);
    }
  },
};
