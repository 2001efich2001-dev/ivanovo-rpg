// js/questSystem.js
import { db, saveGameData } from './firestore.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { addExperience, money, setStats, inventory, updateUI } from './gameState.js';
import { questsDB, getQuestById, isStaticQuestCompleted, isDailyQuestCompleted, getDailyQuestProgress } from './quests.js';
import { itemsDB } from './inventory.js';

// ========== СТРУКТУРА ПРОГРЕССА ИГРОКА ==========
// users/{userId}: {
//     quests: {
//         completed: [],           // ID выполненных статических квестов
//         daily: {},               // прогресс дейликов
//         dailyLastReset: null,    // дата последнего сброса
//         race: {}                 // расовые квесты
//     }
// }

// ========== ЗАГРУЗИТЬ КВЕСТЫ ИГРОКА ==========
export async function loadPlayerQuests(userId) {
    if (!userId) return null;
    
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            const quests = userData.quests || {
                completed: [],
                daily: {},
                dailyLastReset: null,
                race: {}
            };
            
            // Проверяем необходимость сброса ежедневных квестов
            await checkAndResetDailyQuests(userId, quests);
            
            return quests;
        }
        
        // Новый игрок — создаём пустую структуру
        const emptyQuests = {
            completed: [],
            daily: {},
            dailyLastReset: null,
            race: {}
        };
        
        // Сохраняем в Firestore
        await updateDoc(userRef, { quests: emptyQuests });
        
        return emptyQuests;
        
    } catch (error) {
        console.error('Ошибка загрузки квестов:', error);
        return {
            completed: [],
            daily: {},
            dailyLastReset: null,
            race: {}
        };
    }
}

// ========== ПРОВЕРКА И СБРОС ЕЖЕДНЕВНЫХ КВЕСТОВ ==========
export async function checkAndResetDailyQuests(userId, quests) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastReset = quests.dailyLastReset ? new Date(quests.dailyLastReset) : null;
    
    // Если сброс был сегодня — ничего не делаем
    if (lastReset && lastReset.getTime() === today.getTime()) {
        return;
    }
    
    console.log('🔄 Ежедневные квесты сброшены');
    
    // Сбрасываем дейлики
    const newDaily = {};
    const dailyQuests = Object.values(questsDB).filter(q => q.type === 'daily');
    
    for (const quest of dailyQuests) {
        newDaily[quest.id] = {
            progress: 0,
            completed: false
        };
    }
    
    quests.daily = newDaily;
    quests.dailyLastReset = today.toISOString();
    
    // Сохраняем в Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        'quests.daily': newDaily,
        'quests.dailyLastReset': quests.dailyLastReset
    });
}

// ========== СОХРАНИТЬ КВЕСТЫ В FIRESTORE ==========
export async function savePlayerQuests(userId, quests) {
    if (!userId) return;
    
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { quests: quests });
    } catch (error) {
        console.error('Ошибка сохранения квестов:', error);
    }
}

