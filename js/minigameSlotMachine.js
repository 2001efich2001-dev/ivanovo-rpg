// js/minigameSlotMachine.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { money, setStats, updateUI, addLogEntry } from './gameState.js';

// Символы и их коэффициенты
const symbols = [
    { id: 'cherry', name: '🍒 Вишня', icon: '🍒', multiplier: 2 },
    { id: 'lemon', name: '🍋 Лимон', icon: '🍋', multiplier: 3 },
    { id: 'orange', name: '🍊 Апельсин', icon: '🍊', multiplier: 4 },
    { id: 'plum', name: '🍇 Слива', icon: '🍇', multiplier: 5 },
    { id: 'bell', name: '🔔 Колокольчик', icon: '🔔', multiplier: 10 },
    { id: 'watermelon', name: '🍉 Арбуз', icon: '🍉', multiplier: 15 },
    { id: 'seven', name: '7️⃣ Семёрка', icon: '7️⃣', multiplier: 25 },
    { id: 'diamond', name: '💎 Бриллиант', icon: '💎', multiplier: 50 }
];

// Веса для выпадения (чем выше вес, тем чаще выпадает)
const symbolWeights = {
    cherry: 30,
    lemon: 25,
    orange: 20,
    plum: 15,
    bell: 8,
    watermelon: 5,
    seven: 2,
    diamond: 1
};

// Выбор случайного символа с учётом веса
function getRandomSymbol() {
    const totalWeight = Object.values(symbolWeights).reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const symbol of symbols) {
        currentWeight += symbolWeights[symbol.id];
        if (random <= currentWeight) {
            return symbol;
        }
    }
    return symbols[0];
}

// Расчёт выигрыша
function calculateWin(reels, bet) {
    const [s1, s2, s3] = reels;
    
    // Джекпот: три бриллианта 💎💎💎
    if (s1.id === 'diamond' && s2.id === 'diamond' && s3.id === 'diamond') {
        return bet * 500;
    }
    
    // Три семёрки
    if (s1.id === 'seven' && s2.id === 'seven' && s3.id === 'seven') {
        return bet * 250;
    }
    
    // Три одинаковых символа (любых)
    if (s1.id === s2.id && s2.id === s3.id) {
        return bet * s1.multiplier * 10;
    }
    
    // Два одинаковых (первые два или последние два)
    if (s1.id === s2.id) {
        return bet * s1.multiplier * 2;
    }
    if (s2.id === s3.id) {
        return bet * s2.multiplier * 2;
    }
    
    // Вишни в любом месте (утешительный приз)
    if (s1.id === 'cherry' || s2.id === 'cherry' || s3.id === 'cherry') {
        return Math.floor(bet * 0.5);
    }
    
    return 0;
}

let spinInterval = null;
let isSpinning = false;

// Анимация прокрутки
function animateReels(reelElements, finalSymbols, bet, onComplete) {
    let spinCount = 0;
    const maxSpins = 15;
    const spinIntervalTime = 80;
    
    if (spinInterval) clearInterval(spinInterval);
    
    spinInterval = setInterval(() => {
        for (let i = 0; i < reelElements.length; i++) {
            const randomSymbol = getRandomSymbol();
            reelElements[i].textContent = randomSymbol.icon;
            reelElements[i].style.transform = 'scale(1.1)';
            setTimeout(() => {
                if (reelElements[i]) reelElements[i].style.transform = 'scale(1)';
            }, 50);
        }
        
        spinCount++;
        
        if (spinCount >= maxSpins) {
            clearInterval(spinInterval);
            spinInterval = null;
            
            // Устанавливаем финальные символы
            for (let i = 0; i < reelElements.length; i++) {
                reelElements[i].textContent = finalSymbols[i].icon;
            }
            
            if (onComplete) onComplete(finalSymbols, bet);
        }
    }, spinIntervalTime);
}

