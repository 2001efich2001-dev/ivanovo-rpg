// js/lootbox.js
import { inventory, money, setStats, health, hunger, cold, addExperience, updateUI, addLogEntry } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

// ========== ПУЛЫ НАГРАД ==========
const lootPools = {
    bronze_box: {
        rewards: [
            { type: 'item', id: 'bread', count: 1, weight: 15, label: '🍞 Хлеб' },
            { type: 'item', id: 'water', count: 1, weight: 15, label: '💧 Вода' },
            { type: 'item', id: 'cigarettes', count: 1, weight: 10, label: '🚬 Сигареты' },
            { type: 'item', id: 'medkit', count: 1, weight: 10, label: '💊 Аптечка' },
            { type: 'item', id: 'empty_bottle', count: 3, weight: 10, label: '🍾 3 пустых бутылки' },
            { type: 'money', amount: [50, 150], weight: 15, label: '💰 50-150₽' },
            { type: 'money', amount: [200, 500], weight: 10, label: '💰 200-500₽' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 5, label: '⛓️ Золотая цепь' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 3, label: '💍 Кольцо с бриллиантом' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 2, label: '🎖️ Легендарная медаль' },
        ],
        color: '#cd7f32',
        title: '📦 БРОНЗОВЫЙ ЯЩИК'
    },
    
    silver_box: {
        rewards: [
            { type: 'item', id: 'bread', count: 2, weight: 8, label: '🍞 2 хлеба' },
            { type: 'item', id: 'water', count: 2, weight: 8, label: '💧 2 воды' },
            { type: 'item', id: 'medkit', count: 2, weight: 8, label: '💊 2 аптечки' },
            { type: 'item', id: 'cigarettes', count: 3, weight: 8, label: '🚬 3 сигареты' },
            { type: 'item', id: 'vodka', count: 2, weight: 8, label: '🍾 2 водки' },
            { type: 'money', amount: [300, 800], weight: 15, label: '💰 300-800₽' },
            { type: 'money', amount: [1000, 2000], weight: 15, label: '💰 1000-2000₽' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 6, label: '⛓️ Золотая цепь' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 5, label: '💍 Кольцо с бриллиантом' },
            { type: 'item', id: 'leather_jacket', count: 1, weight: 4, label: '🧥 Кожаная куртка' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 15, label: '🎖️ Легендарная медаль' },
        ],
        color: '#c0c0c0',
        title: '🎁 СЕРЕБРЯНЫЙ ЯЩИК'
    },
    
    gold_box: {
        rewards: [
            { type: 'item', id: 'medkit', count: 3, weight: 5, label: '💊 3 аптечки' },
            { type: 'item', id: 'vodka', count: 3, weight: 5, label: '🍾 3 водки' },
            { type: 'item', id: 'cigarettes', count: 5, weight: 5, label: '🚬 5 сигарет' },
            { type: 'item', id: 'energetic', count: 3, weight: 5, label: '⚡ 3 энергетика' },
            { type: 'money', amount: [1000, 3000], weight: 12, label: '💰 1000-3000₽' },
            { type: 'money', amount: [5000, 10000], weight: 8, label: '💰 5000-10000₽' },
            { type: 'money', amount: [15000, 25000], weight: 5, label: '💰 15000-25000₽' },
            { type: 'item', id: 'gold_chain', count: 1, weight: 7, label: '⛓️ Золотая цепь' },
            { type: 'item', id: 'diamond_ring', count: 1, weight: 6, label: '💍 Кольцо с бриллиантом' },
            { type: 'item', id: 'leather_jacket', count: 1, weight: 6, label: '🧥 Кожаная куртка' },
            { type: 'item', id: 'legendary_medal', count: 1, weight: 6, label: '🎖️ Легендарная медаль' },
            { type: 'item', id: 'legendary_medal', count: 2, weight: 30, label: '🎖️ 2 легендарные медали' },
        ],
        color: '#ffd700',
        title: '👑 ЗОЛОТОЙ ЯЩИК'
    }
};

