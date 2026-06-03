// js/minigameFishing.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { spendEnergy, addExperience, inventory, updateUI, addLogEntry, money, setStats } from './gameState.js';
import { itemsDB } from './inventory.js';

let fishingModal = null;
let fishingIframe = null;

// ========== ДОБАВЛЯЕМ РЫБУ В БАЗУ ПРЕДМЕТОВ ==========
export function initFishingItems() {
    if (!itemsDB.fish_small) {
        itemsDB.fish_small = {
            id: "fish_small",
            name: "Мелкая рыбёшка",
            type: "food",
            icon: "🐟",
            image: "images/items/fish_small.png",
            effect: { hunger: 10, health: 0, cold: 0, intoxication: 0 },
            price: 15,
            slot: null,
            description: "Восстанавливает 10 голода"
        };
    }
    if (!itemsDB.fish_medium) {
        itemsDB.fish_medium = {
            id: "fish_medium",
            name: "Средняя рыба",
            type: "food",
            icon: "🐠",
            image: "images/items/fish_medium.png",
            effect: { hunger: 20, health: 0, cold: 0, intoxication: 0 },
            price: 30,
            slot: null,
            description: "Восстанавливает 20 голода"
        };
    }
    if (!itemsDB.fish_big) {
        itemsDB.fish_big = {
            id: "fish_big",
            name: "Крупная рыба",
            type: "food",
            icon: "🐡",
            image: "images/items/fish_big.png",
            effect: { hunger: 35, health: 0, cold: 0, intoxication: 0 },
            price: 50,
            slot: null,
            description: "Восстанавливает 35 голода"
        };
    }
    if (!itemsDB.fish_carp) {
        itemsDB.fish_carp = {
            id: "fish_carp",
            name: "Сазан",
            type: "food",
            icon: "🎏",
            image: "images/items/fish_carp.png",
            effect: { hunger: 50, health: 5, cold: 0, intoxication: 0 },
            price: 100,
            slot: null,
            description: "Восстанавливает 50 голода, +5 здоровья"
        };
    }
    if (!itemsDB.fish_pike) {
        itemsDB.fish_pike = {
            id: "fish_pike",
            name: "Щука",
            type: "food",
            icon: "🐊",
            image: "images/items/fish_pike.png",
            effect: { hunger: 60, health: 10, cold: 0, intoxication: 0 },
            price: 150,
            slot: null,
            description: "Восстанавливает 60 голода, +10 здоровья"
        };
    }
    if (!itemsDB.fish_sword) {
        itemsDB.fish_sword = {
            id: "fish_sword",
            name: "Рыба-меч",
            type: "food",
            icon: "🗡️🐟",
            image: "images/items/fish_sword.png",
            effect: { hunger: 100, health: 30, cold: 0, intoxication: 0 },
            price: 500,
            slot: null,
            description: "Восстанавливает 100 голода, +30 здоровья! Легендарная рыба!"
        };
    }
}

// ========== НАГРАДЫ ЗА РЫБАЛКУ ==========
const fishingRewards = {
    common: [
        { id: "fish_small", name: "Мелкая рыбёшка", icon: "🐟", hunger: 10, price: 15, exp: 10, count: 1 },
        { id: "fish_medium", name: "Средняя рыба", icon: "🐠", hunger: 20, price: 30, exp: 15, count: 1 },
        { id: "fish_big", name: "Крупная рыба", icon: "🐡", hunger: 35, price: 50, exp: 20, count: 1 }
    ],
    rare: [
        { id: "fish_carp", name: "Сазан", icon: "🎏", hunger: 50, price: 100, exp: 30, count: 1 },
        { id: "fish_pike", name: "Щука", icon: "🐊", hunger: 60, price: 150, exp: 40, count: 1 }
    ],
    legendary: [
        { id: "fish_sword", name: "Рыба-меч", icon: "🗡️🐟", hunger: 100, price: 500, exp: 100, count: 1 }
    ]
};

