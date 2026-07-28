// js/fakeStats.js

const STORAGE_KEY = 'fake_stats_data';

// ========== НАЧАЛЬНЫЕ ДАННЫЕ ==========
const DEFAULT_DATA = {
    totalPlayers: 3807,
    lastTotalUpdate: Date.now(),
    onlinePercent: 0, // будет вычисляться
    lastOnlineUpdate: 0
};

// ========== ПОЛУЧИТЬ ДАННЫЕ ИЗ ХРАНИЛИЩА ==========
function getStoredData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            // Проверяем, что все поля есть
            if (data.totalPlayers && data.lastTotalUpdate !== undefined) {
                return data;
            }
        }
    } catch (e) {
        console.warn('Ошибка чтения fakeStats:', e);
    }
    return null;
}

// ========== СОХРАНИТЬ ДАННЫЕ ==========
function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Ошибка сохранения fakeStats:', e);
    }
}

// ========== ИНИЦИАЛИЗИРОВАТЬ ДАННЫЕ ==========
function initData() {
    let data = getStoredData();
    
    if (!data) {
        data = { ...DEFAULT_DATA };
        saveData(data);
        console.log('📊 FakeStats: инициализированы начальные данные');
    }
    
    return data;
}

// ========== ОБНОВИТЬ ОБЩЕЕ КОЛИЧЕСТВО ИГРОКОВ (РАЗ В СУТКИ) ==========
function updateTotalPlayers() {
    const data = getStoredData() || initData();
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    // Проверяем, прошли ли сутки
    if (now - data.lastTotalUpdate >= ONE_DAY) {
        // Генерируем случайное число от 2 до 13
        const growth = Math.floor(Math.random() * 12) + 2;
        data.totalPlayers += growth;
        data.lastTotalUpdate = now;
        
        saveData(data);
        console.log(`📊 FakeStats: +${growth} игроков, всего ${data.totalPlayers}`);
    }
    
    return data.totalPlayers;
}

// ========== ПОЛУЧИТЬ ТЕКУЩИЙ ОНЛАЙН (В ПРОЦЕНТАХ ОТ ОБЩЕГО) ==========
function getOnlinePercent() {
    const data = getStoredData() || initData();
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    // Обновляем онлайн раз в час
    if (now - data.lastOnlineUpdate >= ONE_HOUR) {
        // Случайный процент от 8 до 33
        data.onlinePercent = Math.floor(Math.random() * 26) + 8;
        data.lastOnlineUpdate = now;
        
        saveData(data);
        console.log(`📊 FakeStats: онлайн ${data.onlinePercent}% от ${data.totalPlayers} = ${Math.floor(data.totalPlayers * data.onlinePercent / 100)}`);
    }
    
    return data.onlinePercent;
}

// ========== ПОЛУЧИТЬ ТЕКУЩУЮ СТАТИСТИКУ ==========
export function getFakeStats() {
    const data = getStoredData() || initData();
    
    // Обновляем данные, если нужно
    const totalPlayers = updateTotalPlayers();
    const onlinePercent = getOnlinePercent();
    
    // Вычисляем онлайн в числах
    const online = Math.floor(totalPlayers * onlinePercent / 100);
    
    return {
        totalPlayers: totalPlayers,
        online: online,
        onlinePercent: onlinePercent
    };
}

// ========== ПРИНУДИТЕЛЬНО ОБНОВИТЬ ОНЛАЙН (ДЛЯ ТЕСТОВ) ==========
export function forceRefreshOnline() {
    const data = getStoredData() || initData();
    data.onlinePercent = Math.floor(Math.random() * 26) + 8;
    data.lastOnlineUpdate = Date.now();
    saveData(data);
    console.log(`📊 FakeStats: принудительно обновлён онлайн до ${data.onlinePercent}%`);
    return getFakeStats();
}

// ========== ПРИНУДИТЕЛЬНО ДОБАВИТЬ ИГРОКОВ (ДЛЯ ТЕСТОВ) ==========
export function forceAddPlayers(count = 0) {
    const data = getStoredData() || initData();
    if (count > 0) {
        data.totalPlayers += count;
    } else {
        // Случайное число 5-50
        const add = Math.floor(Math.random() * 46) + 5;
        data.totalPlayers += add;
    }
    data.lastTotalUpdate = Date.now();
    saveData(data);
    console.log(`📊 FakeStats: принудительно добавлено игроков, всего ${data.totalPlayers}`);
    return getFakeStats();
}

// ========== СБРОСИТЬ ДАННЫЕ (ДЛЯ ТЕСТОВ) ==========
export function resetFakeStats() {
    localStorage.removeItem(STORAGE_KEY);
    const data = initData();
    console.log('📊 FakeStats: сброшены до начальных значений');
    return getFakeStats();
}
