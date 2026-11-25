const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require('discord.js');

const PAGE_SIZE = 5;

function pageEmbed(records, page) {
  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  const slice = records.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle('Logged Cheaters')
    .setColor(0xED4245)
    .setFooter({ text: `Page ${safePage + 1} of ${pages}` });

  if (!slice.length) {
    embed.setDescription('No cheaters have been logged yet.');
  } else {
    embed.setDescription(slice.map((record, index) => {
      const number = safePage * PAGE_SIZE + index + 1;
      const date = new Date(record.createdAt).toLocaleString();
      const altStatus = record.altStatus === 'alt'
        ? 'Alt (unverified)'
        : record.altStatus === 'not-alt' ? 'Not an alt (unverified)' : 'Not specified';
      return `**${number}. <@${record.userId}>**\n` +
        `**Cheating:** ${record.cheating}\n` +
        `**Alt status:** ${altStatus}\n` +
        `**Proof:** ${record.proof}\n` +
        `*Logged ${date}*`;
    }).join('\n\n'));
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cheaters:prev:${safePage}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`cheaters:next:${safePage}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= pages - 1),
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cheaters')
    .setDescription('Show every logged cheater'),

  pageEmbed,

  async execute(interaction) {
    const { readRecords } = require('../store');
    const records = readRecords()
      .filter(record => record.guildId === interaction.guildId)
      .reverse();

    await interaction.reply({ ...pageEmbed(records, 0), allowedMentions: { parse: [] } });
  },
};
