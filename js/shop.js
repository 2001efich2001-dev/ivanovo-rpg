// js/shop.js
import { money, inventory, health, hunger, cold, setStats, markTutorialShown, isTutorialShown, tutorialEnabled, ownedAvatars, currentAvatar, setCurrentAvatar, ownedTitles, currentTitle, setCurrentTitle } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction, showTutorialTip } from './utils.js';

// Цены продажи (50% от цены покупки, но не менее 1)
function getSellPrice(itemId) {
    const item = itemsDB[itemId];
    if (!item) return 0;
    return Math.max(1, Math.floor(item.price / 2));
}

// Функция для обновления отображения денег в шапке магазина
function updateShopMoneyDisplay() {
    const moneySpan = document.getElementById('shopMoneyValue');
    if (moneySpan) {
        moneySpan.textContent = Math.floor(money);
    }
}

// ===== НОВАЯ ФУНКЦИЯ: принудительный перерендер сетки =====
function forceRepaintGrid(container) {
    if (!container) return;
    // Сохраняем текущий display
    const originalDisplay = container.style.display;
    // Меняем display для принудительного пересчёта
    container.style.display = 'none';
    container.offsetHeight; // триггерим reflow
    container.style.display = originalDisplay || 'grid';
    container.offsetHeight; // ещё один reflow для надёжности
}

// Показать тултип
let activeTooltip = null;

function showTooltip(item, event) {
    hideTooltip();
    
    const sellPrice = getSellPrice(item.id);
    
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${item.name}</strong>
        </div>
        <div class="tooltip-content">
            ${item.description || ''}
            ${item.effect?.hunger ? `<div>🍗 Голод: ${item.effect.hunger > 0 ? '+' : ''}${item.effect.hunger}</div>` : ''}
            ${item.effect?.health ? `<div>❤️ Здоровье: ${item.effect.health > 0 ? '+' : ''}${item.effect.health}</div>` : ''}
            ${item.effect?.cold ? `<div>🔥 Тепло: ${item.effect.cold > 0 ? '+' : ''}${item.effect.cold}</div>` : ''}
            ${item.effect?.energy ? `<div>⚡ Энергия: ${item.effect.energy > 0 ? '+' : ''}${item.effect.energy}</div>` : ''}
            <div class="tooltip-divider"></div>
            <div>💰 Покупка: ${item.price}₽</div>
            <div>💸 Продажа: ${sellPrice}₽</div>
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

// Рендер вкладки "Купить"
export function renderShopBuyTab() {
    const container = document.getElementById('shopBuyTab');
    if (!container) return;
    
    // Обновляем отображение денег
    updateShopMoneyDisplay();
    
    let html = '<div class="inventory-grid">';
    
    // ===== ОБЫЧНЫЕ ПРЕДМЕТЫ (не аватары) =====
    const items = Object.values(itemsDB).filter(item => 
        item.price > 0 && item.type !== 'avatar'
    );
    
    for (const item of items) {
        html += `
            <div class="inventory-slot" data-id="${item.id}" data-name="${item.name}">
                <img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${item.icon}%3C/text%3E%3C/svg%3E'">
                <span class="item-name">${item.name}</span>
                <span class="item-price">${item.price}₽</span>
                <div class="item-actions">
                    <button class="buy-btn shop-action-btn" data-id="${item.id}">Купить</button>
                </div>
            </div>
        `;
    }
    
    // ===== АВАТАРЫ =====
    const avatars = Object.values(itemsDB).filter(item => 
        item.type === 'avatar'
    );
    
    for (const avatar of avatars) {
        const isOwned = ownedAvatars && ownedAvatars.includes(avatar.id);
        const isActive = currentAvatar === avatar.id;
        
        html += `
            <div class="inventory-slot ${isOwned ? 'owned' : ''} ${isActive ? 'active' : ''}" data-id="${avatar.id}" data-name="${avatar.name}">
                <img src="${avatar.image}" alt="${avatar.name}" class="item-image" loading="lazy" 
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${avatar.icon}%3C/text%3E%3C/svg%3E'">
                <span class="item-name">${avatar.name}</span>
                ${isActive ? '<span class="item-owned">✅ Активен</span>' : (isOwned ? '<span class="item-owned">✅ Куплен</span>' : `<span class="item-price">${avatar.price}₽</span>`)}
                <div class="item-actions">
                    ${isOwned && !isActive ? `<button class="avatar-select-btn shop-action-btn" data-id="${avatar.id}" style="background: #2196F3;">Выбрать</button>` : ''}
                    ${!isOwned ? `<button class="buy-avatar-btn shop-action-btn" data-id="${avatar.id}" data-price="${avatar.price}">Купить</button>` : ''}
                    ${isActive ? `<button class="shop-action-btn" disabled style="opacity:0.5; background:#4caf50;">✅ Активен</button>` : ''}
                </div>
            </div>
        `;
    }
    
    // Заполняем пустые ячейки до 20 (5x4)
    const totalItems = items.length + avatars.length;
    const itemsPerPage = 20;
    const remainingSlots = itemsPerPage - (totalItems % itemsPerPage);
    if (remainingSlots < itemsPerPage) {
        for (let i = 0; i < remainingSlots; i++) {
            html += `<div class="inventory-slot empty-slot">🔲</div>`;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // ===== ОБРАБОТЧИКИ =====
    // Обычные предметы
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await buyItem(itemId);
        });
    });
    
    // Покупка аватара
    document.querySelectorAll('.buy-avatar-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            await buyAvatar(itemId, price);
        });
    });
    
    // Выбор аватара
    document.querySelectorAll('.avatar-select-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await selectAvatar(itemId);
        });
    });
    
    // Добавляем тултипы для обычных предметов (не для аватаров)
    document.querySelectorAll('.inventory-slot:not(.empty-slot)').forEach(slot => {
        const itemId = slot.dataset.id;
        const item = itemsDB[itemId];
        if (!item || item.type === 'avatar') return;
        
        slot.addEventListener('mouseenter', (e) => {
            if (item) showTooltip(item, e);
        });
        slot.addEventListener('mouseleave', hideTooltip);
        slot.addEventListener('mousemove', (e) => {
            if (activeTooltip) {
                activeTooltip.style.left = (e.clientX + 15) + 'px';
                activeTooltip.style.top = (e.clientY + 15) + 'px';
            }
        });
    });
    
    // ===== ПРИНУДИТЕЛЬНЫЙ ПЕРЕРЕНДЕР ПОСЛЕ РЕНДЕРА =====
    setTimeout(() => {
        forceRepaintGrid(container);
    }, 10);
}

