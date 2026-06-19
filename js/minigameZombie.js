// js/minigameZombie.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { money, setStats, addExperience, addLogEntry, health, maxHealth, updateUI } from './gameState.js';

// ========== НАСТРОЙКИ РЕЖИМОВ (БАЗОВЫЕ) ==========
const DIFFICULTY = {
    easy: {
        label: '🟢 Лёгкий',
        baseMaxZombies: 2,
        baseSpawnInterval: [2000, 3000],
        killTime: 3000,
        pointsPerKill: 10,
        moneyPerKill: 5,
        expPerKill: 3,
        maxLives: 5,
        bonusMultiplier: 1.0
    },
    normal: {
        label: '🟡 Нормальный',
        baseMaxZombies: 3,
        baseSpawnInterval: [1200, 2000],
        killTime: 2000,
        pointsPerKill: 20,
        moneyPerKill: 10,
        expPerKill: 5,
        maxLives: 3,
        bonusMultiplier: 1.5
    },
    hard: {
        label: '🔴 Сложный',
        baseMaxZombies: 4,
        baseSpawnInterval: [600, 1200],
        killTime: 1200,
        pointsPerKill: 35,
        moneyPerKill: 20,
        expPerKill: 8,
        maxLives: 3,
        bonusMultiplier: 2.5
    }
};

// ========== УРОВНИ СЛОЖНОСТИ ВНУТРИ ИГРЫ ==========
const ESCALATION_LEVELS = [
    { killsNeeded: 0, maxZombiesBonus: 0, spawnSpeedMult: 1.0, zombieSizeMult: 1.0, label: '🌱 Начало' },
    { killsNeeded: 10, maxZombiesBonus: 1, spawnSpeedMult: 0.8, zombieSizeMult: 1.05, label: '⚡ Рост' },
    { killsNeeded: 20, maxZombiesBonus: 2, spawnSpeedMult: 0.65, zombieSizeMult: 1.1, label: '🔥 Накал' },
    { killsNeeded: 35, maxZombiesBonus: 3, spawnSpeedMult: 0.5, zombieSizeMult: 1.15, label: '💀 Хаос' },
    { killsNeeded: 50, maxZombiesBonus: 4, spawnSpeedMult: 0.4, zombieSizeMult: 1.2, label: '👹 Ад' }
];

// ========== СОСТОЯНИЕ ИГРЫ ==========
let gameState = {
    difficulty: 'normal',
    lives: 3,
    maxLives: 3,
    score: 0,
    kills: 0,
    isRunning: false,
    zombies: [],
    spawnTimer: null,
    gameLoop: null,
    startTime: 0,
    difficultyConfig: null,
    container: null,
    canvas: null,
    ctx: null,
    currentEscalationLevel: 0,
    waveStartTime: 0,
    totalWaves: 0,
    maxKillsReached: 0
};

// ========== ГЛАВНАЯ ФУНКЦИЯ ОТКРЫТИЯ ==========
export async function openZombieGame() {
    const gameStateMain = await import('./gameState.js');
    if (!gameStateMain.hasEnoughEnergy(20)) {
        showMessage('❌ Не хватает энергии! Нужно 20⚡', '#e74c3c');
        return;
    }
    
    if (gameState.isRunning) {
        console.log('Игра уже запущена');
        return;
    }
    
    gameStateMain.spendEnergy(20);
    showDifficultyMenu();
}

