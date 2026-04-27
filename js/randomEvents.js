// js/randomEvents.js
import { eventsDB } from './randomEventsDB.js';
import { inventory, health, hunger, cold, money, setStats, maxHealth, maxHunger, maxCold, updateUI, addLogEntry, addExperience, currentLocation } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';
import { itemsDB } from './inventory.js';

// Переменная для отслеживания активных временных эффектов
export let activeTemporaryEffects = {};

// Добавление временного эффекта
export function addTemporaryEffect(effectId, duration, effectData) {
    activeTemporaryEffects[effectId] = {
        endTime: Date.now() + duration,
        data: effectData
    };
    // Если эффект влияет на холод – пересчитаем его
    if (effectData.coldMultiplier) {
        console.log(`Временный эффект: ускорение замерзания в ${effectData.coldMultiplier} раза`);
    }
    // Через duration секунд эффект автоматически удалится
    setTimeout(() => {
        delete activeTemporaryEffects[effectId];
        console.log(`Временный эффект ${effectId} закончился`);
        showMessage(`🌨️ ${eventsDB[effectId]?.effectMessage || 'Эффект закончился'}`, '#ffd966');
        updateUI();
    }, duration);
}

// Получить текущий множитель холода
export function getColdMultiplier() {
    let multiplier = 1.0;
    for (const effect of Object.values(activeTemporaryEffects)) {
        if (effect.data.coldMultiplier) {
            multiplier *= effect.data.coldMultiplier;
        }
    }
    return multiplier;
}

// Применение эффекта события
async function applyEventEffect(event, choiceIndex = null) {
    if (event.type === 'auto') {
        // Применяем эффекты из event.effect
        if (event.effect.items) {
            for (const itemId of event.effect.items) {
                const idx = inventory.findIndex(i => i.id === itemId);
                if (idx !== -1) {
                    inventory[idx].count++;
                } else {
                    inventory.push({ id: itemId, count: 1 });
                }
                addLogEntry(`🎲 Событие: ${event.name} – получен предмет: ${itemsDB[itemId]?.name}`, 'event');
            }
        }
        if (event.effect.money) {
            const newMoney = money + event.effect.money;
            setStats(health, hunger, cold, newMoney);
            addLogEntry(`🎲 Событие: ${event.name} – получено ${event.effect.money}₽`, 'event');
        }
        if (event.effect.health) {
            const newHealth = health + event.effect.health;
            setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
            addLogEntry(`🎲 Событие: ${event.name} – здоровье ${event.effect.health > 0 ? '+' : ''}${event.effect.health}`, 'event');
        }
        if (event.effectMessage) {
            showMessage(event.effectMessage, '#4caf50');
        }
    }
    
    if (event.type === 'choice' && choiceIndex !== undefined) {
        const choice = event.choices[choiceIndex];
        const success = choice.risk ? Math.random() > choice.risk : true;
        
        if (success) {
            if (choice.success) {
                if (choice.success.items) {
                    // Выбираем случайный предмет из списка
                    const randomItem = choice.success.items[Math.floor(Math.random() * choice.success.items.length)];
                    const idx = inventory.findIndex(i => i.id === randomItem);
                    if (idx !== -1) {
                        inventory[idx].count++;
                    } else {
                        inventory.push({ id: randomItem, count: 1 });
                    }
                    addLogEntry(`🎲 Событие: ${event.name} – получен предмет: ${itemsDB[randomItem]?.name}`, 'event');
                }
                if (choice.success.health) {
                    const newHealth = health + choice.success.health;
                    setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
                }
            }
            if (choice.successMessage) {
                showMessage(choice.successMessage, '#4caf50');
            }
        } else {
            if (choice.fail) {
                if (choice.fail.health) {
                    const newHealth = health + choice.fail.health;
                    setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
                }
                if (choice.fail.money) {
                    const newMoney = money + choice.fail.money;
                    setStats(health, hunger, cold, newMoney);
                }
            }
            if (choice.failMessage) {
                showMessage(choice.failMessage, '#e74c3c');
            }
            addLogEntry(`🎲 Событие: ${event.name} – неудача`, 'event');
        }
    }
    
    if (event.type === 'weather') {
        if (event.effect) {
            addTemporaryEffect(event.id, event.duration, event.effect);
            if (event.effectMessage) {
                showMessage(event.effectMessage, '#ffd966');
            }
            addLogEntry(`🎲 Погодное событие: ${event.name}`, 'event');
        }
    }
    
    updateUI();
    await saveGameData();
}

// Показать модальное окно события
async function showEventModal(event, choiceHandler) {
    const modal = document.getElementById('eventModal');
    const modalContent = document.getElementById('eventModalContent');
    if (!modal || !modalContent) return;
    
    if (event.type === 'auto') {
        modalContent.innerHTML = `
            <h3>${event.name}</h3>
            <img src="${event.image}" alt="${event.name}" style="width: 100%; max-width: 300px; border-radius: 32px; margin: 10px 0;">
            <p>${event.description}</p>
            <button id="eventOkBtn" class="action-btn" style="margin-top: 10px;">Окей</button>
        `;
        modal.style.display = 'flex';
        document.getElementById('eventOkBtn')?.addEventListener('click', async () => {
            modal.style.display = 'none';
            await applyEventEffect(event);
            choiceHandler();
        });
    } else if (event.type === 'choice') {
        let choicesHtml = '';
        event.choices.forEach((choice, idx) => {
            choicesHtml += `<button class="action-btn event-choice-btn" data-choice="${idx}" style="margin: 5px;">${choice.text}</button>`;
        });
        modalContent.innerHTML = `
            <h3>${event.name}</h3>
            <img src="${event.image}" alt="${event.name}" style="width: 100%; max-width: 300px; border-radius: 32px; margin: 10px 0;">
            <p>${event.description}</p>
            <div>${choicesHtml}</div>
        `;
        modal.style.display = 'flex';
        document.querySelectorAll('.event-choice-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const choiceIdx = parseInt(btn.dataset.choice);
                modal.style.display = 'none';
                await applyEventEffect(event, choiceIdx);
                choiceHandler();
            });
        });
    }
}

// Проверка и запуск события (экспортируемая функция)
export async function checkAndTriggerEvent(triggerType, context = {}) {
    // Ищем подходящие события
    let possibleEvents = Object.values(eventsDB).filter(event => event.trigger === triggerType);
    
    if (triggerType === 'location') {
        possibleEvents = possibleEvents.filter(event => event.locationId === context.locationId);
    }
    if (triggerType === 'weather') {
        possibleEvents = possibleEvents.filter(event => event.weatherCondition === context.weather);
    }
    
    // Случайным образом выбираем одно событие (если есть)
    if (possibleEvents.length === 0) return false;
    
    for (const event of possibleEvents) {
        if (Math.random() < event.chance) {
            await showEventModal(event, () => {
                // После завершения события можно выполнить какие-то действия
                console.log(`Событие ${event.id} завершено`);
            });
            return true;
        }
    }
    return false;
}