// Рендер вкладки "Продать"
export function renderShopSellTab() {
    const container = document.getElementById('shopSellTab');
    if (!container) return;
    
    const sellable = inventory.filter(item => {
        const dbItem = itemsDB[item.id];
        return dbItem && dbItem.price > 0 && dbItem.type !== 'avatar';
    });
    
    const itemsPerPage = 20;
    
    // Обновляем отображение денег
    updateShopMoneyDisplay();
    
    if (sellable.length === 0) {
        container.innerHTML = '<div class="empty-inventory">📦 Нет предметов для продажи</div>';
        return;
    }
    
    let html = '<div class="inventory-grid">';
    
    for (const item of sellable) {
        const dbItem = itemsDB[item.id];
        const sellPrice = getSellPrice(item.id);
        
        html += `
            <div class="inventory-slot" data-id="${item.id}" data-name="${dbItem.name}">
                <img src="${dbItem.image}" alt="${dbItem.name}" class="item-image" loading="lazy"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${dbItem.icon}%3C/text%3E%3C/svg%3E'">
                <span class="item-name">${dbItem.name}</span>
                <div class="item-info-shop">
                    <span class="item-count">×${item.count}</span>
                    <span class="item-price">${sellPrice}₽/шт</span>
                </div>
                <div class="item-actions">
                    <button class="sell-btn shop-action-btn" data-id="${item.id}">Продать</button>
                </div>
            </div>
        `;
    }
    
    // Заполняем пустые ячейки до 20 (5x4)
    const remainingSlots = itemsPerPage - (sellable.length % itemsPerPage);
    if (remainingSlots < itemsPerPage) {
        for (let i = 0; i < remainingSlots; i++) {
            html += `<div class="inventory-slot empty-slot">🔲</div>`;
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Добавляем обработчики для кнопок продажи
    document.querySelectorAll('.sell-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await sellItem(itemId);
        });
    });
    
    // Добавляем тултипы
    document.querySelectorAll('.inventory-slot:not(.empty-slot)').forEach(slot => {
        const itemId = slot.dataset.id;
        const item = itemsDB[itemId];
        
        if (!item) return;
        
        slot.addEventListener('mouseenter', (e) => {
            showTooltip(item, e);
        });
        slot.addEventListener('mouseleave', hideTooltip);
        slot.addEventListener('mousemove', (e) => {
            if (activeTooltip) {
                activeTooltip.style.left = (e.clientX + 15) + 'px';
                activeTooltip.style.top = (e.clientY + 15) + 'px';
            }
        });
    });
    
    // ===== ПРИНУДИТЕЛЬНЫЙ ПЕРЕРЕНДЕР ПОСЛЕ РЕНДЕРА =====
    setTimeout(() => {
        forceRepaintGrid(container);
    }, 10);
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
        showMessage(`✅ Куплено: ${item.name}. Предмет добавлен в инвентарь.`, '#4caf50');
        logAction(`Куплен предмет: ${item.name} за ${item.price}₽`, 'economy');
        
        // 👇 ПОДСКАЗКА: первая покупка в магазине
        if (tutorialEnabled && !isTutorialShown('shown_shop_buy')) {
            showTutorialTip('🛒 Отличная покупка! Предметы можно использовать из инвентаря. Некоторые предметы дают бонусы к теплу, здоровью или энергии.', 4000);
            markTutorialShown('shown_shop_buy');
            await import('./firestore.js').then(m => m.saveGameData());
        }
        
        // Обновляем обе вкладки магазина
        renderShopBuyTab();
        renderShopSellTab();
        updateShopMoneyDisplay();
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
    logAction(`Продан предмет: ${item.name} за ${sellPrice}₽`, 'economy');
    
    renderShopBuyTab();
    renderShopSellTab();
    updateShopMoneyDisplay();
}

