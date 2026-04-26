// js/main.js
import { initDOM, updateUI, setLocationChangeCallback, currentLocation, actionLog, setLogUpdateCallback, setExpUpdateCallback, addExperience } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment } from './inventory.js';
import { renderInteractiveMap } from './map.js';
import { renderLocation } from './locations.js';
import { startTimeWeatherUpdates, stopTimeWeatherUpdates, updateTimeWeatherUI } from './timeWeather.js';
import { stopWeatherEffects } from './weatherEffects.js';
import { logAction } from './utils.js';

// ========== ЗВУКИ И МУЗЫКА ==========
let audioCtx = null;
let bgMusic = null;          // HTMLAudioElement для MP3
let isMusicEnabled = true;

// Инициализация Web Audio для коротких звуков
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration, volume = 0.15) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => playToneInternal(freq, duration, volume));
    } else {
        playToneInternal(freq, duration, volume);
    }
}

function playToneInternal(freq, duration, volume) {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start();
    osc.stop(now + duration);
}

// Глобальные звуковые функции (доступны из других модулей)
window.playClickSound = () => playTone(880, 0.08, 0.1);
window.playPurchaseSound = () => playTone(660, 0.12, 0.12);
window.playActionSound = () => playTone(523, 0.15, 0.12);

// Локальные псевдонимы для удобства
function playClick() { playTone(880, 0.08, 0.1); }
function playPurchase() { playTone(660, 0.12, 0.12); }

// --- Фоновая музыка через MP3 ---
function initMusic() {
    if (bgMusic) return;
    bgMusic = new Audio('background.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.3;

    const saved = localStorage.getItem('musicEnabled');
    isMusicEnabled = saved !== null ? saved === 'true' : true;

    const btn = document.getElementById('musicToggle');
    if (btn) {
        btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    }
}

function startMusic() {
    if (!isMusicEnabled) return;
    if (!bgMusic) initMusic();
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(e => console.log('Автозапуск музыки заблокирован', e));
    }
}

function stopMusic() {
    if (bgMusic && !bgMusic.paused) bgMusic.pause();
}

function toggleMusic() {
    isMusicEnabled = !isMusicEnabled;
    localStorage.setItem('musicEnabled', isMusicEnabled);
    const btn = document.getElementById('musicToggle');
    if (btn) btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    if (isMusicEnabled) startMusic();
    else stopMusic();
}

// --- Сплеш-экран ---
function showSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.style.opacity = '1';
        splash.style.display = 'flex';
    }
}

function hideSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 300);
    }
}

// Глобальная функция для скрытия сплеша из других модулей (например, auth.js)
window.hideSplashOnError = () => hideSplash();

// --- Вкладки инвентаря ---
function initInventoryTabs() {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;
    const tabs = modal.querySelectorAll('.tab-btn');
    const itemsTab = document.getElementById('itemsTab');
    const equipmentTab = document.getElementById('equipmentTab');
    if (!tabs.length || !itemsTab || !equipmentTab) return;

    tabs.forEach(tab => {
        tab.removeEventListener('click', tab._listener);
    });

    const switchTab = (tab) => {
        playClick();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (tab.dataset.tab === 'items') {
            itemsTab.style.display = 'flex';
            equipmentTab.style.display = 'none';
            renderItemsTab();
        } else {
            itemsTab.style.display = 'none';
            equipmentTab.style.display = 'flex';
            renderEquipmentTab();
        }
    };

    tabs.forEach(tab => {
        const handler = () => switchTab(tab);
        tab.addEventListener('click', handler);
        tab._listener = handler;
    });

    const activeTab = modal.querySelector('.tab-btn.active');
    if (activeTab) switchTab(activeTab);
    else if (tabs[0]) switchTab(tabs[0]);
}

// --- Обработчик смены локации ---
function onLocationChanged(newLocationId) {
    console.log(`Смена локации на: ${newLocationId}`);
    renderLocation(newLocationId);
}