// Основная функция игры
export async function openSlotMachine() {
    const gameState = await import('./gameState.js');
    
    // Проверяем, есть ли модальное окно
    let modal = document.getElementById('slotMachineModal');
    
    if (!modal) {
        // Создаём модальное окно
        modal = document.createElement('div');
        modal.id = 'slotMachineModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content slot-machine-content">
                <h3>🎰 ОДНОРУКИЙ БАНДИТ 🎰</h3>
                
                <div class="slot-reels">
                    <div class="reel" id="reel1">🍒</div>
                    <div class="reel" id="reel2">🍒</div>
                    <div class="reel" id="reel3">🍒</div>
                </div>
                
                <div class="slot-info">
                    <div>💰 Ваши деньги: <span id="slotMoney">${Math.floor(money)}</span>₽</div>
                    <div>🎲 Ставка: 
                        <input type="number" id="slotBet" min="10" max="10000" value="100" step="10">
                        ₽
                    </div>
                    <div>🏆 Последний выигрыш: <span id="lastWin">0</span>₽</div>
                </div>
                
                <div class="slot-buttons">
                    <button id="spinBtn" class="action-btn">🎰 КРУТИТЬ!</button>
                    <button id="closeSlotBtn" class="reset-btn">❌ Закрыть</button>
                </div>
                
                <div class="slot-paytable">
                    <div style="font-weight: bold; margin-bottom: 8px;">📜 Таблица выигрышей:</div>
                    <div class="paytable-grid">
                        <div>🍒🍒🍒</div><div>x10 ставки</div>
                        <div>🍋🍋🍋</div><div>x30 ставки</div>
                        <div>🍊🍊🍊</div><div>x40 ставки</div>
                        <div>🍇🍇🍇</div><div>x50 ставки</div>
                        <div>🔔🔔🔔</div><div>x100 ставки</div>
                        <div>🍉🍉🍉</div><div>x150 ставки</div>
                        <div>7️⃣7️⃣7️⃣</div><div>x250 ставки</div>
                        <div>💎💎💎</div><div>x500 ставки</div>
                        <div>🍒🍒❌</div><div>x2 ставки</div>
                        <div>❌🍒🍒</div><div>x2 ставки</div>
                        <div>🍒 в любом месте</div><div>x0.5 ставки</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Добавляем стили, если их нет
        if (!document.querySelector('#slotMachineStyle')) {
            const style = document.createElement('style');
            style.id = 'slotMachineStyle';
            style.textContent = `
                .slot-machine-content {
                    max-width: 500px;
                    text-align: center;
                    background: linear-gradient(135deg, #1a472a, #0d2818);
                    border: 3px solid #ffd700;
                }
                .slot-reels {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin: 20px 0;
                    padding: 20px;
                    background: #000;
                    border-radius: 20px;
                    border: 2px solid #ffd700;
                }
                .reel {
                    font-size: 4rem;
                    width: 100px;
                    height: 100px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #fff;
                    border-radius: 15px;
                    box-shadow: 0 0 15px rgba(255,215,0,0.5);
                    transition: transform 0.1s;
                    font-weight: bold;
                }
                .slot-info {
                    background: rgba(0,0,0,0.5);
                    border-radius: 15px;
                    padding: 12px;
                    margin: 15px 0;
                    font-size: 0.9rem;
                }
                .slot-info input {
                    width: 100px;
                    padding: 5px;
                    border-radius: 20px;
                    border: none;
                    text-align: center;
                    font-weight: bold;
                }
                .slot-buttons {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin: 15px 0;
                }
                .slot-paytable {
                    background: rgba(0,0,0,0.6);
                    border-radius: 15px;
                    padding: 12px;
                    margin-top: 15px;
                    font-size: 0.7rem;
                    text-align: left;
                }
                .paytable-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 5px 15px;
                }
                .paytable-grid div {
                    color: #ffd966;
                }
                .paytable-grid div:first-child {
                    color: #fff;
                }
                @keyframes reelSpin {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    modal.style.display = 'flex';
    
    // Обновляем отображение денег
    const moneySpan = document.getElementById('slotMoney');
    if (moneySpan) moneySpan.textContent = Math.floor(money);
    
    // Обработчики
    const spinBtn = document.getElementById('spinBtn');
    const closeBtn = document.getElementById('closeSlotBtn');
    const betInput = document.getElementById('slotBet');
    const reel1 = document.getElementById('reel1');
    const reel2 = document.getElementById('reel2');
    const reel3 = document.getElementById('reel3');
    const lastWinSpan = document.getElementById('lastWin');
    
    const spinHandler = async () => {
        if (isSpinning) {
            showMessage('🎰 Подождите, барабаны крутятся!', '#ffd966');
            return;
        }
        
        let bet = parseInt(betInput?.value || 100);
        if (isNaN(bet) || bet < 10) bet = 10;
        if (bet > money) {
            showMessage(`❌ Не хватает денег! Нужно ${bet}₽`, '#e74c3c');
            return;
        }
        
        // Снимаем ставку
        const newMoney = money - bet;
        setStats(null, null, null, newMoney);
        updateUI();
        if (moneySpan) moneySpan.textContent = Math.floor(newMoney);
        
        isSpinning = true;
        spinBtn.disabled = true;
        spinBtn.textContent = '🎰 КРУЧУ...';
        
        // Генерируем финальные символы
        const finalSymbols = [
            getRandomSymbol(),
            getRandomSymbol(),
            getRandomSymbol()
        ];
        
        const reelElements = [reel1, reel2, reel3];
        
        animateReels(reelElements, finalSymbols, bet, async (symbols, placedBet) => {
            const winAmount = calculateWin(symbols, placedBet);
            
            if (winAmount > 0) {
                const totalWin = winAmount;
                const afterWinMoney = money + totalWin;
                setStats(null, null, null, afterWinMoney);
                updateUI();
                if (moneySpan) moneySpan.textContent = Math.floor(afterWinMoney);
                if (lastWinSpan) lastWinSpan.textContent = totalWin;
                
                showMessage(`🎉 ВЫИГРЫШ: ${totalWin}₽! 🎉`, '#4caf50');
                addLogEntry(`🎰 Однорукий бандит: выигрыш ${totalWin}₽`, 'economy');
                
                // Эффект победной вспышки
                const reelsContainer = document.querySelector('.slot-reels');
                if (reelsContainer) {
                    reelsContainer.style.animation = 'none';
                    setTimeout(() => {
                        if (reelsContainer) reelsContainer.style.animation = 'reelSpin 0.2s ease';
                    }, 10);
                    setTimeout(() => {
                        if (reelsContainer) reelsContainer.style.animation = '';
                    }, 300);
                }
            } else {
                showMessage(`😞 Проигрыш: -${placedBet}₽`, '#e74c3c');
                addLogEntry(`🎰 Однорукий бандит: проигрыш ${placedBet}₽`, 'economy');
            }
            
            isSpinning = false;
            spinBtn.disabled = false;
            spinBtn.textContent = '🎰 КРУТИТЬ!';
            
            await saveGameData();
        });
    };
    
    // Убираем старые обработчики
    if (spinBtn._handler) spinBtn.removeEventListener('click', spinBtn._handler);
    if (closeBtn._handler) closeBtn.removeEventListener('click', closeBtn._handler);
    
    spinBtn._handler = spinHandler;
    closeBtn._handler = () => {
        if (spinInterval) clearInterval(spinInterval);
        modal.style.display = 'none';
    };
    
    spinBtn.addEventListener('click', spinBtn._handler);
    closeBtn.addEventListener('click', closeBtn._handler);
    
    // Закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) {
            if (spinInterval) clearInterval(spinInterval);
            modal.style.display = 'none';
        }
    };
}
