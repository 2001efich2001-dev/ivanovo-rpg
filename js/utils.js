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

// ========== ПОДСКАЗКИ ТУТОРИАЛА ==========
let activeTutorialTip = null;
let tutorialTipTimeout = null;

/**
 * Показать подсказку туториала
 * @param {string} text - текст подсказки
 * @param {number} duration - длительность показа в мс (по умолчанию 5000)
 * @param {string} position - позиция: 'top' или 'bottom' (по умолчанию 'top')
 */
export function showTutorialTip(text, duration = 5000, position = 'top') {
    // Удаляем старую подсказку
    if (activeTutorialTip) {
        if (tutorialTipTimeout) clearTimeout(tutorialTipTimeout);
        activeTutorialTip.remove();
        activeTutorialTip = null;
    }

    const tip = document.createElement('div');
    tip.id = 'tutorialTip';
    tip.textContent = text;
    tip.style.cssText = `
        position: fixed;
        ${position === 'top' ? 'top: 20px;' : 'bottom: 100px;'}
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: #ffd966;
        padding: 12px 24px;
        border-radius: 60px;
        font-size: 0.9rem;
        font-weight: bold;
        z-index: 10050;
        border: 1px solid #ffd966;
        backdrop-filter: blur(4px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        animation: tutorialFadeIn 0.3s ease;
        max-width: 90%;
        text-align: center;
        pointer-events: none;
        font-family: inherit;
        line-height: 1.4;
    `;
    document.body.appendChild(tip);
    activeTutorialTip = tip;

    tutorialTipTimeout = setTimeout(() => {
        if (tip && tip.remove) {
            tip.style.animation = 'tutorialFadeOut 0.3s ease';
            setTimeout(() => {
                if (tip && tip.remove) tip.remove();
                activeTutorialTip = null;
            }, 300);
        }
        tutorialTipTimeout = null;
    }, duration);
}

/**
 * Скрыть подсказку туториала (если она активна)
 */
export function hideTutorialTip() {
    if (activeTutorialTip) {
        if (tutorialTipTimeout) clearTimeout(tutorialTipTimeout);
        activeTutorialTip.style.animation = 'tutorialFadeOut 0.3s ease';
        setTimeout(() => {
            if (activeTutorialTip && activeTutorialTip.remove) {
                activeTutorialTip.remove();
                activeTutorialTip = null;
            }
        }, 300);
        tutorialTipTimeout = null;
    }
}
