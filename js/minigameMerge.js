// js/minigameMerge.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { money, setStats, addExperience, updateUI, addLogEntry, hasEnoughEnergy, spendEnergy } from './gameState.js';

// ========== НАСТРОЙКИ ==========
const COLS = 8;
const ROWS = 10;
const CELL_SIZE = 55;
const PADDING = 4;

// Предметы (уровни)
const ITEMS = {
    1: { id: 'glass', name: 'Стакан', icon: '🥃', next: 2, points: 5 },
    2: { id: 'beer', name: 'Пиво', icon: '🍺', next: 3, points: 10 },
    3: { id: 'wine', name: 'Вино', icon: '🍷', next: 4, points: 20 },
    4: { id: 'vodka', name: 'Водка', icon: '🍾', next: 5, points: 35 },
    5: { id: 'gold', name: 'Золотая бутылка', icon: '🏆', next: null, points: 60 }
};

// Шансы появления предметов (сумма = 100)
const SPAWN_WEIGHTS = {
    1: 40,  // Стакан
    2: 30,  // Пиво
    3: 20,  // Вино
    4: 8,   // Водка
    5: 2    // Золотая бутылка (редко)
};

// ========== СОСТОЯНИЕ ИГРЫ ==========
let gameState = {
    grid: [],
    currentItem: null,     // { level, col, row }
    score: 0,
    isRunning: false,
    isSpawning: false,
    dropInterval: null,
    gameLoop: null,
    container: null,
    canvas: null,
    ctx: null,
    mouseX: 0,
    startTime: 0,
    merges: 0,
    maxLevelReached: 1
};

// ========== ИНИЦИАЛИЗАЦИЯ ПОЛЯ ==========
function initGrid() {
    gameState.grid = [];
    for (let row = 0; row < ROWS; row++) {
        gameState.grid[row] = [];
        for (let col = 0; col < COLS; col++) {
            gameState.grid[row][col] = null;
        }
    }
}

// ========== ВЫБОР СЛУЧАЙНОГО ПРЕДМЕТА ==========
function getRandomItem() {
    const total = Object.values(SPAWN_WEIGHTS).reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    for (const [level, weight] of Object.entries(SPAWN_WEIGHTS)) {
        random -= weight;
        if (random <= 0) {
            return parseInt(level);
        }
    }
    return 1;
}

// ========== ПРОВЕРКА, ЕСТЬ ЛИ МЕСТО ДЛЯ НОВОГО ПРЕДМЕТА ==========
function hasSpaceForItem() {
    return gameState.grid[0].some(cell => cell === null);
}

// ========== ПОИСК ОБЪЕДИНЕНИЙ ==========
function findMatches() {
    let merged = false;
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const current = gameState.grid[row][col];
            if (!current) continue;
            
            // Проверяем соседей (вправо и вниз)
            const neighbors = [
                { r: row, c: col + 1 },
                { r: row + 1, c: col }
            ];
            
            for (const n of neighbors) {
                if (n.r >= ROWS || n.c >= COLS) continue;
                const neighbor = gameState.grid[n.r][n.c];
                if (!neighbor) continue;
                
                // Если одинаковый уровень и есть следующий уровень
                if (current.level === neighbor.level && current.level < 5) {
                    const nextLevel = current.level + 1;
                    const nextItem = ITEMS[nextLevel];
                    
                    // Объединяем
                    gameState.grid[row][col] = { level: nextLevel };
                    gameState.grid[n.r][n.c] = null;
                    
                    // Начисляем очки
                    gameState.score += nextItem.points;
                    gameState.merges++;
                    if (nextLevel > gameState.maxLevelReached) {
                        gameState.maxLevelReached = nextLevel;
                    }
                    
                    // Показываем уведомление
                    showMergeEffect(row, col, nextItem);
                    
                    merged = true;
                    
                    // Рекурсивно проверяем новое объединение
                    findMatches();
                    return true;
                }
            }
        }
    }
    
    return merged;
}

