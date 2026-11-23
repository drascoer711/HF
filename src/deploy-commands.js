require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required');
if (!process.env.CLIENT_ID) throw new Error('CLIENT_ID is required');

const commands = [];
const commandDir = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandDir).filter(file => file.endsWith('.js'))) {
  const command = require(path.join(commandDir, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} application commands.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