// ========== МЕНЮ ВЫБОРА СЛОЖНОСТИ ==========
function showDifficultyMenu() {
    const modal = document.createElement('div');
    modal.id = 'zombieMenu';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    `;
    
    modal.innerHTML = `
        <div style="text-align: center; color: white; margin-bottom: 40px;">
            <div style="font-size: 4rem;">🧟</div>
            <h1 style="font-size: 3rem; color: #ffd966; margin: 10px 0;">ЗОМБИ-ШУТЕР</h1>
            <p style="color: #aaa; font-size: 1.1rem;">Выбери сложность и уничтожай зомби!</p>
            <p style="color: #666; font-size: 0.8rem; margin-top: 8px;">Тратит 20⚡ энергии</p>
            <p style="color: #ff6b35; font-size: 0.8rem; margin-top: 4px;">🔥 Сложность растёт с каждым убийством!</p>
            <p style="color: #ffd700; font-size: 0.8rem;">💣 Иногда появляются бомбы — взрывай их, чтобы уничтожить всех зомби!</p>
        </div>
        
        <div style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;">
            <button class="diff-btn" data-diff="easy" style="
                padding: 20px 40px;
                font-size: 1.2rem;
                border-radius: 20px;
                border: 3px solid #27ae60;
                background: rgba(39, 174, 96, 0.2);
                color: #27ae60;
                cursor: pointer;
                transition: all 0.3s;
                min-width: 150px;
            ">
                <div style="font-size: 2rem;">🟢</div>
                <div><strong>Лёгкий</strong></div>
                <div style="font-size: 0.7rem; color: #888;">5 жизней · 10 очков</div>
            </button>
            
            <button class="diff-btn" data-diff="normal" style="
                padding: 20px 40px;
                font-size: 1.2rem;
                border-radius: 20px;
                border: 3px solid #f39c12;
                background: rgba(243, 156, 18, 0.2);
                color: #f39c12;
                cursor: pointer;
                transition: all 0.3s;
                min-width: 150px;
            ">
                <div style="font-size: 2rem;">🟡</div>
                <div><strong>Нормальный</strong></div>
                <div style="font-size: 0.7rem; color: #888;">3 жизни · 20 очков</div>
            </button>
            
            <button class="diff-btn" data-diff="hard" style="
                padding: 20px 40px;
                font-size: 1.2rem;
                border-radius: 20px;
                border: 3px solid #e74c3c;
                background: rgba(231, 76, 60, 0.2);
                color: #e74c3c;
                cursor: pointer;
                transition: all 0.3s;
                min-width: 150px;
            ">
                <div style="font-size: 2rem;">🔴</div>
                <div><strong>Сложный</strong></div>
                <div style="font-size: 0.7rem; color: #888;">3 жизни · 35 очков</div>
            </button>
        </div>
        
        <button id="closeZombieMenu" style="
            margin-top: 30px;
            padding: 12px 30px;
            background: #333;
            border: none;
            border-radius: 60px;
            color: #888;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s;
        ">❌ Закрыть</button>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 0 30px rgba(255,255,255,0.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        });
        btn.addEventListener('click', () => {
            const diff = btn.dataset.diff;
            modal.remove();
            startGame(diff);
        });
    });
    
    modal.querySelector('#closeZombieMenu').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ========== ЗАПУСК ИГРЫ ==========