// ========== ОБНОВИТЬ ПРОГРЕСС КВЕСТА ==========
export async function updateQuestProgress(statType, value = 1, context = {}) {
    const user = window.auth?.currentUser;
    if (!user) return;
    
    // Загружаем текущие квесты
    let quests = await loadPlayerQuests(user.uid);
    if (!quests) return;
    
    let updated = false;
    
    // Проверяем статические квесты
    const staticQuests = Object.values(questsDB).filter(q => q.type === 'static');
    
    for (const quest of staticQuests) {
        // Пропускаем уже выполненные
        if (quests.completed.includes(quest.id)) continue;
        
        const requirement = quest.requirements;
        let isCompleted = false;
        
        // Проверяем условие квеста
        switch (requirement.type) {
            case 'fishing':
                // Считаем пойманную рыбу (любую)
                if (statType === 'fishing') {
                    // Нужно накопить прогресс, но статические квесты не хранят прогресс
                    // Поэтому нужно считать по-другому — через отдельный счётчик
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'fights_won':
                if (statType === 'fights_won') {
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'trash_found':
                if (statType === 'trash_found') {
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'buy_property':
                if (statType === 'buy_property') {
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'money_reach':
                if (statType === 'money_reach') {
                    const { money } = await import('./gameState.js');
                    isCompleted = money >= requirement.targetMoney;
                }
                break;
                
            case 'pray_count':
                if (statType === 'pray_count') {
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'steal_success':
                if (statType === 'steal_success') {
                    isCompleted = await checkStaticQuestProgress(quest, statType, value);
                }
                break;
                
            case 'darts_win_with_intoxication':
                if (statType === 'darts_win') {
                    const { intoxication } = await import('./gameState.js');
                    if (context.score >= 300 && intoxication >= requirement.minIntoxication) {
                        isCompleted = true;
                    }
                }
                break;
                
            case 'darts_score':
                if (statType === 'darts_score' && context.score >= requirement.targetScore) {
                    isCompleted = true;
                }
                break;
                
            case 'catch_fish':
                if (statType === 'catch_fish' && context.fishId === requirement.fishId) {
                    isCompleted = true;
                }
                break;
        }
        
        if (isCompleted) {
            await completeStaticQuest(quest, user.uid, quests);
            updated = true;
        }
    }
    
    // Проверяем ежедневные квесты
    const dailyQuests = Object.values(questsDB).filter(q => q.type === 'daily');
    
    for (const quest of dailyQuests) {
        // Пропускаем уже выполненные сегодня
        if (quests.daily[quest.id]?.completed) continue;
        
        const requirement = quest.requirements;
        let progressNeeded = false;
        
        switch (requirement.type) {
            case 'fishing':
                if (statType === 'fishing') progressNeeded = true;
                break;
            case 'fights_won':
                if (statType === 'fights_won') progressNeeded = true;
                break;
            case 'trash_found':
                if (statType === 'trash_found') progressNeeded = true;
                break;
            case 'alcohol_consumed':
                if (statType === 'alcohol_consumed') progressNeeded = true;
                break;
            case 'pray_count':
                if (statType === 'pray_count') progressNeeded = true;
                break;
            case 'visit_location':
                if (statType === 'visit_location' && context.locationId === requirement.locationId) {
                    progressNeeded = true;
                }
                break;
        }
        
        if (progressNeeded) {
            const currentProgress = quests.daily[quest.id]?.progress || 0;
            const newProgress = Math.min(requirement.count, currentProgress + value);
            
            quests.daily[quest.id] = {
                progress: newProgress,
                completed: newProgress >= requirement.count
            };
            
            updated = true;
            
            if (quests.daily[quest.id].completed) {
                await completeDailyQuest(quest, user.uid, quests);
            }
        }
    }
    
    // Сохраняем изменения
    if (updated) {
        await savePlayerQuests(user.uid, quests);
    }
}

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СТАТИЧЕСКИХ КВЕСТОВ ==========
let staticQuestCounters = {};

async function checkStaticQuestProgress(quest, statType, value) {
    const user = window.auth?.currentUser;
    if (!user) return false;
    
    const key = `${user.uid}_${quest.id}`;
    staticQuestCounters[key] = (staticQuestCounters[key] || 0) + value;
    
    return staticQuestCounters[key] >= quest.requirements.count;
}

// ========== ВЫПОЛНИТЬ СТАТИЧЕСКИЙ КВЕСТ ==========
async function completeStaticQuest(quest, userId, quests) {
    if (quests.completed.includes(quest.id)) return;
    
    console.log(`🏆 Выполнен статический квест: ${quest.name}`);
    
    // Добавляем в список выполненных
    quests.completed.push(quest.id);
    
    // Выдаём награду
    await giveQuestReward(quest);
    
    // Показываем уведомление
    showQuestCompleteNotification(quest);
    
    // Сохраняем
    await savePlayerQuests(userId, quests);
}

// ========== ВЫПОЛНИТЬ ЕЖЕДНЕВНЫЙ КВЕСТ ==========
async function completeDailyQuest(quest, userId, quests) {
    console.log(`🏆 Выполнен ежедневный квест: ${quest.name}`);
    
    // Выдаём награду
    await giveQuestReward(quest);
    
    // Показываем уведомление
    showQuestCompleteNotification(quest);
    
    // Сохраняем
    await savePlayerQuests(userId, quests);
}

// ========== ВЫДАТЬ НАГРАДУ ЗА КВЕСТ ==========
async function giveQuestReward(quest) {
    const gameState = await import('./gameState.js');
    
    if (quest.rewards.money) {
        const newMoney = gameState.money + quest.rewards.money;
        gameState.setStats(null, null, null, newMoney);
        showMessage(`💰 +${quest.rewards.money}₽ за квест "${quest.name}"`, '#ffd966');
    }
    
    if (quest.rewards.exp) {
        gameState.addExperience(quest.rewards.exp);
        showMessage(`⭐ +${quest.rewards.exp} опыта за квест "${quest.name}"`, '#ffd966');
    }
    
    if (quest.rewards.health) {
        const newHealth = Math.min(gameState.maxHealth, gameState.health + quest.rewards.health);
        gameState.setStats(newHealth, gameState.hunger, gameState.cold, gameState.money);
        showMessage(`❤️ +${quest.rewards.health} здоровья за квест "${quest.name}"`, '#ffd966');
    }
    
    if (quest.rewards.item) {
        const existingItem = gameState.inventory.find(i => i.id === quest.rewards.item);
        if (existingItem) {
            existingItem.count++;
        } else {
            gameState.inventory.push({ id: quest.rewards.item, count: 1 });
        }
        const itemName = itemsDB[quest.rewards.item]?.name || quest.rewards.item;
        showMessage(`🎁 +1 ${itemName} за квест "${quest.name}"`, '#ffd966');
    }
    
    if (quest.rewards.title) {
        showMessage(`🏷️ Вы получили титул "${quest.rewards.title}"!`, '#ffd966');
        // Титул можно сохранить в отдельное поле пользователя
    }
    
    gameState.updateUI();
    await saveGameData();
}

// ========== ПОКАЗАТЬ УВЕДОМЛЕНИЕ О ВЫПОЛНЕНИИ КВЕСТА ==========
function showQuestCompleteNotification(quest) {
    const notification = document.createElement('div');
    notification.className = 'quest-notification';
    notification.innerHTML = `
        <div class="quest-notification-icon">${quest.icon || '🏆'}</div>
        <div class="quest-notification-text">
            <div class="quest-notification-title">КВЕСТ ВЫПОЛНЕН!</div>
            <div class="quest-notification-name">${quest.name}</div>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #2c3e50, #1a2634);
        color: #ffd966;
        padding: 12px 20px;
        border-radius: 16px;
        z-index: 10002;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        border-left: 4px solid #ffd966;
        animation: slideInRight 0.3s ease, fadeOut 0.5s ease 3s forwards;
        font-family: inherit;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; visibility: hidden; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification && notification.remove) notification.remove();
    }, 3500);
}

// ========== ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ КВЕСТЫ ==========
export async function getAvailableQuests() {
    const user = window.auth?.currentUser;
    if (!user) return { static: [], daily: [], race: [] };
    
    const quests = await loadPlayerQuests(user.uid);
    
    // Статические (невыполненные)
    const staticQuests = Object.values(questsDB).filter(q => 
        q.type === 'static' && !quests.completed.includes(q.id)
    );
    
    // Ежедневные (невыполненные сегодня)
    const dailyQuests = Object.values(questsDB).filter(q => 
        q.type === 'daily' && !quests.daily[q.id]?.completed
    );
    
    // Расовые (ещё никто не выполнил)
    const raceQuests = Object.values(questsDB).filter(q => 
        q.type === 'race' && !quests.race[q.id]?.completed
    );
    
    return {
        static: staticQuests,
        daily: dailyQuests,
        race: raceQuests,
        completed: quests.completed,
        dailyProgress: quests.daily
    };
}

// ========== ПОЛУЧИТЬ ВЫПОЛНЕННЫЕ КВЕСТЫ ==========
export async function getCompletedQuests() {
    const user = window.auth?.currentUser;
    if (!user) return [];
    
    const quests = await loadPlayerQuests(user.uid);
    const completedQuests = [];
    
    for (const questId of quests.completed) {
        const quest = getQuestById(questId);
        if (quest) completedQuests.push(quest);
    }
    
    // Добавляем выполненные дейлики (сегодняшние)
    for (const [questId, progress] of Object.entries(quests.daily)) {
        if (progress.completed) {
            const quest = getQuestById(questId);
            if (quest) completedQuests.push({ ...quest, dailyProgress: progress.progress });
        }
    }
    
    return completedQuests;
}
