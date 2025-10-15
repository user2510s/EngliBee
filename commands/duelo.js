import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import fs from 'fs';
import { getUser, updateUser } from '../utils/userData.js';

const ACTIVE_DUELS = new Set();

export const data = new SlashCommandBuilder()
  .setName('duelo')
  .setDescription('Desafia outro jogador para uma competição de inglês!')
  .addUserOption(option =>
    option
      .setName('oponente')
      .setDescription('Jogador que você quer desafiar')
      .setRequired(true)
  );

export async function execute(interaction) {
  const desafiante = interaction.user;
  const oponente = interaction.options.getUser('oponente');

  if (oponente.bot)
    return interaction.reply({ content: '❌ Você não pode desafiar bots!', ephemeral: true });
  if (oponente.id === desafiante.id)
    return interaction.reply({ content: '❌ Você não pode se desafiar!', ephemeral: true });
  if (ACTIVE_DUELS.has(desafiante.id) || ACTIVE_DUELS.has(oponente.id))
    return interaction.reply({
      content: '⚠️ Um dos jogadores já está em um duelo! Espere ele terminar.',
      ephemeral: true,
    });

  ACTIVE_DUELS.add(desafiante.id);
  ACTIVE_DUELS.add(oponente.id);

  const lessons = JSON.parse(fs.readFileSync('./data/lessons.json', 'utf8'));

  const conviteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('aceitar').setLabel('✅ Aceitar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('recusar').setLabel('❌ Recusar').setStyle(ButtonStyle.Danger)
  );

  const conviteEmbed = new EmbedBuilder()
    .setTitle('🏆 Desafio de Inglês!')
    .setDescription(`**${oponente}**, você foi desafiado por **${desafiante.username}**!\nAceita o duelo de 5 perguntas?`)
    .setColor('#F1C40F')
    .setFooter({ text: 'Você tem 15 segundos para aceitar.' });

  await interaction.reply({ embeds: [conviteEmbed], components: [conviteRow] });

  const filter = i => i.user.id === oponente.id;
  const collector = interaction.channel.createMessageComponentCollector({
    filter,
    time: 15000,
    max: 1,
  });

  collector.on('collect', async i => {
    if (i.customId === 'recusar') {
      await i.update({
        content: `😢 ${oponente.username} recusou o desafio.`,
        embeds: [],
        components: [],
      });
      ACTIVE_DUELS.delete(desafiante.id);
      ACTIVE_DUELS.delete(oponente.id);
      return;
    }

    await i.update({
      content: '🔥 Desafio aceito! O duelo começará em 3 segundos...',
      components: [],
    });

    setTimeout(() => startDuel(interaction, desafiante, oponente, lessons), 3000);
  });

  collector.on('end', async collected => {
    if (collected.size === 0) {
      await interaction.editReply({
        content: '⌛ O desafio expirou. Ninguém respondeu ao convite.',
        components: [],
        embeds: [],
      });
      ACTIVE_DUELS.delete(desafiante.id);
      ACTIVE_DUELS.delete(oponente.id);
    }
  });
}