function startGame(difficulty) {
    const config = DIFFICULTY[difficulty];
    if (!config) return;
    
    gameState.difficulty = difficulty;
    gameState.difficultyConfig = config;
    gameState.lives = config.maxLives;
    gameState.maxLives = config.maxLives;
    gameState.score = 0;
    gameState.kills = 0;
    gameState.zombies = [];
    gameState.isRunning = true;
    gameState.startTime = Date.now();
    gameState.currentEscalationLevel = 0;
    gameState.maxKillsReached = 0;
    
    const container = document.createElement('div');
    container.id = 'zombieGameContainer';
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #1a1a2e;
        z-index: 99998;
        cursor: none;
        overflow: hidden;
        user-select: none;
    `;
    document.body.appendChild(container);
    gameState.container = container;
    
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
    `;
    container.appendChild(canvas);
    gameState.canvas = canvas;
    gameState.ctx = canvas.getContext('2d');
    
    const crosshair = document.createElement('div');
    crosshair.id = 'zombieCrosshair';
    crosshair.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99999;
        width: 40px;
        height: 40px;
        transform: translate(-50%, -50%);
        display: none;
    `;
    crosshair.innerHTML = `
        <svg viewBox="0 0 40 40" style="width:100%;height:100%;">
            <circle cx="20" cy="20" r="16" stroke="#ff0000" stroke-width="2" fill="none"/>
            <circle cx="20" cy="20" r="3" fill="#ff0000"/>
            <line x1="20" y1="0" x2="20" y2="8" stroke="#ff0000" stroke-width="2"/>
            <line x1="20" y1="32" x2="20" y2="40" stroke="#ff0000" stroke-width="2"/>
            <line x1="0" y1="20" x2="8" y2="20" stroke="#ff0000" stroke-width="2"/>
            <line x1="32" y1="20" x2="40" y2="20" stroke="#ff0000" stroke-width="2"/>
        </svg>
    `;
    document.body.appendChild(crosshair);
    crosshair.style.display = 'block';
    
    document.addEventListener('mousemove', (e) => {
        crosshair.style.left = e.clientX + 'px';
        crosshair.style.top = e.clientY + 'px';
    });
    
    drawBackground();
    createUI();
    startSpawning();
    gameLoop();
    container.addEventListener('click', handleShoot);
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawBackground();
    });
}

// ========== РИСОВАНИЕ ФОНА ==========
function drawBackground() {
    const ctx = gameState.ctx;
    if (!ctx) return;
    
    const canvas = gameState.canvas;
    const w = canvas.width;
    const h = canvas.height;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#2d2d44');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    
    ctx.beginPath();
    ctx.arc(w * 0.8, 80, 50, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.8, 80, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 200, 0.5)';
    ctx.fill();
    
    ctx.fillStyle = 'rgba(40, 40, 60, 0.6)';
    const buildings = [
        { x: 0.05, w: 0.12, h: 0.5 },
        { x: 0.2, w: 0.1, h: 0.7 },
        { x: 0.35, w: 0.15, h: 0.4 },
        { x: 0.55, w: 0.08, h: 0.6 },
        { x: 0.7, w: 0.12, h: 0.45 },
        { x: 0.85, w: 0.1, h: 0.65 }
    ];
    buildings.forEach(b => {
        const x = b.x * w;
        const width = b.w * w;
        const height = b.h * h;
        const y = h - height;
        ctx.fillRect(x, y, width, height);
        ctx.fillStyle = 'rgba(255, 200, 100, 0.1)';
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 2; col++) {
                const wx = x + width * 0.1 + col * width * 0.35;
                const wy = y + height * 0.1 + row * height * 0.25;
                ctx.fillRect(wx, wy, width * 0.15, height * 0.1);
            }
        }
        ctx.fillStyle = 'rgba(40, 40, 60, 0.6)';
    });
}

// ========== СОЗДАНИЕ UI ==========
function createUI() {
    const container = gameState.container;
    
    const panel = document.createElement('div');
    panel.id = 'zombieUI';
    panel.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 20px;
        color: white;
        font-size: 1.1rem;
        font-weight: bold;
        background: rgba(0, 0, 0, 0.6);
        padding: 10px 20px;
        border-radius: 60px;
        border: 1px solid rgba(255,255,255,0.1);
        z-index: 10;
        pointer-events: none;
        flex-wrap: wrap;
        justify-content: center;
    `;
    panel.innerHTML = `
        <div id="zombieLives">❤️ ${'❤️'.repeat(gameState.maxLives)}</div>
        <div id="zombieScore">🎯 Очки: 0</div>
        <div id="zombieKills">💀 Убито: 0</div>
        <div id="zombieLevel" style="color: #ffd700;">🌱 Начало</div>
        <div id="zombieDifficulty" style="color: ${DIFFICULTY[gameState.difficulty].label.includes('Лёгкий') ? '#27ae60' : DIFFICULTY[gameState.difficulty].label.includes('Нормальный') ? '#f39c12' : '#e74c3c'}">
            ${DIFFICULTY[gameState.difficulty].label}
        </div>
    `;
    container.appendChild(panel);
}

