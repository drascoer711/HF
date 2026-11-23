require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandDir = path.join(path.join(__dirname, 'commands'));
for (const file of fs.readdirSync(commandDir).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandDir, file));
  client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const response = { content: 'There was an error executing this command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('cheaters:')) {
    const [, direction, rawPage] = interaction.customId.split(':');
    const currentPage = Number(rawPage);
    const nextPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

    const { readRecords } = require('./store');
    const records = readRecords()
      .filter(record => record.guildId === interaction.guildId)
      .reverse();

    const cheatersCommand = client.commands.get('cheaters');
    await interaction.update(cheatersCommand.pageEmbed(records, nextPage));
  }
});

client.login(process.env.DISCORD_TOKEN);
