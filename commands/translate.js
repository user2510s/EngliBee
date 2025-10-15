import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('translate')
  .setDescription('Traduz uma palavra ou frase')
  .addStringOption(option =>
    option.setName('texto')
      .setDescription('O texto a ser traduzido')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('idioma')
      .setDescription('Código do idioma (ex: pt, en, es)')
      .setRequired(true));

export async function execute(interaction) {
  const texto = interaction.options.getString('texto');
  const idioma = interaction.options.getString('idioma');

  try {
    // Usando a API do Google Translate diretamente
    const traduzido = await traduzirTexto(texto, idioma);
    
    const embed = new EmbedBuilder()
      .setTitle('🌐 Tradução')
      .addFields(
        { name: 'Texto original', value: texto },
        { name: 'Traduzido', value: traduzido }
      )
      .setColor(0x0099FF)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error('Erro na tradução:', err);
    await interaction.reply('❌ Não foi possível traduzir o texto.');
  }
}

// Função alternativa usando fetch para a API do Google Translate
async function traduzirTexto(texto, idiomaAlvo) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${idiomaAlvo}&dt=t&q=${encodeURIComponent(texto)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  // A API retorna um array onde o primeiro elemento contém as traduções
  return data[0].map(item => item[0]).join('');
}