// ========== ОБНОВЛЕНИЕ UI ==========
function updateZombieUI() {
    const livesEl = document.getElementById('zombieLives');
    const scoreEl = document.getElementById('zombieScore');
    const killsEl = document.getElementById('zombieKills');
    const levelEl = document.getElementById('zombieLevel');
    
    if (livesEl) {
        const hearts = '❤️'.repeat(Math.max(0, gameState.lives));
        const lost = '🖤'.repeat(Math.max(0, gameState.maxLives - gameState.lives));
        livesEl.textContent = hearts + lost;
    }
    if (scoreEl) scoreEl.textContent = `🎯 Очки: ${gameState.score}`;
    if (killsEl) killsEl.textContent = `💀 Убито: ${gameState.kills}`;
    if (levelEl) {
        const level = ESCALATION_LEVELS[gameState.currentEscalationLevel] || ESCALATION_LEVELS[0];
        levelEl.textContent = level.label;
    }
}

// ========== ПОЛУЧИТЬ ТЕКУЩИЙ УРОВЕНЬ СЛОЖНОСТИ ==========
function getCurrentEscalationLevel() {
    let level = 0;
    for (let i = ESCALATION_LEVELS.length - 1; i >= 0; i--) {
        if (gameState.kills >= ESCALATION_LEVELS[i].killsNeeded) {
            level = i;
            break;
        }
    }
    return level;
}

// ========== ОБНОВЛЕНИЕ ЭСКАЛАЦИИ ==========
function updateEscalation() {
    const newLevel = getCurrentEscalationLevel();
    if (newLevel !== gameState.currentEscalationLevel) {
        gameState.currentEscalationLevel = newLevel;
        const level = ESCALATION_LEVELS[newLevel];
        
        // Показываем уведомление о повышении сложности
        showMessage(`⚡ ${level.label}!`, '#ffd966');
        
        // Обновляем спавн с новыми параметрами
        if (gameState.spawnTimer) {
            clearTimeout(gameState.spawnTimer);
            startSpawning();
        }
    }
}

// ========== СПАВН ЗОМБИ ==========
function startSpawning() {
    if (gameState.spawnTimer) clearTimeout(gameState.spawnTimer);
    
    const config = gameState.difficultyConfig;
    const level = ESCALATION_LEVELS[gameState.currentEscalationLevel] || ESCALATION_LEVELS[0];
    
    // Применяем эскалацию
    const maxZombies = Math.floor(config.baseMaxZombies + level.maxZombiesBonus);
    const baseMin = config.baseSpawnInterval[0];
    const baseMax = config.baseSpawnInterval[1];
    const minInterval = Math.max(300, baseMin * level.spawnSpeedMult);
    const maxInterval = Math.max(500, baseMax * level.spawnSpeedMult);
    
    function spawn() {
        if (!gameState.isRunning) return;
        
        const currentZombies = gameState.zombies.filter(z => z.active && !z.isDying).length;
        if (currentZombies < maxZombies) {
            createZombie();
        }
        
        const nextDelay = minInterval + Math.random() * (maxInterval - minInterval);
        gameState.spawnTimer = setTimeout(spawn, nextDelay);
    }
    
    gameState.spawnTimer = setTimeout(spawn, 500);
}

// ========== СОЗДАНИЕ ЗОМБИ ИЛИ БОМБЫ ==========
function createZombie() {
    const canvas = gameState.canvas;
    const w = canvas.width;
    const h = canvas.height;
    
    // Шанс появления бомбы (10-25% в зависимости от эскалации)
    const bombChance = 0.10 + (gameState.currentEscalationLevel * 0.03);
    const isBomb = Math.random() < Math.min(bombChance, 0.30);
    
    const x = 60 + Math.random() * (w - 120);
    const y = 100 + Math.random() * (h - 250);
    const size = isBomb ? 35 : (45 + Math.random() * 35);
    
    const level = ESCALATION_LEVELS[gameState.currentEscalationLevel] || ESCALATION_LEVELS[0];
    const finalSize = isBomb ? size : size * level.zombieSizeMult;
    
    const zombie = {
        id: Date.now() + Math.random(),
        x: x,
        y: y,
        size: finalSize,
        active: true,
        spawnTime: Date.now(),
        isDying: false,
        deathTime: 0,
        direction: Math.random() > 0.5 ? 1 : -1,
        wobble: 0,
        color: `hsl(${100 + Math.random() * 20}, 30%, ${20 + Math.random() * 15}%)`,
        isBomb: isBomb,
        bombPulse: 0
    };
    
    gameState.zombies.push(zombie);
}

