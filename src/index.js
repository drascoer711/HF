require('dotenv').config();
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require('discord.js');

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required. Add it in your Render environment variables.');
}
if (!process.env.CLIENT_ID) {
  throw new Error('CLIENT_ID is required. Set it to the Discord application ID.');
}

const port = Number.parseInt(process.env.PORT || '10000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port number.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});
client.commands = new Collection();

const commandDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandDir).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandDir, file));
  client.commands.set(command.data.name, command);
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, {
    body: [...client.commands.values()].map(command => command.data.toJSON()),
  });
  console.log(`Registered ${client.commands.size} slash commands ${process.env.GUILD_ID ? `in guild ${process.env.GUILD_ID}` : 'globally'}.`);
}

const UPDATE_CHANNEL_ID = process.env.BOT_UPDATE_CHANNEL_ID || '1543612401017159700';
const UPDATE_REPOSITORY = process.env.GITHUB_REPOSITORY || process.env.BOT_UPDATE_REPOSITORY || 'drascoer711/HF';

async function getReleaseDetails(releaseId) {
  if (process.env.BOT_UPDATE_NOTES?.trim()) {
    return { summary: process.env.BOT_UPDATE_NOTES.trim().slice(0, 900), files: [] };
  }
  if (!/^[a-f0-9]{7,64}$/i.test(releaseId)) return null;
  try {
    const response = await fetch(`https://api.github.com/repos/${UPDATE_REPOSITORY}/commits/${releaseId}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'HF-Discord-Bot/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    const commit = await response.json();
    return {
      summary: String(commit.commit?.message || '').trim().slice(0, 900),
      files: Array.isArray(commit.files) ? commit.files.map(file => file.filename).filter(Boolean).slice(0, 12) : [],
    };
  } catch (error) {
    console.warn('Could not load deployment change details from GitHub:', error.message);
    return null;
  }
}

async function announceDeployment() {
  const releaseId = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || process.env.BOT_UPDATE_ID;
  if (!releaseId) {
    console.log('Skipping update announcement: set RENDER_GIT_COMMIT, GITHUB_SHA, or BOT_UPDATE_ID to identify this release.');
    return;
  }
  try {
    const channel = await client.channels.fetch(UPDATE_CHANNEL_ID);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') return;

    const marker = `HF-BOT-UPDATE:${releaseId}`;
    const recent = await channel.messages.fetch({ limit: 50 });
    if (recent.some(message => message.author.id === client.user.id && message.content.includes(marker))) return;

    const details = await getReleaseDetails(releaseId);
    const shortReleaseId = releaseId.slice(0, 12);
    const lines = [
      `**HF bot update deployed** (${shortReleaseId})`,
      details?.summary ? `\n**Changes**\n${details.summary}` : '\n**Changes**\nDetailed commit notes were unavailable for this deployment.',
    ];
    if (details?.files?.length) lines.push(`\n**Files updated**\n${details.files.map(file => `• \`${file}\``).join('\n')}`);
    lines.push(`\n**Registered commands:** ${[...client.commands.keys()].map(name => `/${name}`).join(', ') || 'none'}`);
    lines.push(`\n||${marker}||`);

    await channel.send({ content: lines.join('\n').slice(0, 1950), allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('Could not announce bot deployment:', error);
  }
}

async function logInteractionError(interaction, error) {
  if (interaction.commandName === 'joinuser') return;
  try {
    const channel = await client.channels.fetch(UPDATE_CHANNEL_ID);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') return;
    const details = `**Interaction error**\n**Command:** /${interaction.commandName || 'unknown'}\n**Server:** ${interaction.guildId || 'DM'}\n**User:** ${interaction.user?.tag || 'unknown'} (${interaction.user?.id || 'unknown'})\n**Error:** ${String(error?.message || error).slice(0, 800)}`;
    await channel.send({ content: details.slice(0, 1900), allowedMentions: { parse: [] } });
  } catch (logError) {
    console.error('Could not write interaction error log:', logError);
  }
}

const server = http.createServer((request, response) => {
  if (request.url === '/' || request.url === '/health') {
    const healthy = client.isReady();
    response.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ status: healthy ? 'ok' : 'starting' }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

async function isReplyToBot(message) {
  if (!message.reference?.messageId) return false;
  try {
    const referenced = await message.channel.messages.fetch(message.reference.messageId);
    return referenced.author.id === client.user.id;
  } catch {
    return false;
  }
}

async function sendInChunks(message, text) {
  const chunks = text.match(/[\s\S]{1,1900}/g) || ['I could not produce a response.'];
  for (let i = 0; i < chunks.length; i += 1) {
    const options = { content: chunks[i], allowedMentions: { parse: [] } };
    if (i === 0) await message.reply(options);
    else await message.channel.send(options);
  }
}

client.on('messageCreate', async message => {
  try {
    if (message.author.bot || message.webhookId || !client.user) return;
    const isDm = !message.guild;
    const isMention = message.mentions.users.has(client.user.id);
    const isBotReply = await isReplyToBot(message);
    if (!isDm && !isMention && !isBotReply) return;

    const prompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    if (!prompt) {
      await message.reply({ content: 'Hi! Mention me with a question, reply to one of my messages, or send me a DM.', allowedMentions: { parse: [] } });
      return;
    }

    const conversationKey = `${message.guildId || 'dm'}:${message.channelId}:${message.author.id}`;
    await message.channel.sendTyping().catch(() => {});
    const { getReply } = require('./ai-chat');
    const answer = await getReply(conversationKey, prompt);
    await sendInChunks(message, answer);
  } catch (error) {
    console.error('AI message response failed:', error);
    await message.reply({
      content: `I couldn't answer right now: ${error.message}`.slice(0, 1900),
      allowedMentions: { parse: [] },
    }).catch(() => {});
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      else await interaction.reply({ content: 'That command is not available in this deployment.', ephemeral: true });
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('cheaters:')) {
      const [, direction, rawPage] = interaction.customId.split(':');
      const currentPage = Number(rawPage);
      if (!Number.isInteger(currentPage)) return;
      const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      const { readRecords } = require('./store');
      const records = readRecords().filter(record => record.guildId === interaction.guildId).reverse();
      await interaction.update({ ...client.commands.get('cheaters').pageEmbed(records, nextPage), allowedMentions: { parse: [] } });
      return;
    }

    if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith('altchecker:')) {
      await client.commands.get('altchecker').handleComponent(interaction);
    }
  } catch (error) {
    console.error('Interaction failed:', error);
    await logInteractionError(interaction, error);
    if (!interaction.isRepliable()) return;
    const reply = { content: 'There was an error handling this interaction.', ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(reply).catch(console.error);
    else await interaction.reply(reply).catch(console.error);
  }
});

client.once('ready', async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  await announceDeployment();
});
server.listen(port, '0.0.0.0', () => console.log(`Health server listening on 0.0.0.0:${port}`));

(async () => {
  try {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Bot startup failed. Check DISCORD_TOKEN, CLIENT_ID, GUILD_ID, and bot permissions:', error);
    process.exit(1);
  }
})();

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(() => { client.destroy(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
