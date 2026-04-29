import { inventory, equipped, health, hunger, cold, money, maxHealth, maxHunger, maxCold, updateUI, setStats } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction } from './utils.js';

// Переменные для пагинации
let currentPage = 0;
const ITEMS_PER_PAGE = 20;

function playClick() {
    if (typeof window.playClickSound === 'function') window.playClickSound();
}
function playPurchase() {
    if (typeof window.playPurchaseSound === 'function') window.playPurchaseSound();
}

// Добавляем поле image для каждого предмета
export const itemsDB = {
    bread: { id: "bread", name: "Буханка хлеба", type: "food", icon: "🍞", image: "images/items/bread.png", effect: { hunger: 20, health: 0, cold: 0 }, price: 25, slot: null, description: "Восстанавливает 20 голода" },
    vodka: { id: "vodka", name: "Водка", type: "alcohol", icon: "🍾", image: "images/items/vodka.png", effect: { hunger: -10, health: 15, cold: 0 }, price: 40, slot: null, description: "+15 здоровья, -10 голода" },
    cigarettes: { id: "cigarettes", name: "Сигареты", type: "drug", icon: "🚬", image: "images/items/cigarettes.png", effect: { hunger: 0, health: -5, cold: 10 }, price: 20, slot: null, description: "+10 тепла, -5 здоровья" },
    medkit: { id: "medkit", name: "Аптечка", type: "medicine", icon: "💊", image: "images/items/medkit.png", effect: { hunger: 0, health: 30, cold: 0 }, price: 50, slot: null, description: "Восстанавливает 30 здоровья" },
    water: { id: "water", name: "Бутылка воды", type: "drink", icon: "💧", image: "images/items/water.png", effect: { hunger: 10, health: 0, cold: 0 }, price: 15, slot: null, description: "Восстанавливает 10 голода" },
    ushanka: { id: "ushanka", name: "Шапка-ушанка", type: "clothes", icon: "🧢", image: "images/items/ushanka.png", effect: { cold: 15 }, price: 80, slot: "head", description: "+15 к теплу" },
    puhovik: { id: "puhovik", name: "Пуховик", type: "clothes", icon: "🧥", image: "images/items/puhovik.png", effect: { cold: 25 }, price: 200, slot: "body", description: "+25 к теплу" },
    termo: { id: "termo", name: "Термобельё", type: "clothes", icon: "👖", image: "images/items/termo.png", effect: { cold: 10 }, price: 120, slot: "legs", description: "+10 к теплу" },
    bercy: { id: "bercy", name: "Берцы", type: "clothes", icon: "👢", image: "images/items/bercy.png", effect: { cold: 10 }, price: 150, slot: "feet", description: "+10 к теплу" },
    empty_bottle: { id: "empty_bottle", name: "Пустая бутылка", type: "junk", icon: "🍾", image: "images/items/empty_bottle.png", effect: {}, price: 5, slot: null, description: "Можно продать за 5₽" },
    old_hat: { id: "old_hat", name: "Старая шапка", type: "clothes", icon: "🧢", image: "images/items/old_hat.png", effect: { cold: 5 }, price: 20, slot: "head", description: "+5 к теплу" }
};

// Функция для получения цены продажи
function getSellPrice(itemId) {
    const item = itemsDB[itemId];
    if (!item) return 0;
    return Math.max(1, Math.floor(item.price / 2));
}

// Функция для показа тултипа
let activeTooltip = null;

