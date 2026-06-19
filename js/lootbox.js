// js/lootbox.js
import { inventory, money, setStats, health, hunger, cold, addExperience, updateUI, addLogEntry } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

// ========== ПУЛЫ НАГРАД ==========
const lootPools = {
    bronze_box: {
        rewards: [
            { type: 'item', id: 'bread', count: 2, weight: 20, label: '🍞 2 хлеба', icon: '🍞' },
            { type: 'item', id: 'water', count: 2, weight: 20, label: '💧 2 воды', icon: '💧' },
            { type: 'item', id: 'medkit', count: 1, weight: 15, label: '💊 Аптечка', icon: '💊' },
            { type: 'item', id: 'cigarettes', count: 2, weight: 15, label: '🚬 2 сигареты', icon: '🚬' },
            { type: 'money', amount: [50, 150], weight: 15, label: '💰 50-150₽', icon: '💰' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 8, label: '⛓️ Золотая цепь', icon: '⛓️' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 5, label: '💍 Кольцо', icon: '💍' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 2, label: '🎖️ Легендарка', icon: '🎖️' },
        ],
        color: '#cd7f32',
        title: '📦 БРОНЗОВЫЙ ЯЩИК'
    },
    
    silver_box: {
        rewards: [
            { type: 'item', id: 'medkit', count: 2, weight: 15, label: '💊 2 аптечки', icon: '💊' },
            { type: 'item', id: 'vodka', count: 2, weight: 15, label: '🍾 2 водки', icon: '🍾' },
            { type: 'item', id: 'cigarettes', count: 3, weight: 15, label: '🚬 3 сигареты', icon: '🚬' },
            { type: 'money', amount: [300, 800], weight: 18, label: '💰 300-800₽', icon: '💰' },
            { type: 'money', amount: [1000, 2000], weight: 15, label: '💰 1000-2000₽', icon: '💰' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 8, label: '⛓️ Золотая цепь', icon: '⛓️' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 6, label: '💍 Кольцо', icon: '💍' },
            { type: 'item', id: 'leather_jacket', count: 1, weight: 4, label: '🧥 Кожаная куртка', icon: '🧥' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 4, label: '🎖️ Легендарка', icon: '🎖️' },
        ],
        color: '#c0c0c0',
        title: '🎁 СЕРЕБРЯНЫЙ ЯЩИК'
    },
    
    gold_box: {
        rewards: [
            { type: 'item', id: 'medkit', count: 3, weight: 10, label: '💊 3 аптечки', icon: '💊' },
            { type: 'item', id: 'vodka', count: 3, weight: 10, label: '🍾 3 водки', icon: '🍾' },
            { type: 'item', id: 'energetic', count: 3, weight: 10, label: '⚡ 3 энергетика', icon: '⚡' },
            { type: 'money', amount: [1000, 3000], weight: 15, label: '💰 1000-3000₽', icon: '💰' },
            { type: 'money', amount: [5000, 10000], weight: 12, label: '💰 5000-10000₽', icon: '💰' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 10, label: '⛓️ Золотая цепь', icon: '⛓️' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 8, label: '💍 Кольцо', icon: '💍' },
            { type: 'item', id: 'leather_jacket', count: 1, weight: 8, label: '🧥 Кожаная куртка', icon: '🧥' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 10, label: '🎖️ Легендарка', icon: '🎖️' },
            { type: 'item', id: 'legendary_medal', count: 2, weight: 7, label: '🎖️ 2 Легендарки', icon: '🎖️' },
        ],
        color: '#ffd700',
        title: '👑 ЗОЛОТОЙ ЯЩИК'
    }
};

// ========== ВЫБОР НАГРАДЫ ==========
function selectReward(boxType) {
    const pool = lootPools[boxType];
    if (!pool) return null;
    
    const totalWeight = pool.rewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const reward of pool.rewards) {
        random -= reward.weight;
        if (random <= 0) {
            return reward;
        }
    }
    return pool.rewards[0];
}

