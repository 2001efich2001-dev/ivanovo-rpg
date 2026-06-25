// js/gameState.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { shouldBlockRealtime, deactivateTradeGuard, getRemainingBlockTime, isTradeGuardActive } from './tradeGuard.js';

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
export let ownedHomes = [];               // Массив ID купленных объектов (кеш)
export let homeStorage = [];              // Предметы в хранилище
export let homeStorageCapacity = 0;       // Вместимость хранилища
export let housingDebt = 0;               // Долг по налогам
export let lastTaxPaid = null;            // Дата последней оплаты налога

// ========== НОВЫЕ ПОЛЯ ДЛЯ КОММУНАЛКИ/АРЕНДЫ ==========
export let housingAccount = 20000;        // Счёт для оплаты (максимум 20000₽)
export let housingDailyCost = 0;          // Ежедневная стоимость (зависит от типа жилья)
export let lastHousingCheck = null;       // Дата последней проверки списания

// ========== ГЛОБАЛЬНАЯ ПРОВЕРКА ВСЕХ ИГРОКОВ ==========
export let lastGlobalHousingCheck = null;  // Дата последней глобальной проверки

// ========== ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ ДАННЫХ ==========
export let lastUpdated = null;             // Время последнего обновления в Firestore

// ========== ТИТУЛЫ (БЕЙДЖИКИ) ==========
export let currentTitle = null;            // Текущий активный титул
export let ownedTitles = [];               // Массив полученных титулов

// ========== ТУТОРИАЛ ==========
export let tutorialEnabled = true;         // Глобальный выключатель подсказок
export let tutorialFlags = {
    // Общие
    shown_first_enter: false,
    shown_zone_click: false,
    shown_inventory: false,
    shown_map: false,
    shown_shop: false,
    shown_quests: false,
    shown_npc: false,
    shown_death: false,
    shown_money_1000: false,
    shown_energy_low: false,
    
    // Специфичные для механик
    shown_trade: false,
    shown_housing: false,
    shown_estate_agency: false,
    shown_home_teleport: false,
    shown_storage: false,
    shown_darts: false,
    shown_fishing: false,
    shown_slot_machine: false,
    shown_top_players: false,
    
    // Действия на локациях
    shown_beg: false,
    shown_search: false,
    shown_steal: false,
    shown_scavenge: false,
    shown_pray: false,
    shown_fight: false,
    shown_drink: false,
    shown_sleep: false,
    shown_eat: false,
    shown_rest: false,
    shown_collect_water: false,
    shown_relax: false,
    shown_scavenge_home: false,
    shown_sauna: false,
    shown_cook: false,
    
    // 👇 НОВЫЕ ФЛАГИ ДЛЯ ТУТОРИАЛА
    shown_quest_complete: false,   // Выполнение квеста
    shown_npc_shop: false,         // Магазин NPC
    shown_npc_quest: false,        // Квесты NPC
    shown_random_event: false,     // Случайное событие
    shown_estate_buy: false,       // Покупка с доски
    shown_shop_buy: false,         // Покупка в магазине
    shown_zombie_shooter: false,   // Зомби-тир
    shown_merge_game: false,         // объеденялка
};

export let healthValueSpan, hungerValueSpan, coldValueSpan, moneyValueSpan;
export let healthFill, hungerFill, coldFill;
export let levelValueSpan, expValueSpan, expRequiredSpan, expFill;
export let energyValueSpan, energyFill;
export let intoxicationValueSpan, intoxicationFill;

// ========== НОВАЯ ПЕРЕМЕННАЯ: МИНИМАЛЬНЫЙ ПОРОГ ТЕПЛА ==========
export let coldFloor = 0;  // Минимальный уровень тепла, который даёт одежда

let onLocationChangeCallback = null;
let onLogUpdateCallback = null;
let onExpUpdateCallback = null;
let onEnergyUpdateCallback = null;
let onIntoxicationUpdateCallback = null;

// ========== ФУНКЦИИ ДЛЯ ТУТОРИАЛА ==========
export function setTutorialData(data) {
    if (data) {
        tutorialEnabled = data.enabled ?? true;
        tutorialFlags = { ...tutorialFlags, ...(data.flags || {}) };
    }
}

export function getTutorialData() {
    return {
        enabled: tutorialEnabled,
        flags: tutorialFlags
    };
}

export function resetTutorialFlags() {
    for (const key in tutorialFlags) {
        if (typeof tutorialFlags[key] === 'boolean') {
            tutorialFlags[key] = false;
        }
    }
    // Не сбрасываем tutorialEnabled
}

