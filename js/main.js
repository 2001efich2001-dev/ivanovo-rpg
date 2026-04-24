
import { initDOM, updateUI } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment } from './inventory.js';
import { renderInteractiveMap } from './map.js';

// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем DOM элементы gameState
    initDOM();
    
    // Получаем контейнеры
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    
    // Запускаем авторизацию (она сама подпишется на onAuthStateChanged)
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan);
    
    // Инициализация кнопок инвентаря и карты
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    
    // Функция выхода (переопределяем signOut из auth)
    import('./auth.js').then(({ auth }) => {
        window.signOut = () => auth.signOut();
    });
    
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            renderItemsTab();
            renderEquipmentTab();
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
            const { auth } = await import('./auth.js');
            await auth.signOut();
        });
    }
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('rpgTheme', isLight ? 'light' : 'dark');
        });
        // инициализация темы
        const saved = localStorage.getItem('rpgTheme');
        if (saved === 'light') document.body.classList.add('light-theme');
    }
    
    // Закрытие модальных окон (уже есть в HTML, но добавим)
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    updateUI();
});
