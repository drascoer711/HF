const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot and Discord connection latency'),

  async execute(interaction) {
    const receivedAt = Date.now();
    const gatewayLatency = interaction.client.ws.ping;
    await interaction.reply({
      content: `🏓 Pong!\n• Discord interaction: ~${Math.max(0, receivedAt - interaction.createdTimestamp)} ms\n• Gateway heartbeat: ${Math.round(gatewayLatency)} ms`,
      ephemeral: true,
    });
  },
};
