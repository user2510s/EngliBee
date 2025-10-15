import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import Canvas from 'canvas';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('sayonavatar')
  .setDescription('Adiciona um texto na foto do usuário com efeitos')
  .addStringOption(option =>
    option.setName('texto')
      .setDescription('Texto para adicionar na imagem')
      .setRequired(true)
  )
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Escolha o usuário')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('posicao')
      .setDescription('Posição do texto')
      .setRequired(false)
      .addChoices(
        { name: 'Topo', value: 'top' },
        { name: 'Meio', value: 'center' },
        { name: 'Baixo', value: 'bottom' }
      )
  )
  .addStringOption(option =>
    option.setName('cor')
      .setDescription('Cor do texto (hex ou nome)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option.setName('grayscale')
      .setDescription('Aplicar filtro preto e branco no avatar')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('template')
      .setDescription('Escolha um template')
      .setRequired(false)
      .addChoices(
        { name: 'Normal', value: 'normal' },
        { name: 'Say No More', value: 'saynomore' },
        { name: 'Drake', value: 'drake' }
      )
  );

export async function execute(interaction) {
  const target = interaction.options.getUser('usuario') || interaction.user;
  const text = interaction.options.getString('texto');
  const position = interaction.options.getString('posicao') || 'bottom';
  const color = interaction.options.getString('cor') || '#ffffff';
  const grayscale = interaction.options.getBoolean('grayscale') || false;
  const template = interaction.options.getString('template') || 'normal';

  const avatarURL = target.displayAvatarURL({ extension: 'png', size: 256 });
  const canvas = Canvas.createCanvas(256, 256);
  const ctx = canvas.getContext('2d');

  // Carregar avatar
  const response = await fetch(avatarURL);
  const avatar = await Canvas.loadImage(await response.buffer());

  // Aplicar filtro se necessário
  if (grayscale) ctx.filter = 'grayscale(100%)';
  ctx.drawImage(avatar, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  // Ajustar fonte e efeitos
  ctx.font = '28px Sans';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  
  // Degradê horizontal
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;

  // Determinar Y do texto
  let y;
  switch (position) {
    case 'top': y = 40; break;
    case 'center': y = canvas.height / 2; break;
    default: y = canvas.height - 20; // bottom
  }

  // Templates extras
  if (template === 'saynomore') {
    ctx.font = '24px Impact';
    ctx.fillStyle = '#ff0000';
    ctx.strokeText('Say No More', canvas.width / 2, 50);
  } else if (template === 'drake') {
    ctx.font = '24px Impact';
    ctx.fillStyle = '#ffff00';
    ctx.strokeText('Drake aprova', canvas.width / 2, 50);
  }

  // Adicionar o texto principal
  ctx.strokeText(text, canvas.width / 2, y);
  ctx.fillText(text, canvas.width / 2, y);

  const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'avatar.png' });
  await interaction.reply({ files: [attachment] });
}
