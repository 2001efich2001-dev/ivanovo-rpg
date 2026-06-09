// js/questSystem.js
import { db, saveGameData } from './firestore.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { addExperience, money, setStats, inventory, updateUI } from './gameState.js';
import { questsDB, getQuestById } from './quests.js';
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
            
            // Гарантируем, что все поля есть
            if (!quests.completed) quests.completed = [];
            if (!quests.daily) quests.daily = {};
            if (!quests.race) quests.race = {};
            
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
        await setDoc(userRef, { quests: emptyQuests }, { merge: true });
        
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
    
    // Выдаём награду (титулы сохранятся внутри)
    await giveQuestReward(quest, userId);
    
    // Показываем уведомление
    showQuestCompleteNotification(quest);
    
    // Сохраняем
    await savePlayerQuests(userId, quests);
}

// ========== ВЫПОЛНИТЬ ЕЖЕДНЕВНЫЙ КВЕСТ ==========
async function completeDailyQuest(quest, userId, quests) {
    console.log(`🏆 Выполнен ежедневный квест: ${quest.name}`);
    
    // Выдаём награду (титулы сохранятся внутри)
    await giveQuestReward(quest, userId);
    
    // Показываем уведомление
    showQuestCompleteNotification(quest);
    
    // Сохраняем
    await savePlayerQuests(userId, quests);
}

// ========== ВЫДАТЬ НАГРАДУ ЗА КВЕСТ (С СОХРАНЕНИЕМ ТИТУЛОВ) ==========
async function giveQuestReward(quest, userId) {
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
    
    // ===== ОБРАБОТКА ТИТУЛА С СОХРАНЕНИЕМ В FIRESTORE =====
    if (quest.rewards.title) {
        const title = quest.rewards.title;
        
        // Проверяем, есть ли уже такой титул
        if (!gameState.ownedTitles.includes(title)) {
            gameState.ownedTitles.push(title);
            
            // Если это первый титул — делаем его активным
            if (!gameState.currentTitle) {
                gameState.currentTitle = title;
            }
            
            showMessage(`🏷️ Вы получили титул "${title}"!`, '#ffd966');
            
            // Сохраняем титулы в Firestore
            if (userId) {
                try {
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        'titles.current': gameState.currentTitle,
                        'titles.owned': gameState.ownedTitles
                    });
                    console.log('🏷️ Титулы сохранены в Firestore:', gameState.ownedTitles);
                } catch (error) {
                    console.error('Ошибка сохранения титулов:', error);
                }
            }
            
            // Обновляем отображение титула в интерфейсе
            const titleSpan = document.getElementById('playerTitle');
            if (titleSpan) {
                titleSpan.textContent = gameState.currentTitle;
                titleSpan.style.display = 'inline-block';
            }
        } else {
            showMessage(`🏷️ Титул "${title}" уже есть в коллекции!`, '#ffd966');
        }
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

// ========== ОБНОВИТЬ ПРОГРЕСС КВЕСТА ==========
export async function updateQuestProgress(statType, value = 1, context = {}) {
    const user = window.auth?.currentUser;
    if (!user) return;
    
    let quests = await loadPlayerQuests(user.uid);
    if (!quests) return;
    
    let updated = false;
    
    // Проверяем статические квесты
    const staticQuests = Object.values(questsDB).filter(q => q.type === 'static');
    
    for (const quest of staticQuests) {
        if (quests.completed.includes(quest.id)) continue;
        
        const requirement = quest.requirements;
        let isCompleted = false;
        
        switch (requirement.type) {
            case 'fishing':
                if (statType === 'fishing') {
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
    
    if (updated) {
        await savePlayerQuests(user.uid, quests);
    }
}

// ========== ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ КВЕСТЫ ==========
export async function getAvailableQuests() {
    const user = window.auth?.currentUser;
    if (!user) return { static: [], daily: [], race: [] };
    
    const quests = await loadPlayerQuests(user.uid);
    
    const completedList = Array.isArray(quests?.completed) ? quests.completed : [];
    const dailyProgress = quests?.daily && typeof quests.daily === 'object' ? quests.daily : {};
    const raceProgress = quests?.race && typeof quests.race === 'object' ? quests.race : {};
    
    const staticQuests = Object.values(questsDB).filter(q => 
        q.type === 'static' && !completedList.includes(q.id)
    );
    
    const dailyQuests = Object.values(questsDB).filter(q => 
        q.type === 'daily' && !(dailyProgress[q.id] && dailyProgress[q.id].completed === true)
    );
    
    const raceQuests = Object.values(questsDB).filter(q => 
        q.type === 'race' && !(raceProgress[q.id] && raceProgress[q.id].completed === true)
    );
    
    console.log('📊 Загружены квесты:', {
        static: staticQuests.length,
        daily: dailyQuests.length,
        race: raceQuests.length,
        completedStatic: completedList.length
    });
    
    return {
        static: staticQuests,
        daily: dailyQuests,
        race: raceQuests,
        completed: completedList,
        dailyProgress: dailyProgress
    };
}

// ========== ПОЛУЧИТЬ ВЫПОЛНЕННЫЕ КВЕСТЫ ==========
export async function getCompletedQuests() {
    const user = window.auth?.currentUser;
    if (!user) return [];
    
    const quests = await loadPlayerQuests(user.uid);
    const completedQuests = [];
    
    const completedList = Array.isArray(quests?.completed) ? quests.completed : [];
    const dailyProgress = quests?.daily && typeof quests.daily === 'object' ? quests.daily : {};
    
    for (const questId of completedList) {
        const quest = getQuestById(questId);
        if (quest) completedQuests.push({ ...quest, type: 'static' });
    }
    
    for (const [questId, progress] of Object.entries(dailyProgress)) {
        if (progress && progress.completed === true) {
            const quest = getQuestById(questId);
            if (quest) {
                completedQuests.push({ 
                    ...quest, 
                    type: 'daily',
                    dailyProgress: progress.progress || 0 
                });
            }
        }
    }
    
    return completedQuests;
}
