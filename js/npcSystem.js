// js/npcSystem.js
import { showMessage, logAction } from './utils.js';
import { money, inventory, setStats, updateUI, addLogEntry } from './gameState.js';
import { saveGameData, db } from './firestore.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';

// ========== БАЗА ДАННЫХ NPC (только статика) ==========
export const npcDB = {
    dump_hobo: {
        id: 'dump_hobo',
        name: '🗑️ Бомж Семён',
        location: 'dump',
        description: 'Старый бомж, который живёт на свалке. Знает все тайны этого места.',
        avatar: 'images/npc/hobo.png',
        position: { x: 300, y: 250 },
        width: 70,
        height: 100,
        actionId: 'talk_hobo',
        
        dialogues: [
            {
                id: 'greeting',
                text: 'Эй, путник! Чего тебе надо на свалке? Ты не похож на местного...',
                options: [
                    { text: '🗣️ Ты кто такой?', action: 'who_are_you' },
                    { text: '💰 Что тут можно найти?', action: 'info' },
                    { text: '🎒 Хочешь продать?', action: 'shop_buy' },
                    { text: '📜 Есть работа?', action: 'quest' },
                    { text: '👋 Пока, старик', action: 'goodbye' }
                ]
            },
            {
                id: 'who_are_you',
                text: 'Я Семён. Живу здесь уже 10 лет. Знаю каждую кучу мусора. Если надо найти что-то ценное — я помогу. За долю, конечно.',
                options: [
                    { text: '🔙 Назад', action: 'greeting' }
                ]
            },
            {
                id: 'info',
                text: 'Тут можно найти всё! Бутылки, старую одежду, иногда даже еду. Но главное — тут есть секретный тайник с редкими вещами. Но я скажу где, если поможешь мне.',
                options: [
                    { text: '🔙 Назад', action: 'greeting' }
                ]
            }
        ],
        
        shop_items: [
            { id: 'old_hat', price: 10, stock: 999, maxStock: 999 },
            { id: 'empty_bottle', price: 5, stock: 999, maxStock: 999 },
            { id: 'cigarettes', price: 15, stock: 10, maxStock: 10 },
            { id: 'medkit', price: 30, stock: 3, maxStock: 3 }
        ],
        
        buy_items: [
            { id: 'empty_bottle', price: 3 },
            { id: 'old_boot', price: 2 },
            { id: 'rusty_can', price: 1 }
        ],
        
        quests: [
            {
                id: 'hobo_collect_bottles',
                name: 'Сбор бутылок для Семёна',
                description: 'Принеси 5 пустых бутылок. Семён сдаст их в пункт приёма.',
                requirement: { item: 'empty_bottle', count: 5 },
                reward: { money: 50, exp: 15 },
                cooldown: 24 * 60 * 60 * 1000
            },
            {
                id: 'hobo_find_boot',
                name: 'Найти ботинок',
                description: 'Семёну нужен второй ботинок. Принеси ему старый ботинок.',
                requirement: { item: 'old_boot', count: 1 },
                reward: { money: 30, exp: 10 },
                cooldown: 24 * 60 * 60 * 1000
            },
            {
                id: 'hobo_medkit',
                name: 'Лекарство для Семёна',
                description: 'Семён простудился. Принеси ему аптечку.',
                requirement: { item: 'medkit', count: 1 },
                reward: { money: 80, exp: 25, item: 'cigarettes' },
                cooldown: 24 * 60 * 60 * 1000
            }
        ]
    }
};

// ========== КЛЮЧ В FIRESTORE ==========
const NPC_STATE_PATH = 'npcState';

// ========== ЗАГРУЗКА ИЗ FIRESTORE (всегда свежие данные) ==========
export async function loadNpcStateFromFirestore(userId) {
    if (!userId) {
        console.warn('❌ Нет userId для загрузки NPC состояния');
        return null;
    }
    
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            const savedState = data.npcState;
            
            if (savedState) {
                console.log('📦 Загружено состояние NPC из Firestore:', savedState);
                return savedState;
            } else {
                console.log('📦 Состояние NPC не найдено, создаём дефолтное');
                const defaultState = createDefaultState();
                await saveNpcStateToFirestore(userId, defaultState);
                return defaultState;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ Ошибка загрузки состояния NPC:', error);
        return null;
    }
}