export function isTutorialEnabled() {
    return tutorialEnabled;
}

export function setTutorialEnabled(enabled) {
    tutorialEnabled = enabled;
}

export function markTutorialShown(flagKey) {
    if (tutorialFlags.hasOwnProperty(flagKey)) {
        tutorialFlags[flagKey] = true;
    }
}

export function isTutorialShown(flagKey) {
    return tutorialFlags[flagKey] || false;
}

// ========== ПЕРЕСЧЁТ МИНИМАЛЬНОГО ПОРОГА ТЕПЛА ==========
export function recalcColdFloor() {
    let bonus = 0;
    const slots = ['head', 'body', 'legs', 'feet'];
    
    // Динамически импортируем itemsDB, чтобы не было циклической зависимости
    import('./inventory.js').then(module => {
        const itemsDB = module.itemsDB;
        for (const slot of slots) {
            const itemId = equipped[slot];
            if (itemId && itemsDB[itemId]?.effect?.cold) {
                bonus += itemsDB[itemId].effect.cold;
            }
        }
        coldFloor = bonus;
        console.log(`🧊 Минимальный порог тепла обновлён: ${coldFloor}`);
    }).catch(() => {
        // fallback если импорт не удался
        coldFloor = 0;
    });
}

// ========== ПРИМЕНЕНИЕ ТЕПЛА С УЧЁТОМ ПОРОГА ==========
export function applyColdWithFloor(newColdValue) {
    const floor = coldFloor || 0;
    // Тепло не может упасть ниже coldFloor
    cold = Math.min(maxCold, Math.max(floor, newColdValue));
    updateUI();
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
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
    
    // Обновляем отображение титула
    const titleSpan = document.getElementById('playerTitle');
    if (titleSpan) {
        if (currentTitle) {
            titleSpan.textContent = currentTitle;
            titleSpan.style.display = 'inline-block';
        } else {
            titleSpan.style.display = 'none';
        }
    }
    
    // Проверка смерти (если здоровье ≤ 0)
    if (safeHealth <= 0 && !window._isDying) {
        setTimeout(() => {
            if (health <= 0 && !window._isDying) {
                playerDeath();
            }
        }, 100);
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
        // 👇 ПРОВЕРКА: если coldFloor ещё не посчитан — пересчитать
        if (coldFloor === 0) {
            recalcColdFloor();
        }
        const floor = coldFloor || 0;
        cold = Math.min(maxCold, Math.max(floor, isNaN(c) ? maxCold : c));
    }
    if (m !== undefined && m !== null) {
        const oldMoney = money;
        money = isNaN(m) ? 500 : Math.max(0, m);
        if (oldMoney < 1000000 && money >= 1000000) {
            import('./questSystem.js').then(qs => {
                qs.updateQuestProgress('money_reach', money, { targetMoney: 1000000 });
            });
        }
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
        // Сохраняем только если не идёт обмен
        if (!window._preventAutoSave && !isTradeGuardActive()) {
            import('./firestore.js').then(m => {
                if (typeof m.saveGameData === 'function') m.saveGameData();
            });
        } else {
            console.log('⏳ updateEnergy: пропускаем сохранение (идет обмен)');
        }
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
        // Сохраняем только если не идёт обмен
        if (!window._preventAutoSave && !isTradeGuardActive()) {
            import('./firestore.js').then(m => {
                if (typeof m.saveGameData === 'function') m.saveGameData();
            });
        } else {
            console.log('⏳ updateIntoxication: пропускаем сохранение (идет обмен)');
        }
    }
}

