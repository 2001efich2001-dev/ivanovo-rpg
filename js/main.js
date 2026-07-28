// js/fakeStats.js

const STORAGE_KEY = 'fake_stats_data';

const DEFAULT_DATA = {
    totalPlayers: 3807,
    lastTotalUpdate: Date.now(),
    onlinePercent: 0,
    lastOnlineUpdate: 0
};

function getStoredData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.totalPlayers && data.lastTotalUpdate !== undefined) {
                return data;
            }
        }
    } catch (e) {
        console.warn('Ошибка чтения fakeStats:', e);
    }
    return null;
}

function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Ошибка сохранения fakeStats:', e);
    }
}

function initData() {
    let data = getStoredData();
    if (!data) {
        data = { ...DEFAULT_DATA };
        saveData(data);
        console.log('📊 FakeStats: инициализированы начальные данные');
    }
    return data;
}

function updateTotalPlayers() {
    const data = getStoredData() || initData();
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    if (now - data.lastTotalUpdate >= ONE_DAY) {
        const growth = Math.floor(Math.random() * 12) + 2;
        data.totalPlayers += growth;
        data.lastTotalUpdate = now;
        saveData(data);
        console.log(`📊 FakeStats: +${growth} игроков, всего ${data.totalPlayers}`);
    }
    return data.totalPlayers;
}

function getOnlinePercent() {
    const data = getStoredData() || initData();
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    if (now - data.lastOnlineUpdate >= ONE_HOUR) {
        data.onlinePercent = Math.floor(Math.random() * 26) + 8;
        data.lastOnlineUpdate = now;
        saveData(data);
        console.log(`📊 FakeStats: онлайн ${data.onlinePercent}% от ${data.totalPlayers}`);
    }
    return data.onlinePercent;
}

export function getFakeStats() {
    const data = getStoredData() || initData();
    const totalPlayers = updateTotalPlayers();
    const onlinePercent = getOnlinePercent();
    const online = Math.floor(totalPlayers * onlinePercent / 100);
    
    return {
        totalPlayers: totalPlayers,
        online: online,
        onlinePercent: onlinePercent
    };
}
