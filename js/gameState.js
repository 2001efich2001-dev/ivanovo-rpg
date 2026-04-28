// js/gameState.js
import { showMessage } from './utils.js';

export let health = 100;
export let maxHealth = 100;
export let hunger = 100;
export let maxHunger = 100;
export let cold = 100;
export let maxCold = 100;
export let money = 500;

// ========== ЭНЕРГИЯ ==========
export let energy = 100;
export let maxEnergy = 100;
export let lastEnergyUpdate = Date.now(); // время последнего восстановления энергии

export let inventory = [];
export let equipped = { head: null, body: null, legs: null, feet: null };

// Текущая локация (по умолчанию 'church' — церковь)
export let currentLocation = 'church';

// ========== ВРЕМЯ И ПОГОДА ==========
export let accumulatedMinutes = 0;
export let currentWeather = 'sunny';
export let currentTemperature = 15;

// ========== ЛОГ ДЕЙСТВИЙ ==========
export let actionLog = [];
const MAX_LOG_ENTRIES = 50;

// ========== ОПЫТ И УРОВНИ ==========
export let experience = 0;
export let level = 1;
export let requiredExp = 100;

export let healthValueSpan, hungerValueSpan, coldValueSpan, moneyValueSpan;
export let healthFill, hungerFill, coldFill;
export let levelValueSpan, expValueSpan, expRequiredSpan, expFill;
export let energyValueSpan, energyFill; // для отображения энергии

let onLocationChangeCallback = null;
let onLogUpdateCallback = null;
let onExpUpdateCallback = null;
let onEnergyUpdateCallback = null;

export function initDOM() {
    healthValueSpan = document.getElementById('healthValue');
    hungerValueSpan = document.getElementById('hungerValue');
    coldValueSpan = document.getElementById('coldValue');
    moneyValueSpan = document.getElementById('moneyValue');
    healthFill = document.getElementById('healthFill');
    hungerFill = document.getElementById('hungerFill');
    coldFill = document.getElementById('coldFill');
    
    levelValueSpan = document.getElementById('levelValue');
    expValueSpan = document.getElementById('expValue');
    expRequiredSpan = document.getElementById('expRequired');
    expFill = document.getElementById('expFill');
    
    // Элементы для энергии
    energyValueSpan = document.getElementById('energyValue');
    energyFill = document.getElementById('energyFill');
}

export function updateUI() {
    if (healthValueSpan) healthValueSpan.innerText = `${Math.floor(health)} / ${maxHealth}`;
    if (hungerValueSpan) hungerValueSpan.innerText = `${Math.floor(hunger)} / ${maxHunger}`;
    if (coldValueSpan) coldValueSpan.innerText = `${Math.floor(cold)} / ${maxCold}`;
    if (moneyValueSpan) moneyValueSpan.innerText = Math.floor(money);
    if (healthFill) healthFill.style.width = (health / maxHealth) * 100 + '%';
    if (hungerFill) hungerFill.style.width = (hunger / maxHunger) * 100 + '%';
    if (coldFill) coldFill.style.width = (cold / maxCold) * 100 + '%';
    
    if (levelValueSpan) levelValueSpan.innerText = level;
    if (expValueSpan) expValueSpan.innerText = Math.floor(experience);
    if (expRequiredSpan) expRequiredSpan.innerText = requiredExp;
    if (expFill) expFill.style.width = (experience / requiredExp) * 100 + '%';
    
    // Обновляем отображение энергии
    if (energyValueSpan) energyValueSpan.innerText = `${Math.floor(energy)} / ${maxEnergy}`;
    if (energyFill) energyFill.style.width = (energy / maxEnergy) * 100 + '%';
}

export function setStats(h, hu, c, m) {
    health = isNaN(h) ? 100 : Math.min(maxHealth, Math.max(0, h));
    hunger = isNaN(hu) ? 100 : Math.min(maxHunger, Math.max(0, hu));
    cold = isNaN(c) ? 100 : Math.min(maxCold, Math.max(0, c));
    money = isNaN(m) ? 500 : Math.max(0, m);
    updateUI();
}

// ========== Функции для энергии ==========
export function setEnergyUpdateCallback(callback) {
    onEnergyUpdateCallback = callback;
}