async function startDuel(interaction, desafiante, oponente, lessons) {
  let score = { [desafiante.id]: 0, [oponente.id]: 0 };
  let questionIndex = 0;
  const totalQuestions = 5;

  async function askQuestion() {
    if (questionIndex >= totalQuestions) {
      return endDuel(interaction, desafiante, oponente, score, totalQuestions);
    }

    const lesson = lessons[Math.floor(Math.random() * lessons.length)];
    const buttons = new ActionRowBuilder();
    lesson.options.forEach((opt, index) => {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(String(index))
          .setLabel(opt)
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setTitle(`🧠 Pergunta ${questionIndex + 1}/${totalQuestions}`)
      .setDescription(`**${lesson.question}**\n\nPrimeiro a acertar ganha 1 ponto!`)
      .setColor('#2ECC71')
      .setFooter({ text: 'Tempo: 20 segundos' });

    const questionMessage = await interaction.followUp({
      embeds: [embed],
      components: [buttons],
    });

    const filter = i => [desafiante.id, oponente.id].includes(i.user.id);
    const collector = questionMessage.createMessageComponentCollector({
      filter,
      time: 20000,
    });

    let answered = false;

    collector.on('collect', async i => {
      const answerIndex = parseInt(i.customId);

      if (answered) {
        return i.reply({ content: '⏳ Esta pergunta já foi respondida!', ephemeral: true });
      }

      if (answerIndex === lesson.correct) {
        answered = true;
        score[i.user.id] += 1;

        await i.update({
          content: `✅ **${i.user.username}** acertou! A resposta correta era **${lesson.options[lesson.correct]}**.`,
          embeds: [],
          components: [],
        });

        collector.stop();
      } else {
        await i.reply({ content: '❌ Errado!', ephemeral: true });
      }
    });

    collector.on('end', async () => {
      if (!answered) {
        await interaction.followUp({
          content: `⏰ Ninguém respondeu a tempo! A resposta certa era **${lesson.options[lesson.correct]}**.`,
        });
      }

      questionIndex++;
      setTimeout(askQuestion, 2000);
    });
  }

  askQuestion();
}

async function endDuel(interaction, desafiante, oponente, score, totalQuestions) {
  const desafiantePontos = score[desafiante.id];
  const oponentePontos = score[oponente.id];

  let vencedor = null;
  if (desafiantePontos > oponentePontos) vencedor = desafiante;
  else if (oponentePontos > desafiantePontos) vencedor = oponente;

  const desafianteData = getUser(desafiante.id);
  const oponenteData = getUser(oponente.id);

  let xpGain = 0;
  let resultadoTexto = '';

  if (vencedor) {
    const perdedor = vencedor.id === desafiante.id ? oponente : desafiante;
    const vencedorData = getUser(vencedor.id);

    xpGain = 50 + (Math.abs(desafiantePontos - oponentePontos) * 10);
    const xpNeeded = vencedorData.level * 100;
    const totalXp = vencedorData.xp + xpGain;
    let levelUp = false;

    if (totalXp >= xpNeeded) {
      vencedorData.level++;
      vencedorData.xp = totalXp - xpNeeded;
      levelUp = true;
    } else {
      vencedorData.xp = totalXp;
    }

    vencedorData.duelos_ganhos = (vencedorData.duelos_ganhos || 0) + 1;
    getUser(perdedor.id).duelos_perdidos = (getUser(perdedor.id).duelos_perdidos || 0) + 1;

    updateUser(vencedor.id, vencedorData);
    updateUser(perdedor.id, getUser(perdedor.id));

    resultadoTexto = `🏆 **${vencedor.username} venceu o duelo!**\nGanhou **${xpGain} XP** ${
      levelUp ? `(Subiu para o nível ${vencedorData.level}!)` : ''
    }`;
  } else {
    desafianteData.duelos_empates = (desafianteData.duelos_empates || 0) + 1;
    oponenteData.duelos_empates = (oponenteData.duelos_empates || 0) + 1;
    updateUser(desafiante.id, desafianteData);
    updateUser(oponente.id, oponenteData);
    resultadoTexto = '🤝 O duelo terminou em **empate!**';
  }

  const resumo = new EmbedBuilder()
    .setTitle('📊 Resumo do Duelo')
    .setImage('https://i.pinimg.com/originals/12/3a/e8/123ae85cf71cf0ba74b4734636f28dab.gif') 
    .setColor(vencedor ? '#3498DB' : '#95A5A6')
    .setDescription(
      `**${desafiante.username}:** ${desafiantePontos} pontos\n**${oponente.username}:** ${oponentePontos} pontos\n\n${resultadoTexto}`
    )
    .setFooter({ text: 'Duelo finalizado!' });

  await interaction.followUp({ embeds: [resumo] });

  ACTIVE_DUELS.delete(desafiante.id);
  ACTIVE_DUELS.delete(oponente.id);
}