export function addIntoxication(amount) {
    const safeAmount = isNaN(amount) ? 0 : amount;
    const oldIntoxication = intoxication;
    intoxication = Math.min(maxIntoxication, intoxication + safeAmount);
    lastIntoxicationUpdate = Date.now();
    updateUI();
    
    if (intoxication >= 80 && oldIntoxication < 80) {
        addLogEntry(`🍺 Ты в стельку! Опьянение достигло ${Math.floor(intoxication)}%`, 'system');
        showMessage(`🥴 Ты очень пьян! Осторожнее...`, '#e74c3c');
    } else if (intoxication >= 50 && oldIntoxication < 50) {
        addLogEntry(`🥴 Опьянение достигло ${Math.floor(intoxication)}%`, 'system');
    }
    
    // 👇 ВЫЕЗЖАЮЩЕЕ УВЕДОМЛЕНИЕ ПРИ ДОСТИЖЕНИИ 100% ОПЬЯНЕНИЯ 👇
    if (intoxication >= 100 && oldIntoxication < 100) {
        addLogEntry(`💀 Отключка! Опьянение 100%`, 'system');
        
        // Показываем красивое уведомление
        import('./utils.js').then(utils => {
            utils.showPopupNotification(
                'images/events/drunk_100.png',
                '🍺 АЛКОГОЛЬНОЕ ОТКЛЮЧЕНИЕ! 🍺',
                'Вы достигли 100% опьянения! Пора в ноктюрн...',
                'sounds/drunk_alarm.mp3',
                5000
            );
        });
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
    
    // Сохраняем только если не идёт обмен
    if (!window._preventAutoSave && !isTradeGuardActive()) {
        import('./firestore.js').then(m => {
            if (typeof m.saveGameData === 'function') m.saveGameData();
        });
    } else {
        console.log('⏳ addExperience: пропускаем сохранение (идет обмен)');
    }
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
        housingAccount = data.account ?? 20000;
        housingDailyCost = data.dailyCost ?? 0;
        lastHousingCheck = data.lastHousingCheck ?? null;
        lastGlobalHousingCheck = data.lastGlobalHousingCheck ?? null;
        lastUpdated = data.lastUpdated ?? null;
    }
    console.log('🏠 Загружены данные жилья:', { currentHome, ownedHomes, homeStorageCapacity, housingDebt, housingAccount, housingDailyCost, lastGlobalHousingCheck, lastUpdated });
}

export function initHousingData() {
    currentHome = null;
    ownedHomes = [];
    homeStorage = [];
    homeStorageCapacity = 0;
    housingDebt = 0;
    lastTaxPaid = null;
    housingAccount = 20000;
    housingDailyCost = 0;
    lastHousingCheck = null;
    lastGlobalHousingCheck = null;
    lastUpdated = null;
    console.log('🏠 Инициализированы данные жилья для нового игрока');
}

export function getHousingData() {
    return {
        current: currentHome,
        owned: ownedHomes,
        storage: homeStorage,
        storageCapacity: homeStorageCapacity,
        debt: housingDebt,
        lastTaxPaid: lastTaxPaid,
        account: housingAccount,
        dailyCost: housingDailyCost,
        lastHousingCheck: lastHousingCheck,
        lastGlobalHousingCheck: lastGlobalHousingCheck,
        lastUpdated: lastUpdated
    };
}

// ========== ФУНКЦИИ ДЛЯ ТИТУЛОВ ==========
export function setTitlesData(data) {
    if (data) {
        currentTitle = data.current || null;
        ownedTitles = Array.isArray(data.owned) ? data.owned : [];
    }
    const titleSpan = document.getElementById('playerTitle');
    if (titleSpan) {
        if (currentTitle) {
            titleSpan.textContent = currentTitle;
            titleSpan.style.display = 'inline-block';
        } else {
            titleSpan.style.display = 'none';
        }
    }
}

export function initTitlesData() {
    currentTitle = null;
    ownedTitles = [];
    console.log('🏷️ Инициализированы данные титулов');
}

export function getTitlesData() {
    return {
        current: currentTitle,
        owned: ownedTitles
    };
}

export async function setCurrentTitle(title) {
    currentTitle = title;
    updateUI();
    await saveGameData();
    const titleSpan = document.getElementById('playerTitle');
    if (titleSpan) {
        if (title) {
            titleSpan.textContent = title;
            titleSpan.style.display = 'inline-block';
        } else {
            titleSpan.style.display = 'none';
        }
    }
    console.log(`🏷️ Титул изменён на: ${title || 'нет'}`);
}

// ===== ОБНОВЛЕНИЕ ЕЖЕДНЕВНОЙ СТОИМОСТИ =====
export function updateHousingDailyCost(homeId = currentHome) {
    if (!homeId) {
        housingDailyCost = 0;
        return;
    }
    
    if (homeId.startsWith('dorm')) {
        housingDailyCost = 250;
    } else if (homeId.startsWith('apartment')) {
        housingDailyCost = 500;
    } else if (homeId.startsWith('house')) {
        housingDailyCost = 1000;
    } else {
        housingDailyCost = 0;
    }
    
    console.log(`🏠 Ежедневная стоимость для ${homeId}: ${housingDailyCost}₽`);
    return housingDailyCost;
}

