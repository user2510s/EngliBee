import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../utils/userData.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Mostra seu perfil de aprendizado!');

// Função para gerar cor hexadecimal aleatória
function getRandomColor() {
  return Math.floor(Math.random() * 16777215); // 0x000000 até 0xFFFFFF
}

export async function execute(interaction) {
  const user = getUser(interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(getRandomColor())
    .setTitle(`📘 Perfil de ${interaction.user.username}`)
    .addFields(
      { name: 'XP', value: `${user.xp || 0}`, inline: true },
      { name: 'Nível', value: `${user.level || 0}`, inline: true },
      { name: 'Lições concluídas', value: `${user.lessons_completed || 0}`, inline: true },
      { name: 'Tentativas diárias', value: `${user.daily_attempts || 0}`, inline: true },
      { name: 'Erros', value: `${user.lessons_failed || 0}`, inline: true }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
