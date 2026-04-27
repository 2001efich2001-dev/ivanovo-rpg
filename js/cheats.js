// js/cheats.js
// ========== СИСТЕМА ЧИТ-КОДОВ ==========

// Чит 1: Последовательный ввод текста + Enter
let cheatInputBuffer = '';
let cheatInputTimeout = null;

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
                    
                    // Активируем чит
                    import('./gameState.js').then(m => {
                        m.health = m.maxHealth;
                        m.hunger = m.maxHunger;
                        m.cold = m.maxCold;
                        m.money += 500;
                        m.updateUI();
                        import('./firestore.js').then(f => f.saveGameData());
                        
                        console.log('🧪 Чит-код "LimonAd-666" активирован! Здоровье, голод, тепло = 100, +500₽');
                        
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
    });
}

// Чит 2: Комбинация Ctrl + Shift + C (быстрое пополнение ресурсов)
export function initQuickCheats() {
    let cheatKeysPressed = {};
    
    document.addEventListener('keydown', (e) => {
        cheatKeysPressed[e.key] = true;
        
        // Ctrl + Shift + C
        if (cheatKeysPressed['Control'] && cheatKeysPressed['Shift'] && e.key === 'C') {
            e.preventDefault();
            import('./gameState.js').then(m => {
                m.money += 1000;
                m.health = Math.min(m.maxHealth, m.health + 100);
                m.hunger = Math.min(m.maxHunger, m.hunger + 100);
                m.cold = Math.min(m.maxCold, m.cold + 100);
                m.addExperience(100);
                m.updateUI();
                import('./firestore.js').then(f => f.saveGameData());
                console.log('🧪 Быстрый чит: +1000 денег, +100 к шкалам, +100 опыта');
                
                const msg = document.createElement('div');
                msg.innerText = '🧪 Быстрый чит активирован! +1000₽, +100 ко всем шкалам, +100 опыта';
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
            });
        }
        
        // Ctrl + Shift + I – получить все предметы
        if (cheatKeysPressed['Control'] && cheatKeysPressed['Shift'] && e.key === 'I') {
            e.preventDefault();
            import('./gameState.js').then(m => {
                import('./inventory.js').then(i => {
                    const allItems = Object.keys(i.itemsDB);
                    for (const itemId of allItems) {
                        const idx = m.inventory.findIndex(inv => inv.id === itemId);
                        if (idx !== -1) {
                            m.inventory[idx].count += 1;
                        } else {
                            m.inventory.push({ id: itemId, count: 1 });
                        }
                    }
                    m.updateUI();
                    import('./firestore.js').then(f => f.saveGameData());
                    alert('🧪 Чит-код: все предметы добавлены по 1 штуке');
                });
            });
        }
    });
    
    document.addEventListener('keyup', (e) => {
        delete cheatKeysPressed[e.key];
    });
}
