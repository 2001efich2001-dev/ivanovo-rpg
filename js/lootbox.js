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
    
    showCards(pool, reward, boxType, () => {
        giveReward(reward, boxType);
    });
}

// ========== НОВАЯ МЕХАНИКА: КАРТОЧКИ ==========
function showCards(pool, selectedReward, boxType, onComplete) {
    // Удаляем старую, если есть
    const old = document.getElementById('cardsContainer');
    if (old) old.remove();
    
    const container = document.createElement('div');
    container.id = 'cardsContainer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.88);
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
        font-size: 2.2rem;
        font-weight: bold;
        margin-bottom: 25px;
        text-shadow: 0 0 30px ${pool.color}50;
        letter-spacing: 2px;
    `;
    container.appendChild(title);
    
    // Контейнер с карточками
    const cardContainer = document.createElement('div');
    cardContainer.style.cssText = `
        display: flex;
        gap: 16px;
        margin-bottom: 30px;
        flex-wrap: wrap;
        justify-content: center;
        padding: 0 20px;
    `;
    
    // Берём 5 случайных наград + выигравшая на последнем месте
    const allRewards = pool.rewards;
    const shuffled = [...allRewards];
    // Перемешиваем
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Берём первые 4 из перемешанных
    const selectedCards = shuffled.slice(0, 4);
    // Добавляем выигравшую на 5-е место
    selectedCards.push(selectedReward);
    
    // Перемешиваем финальный порядок (чтобы выигрышная не всегда была последней)
    for (let i = selectedCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selectedCards[i], selectedCards[j]] = [selectedCards[j], selectedCards[i]];
    }
    
    // Запоминаем, где находится выигрышная карта
    let winningIndex = 0;
    for (let i = 0; i < selectedCards.length; i++) {
        if (selectedCards[i].label === selectedReward.label &&
            selectedCards[i].id === selectedReward.id) {
            winningIndex = i;
            break;
        }
    }
    
    const cards = [];
    const cardElements = [];
    
    selectedCards.forEach((reward, index) => {
        const isWinner = index === winningIndex;
        
        const card = document.createElement('div');
        card.className = 'loot-card';
        card.style.cssText = `
            width: 110px;
            height: 150px;
            background: #2c3e50;
            border-radius: 16px;
            border: 2px solid #444;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 3rem;
            cursor: default;
            transition: transform 0.5s ease, border-color 0.3s ease, box-shadow 0.3s ease;
            transform-style: preserve-3d;
            position: relative;
            perspective: 600px;
        `;
        card.dataset.index = index;
        card.dataset.isWinner = isWinner ? 'true' : 'false';
        
        // Лицевая сторона (рубашка)
        const front = document.createElement('div');
        front.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 3.5rem;
            background: linear-gradient(135deg, #2c3e50, #1a2634);
            border-radius: 16px;
            border: 2px solid ${pool.color};
            box-shadow: inset 0 0 30px ${pool.color}20;
        `;
        front.textContent = '🎁';
        card.appendChild(front);
        
        // Оборотная сторона (награда)
        const back = document.createElement('div');
        back.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backface-visibility: hidden;
            transform: rotateY(180deg);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: ${isWinner ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.05)'};
            border-radius: 16px;
            border: 2px solid ${isWinner ? '#ffd700' : '#444'};
            padding: 8px;
            box-sizing: border-box;
        `;
        back.innerHTML = `
            <div style="font-size: 2.8rem; margin-bottom: 4px;">${reward.icon || '🎁'}</div>
            <div style="font-size: 0.6rem; color: ${isWinner ? '#ffd700' : '#ccc'}; text-align: center; font-weight: ${isWinner ? 'bold' : 'normal'}; line-height: 1.2; max-width: 90%;">
                ${reward.label}
                ${isWinner ? ' ⭐' : ''}
            </div>
        `;
        card.appendChild(back);
        
        cardContainer.appendChild(card);
        cards.push(card);
        cardElements.push(card);
    });
    
    container.appendChild(cardContainer);
    
    // Кнопка "Открыть"
    const btn = document.createElement('button');
    btn.textContent = '🎲 ОТКРЫТЬ КАРТЫ!';
    btn.style.cssText = `
        padding: 16px 48px;
        font-size: 1.3rem;
        font-weight: bold;
        background: linear-gradient(135deg, ${pool.color}, ${pool.color}cc);
        border: none;
        border-radius: 60px;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 4px 25px ${pool.color}50;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        margin-bottom: 20px;
    `;
    btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = `0 6px 35px ${pool.color}70`;
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = `0 4px 25px ${pool.color}50`;
    };
    container.appendChild(btn);
    
    // Результат
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = `
        font-size: 1.4rem;
        font-weight: bold;
        color: #ffd966;
        min-height: 50px;
        text-align: center;
        padding: 12px 24px;
        background: rgba(0,0,0,0.5);
        border-radius: 60px;
        border: 1px solid ${pool.color};
        transition: all 0.3s ease;
    `;
    resultDiv.textContent = 'Нажми "Открыть карты!"';
    container.appendChild(resultDiv);
    
    document.body.appendChild(container);
    
    let isOpened = false;
    
    btn.addEventListener('click', () => {
        if (isOpened) return;
        isOpened = true;
        btn.disabled = true;
        btn.textContent = '🌀 ОТКРЫВАЮ...';
        btn.style.opacity = '0.6';
        resultDiv.textContent = '🌀 Карты переворачиваются...';
        resultDiv.style.color = '#ffd966';
        
        // Переворачиваем карты одну за другой
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transform = 'rotateY(180deg)';
                card.style.borderColor = card.dataset.isWinner === 'true' ? '#ffd700' : '#555';
                
                if (card.dataset.isWinner === 'true') {
                    card.style.boxShadow = '0 0 40px rgba(255, 215, 0, 0.6)';
                }
                
                // Последняя карта — показываем результат
                if (index === cards.length - 1) {
                    setTimeout(() => {
                        // Конфетти
                        createConfetti(pool.color);
                        resultDiv.textContent = `🎉 ВЫПАЛО: ${selectedReward.label}`;
                        resultDiv.style.color = '#4caf50';
                        resultDiv.style.borderColor = '#4caf50';
                        
                        btn.textContent = '✅ ЗАКРЫТЬ';
                        btn.style.background = '#4caf50';
                        btn.style.boxShadow = '0 4px 25px rgba(76, 175, 80, 0.5)';
                        btn.style.opacity = '1';
                        btn.disabled = false;
                        
                        btn.onclick = () => {
                            container.remove();
                            onComplete();
                        };
                    }, 500);
                }
            }, index * 350);
        });
    });
    
    // Закрытие только после открытия
    container.addEventListener('click', (e) => {
        if (e.target === container && isOpened) {
            container.remove();
            onComplete();
        }
    });
}

// ========== КОНФЕТТИ ==========
function createConfetti(mainColor = '#ffd700') {
    const colors = [
        '#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', 
        '#4400ff', '#ff00ff', '#ff0066', '#ffd700', mainColor,
        '#ff6b35', '#00d4ff', '#7b68ee', '#ff1493', '#00fa9a'
    ];
    
    const container = document.getElementById('cardsContainer') || document.body;
    
    for (let i = 0; i < 120; i++) {
        const el = document.createElement('div');
        const size = 6 + Math.random() * 10;
        const isCircle = Math.random() > 0.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 2 + Math.random() * 2;
        const rotation = Math.random() * 720;
        
        el.style.cssText = `
            position: fixed;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            left: ${left}%;
            top: -20px;
            border-radius: ${isCircle ? '50%' : '2px'};
            z-index: 100000;
            pointer-events: none;
            animation: confettiFall ${duration}s ease-in forwards;
            animation-delay: ${delay}s;
            transform: rotate(${rotation}deg);
            box-shadow: 0 0 6px ${color}40;
        `;
        container.appendChild(el);
        setTimeout(() => el.remove(), (duration + delay) * 1000 + 200);
    }
}

// ========== ДОБАВЛЯЕМ СТИЛИ (если ещё нет) ==========
if (!document.getElementById('lootboxStyles')) {
    const style = document.createElement('style');
    style.id = 'lootboxStyles';
    style.textContent = `
        @keyframes confettiFall {
            0% {
                transform: translateY(0) rotate(0deg) scale(1);
                opacity: 1;
            }
            100% {
                transform: translateY(100vh) rotate(720deg) scale(0.5);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
