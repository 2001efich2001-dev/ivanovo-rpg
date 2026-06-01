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
export let lastEnergyUpdate = Date.now();

// ========== ОПЬЯНЕНИЕ ==========
export let intoxication = 0;
export let maxIntoxication = 100;
export let lastIntoxicationUpdate = Date.now();

export let inventory = [];
export let equipped = { head: null, body: null, legs: null, feet: null };

export let currentLocation = 'church';

// ========== ВРЕМЯ И ПОГОДА ==========
export let accumulatedMinutes = 720;
export let currentWeather = 'sunny';
export let currentTemperature = 15;

// ========== ЛОГ ДЕЙСТВИЙ ==========
export let actionLog = [];
const MAX_LOG_ENTRIES = 50;

// ========== ОПЫТ И УРОВНИ ==========
export let experience = 0;
export let level = 1;
export let requiredExp = 100;

// ========== ЕЖЕДНЕВНЫЙ БОНУС ==========
export let dailyBonusLastClaim = null;
export let dailyBonusStreak = 0;

// ========== СИСТЕМА ЖИЛЬЯ ==========
export let currentHome = null;           // ID текущего жилья
export let ownedHomes = [];               // Массив ID купленных объектов
export let homeStorage = [];              // Предметы в хранилище
export let homeStorageCapacity = 0;       // Вместимость хранилища
export let housingDebt = 0;               // Долг по налогам
export let lastTaxPaid = null;            // Дата последней оплаты налога

export let healthValueSpan, hungerValueSpan, coldValueSpan, moneyValueSpan;
export let healthFill, hungerFill, coldFill;
export let levelValueSpan, expValueSpan, expRequiredSpan, expFill;
export let energyValueSpan, energyFill;
export let intoxicationValueSpan, intoxicationFill;

let onLocationChangeCallback = null;
let onLogUpdateCallback = null;
let onExpUpdateCallback = null;
let onEnergyUpdateCallback = null;
let onIntoxicationUpdateCallback = null;

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
    
    energyValueSpan = document.getElementById('energyValue');
    energyFill = document.getElementById('energyFill');
    
    intoxicationValueSpan = document.getElementById('intoxicationValue');
    intoxicationFill = document.getElementById('intoxicationFill');
}

export function updateUI() {
    const safeHealth = isNaN(health) ? 100 : health;
    const safeHunger = isNaN(hunger) ? 100 : hunger;
    const safeCold = isNaN(cold) ? 100 : cold;
    const safeMoney = isNaN(money) ? 500 : money;
    const safeEnergy = isNaN(energy) ? 100 : energy;
    const safeExp = isNaN(experience) ? 0 : experience;
    const safeLevel = isNaN(level) ? 1 : level;
    const safeIntoxication = isNaN(intoxication) ? 0 : intoxication;
    
    if (healthValueSpan) healthValueSpan.innerText = `${Math.floor(safeHealth)} / ${maxHealth}`;
    if (hungerValueSpan) hungerValueSpan.innerText = `${Math.floor(safeHunger)} / ${maxHunger}`;
    if (coldValueSpan) coldValueSpan.innerText = `${Math.floor(safeCold)} / ${maxCold}`;
    if (moneyValueSpan) moneyValueSpan.innerText = Math.floor(safeMoney);
    if (healthFill) healthFill.style.width = (safeHealth / maxHealth) * 100 + '%';
    if (hungerFill) hungerFill.style.width = (safeHunger / maxHunger) * 100 + '%';
    if (coldFill) coldFill.style.width = (safeCold / maxCold) * 100 + '%';
    
    if (levelValueSpan) levelValueSpan.innerText = safeLevel;
    if (expValueSpan) expValueSpan.innerText = Math.floor(safeExp);
    if (expRequiredSpan) expRequiredSpan.innerText = requiredExp;
    if (expFill) expFill.style.width = (safeExp / requiredExp) * 100 + '%';
    
    if (energyValueSpan) energyValueSpan.innerText = `${Math.floor(safeEnergy)} / ${maxEnergy}`;
    if (energyFill) energyFill.style.width = (safeEnergy / maxEnergy) * 100 + '%';
    
    if (intoxicationValueSpan) intoxicationValueSpan.innerText = `${Math.floor(safeIntoxication)} / ${maxIntoxication}`;
    if (intoxicationFill) {
        intoxicationFill.style.width = (safeIntoxication / maxIntoxication) * 100 + '%';
        if (safeIntoxication < 20) {
            intoxicationFill.style.background = '#2ecc71';
        } else if (safeIntoxication < 50) {
            intoxicationFill.style.background = '#f39c12';
        } else if (safeIntoxication < 80) {
            intoxicationFill.style.background = '#e67e22';
        } else {
            intoxicationFill.style.background = '#e74c3c';
        }
    }
}

