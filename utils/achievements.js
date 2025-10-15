import { updateUser } from './userData.js';

export const achievementList = [
  { id: 'firstLesson', name: '🎉 Primeira Lição', condition: user => (user.lessons_completed || 0) >= 1 },
  { id: 'dailyStreak3', name: '🔥 3 Dias de Streak', condition: user => (user.daily_streak || 0) >= 3 },
  { id: 'dailyStreak7', name: '🔥 7 Dias de Streak', condition: user => (user.daily_streak || 0) >= 7 },
  { id: 'xp100', name: '💎 100 XP', condition: user => (user.xp || 0) >= 100 },
  { id: 'xp500', name: '💎 500 XP', condition: user => (user.xp || 0) >= 500 },
  { id: 'gift5', name: '🎁 Recebeu 5 Presentes', condition: user => (user.giftsReceived || 0) >= 5 },
  // Adicione mais conquistas aqui
];

// Função para checar e adicionar conquistas
export function checkAchievements(userId, user) {
  if (!user.achievements) user.achievements = {};

  const newlyUnlocked = [];

  for (const ach of achievementList) {
    if (!user.achievements[ach.id] && ach.condition(user)) {
      user.achievements[ach.id] = true;
      newlyUnlocked.push(ach.name);
    }
  }

  if (newlyUnlocked.length > 0) {
    updateUser(userId, user);
  }

  return newlyUnlocked; // retorna lista de conquistas desbloqueadas
}
