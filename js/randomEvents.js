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
    if (effectData.coldMultiplier) {
        console.log(`Временный эффект: ускорение замерзания в ${effectData.coldMultiplier} раза`);
    }
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

// Вспомогательная функция для получения случайного числа в диапазоне
function getRandomInRange(range) {
    if (Array.isArray(range)) {
        return Math.floor(Math.random() * (range[1] - range[0] + 1) + range[0]);
    }
    return range;
}

// Применение эффекта события
async function applyEventEffect(event, choiceIndex = null) {
    if (event.type === 'auto') {
        // Применяем эффекты из event.effect
        if (event.effect.items) {
            const itemsToAdd = event.effect.items;
            if (Array.isArray(itemsToAdd)) {
                // Если массив, выбираем случайный предмет
                const randomItem = itemsToAdd[Math.floor(Math.random() * itemsToAdd.length)];
                const idx = inventory.findIndex(i => i.id === randomItem);
                if (idx !== -1) {
                    inventory[idx].count++;
                } else {
                    inventory.push({ id: randomItem, count: 1 });
                }
                addLogEntry(`🎲 Событие: ${event.name} – получен предмет: ${itemsDB[randomItem]?.name}`, 'event');
                showMessage(`🎲 Вы получили: ${itemsDB[randomItem]?.name}`, '#4caf50');
            } else {
                // Одиночный предмет (строка)
                const idx = inventory.findIndex(i => i.id === itemsToAdd);
                if (idx !== -1) {
                    inventory[idx].count++;
                } else {
                    inventory.push({ id: itemsToAdd, count: 1 });
                }
                addLogEntry(`🎲 Событие: ${event.name} – получен предмет: ${itemsDB[itemsToAdd]?.name}`, 'event');
                showMessage(`🎲 Вы получили: ${itemsDB[itemsToAdd]?.name}`, '#4caf50');
            }
        }
        if (event.effect.money) {
            const moneyAdd = getRandomInRange(event.effect.money);
            const newMoney = money + moneyAdd;
            setStats(health, hunger, cold, newMoney);
            addLogEntry(`🎲 Событие: ${event.name} – получено ${moneyAdd}₽`, 'event');
            showMessage(`🎲 Вы получили ${moneyAdd}₽`, '#4caf50');
        }
        if (event.effect.health) {
            const healthChange = getRandomInRange(event.effect.health);
            const newHealth = Math.min(maxHealth, Math.max(0, health + healthChange));
            setStats(newHealth, hunger, cold, money);
            addLogEntry(`🎲 Событие: ${event.name} – здоровье ${healthChange > 0 ? '+' : ''}${healthChange}`, 'event');
            showMessage(`🎲 Здоровье ${healthChange > 0 ? '+' : ''}${healthChange}`, healthChange > 0 ? '#4caf50' : '#e74c3c');
        }
        if (event.effect.experience) {
            const expGain = getRandomInRange(event.effect.experience);
            addExperience(expGain);
            addLogEntry(`🎲 Событие: ${event.name} – получено ${expGain} опыта`, 'event');
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
                    const randomItem = choice.success.items[Math.floor(Math.random() * choice.success.items.length)];
                    const idx = inventory.findIndex(i => i.id === randomItem);
                    if (idx !== -1) {
                        inventory[idx].count++;
                    } else {
                        inventory.push({ id: randomItem, count: 1 });
                    }
                    addLogEntry(`🎲 Событие: ${event.name} – получен предмет: ${itemsDB[randomItem]?.name}`, 'event');
                    showMessage(`🎲 Вы получили: ${itemsDB[randomItem]?.name}`, '#4caf50');
                }
                if (choice.success.health) {
                    const healthChange = getRandomInRange(choice.success.health);
                    const newHealth = Math.min(maxHealth, Math.max(0, health + healthChange));
                    setStats(newHealth, hunger, cold, money);
                    addLogEntry(`🎲 Событие: ${event.name} – здоровье ${healthChange > 0 ? '+' : ''}${healthChange}`, 'event');
                }
                if (choice.success.cold) {
                    const coldChange = getRandomInRange(choice.success.cold);
                    const newCold = Math.min(maxCold, Math.max(0, cold + coldChange));
                    setStats(health, hunger, newCold, money);
                    addLogEntry(`🎲 Событие: ${event.name} – тепло ${coldChange > 0 ? '+' : ''}${coldChange}`, 'event');
                }
                if (choice.success.money) {
                    const moneyAdd = getRandomInRange(choice.success.money);
                    const newMoney = money + moneyAdd;
                    setStats(health, hunger, cold, newMoney);
                    addLogEntry(`🎲 Событие: ${event.name} – получено ${moneyAdd}₽`, 'event');
                }
            }
            if (choice.successMessage) {
                showMessage(choice.successMessage, '#4caf50');
            }
        } else {
            if (choice.fail) {
                if (choice.fail.health) {
                    const healthChange = getRandomInRange(choice.fail.health);
                    const newHealth = Math.min(maxHealth, Math.max(0, health + healthChange));
                    setStats(newHealth, hunger, cold, money);
                    addLogEntry(`🎲 Событие: ${event.name} – здоровье ${healthChange > 0 ? '+' : ''}${healthChange}`, 'event');
                }
                if (choice.fail.cold) {
                    const coldChange = getRandomInRange(choice.fail.cold);
                    const newCold = Math.min(maxCold, Math.max(0, cold + coldChange));
                    setStats(health, hunger, newCold, money);
                    addLogEntry(`🎲 Событие: ${event.name} – тепло ${coldChange > 0 ? '+' : ''}${coldChange}`, 'event');
                }
                if (choice.fail.money) {
                    const moneyChange = getRandomInRange(choice.fail.money);
                    const newMoney = money + moneyChange;
                    setStats(health, hunger, cold, newMoney);
                    addLogEntry(`🎲 Событие: ${event.name} – потеряно ${-moneyChange}₽`, 'event');
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
    let possibleEvents = Object.values(eventsDB).filter(event => event.trigger === triggerType);
    
    if (triggerType === 'location') {
        possibleEvents = possibleEvents.filter(event => event.locationId === context.locationId);
    }
    if (triggerType === 'weather') {
        possibleEvents = possibleEvents.filter(event => event.weatherCondition === context.weather);
    }
    
    if (possibleEvents.length === 0) return false;
    
    for (const event of possibleEvents) {
        if (Math.random() < event.chance) {
            await showEventModal(event, () => {
                console.log(`Событие ${event.id} завершено`);
            });
            return true;
        }
    }
    return false;
}
