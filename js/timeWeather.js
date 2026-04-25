// js/timeWeather.js
import { accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, getCurrentTimeString, getWeatherIcon, getTimeOfDayIcon } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';
import { updateDarkness, updateWeatherEffects } from './weatherEffects.js';

// Константы
const MINUTES_PER_REAL_MINUTE = 10;     // 1 реальная минута = 10 игровых минут
const WEATHER_CHANGE_INTERVAL = 180;    // смена погоды каждые 3 часа (180 минут)
let lastUpdateTimestamp = Date.now();
let updateInterval = null;

// Функция для получения случайной погоды
function getRandomWeather() {
    const rand = Math.random();
    if (rand < 0.4) return 'sunny';     // 40% солнечно
    if (rand < 0.6) return 'cloudy';    // 20% облачно
    if (rand < 0.8) return 'rain';      // 20% дождь
    return 'snow';                       // 20% снег
}

// Функция для расчёта температуры на основе погоды и времени суток
function calculateTemperature(weather, totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    // Базовая температура -5..+25 в зависимости от времени суток
    let baseTemp;
    if (hours >= 10 && hours <= 16) {
        baseTemp = 15 + Math.random() * 10;     // днём теплее, 15-25
    } else if (hours >= 22 || hours <= 4) {
        baseTemp = -8 + Math.random() * 8;       // ночью холоднее, -8..0
    } else {
        baseTemp = 0 + Math.random() * 12;       // утром/вечером 0..12
    }
    
    // Корректировка от погоды
    switch (weather) {
        case 'cloudy': baseTemp -= 3; break;
        case 'rain': baseTemp -= 2; break;
        case 'snow': baseTemp -= 8; break;
        default: break;
    }
    
    // Жёсткие ограничения на основе типа погоды
    if (weather === 'snow' && baseTemp > 1) {
        baseTemp = 0; // если снег, температура не выше 0
    }
    if (weather === 'rain' && baseTemp < 0) {
        baseTemp = 1; // дождь не может быть при отрицательной температуре
    }
    
    // Ночью снег может опускать температуру ниже 0
    if (weather === 'snow' && (hours >= 22 || hours <= 4)) {
        baseTemp = Math.min(baseTemp, -3);
    }
    
    // Ограничиваем диапазон -15..+28
    return Math.round(Math.min(28, Math.max(-15, baseTemp)));
}

// Обновление времени и погоды
export function updateTimeWeather() {
    const now = Date.now();
    const deltaRealMinutes = (now - lastUpdateTimestamp) / 1000 / 60;
    const deltaGameMinutes = deltaRealMinutes * MINUTES_PER_REAL_MINUTE;
    
    if (deltaGameMinutes < 0.01) return; // слишком маленькое изменение
    
    lastUpdateTimestamp = now;
    
    let newMinutes = accumulatedMinutes + deltaGameMinutes;
    
    // Проверяем, не пора ли сменить погоду
    const oldWeatherPeriod = Math.floor(accumulatedMinutes / WEATHER_CHANGE_INTERVAL);
    const newWeatherPeriod = Math.floor(newMinutes / WEATHER_CHANGE_INTERVAL);
    
    let newWeather = currentWeather;
    let weatherChanged = false;
    
    if (newWeatherPeriod > oldWeatherPeriod) {
        // Смена погоды
        newWeather = getRandomWeather();
        weatherChanged = true;
    }
    
    // Пересчитываем температуру (если сменилась погода или прошло достаточно времени)
    let newTemp = currentTemperature;
    const tempRecalcInterval = 60; // пересчёт температуры раз в час (60 минут)
    const oldTempPeriod = Math.floor(accumulatedMinutes / tempRecalcInterval);
    const newTempPeriod = Math.floor(newMinutes / tempRecalcInterval);
    
    if (weatherChanged || newTempPeriod > oldTempPeriod) {
        newTemp = calculateTemperature(newWeather, newMinutes);
    }
    
    // Обновляем глобальные переменные
    setTimeWeather(newMinutes, newWeather, newTemp);
    
    // Обновляем затемнение (в зависимости от времени суток)
    updateDarkness();
    
    // Обновляем погодные эффекты (дождь/снег)
    updateWeatherEffects();
    
    // Обновляем интерфейс
    updateTimeWeatherUI();
    
    // Если погода изменилась – показываем сообщение
    if (weatherChanged) {
        const weatherNames = { sunny: 'солнечно', cloudy: 'облачно', rain: 'дождь', snow: 'снег' };
        showMessage(`🌦️ Погода изменилась: ${weatherNames[newWeather]}`, '#4caf50');
    }
    
    // Сохраняем в Firestore (не каждое обновление, а раз в 30 секунд)
    throttledSave();
}

// Сохранение с ограничением частоты (не чаще раза в 30 секунд)
let lastSaveTime = 0;
function throttledSave() {
    const now = Date.now();
    if (now - lastSaveTime > 30000) { // 30 секунд
        lastSaveTime = now;
        saveGameData();
    }
}

// Обновление HTML-блока с временем и погодой
export function updateTimeWeatherUI() {
    const container = document.getElementById('timeWeatherPanel');
    if (!container) return;
    
    const timeStr = getCurrentTimeString();
    const tempStr = `${currentTemperature > 0 ? '+' : ''}${currentTemperature}°`;
    const weatherIcon = getWeatherIcon();
    const timeIcon = getTimeOfDayIcon();
    
    container.innerHTML = `${timeStr} | ${tempStr} | ${weatherIcon} ${timeIcon}`;
}

// Запуск цикла обновления (вызывать после загрузки игры)
export function startTimeWeatherUpdates() {
    if (updateInterval) return;
    lastUpdateTimestamp = Date.now();
    updateInterval = setInterval(() => {
        updateTimeWeather();
    }, 10000); // обновление каждые 10 секунд (достаточно для плавности)
}

// Остановка обновлений (при выходе из игры)
export function stopTimeWeatherUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}
