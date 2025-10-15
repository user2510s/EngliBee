import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import Canvas from 'canvas';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frases de memes brasileiros
const MEME_FRASES = [
  'É os guri 😎','Deu ruim! 💀','Tá tranquilo, tá favorável 😌',
  'QUE ISSO MEU FILHO CALMA 😳','Bora bill! 🚗💨','Tô rindo mas é de nervoso 😂',
  'Deixa o homem trabalhar 😤','Aí o corno chora 😭','Chama no probleminha 😏',
  'Isso aqui tá uma bagunça 😩','Hoje tem! 🔥','Se liga na responsa 😬'
];

export const data = new SlashCommandBuilder()
  .setName('beeameme')
  .setDescription('Coloca o avatar do usuário em um meme com chroma key 🐝')
  .addStringOption(option =>
    option.setName('meme')
      .setDescription('Escolha o meme base')
      .setRequired(true)
      .addChoices(
        { name: 'Meme 1', value: 'meme1' },
        { name: 'Meme 2', value: 'meme2' },
        { name: 'Meme 3', value: 'https://i.pinimg.com/1200x/2b/fc/52/2bfc52389bace6cf7fdcda28201b1be4.jpg' },
        { name: 'Meme 4', value: 'meme4' },
        { name: 'Meme 5', value: 'meme5' }
      )
  )
  .addUserOption(option =>
    option.setName('usuario')
      .setDescription('Usuário cujo avatar será usado')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const target = interaction.options.getUser('usuario') || interaction.user;
    const memeChoice = interaction.options.getString('meme');

    // === 1. Carrega avatar ===
    const avatarURL = target.displayAvatarURL({ extension: 'png', size: 512 });
    const avatarResp = await fetch(avatarURL);
    const avatarBuffer = await avatarResp.arrayBuffer();
    const avatar = await Canvas.loadImage(Buffer.from(avatarBuffer));

    // === 2. Carrega meme ===
    const memePath = path.join(__dirname, '../images/memes', `${memeChoice}.png`);
    if (!fs.existsSync(memePath)) return interaction.editReply('❌ Meme não encontrado.');
    const meme = await Canvas.loadImage(memePath);

    const canvas = Canvas.createCanvas(meme.width, meme.height);
    const ctx = canvas.getContext('2d');

    // === 3. Canvas auxiliar de baixa resolução para detectar chroma key ===
    const scale = 0.2; // processa 20% da resolução para economizar CPU
    const auxCanvas = Canvas.createCanvas(meme.width * scale, meme.height * scale);
    const auxCtx = auxCanvas.getContext('2d');
    auxCtx.drawImage(meme, 0, 0, auxCanvas.width, auxCanvas.height);
    const data = auxCtx.getImageData(0, 0, auxCanvas.width, auxCanvas.height).data;

    let minX = auxCanvas.width, minY = auxCanvas.height, maxX = 0, maxY = 0;
    const tolerance = 40;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (g > 120 && r < 120 && b < 120 && g - r > tolerance && g - b > tolerance) {
        const pixelIndex = i / 4;
        const x = pixelIndex % auxCanvas.width;
        const y = Math.floor(pixelIndex / auxCanvas.width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (minX >= maxX || minY >= maxY) {
      return interaction.editReply('❌ Não foi possível detectar a área verde no meme.');
    }

    // Ajusta coordenadas para a resolução original
    const areaX = minX / scale;
    const areaY = minY / scale;
    const areaWidth = (maxX - minX) / scale;
    const areaHeight = (maxY - minY) / scale;

    // === 4. Torna verde transparente (somente pixels visíveis) ===
    const memeCanvas = Canvas.createCanvas(meme.width, meme.height);
    const memeCtx = memeCanvas.getContext('2d');
    memeCtx.drawImage(meme, 0, 0);
    const memeData = memeCtx.getImageData(0, 0, meme.width, meme.height);
    for (let i = 0; i < memeData.data.length; i += 4) {
      const [r, g, b] = [memeData.data[i], memeData.data[i + 1], memeData.data[i + 2]];
      if (g > 120 && r < 120 && b < 120 && g - r > tolerance && g - b > tolerance) {
        memeData.data[i + 3] = 0;
      }
    }
    memeCtx.putImageData(memeData, 0, 0);

    // === 5. Desenha avatar esticado somente na área verde ===
    ctx.drawImage(avatar, areaX, areaY, areaWidth, areaHeight);

    // === 6. Desenha meme por cima ===
    ctx.drawImage(memeCanvas, 0, 0);

    // === 7. Adiciona frase BR ===
    const frase = MEME_FRASES[Math.floor(Math.random() * MEME_FRASES.length)];

    function wrapText(context, text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let line = words[0];
      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(line + ' ' + word).width;
        if (width < maxWidth) line += ' ' + word;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
      return lines;
    }

    let fontSize = Math.floor(meme.height / 10);
    ctx.font = `bold ${fontSize}px Impact`;
    let lines = wrapText(ctx, frase, meme.width * 0.9);
    while (lines.length > 2 || ctx.measureText(lines[0]).width > meme.width * 0.9) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Impact`;
      lines = wrapText(ctx, frase, meme.width * 0.9);
      if (fontSize < 10) break;
    }

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(4, fontSize / 8);

    let y = meme.height - fontSize * (lines.length - 0.5);
    const x = meme.width / 2;
    for (const line of lines) {
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
      y += fontSize * 1.1;
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'beeameme.png' });
    await interaction.editReply({ files: [attachment] });

  } catch (err) {
    console.error('Erro no comando /beeameme:', err);
    await interaction.editReply('❌ Ocorreu um erro ao gerar o meme.');
  }
}
