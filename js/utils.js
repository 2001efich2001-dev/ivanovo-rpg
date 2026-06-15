// js/utils.js
import { addLogEntry } from './gameState.js';

export function showMessage(text, bgColor = '#4caf50') {
    const msg = document.createElement('div');
    msg.innerText = text;
    msg.style.position = 'fixed';
    msg.style.bottom = '70px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.backgroundColor = bgColor;
    msg.style.color = 'white';
    msg.style.padding = '6px 18px';
    msg.style.borderRadius = '60px';
    msg.style.fontWeight = 'bold';
    msg.style.zIndex = '9999';
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
}

// Удобная функция для добавления записей в лог действий
export function logAction(message, type = 'system') {
    addLogEntry(message, type);
}

// ========== ВЫЕЗЖАЮЩЕЕ УВЕДОМЛЕНИЕ ==========
let activePopup = null;
let popupTimeout = null;

/**
 * Показать выезжающее уведомление снизу экрана
 * @param {string} imageUrl - путь к картинке
 * @param {string} title - заголовок уведомления
 * @param {string} text - текст уведомления
 * @param {string|null} soundUrl - путь к звуку (опционально)
 * @param {number} duration - длительность показа в мс (по умолчанию 5000)
 */
export function showPopupNotification(imageUrl, title, text, soundUrl = null, duration = 5000) {
    // Удаляем предыдущее уведомление, если есть
    if (activePopup) {
        if (popupTimeout) clearTimeout(popupTimeout);
        activePopup.classList.remove('show');
        setTimeout(() => {
            if (activePopup && activePopup.remove) activePopup.remove();
            activePopup = null;
        }, 400);
    }
    
    // Создаём контейнер
    const popup = document.createElement('div');
    popup.className = 'popup-notification';
    popup.innerHTML = `
        <div class="popup-notification-content">
            <img src="${imageUrl}" alt="${title}" class="popup-notification-image" onerror="this.style.display='none'">
            <div class="popup-notification-title">${title}</div>
            <div class="popup-notification-text">${text}</div>
        </div>
    `;
    
    document.body.appendChild(popup);
    activePopup = popup;
    
    // Анимация появления
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);
    
    // Звук (если указан)
    if (soundUrl) {
        try {
            const audio = new Audio(soundUrl);
            audio.volume = 0.5;
            audio.play().catch(e => console.log('Звук не загрузился:', e));
        } catch (e) {
            console.log('Ошибка воспроизведения звука:', e);
        }
    }
    
    // Автоматическое скрытие
    popupTimeout = setTimeout(() => {
        if (activePopup) {
            activePopup.classList.remove('show');
            setTimeout(() => {
                if (activePopup && activePopup.remove) activePopup.remove();
                activePopup = null;
            }, 400);
        }
        popupTimeout = null;
    }, duration);
    
    return popup;
}

/**
 * Быстрое уведомление с картинкой (упрощённый вариант)
 * @param {string} title - заголовок
 * @param {string} text - текст
 * @param {number} duration - длительность
 */
export function showQuickPopup(title, text, duration = 3000) {
    showPopupNotification('', title, text, null, duration);
}
