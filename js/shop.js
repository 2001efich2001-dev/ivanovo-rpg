import { money, inventory, health, hunger, cold, setStats } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

// Цены продажи (50% от цены покупки, но не менее 1)
function getSellPrice(itemId) {
    const item = itemsDB[itemId];
    if (!item) return 0;
    return Math.max(1, Math.floor(item.price / 2));
}

// Рендер вкладки "Купить"
export function renderShopBuyTab() {
    const container = document.getElementById('shopBuyTab');
    if (!container) return;
    
    const items = Object.values(itemsDB).filter(item => item.price > 0);
    let html = '';
    items.forEach(item => {
        html += `
            <div class="inventory-item">
                <div class="item-info">
                    <span class="item-icon">${item.icon}</span>
                    <span class="item-name">${item.name}</span>
                    <span class="item-count">${item.price} ₽</span>
                </div>
                <button class="buy-btn" data-id="${item.id}">Купить</button>
            </div>
        `;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await buyItem(itemId);
        });
    });
}

// Рендер вкладки "Продать" (только предметы, которые есть в инвентаре)
export function renderShopSellTab() {
    const container = document.getElementById('shopSellTab');
    if (!container) return;
    
    const sellable = inventory.filter(item => {
        const dbItem = itemsDB[item.id];
        return dbItem && dbItem.price > 0;
    });
    
    if (sellable.length === 0) {
        container.innerHTML = '<p style="text-align:center;">Нет предметов для продажи</p>';
        return;
    }
    
    let html = '';
    sellable.forEach(item => {
        const dbItem = itemsDB[item.id];
        const sellPrice = getSellPrice(item.id);
        html += `
            <div class="inventory-item">
                <div class="item-info">
                    <span class="item-icon">${dbItem.icon}</span>
                    <span class="item-name">${dbItem.name}</span>
                    <span class="item-count">×${item.count} | ${sellPrice} ₽/шт</span>
                </div>
                <button class="sell-btn" data-id="${item.id}">Продать</button>
            </div>
        `;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.sell-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            await sellItem(itemId);
        });
    });
}

// Покупка предмета
async function buyItem(itemId) {
    const item = itemsDB[itemId];
    if (!item) return;
    
    if (money >= item.price) {
        const newMoney = money - item.price;
        const idx = inventory.findIndex(i => i.id === itemId);
        if (idx !== -1) {
            inventory[idx].count++;
        } else {
            inventory.push({ id: itemId, count: 1 });
        }
        setStats(health, hunger, cold, newMoney);
        await saveGameData();
        showMessage(`✅ Куплено: ${item.name}`, '#4caf50');
        // Обновляем вкладку продажи (так как инвентарь изменился)
        renderShopSellTab();
    } else {
        showMessage(`❌ Не хватает денег! Нужно ${item.price}₽`, '#e74c3c');
    }
}

// Продажа предмета
async function sellItem(itemId) {
    const idx = inventory.findIndex(i => i.id === itemId);
    if (idx === -1 || inventory[idx].count <= 0) {
        showMessage(`Нет предмета для продажи`, '#e74c3c');
        return;
    }
    
    const item = itemsDB[itemId];
    const sellPrice = getSellPrice(itemId);
    const newMoney = money + sellPrice;
    
    if (inventory[idx].count === 1) {
        inventory.splice(idx, 1);
    } else {
        inventory[idx].count--;
    }
    
    setStats(health, hunger, cold, newMoney);
    await saveGameData();
    showMessage(`💰 Продано: ${item.name} за ${sellPrice}₽`, '#4caf50');
    renderShopSellTab(); // обновляем список продажи
}
