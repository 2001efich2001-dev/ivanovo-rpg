// js/npcSystem.js
import { showMessage } from './utils.js';
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
        
        // Товары для продажи (игрок покупает у NPC)
        shop_items: [
            { id: 'old_hat', price: 10, stock: 999 },
            { id: 'empty_bottle', price: 5, stock: 999 },
            { id: 'cigarettes', price: 15, stock: 10 },
            { id: 'medkit', price: 30, stock: 3 }
        ],
        
        // Товары для покупки (NPC покупает у игрока)
        buy_items: [
            { id: 'empty_bottle', price: 3 },
            { id: 'old_boot', price: 2 },
            { id: 'rusty_can', price: 1 }
        ],
        
        // Квесты NPC
        quests: [
            {
                id: 'hobo_collect_bottles',
                name: 'Сбор бутылок для Семёна',
                description: 'Принеси 5 пустых бутылок. Семён сдаст их в пункт приёма.',
                requirement: { item: 'empty_bottle', count: 5 },
                reward: { money: 50, exp: 15 }
            },
            {
                id: 'hobo_find_boot',
                name: 'Найти ботинок',
                description: 'Семёну нужен второй ботинок. Принеси ему старый ботинок.',
                requirement: { item: 'old_boot', count: 1 },
                reward: { money: 30, exp: 10 }
            },
            {
                id: 'hobo_medkit',
                name: 'Лекарство для Семёна',
                description: 'Семён простудился. Принеси ему аптечку.',
                requirement: { item: 'medkit', count: 1 },
                reward: { money: 80, exp: 25, item: 'cigarettes' }
            }
        ]
    }
};

// Хранилище выполненных квестов
let completedNpcQuests = {};

// Загрузить выполненные квесты
export function loadNpcQuests(data) {
    if (data) completedNpcQuests = data;
}

// Сохранить выполненные квесты
export function saveNpcQuests() {
    return completedNpcQuests;
}

// Получить все диалоги NPC
export function getNpcDialogues(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return null;
    return npc.dialogues;
}

// Получить диалог по ID
export function getDialog(npcId, dialogId) {
    const npc = npcDB[npcId];
    if (!npc) return null;
    return npc.dialogues.find(d => d.id === dialogId) || null;
}

// Обработка выбора в диалоге
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

// Получить доступные квесты для NPC
export function getNpcQuests(npcId) {
    const npc = npcDB[npcId];
    if (!npc) return [];
    
    return npc.quests.filter(q => !completedNpcQuests[q.id]);
}

// Проверить и выполнить квест NPC
export async function checkNpcQuestProgress(npcId, questId) {
    const npc = npcDB[npcId];
    if (!npc) return false;
    
    const quest = npc.quests.find(q => q.id === questId);
    if (!quest) return false;
    
    if (completedNpcQuests[questId]) return false;
    
    const requirement = quest.requirement;
    let canComplete = false;
    
    if (requirement.item) {
        const item = inventory.find(i => i.id === requirement.item);
        if (item && item.count >= requirement.count) {
            canComplete = true;
        }
    }
    
    if (canComplete) {
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
        
        completedNpcQuests[questId] = true;
        await saveGameData();
        updateUI();
        addLogEntry(`✅ Выполнен квест NPC: ${quest.name}`, 'quest');
        
        return true;
    }
    
    return false;
}