// --- Лог действий (отображение) ---
function renderLogPanel() {
    const container = document.getElementById('logPanel');
    if (!container) return;
    
    if (actionLog.length === 0) {
        container.innerHTML = '<div class="log-entry system" style="text-align:center; opacity:0.6;">История действий пуста</div>';
        return;
    }
    
    let html = '';
    const logsToShow = actionLog.slice(-30);
    for (const entry of logsToShow) {
        html += `
            <div class="log-entry ${entry.type}">
                <span class="log-time">[${entry.time}]</span>
                ${escapeHtml(entry.message)}
            </div>
        `;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// Простой escape для защиты от XSS
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    
    // Подписываемся на обновление лога
    setLogUpdateCallback(() => {
        renderLogPanel();
    });
    
    // Подписываемся на обновление опыта (перерисовываем UI)
    setExpUpdateCallback(() => {
        updateUI(); // updateUI уже обновляет отображение уровня и опыта
    });
    
    function afterLogin() {
        renderItemsTab();
        renderEquipmentTab();
        recalcColdFromEquipment();
        initInventoryTabs();
        renderLocation(currentLocation);
        updateTimeWeatherUI();
        startTimeWeatherUpdates();
        renderLogPanel();
        updateUI(); // обновляем UI опыта после загрузки
        hideSplash();
        if (isMusicEnabled && bgMusic && bgMusic.paused) {
            startMusic();
        }
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    
    setLocationChangeCallback(onLocationChanged);
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const shopBtn = document.getElementById('shopBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');

    if (loginBtn) loginBtn.addEventListener('click', () => { playClick(); showSplash(); });
    if (registerBtn) registerBtn.addEventListener('click', () => { playClick(); showSplash(); });
    
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            playClick();
            renderItemsTab();
            renderEquipmentTab();
            initInventoryTabs();
            document.getElementById('inventoryModal').style.display = 'flex';
        });
    }
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            playClick();
            renderInteractiveMap();
            document.getElementById('mapModal').style.display = 'flex';
        });
    }
    if (shopBtn) {
        shopBtn.addEventListener('click', async () => {
            playClick();
            const shop = await import('./shop.js');
            shop.renderShopBuyTab();
            shop.renderShopSellTab();
            
            const modal = document.getElementById('shopModal');
            const tabs = modal.querySelectorAll('.tab-btn');
            const buyTab = document.getElementById('shopBuyTab');
            const sellTab = document.getElementById('shopSellTab');
            
            const switchShopTab = (tab) => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.shopTab === 'buy') {
                    buyTab.style.display = 'flex';
                    sellTab.style.display = 'none';
                    shop.renderShopBuyTab();
                } else {
                    buyTab.style.display = 'none';
                    sellTab.style.display = 'flex';
                    shop.renderShopSellTab();
                }
            };
            
            const newTabs = modal.querySelectorAll('.tab-btn');
            newTabs.forEach(tab => {
                tab.removeEventListener('click', tab._shopListener);
                const handler = () => switchShopTab(tab);
                tab.addEventListener('click', handler);
                tab._shopListener = handler;
            });
            
            modal.style.display = 'flex';
        });
    }
    if (logoutMenuBtn) {
        logoutMenuBtn.addEventListener('click', async () => {
            playClick();
            stopWeatherEffects();
            stopTimeWeatherUpdates();
            await auth.signOut();
            hideSplash();
        });
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            playClick();
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('rpgTheme', isLight ? 'light' : 'dark');
        });
        const savedTheme = localStorage.getItem('rpgTheme');
        if (savedTheme === 'light') document.body.classList.add('light-theme');
    }
    
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            playClick();
            toggleMusic();
        });
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playClick();
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    initMusic();
    const startMusicOnFirstClick = () => {
        if (isMusicEnabled && bgMusic && bgMusic.paused) {
            startMusic();
        }
        document.body.removeEventListener('click', startMusicOnFirstClick);
    };
    document.body.addEventListener('click', startMusicOnFirstClick);
    
    // Скрываем сплеш через 1.5 секунды, если пользователь не авторизован
    setTimeout(() => {
        if (!auth.currentUser) {
            hideSplash();
        }
    }, 1500);
    
    updateUI();
});