// ========== ИГРОВОЙ ЦИКЛ ==========
function gameLoop() {
    if (!gameState.isRunning) return;
    
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // Проверяем эскалацию
    updateEscalation();
    
    const now = Date.now();
    const killTime = gameState.difficultyConfig.killTime;
    
    gameState.zombies.forEach(zombie => {
        if (!zombie.active) return;
        
        // Анимация пульсации для бомбы
        if (zombie.isBomb) {
            zombie.bombPulse += 0.05;
        }
        
        // Проверяем таймаут
        if (!zombie.isBomb && now - zombie.spawnTime > killTime) {
            zombie.active = false;
            loseLife();
            return;
        }
        
        zombie.wobble += 0.02;
        drawZombie(ctx, zombie, now);
    });
    
    gameState.zombies = gameState.zombies.filter(z => z.active || z.isDying);
    updateZombieUI();
    
    gameState.gameLoop = requestAnimationFrame(gameLoop);
}

// ========== РИСОВАНИЕ ЗОМБИ ==========
function drawZombie(ctx, zombie, now) {
    const x = zombie.x;
    const y = zombie.y + Math.sin(zombie.wobble) * 3;
    const size = zombie.size;
    const s = size / 2;
    
    if (zombie.isDying) {
        const elapsed = (now - zombie.deathTime) / 1000;
        if (elapsed > 0.4) {
            zombie.active = false;
            return;
        }
        const fallProgress = elapsed / 0.4;
        const fallY = fallProgress * 100;
        const opacity = 1 - fallProgress * 0.5;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(x, y + fallY);
        ctx.rotate(fallProgress * 0.5);
        if (zombie.isBomb) {
            drawBomb(ctx, 0, 0, size);
        } else {
            drawZombieBody(ctx, 0, 0, size, zombie.color);
        }
        ctx.restore();
        return;
    }
    
    if (zombie.isBomb) {
        drawBomb(ctx, x, y, size);
    } else {
        // Свечение вокруг зомби
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 0.8);
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        drawZombieBody(ctx, x, y, size, zombie.color);
    }
}

