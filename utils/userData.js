import fs from 'fs/promises';

const USERS_FILE = './data/users.json';
let users = {};
let saveScheduled = false;

// Carrega os dados na inicialização
export async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(data);
  } catch {
    users = {};
  }
  console.log(`✅ Dados de usuários carregados (${Object.keys(users).length})`);
}

// Função para obter ou criar um usuário
export function getUser(userId) {
  if (!users[userId]) {
    users[userId] = { xp: 0, level: 1, lessons_completed: 0 };
    scheduleSave();
  }
  return users[userId];
}

// Atualiza o usuário e agenda um salvamento
export function updateUser(userId, data) {
  users[userId] = { ...getUser(userId), ...data };
  scheduleSave();
}

// Salva com debounce para evitar sobrecarga
function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(async () => {
    await saveUsers();
    saveScheduled = false;
  }, 5000); // salva a cada 5 segundos
}

// Salva realmente o arquivo (com backup)
export async function saveUsers() {
  try {
    const backupPath = `${USERS_FILE}.bak`;
    await fs.writeFile(backupPath, JSON.stringify(users, null, 2)); // backup
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('❌ Erro ao salvar usuários:', err);
  }
}
