// js/tradeGuard.js
// Система защиты от конфликтов при обмене

let blockRealtimeUntil = 0;
let pendingTrade = null;
let blockTimeout = null;

/**
 * Активировать защиту при обмене
 * @param {number} durationMs - Длительность блокировки в мс (по умолчанию 5000)
 * @param {Object} tradeData - Данные обмена (опционально)
 */
export function activateTradeGuard(durationMs = 5000, tradeData = null) {
    const now = Date.now();
    blockRealtimeUntil = now + durationMs;
    pendingTrade = tradeData;
    
    // Очищаем старый таймаут, если был
    if (blockTimeout) {
        clearTimeout(blockTimeout);
    }
    
    // Автоматическое снятие защиты через durationMs
    blockTimeout = setTimeout(() => {
        deactivateTradeGuard();
    }, durationMs);
    
    console.log(`🛡️ TradeGuard активирован до ${new Date(blockRealtimeUntil).toLocaleTimeString()}`);
    
    // Добавляем визуальный индикатор (опционально)
    showGuardIndicator(true);
}

/**
 * Деактивировать защиту
 */
export function deactivateTradeGuard() {
    blockRealtimeUntil = 0;
    pendingTrade = null;
    if (blockTimeout) {
        clearTimeout(blockTimeout);
        blockTimeout = null;
    }
    
    console.log('✅ TradeGuard деактивирован');
    showGuardIndicator(false);
}

/**
 * Проверить, нужно ли блокировать realtime обновление
 * @returns {boolean}
 */
export function shouldBlockRealtime() {
    const isBlocked = Date.now() < blockRealtimeUntil;
    if (isBlocked) {
        console.log('⏸️ Realtime обновление заблокировано TradeGuard');
    }
    return isBlocked;
}

/**
 * Получить оставшееся время блокировки в секундах
 * @returns {number}
 */
export function getRemainingBlockTime() {
    if (Date.now() >= blockRealtimeUntil) return 0;
    return Math.ceil((blockRealtimeUntil - Date.now()) / 1000);
}

/**
 * Проверить, активна ли сейчас защита
 * @returns {boolean}
 */
export function isTradeGuardActive() {
    return Date.now() < blockRealtimeUntil;
}

/**
 * Получить данные ожидающего обмена
 * @returns {Object|null}
 */
export function getPendingTrade() {
    return pendingTrade;
}

/**
 * Визуальный индикатор защиты (иконка в углу экрана)
 * @param {boolean} show - Показывать или скрывать
 */
function showGuardIndicator(show) {
    let indicator = document.getElementById('tradeGuardIndicator');
    
    if (show && !indicator) {
        indicator = document.createElement('div');
        indicator.id = 'tradeGuardIndicator';
        indicator.innerHTML = '🛡️ Обмен обрабатывается...';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(46, 125, 50, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 10000;
            animation: pulse 1s infinite;
            backdrop-filter: blur(4px);
            pointer-events: none;
        `;
        document.body.appendChild(indicator);
        
        // Добавляем анимацию, если её нет
        if (!document.querySelector('#guardAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'guardAnimationStyle';
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 0.7; }
                    50% { opacity: 1; }
                    100% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(style);
        }
    } else if (!show && indicator) {
        indicator.remove();
    }
}
