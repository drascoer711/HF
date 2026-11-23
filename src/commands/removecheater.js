const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { readRecords, writeRecords } = require('../store');

const USER_ID_PATTERN = /^(?:<@!?(\d{17,20})>|(\d{17,20}))$/;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removecheater')
    .setDescription('Remove all cheater reports for a user in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => option
      .setName('user-id')
      .setDescription('Discord user ID or mention to remove from the logs')
      .setRequired(true)),

  async execute(interaction) {
    // Enforce permissions at runtime too, in case command permissions are changed.
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the Manage Server permission to remove reports.',
        ephemeral: true,
      });
      return;
    }

    const input = interaction.options.getString('user-id', true).trim();
    const match = USER_ID_PATTERN.exec(input);
    if (!match) {
      await interaction.reply({
        content: 'Enter a valid Discord user ID (17–20 digits) or mention the user.',
        ephemeral: true,
      });
      return;
    }

    const userId = match[1] || match[2];
    const records = readRecords();
    const remaining = records.filter(record => !(
      record.guildId === interaction.guildId && record.userId === userId
    ));
    const removed = records.length - remaining.length;

    if (removed > 0) writeRecords(remaining);
    await interaction.reply({
      content: removed
        ? `Removed ${removed} report${removed === 1 ? '' : 's'} for user ID ${userId} from this server's logs.`
        : `No reports for user ID ${userId} were found in this server's logs.`,
      ephemeral: true,
    });
  },
};