export function setStats(h, hu, c, m) {
    if (h !== undefined && h !== null) {
        health = isNaN(h) ? maxHealth : Math.min(maxHealth, Math.max(0, h));
    }
    if (hu !== undefined && hu !== null) {
        hunger = isNaN(hu) ? maxHunger : Math.min(maxHunger, Math.max(0, hu));
    }
    if (c !== undefined && c !== null) {
        cold = isNaN(c) ? maxCold : Math.min(maxCold, Math.max(0, c));
    }
    if (m !== undefined && m !== null) {
        money = isNaN(m) ? 500 : Math.max(0, m);
    }
    updateUI();
}

// ========== Функции для энергии ==========
export function setEnergyUpdateCallback(callback) {
    onEnergyUpdateCallback = callback;
}

export function updateEnergy() {
    const now = Date.now();
    const secondsPassed = (now - lastEnergyUpdate) / 1000;
    const energyToAdd = Math.floor(secondsPassed / 120);
    if (energyToAdd > 0 && energy < maxEnergy) {
        const safeEnergy = isNaN(energy) ? 100 : energy;
        energy = Math.min(maxEnergy, safeEnergy + energyToAdd);
        lastEnergyUpdate = now;
        updateUI();
        if (onEnergyUpdateCallback) onEnergyUpdateCallback();
        import('./firestore.js').then(m => {
            if (typeof m.saveGameData === 'function') m.saveGameData();
        });
    }
}

export function setEnergy(newEnergy) {
    const safeEnergy = Number(newEnergy);
    if (isNaN(safeEnergy)) {
        console.warn('setEnergy получил NaN, устанавливаем 100');
        energy = 100;
    } else {
        energy = Math.min(maxEnergy, Math.max(0, safeEnergy));
    }
    lastEnergyUpdate = Date.now();
    updateUI();
}

export function hasEnoughEnergy(cost) {
    updateEnergy();
    const safeEnergy = isNaN(energy) ? 100 : energy;
    return safeEnergy >= cost;
}

export function spendEnergy(cost) {
    if (cost === undefined || cost === null) return true;
    const safeEnergy = isNaN(energy) ? 100 : energy;
    if (safeEnergy >= cost) {
        energy = safeEnergy - cost;
        lastEnergyUpdate = Date.now();
        updateUI();
        return true;
    }
    showMessage(`❌ Не хватает энергии! Нужно ${cost}⚡`, '#e74c3c');
    return false;
}

// ========== Функции для опьянения ==========
export function setIntoxicationUpdateCallback(callback) {
    onIntoxicationUpdateCallback = callback;
}

export function updateIntoxication() {
    const now = Date.now();
    const secondsPassed = (now - lastIntoxicationUpdate) / 1000;
    const intoxicationToRemove = Math.floor(secondsPassed / 180);
    if (intoxicationToRemove > 0 && intoxication > 0) {
        intoxication = Math.max(0, intoxication - intoxicationToRemove);
        lastIntoxicationUpdate = now;
        updateUI();
        if (onIntoxicationUpdateCallback) onIntoxicationUpdateCallback();
        import('./firestore.js').then(m => {
            if (typeof m.saveGameData === 'function') m.saveGameData();
        });
    }
}

export function addIntoxication(amount) {
    const safeAmount = isNaN(amount) ? 0 : amount;
    intoxication = Math.min(maxIntoxication, intoxication + safeAmount);
    lastIntoxicationUpdate = Date.now();
    updateUI();
    
    if (intoxication >= 80 && intoxication - safeAmount < 80) {
        addLogEntry(`🍺 Ты в стельку! Опьянение достигло ${Math.floor(intoxication)}%`, 'system');
        showMessage(`🥴 Ты очень пьян! Осторожнее...`, '#e74c3c');
    } else if (intoxication >= 50 && intoxication - safeAmount < 50) {
        addLogEntry(`🥴 Опьянение достигло ${Math.floor(intoxication)}%`, 'system');
    } else if (intoxication >= 100) {
        addLogEntry(`💀 Отключка! Опьянение 100%`, 'system');
    }
    
    if (onIntoxicationUpdateCallback) onIntoxicationUpdateCallback();
}

export function reduceIntoxication(amount) {
    const safeAmount = isNaN(amount) ? 0 : amount;
    intoxication = Math.max(0, intoxication - safeAmount);
    lastIntoxicationUpdate = Date.now();
    updateUI();
    if (onIntoxicationUpdateCallback) onIntoxicationUpdateCallback();
}

export function getIntoxicationLuckModifier() {
    if (intoxication < 20) return 1.0;
    if (intoxication < 50) return 0.9;
    if (intoxication < 80) return 0.7;
    return 0.5;
}

export function getIntoxicationDamageModifier() {
    if (intoxication < 20) return 1.0;
    if (intoxication < 50) return 1.2;
    if (intoxication < 80) return 1.5;
    return 2.0;
}

export function canPerformAction(actionName = 'действие') {
    updateIntoxication();
    if (intoxication >= 80) {
        const randomFail = Math.random();
        if (randomFail < 0.3) {
            showMessage(`🥴 Ты слишком пьян, чтобы ${actionName}!`, '#e74c3c');
            addLogEntry(`❌ Не удалось ${actionName} из-за сильного опьянения`, 'system');
            return false;
        }
    }
    return true;
}