// ========== ЭФФЕКТ ОБЪЕДИНЕНИЯ ==========
function showMergeEffect(row, col, item) {
    const container = gameState.container;
    const x = col * CELL_SIZE + CELL_SIZE / 2;
    const y = row * CELL_SIZE + CELL_SIZE / 2;
    
    const el = document.createElement('div');
    el.textContent = item.icon;
    el.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        font-size: 3rem;
        pointer-events: none;
        z-index: 10;
        animation: mergePop 0.4s ease forwards;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 500);
}

// ========== ПРОВЕРКА GAME OVER ==========
function checkGameOver() {
    // Если в верхней строке есть предметы — Game Over
    for (let col = 0; col < COLS; col++) {
        if (gameState.grid[0][col] !== null) {
            return true;
        }
    }
    return false;
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateUI() {
    const scoreEl = document.getElementById('mergeScore');
    const mergesEl = document.getElementById('mergeMerges');
    const levelEl = document.getElementById('mergeLevel');
    
    if (scoreEl) scoreEl.textContent = gameState.score;
    if (mergesEl) mergesEl.textContent = gameState.merges;
    if (levelEl) {
        const maxItem = ITEMS[gameState.maxLevelReached];
        levelEl.textContent = maxItem ? maxItem.icon : '🥃';
    }
}

// ========== ОТРИСОВКА ==========
function draw() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);
    
    // Сетка
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = col * CELL_SIZE + PADDING;
            const y = row * CELL_SIZE + PADDING;
            const size = CELL_SIZE - PADDING * 2;
            
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(x, y, size, size);
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, size, size);
            
            const item = gameState.grid[row][col];
            if (item) {
                const data = ITEMS[item.level];
                if (data) {
                    ctx.font = `${size * 0.6}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(data.icon, x + size/2, y + size/2);
                }
            }
        }
    }
    
    // Текущий падающий предмет
    if (gameState.currentItem) {
        const item = gameState.currentItem;
        const x = item.col * CELL_SIZE + PADDING;
        const y = item.row * CELL_SIZE + PADDING;
        const size = CELL_SIZE - PADDING * 2;
        const data = ITEMS[item.level];
        
        // Подсветка
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255,215,0,0.1)';
        ctx.fillRect(x, y, size, size);
        ctx.shadowBlur = 0;
        
        if (data) {
            ctx.font = `${size * 0.7}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(data.icon, x + size/2, y + size/2);
        }
    }
}

// ========== АНИМАЦИЯ ПАДЕНИЯ ==========
function dropCurrentItem() {
    if (!gameState.currentItem || !gameState.isRunning) return;
    
    const item = gameState.currentItem;
    const nextRow = item.row + 1;
    
    // Проверяем, может ли упасть ниже
    if (nextRow < ROWS && gameState.grid[nextRow][item.col] === null) {
        item.row = nextRow;
        draw();
        return;
    }
    
    // Не может упасть — закрепляем
    gameState.grid[item.row][item.col] = { level: item.level };
    gameState.currentItem = null;
    
    // Проверяем объединения
    let merged = true;
    while (merged) {
        merged = findMatches();
        if (merged) {
            draw();
            updateUI();
        }
    }
    
    // Проверяем Game Over
    if (checkGameOver()) {
        endGame(false);
        return;
    }
    
    // Создаём новый предмет
    setTimeout(() => spawnNewItem(), 300);
}

// ========== СОЗДАНИЕ НОВОГО ПРЕДМЕТА ==========
function spawnNewItem() {
    if (!gameState.isRunning) return;
    
    if (!hasSpaceForItem()) {
        endGame(false);
        return;
    }
    
    const level = getRandomItem();
    const col = Math.floor(Math.random() * COLS);
    
    gameState.currentItem = {
        level: level,
        col: Math.max(0, Math.min(COLS - 1, col)),
        row: 0
    };
    
    draw();
    updateUI();
    
    // Запускаем падение
    if (gameState.dropInterval) {
        clearInterval(gameState.dropInterval);
    }
    gameState.dropInterval = setInterval(() => {
        dropCurrentItem();
    }, 400);
}