// ========== РИСОВАНИЕ БОМБЫ ==========
function drawBomb(ctx, x, y, size) {
    const s = size / 2;
    const pulse = Math.sin(Date.now() / 300) * 0.1 + 0.9;
    
    // Свечение
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 1.2 * pulse);
    gradient.addColorStop(0, 'rgba(255, 50, 0, 0.4)');
    gradient.addColorStop(0.5, 'rgba(255, 20, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    
    // Тело бомбы
    ctx.shadowColor = 'rgba(255, 50, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Красный пояс
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(x - s * 0.7, y - s * 0.1, s * 1.4, s * 0.2);
    
    // Анимация мигания
    if (Math.sin(Date.now() / 400) > 0.3) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Иконка 💣
    ctx.shadowBlur = 0;
    ctx.font = `${s * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', x, y + 2);
}

// ========== РИСОВАНИЕ ТЕЛА ЗОМБИ ==========
function drawZombieBody(ctx, x, y, size, color) {
    const s = size / 2;
    
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(x - s * 0.3, y - s * 0.1, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.3, y - s * 0.1, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - s * 0.35, y - s * 0.05, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.25, y - s * 0.05, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + s * 0.15, s * 0.25, 0.1, Math.PI - 0.1);
    ctx.stroke();
    
    ctx.fillStyle = color;
    ctx.shadowBlur = 3;
    const armAngle = Math.sin(Date.now() / 500) * 0.3;
    ctx.save();
    ctx.translate(x - s * 0.7, y + s * 0.1);
    ctx.rotate(-0.5 + armAngle);
    ctx.fillRect(-3, 0, 6, s * 0.6);
    ctx.restore();
    ctx.save();
    ctx.translate(x + s * 0.7, y + s * 0.1);
    ctx.rotate(0.5 - armAngle);
    ctx.fillRect(-3, 0, 6, s * 0.6);
    ctx.restore();
}

// ========== ВЗРЫВ БОМБЫ ==========
function explodeBomb(bomb) {
    // Находим всех активных зомби (кроме самой бомбы)
    const targets = gameState.zombies.filter(z => 
        z.active && !z.isDying && z.id !== bomb.id
    );
    
    let killed = 0;
    for (const target of targets) {
        target.isDying = true;
        target.deathTime = Date.now();
        killed++;
        
        // Начисляем очки за каждого убитого
        const config = gameState.difficultyConfig;
        gameState.score += config.pointsPerKill;
    }
    
    // Бонус за массовое уничтожение
    if (killed > 0) {
        const bonus = killed * 5;
        gameState.score += bonus;
        gameState.kills += killed;
        
        showMessage(`💥 ВЗРЫВ! Уничтожено ${killed} зомби! +${bonus} бонусных очков!`, '#ff6b35');
        addLogEntry(`💥 Взрыв бомбы: уничтожено ${killed} зомби`, 'combat');
        
        // Эффект взрыва
        createBigExplosion(bomb.x, bomb.y);
    }
    
    // Удаляем бомбу
    bomb.active = false;
}

// ========== ЭФФЕКТ БОЛЬШОГО ВЗРЫВА ==========
function createBigExplosion(x, y) {
    const container = gameState.container;
    
    // Вспышка
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        left: ${x - 150}px;
        top: ${y - 150}px;
        width: 300px;
        height: 300px;
        background: radial-gradient(circle, rgba(255,200,50,0.8), rgba(255,100,0,0.5), rgba(255,0,0,0) 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 6;
        animation: explosionFlash 0.5s ease-out forwards;
    `;
    container.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
    
    // Частицы взрыва
    for (let i = 0; i < 50; i++) {
        const el = document.createElement('div');
        const angle = Math.random() * Math.PI * 2;
        const speed = 100 + Math.random() * 300;
        const size = 4 + Math.random() * 10;
        const colors = ['#ff4400', '#ff8800', '#ffcc00', '#ff2200', '#ff6600'];
        
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none;
            z-index: 5;
            transition: all 0.6s ease-out;
        `;
        container.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = `translate(${Math.cos(angle) * speed}px, ${Math.sin(angle) * speed}px) scale(0)`;
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 700);
    }
}

// ========== ОБРАБОТЧИК ВЫСТРЕЛА ==========
function handleShoot(e) {
    if (!gameState.isRunning) return;
    
    const rect = gameState.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    let hit = false;
    let hitIndex = -1;
    
    for (let i = gameState.zombies.length - 1; i >= 0; i--) {
        const zombie = gameState.zombies[i];
        if (!zombie.active || zombie.isDying) continue;
        
        const dist = Math.sqrt(
            Math.pow(mouseX - zombie.x, 2) + 
            Math.pow(mouseY - zombie.y, 2)
        );
        
        const hitRadius = zombie.isBomb ? zombie.size * 0.8 : zombie.size / 2;
        if (dist < hitRadius) {
            hit = true;
            hitIndex = i;
            break;
        }
    }
    
    if (hit && hitIndex !== -1) {
        const target = gameState.zombies[hitIndex];
        
        if (target.isBomb) {
            // Взрываем бомбу!
            explodeBomb(target);
            createHitEffect(target.x, target.y);
            updateZombieUI();
        } else {
            // Обычное попадание по зомби
            target.isDying = true;
            target.deathTime = Date.now();
            
            const config = gameState.difficultyConfig;
            gameState.score += config.pointsPerKill;
            gameState.kills++;
            
            createHitEffect(target.x, target.y);
            updateZombieUI();
            
            // Проверяем эскалацию
            updateEscalation();
        }
    } else {
        createMissEffect(mouseX, mouseY);
    }
}

// ========== ЭФФЕКТ ПОПАДАНИЯ ==========
function createHitEffect(x, y) {
    const container = gameState.container;
    const particles = 20;
    
    for (let i = 0; i < particles; i++) {
        const el = document.createElement('div');
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 150;
        const size = 4 + Math.random() * 8;
        
        el.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${['#ff0000', '#ff8800', '#ffff00', '#ff4400'][Math.floor(Math.random() * 4)]};
            border-radius: 50%;
            pointer-events: none;
            z-index: 5;
            transition: all 0.4s ease-out;
        `;
        container.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = `translate(${Math.cos(angle) * speed}px, ${Math.sin(angle) * speed}px) scale(0)`;
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 500);
    }
    
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        left: ${x - 30}px;
        top: ${y - 30}px;
        width: 60px;
        height: 60px;
        background: radial-gradient(circle, rgba(255,255,200,0.8), rgba(255,200,100,0) 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 4;
        transition: all 0.2s ease-out;
    `;
    container.appendChild(flash);
    requestAnimationFrame(() => {
        flash.style.transform = 'scale(3)';
        flash.style.opacity = '0';
    });
    setTimeout(() => flash.remove(), 300);
}

// ========== ЭФФЕКТ ПРОМАХА ==========
function createMissEffect(x, y) {
    const container = gameState.container;
    const el = document.createElement('div');
    el.textContent = '✖';
    el.style.cssText = `
        position: absolute;
        left: ${x - 15}px;
        top: ${y - 20}px;
        font-size: 2rem;
        font-weight: bold;
        color: #e74c3c;
        pointer-events: none;
        z-index: 5;
        transition: all 0.5s ease-out;
        opacity: 1;
    `;
    container.appendChild(el);
    requestAnimationFrame(() => {
        el.style.transform = 'translateY(-40px) scale(1.5)';
        el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 600);
}

// ========== ПОТЕРЯ ЖИЗНИ ==========
function loseLife() {
    gameState.lives--;
    updateZombieUI();
    
    const container = gameState.container;
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 0, 0, 0.15);
        pointer-events: none;
        z-index: 3;
        transition: all 0.3s ease-out;
    `;
    container.appendChild(flash);
    requestAnimationFrame(() => {
        flash.style.opacity = '0';
    });
    setTimeout(() => flash.remove(), 400);
    
    if (gameState.lives <= 0) {
        endGame(false);
    }
}

