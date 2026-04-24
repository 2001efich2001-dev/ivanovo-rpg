import { inventory, equipped, health, hunger, cold, money, maxHealth, maxHunger, maxCold, updateUI, setStats } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

//  База предметов (справочник)
export const itemsDB = {
    bread: { id: "bread", name: "Буханка хлеба", type: "food", icon: "🍞", effect: { hunger: 20, health: 0, cold: 0 }, price: 25, slot: null },
    vodka: { id: "vodka", name: "Водка", type: "alcohol", icon: "🍾", effect: { hunger: -10, health: 15, cold: 0 }, price: 40, slot: null },
    cigarettes: { id: "cigarettes", name: "Сигареты", type: "drug", icon: "🚬", effect: { hunger: 0, health: -5, cold: 10 }, price: 20, slot: null },
    medkit: { id: "medkit", name: "Аптечка", type: "medicine", icon: "💊", effect: { hunger: 0, health: 30, cold: 0 }, price: 50, slot: null },
    water: { id: "water", name: "Бутылка воды", type: "drink", icon: "💧", effect: { hunger: 10, health: 0, cold: 0 }, price: 15, slot: null },
    ushanka: { id: "ushanka", name: "Шапка-ушанка", type: "clothes", icon: "🧢", effect: { cold: 15 }, price: 80, slot: "head" },
    puhovik: { id: "puhovik", name: "Пуховик", type: "clothes", icon: "🧥", effect: { cold: 25 }, price: 200, slot: "body" },
    termo: { id: "termo", name: "Термобельё", type: "clothes", icon: "👖", effect: { cold: 10 }, price: 120, slot: "legs" },
    bercy: { id: "bercy", name: "Берцы", type: "clothes", icon: "👢", effect: { cold: 10 }, price: 150, slot: "feet" },
    empty_bottle: { id: "empty_bottle", name: "Пустая бутылка", type: "junk", icon: "🍾", effect: {}, price: 5, slot: null },
    old_hat: { id: "old_hat", name: "Старая шапка", type: "clothes", icon: "🧢", effect: { cold: 5 }, price: 20, slot: "head" }
};

export function recalcColdFromEquipment() {
    let bonus = 0;
    if (equipped.head && itemsDB[equipped.head]) bonus += itemsDB[equipped.head].effect.cold || 0;
    if (equipped.body && itemsDB[equipped.body]) bonus += itemsDB[equipped.body].effect.cold || 0;
    if (equipped.legs && itemsDB[equipped.legs]) bonus += itemsDB[equipped.legs].effect.cold || 0;
    if (equipped.feet && itemsDB[equipped.feet]) bonus += itemsDB[equipped.feet].effect.cold || 0;
    // cold – глобальная переменная, но её изменение должно проходить через setStats
    const newCold = Math.min(maxCold, 100 + bonus);
    if (newCold !== cold) {
        // обновляем cold в gameState (прямое присвоение нежелательно, но пока так)
        // В реальности нужно изменить gameState, но для простоты сделаем так:
        import('./gameState.js').then(module => {
            module.cold = newCold;
            module.updateUI();
        });
    }
}

async function useItem(itemId) {
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || inventory[itemIndex].count <= 0) { showMessage("Нет предмета!", "#e74c3c"); return; }
    const itemData = itemsDB[itemId];
    if (!itemData) return;
    let effText = "";
    if (itemData.effect.hunger) {
        let newHunger = hunger + itemData.effect.hunger;
        setStats(health, Math.min(maxHunger, Math.max(0, newHunger)), cold, money);
        effText += `Голод ${itemData.effect.hunger>0?'+':''}${itemData.effect.hunger}. `;
    }
    if (itemData.effect.health) {
        let newHealth = health + itemData.effect.health;
        setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
        effText += `Здоровье ${itemData.effect.health>0?'+':''}${itemData.effect.health}. `;
    }
    if (itemData.effect.cold) {
        let newCold = cold + itemData.effect.cold;
        setStats(health, hunger, Math.min(maxCold, Math.max(0, newCold)), money);
        effText += `Тепло ${itemData.effect.cold>0?'+':''}${itemData.effect.cold}. `;
    }
    if (inventory[itemIndex].count === 1) inventory.splice(itemIndex,1);
    else inventory[itemIndex].count--;
    updateUI();
    await saveGameData();
    renderItemsTab(); renderEquipmentTab();
    showMessage(`🍺 Использовали ${itemData.name}. ${effText}`, "#4caf50");
}