// ========== УПРАВЛЕНИЕ МЫШКОЙ ==========
function handleMouseMove(e) {
    if (!gameState.currentItem || !gameState.isRunning) return;
    
    const rect = gameState.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const col = Math.floor(mouseX / CELL_SIZE);
    const newCol = Math.max(0, Math.min(COLS - 1, col));
    
    // Проверяем, свободна ли ячейка в текущей строке
    const currentRow = gameState.currentItem.row;
    if (gameState.grid[currentRow][newCol] !== null) {
        // Если ячейка занята — пробуем соседние
        for (let offset = 1; offset < COLS; offset++) {
            const left = newCol - offset;
            const right = newCol + offset;
            if (left >= 0 && gameState.grid[currentRow][left] === null) {
                gameState.currentItem.col = left;
                draw();
                return;
            }
            if (right < COLS && gameState.grid[currentRow][right] === null) {
                gameState.currentItem.col = right;
                draw();
                return;
            }
        }
        return;
    }
    
    gameState.currentItem.col = newCol;
    draw();
}

// ========== НАЧАЛО ИГРЫ ==========
function startGame() {
    initGrid();
    gameState.score = 0;
    gameState.merges = 0;
    gameState.maxLevelReached = 1;
    gameState.isRunning = true;
    gameState.startTime = Date.now();
    
    createUI();
    spawnNewItem();
}