// ========== ВЫДАТЬ НАГРАДУ ==========
function giveReward(isSuccess) {
    if (!isSuccess) {
        showMessage("💔 Леска порвалась! Рыба уплыла...", "#e74c3c");
        addLogEntry("🎣 Рыбалка: леска порвалась, рыба ушла", 'system');
        return null;
    }
    
    // Определяем редкость
    const rand = Math.random();
    let rewardPool;
    let rarityName;
    let expGain = 10;
    
    if (rand < 0.05) { // 5% легендарная
        rewardPool = fishingRewards.legendary;
        rarityName = "Легендарная";
        expGain = 100;
    } else if (rand < 0.25) { // 20% редкая (увеличил до 20% для баланса)
        rewardPool = fishingRewards.rare;
        rarityName = "Редкая";
        expGain = 40;
    } else { // 75% обычная
        rewardPool = fishingRewards.common;
        rarityName = "Обычная";
        expGain = 15;
    }
    
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    
    // Добавляем в инвентарь
    const existingItem = inventory.find(i => i.id === reward.id);
    if (existingItem) {
        existingItem.count += reward.count;
    } else {
        inventory.push({ id: reward.id, count: reward.count });
    }
    
    // Добавляем опыт
    addExperience(expGain);
    
    updateUI();
    saveGameData();
    
    showMessage(`🎣 Вы поймали ${rarityName} ${reward.name}! +${expGain} опыта`, "#4caf50");
    addLogEntry(`🎣 Рыбалка: поймана ${rarityName} ${reward.name} (+${expGain} опыта)`, 'item');
    
    return reward;
}

// ========== ОТКРЫТЬ МИНИ-ИГРУ ==========
export async function openFishingGame() {
    // Проверка энергии
    const gameState = await import('./gameState.js');
    if (!gameState.hasEnoughEnergy(15)) {
        showMessage("❌ Не хватает энергии! Нужно 15⚡", "#e74c3c");
        return;
    }
    
    gameState.spendEnergy(15);
    
    // Создаём модальное окно
    if (fishingModal) {
        fishingModal.remove();
        fishingModal = null;
    }
    
    fishingModal = document.createElement('div');
    fishingModal.id = 'fishingGameModal';
    fishingModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
    `;
    
    // Создаём iframe для игры
    fishingIframe = document.createElement('iframe');
    fishingIframe.src = '/fishing-game.html';
    fishingIframe.style.cssText = `
        width: 100%;
        height: 100%;
        max-width: 1100px;
        max-height: 800px;
        border: none;
        border-radius: 28px;
        box-shadow: 0 0 30px rgba(0,0,0,0.5);
    `;
    
    fishingModal.appendChild(fishingIframe);
    document.body.appendChild(fishingModal);
    
    // Обработчик закрытия игры
    const handleClose = () => {
        closeFishingGame();
    };
    
    // Ждём загрузки iframe и устанавливаем колбэки
    fishingIframe.onload = () => {
        // Отправляем колбэки в iframe
        const iframeWindow = fishingIframe.contentWindow;
        if (iframeWindow && iframeWindow.setFishingCallbacks) {
            iframeWindow.setFishingCallbacks(
                () => { // onSuccess
                    giveReward(true);
                    setTimeout(() => closeFishingGame(), 1500);
                },
                () => { // onFail
                    giveReward(false);
                    setTimeout(() => closeFishingGame(), 1500);
                }
            );
        }
    };
    
    // Слушаем событие закрытия из iframe
    window.addEventListener('message', function onMessage(event) {
        if (event.data === 'closeFishingGame') {
            closeFishingGame();
            window.removeEventListener('message', onMessage);
        }
    });
    
    // Закрытие по Escape
    const closeHandler = (e) => {
        if (e.key === 'Escape') {
            closeFishingGame();
        }
    };
    window.addEventListener('keydown', closeHandler);
    fishingModal._closeHandler = closeHandler;
}

function closeFishingGame() {
    if (fishingModal) {
        if (fishingModal._closeHandler) {
            window.removeEventListener('keydown', fishingModal._closeHandler);
        }
        fishingModal.remove();
        fishingModal = null;
        fishingIframe = null;
    }
}

// Инициализируем предметы при загрузке
initFishingItems();
