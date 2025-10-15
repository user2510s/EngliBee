  import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
  import fs from 'fs';
  import { getUser, updateUser } from '../utils/userData.js';

  export const data = new SlashCommandBuilder()
    .setName('lesson')
    .setDescription('Faz uma lição de inglês aleatória!');

  export async function execute(interaction) {
    const lessons = JSON.parse(fs.readFileSync('./data/lessons.json', 'utf8'));
    const lesson = lessons[Math.floor(Math.random() * lessons.length)];

    const buttons = new ActionRowBuilder();
    lesson.options.forEach((opt, index) => {
      buttons.addComponents(
        new ButtonBuilder().setCustomId(String(index)).setLabel(opt).setStyle(ButtonStyle.Secondary)
      );
    });

    await interaction.reply({
      content: `📚 **Lição de Inglês!**\n${lesson.question}`,
      components: [buttons],
    });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async (i) => {
      const userId = i.user.id;
      const answerIndex = parseInt(i.customId);
      const user = getUser(userId);

      if (answerIndex === lesson.correct) {
        const xpGain = lesson.xp;
        const newXp = user.xp + xpGain;
        const xpNeeded = user.level * 100;
        let levelUp = false;

        if (newXp >= xpNeeded) {
          user.level++;
          user.xp = newXp - xpNeeded;
          levelUp = true;
        } else {
          user.xp = newXp;
        }

        user.lessons_completed++;
        updateUser(userId, user);

        await i.update({
          content: levelUp
            ? `🎉 Subiu para o **nível ${user.level}**! (+${xpGain} XP)`
            : `✅ Correto! Você ganhou **+${xpGain} XP!**`,
          components: [],
        });
      } else {
        const correctAnswer = lesson.options[lesson.correct];
        await i.update({
          content: `❌ Errado! A resposta certa era **${correctAnswer}**.`,
          components: [],
        });
      }
    });
  }