// ===== НОВЫЕ ФУНКЦИИ ДЛЯ АВАТАРОВ =====

// Покупка аватара
async function buyAvatar(avatarId, price) {
    const avatar = itemsDB[avatarId];
    if (!avatar || avatar.type !== 'avatar') return;
    
    // Проверяем, не куплен ли уже
    if (ownedAvatars && ownedAvatars.includes(avatarId)) {
        showMessage(`❌ Аватар "${avatar.name}" уже куплен!`, '#e74c3c');
        return;
    }
    
    if (money < price) {
        showMessage(`❌ Не хватает денег! Нужно ${price}₽`, '#e74c3c');
        return;
    }
    
    // Списываем деньги
    const newMoney = money - price;
    setStats(health, hunger, cold, newMoney);
    
    // Добавляем в ownedAvatars
    if (!ownedAvatars) {
        ownedAvatars = ['default'];
    }
    ownedAvatars.push(avatarId);
    
    // Если это первый купленный аватар (кроме default) — делаем его активным
    if (ownedAvatars.length === 2) {
        await setCurrentAvatar(avatarId);
    }
    
    await saveGameData();
    showMessage(`✅ Аватар "${avatar.name}" куплен!`, '#4caf50');
    logAction(`Куплен аватар: ${avatar.name} за ${price}₽`, 'economy');
    
    // 👇 ОБНОВЛЯЕМ ВКЛАДКУ АВАТАРОВ В ИНВЕНТАРЕ
    try {
        const { renderAvatarsTab } = await import('./inventory.js');
        renderAvatarsTab();
    } catch (e) {
        console.warn('Не удалось обновить вкладку аватаров:', e);
    }
    
    // Обновляем магазин
    renderShopBuyTab();
    renderShopSellTab();
    updateShopMoneyDisplay();
}

// Выбор аватара
async function selectAvatar(avatarId) {
    const avatar = itemsDB[avatarId];
    if (!avatar || avatar.type !== 'avatar') return;
    
    // Проверяем, куплен ли
    if (!ownedAvatars || !ownedAvatars.includes(avatarId)) {
        showMessage(`❌ Аватар "${avatar.name}" не куплен! Сначала купите его в магазине.`, '#e74c3c');
        return;
    }
    
    if (currentAvatar === avatarId) {
        showMessage(`✅ Аватар "${avatar.name}" уже активен!`, '#ffd966');
        return;
    }
    
    await setCurrentAvatar(avatarId);
    await saveGameData();
    showMessage(`✅ Аватар "${avatar.name}" выбран!`, '#4caf50');
    logAction(`Выбран аватар: ${avatar.name}`, 'system');
    
    // 👇 ОБНОВЛЯЕМ ВКЛАДКУ АВАТАРОВ В ИНВЕНТАРЕ
    try {
        const { renderAvatarsTab } = await import('./inventory.js');
        renderAvatarsTab();
    } catch (e) {
        console.warn('Не удалось обновить вкладку аватаров:', e);
    }
    
    // Обновляем отображение аватара в игре
    updateAvatarDisplay();
    
    // Обновляем магазин
    renderShopBuyTab();
}

// Обновление отображения аватара в игре
function updateAvatarDisplay() {
    const avatarImg = document.getElementById('avatarGif');
    if (!avatarImg) return;
    
    if (currentAvatar === 'default') {
        avatarImg.src = 'images/hero2.png';
        return;
    }
    
    const avatar = itemsDB[currentAvatar];
    if (avatar && avatar.image) {
        avatarImg.src = avatar.image;
    } else {
        avatarImg.src = 'images/hero2.png';
    }
}

// Экспортируем функцию для использования в main.js
export function initAvatarDisplay() {
    updateAvatarDisplay();
}
