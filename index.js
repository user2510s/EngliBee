import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadUsers, saveUsers } from './utils/userData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Coleção de comandos
client.commands = new Collection();

// Caminho da pasta de comandos
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Carrega os comandos dinamicamente
const commands = [];
for (const file of commandFiles) {
  const command = await import(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// Registra comandos no Discord (slash commands)
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log('📦 Atualizando comandos...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Comandos atualizados com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }
})();

// Quando o bot ficar online
client.once('ready', async () => {
  console.log(`🤖 Logado como ${client.user.tag}`);

  // Presença completa com todas as opções
  client.user.setPresence({
    activities: [{
      name: 'Aprendendo Inglês',
      type: ActivityType.Playing,
      url: 'https://www.twitch.tv/seu_canal', // Apenas para Streaming
    }],
    status: 'online', // online, idle, dnd, invisible
  });

  // EXEMPLO: Activities rotativas com diferentes configurações
  const activities = [
    {
      name: 'Aprendendo Inglês',
      type: ActivityType.Playing,
      status: 'online'
    },
    //{
      //name: `${client.guilds.cache.size} servidores`,
      //type: ActivityType.Watching,
      //status: 'online'
    //},
     {
      name: `EngliBee🐝`,
      type: ActivityType.Watching,
      status: 'online'
    },
    {
      name: 'Use /help para ajuda',
      type: ActivityType.Listening,
      status: 'online'
    },
    {
      name: 'Quiz de Vocabulário',
      type: ActivityType.Competing,
      status: 'online'
    }
  ];

  let i = 0;
  setInterval(() => {
    const activity = activities[i];
    client.user.setPresence({
      activities: [{ 
        name: activity.name, 
        type: activity.type 
      }],
      status: activity.status
    });
    i = (i + 1) % activities.length;
  }, 60000); // Muda a cada 30 segundos

  // Função async para carregar usuários
  try {
    await loadUsers();
    console.log('Usuários carregados com sucesso!');
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
});


// Quando o bot for desligado ou reiniciado, salva dados
process.on('SIGINT', async () => {
  console.log('\n💾 Salvando dados antes de encerrar...');
  await saveUsers();
  process.exit(0);
});

// Quando um comando for usado
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Erro ao executar comando:', error);
    await interaction.reply({ content: '❌ Ocorreu um erro ao executar esse comando.', ephemeral: true });
  }
});

client.login(process.env.TOKEN);