function showTooltip(item, event, count) {
    hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    
    const sellPrice = getSellPrice(item.id);
    
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${item.name}</strong>
        </div>
        <div class="tooltip-content">
            ${item.description || ''}
            ${item.effect.hunger ? `<div>🍗 Голод: ${item.effect.hunger > 0 ? '+' : ''}${item.effect.hunger}</div>` : ''}
            ${item.effect.health ? `<div>❤️ Здоровье: ${item.effect.health > 0 ? '+' : ''}${item.effect.health}</div>` : ''}
            ${item.effect.cold ? `<div>🔥 Тепло: ${item.effect.cold > 0 ? '+' : ''}${item.effect.cold}</div>` : ''}
            <div class="tooltip-divider"></div>
            <div>💰 Покупка: ${item.price}₽</div>
            <div>💸 Продажа: ${sellPrice}₽</div>
            ${count > 1 ? `<div>📦 В наличии: ${count} шт.</div>` : ''}
        </div>
    `;
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    tooltip.style.zIndex = '10001';
    
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
}

function hideTooltip() {
    if (activeTooltip && activeTooltip.remove) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

// Функция для рендера сетки инвентаря
export function renderItemsTab() {
    const itemsTab = document.getElementById('itemsTab');
    if (!itemsTab) return;
    
    // Собираем ВСЕ предметы в один массив (и расходуемые, и одежда)
    const allItems = [];
    for (const invItem of inventory) {
        const itemData = itemsDB[invItem.id];
        if (itemData) {
            allItems.push({
                ...invItem,
                ...itemData
            });
        }
    }
    
    if (allItems.length === 0) {
        itemsTab.innerHTML = '<div class="empty-inventory">🧺 Инвентарь пуст</div>';
        return;
    }
    
    // Пагинация
    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = allItems.slice(start, end);
    
    // Создаём сетку
    let html = `<div class="inventory-grid-header">
        <span>🎒 Инвентарь</span>
        <span>Страница ${currentPage + 1} / ${Math.max(1, totalPages)}</span>
    </div>`;
    
    html += '<div class="inventory-grid">';
    
    // Заполняем ячейки
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
        const item = pageItems[i];
        
        if (item) {
            const itemType = item.type === 'clothes' ? 'clothes' : 'usable';
            html += `
                <div class="inventory-slot ${itemType}" data-id="${item.id}" data-name="${item.name}">
                    <img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy">
                    <span class="item-count">×${item.count}</span>
                    <div class="item-actions">
                        <button class="slot-use-btn" data-id="${item.id}">${item.type === 'clothes' ? '👕' : '🔨'}</button>
                    </div>
                </div>
            `;
        } else {
            // Пустая ячейка
            html += `<div class="inventory-slot empty-slot">🔲</div>`;
        }
    }
    
    html += '</div>';
    
    // Кнопки пагинации
    if (totalPages > 1) {
        html += `<div class="inventory-pagination">
            <button class="page-btn" id="prevPageBtn" ${currentPage === 0 ? 'disabled' : ''}>◀ Назад</button>
            <span class="page-info">${currentPage + 1} / ${totalPages}</span>
            <button class="page-btn" id="nextPageBtn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Вперед ▶</button>
        </div>`;
    }
    
    itemsTab.innerHTML = html;
    
    // Добавляем обработчики для кнопок использования/надевания
    document.querySelectorAll('.slot-use-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            const itemData = itemsDB[itemId];
            if (itemData && itemData.type === 'clothes') {
                await equipItem(itemId);
            } else {
                await useItem(itemId);
            }
        });
    });
    
    // Добавляем обработчики для тултипов
    document.querySelectorAll('.inventory-slot:not(.empty-slot)').forEach(slot => {
        const itemId = slot.dataset.id;
        const itemData = itemsDB[itemId];
        const count = parseInt(slot.querySelector('.item-count')?.textContent?.replace('×', '') || '1');
        
        slot.addEventListener('mouseenter', (e) => {
            if (itemData) showTooltip(itemData, e, count);
        });
        slot.addEventListener('mouseleave', hideTooltip);
        slot.addEventListener('mousemove', (e) => {
            if (activeTooltip) {
                activeTooltip.style.left = (e.clientX + 15) + 'px';
                activeTooltip.style.top = (e.clientY + 15) + 'px';
            }
        });
    });
    
    // Обработчики пагинации
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                renderItemsTab();
                renderEquipmentTab();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                currentPage++;
                renderItemsTab();
                renderEquipmentTab();
            }
        });
    }
}

// Функции useItem, equipItem, unequipItem остаются без изменений
async function useItem(itemId) {
    playClick();
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
    renderItemsTab();
    renderEquipmentTab();
    showMessage(`🍺 Использовали ${itemData.name}. ${effText}`, "#4caf50");
    logAction(`Использован предмет: ${itemData.name} (${effText.trim()})`, 'item');
}

async function equipItem(itemId) {
    playClick();
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || inventory[itemIndex].count <= 0) { showMessage("Нет предмета!", "#e74c3c"); return; }
    const itemData = itemsDB[itemId];
    if (!itemData || !itemData.slot) { showMessage("Нельзя надеть!", "#e74c3c"); return; }
    const slot = itemData.slot;
    if (equipped[slot]) {
        const oldId = equipped[slot];
        const oldItemData = itemsDB[oldId];
        if (oldItemData && oldItemData.effect.cold) {
            const newCold = Math.min(maxCold, Math.max(0, cold - oldItemData.effect.cold));
            setStats(health, hunger, newCold, money);
        }
        const exist = inventory.findIndex(i => i.id === oldId);
        if (exist !== -1) inventory[exist].count++;
        else inventory.push({ id: oldId, count: 1 });
        logAction(`Снят предмет: ${oldItemData?.name}`, 'item');
    }
    equipped[slot] = itemId;
    if (inventory[itemIndex].count === 1) inventory.splice(itemIndex,1);
    else inventory[itemIndex].count--;
    
    if (itemData.effect.cold) {
        const newCold = Math.min(maxCold, Math.max(0, cold + itemData.effect.cold));
        setStats(health, hunger, newCold, money);
    }
    
    await saveGameData();
    renderItemsTab();
    renderEquipmentTab();
    showMessage(`👕 Надели ${itemData.name}`, "#4caf50");
    logAction(`Надет предмет: ${itemData.name}`, 'item');
}

async function unequipItem(slot) {
    playClick();
    const itemId = equipped[slot];
    if (!itemId) return;
    const itemData = itemsDB[itemId];
    
    if (itemData && itemData.effect.cold) {
        const newCold = Math.min(maxCold, Math.max(0, cold - itemData.effect.cold));
        setStats(health, hunger, newCold, money);
    }
    
    const exist = inventory.findIndex(i => i.id === itemId);
    if (exist !== -1) inventory[exist].count++;
    else inventory.push({ id: itemId, count: 1 });
    equipped[slot] = null;
    
    await saveGameData();
    renderItemsTab();
    renderEquipmentTab();
    showMessage(`🧥 Сняли ${itemData.name}`, "#6c757d");
    logAction(`Снят предмет: ${itemData.name}`, 'item');
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
    
    // Заголовок
    let html = `<div class="inventory-grid-header">
        <span>👕 Экипировка</span>
        <span>🎽 Снаряжение</span>
    </div>`;
    
    // Сетка для экипировки (4 слота, как у инвентаря)
    html += '<div class="equipment-grid">';
    
    for (let s of slots) {
        const itemId = equipped[s.key];
        const itemData = itemId ? itemsDB[itemId] : null;
        
        if (itemData) {
            // Занятый слот
            html += `
                <div class="equipment-slot occupied" data-slot="${s.key}">
                    <img src="${itemData.image}" alt="${itemData.name}" class="equipment-image" loading="lazy">
                    <span class="equipment-slot-name">${s.name}</span>
                    <span class="equipment-item-name">${itemData.name}</span>
                    <div class="equipment-effects">
                        ${itemData.effect.cold ? `<span>🔥 +${itemData.effect.cold}</span>` : ''}
                    </div>
                    <button class="unequip-btn" data-slot="${s.key}">Снять</button>
                </div>
            `;
        } else {
            // Пустой слот
            html += `
                <div class="equipment-slot empty" data-slot="${s.key}">
                    <div class="equipment-empty-icon">${s.icon}</div>
                    <span class="equipment-slot-name">${s.name}</span>
                    <span class="equipment-empty-text">— пусто —</span>
                    <span class="equipment-empty-hint">Наденьте предмет</span>
                </div>
            `;
        }
    }
    
    html += '</div>';
    
    // Добавляем бонусы от экипировки
    const totalColdBonus = calculateEquippedColdBonus();
    html += `<div class="equipment-total-bonus">
        🔥 Суммарный бонус тепла: <strong>+${totalColdBonus}</strong>
    </div>`;
    
    eqTab.innerHTML = html;
    
    // Добавляем обработчики для кнопок "Снять"
    document.querySelectorAll('.unequip-btn').forEach(btn => { 
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await unequipItem(btn.dataset.slot);
        });
    });
    
    // Добавляем возможность надеть предмет, перетащив из инвентаря? (пока просто клик)
    document.querySelectorAll('.equipment-slot.empty').forEach(slot => {
        slot.addEventListener('click', () => {
            showMessage('Сначала выберите предмет в инвентаре и нажмите "Надеть"', '#ffd966');
        });
    });
}

// Вспомогательная функция для подсчёта бонуса тепла от экипировки
function calculateEquippedColdBonus() {
    let bonus = 0;
    for (const slot of ['head', 'body', 'legs', 'feet']) {
        const itemId = equipped[slot];
        if (itemId && itemsDB[itemId] && itemsDB[itemId].effect.cold) {
            bonus += itemsDB[itemId].effect.cold;
        }
    }
    return bonus;
}

export function recalcColdFromEquipment() {
    console.warn("recalcColdFromEquipment устарела");
}

// Сброс пагинации при открытии инвентаря (для синхронизации)
export function resetInventoryPage() {
    currentPage = 0;
}