// ===== ПОПОЛНЕНИЕ СЧЁТА =====
export async function depositToHousingAccount(amount) {
    if (isNaN(amount) || amount <= 0) {
        showMessage(`❌ Введите корректную сумму`, '#e74c3c');
        return false;
    }
    
    if (money < amount) {
        showMessage(`❌ Не хватает денег! Нужно ${amount}₽, у вас ${money}₽`, '#e74c3c');
        return false;
    }
    
    const newAccount = Math.min(20000, housingAccount + amount);
    const actualDeposit = newAccount - housingAccount;
    
    if (actualDeposit <= 0) {
        showMessage(`❌ Счёт уже достиг максимума (20000₽)`, '#ffd966');
        return false;
    }
    
    setStats(health, hunger, cold, money - actualDeposit);
    housingAccount = newAccount;
    
    if (housingDebt > 0) {
        housingDebt = 0;
        addLogEntry(`💰 Долг по жилью погашен!`, 'economy');
    }
    
    updateUI();
    await saveGameData();
    
    showMessage(`💰 Счёт пополнен на ${actualDeposit}₽. Баланс: ${housingAccount}₽`, '#4caf50');
    addLogEntry(`🏠 Пополнение счёта жилья на ${actualDeposit}₽`, 'economy');
    
    return true;
}

// ===== СНЯТИЕ СО СЧЁТА =====
export async function withdrawFromHousingAccount(amount) {
    if (isNaN(amount) || amount <= 0) {
        showMessage(`❌ Введите корректную сумму`, '#e74c3c');
        return false;
    }
    
    if (housingAccount < amount) {
        showMessage(`❌ Недостаточно средств на счету жилья! Доступно: ${housingAccount}₽`, '#e74c3c');
        return false;
    }
    
    const newMoney = money + amount;
    setStats(health, hunger, cold, newMoney);
    housingAccount -= amount;
    
    updateUI();
    await saveGameData();
    
    showMessage(`💸 Со счёта жилья снято ${amount}₽. Ваши деньги: ${newMoney}₽`, '#4caf50');
    addLogEntry(`🏠 Снятие со счёта жилья: ${amount}₽`, 'economy');
    
    return true;
}

// ===== ЕЖЕДНЕВНАЯ ПРОВЕРКА СПИСАНИЯ =====
export async function checkHousingPayment() {
    if (!currentHome) return;
    
    const today = new Date().toDateString();
    if (lastHousingCheck === today) {
        console.log('🏠 Сегодня уже проверяли коммуналку');
        return;
    }
    
    console.log(`🏠 Проверка коммуналки для ${currentHome}...`);
    updateHousingDailyCost(currentHome);
    
    if (housingDailyCost <= 0) return;
    
    let message = '';
    let isEvicted = false;
    
    if (housingAccount >= housingDailyCost) {
        housingAccount -= housingDailyCost;
        message = `🏠 Снято ${housingDailyCost}₽ за ${currentHome.startsWith('dorm') ? 'аренду' : 'коммуналку'}. Остаток на счету: ${housingAccount}₽`;
        showMessage(message, '#ffd966');
        addLogEntry(message, 'economy');
        
        if (housingDebt > 0) {
            housingDebt = 0;
        }
    } else {
        const shortage = housingDailyCost - housingAccount;
        housingDebt += shortage;
        housingAccount = 0;
        
        message = `⚠️ Недостаточно средств на счету жилья! Долг: ${housingDebt}₽. Пополните счёт, иначе вас выселят!`;
        showMessage(message, '#e74c3c');
        addLogEntry(message, 'economy');
        
        if (housingDebt > housingDailyCost * 3) {
            message = `💔 Вас выселили из ${currentHome} за неуплату ${housingDebt}₽!`;
            showMessage(message, '#e74c3c');
            addLogEntry(message, 'economy');
            await evictFromHome();
            isEvicted = true;
        }
    }
    
    lastHousingCheck = today;
    await saveGameData();
    
    return { success: !isEvicted, debt: housingDebt, account: housingAccount };
}

