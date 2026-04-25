import { inventory, health, hunger, cold, money, maxHealth, maxHunger, maxCold, setStats, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

// Локальный вызов звука (через глобальную функцию из main.js)
function playClick() {
    if (typeof window.playClickSound === 'function') window.playClickSound();
}

// База локаций с фонами, зонами и действиями
export const locationsDB = {
    railway: {
        id: "railway",
        name: "Вокзал",
        description: "Шум, люди, поезда. Можно попросить подаяние или поискать забытые вещи.",
        bgImage: "images/railway_bg.jpg",
        zones: [
            { id: "beg_zone", name: "Площадь у вокзала", cx: 150, cy: 200, r: 50, actionId: "beg" },
            { id: "search_zone", name: "Зал ожидания", cx: 400, cy: 180, r: 45, actionId: "search" }
        ],
        actions: [
            { id: "beg", name: "Попросить подаяние", desc: "Риск: 30% получить отказ", effect: { money: [10, 50] }, risk: 30, riskEffect: { money: -10, health: -5 } },
            { id: "search", name: "Поискать забытые вещи", desc: "Риск: 20% найти мусор", effect: { items: ["bread", "water"] }, risk: 20, riskEffect: { health: -10, hunger: -5 } }
        ]
    },
    market: {
        id: "market",
        name: "Рынок",
        description: "Оживлённое место, можно обменять вещи или украсть еду.",
        bgImage: "images/market_bg.jpg",
        zones: [
            { id: "trade_zone", name: "Прилавок", cx: 200, cy: 150, r: 50, actionId: "trade" },
            { id: "steal_zone", name: "Лотки с едой", cx: 450, cy: 200, r: 55, actionId: "steal" }
        ],
        actions: [
            { id: "trade", name: "Обменять пустые бутылки", desc: "Требуется пустая бутылка", needsItem: "empty_bottle", effect: { money: [5, 15] }, risk: 0 },
            { id: "steal", name: "Украсть еду", desc: "Риск: 50% поймают", effect: { items: ["bread"] }, risk: 50, riskEffect: { money: -30, health: -15 } }
        ]
    },
    shelter: {
        id: "shelter",
        name: "Ночлежка",
        description: "Тёплое место для ночлега.",
        bgImage: "images/shelter_bg.jpg",
        zones: [
            { id: "sleep_zone", name: "Койка", cx: 250, cy: 180, r: 60, actionId: "sleep" },
            { id: "eat_zone", name: "Столовая", cx: 400, cy: 220, r: 45, actionId: "eat" }
        ],
        actions: [
            { id: "sleep", name: "Переночевать", desc: "Восстановить здоровье за 20₽", effect: { health: 30 }, cost: 20, risk: 0 },
            { id: "eat", name: "Поесть в столовой", desc: "Восстановить голод за 25₽", effect: { hunger: 30 }, cost: 25, risk: 0 }
        ]
    },
    dump: {
        id: "dump",
        name: "Свалка",
        description: "Опасно, но можно найти ценные вещи.",
        bgImage: "images/dump_bg.jpg",
        zones: [
            { id: "scavenge_zone", name: "Куча мусора", cx: 200, cy: 200, r: 70, actionId: "scavenge" }
        ],
        actions: [
            { id: "scavenge", name: "Покопаться в мусоре", desc: "Риск: 40% получить инфекцию", effect: { items: ["empty_bottle", "old_hat"] }, risk: 40, riskEffect: { health: -15, hunger: -5 } }
        ]
    },
    church: {
        id: "church",
        name: "Церковь",
        description: "Место покоя. Можно помолиться или попросить еду.",
        bgImage: "images/church_bg.jpg",
        zones: [
            { id: "pray_zone", name: "Алтарь", cx: 200, cy: 150, r: 60, actionId: "pray" },
            { id: "food_zone", name: "Трапезная", cx: 450, cy: 180, r: 50, actionId: "get_food" }
        ],
        actions: [
            { id: "pray", name: "Помолиться", desc: "Восстановить здоровье", effect: { health: 20 }, cost: 0, risk: 0 },
            { id: "get_food", name: "Попросить еду", desc: "Дадут хлеб", effect: { items: ["bread"] }, risk: 0 }
        ]
    },
    bar: {
        id: "bar",
        name: "Бар",
        description: "Можно выпить, подраться или найти работу.",
        bgImage: "images/bar_bg.jpg",
        zones: [
            { id: "drink_zone", name: "Стойка", cx: 150, cy: 200, r: 50, actionId: "drink" },
            { id: "fight_zone", name: "Танцпол", cx: 400, cy: 220, r: 65, actionId: "fight" }
        ],
        actions: [
            { id: "drink", name: "Выпить водку", desc: "Здоровье +10, голод -5, деньги -40", effect: { health: 10, hunger: -5, money: -40 }, risk: 0 },
            { id: "fight", name: "Подраться", desc: "Риск: 50% получить травму", effect: { money: [20, 100] }, risk: 50, riskEffect: { health: -20 } }
        ]
    }
};

// Функция для отрисовки локации на главном экране
export function renderLocation(locationId) {
    const loc = locationsDB[locationId];
    if (!loc) {
        console.error(`Локация ${locationId} не найдена`);
        return;
    }
    
    // Меняем фоновое изображение
    const bgImg = document.getElementById('locationBgImg');
    if (bgImg) {
        bgImg.src = loc.bgImage || 'images/default_bg.jpg';
    }
    
    // Меняем название локации
    const locName = document.getElementById('locationName');
    if (locName) {
        locName.textContent = loc.name;
    }
    
    // Отрисовываем кликабельные зоны
    const zonesContainer = document.getElementById('locationZones');
    if (!zonesContainer) return;
    
    // Создаём SVG с кругами
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.setAttribute("viewBox", "0 0 800 600");
svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // ← важно!
svg.style.width = "100%";
svg.style.height = "100%";
svg.style.position = "absolute";
svg.style.top = "0";
svg.style.left = "0";
svg.style.pointerEvents = "none";
    
    loc.zones.forEach(zone => {
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", zone.cx);
        circle.setAttribute("cy", zone.cy);
        circle.setAttribute("r", zone.r);
        circle.setAttribute("data-zone-id", zone.id);
        circle.setAttribute("data-action-id", zone.actionId);
        circle.setAttribute("data-location-id", locationId);
        circle.setAttribute("data-name", zone.name);
        circle.style.pointerEvents = "visible";
        circle.style.cursor = "pointer";
        circle.style.fill = "rgba(0, 200, 0, 0.25)";
        circle.style.stroke = "rgba(0, 200, 0, 0.6)";
        circle.style.strokeWidth = "2";
        circle.style.transition = "fill 0.1s, stroke 0.1s";
        
        circle.addEventListener('mouseenter', (e) => {
            circle.style.fill = "rgba(0, 200, 0, 0.5)";
            circle.style.stroke = "rgba(0, 200, 0, 1)";
            showTooltip(e, zone.name);
        });
        circle.addEventListener('mouseleave', () => {
            circle.style.fill = "rgba(0, 200, 0, 0.25)";
            circle.style.stroke = "rgba(0, 200, 0, 0.6)";
            hideTooltip();
        });
        circle.addEventListener('click', () => {
            playClick();
            const action = loc.actions.find(a => a.id === zone.actionId);
            if (action) {
                executeAction(locationId, action);
            } else {
                showMessage(`Действие для "${zone.name}" ещё не добавлено`, "#f0ad4e");
            }
        });
        
        svg.appendChild(circle);
    });
    
    // Очищаем контейнер и добавляем новый SVG
    zonesContainer.innerHTML = '';
    zonesContainer.appendChild(svg);
}

// Всплывающая подсказка
let tooltipElement = null;
function showTooltip(event, text) {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'location-tooltip';
        document.body.appendChild(tooltipElement);
    }
    tooltipElement.textContent = text;
    tooltipElement.style.display = 'block';
    tooltipElement.style.left = event.clientX + 15 + 'px';
    tooltipElement.style.top = event.clientY - 30 + 'px';
}
function hideTooltip() {
    if (tooltipElement) tooltipElement.style.display = 'none';
}

// Функции для действий (executeAction и openLocationModal остаются без изменений, они уже есть)
async function executeAction(locationId, action) {
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
