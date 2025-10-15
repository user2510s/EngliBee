import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import { getUser, updateUser } from '../utils/userData.js';

export const data = new SlashCommandBuilder()
  .setName('lessonpath')
  .setDescription('Faz uma lição de inglês em sequência!');

export async function execute(interaction) {
  let interactionHandled = false; // controle para evitar 40060

  try {
    // Defer imediatamente
    await interaction.deferReply({ ephemeral: true });
    interactionHandled = true;

    // Lê os módulos do arquivo JSON
    let lessonsData;
    try {
      const fileContent = fs.readFileSync('./data/lessonpath.json', 'utf8');
      lessonsData = JSON.parse(fileContent);
    } catch (fileError) {
      console.error('Erro ao ler lessonpath.json:', fileError);
      return await interaction.editReply(
        '❌ Erro ao carregar os dados das lições. Verifique o arquivo lessonpath.json.'
      );
    }

    // Valida estrutura
    if (!lessonsData || typeof lessonsData !== 'object' || !Array.isArray(lessonsData.modules) || lessonsData.modules.length === 0) {
      return await interaction.editReply('❌ Nenhum módulo válido encontrado no arquivo JSON.');
    }

    const modules = lessonsData.modules;
    const userId = interaction.user.id;
    let user = getUser(userId) || { id: userId, xp: 0, level: 1, modules_completed: [] };

    user.modules_completed = user.modules_completed || [];
    user.xp = user.xp || 0;
    user.level = user.level || 1;

    // Filtra módulos válidos
    const validModules = modules.filter(m => 
      m && m.id && m.name && m.question && Array.isArray(m.options) && m.options.length > 0 &&
      typeof m.correct === 'number' && m.correct >= 0 && m.correct < m.options.length
    );

    if (validModules.length === 0) {
      return await interaction.editReply('❌ Nenhum módulo válido encontrado.');
    }

    // Próximo módulo não completado
    const currentModule = validModules.find(m => !user.modules_completed.includes(m.id));

    if (!currentModule) {
      const completedModules = user.modules_completed.filter(id => validModules.some(m => m.id === id)).length;
      return await interaction.editReply(
        `🎉 **Parabéns!** Você completou todos os ${completedModules} módulos disponíveis!\n` +
        `📊 **Estatísticas:**\n• Nível: ${user.level}\n• XP Total: ${user.xp}`
      );
    }

    // Opções válidas e botões
    const optionsToShow = currentModule.options.filter(opt => opt != null && String(opt).trim() !== '').slice(0, 5);
    const buttonComponents = optionsToShow.map((opt, index) =>
      new ButtonBuilder()
        .setCustomId(`answer_${index}`)
        .setLabel(String(opt).substring(0, 80))
        .setStyle(ButtonStyle.Secondary)
    );
    const buttons = new ActionRowBuilder().addComponents(buttonComponents);

    await interaction.editReply({
      content: `📚 **${currentModule.name}**\n\n❓ ${currentModule.question}`,
      components: [buttons]
    });

    // Coletor de botões
    const filter = i => i.user.id === userId && i.customId.startsWith('answer_');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async i => {
      try {
        const answerIndex = parseInt(i.customId.replace('answer_', ''));
        if (isNaN(answerIndex)) {
          return await i.update({ content: '❌ Erro ao processar resposta.', components: [] });
        }

        const isCorrect = answerIndex === currentModule.correct;
        if (isCorrect) {
          const xpGain = currentModule.xp || 10;
          let levelUp = false;
          user.xp += xpGain;
          const xpNeeded = user.level * 100;

          if (user.xp >= xpNeeded) {
            user.level++;
            user.xp -= xpNeeded;
            levelUp = true;
          }

          if (!user.modules_completed.includes(currentModule.id)) {
            user.modules_completed.push(currentModule.id);
          }

          try { updateUser(userId, user); } catch (err) { console.error('Erro ao atualizar usuário:', err); }

          const successMessage = levelUp
            ? `🎉 **LEVEL UP!** Você subiu para o **nível ${user.level}**!\n✅ Resposta correta! (+${xpGain} XP)\n📊 XP atual: ${user.xp}/${user.level * 100}`
            : `✅ **Correto!** Você ganhou **+${xpGain} XP!**\n📊 XP: ${user.xp}/${user.level * 100} | Nível: ${user.level}`;

          await i.update({ content: successMessage, components: [] });
        } else {
          const correctAnswer = currentModule.options[currentModule.correct] || 'Resposta não disponível';
          await i.update({
            content: `❌ **Incorreto!**\nA resposta certa era: **${correctAnswer}**\n💡 Use o comando novamente para tentar o próximo módulo!`,
            components: []
          });
        }
      } catch (err) {
        console.error('Erro no coletor:', err);
        await i.update({ content: '❌ Erro ao processar sua resposta.', components: [] }).catch(console.error);
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        try {
          await interaction.editReply({ 
            content: '⏰ **Tempo esgotado!** Use o comando `/lessonpath` novamente para continuar.', 
            components: [] 
          });
        } catch (endError) {
          console.error('Erro ao finalizar coletor:', endError);
        }
      }
    });

  } catch (err) {
    console.error('Erro crítico no lessonpath:', err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '❌ Ocorreu um erro ao executar o comando. Por favor, tente novamente.', ephemeral: true });
      } catch (replyError) {
        console.error('Erro ao enviar mensagem de erro:', replyError);
      }
    }
  }
}