// ========== СОЗДАНИЕ UI ==========
function createUI() {
    const container = gameState.container;
    
    const panel = document.createElement('div');
    panel.id = 'mergeUI';
    panel.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 20px;
        color: white;
        font-size: 1rem;
        font-weight: bold;
        background: rgba(0, 0, 0, 0.6);
        padding: 8px 16px;
        border-radius: 60px;
        border: 1px solid rgba(255,255,255,0.1);
        z-index: 10;
        pointer-events: none;
        flex-wrap: wrap;
        justify-content: center;
    `;
    panel.innerHTML = `
        <div>🎯 Очки: <span id="mergeScore">0</span></div>
        <div>🔄 Объединений: <span id="mergeMerges">0</span></div>
        <div>🏆 Уровень: <span id="mergeLevel">🥃</span></div>
    `;
    container.appendChild(panel);
}

// ========== ЗАВЕРШЕНИЕ ИГРЫ ==========
function endGame(won = false) {
    if (!gameState.isRunning) return;
    gameState.isRunning = false;
    
    if (gameState.dropInterval) {
        clearInterval(gameState.dropInterval);
        gameState.dropInterval = null;
    }
    
    // Рассчитываем награду
    const baseMoney = Math.floor(gameState.score / 2);
    const bonusMoney = gameState.merges * 5;
    const levelBonus = (gameState.maxLevelReached - 1) * 20;
    const totalMoney = baseMoney + bonusMoney + levelBonus;
    const expGain = Math.floor(gameState.score / 3) + gameState.merges * 2 + (gameState.maxLevelReached - 1) * 10;
    
    showResultScreen(won, totalMoney, expGain);
}

// ========== ЭКРАН РЕЗУЛЬТАТОВ ==========
function showResultScreen(won, moneyReward, expReward) {
    const container = gameState.container;
    container.innerHTML = '';
    
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 30px 40px;
        border-radius: 30px;
        border: 2px solid ${won ? '#4caf50' : '#e74c3c'};
        text-align: center;
        color: white;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 0 60px rgba(0,0,0,0.8);
        z-index: 20;
    `;
    
    const maxItem = ITEMS[gameState.maxLevelReached];
    
    resultDiv.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 10px;">${won ? '🏆' : '💀'}</div>
        <h2 style="color: ${won ? '#4caf50' : '#e74c3c'}; margin: 0 0 10px 0;">
            ${won ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА'}
        </h2>
        <div style="font-size: 2rem; font-weight: bold; color: #ffd966; margin: 10px 0;">
            ${gameState.score} 🎯
        </div>
        <div style="color: #aaa; margin-bottom: 10px;">
            🔄 Объединений: ${gameState.merges}
        </div>
        <div style="color: #aaa; margin-bottom: 10px;">
            🏆 Макс. уровень: ${maxItem ? maxItem.icon : '🥃'} ${maxItem ? maxItem.name : ''}
        </div>
        <div style="border-top: 1px solid #333; padding-top: 15px; margin-bottom: 20px;">
            <div style="color: #4caf50;">💰 +${moneyReward}₽</div>
            <div style="color: #ffd966;">⭐ +${expReward} опыта</div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button id="mergeRetryBtn" style="
                padding: 10px 25px;
                background: ${won ? '#4caf50' : '#f39c12'};
                border: none;
                border-radius: 60px;
                color: white;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
            ">🔄 Играть снова</button>
            <button id="mergeExitBtn" style="
                padding: 10px 25px;
                background: #333;
                border: none;
                border-radius: 60px;
                color: #888;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s;
            ">❌ Выйти</button>
        </div>
    `;
    
    container.appendChild(resultDiv);
    
    // Начисляем награду
    const newMoney = money + moneyReward;
    setStats(null, null, null, newMoney);
    addExperience(expReward);
    updateUI();
    saveGameData();
    addLogEntry(`🔄 Объединялка: ${gameState.score} очков, ${gameState.merges} объединений (+${moneyReward}₽, +${expReward} опыта)`, 'system');
    
    resultDiv.querySelector('#mergeRetryBtn').addEventListener('click', () => {
        container.remove();
        openMergeGame();
    });
    
    resultDiv.querySelector('#mergeExitBtn').addEventListener('click', () => {
        container.remove();
        showMessage('🔄 Спасибо за игру!', '#ffd966');
    });
}

// ========== ОТКРЫТИЕ ИГРЫ ==========
export function openMergeGame() {
    // Проверяем энергию
    if (!hasEnoughEnergy(15)) {
        showMessage('❌ Не хватает энергии! Нужно 15⚡', '#e74c3c');
        return;
    }
    
    if (gameState.isRunning) {
        console.log('Игра уже запущена');
        return;
    }
    
    spendEnergy(15);
    
    // Создаём контейнер
    const container = document.createElement('div');
    container.id = 'mergeGameContainer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0d0d1a;
        z-index: 99998;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        user-select: none;
    `;
    document.body.appendChild(container);
    gameState.container = container;
    
    // Заголовок
    const title = document.createElement('div');
    title.textContent = '🔄 ОБЪЕДИНЯЛКА';
    title.style.cssText = `
        color: #ffd966;
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 10px;
        text-shadow: 0 0 20px rgba(255,215,0,0.3);
        letter-spacing: 2px;
    `;
    container.appendChild(title);
    
    // Canvas
    const canvas = document.createElement('canvas');
    const totalWidth = COLS * CELL_SIZE + PADDING * 2;
    const totalHeight = ROWS * CELL_SIZE + PADDING * 2;
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    canvas.style.cssText = `
        border-radius: 16px;
        border: 2px solid rgba(255,215,0,0.3);
        box-shadow: 0 0 40px rgba(255,215,0,0.1);
        background: #1a1a2e;
    `;
    container.appendChild(canvas);
    gameState.canvas = canvas;
    gameState.ctx = canvas.getContext('2d');
    
    // Управление мышкой
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // Запускаем игру
    startGame();
    
    // Обработка закрытия по Escape
    const closeHandler = (e) => {
        if (e.key === 'Escape' && gameState.isRunning) {
            endGame(false);
        }
    };
    document.addEventListener('keydown', closeHandler);
    container._closeHandler = closeHandler;
}

// ========== ДОБАВЛЯЕМ СТИЛИ ==========
if (!document.getElementById('mergeStyles')) {
    const style = document.createElement('style');
    style.id = 'mergeStyles';
    style.textContent = `
        @keyframes mergePop {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.5); opacity: 1; }
            100% { transform: scale(1); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
