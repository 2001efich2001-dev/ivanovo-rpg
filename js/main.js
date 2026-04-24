// js/main.js
import { initDOM, updateUI } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment } from './inventory.js';
import { renderInteractiveMap } from './map.js';

// ========== ЗВУКИ ==========
let audioCtx = null;
let isMusicPlaying = false;
let musicInterval = null;
let musicEnabled = true;

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

function playClick() {
    playTone(880, 0.08, 0.1);
}

function playPurchase() {
    playTone(660, 0.12, 0.12);
}

function playAction() {
    playTone(523, 0.15, 0.12);
}

// Фоновая музыка (простая последовательность нот)
function startBackgroundMusic() {
    if (!musicEnabled || isMusicPlaying) return;
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => startMusicLoop());
    } else {
        startMusicLoop();
    }
}

function startMusicLoop() {
    if (!musicEnabled || isMusicPlaying) return;
    isMusicPlaying = true;
    const notes = [261.63, 293.66, 329.63, 261.63, 329.63, 293.66, 261.63]; // C D E C E D C
    let index = 0;
    function playNote() {
        if (!musicEnabled || !isMusicPlaying) return;
        const freq = notes[index % notes.length];
        const gainNode = audioCtx.createGain();
        const osc = audioCtx.createOscillator();
        osc.frequency.value = freq;
        gainNode.gain.value = 0.08;
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
        osc.stop(audioCtx.currentTime + 0.8);
        index++;
        musicInterval = setTimeout(playNote, 1000);
    }
    playNote();
}

function stopBackgroundMusic() {
    if (musicInterval) {
        clearTimeout(musicInterval);
        musicInterval = null;
    }
    isMusicPlaying = false;
}

function toggleMusic() {
    musicEnabled = !musicEnabled;
    const btn = document.getElementById('musicToggle');
    if (btn) {
        btn.textContent = musicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    }
    if (musicEnabled) {
        startBackgroundMusic();
    } else {
        stopBackgroundMusic();
    }
}

// Функции управления сплеш-экраном (без изменений)
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

// Функция для активации переключения вкладок внутри модального окна инвентаря (с звуком)
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
        playClick(); // звук переключения вкладки
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
    if (activeTab) {
        switchTab(activeTab);
    } else {
        switchTab(tabs[0]);
    }
}

// Патчим функции из inventory.js, чтобы добавить звуки (переопределим их после импорта, но лучше внести изменения в inventory.js. Однако для простоты переопределим здесь)
// Сохраним оригинальные функции
const originalUseItem = window.useItem; // но они не в global, поэтому сложно. Внесём изменения прямо в inventory.js? Но вы не хотите трогать другие файлы.
// Лучше создать обёртки, но так как мы не можем менять inventory.js, предложу переопределить функции в main.js после их загрузки? Это ненадёжно.

// Поскольку мы имеем доступ к модулям только через импорт, изменить их поведение сложно.
// Предлагаю добавить звуки в обработчики событий для кнопок в инвентаре и локациях, а оригинальные функции оставить без звука.
// Для этого мы добавим вызов playClick/playPurchase внутри обработчиков, которые уже есть в main.js.

// В current main.js уже есть обработчики для inventoryBtn и mapBtn, добавим туда playClick.
// А для использования предметов и экипировки звуки добавим, переопределив обработчики рендера? Это сложно.
// Поскольку звуки – приятное дополнение, я добавлю их только на основные кнопки интерфейса и на переключение вкладок. Для использования предметов и действий в локациях звуки добавлю через модификацию inventory.js (одно небольшое изменение). Позволите?

// Для упрощения я всё же внесу изменения в inventory.js и locations.js (добавлю playClick / playPurchase в нужные места). Это просто – добавить одну строку в начале функций useItem, equipItem, unequipItem, executeAction. Я предоставлю обновлённые версии этих файлов. Но если вы против, можно обойтись только кнопками.

// Но чтобы не множить сущности, я предложу новый вариант: добавлю звуки в main.js через патчинг прототипов? Это грязно. Давайте я пришлю обновлённый inventory.js и locations.js с добавленными звуками (буквально по одной строке в начале каждой функции). Это займёт 2 минуты.

// Вы согласны? Если да, я пришлю эти файлы. Если нет – оставим звуки только на основных кнопках.

// Пока я добавлю звуки на кнопки инвентаря, карты, выхода, темы, а также на переключение вкладок.
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
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            playClick();
            showSplash();
        });
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            playClick();
            showSplash();
        });
    }
    
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');
    
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
        const saved = localStorage.getItem('rpgTheme');
        if (saved === 'light') document.body.classList.add('light-theme');
    }
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            playClick();
            toggleMusic();
        });
        // Инициализация текста кнопки
        musicToggle.textContent = musicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playClick();
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Запуск фоновой музыки после первого клика пользователя (политика autoplay)
    const startMusicOnFirstClick = () => {
        if (musicEnabled && !isMusicPlaying) {
            startBackgroundMusic();
        }
        document.body.removeEventListener('click', startMusicOnFirstClick);
    };
    document.body.addEventListener('click', startMusicOnFirstClick);
    
    setTimeout(() => {
        if (!auth.currentUser) {
            hideSplash();
        }
    }, 500);
    
    updateUI();
});
