// js/timeWeather.js
import { accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, getCurrentTimeString, getWeatherIcon, getTimeOfDayIcon, health, hunger, cold, maxHealth, maxHunger, maxCold, updateUI, setStats, addLogEntry, money } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction } from './utils.js';
import { updateDarkness, updateWeatherEffects } from './weatherEffects.js';
import { getColdMultiplier } from './randomEvents.js';

// Константы
const MINUTES_PER_REAL_MINUTE = 10;
const WEATHER_CHANGE_INTERVAL = 180;
let lastUpdateTimestamp = Date.now();
let updateInterval = null;
let effectsInterval = null;

// Переменные для отслеживания последнего критического состояния (чтобы не спамить в лог)
let lastHealthWarning = '';
let lastHungerWarning = '';
let lastColdWarning = '';

// Функция для получения случайной погоды с учётом температуры
function getRandomWeather(currentTemp) {
    const rand = Math.random();
    if (currentTemp > 5) {
        if (rand < 0.5) return 'sunny';
        if (rand < 0.75) return 'cloudy';
        return 'rain';
    }
    if (currentTemp < 0) {
        if (rand < 0.4) return 'sunny';
        if (rand < 0.6) return 'cloudy';
        return 'snow';
    }
    if (rand < 0.4) return 'sunny';
    if (rand < 0.6) return 'cloudy';
    if (rand < 0.8) return 'rain';
    return 'snow';
}

// Функция для расчёта температуры
function calculateTemperature(weather, totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    let baseTemp;
    if (hours >= 10 && hours <= 16) {
        baseTemp = 15 + Math.random() * 10;
    } else if (hours >= 22 || hours <= 4) {
        baseTemp = -8 + Math.random() * 8;
    } else {
        baseTemp = 0 + Math.random() * 12;
    }
    
    switch (weather) {
        case 'cloudy': baseTemp -= 3; break;
        case 'rain': baseTemp -= 2; break;
        case 'snow': baseTemp = Math.min(baseTemp - 8, -1); break;
        default: break;
    }
    
    if (weather === 'snow' && baseTemp > 0) baseTemp = -1;
    if (weather === 'rain' && baseTemp < 0) baseTemp = 1;
    
    return Math.round(Math.min(28, Math.max(-15, baseTemp)));
}

// Применение эффектов погоды на характеристики (вызывается каждые 30 секунд)
function applyWeatherEffects() {
    let hungerChange = 0;
    let coldChange = 0;
    let healthChange = 0;
    const hours = (accumulatedMinutes / 60) % 24;
    
    // Получаем множитель холода от временных эффектов (например, метель)
    const coldMultiplier = getColdMultiplier();
    
    // ===== 1. ЕСТЕСТВЕННОЕ ПАДЕНИЕ ГОЛОДА =====
    hungerChange = -1;
    
    // Коррекция от температуры
    if (currentTemperature > 25) {
        hungerChange = -1.5; // жара ускоряет голод
    } else if (currentTemperature < 0) {
        hungerChange = -0.5; // холод замедляет голод
    }
    
    // ===== 2. ВЛИЯНИЕ ПОГОДЫ И ТЕМПЕРАТУРЫ НА ТЕПЛО =====
    // Базовое падение тепла от погоды с учётом множителя
    if (currentWeather === 'rain') {
        coldChange -= 1 * coldMultiplier;
    } else if (currentWeather === 'snow') {
        coldChange -= 2 * coldMultiplier;
    }
    
    // Падение от холода
    if (currentTemperature < 0) {
        coldChange -= 1 * coldMultiplier;
        if (currentTemperature < -10) coldChange -= 1 * coldMultiplier; // сильный мороз
    }
    
    // Падение от ночного времени
    if (hours >= 22 || hours < 6) {
        coldChange -= 1 * coldMultiplier;
    }
    
    // ===== 3. ПРИМЕНЯЕМ ИЗМЕНЕНИЯ =====
    if (hungerChange !== 0) {
        const newHunger = Math.min(maxHunger, Math.max(0, hunger + hungerChange));
        setStats(health, newHunger, cold, money);
    }
    
    if (coldChange !== 0) {
        const newCold = Math.min(maxCold, Math.max(0, cold + coldChange));
        setStats(health, hunger, newCold, money);
    }
    
    // ===== 4. ВЛИЯНИЕ ГОЛОДА И ТЕПЛА НА ЗДОРОВЬЕ =====
    // Критические состояния (≤30)
    if (hunger <= 30) {
        healthChange -= 1;
        if (lastHungerWarning !== 'hungry') {
            addLogEntry(`🍗 Я очень голоден! Здоровье -1`, 'combat');
            lastHungerWarning = 'hungry';
        }
    } else {
        lastHungerWarning = '';
    }
    
    if (cold <= 30) {
        healthChange -= 1;
        if (lastColdWarning !== 'cold') {
            addLogEntry(`❄️ Я замерзаю! Здоровье -1`, 'combat');
            lastColdWarning = 'cold';
        }
    } else {
        lastColdWarning = '';
    }
    
    // Благоприятные состояния (≥90)
    if (hunger >= 90 && health < maxHealth) {
        healthChange += 1;
        if (lastHungerWarning !== 'full') {
            addLogEntry(`🍽️ Сытость восстанавливает силы, здоровье +1`, 'combat');
            lastHungerWarning = 'full';
        }
    } else if (lastHungerWarning === 'full' && hunger < 90) {
        lastHungerWarning = '';
    }
    
    if (cold >= 90 && health < maxHealth) {
        healthChange += 1;
        if (lastColdWarning !== 'warm') {
            addLogEntry(`🔥 Тепло помогает восстановиться, здоровье +1`, 'combat');
            lastColdWarning = 'warm';
        }
    } else if (lastColdWarning === 'warm' && cold < 90) {
        lastColdWarning = '';
    }
    
    // Применяем изменения здоровья
    if (healthChange !== 0) {
        const newHealth = Math.min(maxHealth, Math.max(0, health + healthChange));
        setStats(newHealth, hunger, cold, money);
    }
    
    // Обновляем UI и сохраняем
    updateUI();
    throttledSave();
}

