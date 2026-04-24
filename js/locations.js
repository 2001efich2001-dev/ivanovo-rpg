import { inventory, health, hunger, cold, money, maxHealth, maxHunger, maxCold, setStats, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';


export const locationsDB = {
    railway: {
        id: "railway", name: "Вокзал", description: "Шум, люди, поезда. Можно попросить подаяние или поискать забытые вещи.",
        actions: [
            { id: "beg", name: "Попросить подаяние", desc: "Риск: 30% получить отказ", effect: { money: [10, 50] }, risk: 30, riskEffect: { money: -10, health: -5 } },
            { id: "search", name: "Поискать забытые вещи", desc: "Риск: 20% найти мусор", effect: { items: ["bread", "water"] }, risk: 20, riskEffect: { health: -10, hunger: -5 } }
        ]
    },
    market: {
        id: "market", name: "Рынок", description: "Оживлённое место, можно обменять вещи или украсть еду.",
        actions: [
            { id: "trade", name: "Обменять пустые бутылки", desc: "Требуется пустая бутылка", needsItem: "empty_bottle", effect: { money: [5, 15] }, risk: 0 },
            { id: "steal", name: "Украсть еду", desc: "Риск: 50% поймают", effect: { items: ["bread"] }, risk: 50, riskEffect: { money: -30, health: -15 } }
        ]
    },
    shelter: {
        id: "shelter", name: "Ночлежка", description: "Тёплое место для ночлега.",
        actions: [
            { id: "sleep", name: "Переночевать", desc: "Восстановить здоровье за 20₽", effect: { health: 30 }, cost: 20, risk: 0 },
            { id: "eat", name: "Поесть в столовой", desc: "Восстановить голод за 25₽", effect: { hunger: 30 }, cost: 25, risk: 0 }
        ]
    },
    dump: {
        id: "dump", name: "Свалка", description: "Опасно, но можно найти ценные вещи.",
        actions: [
            { id: "scavenge", name: "Покопаться в мусоре", desc: "Риск: 40% получить инфекцию", effect: { items: ["empty_bottle", "old_hat"] }, risk: 40, riskEffect: { health: -15, hunger: -5 } }
        ]
    },
    church: {
        id: "church", name: "Церковь", description: "Место покоя.",
        actions: [
            { id: "pray", name: "Помолиться", desc: "Восстановить здоровье", effect: { health: 20 }, cost: 0, risk: 0 },
            { id: "get_food", name: "Попросить еду", desc: "Дадут хлеб", effect: { items: ["bread"] }, risk: 0 }
        ]
    },
    bar: {
        id: "bar", name: "Бар", description: "Можно выпить, подраться или найти работу.",
        actions: [
            { id: "drink", name: "Выпить водку", desc: "Здоровье +10, голод -5, деньги -40", effect: { health: 10, hunger: -5, money: -40 }, risk: 0 },
            { id: "fight", name: "Подраться", desc: "Риск: 50% получить травму", effect: { money: [20, 100] }, risk: 50, riskEffect: { health: -20 } }
        ]
    }
};

async function executeAction(locationId, action) {
    // в начале функции executeAction:
    playClick();
    let success = true;
    let msg = "";
    if (action.needsItem) {
        const has = inventory.find(i => i.id === action.needsItem && i.count > 0);
        if (!has) { showMessage(`Нет ${itemsDB[action.needsItem]?.name || action.needsItem}`, "#e74c3c"); return; }
    }
    if (action.cost && action.cost > 0) {
        if (money < action.cost) { showMessage(`Не хватает ${action.cost}₽`, "#e74c3c"); return; }
        setStats(health, hunger, cold, money - action.cost);
    }
    if (action.risk && action.risk > 0) {
        if (Math.random() * 100 < action.risk) {
            success = false;
            msg = "❌ Неудача! ";
            if (action.riskEffect) {
                let newMoney = money + (action.riskEffect.money || 0);
                let newHealth = health + (action.riskEffect.health || 0);
                let newHunger = hunger + (action.riskEffect.hunger || 0);
                setStats(Math.min(maxHealth, Math.max(0, newHealth)), Math.min(maxHunger, Math.max(0, newHunger)), cold, Math.max(0, newMoney));
                msg += `${action.riskEffect.health ? `Здоровье ${action.riskEffect.health>0?'+':''}${action.riskEffect.health}. ` : ''}${action.riskEffect.money ? `Деньги ${action.riskEffect.money>0?'+':''}${action.riskEffect.money}. ` : ''}`;
            }
        }
    }
    if (success) {
        msg = "✅ Успех! ";
        if (action.effect) {
            if (action.effect.money) {
                let add = Array.isArray(action.effect.money) ? Math.floor(Math.random()*(action.effect.money[1]-action.effect.money[0]+1)+action.effect.money[0]) : action.effect.money;
                setStats(health, hunger, cold, money + add);
                msg += `+${add}₽. `;
            }
            if (action.effect.health) {
                let add = Array.isArray(action.effect.health) ? Math.floor(Math.random()*(action.effect.health[1]-action.effect.health[0]+1)+action.effect.health[0]) : action.effect.health;
                let newHealth = health + add;
                setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
                msg += `Здоровье ${add>0?'+':''}${add}. `;
            }
            if (action.effect.hunger) {
                let add = Array.isArray(action.effect.hunger) ? Math.floor(Math.random()*(action.effect.hunger[1]-action.effect.hunger[0]+1)+action.effect.hunger[0]) : action.effect.hunger;
                let newHunger = hunger + add;
                setStats(health, Math.min(maxHunger, Math.max(0, newHunger)), cold, money);
                msg += `Голод ${add>0?'+':''}${add}. `;
            }
            if (action.effect.items) {
                let items = Array.isArray(action.effect.items) ? action.effect.items : [action.effect.items];
                items.forEach(it => {
                    const idx = inventory.findIndex(i => i.id === it);
                    if (idx !== -1) inventory[idx].count++;
                    else inventory.push({ id: it, count: 1 });
                    msg += `+1 ${itemsDB[it]?.name}. `;
                });
            }
        }
        if (action.needsItem) {
            const idx = inventory.findIndex(i => i.id === action.needsItem);
            if (idx !== -1) {
                if (inventory[idx].count === 1) inventory.splice(idx,1);
                else inventory[idx].count--;
                msg += `Израсходован ${itemsDB[action.needsItem]?.name}. `;
            }
        }
    }
    updateUI();
    await saveGameData();
    showMessage(msg, success ? "#4caf50" : "#e74c3c");
    document.getElementById('locationModal').style.display = 'none';
    // обновить инвентарь, если окно открыто
    if (document.getElementById('inventoryModal').style.display === 'flex') {
        import('./inventory.js').then(m => { m.renderItemsTab(); m.renderEquipmentTab(); });
    }
}

export function openLocationModal(locationId) {
    const loc = locationsDB[locationId];
    if (!loc) return;
    const modalContent = document.getElementById('locationModalContent');
    modalContent.innerHTML = `
        <h3>${loc.name}</h3>
        <p>${loc.description}</p>
        <div class="inventory-grid">
            ${loc.actions.map(a => `
                <div class="inventory-item" style="margin-bottom:8px;">
                    <div class="item-info"><div><strong>${a.name}</strong><br><small>${a.desc}</small></div></div>
                    <button class="action-location-btn" data-location="${locationId}" data-action-id="${a.id}">Выбрать</button>
                </div>
            `).join('')}
        </div>
        <button class="close-modal">Закрыть</button>
    `;
    document.getElementById('locationModal').style.display = 'flex';
    document.querySelectorAll('.action-location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const locId = btn.dataset.location;
            const actId = btn.dataset.actionId;
            const act = locationsDB[locId].actions.find(a => a.id === actId);
            if (act) executeAction(locId, act);
        });
    });
    document.querySelector('#locationModal .close-modal').addEventListener('click', () => {
        document.getElementById('locationModal').style.display = 'none';
    });
}
