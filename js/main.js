// js/main.js
import { initDOM, updateUI, cold, maxCold, setStats } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment, itemsDB } from './inventory.js';
import { renderInteractiveMap } from './map.js';

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    
    // Колбэк после успешного входа
    function afterLogin() {
        renderItemsTab();
        renderEquipmentTab();
        recalcColdFromEquipment();
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    
    // Кнопки
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    
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
            await auth.signOut();
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
    
    // Закрытие модалок
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    updateUI();
});
