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
