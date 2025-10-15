import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, updateUser } from '../utils/userData.js';
import { checkAchievements } from '../utils/achievements.js';

// Mensagens motivacionais aleatórias
const motivationalMessages = [
  'Continue assim, você está arrasando no inglês! 💪',
  'Aprender inglês é um superpoder! 🌟',
  'Cada XP conta! Não pare agora! 🚀',
  'Você está melhorando a cada dia! 🏆'
];

export const data = new SlashCommandBuilder()
  .setName('giftxp')
  .setDescription('Dê XP para outro usuário')
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('O usuário que vai receber o XP')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('quantidade')
      .setDescription('Quantidade de XP que deseja dar')
      .setRequired(true));

export async function execute(interaction) {
  const giverId = interaction.user.id;
  const receiver = interaction.options.getUser('usuario');
  const amount = interaction.options.getInteger('quantidade');

  if (receiver.id === giverId) {
    return interaction.reply('❌ Você não pode se dar XP.');
  }

  if (amount <= 0) {
    return interaction.reply('❌ A quantidade de XP deve ser maior que 0.');
  }

  const giver = getUser(giverId);
  const receiverData = getUser(receiver.id);

  // Cooldown diário: verifica se já enviou XP hoje
  const today = new Date().toISOString().slice(0, 10);
  if (giver.lastGiftDay === today) {
    return interaction.reply('❌ Você já enviou XP hoje. Tente novamente amanhã!');
  }

  // Verifica se o doador tem XP suficiente
  if ((giver.xp || 0) < amount) {
    return interaction.reply(`❌ Você não tem XP suficiente. Atualmente você tem ${giver.xp || 0} XP.`);
  }

  // Subtrai do doador e adiciona ao receptor
  giver.xp -= amount;
  receiverData.xp = (receiverData.xp || 0) + amount;

  // Atualiza cooldown e gifts recebidos
  giver.lastGiftDay = today;
  receiverData.giftsReceived = (receiverData.giftsReceived || 0) + 1;

  // Salva usuários
  updateUser(giverId, giver);
  updateUser(receiver.id, receiverData);

  // Embed principal
  const embed = new EmbedBuilder()
    .setTitle('🎁 XP Transferido!')
    .setDescription(`${interaction.user.username} deu **${amount} XP** para ${receiver.username}!`)
    .setColor(Math.floor(Math.random() * 16777215))
    .addFields(
      { name: 'Seu XP atual', value: `${giver.xp}`, inline: true },
      { name: `XP de ${receiver.username}`, value: `${receiverData.xp}`, inline: true }
    )
    .setTimestamp();

  // Mensagem motivacional aleatória
  const motivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
  embed.addFields({ name: '💡 Motivação', value: motivation });

  await interaction.reply({ embeds: [embed] });

  // Checa conquistas do receiver
  const unlocked = checkAchievements(receiver.id, receiverData);
  if (unlocked.length > 0) {
    const achEmbed = new EmbedBuilder()
      .setTitle('🏆 Conquista Desbloqueada!')
      .setDescription(unlocked.join('\n'))
      .setColor(Math.floor(Math.random() * 16777215))
      .setTimestamp();

    interaction.followUp({ embeds: [achEmbed] });
  }
}