// ========== ЗАВЕРШЕНИЕ ИГРЫ ==========
function endGame(won = false) {
    if (!gameState.isRunning) return;
    gameState.isRunning = false;
    
    if (gameState.spawnTimer) {
        clearTimeout(gameState.spawnTimer);
        gameState.spawnTimer = null;
    }
    if (gameState.gameLoop) {
        cancelAnimationFrame(gameState.gameLoop);
        gameState.gameLoop = null;
    }
    
    const crosshair = document.getElementById('zombieCrosshair');
    if (crosshair) crosshair.remove();
    
    const config = gameState.difficultyConfig;
    const baseMoney = gameState.kills * config.moneyPerKill;
    const bonusMoney = Math.floor(gameState.score / 50) * 10;
    const survivalBonus = Math.floor((Date.now() - gameState.startTime) / 60000) * 50;
    const escalationBonus = gameState.currentEscalationLevel * 20;
    const totalMoney = Math.floor((baseMoney + bonusMoney + survivalBonus + escalationBonus) * config.bonusMultiplier);
    const expGain = Math.floor((gameState.kills * config.expPerKill + Math.floor(gameState.score / 20) + escalationBonus * 2) * config.bonusMultiplier);
    
    showResultScreen(won, totalMoney, expGain, survivalBonus, escalationBonus);
}

