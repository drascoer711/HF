const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-cheater')
    .setDescription('Log a cheater report')
    .addUserOption(option => option
      .setName('user')
      .setDescription('The user being reported')
      .setRequired(true))
    .addStringOption(option => option
      .setName('cheating')
      .setDescription('How they were cheating')
      .setRequired(true))
    .addStringOption(option => option
      .setName('proof')
      .setDescription('Optional proof link or description')
      .setRequired(false)),

  async execute(interaction) {
    const { readRecords, writeRecords } = require('../store');

    const reportedUser = interaction.options.getUser('user', true);
    const cheating = interaction.options.getString('cheating', true).slice(0, 500);
    const proof = interaction.options.getString('proof')?.slice(0, 1000) || 'No proof provided';

    const records = readRecords();
    records.push({
      userId: reportedUser.id,
      username: reportedUser.tag,
      cheating,
      proof,
      reporterId: interaction.user.id,
      guildId: interaction.guildId,
      createdAt: new Date().toISOString(),
    });
    writeRecords(records);

    await interaction.reply({
      content: `Logged <@${reportedUser.id}> as a cheater.`,
      allowedMentions: { users: [] },
      ephemeral: true,
    });
  },
};