export function setIntoxication(newIntoxication) {
    const safeIntoxication = Number(newIntoxication);
    if (isNaN(safeIntoxication)) {
        intoxication = 0;
    } else {
        intoxication = Math.min(maxIntoxication, Math.max(0, safeIntoxication));
    }
    lastIntoxicationUpdate = Date.now();
    updateUI();
}

// ========== Функции для опыта и уровней ==========
function calculateRequiredExp(lvl) {
    return Math.floor(100 * Math.pow(1.2, lvl - 1));
}

export function addExperience(amount) {
    if (amount <= 0) return;
    const safeAmount = isNaN(amount) ? 0 : amount;
    experience += safeAmount;
    
    while (experience >= requiredExp) {
        experience -= requiredExp;
        level++;
        requiredExp = calculateRequiredExp(level);
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
    experience = isNaN(exp) ? 0 : exp;
    level = isNaN(lvl) ? 1 : lvl;
    requiredExp = calculateRequiredExp(level);
    updateUI();
}

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

export function setTimeWeather(minutes, weather, temp) {
    const safeMinutes = isNaN(minutes) ? 720 : minutes;
    const safeWeather = weather || 'sunny';
    const safeTemp = isNaN(temp) ? 15 : temp;
    
    accumulatedMinutes = safeMinutes;
    currentWeather = safeWeather;
    currentTemperature = safeTemp;
    
    if (typeof window.updateTimeWeatherUIFn === 'function') {
        window.updateTimeWeatherUIFn();
    } else {
        setTimeout(async () => {
            try {
                const timeWeather = await import('./timeWeather.js');
                if (typeof timeWeather.updateTimeWeatherUI === 'function') {
                    window.updateTimeWeatherUIFn = timeWeather.updateTimeWeatherUI;
                    timeWeather.updateTimeWeatherUI();
                }
            } catch(e) {
                console.warn('updateTimeWeatherUI пока не доступна');
            }
        }, 100);
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
    lastEnergyUpdate = isNaN(value) ? Date.now() : value;
}

// ========== ФУНКЦИИ ДЛЯ ЕЖЕДНЕВНОГО БОНУСА ==========
export function setDailyBonusData(lastClaim, streak) {
    dailyBonusLastClaim = lastClaim;
    dailyBonusStreak = streak || 0;
}

export function getDailyBonusData() {
    return {
        dailyBonusLastClaim,
        dailyBonusStreak
    };
}

// ========== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ВРЕМЕНИ ОПЬЯНЕНИЯ ==========
export function setLastIntoxicationUpdate(value) {
    lastIntoxicationUpdate = value;
}

// ========== ФУНКЦИИ ДЛЯ СИСТЕМЫ ЖИЛЬЯ ==========
export function setHousingData(data) {
    if (data) {
        currentHome = data.current ?? null;
        ownedHomes = data.owned ?? [];
        homeStorage = data.storage ?? [];
        homeStorageCapacity = data.storageCapacity ?? 0;
        housingDebt = data.debt ?? 0;
        lastTaxPaid = data.lastTaxPaid ?? null;
    }
    console.log('🏠 Загружены данные жилья:', { currentHome, ownedHomes, homeStorageCapacity, housingDebt });
}

export function initHousingData() {
    currentHome = null;
    ownedHomes = [];
    homeStorage = [];
    homeStorageCapacity = 0;
    housingDebt = 0;
    lastTaxPaid = null;
    console.log('🏠 Инициализированы данные жилья для нового игрока');
}

export function getHousingData() {
    return {
        current: currentHome,
        owned: ownedHomes,
        storage: homeStorage,
        storageCapacity: homeStorageCapacity,
        debt: housingDebt,
        lastTaxPaid: lastTaxPaid
    };
}

// Обновление вместимости хранилища в зависимости от типа жилья
export function updateStorageCapacity(homeType) {
    switch (homeType) {
        case 'dorm':
            homeStorageCapacity = 10;
            break;
        case 'apartment':
            homeStorageCapacity = 20;
            break;
        case 'house':
            homeStorageCapacity = 40;
            break;
        default:
            homeStorageCapacity = 0;
    }
    console.log(`🏠 Вместимость хранилища обновлена: ${homeStorageCapacity} слотов`);
}

// Добавление предмета в хранилище дома
export function addToHomeStorage(itemId, count = 1) {
    const existingItem = homeStorage.find(i => i.id === itemId);
    if (existingItem) {
        existingItem.count += count;
    } else {
        homeStorage.push({ id: itemId, count });
    }
    updateUI();
}

// Удаление предмета из хранилища дома
export function removeFromHomeStorage(itemId, count = 1) {
    const itemIndex = homeStorage.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || homeStorage[itemIndex].count < count) return false;
    
    if (homeStorage[itemIndex].count === count) {
        homeStorage.splice(itemIndex, 1);
    } else {
        homeStorage[itemIndex].count -= count;
    }
    updateUI();
    return true;
}
