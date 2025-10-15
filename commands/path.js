import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Corrige __dirname no ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const data = new SlashCommandBuilder()
  .setName('path')
  .setDescription('Mostra seu caminho de aprendizado');

// Função auxiliar para gerar embeds paginados
function generateEmbeds(user, modules) {
  const embeds = [];

  for (let i = 0; i < modules.length; i += 25) {
    const embed = new EmbedBuilder()
      .setTitle(`${user.username} - Caminho de Aprendizado (página ${Math.floor(i / 25) + 1})`)
      .setColor(Math.floor(Math.random() * 16777215))
      .setFooter({ text: `Mostrando módulos ${i + 1}-${Math.min(i + 25, modules.length)} de ${modules.length}` });

    modules.slice(i, i + 25).forEach(mod => {
      const completed = user.data.modules_completed?.includes(mod.id);
      const unlocked = true; // aqui você pode adicionar lógica de requisitos
      embed.addFields({
        name: `${mod.name} ${completed ? '✅' : unlocked ? '🔓' : '🔒'}`,
        value: '\u200B'
      });
    });

    embeds.push(embed);
  }

  return embeds;
}

export async function execute(interaction) {
  const userId = interaction.user.id;

  // Carrega os dados dos módulos
  const pathData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/lessonpath.json'), 'utf8')
  );

  // Carrega dados dos usuários
  let users = {};
  try {
    users = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf8'));
  } catch {
    users = {};
  }

  // Busca dados do usuário
  const userData = users[userId] || { modules_completed: [] };

  const embeds = generateEmbeds(
    { username: interaction.user.username, data: userData },
    pathData.modules
  );

  // Caso haja apenas uma página, envia direto
  if (embeds.length === 1) {
    await interaction.reply({ embeds });
    return;
  }

  // Cria os botões de navegação
  let currentPage = 0;
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.reply({
    embeds: [embeds[currentPage]],
    components: [buttons],
    fetchReply: true,
  });

  const collector = message.createMessageComponentCollector({
    time: 120000, // 2 minutos
  });

  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id)
      return i.reply({ content: '❌ Apenas quem executou o comando pode usar os botões.', ephemeral: true });

    if (i.customId === 'prev') currentPage--;
    else if (i.customId === 'next') currentPage++;

    // Atualiza os botões
    buttons.components[0].setDisabled(currentPage === 0);
    buttons.components[1].setDisabled(currentPage === embeds.length - 1);

    await i.update({
      embeds: [embeds[currentPage]],
      components: [buttons],
    });
  });

  collector.on('end', async () => {
    // Desativa os botões quando o tempo expira
    buttons.components.forEach(btn => btn.setDisabled(true));
    await message.edit({ components: [buttons] });
  });
}