// ===== ГЛОБАЛЬНАЯ ПРОВЕРКА ВСЕХ ВЛАДЕЛЬЦЕВ =====
export async function checkAllHousingPayments() {
    const { db } = await import('./firestore.js');
    const { collection, getDocs, doc, updateDoc, deleteField } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (lastGlobalHousingCheck) {
        const lastCheck = new Date(lastGlobalHousingCheck);
        lastCheck.setHours(0, 0, 0, 0);
        if (lastCheck.getTime() === today.getTime()) {
            console.log('🏠 Глобальная проверка уже проводилась сегодня');
            return;
        }
    }
    
    console.log('🏠 ========== ЗАПУСК ГЛОБАЛЬНОЙ ПРОВЕРКИ НЕДВИЖИМОСТИ ==========');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let processed = 0;
    let evicted = 0;
    let totalDebt = 0;
    
    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const housing = userData.housing || {};
        const ownedHomesList = housing.owned || [];
        
        if (ownedHomesList.length === 0) continue;
        
        const currentHomeId = housing.current;
        const account = housing.account ?? 20000;
        const debt = housing.debt || 0;
        const lastCheckRaw = housing.lastHousingCheck;
        const dailyCost = getDailyCostById(currentHomeId);
        
        if (!currentHomeId || dailyCost === 0) continue;
        
        let daysMissed = 1;
        if (lastCheckRaw) {
            const lastCheckDate = new Date(lastCheckRaw);
            lastCheckDate.setHours(0, 0, 0, 0);
            const diffTime = Math.abs(today.getTime() - lastCheckDate.getTime());
            daysMissed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysMissed = Math.min(daysMissed, 30);
        }
        
        const totalCost = dailyCost * daysMissed;
        let newAccount = account;
        let newDebt = debt;
        let isEvictedUser = false;
        
        console.log(`   👤 ${userDoc.id} (${userData.displayName || 'без имени'}) — ${currentHomeId}, пропущено дней: ${daysMissed}, долг: ${debt}₽`);
        
        if (newAccount >= totalCost) {
            newAccount -= totalCost;
            console.log(`      ✅ Списано ${totalCost}₽, баланс: ${newAccount}₽`);
        } else {
            const remaining = totalCost - newAccount;
            newDebt += remaining;
            newAccount = 0;
            console.log(`      ⚠️ Не хватает! Долг: ${newDebt}₽`);
            
            if (newDebt > dailyCost * 3) {
                console.log(`      💔 ВЫСЕЛЕНИЕ! Долг превысил лимит`);
                isEvictedUser = true;
                evicted++;
                
                const propertyRef = doc(db, 'real_estate', currentHomeId);
                await updateDoc(propertyRef, {
                    ownerId: deleteField(),
                    ownerName: deleteField(),
                    purchasedAt: deleteField(),
                    debt: deleteField(),
                    lastTaxPaid: deleteField()
                }).catch(e => console.warn(`         Ошибка очистки ${currentHomeId}:`, e));
                
                const newOwned = ownedHomesList.filter(id => id !== currentHomeId);
                const newCurrent = newOwned.length > 0 ? newOwned[0] : null;
                let newCapacity = 0;
                if (newCurrent) {
                    if (newCurrent.startsWith('dorm')) newCapacity = 10;
                    else if (newCurrent.startsWith('apartment')) newCapacity = 20;
                    else if (newCurrent.startsWith('house')) newCapacity = 40;
                }
                
                await userDoc.ref.update({
                    'housing.owned': newOwned,
                    'housing.current': newCurrent,
                    'housing.storageCapacity': newCapacity,
                    'housing.account': 20000,
                    'housing.debt': 0,
                    'housing.lastHousingCheck': new Date().toISOString()
                });
                continue;
            }
        }
        
        await userDoc.ref.update({
            'housing.account': newAccount,
            'housing.debt': newDebt,
            'housing.lastHousingCheck': new Date().toISOString()
        });
        
        processed++;
        totalDebt += newDebt;
    }
    
    lastGlobalHousingCheck = today.toISOString();
    await saveGameData();
    
    console.log(`🏠 Глобальная проверка завершена: обработано ${processed}, выселено ${evicted}, общий долг ${totalDebt}₽`);
}

function getDailyCostById(homeId) {
    if (!homeId) return 0;
    if (homeId.startsWith('dorm')) return 250;
    if (homeId.startsWith('apartment')) return 500;
    if (homeId.startsWith('house')) return 1000;
    return 0;
}