// ========== ЭКРАН РЕЗУЛЬТАТОВ ==========
function showResultScreen(won, moneyReward, expReward, survivalBonus, escalationBonus) {
    const container = gameState.container;
    container.innerHTML = '';
    
    const resultDiv = document.createElement('div');
    resultDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 40px 50px;
        border-radius: 30px;
        border: 2px solid ${won ? '#4caf50' : '#e74c3c'};
        text-align: center;
        color: white;
        max-width: 450px;
        width: 90%;
        box-shadow: 0 0 60px rgba(0,0,0,0.8);
        z-index: 20;
    `;
    
    const level = ESCALATION_LEVELS[gameState.currentEscalationLevel] || ESCALATION_LEVELS[0];
    
    resultDiv.innerHTML = `
        <div style="font-size: 4rem; margin-bottom: 10px;">${won ? '🏆' : '💀'}</div>
        <h2 style="color: ${won ? '#4caf50' : '#e74c3c'}; margin: 0 0 10px 0;">
            ${won ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА'}
        </h2>
        <div style="font-size: 3rem; font-weight: bold; color: #ffd966; margin: 10px 0;">
            ${gameState.score} 🎯
        </div>
        <div style="color: #aaa; margin-bottom: 10px;">
            💀 Убито зомби: ${gameState.kills}
        </div>
        <div style="color: #aaa; margin-bottom: 10px;">
            ⚡ Достигнутый уровень: ${level.label}
        </div>
        <div style="color: #aaa; margin-bottom: 20px;">
            🕐 Время: ${Math.floor((Date.now() - gameState.startTime) / 1000)} сек
        </div>
        <div style="border-top: 1px solid #333; padding-top: 15px; margin-bottom: 20px;">
            <div style="color: #4caf50;">💰 +${moneyReward}₽</div>
            <div style="color: #ffd966;">⭐ +${expReward} опыта</div>
            ${survivalBonus > 0 ? `<div style="color: #4fc3f7;">⏱️ Бонус за выживание: +${survivalBonus}₽</div>` : ''}
            ${escalationBonus > 0 ? `<div style="color: #ff6b35;">🔥 Бонус за сложность: +${escalationBonus}₽</div>` : ''}
        </div>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button id="zombieRetryBtn" style="
                padding: 12px 30px;
                background: ${won ? '#4caf50' : '#f39c12'};
                border: none;
                border-radius: 60px;
                color: white;
                font-size: 1rem;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s;
            ">🔄 Играть снова</button>
            <button id="zombieExitBtn" style="
                padding: 12px 30px;
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
    
    const newMoney = money + moneyReward;
    setStats(null, null, null, newMoney);
    addExperience(expReward);
    updateUI();
    saveGameData();
    addLogEntry(`🧟 Зомби-шутер: ${gameState.score} очков, ${gameState.kills} убийств, уровень ${gameState.currentEscalationLevel} (+${moneyReward}₽, +${expReward} опыта)`, 'system');
    
    resultDiv.querySelector('#zombieRetryBtn').addEventListener('click', () => {
        container.remove();
        const oldCrosshair = document.getElementById('zombieCrosshair');
        if (oldCrosshair) oldCrosshair.remove();
        showDifficultyMenu();
    });
    
    resultDiv.querySelector('#zombieExitBtn').addEventListener('click', () => {
        container.remove();
        const oldCrosshair = document.getElementById('zombieCrosshair');
        if (oldCrosshair) oldCrosshair.remove();
        showMessage('🧟 Спасибо за игру!', '#ffd966');
    });
}

// ========== ДОБАВЛЯЕМ СТИЛИ ДЛЯ ВЗРЫВА ==========
if (!document.getElementById('zombieExplosionStyles')) {
    const style = document.createElement('style');
    style.id = 'zombieExplosionStyles';
    style.textContent = `
        @keyframes explosionFlash {
            0% { transform: scale(0.5); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
