// js/gameState.js
export let health = 100;
export let maxHealth = 100;
export let hunger = 100;
export let maxHunger = 100;
export let cold = 100;
export let maxCold = 100;
export let money = 500;

export let inventory = [];
export let equipped = { head: null, body: null, legs: null, feet: null };

// Текущая локация (по умолчанию 'church' — церковь)
export let currentLocation = 'church';

// ========== ВРЕМЯ И ПОГОДА ==========
export let accumulatedMinutes = 0;      // сколько игровых минут прошло с начала игры
export let currentWeather = 'sunny';    // sunny, cloudy, rain, snow
export let currentTemperature = 15;     // температура в градусах

// ========== ЛОГ ДЕЙСТВИЙ ==========
export let actionLog = [];               // массив записей { time, message, type }
const MAX_LOG_ENTRIES = 50;             // максимум записей в логе

export let healthValueSpan, hungerValueSpan, coldValueSpan, moneyValueSpan;
export let healthFill, hungerFill, coldFill;

// Колбэк, который будет вызываться при смене локации (устанавливается из main.js)
let onLocationChangeCallback = null;

// Колбэк для обновления UI лога
let onLogUpdateCallback = null;

export function initDOM() {
    healthValueSpan = document.getElementById('healthValue');
    hungerValueSpan = document.getElementById('hungerValue');
    coldValueSpan = document.getElementById('coldValue');
    moneyValueSpan = document.getElementById('moneyValue');
    healthFill = document.getElementById('healthFill');
    hungerFill = document.getElementById('hungerFill');
    coldFill = document.getElementById('coldFill');
}

export function updateUI() {
    if (healthValueSpan) healthValueSpan.innerText = `${Math.floor(health)} / ${maxHealth}`;
    if (hungerValueSpan) hungerValueSpan.innerText = `${Math.floor(hunger)} / ${maxHunger}`;
    if (coldValueSpan) coldValueSpan.innerText = `${Math.floor(cold)} / ${maxCold}`;
    if (moneyValueSpan) moneyValueSpan.innerText = Math.floor(money);
    if (healthFill) healthFill.style.width = (health / maxHealth) * 100 + '%';
    if (hungerFill) hungerFill.style.width = (hunger / maxHunger) * 100 + '%';
    if (coldFill) coldFill.style.width = (cold / maxCold) * 100 + '%';
}

export function setStats(h, hu, c, m) {
    health = h;
    hunger = hu;
    cold = c;
    money = m;
    updateUI();
}

// ========== Функции для лога действий ==========
// Установка колбэка для обновления UI лога
export function setLogUpdateCallback(callback) {
    onLogUpdateCallback = callback;
}

// Добавление записи в лог
export function addLogEntry(message, type = 'system') {
    const timeStr = getCurrentTimeString();
    const newEntry = {
        time: timeStr,
        message: message,
        type: type
    };
    actionLog.push(newEntry);
    // Ограничиваем количество записей
    if (actionLog.length > MAX_LOG_ENTRIES) {
        actionLog.shift();
    }
    // Обновляем UI через колбэк
    if (onLogUpdateCallback) {
        onLogUpdateCallback();
    }
}

// Загрузка лога из сохранённых данных
export function setActionLog(log) {
    actionLog = log || [];
    if (actionLog.length > MAX_LOG_ENTRIES) {
        actionLog = actionLog.slice(-MAX_LOG_ENTRIES);
    }
    if (onLogUpdateCallback) {
        onLogUpdateCallback();
    }
}

// Получение лога (для сохранения)
export function getActionLog() {
    return actionLog;
}

// ========== Функции для времени и погоды ==========
// Установка сохранённых данных времени и погоды
export function setTimeWeather(minutes, weather, temp) {
    accumulatedMinutes = minutes;
    currentWeather = weather;
    currentTemperature = temp;
    if (typeof updateTimeWeatherUI === 'function') {
        updateTimeWeatherUI();
    }
}

// Получить текущее время в формате ЧЧ:ММ
export function getCurrentTimeString() {
    const totalMinutes = Math.floor(accumulatedMinutes);
    let hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Получить иконку погоды
export function getWeatherIcon() {
    const icons = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️' };
    return icons[currentWeather] || '☀️';
}

// Получить символ времени суток
export function getTimeOfDayIcon() {
    const totalMinutes = Math.floor(accumulatedMinutes);
    const hours = Math.floor(totalMinutes / 60) % 24;
    if (hours >= 6 && hours < 11) return '🌅';
    if (hours >= 11 && hours < 17) return '☀️';
    if (hours >= 17 && hours < 22) return '🌙';
    return '🌙';
}

// Установка колбэка для смены локации
export function setLocationChangeCallback(callback) {
    onLocationChangeCallback = callback;
}

// Смена текущей локации
export function setCurrentLocation(locationId) {
    if (currentLocation === locationId) return;
    currentLocation = locationId;
    addLogEntry(`Переход в локацию "${locationId}"`, 'location');
    if (onLocationChangeCallback) {
        onLocationChangeCallback(currentLocation);
    }
}
