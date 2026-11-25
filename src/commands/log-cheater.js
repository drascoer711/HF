const { SlashCommandBuilder } = require('discord.js');
const { readRecords, writeRecords } = require('../store');

// Accept a raw Discord snowflake or a user mention such as <@123...> / <@!123...>.
const USER_ID_PATTERN = /^(?:<@!?(\d{17,20})>|(\d{17,20}))$/;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-cheater')
    .setDescription('Log a cheater report')
    .addStringOption(option => option
      .setName('user')
      .setDescription('Discord user ID or mention (for example: 123456789012345678)')
      .setRequired(true))
    .addStringOption(option => option
      .setName('cheating')
      .setDescription('How they were cheating')
      .setRequired(true))
    .addStringOption(option => option
      .setName('proof')
      .setDescription('Optional proof link or description')
      .setRequired(false))
    .addStringOption(option => option
      .setName('alt-status')
      .setDescription('Optional alt-account status (not verified by the bot)')
      .addChoices(
        { name: 'Alt', value: 'alt' },
        { name: 'Not an alt', value: 'not-alt' },
        { name: 'Unknown / not checked', value: 'unknown' },
      )
      .setRequired(false)),

  async execute(interaction) {
    const userInput = interaction.options.getString('user', true).trim();
    const match = USER_ID_PATTERN.exec(userInput);
    if (!match) {
      await interaction.reply({
        content: 'Enter a valid Discord user ID (17–20 digits) or mention the user.',
        ephemeral: true,
      });
      return;
    }

    const userId = match[1] || match[2];
    const cheating = interaction.options.getString('cheating', true).trim().slice(0, 500);
    const proof = interaction.options.getString('proof')?.trim().slice(0, 1000) || 'No proof provided';
    const altStatus = interaction.options.getString('alt-status') || 'unknown';

    if (!cheating) {
      await interaction.reply({ content: 'Describe the cheating behavior.', ephemeral: true });
      return;
    }

    const records = readRecords();
    records.push({
      userId,
      cheating,
      proof,
      altStatus,
      reporterId: interaction.user.id,
      guildId: interaction.guildId,
      createdAt: new Date().toISOString(),
    });
    writeRecords(records);

    await interaction.reply({
      content: `Logged a report for user ID ${userId}${altStatus === 'unknown' ? '' : ` (alt status: ${altStatus === 'alt' ? 'Alt' : 'Not an alt'})`}.`,
      ephemeral: true,
    });
  },
};