// Добавление игровых часов (прямое увеличение времени)
export function addGameHours(hours) {
    const minutesToAdd = hours * 60;
    const newMinutes = accumulatedMinutes + minutesToAdd;
    // Обновляем время (погода и температура пересчитаются автоматически при следующем обновлении)
    setTimeWeather(newMinutes, currentWeather, currentTemperature);
    // Обновляем затемнение и эффекты
    updateDarkness();
    updateWeatherEffects();
    updateTimeWeatherUI();
    // Сохраняем изменения
    throttledSave();
    
    addLogEntry(`🛌 Вы проспали ${hours} часов.`, 'system');
    showMessage(`🛌 Вы проснулись через ${hours} часов.`, '#4caf50');
}

// Обновление времени и погоды
export function updateTimeWeather() {
    const now = Date.now();
    const deltaRealMinutes = (now - lastUpdateTimestamp) / 1000 / 60;
    const deltaGameMinutes = deltaRealMinutes * MINUTES_PER_REAL_MINUTE;
    
    if (deltaGameMinutes < 0.01) return;
    
    lastUpdateTimestamp = now;
    let newMinutes = accumulatedMinutes + deltaGameMinutes;
    
    const oldWeatherPeriod = Math.floor(accumulatedMinutes / WEATHER_CHANGE_INTERVAL);
    const newWeatherPeriod = Math.floor(newMinutes / WEATHER_CHANGE_INTERVAL);
    
    let newWeather = currentWeather;
    let weatherChanged = false;
    
    if (newWeatherPeriod > oldWeatherPeriod) {
        newWeather = getRandomWeather(currentTemperature);
        weatherChanged = true;
    }
    
    let newTemp = currentTemperature;
    const tempRecalcInterval = 60;
    const oldTempPeriod = Math.floor(accumulatedMinutes / tempRecalcInterval);
    const newTempPeriod = Math.floor(newMinutes / tempRecalcInterval);
    
    if (weatherChanged || newTempPeriod > oldTempPeriod) {
        newTemp = calculateTemperature(newWeather, newMinutes);
    }
    
    setTimeWeather(newMinutes, newWeather, newTemp);
    updateDarkness();
    updateWeatherEffects();
    updateTimeWeatherUI();
    
    if (weatherChanged) {
        const weatherNames = { sunny: 'солнечно', cloudy: 'облачно', rain: 'дождь', snow: 'снег' };
        showMessage(`🌦️ Погода изменилась: ${weatherNames[newWeather]}`, '#4caf50');
        logAction(`Погода изменилась: ${weatherNames[newWeather]} (температура ${newTemp > 0 ? '+' : ''}${newTemp}°)`, 'weather');
        // При смене погоды можно проверить погодные события
        import('./randomEvents.js').then(m => {
            m.checkAndTriggerEvent('weather', { weather: newWeather });
        });
    }
    
    throttledSave();
}

let lastSaveTime = 0;
function throttledSave() {
    const now = Date.now();
    if (now - lastSaveTime > 30000) {
        lastSaveTime = now;
        saveGameData();
    }
}

export function updateTimeWeatherUI() {
    const container = document.getElementById('timeWeatherPanel');
    if (!container) return;
    const timeStr = getCurrentTimeString();
    const tempStr = `${currentTemperature > 0 ? '+' : ''}${currentTemperature}°`;
    const weatherIcon = getWeatherIcon();
    const timeIcon = getTimeOfDayIcon();
    container.innerHTML = `${timeStr} | ${tempStr} | ${weatherIcon} ${timeIcon}`;
}

export function startTimeWeatherUpdates() {
    if (updateInterval) return;
    lastUpdateTimestamp = Date.now();
    
    // Обновление времени и погоды (каждые 10 секунд)
    updateInterval = setInterval(() => {
        updateTimeWeather();
    }, 10000);
    
    // Эффекты погоды на характеристики (каждые 30 секунд)
    effectsInterval = setInterval(() => {
        applyWeatherEffects();
    }, 30000);
}

export function stopTimeWeatherUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (effectsInterval) {
        clearInterval(effectsInterval);
        effectsInterval = null;
    }
}
