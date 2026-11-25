require('dotenv').config();
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
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

const server = http.createServer((request, response) => {
  if (request.url === '/' || request.url === '/health') {
    const healthy = client.isReady();
    response.writeHead(healthy ? 200 : 503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify({ status: healthy ? 'ok' : 'starting' }));
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'Not found' }));
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (command) await command.execute(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('cheaters:')) {
      const [, direction, rawPage] = interaction.customId.split(':');
      const currentPage = Number(rawPage);
      if (!Number.isInteger(currentPage)) return;
      const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
      const { readRecords } = require('./store');
      const records = readRecords()
        .filter(record => record.guildId === interaction.guildId)
        .reverse();
      await interaction.update({
        ...client.commands.get('cheaters').pageEmbed(records, nextPage),
        allowedMentions: { parse: [] },
      });
      return;
    }

    if ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith('altchecker:')) {
      await client.commands.get('altchecker').handleComponent(interaction);
    }
  } catch (error) {
    console.error('Interaction failed:', error);
    if (!interaction.isRepliable()) return;
    const response = { content: 'There was an error handling this interaction.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(console.error);
    } else {
      await interaction.reply(response).catch(console.error);
    }
  }
});

client.once('ready', readyClient => console.log(`Logged in as ${readyClient.user.tag}`));
server.listen(port, '0.0.0.0', () => console.log(`Health server listening on 0.0.0.0:${port}`));

(async () => {
  try {
    await registerCommands();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Bot startup failed. Check DISCORD_TOKEN, CLIENT_ID, GUILD_ID, and the bot application permissions:', error);
    process.exit(1);
  }
})();

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(() => {
    client.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