// ========== ВЫБОР НАГРАДЫ С ИНДЕКСОМ ==========
export function selectReward(boxType) {
    const pool = lootPools[boxType];
    if (!pool) return null;
    
    const totalWeight = pool.rewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < pool.rewards.length; i++) {
        random -= pool.rewards[i].weight;
        if (random <= 0) {
            const result = {
                reward: pool.rewards[i],
                index: i
            };
            // 👇 ДОБАВЬ ЭТО
            console.log('🎯 selectReward выбрал:', result.reward.label, 'индекс:', i);
            return result;
        }
    }
    
    return {
        reward: pool.rewards[0],
        index: 0
    };
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
    
    const result = selectReward(boxType);
    if (!result) {
        showMessage('❌ Ошибка при открытии ящика', '#e74c3c');
        return;
    }
    
    const { reward, index } = result;
    
    showWheelOfFortune(pool, reward, index, boxType, () => {
        giveReward(reward, boxType);
    });
}

// ========== КОЛЕСО ФОРТУНЫ ==========
function showWheelOfFortune(pool, selectedReward, selectedIndex, boxType, onComplete) {

 

    console.log('🎡 showWheelOfFortune вызван!');
    console.log('📦 boxType:', boxType);
    console.log('🎯 selectedReward:', selectedReward);
    console.log('🔢 selectedIndex:', selectedIndex, 'тип:', typeof selectedIndex);
    console.log('📊 pool.rewards:', pool.rewards.map((r, i) => `${i}: ${r.label}`).join(', '));
    console.log('✅ Совпадает?', pool.rewards[selectedIndex]?.label === selectedReward.label);


    
    const oldWheel = document.getElementById('wheelOfFortuneContainer');
    if (oldWheel) oldWheel.remove();
    
    const container = document.createElement('div');
    container.id = 'wheelOfFortuneContainer';
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
    
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    canvas.style.cssText = `
        border-radius: 50%;
        box-shadow: 0 0 60px ${pool.color}60;
        margin-bottom: 20px;
    `;
    container.appendChild(canvas);
    
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
    
    const ctx = canvas.getContext('2d');
    const rewards = pool.rewards;
    const segmentCount = rewards.length;
    const anglePerSegment = (2 * Math.PI) / segmentCount;
    
    function drawWheel(rotation = 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = canvas.width / 2 - 10;
        
        for (let i = 0; i < segmentCount; i++) {
            const startAngle = i * anglePerSegment + rotation;
            const endAngle = startAngle + anglePerSegment;
            
            const hue = (i * 360 / segmentCount) % 360;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + anglePerSegment / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(rewards[i].label, radius * 0.65, 0);
            ctx.restore();
        }
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(centerX, 20);
        ctx.lineTo(centerX - 15, 5);
        ctx.lineTo(centerX + 15, 5);
        ctx.closePath();
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    drawWheel(0);
    
    let isSpinning = false;
    let isFinished = false;
    
    spinBtn.addEventListener('click', () => {
        if (isSpinning || isFinished) return;
        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = '🌀 КРУЧУ...';
        resultDiv.textContent = '🌀 Колесо крутится...';
        resultDiv.style.color = '#ffd966';
        
        const extraSpins = 5 + Math.random() * 3;
        const targetAngle = selectedIndex * anglePerSegment + anglePerSegment / 2;
        const totalRotation = extraSpins * 2 * Math.PI + targetAngle;
        
        const startTime = Date.now();
        const duration = 4000 + Math.random() * 1000;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentRotation = totalRotation * eased;
            
            drawWheel(currentRotation);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isSpinning = false;
                isFinished = true;
                spinBtn.disabled = false;
                
                spinBtn.textContent = '✅ ЗАКРЫТЬ';
                spinBtn.style.background = '#4caf50';
                spinBtn.style.boxShadow = '0 4px 20px rgba(76, 175, 80, 0.6)';
                
                resultDiv.textContent = `🎉 ВЫПАЛО: ${selectedReward.label}`;
                resultDiv.style.color = '#4caf50';
                
                spinBtn.onclick = () => {
                    if (container && container.remove) container.remove();
                };
                
                onComplete();
            }
        }
        animate();
    });
    
    container.addEventListener('click', (e) => {
        if (e.target === container && isFinished) {
            container.remove();
        }
    });
}
