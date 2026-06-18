// js/cheats.js
// ========== СИСТЕМА ЧИТ-КОДОВ ==========

// Чит 1: Последовательный ввод текста + Enter
let cheatInputBuffer = '';
let cheatInputTimeout = null;

// Функция для показа уведомления
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

export function initCheats() {
    document.addEventListener('keydown', (e) => {
        // Сбрасываем буфер через 2 секунды бездействия
        if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
        cheatInputTimeout = setTimeout(() => {
            cheatInputBuffer = '';
            console.log('Буфер читов сброшен');
        }, 2000);
        
        // Добавляем символ в буфер (только буквы, цифры, дефис)
        const key = e.key;
        if (key.length === 1 || key === '-') {
            cheatInputBuffer += key;
            console.log('Текущий буфер:', cheatInputBuffer);
        }
        
        // Проверяем, закончился ли код (регистронезависимо)
        if (cheatInputBuffer.toLowerCase().endsWith('limonad-666')) {
            // Сбрасываем буфер и таймер
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            // Показываем сообщение, что код принят, ожидаем Enter
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
            
            // Ждём Enter
            const enterHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.removeEventListener('keydown', enterHandler);
                    
                    // Активируем чит через setStats
                    import('./gameState.js').then(m => {
                        m.setStats(
                            m.maxHealth,
                            m.maxHunger,
                            m.maxCold,
                            m.money + 500
                        );
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        console.log('🧪 Чит-код "LimonAd-666" активирован!');
                        
                        const msg = document.createElement('div');
                        msg.innerText = '🧪 Чит-код активирован! Все шкалы восстановлены до 100, +500₽';
                        msg.style.position = 'fixed';
                        msg.style.bottom = '70px';
                        msg.style.left = '50%';
                        msg.style.transform = 'translateX(-50%)';
                        msg.style.backgroundColor = '#4caf50';
                        msg.style.color = 'white';
                        msg.style.padding = '6px 18px';
                        msg.style.borderRadius = '60px';
                        msg.style.fontWeight = 'bold';
                        msg.style.zIndex = '9999';
                        document.body.appendChild(msg);
                        setTimeout(() => msg.remove(), 3000);
                        
                        m.addLogEntry('🧪 Активирован секретный код "LimonAd-666"', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            
            setTimeout(() => {
                document.removeEventListener('keydown', enterHandler);
            }, 5000);
        }
        
        // ========== НОВЫЙ КОД: tecon ==========
        if (cheatInputBuffer.toLowerCase().endsWith('tecon')) {
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            // Показываем сообщение, что код принят, ожидаем Enter
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
                        
                        // 👇 СПЕЦИАЛЬНОЕ УВЕДОМЛЕНИЕ ДЛЯ TECON
                        const msg = document.createElement('div');
                        msg.innerText = '🧪 Ооо... Вы из Текона :)';
                        msg.style.position = 'fixed';
                        msg.style.bottom = '70px';
                        msg.style.left = '50%';
                        msg.style.transform = 'translateX(-50%)';
                        msg.style.backgroundColor = '#ff6b35';
                        msg.style.color = 'white';
                        msg.style.padding = '6px 18px';
                        msg.style.borderRadius = '60px';
                        msg.style.fontWeight = 'bold';
                        msg.style.zIndex = '9999';
                        document.body.appendChild(msg);
                        setTimeout(() => msg.remove(), 3000);
                        
                        m.addLogEntry('🧪 Активирован секретный код "tecon" (+15000₽)', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            
            setTimeout(() => {
                document.removeEventListener('keydown', enterHandler);
            }, 5000);
        }
        
        // ========== НОВЫЙ КОД: pump12 ==========
        if (cheatInputBuffer.toLowerCase().endsWith('pump12')) {
            cheatInputBuffer = '';
            if (cheatInputTimeout) clearTimeout(cheatInputTimeout);
            
            // Показываем сообщение, что код принят, ожидаем Enter
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
                        // Устанавливаем энергию на максимум
                        m.setEnergy(m.maxEnergy);
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        console.log('🧪 Чит-код "pump12" активирован! Энергия восстановлена до 100%');
                        
                        const msg = document.createElement('div');
                        msg.innerText = '🧪 Энергия восстановлена до 100%!';
                        msg.style.position = 'fixed';
                        msg.style.bottom = '70px';
                        msg.style.left = '50%';
                        msg.style.transform = 'translateX(-50%)';
                        msg.style.backgroundColor = '#4caf50';
                        msg.style.color = 'white';
                        msg.style.padding = '6px 18px';
                        msg.style.borderRadius = '60px';
                        msg.style.fontWeight = 'bold';
                        msg.style.zIndex = '9999';
                        document.body.appendChild(msg);
                        setTimeout(() => msg.remove(), 3000);
                        
                        m.addLogEntry('🧪 Активирован секретный код "pump12" (энергия 100%)', 'system');
                    });
                }
            };
            document.addEventListener('keydown', enterHandler);
            
            setTimeout(() => {
                document.removeEventListener('keydown', enterHandler);
            }, 5000);
        }
    });
}

// ========== УДАЛЁН QUICK CHEATS ==========
// initQuickCheats полностью удалена. Горячие клавиши больше не работают.

export function initQuickCheats() {
    // Функция пустая, чтобы не ломать импорт в main.js
    console.log('⚡ Быстрые читы отключены (оставлены только текстовые коды)');
}
