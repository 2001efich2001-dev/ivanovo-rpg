// js/npcSystem.js
import { showMessage, logAction } from './utils.js';
import { money, inventory, setStats, updateUI, addLogEntry } from './gameState.js';
import { saveGameData } from './firestore.js';

// ========== БАЗА ДАННЫХ NPC ==========
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
        
        // Диалоги
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
        
        // Товары для продажи (игрок покупает у NPC) - с maxStock для восстановления
        shop_items: [
            { id: 'old_hat', price: 10, stock: 999, maxStock: 999 },
            { id: 'empty_bottle', price: 5, stock: 999, maxStock: 999 },
            { id: 'cigarettes', price: 15, stock: 10, maxStock: 10 },
            { id: 'medkit', price: 30, stock: 3, maxStock: 3 }
        ],
        
        // Товары для покупки (NPC покупает у игрока)
        buy_items: [
            { id: 'empty_bottle', price: 3 },
            { id: 'old_boot', price: 2 },
            { id: 'rusty_can', price: 1 }
        ],
        
        // Квесты NPC с кулдауном 24 часа
        quests: [
            {
                id: 'hobo_collect_bottles',
                name: 'Сбор бутылок для Семёна',
                description: 'Принеси 5 пустых бутылок. Семён сдаст их в пункт приёма.',
                requirement: { item: 'empty_bottle', count: 5 },
                reward: { money: 50, exp: 15 },
                cooldown: 24 * 60 * 60 * 1000 // 24 часа
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

// ========== СОСТОЯНИЕ NPC (СТОК + КВЕСТЫ) ==========
let npcState = {
    shopStock: {},      // { npcId: { itemId: stock } }
    questCooldowns: {}, // { npcId: { questId: lastCompletedAt } }
    lastRestock: {}     // { npcId: timestamp }
};

// Ключ для localStorage
const STORAGE_KEY = 'npc_state';

// ========== ЗАГРУЗКА / СОХРАНЕНИЕ СОСТОЯНИЯ ==========
export function loadNpcState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            npcState.shopStock = parsed.shopStock || {};
            npcState.questCooldowns = parsed.questCooldowns || {};
            npcState.lastRestock = parsed.lastRestock || {};
            console.log('📦 Загружено состояние NPC');
            return;
        }
    } catch (e) {
        console.warn('Ошибка загрузки состояния NPC:', e);
    }
    
    // Если ничего не загрузилось — инициализируем
    initializeNpcState();
}

function initializeNpcState() {
    for (const [npcId, npc] of Object.entries(npcDB)) {
        npcState.shopStock[npcId] = {};
        npc.shop_items.forEach(item => {
            npcState.shopStock[npcId][item.id] = item.stock;
        });
        npcState.questCooldowns[npcId] = {};
        npcState.lastRestock[npcId] = null;
    }
    saveNpcState();
    console.log('🆕 Состояние NPC инициализировано');
}

export function saveNpcState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            shopStock: npcState.shopStock,
            questCooldowns: npcState.questCooldowns,
            lastRestock: npcState.lastRestock
        }));
    } catch (e) {
        console.warn('Ошибка сохранения состояния NPC:', e);
    }
}

// ========== УПРАВЛЕНИЕ СТОКОМ ==========
export function checkAndRestockNpc(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return false;
    
    const now = Date.now();
    const lastRestock = npcState.lastRestock[npcId] || 0;
    const RESTOCK_INTERVAL = 24 * 60 * 60 * 1000; // 24 часа
    
    if (now - lastRestock >= RESTOCK_INTERVAL) {
        // Восстанавливаем сток
        npc.shop_items.forEach(item => {
            if (item.maxStock !== undefined) {
                npcState.shopStock[npcId][item.id] = item.maxStock;
            }
        });
        npcState.lastRestock[npcId] = now;
        saveNpcState();
        console.log(`🔄 Сток у ${npc.name} обновлён!`);
        return true;
    }
    return false;
}

export function getItemStock(npcId, itemId) {
    const npc = npcDB[npcId];
    if (!npc) return 0;
    checkAndRestockNpc(npcId);
    return npcState.shopStock[npcId]?.[itemId] ?? 0;
}

export function decreaseItemStock(npcId, itemId) {
    const currentStock = getItemStock(npcId, itemId);
    if (currentStock <= 0) return false;
    npcState.shopStock[npcId][itemId] = currentStock - 1;
    saveNpcState();
    return true;
}

// ========== УПРАВЛЕНИЕ КВЕСТАМИ С КУЛДАУНОМ ==========
export function getNpcQuests(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return [];
    
    const now = Date.now();
    const cooldowns = npcState.questCooldowns[npcId] || {};
    
    return npc.quests.filter(quest => {
        const lastCompleted = cooldowns[quest.id] || 0;
        const cooldown = quest.cooldown || 24 * 60 * 60 * 1000;
        return now - lastCompleted >= cooldown;
    });
}

export function markQuestCompleted(npcId, questId) {
    if (!npcState.questCooldowns[npcId]) {
        npcState.questCooldowns[npcId] = {};
    }
    npcState.questCooldowns[npcId][questId] = Date.now();
    saveNpcState();
}

export function getQuestCooldownRemaining(npcId, questId) {
    const npc = npcDB[npcId];
    if (!npc) return 0;
    
    const cooldowns = npcState.questCooldowns[npcId] || {};
    const lastCompleted = cooldowns[questId] || 0;
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return 0;
    
    const cooldown = quest.cooldown || 24 * 60 * 60 * 1000;
    const remaining = (lastCompleted + cooldown) - Date.now();
    return Math.max(0, remaining);
}

// ========== ДЛЯ СОВМЕСТИМОСТИ ==========
export function loadNpcQuests(data) {
    if (data) {
        for (const [npcId, quests] of Object.entries(data)) {
            if (!npcState.questCooldowns[npcId]) {
                npcState.questCooldowns[npcId] = {};
            }
            for (const questId of quests) {
                if (!npcState.questCooldowns[npcId][questId]) {
                    npcState.questCooldowns[npcId][questId] = Date.now();
                }
            }
        }
        saveNpcState();
    }
}

export function saveNpcQuests() {
    const result = {};
    for (const [npcId, cooldowns] of Object.entries(npcState.questCooldowns)) {
        result[npcId] = Object.keys(cooldowns);
    }
    return result;
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

// ========== ОБРАБОТКА ВЫБОРА В ДИАЛОГЕ ==========
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
    const npc = npcDB[npcId];
    if (!npc) return false;
    
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return false;
    
    // Проверяем доступность квеста (не на кулдауне)
    const availableQuests = getNpcQuests(npcId);
    if (!availableQuests.find(q => q.id === questId)) {
        const remaining = getQuestCooldownRemaining(npcId, questId);
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        showMessage(`⏳ Квест будет доступен через ${hours}ч ${minutes}м`, '#ffd966');
        return false;
    }
    
    const requirement = quest.requirement;
    let canComplete = false;
    
    if (requirement.item) {
        const item = inventory.find(i => i.id === requirement.item);
        if (item && item.count >= requirement.count) {
            canComplete = true;
        }
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
    
    // Отмечаем квест как выполненный (ставим кулдаун)
    markQuestCompleted(npcId, questId);
    await saveGameData();
    updateUI();
    logAction(`✅ Выполнен квест NPC: ${quest.name}`, 'quest');
    
    // Показываем время до следующего выполнения
    const remaining = getQuestCooldownRemaining(npcId, questId);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    if (remaining > 0) {
        showMessage(`⏳ Квест будет доступен снова через ${hours}ч ${minutes}м`, '#ffd966');
    }
    
    return true;
}
