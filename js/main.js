// js/main.js
import { initDOM, updateUI } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment } from './inventory.js';
import { renderInteractiveMap } from './map.js';

// Функции управления сплеш-экраном
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

// Функция для активации переключения вкладок внутри модального окна инвентаря
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

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    
    // Колбэк, вызываемый после успешного входа и загрузки всех данных
    function afterLogin() {
        renderItemsTab();
        renderEquipmentTab();
        recalcColdFromEquipment();
        initInventoryTabs();
        // Игра полностью готова – скрываем сплеш
        hideSplash();
    }
    
    // Инициализируем авторизацию (она сама вызовет afterLogin при успешном входе)
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    
    // Перехватываем события кнопок «Войти» и «Зарегистрироваться», чтобы показать сплеш
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    // Сохраняем оригинальные обработчики (они установлены в initAuth) и добавляем свои, но не удаляя оригинальные.
    // Просто добавляем дополнительный обработчик, который показывает сплеш.
    // Так мы не сломаем логику в auth.js.
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            showSplash();
        });
    }
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            showSplash();
        });
    }
    
    // Кнопки игрового интерфейса
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            renderItemsTab();
            renderEquipmentTab();
            initInventoryTabs();
            document.getElementById('inventoryModal').style.display = 'flex';
        });
    }
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            renderInteractiveMap();
            document.getElementById('mapModal').style.display = 'flex';
        });
    }
    if (logoutMenuBtn) {
        logoutMenuBtn.addEventListener('click', async () => {
            await auth.signOut();
            // При выходе показываем форму авторизации — сплеш можно скрыть или показать
            hideSplash();
        });
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('rpgTheme', isLight ? 'light' : 'dark');
        });
        const saved = localStorage.getItem('rpgTheme');
        if (saved === 'light') document.body.classList.add('light-theme');
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Если пользователь уже авторизован (например, перезагрузил страницу), то
    // afterLogin будет вызван из onAuthStateChanged, и сплеш скроется.
    // Если пользователь не авторизован, то показываем форму входа, а сплеш можно скрыть сразу.
    // Скрываем сплеш через 0.5 секунды, если нет активного пользователя (форма входа уже видна).
    // Но лучше дождаться, пока интерфейс авторизации полностью отрисуется.
    setTimeout(() => {
        if (!auth.currentUser) {
            hideSplash();
        }
    }, 500);
    
    updateUI();
});
