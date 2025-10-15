import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { getUser, updateUser } from '../utils/userData.js';

export const data = new SlashCommandBuilder()
  .setName('conversation')
  .setDescription('Mini-conversação em inglês com pontuação, dicas e estatísticas!');

const ACTIVE_CONVERSATIONS = new Map(); // Sessões ativas

//Calcula similaridade entre duas strings (Levenshtein)
function calculateSimilarity(answer, correct) {
  const normalize = str => str.toLowerCase().trim().replace(/[.,!?;]/g, '').replace(/\s+/g, ' ');
  const a = normalize(answer);
  const b = normalize(correct);
  if (a === b) return 100;

  const n = a.length, m = b.length;
  if (n === 0 || m === 0) return 0;

  const dp = Array.from({ length: n + 1 }, (_, i) => [i]);
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  const distance = dp[n][m];
  const similarity = ((Math.max(n, m) - distance) / Math.max(n, m)) * 100;
  return Math.round(similarity);
}

export async function execute(interaction) {
  const userId = interaction.user.id;
  const now = Date.now();

  // Impede múltiplas conversas simultâneas
  const activeSession = ACTIVE_CONVERSATIONS.get(userId);
  if (activeSession && now - activeSession.start < 2 * 60 * 1000) {
    return interaction.reply({
      content: '❌ Você já está em uma conversa ativa! Termine-a antes de iniciar outra.',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });
  const user = getUser(userId);

  // Carrega as perguntas
  const jsonPath = path.join('./data/conversation.json');
  if (!fs.existsSync(jsonPath)) {
    return interaction.editReply('❌ Arquivo `conversation.json` não encontrado.');
  }

  const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).questions;
  const selected = [...questions].sort(() => Math.random() - 0.5).slice(0, 5);

  // Inicializa sessão
  const session = {
    questions: selected,
    currentIndex: 0,
    xpGained: 0,
    answers: [],
    start: now
  };
  ACTIVE_CONVERSATIONS.set(userId, session);

  async function nextQuestion() {
    await new Promise(r => setTimeout(r, 800)); // Delay suave

    if (session.currentIndex >= session.questions.length) {
      // Fim da conversação
      let summary = `**📘 Resumo da Conversação:**\n`;
      let correctCount = 0;

      for (const [i, qa] of session.answers.entries()) {
        const sim = qa.similarity ? ` (${qa.similarity}%)` : '';
        summary += `\n${i + 1}. **${qa.question}**\n> Resposta: ${qa.answer}${sim}\n> ${qa.tip}\n> XP: ${qa.xp}\n`;
        if (qa.correct) correctCount++;
      }

      summary += `\n✨ Total de XP ganho: **${session.xpGained}**`;
      summary += `\n📊 Acertos: **${correctCount}/${session.questions.length}**`;

      // Atualiza XP e nível
      user.xp += session.xpGained;
      const xpNeeded = user.level * 100;
      if (user.xp >= xpNeeded) {
        user.level++;
        user.xp -= xpNeeded;
        summary += `\n🎉 Parabéns! Você subiu para o nível **${user.level}**!`;
      }

      updateUser(userId, user);
      ACTIVE_CONVERSATIONS.delete(userId);

      return interaction.followUp({ content: summary, ephemeral: true });
    }

    const q = session.questions[session.currentIndex];

    // PERGUNTA MULTIPLA ESCOLHA
    if (q.type === 'multiple-choice') {
      const buttons = new ActionRowBuilder().addComponents(
        ...q.options.map((opt, i) =>
          new ButtonBuilder().setCustomId(String(i)).setLabel(opt).setStyle(ButtonStyle.Secondary)
        )
      );

      const qMsg = await interaction.followUp({
        content: `💬 **Pergunta ${session.currentIndex + 1}:** ${q.question}`,
        components: [buttons],
        ephemeral: true
      });

      const collector = qMsg.createMessageComponentCollector({
        filter: i => i.user.id === userId,
        time: 120000,
        max: 1
      });

      collector.on('collect', async i => {
        const idx = parseInt(i.customId);
        const correct = idx === q.correct;
        const xp = correct ? (q.xp || 10) : 0;
        const tip = correct
          ? `✅ Correto! ${q.tip || 'Continue assim!'}`
          : `❌ Errado! ${q.tip || 'Tente novamente na próxima!'}`;

        session.answers.push({ question: q.question, answer: q.options[idx], xp, tip, correct });
        if (correct) session.xpGained += xp;

        session.currentIndex++;
        await i.update({ content: tip, components: [] });
        nextQuestion();
      });

      collector.on('end', c => {
        if (c.size === 0) {
          ACTIVE_CONVERSATIONS.delete(userId);
          interaction.followUp({
            content: '⏰ Tempo esgotado! Você pode iniciar uma nova conversa.',
            ephemeral: true
          });
        }
      });
    }

    // 💬 PERGUNTA DE TEXTO ABERTO
    else if (q.type === 'text') {
      await interaction.followUp({
        content: `💬 **Pergunta ${session.currentIndex + 1}:** ${q.question}\n🕒 Responda no chat em até 2 minutos!`,
        ephemeral: true
      });

      const collector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === userId && !m.author.bot,
        time: 120000,
        max: 1
      });

      collector.on('collect', async m => {
        const answer = m.content.trim();
        const correctAnswer = q.correctAnswer?.trim();
        const xpBase = q.xp || 5;
        let correct = false;
        let similarity = 0;
        let tip = q.tip || 'Pratique mais essa estrutura!';

        if (!correctAnswer) {
          // Sem resposta definida → modo livre
          correct = answer.length >= 3;
          similarity = correct ? 100 : 0;
          tip = correct ? `✅ Boa! ${tip}` : `❌ Resposta muito curta! ${tip}`;
        } else {
          similarity = calculateSimilarity(answer, correctAnswer);
          if (similarity >= 90) {
            correct = true;
            tip = `✅ Correto (${similarity}% de precisão). ${tip}`;
          } else {
            tip = `❌ Incorreto (${similarity}% - precisa de 90%).\n📝 Resposta esperada: "${correctAnswer}"\n💡 ${tip}`;
          }
        }

        const xp = correct ? xpBase : 0;
        session.answers.push({ question: q.question, answer, xp, tip, correct, similarity });
        if (correct) session.xpGained += xp;

        session.currentIndex++;
        await m.reply({ content: tip });
        nextQuestion();
      });

      collector.on('end', c => {
        if (c.size === 0) {
          ACTIVE_CONVERSATIONS.delete(userId);
          interaction.followUp({
            content: '⏰ Tempo esgotado! Você pode iniciar uma nova conversa.',
            ephemeral: true
          });
        }
      });
    }
  }

  nextQuestion();
}