// ========== ВЫДАЧА НАГРАДЫ ==========
function giveReward(reward, boxType) {
    let rewardText = '';
    
    if (reward.type === 'item') {
        const existing = inventory.find(i => i.id === reward.id);
        if (existing) {
            existing.count += reward.count;
        } else {
            inventory.push({ id: reward.id, count: reward.count });
        }
        const itemName = itemsDB[reward.id]?.name || reward.id;
        rewardText = `${itemName} ×${reward.count}`;
        showMessage(`🎁 Вы получили: ${rewardText}`, '#4caf50');
    }
    
    if (reward.type === 'money') {
        const amount = Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0];
        const newMoney = money + amount;
        setStats(health, hunger, cold, newMoney);
        rewardText = `${amount}₽`;
        showMessage(`💰 Вы получили ${rewardText}`, '#4caf50');
    }
    
    const boxName = lootPools[boxType]?.title || boxType;
    addLogEntry(`🎁 Открыт ${boxName}: получено ${rewardText}`, 'item');
    
    updateUI();
    saveGameData();
}

// ========== ОТКРЫТЬ ЛУТБОКС ==========
export function openLootBox(boxType) {
    const pool = lootPools[boxType];
    if (!pool) {
        showMessage('❌ Неизвестный тип ящика', '#e74c3c');
        return;
    }
    
    const reward = selectReward(boxType);
    if (!reward) {
        showMessage('❌ Ошибка при открытии ящика', '#e74c3c');
        return;
    }
    
    showSlotMachine(pool, reward, boxType, () => {
        giveReward(reward, boxType);
    });
}

