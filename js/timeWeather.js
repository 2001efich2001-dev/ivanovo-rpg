// js/timeWeather.js
import { accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, getCurrentTimeString, getWeatherIcon, getTimeOfDayIcon } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction } from './utils.js';
import { updateDarkness, updateWeatherEffects } from './weatherEffects.js';

// Константы
const MINUTES_PER_REAL_MINUTE = 10;
const WEATHER_CHANGE_INTERVAL = 180;
let lastUpdateTimestamp = Date.now();
let updateInterval = null;

// Функция для получения случайной погоды с учётом температуры (чтобы снег не выпадал при тепле)
function getRandomWeather(currentTemp) {
    const rand = Math.random();
    // Если температура выше +5, исключаем снег
    if (currentTemp > 5) {
        if (rand < 0.5) return 'sunny';
        if (rand < 0.75) return 'cloudy';
        return 'rain';
    }
    // Если температура ниже 0, исключаем дождь
    if (currentTemp < 0) {
        if (rand < 0.4) return 'sunny';
        if (rand < 0.6) return 'cloudy';
        return 'snow';
    }
    // Иначе все варианты
    if (rand < 0.4) return 'sunny';
    if (rand < 0.6) return 'cloudy';
    if (rand < 0.8) return 'rain';
    return 'snow';
}

// Функция для расчёта температуры на основе погоды и времени суток
function calculateTemperature(weather, totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    let baseTemp;
    if (hours >= 10 && hours <= 16) {
        baseTemp = 15 + Math.random() * 10;     // 15-25
    } else if (hours >= 22 || hours <= 4) {
        baseTemp = -8 + Math.random() * 8;      // -8..0
    } else {
        baseTemp = 0 + Math.random() * 12;      // 0..12
    }
    
    // Корректировка от погоды
    switch (weather) {
        case 'cloudy': baseTemp -= 3; break;
        case 'rain': baseTemp -= 2; break;
        case 'snow': baseTemp = Math.min(baseTemp - 8, -1); break; // снег -> отрицательная
        default: break;
    }
    
    // Дополнительные ограничения
    if (weather === 'snow' && baseTemp > 0) baseTemp = -1;
    if (weather === 'rain' && baseTemp < 0) baseTemp = 1;
    
    return Math.round(Math.min(28, Math.max(-15, baseTemp)));
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
    
    // Смена погоды с учётом текущей температуры
    if (newWeatherPeriod > oldWeatherPeriod) {
        newWeather = getRandomWeather(currentTemperature);
        weatherChanged = true;
    }
    
    // Пересчёт температуры
    let newTemp = currentTemperature;
    const tempRecalcInterval = 60;
    const oldTempPeriod = Math.floor(accumulatedMinutes / tempRecalcInterval);
    const newTempPeriod = Math.floor(newMinutes / tempRecalcInterval);
    
    if (weatherChanged || newTempPeriod > oldTempPeriod) {
        newTemp = calculateTemperature(newWeather, newMinutes);
    }
    
    // Обновляем глобальные переменные
    setTimeWeather(newMinutes, newWeather, newTemp);
    
    // Обновляем визуальные эффекты
    updateDarkness();
    updateWeatherEffects();
    updateTimeWeatherUI();
    
    if (weatherChanged) {
        const weatherNames = { sunny: 'солнечно', cloudy: 'облачно', rain: 'дождь', snow: 'снег' };
        showMessage(`🌦️ Погода изменилась: ${weatherNames[newWeather]}`, '#4caf50');
        logAction(`Погода изменилась: ${weatherNames[newWeather]} (температура ${newTemp > 0 ? '+' : ''}${newTemp}°)`, 'weather');
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
    updateInterval = setInterval(() => {
        updateTimeWeather();
    }, 10000);
}

export function stopTimeWeatherUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}