// ========== СОЗДАНИЕ ДЕФОЛТНОГО СОСТОЯНИЯ ==========
function createDefaultState() {
    const state = {};
    for (const [npcId, npc] of Object.entries(npcDB)) {
        state[npcId] = {
            shopStock: {},
            questCooldowns: {},
            lastRestock: 0
        };
        npc.shop_items.forEach(item => {
            state[npcId].shopStock[item.id] = item.stock;
        });
    }
    return state;
}

// ========== СОХРАНЕНИЕ В FIRESTORE ==========
export async function saveNpcStateToFirestore(userId, state) {
    if (!userId) {
        console.warn('❌ Нет userId для сохранения NPC состояния');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { npcState: state }, { merge: true });
        console.log('💾 Состояние NPC сохранено в Firestore');
    } catch (error) {
        console.error('❌ Ошибка сохранения состояния NPC:', error);
    }
}

// ========== ПОЛУЧИТЬ ТЕКУЩИЙ СТОК ИЗ FIRESTORE (с обновлением 24ч) ==========
export async function getCurrentNpcState(userId) {
    if (!userId) return null;
    
    let state = await loadNpcStateFromFirestore(userId);
    if (!state) {
        state = createDefaultState();
        await saveNpcStateToFirestore(userId, state);
    }
    
    // Проверяем обновление стока (24 часа)
    const now = Date.now();
    let updated = false;
    
    for (const [npcId, npcState] of Object.entries(state)) {
        const lastRestock = npcState.lastRestock || 0;
        const npc = npcDB[npcId];
        if (!npc) continue;
        
        if (now - lastRestock >= 24 * 60 * 60 * 1000) {
            // Восстанавливаем сток
            npc.shop_items.forEach(item => {
                if (item.maxStock !== undefined) {
                    state[npcId].shopStock[item.id] = item.maxStock;
                }
            });
            state[npcId].lastRestock = now;
            updated = true;
            console.log(`🔄 Сток у ${npcId} обновлён!`);
        }
    }
    
    if (updated) {
        await saveNpcStateToFirestore(userId, state);
    }
    
    return state;
}

// ========== УМЕНЬШИТЬ СТОК ==========
export async function decreaseItemStockInFirestore(userId, npcId, itemId) {
    if (!userId) return false;
    
    const state = await loadNpcStateFromFirestore(userId);
    if (!state) return false;
    
    if (!state[npcId] || !state[npcId].shopStock) {
        return false;
    }
    
    const currentStock = state[npcId].shopStock[itemId] || 0;
    if (currentStock <= 0) return false;
    
    state[npcId].shopStock[itemId] = currentStock - 1;
    await saveNpcStateToFirestore(userId, state);
    
    return true;
}

// ========== ОТМЕТИТЬ КВЕСТ ВЫПОЛНЕННЫМ ==========
export async function markQuestCompletedInFirestore(userId, npcId, questId) {
    if (!userId) return;
    
    const state = await loadNpcStateFromFirestore(userId);
    if (!state) return;
    
    if (!state[npcId]) {
        state[npcId] = { shopStock: {}, questCooldowns: {}, lastRestock: 0 };
    }
    if (!state[npcId].questCooldowns) {
        state[npcId].questCooldowns = {};
    }
    
    state[npcId].questCooldowns[questId] = Date.now();
    await saveNpcStateToFirestore(userId, state);
}

// ========== ПОЛУЧИТЬ ДОСТУПНЫЕ КВЕСТЫ ==========
export async function getAvailableNpcQuests(userId, npcId) {
    const state = await loadNpcStateFromFirestore(userId);
    if (!state) return [];
    
    const npc = npcDB[npcId];
    if (!npc) return [];
    
    const now = Date.now();
    const cooldowns = state[npcId]?.questCooldowns || {};
    
    return npc.quests.filter(quest => {
        const lastCompleted = cooldowns[quest.id] || 0;
        const cooldown = quest.cooldown || 24 * 60 * 60 * 1000;
        return now - lastCompleted >= cooldown;
    });
}

// ========== ПОЛУЧИТЬ ВРЕМЯ ДО ОБНОВЛЕНИЯ КВЕСТА ==========
export async function getQuestCooldownRemaining(userId, npcId, questId) {
    const state = await loadNpcStateFromFirestore(userId);
    if (!state) return 0;
    
    const npc = npcDB[npcId];
    if (!npc) return 0;
    
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return 0;
    
    const cooldowns = state[npcId]?.questCooldowns || {};
    const lastCompleted = cooldowns[questId] || 0;
    const cooldown = quest.cooldown || 24 * 60 * 60 * 1000;
    const remaining = (lastCompleted + cooldown) - Date.now();
    return Math.max(0, remaining);
}

