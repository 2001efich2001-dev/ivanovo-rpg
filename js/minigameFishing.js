// js/minigameFishing.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { spendEnergy, addExperience, inventory, updateUI, addLogEntry, money, setStats, hasEnoughEnergy, energy } from './gameState.js';
import { itemsDB } from './inventory.js';

let fishingModal = null;
let fishingIframe = null;
let isFishingOpen = false;

// ========== ДОБАВЛЯЕМ РЫБУ И МУСОР В БАЗУ ПРЕДМЕТОВ ==========
export function initFishingItems() {
    // ... (весь существующий код добавления предметов)
    // Рыба, мусор, удочка — всё остаётся без изменений
}

// ========== НАГРАДЫ ЗА РЫБАЛКУ (С МУСОРОМ) ==========
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
    ],
    trash: [
        { id: "old_boot", name: "Старый ботинок", icon: "👢", price: 0, exp: 5, count: 1 },
        { id: "rusty_can", name: "Ржавая банка", icon: "🥫", price: 0, exp: 5, count: 1 },
        { id: "torn_net", name: "Рваная сеть", icon: "🕸️", price: 0, exp: 5, count: 1 },
        { id: "plastic_bottle", name: "Пластиковая бутылка", icon: "🍾", price: 0, exp: 5, count: 1 },
        { id: "dirty_rag", name: "Грязная тряпка", icon: "🧽", price: 0, exp: 5, count: 1 }
    ]
};

// ========== ВЫДАТЬ НАГРАДУ ==========
function giveReward(isSuccess, caughtFish = null) {
    if (!isSuccess) {
        showMessage("💔 Леска порвалась! Рыба уплыла...", "#e74c3c");
        addLogEntry("🎣 Рыбалка: леска порвалась, рыба ушла", 'system');
        return null;
    }
    
    let reward = null;
    let rarityName = "";
    let expGain = 10;
    
    if (caughtFish && caughtFish.id) {
        const allRewards = [...fishingRewards.common, ...fishingRewards.rare, ...fishingRewards.legendary, ...fishingRewards.trash];
        reward = allRewards.find(r => r.id === caughtFish.id);
        
        if (reward) {
            if (caughtFish.type === "trash") {
                rarityName = "Мусор";
                expGain = 5;
            } else if (caughtFish.type === "legendary") {
                rarityName = "Легендарная";
                expGain = 100;
            } else if (caughtFish.type === "rare") {
                rarityName = "Редкая";
                expGain = 40;
            } else {
                rarityName = "Обычная";
                expGain = 15;
            }
        }
    }
    
    if (!reward) {
        const rand = Math.random();
        
        if (rand < 0.05) {
            const trashList = fishingRewards.trash;
            reward = trashList[Math.floor(Math.random() * trashList.length)];
            rarityName = "Мусор";
            expGain = 5;
        } else if (rand < 0.1) {
            reward = fishingRewards.legendary[0];
            rarityName = "Легендарная";
            expGain = 100;
        } else if (rand < 0.3) {
            const rareList = fishingRewards.rare;
            reward = rareList[Math.floor(Math.random() * rareList.length)];
            rarityName = "Редкая";
            expGain = 40;
        } else {
            const commonList = fishingRewards.common;
            reward = commonList[Math.floor(Math.random() * commonList.length)];
            rarityName = "Обычная";
            expGain = 15;
        }
    }
    
    if (!reward) return null;
    
    const existingItem = inventory.find(i => i.id === reward.id);
    if (existingItem) {
        existingItem.count += reward.count;
    } else {
        inventory.push({ id: reward.id, count: reward.count });
    }
    
    addExperience(expGain);
    
    updateUI();
    saveGameData();
    
    if (rarityName === "Мусор") {
        showMessage(`🗑️ Вы поймали ${reward.icon} ${reward.name}! +${expGain} опыта (мусор не стоит ничего)`, "#ffd966");
        addLogEntry(`🎣 Рыбалка: пойман мусор - ${reward.name} (+${expGain} опыта)`, 'item');
    } else {
        showMessage(`🎣 Вы поймали ${rarityName} ${reward.name}! +${expGain} опыта`, "#4caf50");
        addLogEntry(`🎣 Рыбалка: поймана ${rarityName} ${reward.name} (+${expGain} опыта)`, 'item');
    }
    
    return reward;
}

// ========== ОТКРЫТЬ МИНИ-ИГРУ ==========
export async function openFishingGame() {
    // Проверка энергии ПЕРЕД открытием
    const gameState = await import('./gameState.js');
    if (!gameState.hasEnoughEnergy(15)) {
        showMessage("❌ Не хватает энергии! Нужно 15⚡", "#e74c3c");
        return;
    }
    
    // Если окно уже открыто — не открываем новое
    if (isFishingOpen) {
        console.log('Окно рыбалки уже открыто');
        return;
    }
    
    gameState.spendEnergy(15);
    isFishingOpen = true;
    
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
    
    fishingIframe = document.createElement('iframe');
    fishingIframe.src = '/fishing-game.html';
    fishingIframe.style.cssText = `
        width: 100%;
        height: 100%;
        max-width: 1200px;
        max-height: 850px;
        border: none;
        border-radius: 28px;
        box-shadow: 0 0 30px rgba(0,0,0,0.5);
    `;
    
    fishingModal.appendChild(fishingIframe);
    document.body.appendChild(fishingModal);
    
    fishingIframe.onload = () => {
        const iframeWindow = fishingIframe.contentWindow;
        if (iframeWindow && iframeWindow.setFishingCallbacks) {
            iframeWindow.setFishingCallbacks(
                (caught) => {
                    giveReward(true, caught);
                    // НЕ ЗАКРЫВАЕМ ОКНО! Игрок может продолжать рыбачить
                },
                () => {
                    giveReward(false);
                    // НЕ ЗАКРЫВАЕМ ОКНО! Игрок может продолжать рыбачить
                }
            );
        }
    };
    
    // Слушаем событие закрытия из iframe (кнопка или ESC)
    const handleClose = () => {
        closeFishingGame();
    };
    
    window.addEventListener('message', function onMessage(event) {
        if (event.data === 'closeFishingGame') {
            closeFishingGame();
            window.removeEventListener('message', onMessage);
        }
    });
    
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
    isFishingOpen = false;
}

initFishingItems();
