// js/main.js
import { initDOM, updateUI } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment } from './inventory.js';
import { renderInteractiveMap } from './map.js';

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
    bgMusic = new Audio('background.mp3'); // файл должен лежать в корне сайта
    bgMusic.loop = true;
    bgMusic.volume = 0.3;

    // Загружаем сохранённое состояние
    const saved = localStorage.getItem('musicEnabled');
    if (saved !== null) {
        isMusicEnabled = saved === 'true';
    } else {
        isMusicEnabled = true; // по умолчанию включена
    }

    const btn = document.getElementById('musicToggle');
    if (btn) {
        btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    }

    if (isMusicEnabled) {
        // Не запускаем сразу – дождёмся первого клика пользователя (autoplay policy)
    }
}

function startMusic() {
    if (!isMusicEnabled) return;
    if (!bgMusic) initMusic();
    if (bgMusic && bgMusic.paused) {
        bgMusic.play().catch(e => console.log('Автозапуск музыки заблокирован, нужен клик', e));
    }
}

function stopMusic() {
    if (bgMusic && !bgMusic.paused) {
        bgMusic.pause();
    }
}

function toggleMusic() {
    isMusicEnabled = !isMusicEnabled;
    localStorage.setItem('musicEnabled', isMusicEnabled);
    const btn = document.getElementById('musicToggle');
    if (btn) btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    if (isMusicEnabled) {
        startMusic();
    } else {
        stopMusic();
    }
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

// --- Вкладки инвентаря с звуками ---
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

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    
    function afterLogin() {
        renderItemsTab();
        renderEquipmentTab();
        recalcColdFromEquipment();
        initInventoryTabs();
        hideSplash();
        // Если музыка включена, запускаем её после входа (ещё не запущена)
        if (isMusicEnabled && bgMusic && bgMusic.paused) {
            startMusic();
        }
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    
    // Обработчики кнопок
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
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
    if (logoutMenuBtn) {
        logoutMenuBtn.addEventListener('click', async () => {
            playClick();
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
    
    // Кнопка музыки
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            playClick();
            toggleMusic();
        });
    }
    
    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playClick();
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Инициализация музыки и запуск после первого клика пользователя (autoplay)
    initMusic();
    const startMusicOnFirstClick = () => {
        if (isMusicEnabled && bgMusic && bgMusic.paused) {
            startMusic();
        }
        document.body.removeEventListener('click', startMusicOnFirstClick);
    };
    document.body.addEventListener('click', startMusicOnFirstClick);
    
    // Если пользователь не авторизован, всё равно скрываем сплеш через полсекунды
    setTimeout(() => {
        if (!auth.currentUser) hideSplash();
    }, 500);
    
    updateUI();
});
