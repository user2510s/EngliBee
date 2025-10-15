import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import { getUser, updateUser } from '../utils/userData.js';
import { checkAchievements } from '../utils/achievements.js';

export const data = new SlashCommandBuilder()
  .setName('dailylesson')
  .setDescription('Faça sua lição diária e ganhe XP!');

// Função para pegar data local em formato YYYY-MM-DD
function getLocalDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const user = getUser(userId);

  const today = getLocalDate();

  // Verifica se já fez a lição hoje (baseado em fuso horário local)
  if (user.daily_last === today) {
    return interaction.reply('❌ Você já fez a lição diária hoje! Volte amanhã após a meia-noite.');
  }

  // Calcula streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday);

  if (user.daily_last === yesterdayStr) {
    user.daily_streak = (user.daily_streak || 0) + 1;
  } else {
    user.daily_streak = 1;
  }

  user.daily_last = today;
  user.daily_attempts = (user.daily_attempts || 0) + 1;

  // Carrega uma lição aleatória
  const lessons = JSON.parse(fs.readFileSync('./data/lessons.json', 'utf8'));
  const lesson = lessons[Math.floor(Math.random() * lessons.length)];

  // Cria botões
  const buttons = new ActionRowBuilder();
  lesson.options.forEach((opt, index) => {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(String(index))
        .setLabel(opt)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  await interaction.reply({
    content: `📚 **Lição diária!**\n${lesson.question}`,
    components: [buttons]
  });

  // Coletor de resposta
  const filter = (i) => i.user.id === userId;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 20000, max: 1 });

  collector.on('collect', async (i) => {
    const answerIndex = parseInt(i.customId);
    let xpGain = 0;

    if (answerIndex === lesson.correct) {
      xpGain = lesson.xp + (user.daily_streak - 1) * 5;
      user.xp = (user.xp || 0) + xpGain;
      user.lessons_completed = (user.lessons_completed || 0) + 1;
    } else {
      user.lessons_failed = (user.lessons_failed || 0) + 1;
    }

    updateUser(userId, user);
    const unlocked = checkAchievements(userId, user);

    const contentMessage =
      answerIndex === lesson.correct
        ? `✅ Correto! Você ganhou **+${xpGain} XP**. Streak atual: **${user.daily_streak} dias**!`
        : `❌ Errado! A resposta certa era **${lesson.options[lesson.correct]}**. Streak atual: **${user.daily_streak} dias**.`;

    await i.update({ content: contentMessage, components: [] });

    if (unlocked.length > 0) {
      const achEmbed = new EmbedBuilder()
        .setTitle('🏆 Conquista Desbloqueada!')
        .setDescription(unlocked.join('\n'))
        .setColor(Math.floor(Math.random() * 16777215))
        .setTimestamp();

      interaction.followUp({ embeds: [achEmbed] });
    }
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      user.lessons_failed = (user.lessons_failed || 0) + 1;
      updateUser(userId, user);

      interaction.editReply({
        content: '⏰ Tempo esgotado! Não respondeu a tempo, mas sua tentativa foi registrada.',
        components: []
      });

      const unlocked = checkAchievements(userId, user);
      if (unlocked.length > 0) {
        const achEmbed = new EmbedBuilder()
          .setTitle('🏆 Conquista Desbloqueada!')
          .setDescription(unlocked.join('\n'))
          .setColor(Math.floor(Math.random() * 16777215))
          .setTimestamp();
        interaction.followUp({ embeds: [achEmbed] });
      }
    }
  });
}