// ========== НОВАЯ МЕХАНИКА: СЛОТ-МАШИНА (бегущая строка) ==========
function showSlotMachine(pool, selectedReward, boxType, onComplete) {
    // Удаляем старую, если есть
    const old = document.getElementById('slotMachineContainer');
    if (old) old.remove();
    
    const container = document.createElement('div');
    container.id = 'slotMachineContainer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
    `;
    
    // Заголовок
    const title = document.createElement('div');
    title.textContent = pool.title;
    title.style.cssText = `
        color: ${pool.color};
        font-size: 2rem;
        font-weight: bold;
        margin-bottom: 20px;
        text-shadow: 0 0 20px ${pool.color}40;
    `;
    container.appendChild(title);
    
    // Контейнер с полосой прокрутки
    const trackContainer = document.createElement('div');
    trackContainer.style.cssText = `
        position: relative;
        width: 80%;
        max-width: 700px;
        height: 180px;
        background: rgba(0,0,0,0.6);
        border-radius: 20px;
        border: 3px solid ${pool.color};
        overflow: hidden;
        box-shadow: 0 0 40px ${pool.color}40;
        margin-bottom: 20px;
    `;
    
    // Зона выделения (рамка в центре)
    const highlight = document.createElement('div');
    highlight.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 120px;
        height: 160px;
        border: 4px solid #ffd700;
        border-radius: 16px;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.6), inset 0 0 30px rgba(255, 215, 0, 0.1);
        z-index: 10;
        pointer-events: none;
        animation: slotPulse 1s ease infinite;
    `;
    trackContainer.appendChild(highlight);
    
    // Бегущая строка
    const track = document.createElement('div');
    track.id = 'slotTrack';
    track.style.cssText = `
        display: flex;
        gap: 10px;
        padding: 10px 20px;
        height: 100%;
        align-items: center;
        transition: none;
        will-change: transform;
        position: relative;
        left: 0;
    `;
    trackContainer.appendChild(track);
    
    container.appendChild(trackContainer);
    
    // Кнопка "Крутить!"
    const spinBtn = document.createElement('button');
    spinBtn.textContent = '🎰 КРУТИТЬ!';
    spinBtn.style.cssText = `
        padding: 16px 48px;
        font-size: 1.5rem;
        font-weight: bold;
        background: linear-gradient(135deg, ${pool.color}, ${pool.color}cc);
        border: none;
        border-radius: 60px;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 4px 20px ${pool.color}60;
        transition: transform 0.2s;
        margin-bottom: 20px;
    `;
    spinBtn.onmouseenter = () => spinBtn.style.transform = 'scale(1.05)';
    spinBtn.onmouseleave = () => spinBtn.style.transform = 'scale(1)';
    container.appendChild(spinBtn);
    
    // Результат
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = `
        font-size: 1.5rem;
        font-weight: bold;
        color: #ffd966;
        min-height: 60px;
        text-align: center;
        padding: 10px 20px;
        background: rgba(0,0,0,0.5);
        border-radius: 60px;
        border: 1px solid ${pool.color};
    `;
    resultDiv.textContent = 'Нажми "Крутить!"';
    container.appendChild(resultDiv);
    
    document.body.appendChild(container);
    
    // 👇 Формируем список для отображения (дублируем для бесконечности)
    const allRewards = pool.rewards;
    const displayItems = [];
    // Берём 3 копии подряд, чтобы было много для прокрутки
    for (let rep = 0; rep < 3; rep++) {
        for (const r of allRewards) {
            displayItems.push(r);
        }
    }
    
    // Рендерим элементы
    function renderItems() {
        track.innerHTML = '';
        displayItems.forEach((item, idx) => {
            const div = document.createElement('div');
            div.style.cssText = `
                flex: 0 0 120px;
                height: 140px;
                background: rgba(255,255,255,0.08);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                border: 1px solid rgba(255,255,255,0.1);
                transition: all 0.3s;
            `;
            div.innerHTML = `
                <div style="font-size: 3rem;">${item.icon || '🎁'}</div>
                <div style="font-size: 0.7rem; color: #ccc; text-align: center; margin-top: 4px;">${item.label}</div>
            `;
            track.appendChild(div);
        });
    }
    renderItems();
    
    // Находим индекс выигравшего предмета в displayItems
    function findRewardIndex(reward) {
        // Сначала ищем по точному совпадению (для уникальных)
        for (let i = 0; i < displayItems.length; i++) {
            const item = displayItems[i];
            if (item.type === reward.type && item.id === reward.id && 
                item.count === reward.count && item.label === reward.label) {
                return i;
            }
        }
        // Если не нашли — ищем по label
        for (let i = 0; i < displayItems.length; i++) {
            if (displayItems[i].label === reward.label) {
                return i;
            }
        }
        return 0;
    }
    
    const targetIndex = findRewardIndex(selectedReward);
    // Смещаем так, чтобы целевой элемент оказался в центре (на позиции highlight)
    const itemWidth = 130; // 120 + 10 gap
    const containerWidth = trackContainer.offsetWidth || 700;
    const centerOffset = (containerWidth / 2) - (itemWidth / 2);
    const targetPosition = -(targetIndex * itemWidth - centerOffset);
    
    let isSpinning = false;
    let isFinished = false;
    
    spinBtn.addEventListener('click', () => {
        if (isSpinning || isFinished) return;
        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = '🌀 КРУЧУ...';
        resultDiv.textContent = '🌀 Колесо крутится...';
        resultDiv.style.color = '#ffd966';
        
        // Случайный сдвиг вперёд (минимум 3 полных прохода)
        const extraOffset = (Math.floor(Math.random() * 10) + 5) * itemWidth;
        const finalPosition = targetPosition - extraOffset;
        
        track.style.transition = `transform ${4 + Math.random() * 1}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        track.style.transform = `translateX(${finalPosition}px)`;
        
        setTimeout(() => {
            isSpinning = false;
            isFinished = true;
            spinBtn.disabled = false;
            
            spinBtn.textContent = '✅ ЗАКРЫТЬ';
            spinBtn.style.background = '#4caf50';
            spinBtn.style.boxShadow = '0 4px 20px rgba(76, 175, 80, 0.6)';
            
            resultDiv.textContent = `🎉 ВЫПАЛО: ${selectedReward.label}`;
            resultDiv.style.color = '#4caf50';
            
            // Подсвечиваем выигравший элемент
            const allItems = track.querySelectorAll('div');
            allItems.forEach((el, idx) => {
                if (idx === targetIndex) {
                    el.style.border = '3px solid #ffd700';
                    el.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
                    el.style.background = 'rgba(255, 215, 0, 0.15)';
                }
            });
            
            spinBtn.onclick = () => {
                if (container && container.remove) container.remove();
            };
            
            onComplete();
        }, 4500 + Math.random() * 1000);
    });
    
    // Закрытие только после вращения
    container.addEventListener('click', (e) => {
        if (e.target === container && isFinished) {
            container.remove();
        }
    });
    
    // Добавляем стили для анимации
    if (!document.getElementById('slotMachineStyles')) {
        const style = document.createElement('style');
        style.id = 'slotMachineStyles';
        style.textContent = `
            @keyframes slotPulse {
                0% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.05); }
                50% { box-shadow: 0 0 50px rgba(255, 215, 0, 0.8), inset 0 0 50px rgba(255, 215, 0, 0.1); }
                100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 20px rgba(255, 215, 0, 0.05); }
            }
        `;
        document.head.appendChild(style);
    }
}
