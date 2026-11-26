const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const BASE_URL = 'https://api.blox.link/v4/public';
const API_KEY = process.env.BLOXLINK_API_KEY;
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const cache = new Map();
const CACHE_TTL_MS = 60_000;
const ROBLOX_ID = /^\d{1,20}$/;

async function request(endpoint) {
  if (!API_KEY) throw new Error('Missing BLOXLINK_API_KEY environment variable.');
  if (!GUILD_ID) throw new Error('Missing DISCORD_GUILD_ID (or GUILD_ID) for the Bloxlink guild API.');

  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { authorization: API_KEY, accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 429) throw new Error('Bloxlink API rate limit reached. Try again shortly.');

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Bloxlink API error ${response.status}: ${String(data.error || 'Unknown error').slice(0, 250)}`);
  }
  cache.set(endpoint, { data, time: Date.now() });
  return data;
}

function extractRobloxId(data) {
  const candidates = [
    data?.robloxID,
    data?.robloxId,
    data?.roblox_id,
    data?.user?.robloxID,
    data?.user?.robloxId,
    data?.user?.primaryAccount,
    data?.primaryAccount,
  ];
  const value = candidates.find(candidate => candidate !== undefined && candidate !== null);
  return value !== undefined && ROBLOX_ID.test(String(value)) ? String(value) : null;
}

function extractDiscordIds(data) {
  const candidates = data?.discordIDs || data?.discordIds || data?.discord_ids ||
    data?.user?.discordIDs || data?.user?.discordIds || data?.user?.discord_ids || [];
  if (!Array.isArray(candidates)) return [];
  return [...new Set(candidates.map(String).filter(id => /^\d{17,20}$/.test(id)))];
}

async function getRobloxAccount(discordId) {
  return request(`/guilds/${encodeURIComponent(GUILD_ID)}/discord-to-roblox/${encodeURIComponent(discordId)}`);
}

async function getLinkedDiscordAccounts(robloxId) {
  return request(`/guilds/${encodeURIComponent(GUILD_ID)}/roblox-to-discord/${encodeURIComponent(robloxId)}`);
}

async function getRobloxUser(robloxId) {
  const response = await fetch(`https://users.roblox.com/v1/users/${encodeURIComponent(robloxId)}`, {
    signal: AbortSignal.timeout(8_000),
    headers: { 'user-agent': 'HF-Discord-Bot/1.0', accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Roblox API returned HTTP ${response.status}.`);
  const user = await response.json();
  return {
    id: String(user.id),
    username: user.name || 'Unknown',
    displayName: user.displayName || user.name || 'Unknown',
    description: String(user.description || '').slice(0, 250),
    created: user.created,
    isBanned: user.isBanned === true,
    profileUrl: `https://www.roblox.com/users/${encodeURIComponent(user.id)}/profile`,
  };
}

function analyzeAccount(user, linkedAccounts) {
  const indicators = [];
  let score = 0;
  const createdTime = Date.parse(user.created);
  const ageDays = Number.isFinite(createdTime)
    ? Math.max(0, Math.floor((Date.now() - createdTime) / 86_400_000))
    : null;

  if (ageDays !== null && ageDays < 7) {
    score += 35;
    indicators.push({ name: 'Very new Roblox account', points: 35, detail: `Created ${ageDays} days ago` });
  } else if (ageDays !== null && ageDays < 30) {
    score += 20;
    indicators.push({ name: 'New Roblox account', points: 20, detail: `Created ${ageDays} days ago` });
  } else if (ageDays !== null && ageDays < 90) {
    score += 10;
    indicators.push({ name: 'Relatively new Roblox account', points: 10, detail: `Created ${ageDays} days ago` });
  }

  const discordIds = extractDiscordIds(linkedAccounts);
  if (discordIds.length > 1) {
    const points = Math.min((discordIds.length - 1) * 25, 50);
    score += points;
    indicators.push({
      name: 'Multiple linked Discord accounts',
      points,
      detail: `${discordIds.length} Discord accounts linked to this Roblox account in this server`,
    });
  }

  if (user.isBanned === true) {
    score += 40;
    indicators.push({ name: 'Roblox banned flag', points: 40, detail: 'Roblox profile reports this account as banned' });
  }

  score = Math.min(score, 100);
  return {
    score,
    rating: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    ageDays,
    indicators,
    linkedDiscordIds: discordIds,
  };
}

async function investigate(discordId) {
  const linked = await getRobloxAccount(discordId);
  const robloxId = extractRobloxId(linked);
  if (!robloxId) return { linked: false };

  const [user, reverseLinks] = await Promise.all([
    getRobloxUser(robloxId),
    getLinkedDiscordAccounts(robloxId),
  ]);
  if (!user) return { linked: false };
  return { linked: true, user, analysis: analyzeAccount(user, reverseLinks) };
}

function makeEmbed(targetUser, result) {
  if (!result.linked) {
    return new EmbedBuilder()
      .setTitle('Account check')
      .setColor(0xFEE75C)
      .setDescription(`Bloxlink did not return a linked Roblox account for <@${targetUser.id}> in this server. They may not be linked through Bloxlink, or the API may not expose a link.`);
  }

  const { user, analysis } = result;
  const signals = analysis.indicators.length
    ? analysis.indicators.map(item => `• **${item.name}** (+${item.points}): ${item.detail}`).join('\n')
    : 'No configured review signals were found.';
  const linkedDiscords = analysis.linkedDiscordIds.length
    ? analysis.linkedDiscordIds.map(id => `<@${id}>`).join(', ')
    : 'No linked Discord IDs returned.';
  const age = analysis.ageDays === null ? 'Unknown' : `${analysis.ageDays} days`;

  return new EmbedBuilder()
    .setTitle('Account review signals')
    .setColor(analysis.score >= 70 ? 0xED4245 : analysis.score >= 40 ? 0xFEE75C : 0x57F287)
    .setDescription(
      `Bloxlink reports this Roblox account linked to <@${targetUser.id}> in this server.\n` +
      '**Important:** These are unverified review signals, not proof of alternate-account use or wrongdoing. The score is a simple heuristic, not a probability; review context and avoid taking action from the score alone.',
    )
    .addFields(
      {
        name: 'Roblox account',
        value: `**Username:** ${user.username}\n**Display name:** ${user.displayName}\n**ID:** ${user.id}\n**Age:** ${age}\n**Roblox banned flag:** ${user.isBanned ? 'Yes' : 'No'}\n[Profile](${user.profileUrl})`,
      },
      { name: `Review score: ${analysis.score}/100 (${analysis.rating})`, value: signals.slice(0, 1024) },
      { name: 'Discord accounts linked to this Roblox account in this server', value: linkedDiscords.slice(0, 1024) },
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accountchecker')
    .setDescription('Review Bloxlink account links and cautious account signals for a server member')
    .addUserOption(option => option
      .setName('user')
      .setDescription('Server member to check')
      .setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user', true);
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Use `/accountchecker` in a server where the bot and Bloxlink are configured.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await investigate(targetUser.id);
      await interaction.editReply({
        embeds: [makeEmbed(targetUser, result)],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error('Accountchecker failed:', error);
      await interaction.editReply({ content: `Account check failed: ${error.message}` }).catch(console.error);
    }
  },
};
