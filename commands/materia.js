import {
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationCommandOptionType
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const MATERIAL_PATH = path.join('./data/material.json');

// 🧠 Função utilitária para carregar os dados com segurança
function loadMaterial() {
  try {
    if (!fs.existsSync(MATERIAL_PATH)) return { topics: [] };
    const data = JSON.parse(fs.readFileSync(MATERIAL_PATH, 'utf8'));
    return data;
  } catch (err) {
    console.error('Erro ao ler material.json:', err);
    return { topics: [] };
  }
}

export const data = new SlashCommandBuilder()
  .setName('materia')
  .setDescription('📖 Veja o resumo explicativo de um tema de inglês!')
  .addStringOption(option =>
    option
      .setName('tema')
      .setDescription('Escolha ou digite o tema (ex: verbo to be, simple present, etc.)')
      .setRequired(true)
      .setAutocomplete(true)
  );

// 🔍 Sistema de autocomplete de temas
export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const { topics } = loadMaterial();

  const filtered = topics
    .filter(t => t.name.toLowerCase().includes(focused))
    .slice(0, 25) // limite do Discord
    .map(t => ({ name: t.name, value: t.id }));

  await interaction.respond(filtered);
}

// 📘 Execução do comando
export async function execute(interaction) {
  const query = interaction.options.getString('tema').toLowerCase();
  const { topics } = loadMaterial();

  if (!topics.length) {
    return interaction.reply({
      content: '❌ Nenhum material encontrado. Verifique o arquivo `material.json`.',
      ephemeral: true
    });
  }

  const topic = topics.find(
    t =>
      t.id.toLowerCase() === query ||
      t.name.toLowerCase().includes(query)
  );

  if (!topic) {
    return interaction.reply({
      content: `❌ Nenhum tema encontrado com o nome **${query}**.`,
      ephemeral: true
    });
  }

  // 🧩 Monta o embed de forma dinâmica (só adiciona o que existir)
  const embed = new EmbedBuilder()
    .setTitle(`📘 ${topic.name}`)
    .setColor('#3B82F6')
    .setTimestamp();

  if (topic.nivel)
    embed.addFields({ name: '🎯 Nível', value: topic.nivel, inline: true });

  if (topic.description)
    embed.setDescription(topic.description);

  if (topic.examples?.length)
    embed.addFields({
      name: '📚 Exemplos',
      value: topic.examples.join('\n')
    });

  if (topic.tip)
    embed.addFields({ name: '💡 Dica', value: topic.tip });

  if (topic.audio)
    embed.addFields({
      name: '🔊 Áudio',
      value: `[Ouvir explicação](${topic.audio})`
    });

  if (topic.video)
    embed.addFields({
      name: '🎥 Vídeo recomendado: ',
      value: `[Assistir no YouTube](${topic.video})`
    });

  embed.setFooter({
    text: 'Use /materia novamente para estudar outro tema!'
  });

  await interaction.reply({ embeds: [embed], ephemeral: false });
}