// Восстановление энергии (вызывать перед действиями или по таймеру)
export function updateEnergy() {
    const now = Date.now();
    const secondsPassed = (now - lastEnergyUpdate) / 1000;
    // Восстанавливаем 1 энергию каждые 2 минуты (120 секунд)
    const energyToAdd = Math.floor(secondsPassed / 120);
    if (energyToAdd > 0 && energy < maxEnergy) {
        energy = Math.min(maxEnergy, energy + energyToAdd);
        lastEnergyUpdate = now;
        updateUI();
        if (onEnergyUpdateCallback) onEnergyUpdateCallback();
        import('./firestore.js').then(m => {
            if (typeof m.saveGameData === 'function') m.saveGameData();
        });
    }
}

// Принудительная установка энергии (при загрузке или сне)
export function setEnergy(newEnergy) {
    energy = Math.min(maxEnergy, Math.max(0, newEnergy));
    lastEnergyUpdate = Date.now();
    updateUI();
}

// Проверка, хватает ли энергии на действие
export function hasEnoughEnergy(cost) {
    updateEnergy(); // обновляем перед проверкой
    return energy >= cost;
}

// Трата энергии
export function spendEnergy(cost) {
    if (cost === undefined || cost === null) return true;
    if (energy >= cost) {
        energy -= cost;
        lastEnergyUpdate = Date.now();
        updateUI();
        return true;
    }
    showMessage(`❌ Не хватает энергии! Нужно ${cost}⚡`, '#e74c3c');
    return false;
}

// ========== Функции для опыта и уровней ==========
function calculateRequiredExp(lvl) {
    return Math.floor(100 * Math.pow(1.2, lvl - 1));
}

export function addExperience(amount) {
    if (amount <= 0) return;
    experience += amount;
    let leveledUp = false;
    
    while (experience >= requiredExp) {
        experience -= requiredExp;
        level++;
        requiredExp = calculateRequiredExp(level);
        leveledUp = true;
        addLogEntry(`🎉 Повышение уровня до ${level}!`, 'system');
        showMessage(`🎉 Поздравляем! Вы достигли ${level} уровня!`, '#ffd966');
    }
    
    updateUI();
    if (onExpUpdateCallback) onExpUpdateCallback();
    
    import('./firestore.js').then(m => {
        if (typeof m.saveGameData === 'function') m.saveGameData();
    });
}

export function setExpUpdateCallback(callback) {
    onExpUpdateCallback = callback;
}

export function setExpData(exp, lvl) {
    experience = exp || 0;
    level = lvl || 1;
    requiredExp = calculateRequiredExp(level);
    updateUI();
}

// ========== Функции для лога действий ==========
export function setLogUpdateCallback(callback) {
    onLogUpdateCallback = callback;
}

export function addLogEntry(message, type = 'system') {
    const timeStr = getCurrentTimeString();
    const newEntry = { time: timeStr, message: message, type: type };
    actionLog.push(newEntry);
    if (actionLog.length > MAX_LOG_ENTRIES) {
        actionLog.shift();
    }
    if (onLogUpdateCallback) {
        onLogUpdateCallback();
    }
}

export function setActionLog(log) {
    actionLog = log || [];
    if (actionLog.length > MAX_LOG_ENTRIES) {
        actionLog = actionLog.slice(-MAX_LOG_ENTRIES);
    }
    if (onLogUpdateCallback) onLogUpdateCallback();
}

export function getActionLog() {
    return actionLog;
}

// ========== Функции для времени и погоды ==========
export function setTimeWeather(minutes, weather, temp) {
    accumulatedMinutes = minutes;
    currentWeather = weather;
    currentTemperature = temp;
    if (typeof updateTimeWeatherUI === 'function') {
        updateTimeWeatherUI();
    }
}

export function getCurrentTimeString() {
    const totalMinutes = Math.floor(accumulatedMinutes);
    let hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getWeatherIcon() {
    const icons = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️' };
    return icons[currentWeather] || '☀️';
}

export function getTimeOfDayIcon() {
    const totalMinutes = Math.floor(accumulatedMinutes);
    const hours = Math.floor(totalMinutes / 60) % 24;
    if (hours >= 6 && hours < 11) return '🌅';
    if (hours >= 11 && hours < 17) return '☀️';
    if (hours >= 17 && hours < 22) return '🌙';
    return '🌙';
}

export function setLocationChangeCallback(callback) {
    onLocationChangeCallback = callback;
}

export function setCurrentLocation(locationId) {
    if (currentLocation === locationId) return;
    currentLocation = locationId;
    addLogEntry(`Переход в локацию "${locationId}"`, 'location');
    if (onLocationChangeCallback) {
        onLocationChangeCallback(currentLocation);
    }
}
export function setLastEnergyUpdate(value) {
    lastEnergyUpdate = value;
}