// ===== ВЫСЕЛЕНИЕ =====
export async function evictFromHome() {
    if (!currentHome) return false;
    
    const evictedHomeId = currentHome;
    
    const { db } = await import('./firestore.js');
    const { doc, updateDoc, deleteField } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
    const { auth } = await import('./auth.js');
    
    const user = auth.currentUser;
    if (user) {
        const propertyRef = doc(db, 'real_estate', evictedHomeId);
        await updateDoc(propertyRef, {
            ownerId: deleteField(),
            ownerName: deleteField(),
            purchasedAt: deleteField(),
            debt: deleteField(),
            lastTaxPaid: deleteField()
        }).catch(e => console.warn('Не удалось очистить real_estate:', e));
    }
    
    const index = ownedHomes.indexOf(evictedHomeId);
    if (index !== -1) ownedHomes.splice(index, 1);
    
    housingAccount = 20000;
    housingDebt = 0;
    housingDailyCost = 0;
    
    if (ownedHomes.length > 0) {
        await setPrimaryHome(ownedHomes[0]);
        showMessage(`🏠 Ваше новое основное жильё: ${currentHome}`, '#ffd966');
    } else {
        currentHome = null;
        homeStorageCapacity = 0;
        setCurrentLocation('dump_home');
        showMessage(`🗑️ У вас больше нет жилья! Телепорт отправит на помойку.`, '#e74c3c');
    }
    
    await saveGameData();
    updateUI();
    
    addLogEntry(`🏠 Выселен из ${evictedHomeId} за неуплату`, 'economy');
    return true;
}

// Обновление вместимости хранилища
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

// ========== ФУНКЦИИ ДЛЯ СВЯЗИ ЖИЛЬЯ С ЛОКАЦИЯМИ ==========

export function getHomeLocationId(homeId) {
    if (!homeId) return 'dump_home';
    if (homeId.startsWith('dorm')) return 'dorm_home';
    if (homeId.startsWith('apartment')) return 'apartment_home';
    if (homeId.startsWith('house')) return 'house_home';
    return 'dump_home';
}

export async function setPrimaryHome(homeId) {
    if (!ownedHomes.includes(homeId)) {
        showMessage(`❌ У вас нет такого жилья!`, '#e74c3c');
        return false;
    }
    
    currentHome = homeId;
    
    if (homeId.startsWith('dorm')) {
        updateStorageCapacity('dorm');
    } else if (homeId.startsWith('apartment')) {
        updateStorageCapacity('apartment');
    } else if (homeId.startsWith('house')) {
        updateStorageCapacity('house');
    } else {
        updateStorageCapacity('dump');
    }
    
    updateHousingDailyCost(homeId);
    
    await saveGameData();
    
    showMessage(`🏠 Теперь ваше основное жильё: ${homeId}`, '#4caf50');
    addLogEntry(`🏠 Основное жильё изменено на ${homeId}`, 'system');
    
    return true;
}

export async function teleportHome() {
    const { setCurrentLocation } = await import('./gameState.js');
    
    let homeLocationId;
    
    if (currentHome) {
        homeLocationId = getHomeLocationId(currentHome);
        setCurrentLocation(homeLocationId);
        showMessage(`🏠 Вы телепортировались домой!`, '#4caf50');
        addLogEntry(`🏠 Телепорт домой (${currentHome})`, 'system');
    } else if (ownedHomes.length > 0) {
        const firstHome = ownedHomes[0];
        await setPrimaryHome(firstHome);
        homeLocationId = getHomeLocationId(firstHome);
        setCurrentLocation(homeLocationId);
        showMessage(`🏠 Вы телепортировались в ${firstHome} (основное жильё установлено автоматически)`, '#4caf50');
    } else {
        setCurrentLocation('dump_home');
        showMessage(`🗑️ У вас нет жилья. Вы отправились на помойку.`, '#ffd966');
        addLogEntry(`🗑️ Телепорт на помойку (нет жилья)`, 'system');
    }
}

