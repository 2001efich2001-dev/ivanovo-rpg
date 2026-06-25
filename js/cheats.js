// js/cheats.js
// ========== СИСТЕМА ЧИТ-КОДОВ ==========

let cheatInputBuffer = '';
let cheatInputTimeout = null;

// Функция для показа обычного уведомления
function showCheatNotification(text, bgColor = '#4caf50') {
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
    setTimeout(() => msg.remove(), 3000);
}

// ========== ЭПИЧНОЕ УВЕДОМЛЕНИЕ ДЛЯ TECON ==========
function showTeconNotification() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: teconFadeIn 0.3s ease;
    `;
    
    const text = document.createElement('div');
    text.textContent = '🧪 Ооо... Вы из Текона :)';
    text.style.cssText = `
        font-size: 4rem;
        font-weight: 900;
        font-family: 'Arial Black', sans-serif;
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
        animation: teconRainbow 0.5s ease infinite alternate;
        text-align: center;
        padding: 20px 40px;
        user-select: none;
        pointer-events: none;
    `;
    
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    
    const style = document.createElement('style');
    style.id = 'teconStyle';
    style.textContent = `
        @keyframes teconFadeIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes teconRainbow {
            0% { color: #ff0000; text-shadow: 0 0 30px #ff0000, 0 0 60px #ff0000; transform: scale(1) rotate(-2deg); }
            14% { color: #ff8800; text-shadow: 0 0 30px #ff8800, 0 0 60px #ff8800; }
            28% { color: #ffff00; text-shadow: 0 0 30px #ffff00, 0 0 60px #ffff00; }
            42% { color: #00ff00; text-shadow: 0 0 30px #00ff00, 0 0 60px #00ff00; }
            57% { color: #0088ff; text-shadow: 0 0 30px #0088ff, 0 0 60px #0088ff; }
            71% { color: #4400ff; text-shadow: 0 0 30px #4400ff, 0 0 60px #4400ff; }
            85% { color: #ff00ff; text-shadow: 0 0 30px #ff00ff, 0 0 60px #ff00ff; }
            100% { color: #ff0066; text-shadow: 0 0 30px #ff0066, 0 0 60px #ff0066; transform: scale(1.1) rotate(2deg); }
        }
        @keyframes teconFadeOut {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0; transform: scale(0.5); }
        }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
        overlay.style.animation = 'teconFadeOut 0.5s ease';
        setTimeout(() => {
            overlay.remove();
            style.remove();
        }, 500);
    }, 3000);
}

export function initCheats() {
    document.addEventListener('keydown', (e) => {
        if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
        cheatInputTimeout = setTimeout(() => {
            cheatInputBuffer = '';
            console.log('Буфер читов сброшен');
        }, 2000);
        
       const key = e.key;
if (key && (key.length === 1 || key === '-')) {
            cheatInputBuffer += key;
            console.log('Текущий буфер:', cheatInputBuffer);
        }
        
        // ===== LimonAd-666 =====
        if (cheatInputBuffer.toLowerCase().endsWith('limonad-666')) {
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            const waitingMsg = document.createElement('div');
            waitingMsg.innerText = '🧪 Код принят! Нажмите Enter для активации читов';
            waitingMsg.style.position = 'fixed';
            waitingMsg.style.top = '50%';
            waitingMsg.style.left = '50%';
            waitingMsg.style.transform = 'translate(-50%, -50%)';
            waitingMsg.style.backgroundColor = '#2c2e3a';
            waitingMsg.style.color = '#ffd966';
            waitingMsg.style.padding = '12px 24px';
            waitingMsg.style.borderRadius = '60px';
            waitingMsg.style.fontWeight = 'bold';
            waitingMsg.style.zIndex = '10000';
            waitingMsg.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
            document.body.appendChild(waitingMsg);
            setTimeout(() => waitingMsg.remove(), 2000);
            
            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', enterHandler);
                    
                    import('./gameState.js').then(m => {
                        m.setStats(m.maxHealth, m.maxHunger, m.maxCold, m.money + 500);
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        showCheatNotification('🧪 Чит-код активирован! Все шкалы восстановлены до 100, +500₽');
                        m.addLogEntry('🧪 Активирован секретный код "LimonAd-666"', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            setTimeout(() => document.removeEventListener('keydown', enterHandler), 5000);
        }
        
        // ===== tecon =====
        if (cheatInputBuffer.toLowerCase().endsWith('tecon')) {
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            const waitingMsg = document.createElement('div');
            waitingMsg.innerText = '🧪 Код принят! Нажмите Enter для активации';
            waitingMsg.style.position = 'fixed';
            waitingMsg.style.top = '50%';
            waitingMsg.style.left = '50%';
            waitingMsg.style.transform = 'translate(-50%, -50%)';
            waitingMsg.style.backgroundColor = '#2c2e3a';
            waitingMsg.style.color = '#ffd966';
            waitingMsg.style.padding = '12px 24px';
            waitingMsg.style.borderRadius = '60px';
            waitingMsg.style.fontWeight = 'bold';
            waitingMsg.style.zIndex = '10000';
            waitingMsg.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
            document.body.appendChild(waitingMsg);
            setTimeout(() => waitingMsg.remove(), 2000);
            
            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', enterHandler);
                    
                    import('./gameState.js').then(m => {
                        m.setStats(null, null, null, m.money + 15000);
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        console.log('🧪 Чит-код "tecon" активирован! +15000₽');
                        showTeconNotification();
                        m.addLogEntry('🧪 Активирован секретный код "tecon" (+15000₽)', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            setTimeout(() => document.removeEventListener('keydown', enterHandler), 5000);
        }
        
        // ===== pump12 =====
        if (cheatInputBuffer.toLowerCase().endsWith('pump12')) {
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            const waitingMsg = document.createElement('div');
            waitingMsg.innerText = '🧪 Код принят! Нажмите Enter для активации';
            waitingMsg.style.position = 'fixed';
            waitingMsg.style.top = '50%';
            waitingMsg.style.left = '50%';
            waitingMsg.style.transform = 'translate(-50%, -50%)';
            waitingMsg.style.backgroundColor = '#2c2e3a';
            waitingMsg.style.color = '#ffd966';
            waitingMsg.style.padding = '12px 24px';
            waitingMsg.style.borderRadius = '60px';
            waitingMsg.style.fontWeight = 'bold';
            waitingMsg.style.zIndex = '10000';
            waitingMsg.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
            document.body.appendChild(waitingMsg);
            setTimeout(() => waitingMsg.remove(), 2000);
            
            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', enterHandler);
                    
                    import('./gameState.js').then(m => {
                        m.setEnergy(m.maxEnergy);
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        console.log('🧪 Чит-код "pump12" активирован! Энергия восстановлена до 100%');
                        showCheatNotification('🧪 Энергия восстановлена до 100%!');
                        m.addLogEntry('🧪 Активирован секретный код "pump12" (энергия 100%)', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            setTimeout(() => document.removeEventListener('keydown', enterHandler), 5000);
        }
    });
}

// ========== QUICK CHEATS (отключены) ==========
export function initQuickCheats() {
    console.log('⚡ Быстрые читы отключены (оставлены только текстовые коды)');
}