async function equipItem(itemId) {
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || inventory[itemIndex].count <= 0) { showMessage("Нет предмета!", "#e74c3c"); return; }
    const itemData = itemsDB[itemId];
    if (!itemData || !itemData.slot) { showMessage("Нельзя надеть!", "#e74c3c"); return; }
    const slot = itemData.slot;
    if (equipped[slot]) {
        const oldId = equipped[slot];
        const exist = inventory.findIndex(i => i.id === oldId);
        if (exist !== -1) inventory[exist].count++;
        else inventory.push({ id: oldId, count: 1 });
    }
    equipped[slot] = itemId;
    if (inventory[itemIndex].count === 1) inventory.splice(itemIndex,1);
    else inventory[itemIndex].count--;
    await saveGameData();
    recalcColdFromEquipment();
    renderItemsTab(); renderEquipmentTab();
    showMessage(`👕 Надели ${itemData.name}`, "#4caf50");
}

async function unequipItem(slot) {
    const itemId = equipped[slot];
    if (!itemId) return;
    const itemData = itemsDB[itemId];
    const exist = inventory.findIndex(i => i.id === itemId);
    if (exist !== -1) inventory[exist].count++;
    else inventory.push({ id: itemId, count: 1 });
    equipped[slot] = null;
    await saveGameData();
    recalcColdFromEquipment();
    renderItemsTab(); renderEquipmentTab();
    showMessage(`🧥 Сняли ${itemData.name}`, "#6c757d");
}

export function renderItemsTab() {
    const itemsTab = document.getElementById('itemsTab');
    if (!itemsTab) return;
    const usable = inventory.filter(i => { const d = itemsDB[i.id]; return d && (d.type === 'food' || d.type === 'alcohol' || d.type === 'drug' || d.type === 'medicine' || d.type === 'drink'); });
    const equipable = inventory.filter(i => { const d = itemsDB[i.id]; return d && d.type === 'clothes'; });
    if (usable.length === 0 && equipable.length === 0) { itemsTab.innerHTML = '<p style="text-align:center;">🧺 Инвентарь пуст</p>'; return; }
    let html = '';
    if (usable.length) { html += '<div><strong>📦 Расходуемые</strong></div>'; usable.forEach(i => { const d = itemsDB[i.id]; html += `<div class="inventory-item"><div class="item-info"><span class="item-icon">${d.icon}</span><span class="item-name">${d.name}</span><span class="item-count">×${i.count}</span></div><button class="use-btn" data-id="${i.id}">Использовать</button></div>`; }); }
    if (equipable.length) { html += '<div style="margin-top:12px;"><strong>👔 Одежда</strong></div>'; equipable.forEach(i => { const d = itemsDB[i.id]; html += `<div class="inventory-item"><div class="item-info"><span class="item-icon">${d.icon}</span><span class="item-name">${d.name}</span><span class="item-count">×${i.count}</span></div><button class="equip-btn" data-id="${i.id}">Надеть</button></div>`; }); }
    itemsTab.innerHTML = html;
    document.querySelectorAll('.use-btn').forEach(btn => { btn.addEventListener('click', () => useItem(btn.dataset.id)); });
    document.querySelectorAll('.equip-btn').forEach(btn => { btn.addEventListener('click', () => equipItem(btn.dataset.id)); });
}

export function renderEquipmentTab() {
    const eqTab = document.getElementById('equipmentTab');
    if (!eqTab) return;
    const slots = [
        { key: 'head', name: 'Головной убор', icon: '🧢' },
        { key: 'body', name: 'Верх', icon: '🧥' },
        { key: 'legs', name: 'Штаны', icon: '👖' },
        { key: 'feet', name: 'Обувь', icon: '👢' }
    ];
    let html = '';
    for (let s of slots) {
        const itemId = equipped[s.key];
        const data = itemId ? itemsDB[itemId] : null;
        html += `<div class="slot"><div class="slot-info"><span class="slot-icon">${s.icon}</span><span class="slot-name">${s.name}</span>${data ? `<span class="item-name">${data.name}</span>` : `<span class="slot-empty">— пусто —</span>`}</div>${data ? `<button class="unequip-btn" data-slot="${s.key}">Снять</button>` : ''}</div>`;
    }
    eqTab.innerHTML = html;
    document.querySelectorAll('.unequip-btn').forEach(btn => { btn.addEventListener('click', () => unequipItem(btn.dataset.slot)); });
}