// ========== ДИАЛОГИ ==========
export function getNpcDialogues(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return null;
    return npc.dialogues;
}

export function getDialog(npcId, dialogId) {
    const npc = npcDB[npcId];
    if (!npc) return null;
    return npc.dialogues.find(d => d.id === dialogId) || null;
}

// ========== ОБРАБОТКА ВЫБОРА ==========
export async function handleNpcChoice(npcId, choiceAction, userId) {
    const npc = npcDB[npcId];
    if (!npc) {
        showMessage('NPC не найден', '#e74c3c');
        return null;
    }
    
    switch (choiceAction) {
        case 'who_are_you':
            return getDialog(npcId, 'who_are_you');
        case 'info':
            return getDialog(npcId, 'info');
        case 'shop_buy':
            return { type: 'shop', mode: 'buy' };
        case 'shop_sell':
            return { type: 'shop', mode: 'sell' };
        case 'quest':
            return { type: 'quest' };
        case 'goodbye':
            return { type: 'goodbye', text: '👋 Удачи, путник! Заходи ещё, если что.' };
        case 'greeting':
        default:
            return getDialog(npcId, 'greeting');
    }
}

// ========== ПРОВЕРКА И ВЫПОЛНЕНИЕ КВЕСТА ==========
export async function checkNpcQuestProgress(npcId, questId) {
    const user = window.auth?.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return false;
    }
    
    const npc = npcDB[npcId];
    if (!npc) return false;
    
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return false;
    
    // Проверяем доступность
    const availableQuests = await getAvailableNpcQuests(user.uid, npcId);
    if (!availableQuests.find(q => q.id === questId)) {
        const remaining = await getQuestCooldownRemaining(user.uid, npcId, questId);
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        showMessage(`⏳ Квест будет доступен через ${hours}ч ${minutes}м`, '#ffd966');
        return false;
    }
    
    const requirement = quest.requirement;
    let canComplete = false;
    
    if (requirement.item) {
        const item = inventory.find(i => i.id === requirement.item);
        if (item && item.count >= requirement.count) canComplete = true;
    }
    
    if (!canComplete) {
        const itemName = itemsDB[requirement.item]?.name || requirement.item;
        showMessage(`❌ У вас не хватает ${requirement.count}x ${itemName}`, '#e74c3c');
        return false;
    }
    
    // Забираем предметы
    const itemIndex = inventory.findIndex(i => i.id === requirement.item);
    if (itemIndex !== -1) {
        if (inventory[itemIndex].count === requirement.count) {
            inventory.splice(itemIndex, 1);
        } else {
            inventory[itemIndex].count -= requirement.count;
        }
    }
    
    // Выдаём награду
    if (quest.reward.money) {
        const newMoney = money + quest.reward.money;
        setStats(null, null, null, newMoney);
        showMessage(`💰 +${quest.reward.money}₽ за квест "${quest.name}"`, '#4caf50');
    }
    if (quest.reward.exp) {
        const { addExperience } = await import('./gameState.js');
        addExperience(quest.reward.exp);
        showMessage(`⭐ +${quest.reward.exp} опыта за квест "${quest.name}"`, '#4caf50');
    }
    if (quest.reward.item) {
        const existingItem = inventory.find(i => i.id === quest.reward.item);
        if (existingItem) {
            existingItem.count++;
        } else {
            inventory.push({ id: quest.reward.item, count: 1 });
        }
        const { itemsDB } = await import('./inventory.js');
        const itemName = itemsDB[quest.reward.item]?.name || quest.reward.item;
        showMessage(`🎁 +1 ${itemName} за квест "${quest.name}"`, '#4caf50');
    }
    
    // Отмечаем выполненным в Firestore
    await markQuestCompletedInFirestore(user.uid, npcId, questId);
    await saveGameData();
    updateUI();
    logAction(`✅ Выполнен квест NPC: ${quest.name}`, 'quest');
    
    // Показываем время до следующего выполнения
    const remaining = await getQuestCooldownRemaining(user.uid, npcId, questId);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    if (remaining > 0) {
        showMessage(`⏳ Квест будет доступен снова через ${hours}ч ${minutes}м`, '#ffd966');
    }
    
    return true;
}