// ========== СМЕРТЬ ИГРОКА ==========
export async function playerDeath() {
    console.log('💀 ИГРОК УМЕР! Запуск механики смерти...');
    
    if (window._isDying) {
        console.log('💀 Смерть уже обрабатывается, пропускаем');
        return;
    }
    window._isDying = true;
    
    const lostMoney = Math.floor(money * 0.1);
    const lostExp = Math.floor(experience * 0.05);
    
    let lostItemName = '';
    
    if (inventory.length > 0) {
        const availableItems = inventory.filter(item => item.count > 0);
        if (availableItems.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableItems.length);
            const lostItem = availableItems[randomIndex];
            const actualItemIndex = inventory.findIndex(i => i.id === lostItem.id);
            
            const { itemsDB } = await import('./inventory.js');
            lostItemName = itemsDB[lostItem.id]?.name || lostItem.id;
            
            if (inventory[actualItemIndex].count === 1) {
                inventory.splice(actualItemIndex, 1);
            } else {
                inventory[actualItemIndex].count--;
            }
        }
    }
    
    const newMoney = Math.max(0, money - lostMoney);
    const newExperience = Math.max(0, experience - lostExp);
    
    const deathOverlay = document.createElement('div');
    deathOverlay.id = 'deathOverlay';
    deathOverlay.style.position = 'fixed';
    deathOverlay.style.top = '0';
    deathOverlay.style.left = '0';
    deathOverlay.style.width = '100%';
    deathOverlay.style.height = '100%';
    deathOverlay.style.backgroundColor = 'black';
    deathOverlay.style.zIndex = '10050';
    deathOverlay.style.opacity = '0';
    deathOverlay.style.transition = 'opacity 1s ease, backdrop-filter 1s ease';
    deathOverlay.style.backdropFilter = 'blur(0px)';
    deathOverlay.style.pointerEvents = 'none';
    document.body.appendChild(deathOverlay);
    
    setTimeout(() => { 
        deathOverlay.style.opacity = '0.95';
        deathOverlay.style.backdropFilter = 'blur(8px)';
    }, 10);
    
    setStats(50, 50, 50, newMoney);
    setExpData(newExperience, level);
    
    addLogEntry(`💀 Вы потеряли сознание! Потеряно ${lostMoney}₽, ${lostExp} опыта${lostItemName ? `, потерян предмет: ${lostItemName}` : ''}.`, 'combat');
    
    const deathMessageDiv = document.createElement('div');
    deathMessageDiv.style.position = 'fixed';
    deathMessageDiv.style.top = '50%';
    deathMessageDiv.style.left = '50%';
    deathMessageDiv.style.transform = 'translate(-50%, -50%)';
    deathMessageDiv.style.backgroundColor = 'rgba(0,0,0,0.85)';
    deathMessageDiv.style.color = '#ffd966';
    deathMessageDiv.style.padding = '25px 35px';
    deathMessageDiv.style.borderRadius = '60px';
    deathMessageDiv.style.fontSize = '1.2rem';
    deathMessageDiv.style.fontWeight = 'bold';
    deathMessageDiv.style.textAlign = 'center';
    deathMessageDiv.style.zIndex = '10051';
    deathMessageDiv.style.border = '2px solid #ffd966';
    deathMessageDiv.style.boxShadow = '0 0 20px rgba(255, 217, 102, 0.5)';
    deathMessageDiv.style.animation = 'deathMessagePulse 1s ease infinite';
    deathMessageDiv.innerHTML = `
        🚑 Кажется, вы потеряли сознание...<br>
        Скорая дотащила вас до дома, но вы что-то потеряли по пути<br><br>
        💰 Потеряно: ${lostMoney}₽<br>
        ⭐ Потеряно: ${lostExp} опыта${lostItemName ? `<br>🎒 Потерян: ${lostItemName}` : ''}
    `;
    document.body.appendChild(deathMessageDiv);
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes deathMessagePulse {
            0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); text-shadow: 0 0 8px #ffd966; }
            100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    await teleportHome();
    await saveGameData();
    updateUI();
    
    setTimeout(() => {
        if (deathMessageDiv && deathMessageDiv.remove) deathMessageDiv.remove();
    }, 6000);
    
    setTimeout(() => {
        deathOverlay.style.opacity = '0';
        deathOverlay.style.backdropFilter = 'blur(0px)';
        setTimeout(() => {
            if (deathOverlay && deathOverlay.remove) deathOverlay.remove();
            if (style && style.remove) style.remove();
        }, 1000);
    }, 7000);
    
    console.log(`💀 Смерть обработана: потеряно денег ${lostMoney}, опыта ${lostExp}, предмет ${lostItemName || 'нет'}`);
    
    window._isDying = false;
    
    return { lostMoney, lostExp, lostItemName };
}

// ========== ЗАГРУЗКА НЕДВИЖИМОСТИ ИЗ REAL_ESTATE ==========
export async function loadOwnedHomesFromRealEstate() {
    const user = window.auth?.currentUser;
    if (!user) {
        console.log('🏠 Пользователь не авторизован');
        return [];
    }
    
    try {
        const { db } = await import('./firestore.js');
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        
        const q = query(collection(db, 'real_estate'), where('ownerId', '==', user.uid));
        const snapshot = await getDocs(q);
        
        const owned = [];
        snapshot.forEach(doc => {
            owned.push(doc.id);
        });
        
        ownedHomes.length = 0;
        ownedHomes.push(...owned);
        
        console.log('🏠 Загружена недвижимость из real_estate:', owned);
        return owned;
    } catch (error) {
        console.error('❌ Ошибка загрузки недвижимости из real_estate:', error);
        return [];
    }
}

