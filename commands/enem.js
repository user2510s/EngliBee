import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
  .setName('enem')
  .setDescription('📚 Responda uma pergunta aleatória do ENEM (Inglês)!');

export async function execute(interaction) {
  const filePath = path.join('./data/enem.json');

  if (!fs.existsSync(filePath)) {
    return interaction.reply({ content: '❌ Arquivo `enem.json` não encontrado.', ephemeral: true });
  }

  let questions;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    questions = json.enem_questoes_ingles;
    if (!Array.isArray(questions) || questions.length === 0) throw new Error();
  } catch {
    return interaction.reply({ content: '❌ Erro ao ler as questões do ENEM.', ephemeral: true });
  }

  // Seleciona uma questão aleatória
  const q = questions[Math.floor(Math.random() * questions.length)];

  // Cria embed da questão
  const embed = new EmbedBuilder()
    .setTitle(`ENEM ${q.enem_ano} - Questão ${q.questao_numero}`)
    .setDescription(q.enunciado || 'Sem enunciado disponível.')
    .setColor('#3B82F6')
    .setFooter({ text: q.disciplina || 'Língua Estrangeira (Inglês)' });

  if (q.texto_apoio?.length) {
    embed.addFields({ name: '📖 Texto de apoio', value: q.texto_apoio.join('\n') });
  }

  // Cria botões para as opções
  const row = new ActionRowBuilder();
  (q.opcoes || []).forEach(opt => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(opt.letra)
        .setLabel(`${opt.letra.toUpperCase()}: ${opt.descricao}`)
        .setStyle(ButtonStyle.Primary)
    );
  });

  // Envia pergunta
  const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  // Coletor de resposta
  const filter = i => i.user.id === interaction.user.id;
  const collector = msg.createMessageComponentCollector({ filter, max: 1, time: 120000 });

  collector.on('collect', async i => {
    const selected = i.customId.toLowerCase();
    const correct = selected === q.gabarito.toLowerCase();

    // Desativa botões após resposta
    const disabledRow = new ActionRowBuilder();
    (q.opcoes || []).forEach(opt => {
      disabledRow.addComponents(
        new ButtonBuilder()
          .setCustomId(opt.letra)
          .setLabel(`${opt.letra.toUpperCase()}: ${opt.descricao}`)
          .setStyle(opt.letra.toLowerCase() === q.gabarito.toLowerCase() ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(true)
      );
    });

    await i.update({ components: [disabledRow] });

    // Envia nova mensagem com resultado e justificativa
    const resultEmbed = new EmbedBuilder()
      .setTitle(correct ? '✅ Acertou!' : '❌ Errou!')
      .setDescription(`${interaction.user}, você selecionou **${selected.toUpperCase()}**. A resposta correta é **${q.gabarito.toUpperCase()}**.`)
      .setColor(correct ? '#22c55e' : '#ef4444')
      .addFields({
        name: '📌 Justificativa',
        value: q.justificativa || 'Sem justificativa disponível.'
      })
      .setTimestamp();

    interaction.followUp({ embeds: [resultEmbed] });
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      interaction.editReply({
        content: '⏰ Tempo esgotado! Você não respondeu a tempo.',
        components: []
      });
    }
  });
}
