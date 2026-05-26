// js/achievements.js
import { showMessage, logAction } from './utils.js';
import { saveGameData } from './firestore.js';
import { addExperience, money, setStats, inventory, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';

// Флаг для первичной проверки
let initialCheckDone = false;

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
export async function checkAchievements(force = false) {
    // При первом вызове после загрузки страницы проверяем всё
    // Но не показываем уведомления для уже полученных
    if (!force && initialCheckDone) {
        console.log('⚠️ Повторная проверка ачивок заблокирована');
        return;
    }
    initialCheckDone = true;
    
    const stats = {
        money: (await import('./gameState.js')).money,
        totalAlcoholConsumed: achievements.stats.totalAlcoholConsumed,
        fightsWon: achievements.stats.fightsWon,
        totalBegs: achievements.stats.totalBegs,
        visitedLocations: achievements.stats.visitedLocations,
        hungerSurvived: achievements.stats.hungerSurvived,
        maxIntoxication: achievements.stats.maxIntoxication
    };
    
    console.log('🔍 Проверка ачивок, уже полученные:', Object.keys(achievements.completed));
    
    for (const [id, achievement] of Object.entries(achievementsDB)) {
        const isCompleted = !!achievements.completed[id];
        const conditionMet = achievement.checkCondition(stats);
        
        console.log(`🔍 ${id}: получена=${isCompleted}, условие=${conditionMet}`);
        
        if (isCompleted) continue;
        
        if (conditionMet) {
            console.log(`🏆 Условие выполнено! Выдаём ${id}`);
            await unlockAchievement(id, achievement);
        }
    }
}

// Выдача ачивки
async function unlockAchievement(id, achievement) {
    // Жёсткая защита от повторного получения
    if (achievements.completed[id]) {
        console.log(`🔒 Ачивка "${achievement.name}" уже есть, пропускаем повторную выдачу`);
        return;
    }
    
    console.log(`🏆 Новая ачивка: ${achievement.name}`);
    
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
    // Проверяем, что ачивка действительно только что получена
    if (!achievements.completed[achievement.id]) {
        console.log('⚠️ Не показываем уведомление для ещё не полученной ачивки');
        return;
    }
    
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

// Рендер вкладки ачивок (сетка 5x4, как в инвентаре)
export function renderAchievementsTab() {
    const container = document.getElementById('achievementsTab');
    if (!container) return;
    
    let html = '<div class="inventory-grid" style="background: transparent; padding: 0;">';
    
    for (const [id, achievement] of Object.entries(achievementsDB)) {
        const isUnlocked = achievements.completed[id];
        
        html += `
            <div class="achievement-slot ${isUnlocked ? 'unlocked' : 'locked'}" 
                 data-id="${id}"
                 data-name="${achievement.name}"
                 data-desc="${achievement.description}"
                 data-reward-money="${achievement.reward.money || 0}"
                 data-reward-exp="${achievement.reward.exp || 0}"
                 data-reward-item="${achievement.reward.item || ''}">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                ${isUnlocked ? '<div class="achievement-check">✅</div>' : '<div class="achievement-lock">🔒</div>'}
            </div>
        `;
    }
    
    // Заполняем пустые ячейки до 20 (5x4)
    const itemsPerPage = 20;
    const remainingSlots = itemsPerPage - (Object.keys(achievementsDB).length % itemsPerPage);
    if (remainingSlots < itemsPerPage) {
        for (let i = 0; i < remainingSlots; i++) {
            html += `<div class="achievement-slot empty-slot">❓</div>`;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Добавляем тултипы для ачивок
    document.querySelectorAll('.achievement-slot:not(.empty-slot)').forEach(slot => {
        const isUnlocked = slot.classList.contains('unlocked');
        const name = slot.dataset.name;
        const desc = slot.dataset.desc;
        const rewardMoney = slot.dataset.rewardMoney;
        const rewardExp = slot.dataset.rewardExp;
        const rewardItem = slot.dataset.rewardItem;
        
        let rewardText = '';
        if (rewardMoney > 0) rewardText += `💰 +${rewardMoney}₽ `;
        if (rewardExp > 0) rewardText += `⭐ +${rewardExp} опыта `;
        if (rewardItem) rewardText += `🎁 +1 ${itemsDB[rewardItem]?.name || rewardItem}`;
        
        slot.addEventListener('mouseenter', (e) => {
            showAchievementTooltip(name, desc, rewardText, isUnlocked, e);
        });
        slot.addEventListener('mouseleave', hideAchievementTooltip);
        slot.addEventListener('mousemove', (e) => {
            if (activeAchievementTooltip) {
                activeAchievementTooltip.style.left = (e.clientX + 15) + 'px';
                activeAchievementTooltip.style.top = (e.clientY + 15) + 'px';
            }
        });
    });
}

let activeAchievementTooltip = null;

function showAchievementTooltip(name, desc, reward, isUnlocked, event) {
    hideAchievementTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip achievement-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${name}</strong>
        </div>
        <div class="tooltip-content">
            ${desc}
            <div class="tooltip-divider"></div>
            <div>🎁 Награда: ${reward || 'нет'}</div>
            <div class="tooltip-status ${isUnlocked ? 'status-unlocked' : 'status-locked'}">
                ${isUnlocked ? '✅ Получено!' : '🔒 Ещё не получено'}
            </div>
        </div>
    `;
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    tooltip.style.zIndex = '10001';
    
    document.body.appendChild(tooltip);
    activeAchievementTooltip = tooltip;
}

function hideAchievementTooltip() {
    if (activeAchievementTooltip && activeAchievementTooltip.remove) {
        activeAchievementTooltip.remove();
        activeAchievementTooltip = null;
    }
}