// ========== ОБНОВЛЕНИЕ currentHome (если он стал невалидным) ==========
export async function validateCurrentHome() {
    await loadOwnedHomesFromRealEstate();
    
    if (currentHome && !ownedHomes.includes(currentHome)) {
        console.log(`🏠 Текущее жильё ${currentHome} больше не принадлежит игроку, выбираем новое`);
        if (ownedHomes.length > 0) {
            await setPrimaryHome(ownedHomes[0]);
        } else {
            currentHome = null;
            homeStorageCapacity = 0;
            housingDailyCost = 0;
            await saveGameData();
        }
    }
}

// ========== НОВАЯ ФУНКЦИЯ: ОБНОВЛЕНИЕ ИЗ FIRESTORE С ЗАЩИТОЙ ==========
export function updateFromFirestoreWithGuard(remoteData, force = false) {
    if (!force && shouldBlockRealtime()) {
        const remaining = getRemainingBlockTime();
        console.log(`🛡️ updateFromFirestoreWithGuard: обновление отклонено (защита активна, осталось ${remaining}с)`);
        if (Math.random() < 0.1) {
            addLogEntry(`🛡️ Пропущено автоматическое обновление (обработка обмена ${remaining}с)`, 'system');
        }
        return false;
    }
    
    let updated = false;
    
    if (remoteData.health !== undefined) {
        health = Math.min(maxHealth, Math.max(0, remoteData.health));
        updated = true;
    }
    if (remoteData.hunger !== undefined) {
        hunger = Math.min(maxHunger, Math.max(0, remoteData.hunger));
        updated = true;
    }
   if (remoteData.cold !== undefined) {
    // 👇 ПЕРЕСЧИТЫВАЕМ coldFloor, если он ещё не посчитан
    if (coldFloor === 0) {
        recalcColdFloor();
    }
    const floor = coldFloor || 0;
    cold = Math.min(maxCold, Math.max(floor, remoteData.cold));
    updated = true;
}
    if (remoteData.money !== undefined) {
        money = Math.max(0, remoteData.money);
        updated = true;
    }
    if (remoteData.energy !== undefined) {
        energy = Math.min(maxEnergy, Math.max(0, remoteData.energy));
        lastEnergyUpdate = Date.now();
        updated = true;
    }
    if (remoteData.intoxication !== undefined) {
        intoxication = Math.min(maxIntoxication, Math.max(0, remoteData.intoxication));
        lastIntoxicationUpdate = Date.now();
        updated = true;
    }
    if (remoteData.experience !== undefined) {
        experience = Math.max(0, remoteData.experience);
        updated = true;
    }
    if (remoteData.level !== undefined) {
        level = Math.max(1, remoteData.level);
        requiredExp = calculateRequiredExp(level);
        updated = true;
    }
    if (remoteData.inventory !== undefined && Array.isArray(remoteData.inventory)) {
        inventory.length = 0;
        inventory.push(...remoteData.inventory);
        updated = true;
    }
    if (remoteData.equipped !== undefined) {
        equipped = { ...equipped, ...remoteData.equipped };
        updated = true;
    }
    if (remoteData.currentLocation !== undefined) {
        currentLocation = remoteData.currentLocation;
        updated = true;
    }
    if (remoteData.housing !== undefined) {
        setHousingData(remoteData.housing);
        updated = true;
    }
    if (remoteData.titles !== undefined) {
        setTitlesData(remoteData.titles);
        updated = true;
    }
    if (remoteData.tutorial !== undefined) {
        setTutorialData(remoteData.tutorial);
        updated = true;
    }
    if (remoteData.lastUpdated !== undefined) {
        lastUpdated = remoteData.lastUpdated;
        updated = true;
    }
    
    if (updated) {
        updateUI();
        console.log('🔄 updateFromFirestoreWithGuard: данные обновлены из Firestore');
        if (force && shouldBlockRealtime()) {
            deactivateTradeGuard();
            console.log('🔄 Форсированное обновление применено, защита снята');
            addLogEntry(`🔄 Принудительное обновление данных после обмена`, 'system');
        }
    }
    
    return updated;
}

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ TRADE ==========
export function isTradeBlocked() {
    return isTradeGuardActive();
}

export function getTradeBlockTimeRemaining() {
    return getRemainingBlockTime();
}
