// js/achievements.js
import { showMessage, logAction } from './utils.js';
import { saveGameData } from './firestore.js';
import { addExperience, money, setStats, inventory, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';

// ========== БАЗА ДАННЫХ АЧИВОК ==========
export const achievementsDB = {
    first_blood: {
        id: "first_blood",
        name: "Первый рубль",
        description: "Заработать первые 100₽",
        icon: "💰",
        reward: { money: 50, exp: 10 },
        checkCondition: (stats) => stats.money >= 100
    },
    alcoholic_1: {
        id: "alcoholic_1",
        name: "Любитель пива",
        description: "Выпить 10 алкогольных напитков",
        icon: "🍺",
        reward: { money: 100, exp: 20 },
        checkCondition: (stats) => stats.totalAlcoholConsumed >= 10
    },
    alcoholic_2: {
        id: "alcoholic_2",
        name: "Профессионал",
        description: "Выпить 50 алкогольных напитков",
        icon: "🍷",
        reward: { money: 300, exp: 50 },
        checkCondition: (stats) => stats.totalAlcoholConsumed >= 50
    },
    alcoholic_3: {
        id: "alcoholic_3",
        name: "Легенда бара",
        description: "Выпить 100 алкогольных напитков",
        icon: "🏆",
        reward: { money: 500, exp: 100, item: "fanfurik" },
        checkCondition: (stats) => stats.totalAlcoholConsumed >= 100
    },
    brawler: {
        id: "brawler",
        name: "Уличный боец",
        description: "Выиграть 5 драк",
        icon: "👊",
        reward: { money: 100, exp: 30 },
        checkCondition: (stats) => stats.fightsWon >= 5
    },
    beggar: {
        id: "beggar",
        name: "Профессиональный бомж",
        description: "Попросить подаяние 50 раз",
        icon: "🥾",
        reward: { money: 200, exp: 40 },
        checkCondition: (stats) => stats.totalBegs >= 50
    },
    rich: {
        id: "rich",
        name: "Первая тысяча",
        description: "Накопить 10000₽",
        icon: "💎",
        reward: { money: 1000, exp: 100 },
        checkCondition: (stats) => stats.money >= 10000
    },
    traveler: {
        id: "traveler",
        name: "Исследователь",
        description: "Посетить все локации",
        icon: "🗺️",
        reward: { money: 150, exp: 30 },
        checkCondition: (stats) => stats.visitedLocations >= 6
    },
    hunger_games: {
        id: "hunger_games",
        name: "Голодный борец",
        description: "Выжить при голоде ≤10",
        icon: "🍗",
        reward: { money: 100, exp: 20 },
        checkCondition: (stats) => stats.hungerSurvived
    },
    intoxication_master: {
        id: "intoxication_master",
        name: "В зюзю",
        description: "Достичь опьянения 100%",
        icon: "🥴",
        reward: { money: 150, exp: 25 },
        checkCondition: (stats) => stats.maxIntoxication >= 100
    }
};

// ========== ХРАНЕНИЕ ДАННЫХ ИГРОКА ==========
export let achievements = {
    completed: {},      // { achievementId: timestamp }
    stats: {
        totalAlcoholConsumed: 0,
        fightsWon: 0,
        totalBegs: 0,
        visitedLocations: 0,
        hungerSurvived: false,
        maxIntoxication: 0
    }
};

// Установка данных при загрузке
export function setAchievementsData(data) {
    if (data) {
        achievements.completed = data.completed || {};
        achievements.stats = { ...achievements.stats, ...(data.stats || {}) };
    }
    console.log('🏆 Загружены достижения:', achievements);
}

// Получение данных для сохранения
export function getAchievementsData() {
    return {
        completed: achievements.completed,
        stats: achievements.stats
    };
}

// Обновление статистики (вызывать при действиях)
export async function updateAchievementStats(statName, value = 1) {
    if (!achievements.stats.hasOwnProperty(statName)) return;
    
    const oldValue = achievements.stats[statName];
    achievements.stats[statName] += value;
    
    console.log(`📊 Статистика обновлена: ${statName} = ${achievements.stats[statName]}`);
    
    // Проверяем ачивки после обновления
    await checkAchievements();
}

// Проверка и выдача ачивок
export async function checkAchievements() {
    const stats = {
        money: (await import('./gameState.js')).money,
        totalAlcoholConsumed: achievements.stats.totalAlcoholConsumed,
        fightsWon: achievements.stats.fightsWon,
        totalBegs: achievements.stats.totalBegs,
        visitedLocations: achievements.stats.visitedLocations,
        hungerSurvived: achievements.stats.hungerSurvived,
        maxIntoxication: achievements.stats.maxIntoxication
    };
    
    for (const [id, achievement] of Object.entries(achievementsDB)) {
        // Пропускаем уже полученные
        if (achievements.completed[id]) continue;
        
        // Проверяем условие
        if (achievement.checkCondition(stats)) {
            await unlockAchievement(id, achievement);
        }
    }
}

// Выдача ачивки
async function unlockAchievement(id, achievement) {
    console.log(`🏆 Ачивка разблокирована: ${achievement.name}`);
    
    // Отмечаем как полученную
    achievements.completed[id] = Date.now();
    
    // Начисляем награду
    const gameState = await import('./gameState.js');
    
    if (achievement.reward.money) {
        const newMoney = gameState.money + achievement.reward.money;
        gameState.setStats(null, null, null, newMoney);
        showMessage(`💰 +${achievement.reward.money}₽ за ачивку "${achievement.name}"`, '#ffd966');
    }
    
    if (achievement.reward.exp) {
        gameState.addExperience(achievement.reward.exp);
        showMessage(`⭐ +${achievement.reward.exp} опыта за ачивку "${achievement.name}"`, '#ffd966');
    }
    
    if (achievement.reward.item) {
        const idx = gameState.inventory.findIndex(i => i.id === achievement.reward.item);
        if (idx !== -1) {
            gameState.inventory[idx].count++;
        } else {
            gameState.inventory.push({ id: achievement.reward.item, count: 1 });
        }
        const itemName = itemsDB[achievement.reward.item]?.name || achievement.reward.item;
        showMessage(`🎁 +1 ${itemName} за ачивку "${achievement.name}"`, '#ffd966');
    }
    
    // Показываем уведомление
    showAchievementNotification(achievement);
    
    // Сохраняем
    gameState.updateUI();
    await saveGameData();
    
    // Обновляем вкладку ачивок (если открыта)
    const achievementsTab = document.getElementById('achievementsTab');
    if (achievementsTab && achievementsTab.style.display !== 'none') {
        renderAchievementsTab();
    }
    
    logAction(`🏆 Получено достижение: ${achievement.name}!`, 'system');
}

// Показать уведомление о получении ачивки
function showAchievementNotification(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-text">
            <div class="achievement-title">🏆 Достижение получено!</div>
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-desc">${achievement.description}</div>
        </div>
    `;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '10002';
    notification.style.animation = 'slideIn 0.5s ease';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// Рендер вкладки ачивок
export function renderAchievementsTab() {
    const container = document.getElementById('achievementsTab');
    if (!container) return;
    
    let html = '<div class="inventory-grid-header"><span>🏆 Достижения</span><span>🎯 Прогресс</span></div>';
    html += '<div class="achievements-grid">';
    
    for (const [id, achievement] of Object.entries(achievementsDB)) {
        const isUnlocked = achievements.completed[id];
        const unlockedClass = isUnlocked ? 'achievement-unlocked' : 'achievement-locked';
        
        html += `
            <div class="achievement-card ${unlockedClass}">
                <div class="achievement-card-icon">${achievement.icon}</div>
                <div class="achievement-card-info">
                    <div class="achievement-card-name">${achievement.name}</div>
                    <div class="achievement-card-desc">${achievement.description}</div>
                    ${!isUnlocked ? '<div class="achievement-card-locked">🔒 Не получено</div>' : '<div class="achievement-card-unlocked">✅ Получено!</div>'}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}
