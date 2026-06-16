// js/npcSystem.js
import { showMessage, logAction } from './utils.js';
import { money, inventory, setStats, updateUI, addLogEntry } from './gameState.js';
import { saveGameData, db } from './firestore.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';

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

// ========== СОСТОЯНИЕ NPC В FIRESTORE ==========
const NPC_STATE_KEY = 'npcState';

// Загрузить состояние NPC из Firestore
export async function loadNpcStateFromFirestore(userId) {
    if (!userId) return;
    
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const data = userSnap.data();
            const npcState = data.npcState;
            
            if (npcState) {
                // Восстанавливаем сток товаров
                for (const [npcId, state] of Object.entries(npcState)) {
                    const npc = npcDB[npcId];
                    if (npc && state.shopStock) {
                        npc.shop_items.forEach(item => {
                            if (state.shopStock[item.id] !== undefined) {
                                item.stock = state.shopStock[item.id];
                            }
                        });
                    }
                }
                console.log('📦 Состояние NPC загружено из Firestore');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки состояния NPC:', error);
    }
}

// Сохранить состояние NPC в Firestore
export async function saveNpcStateToFirestore(userId) {
    if (!userId) return;
    
    try {
        const npcState = {};
        
        for (const [npcId, npc] of Object.entries(npcDB)) {
            npcState[npcId] = {
                shopStock: {}
            };
            npc.shop_items.forEach(item => {
                npcState[npcId].shopStock[item.id] = item.stock;
            });
        }
        
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { npcState: npcState });
        console.log('💾 Состояние NPC сохранено в Firestore');
    } catch (error) {
        console.error('❌ Ошибка сохранения состояния NPC:', error);
    }
}

// ========== ОБНОВЛЕНИЕ СТОКА РАЗ В СУТКИ ==========
export function checkAndRestockNpc(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return false;
    
    // Проверяем, есть ли сохранённое время последнего обновления
    const now = Date.now();
    const lastRestock = npc._lastRestock || 0;
    const RESTOCK_INTERVAL = 24 * 60 * 60 * 1000; // 24 часа
    
    if (now - lastRestock >= RESTOCK_INTERVAL) {
        // Восстанавливаем сток до максимума
        npc.shop_items.forEach(item => {
            if (item.maxStock !== undefined) {
                item.stock = item.maxStock;
            }
        });
        npc._lastRestock = now;
        
        // Сохраняем в Firestore
        const user = window.auth?.currentUser;
        if (user) {
            saveNpcStateToFirestore(user.uid);
        }
        
        console.log(`🔄 Сток у ${npc.name} обновлён!`);
        return true;
    }
    return false;
}

// ========== ХРАНИЛИЩЕ ВЫПОЛНЕННЫХ КВЕСТОВ (с кулдаунами) ==========
let completedNpcQuests = {};

export function loadNpcQuests(data) {
    if (data) completedNpcQuests = data;
}

export function saveNpcQuests() {
    return completedNpcQuests;
}

// ========== КВЕСТЫ С КУЛДАУНОМ ==========
export function getNpcQuests(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return [];
    
    const now = Date.now();
    const cooldowns = completedNpcQuests[npcId] || {};
    
    return npc.quests.filter(quest => {
        const lastCompleted = cooldowns[quest.id] || 0;
        const cooldown = quest.cooldown || 24 * 60 * 60 * 1000;
        return now - lastCompleted >= cooldown;
    });
}

export function markQuestCompleted(npcId, questId) {
    if (!completedNpcQuests[npcId]) {
        completedNpcQuests[npcId] = {};
    }
    completedNpcQuests[npcId][questId] = Date.now();
}

export function getQuestCooldownRemaining(npcId, questId) {
    const npc = npcDB[npcId];
    if (!npc) return 0;
    
    const cooldowns = completedNpcQuests[npcId] || {};
    const lastCompleted = cooldowns[questId] || 0;
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return 0;
    
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
    
    // Отмечаем квест как выполненный (ставим кулдаун)
    markQuestCompleted(npcId, questId);
    await saveGameData();
    updateUI();
    logAction(`✅ Выполнен квест NPC: ${quest.name}`, 'quest');
    
    // Сохраняем состояние в Firestore
    const user = window.auth?.currentUser;
    if (user) {
        await saveNpcStateToFirestore(user.uid);
    }
    
    // Показываем время до следующего выполнения
    const remaining = getQuestCooldownRemaining(npcId, questId);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    if (remaining > 0) {
        showMessage(`⏳ Квест будет доступен снова через ${hours}ч ${minutes}м`, '#ffd966');
    }
    
    return true;
}
