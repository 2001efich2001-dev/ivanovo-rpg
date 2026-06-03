import { inventory, equipped, health, hunger, cold, money, maxHealth, maxHunger, maxCold, updateUI, setStats, addIntoxication, reduceIntoxication, intoxication, currentHome, ownedHomes, setPrimaryHome, housingAccount, housingDailyCost, housingDebt, depositToHousingAccount, withdrawFromHousingAccount, loadOwnedHomesFromRealEstate } from './gameState.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction } from './utils.js';
import { renderAchievementsTab, updateAchievementStats } from './achievements.js';


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
    // Еда
    bread: { id: "bread", name: "Буханка хлеба", type: "food", icon: "🍞", image: "images/items/bread.png", effect: { hunger: 20, health: 0, cold: 0, intoxication: 0 }, price: 25, slot: null, description: "Восстанавливает 20 голода" },
    water: { id: "water", name: "Бутылка воды", type: "drink", icon: "💧", image: "images/items/water.png", effect: { hunger: 10, health: 0, cold: 0, intoxication: 0 }, price: 15, slot: null, description: "Восстанавливает 10 голода" },
    
    // Алкоголь
    vodka: { id: "vodka", name: "Водка", type: "alcohol", icon: "🍾", image: "images/items/vodka.png", effect: { hunger: -10, health: 15, cold: 0, intoxication: 30 }, price: 40, slot: null, description: "+15 здоровья, -10 голода, +30 опьянения" },
    beer: { id: "beer", name: "Пиво", type: "alcohol", icon: "🍺", image: "images/items/beer.png", effect: { hunger: -5, health: 5, cold: 0, intoxication: 15 }, price: 25, slot: null, description: "+5 здоровья, -5 голода, +15 опьянения" },
    portwine: { id: "portwine", name: "Портвейн 666", type: "alcohol", icon: "🍷", image: "images/items/portwine.png", effect: { hunger: -8, health: 10, cold: 0, intoxication: 20 }, price: 35, slot: null, description: "+10 здоровья, -8 голода, +20 опьянения" },
    fanfurik: { id: "fanfurik", name: "Фанфурик", type: "alcohol", icon: "🍸", image: "images/items/fanfurik.png", effect: { hunger: -12, health: 8, cold: 0, intoxication: 25 }, price: 45, slot: null, description: "+8 здоровья, -12 голода, +25 опьянения" },
    
    // Лекарства
    medkit: { id: "medkit", name: "Аптечка", type: "medicine", icon: "💊", image: "images/items/medkit.png", effect: { hunger: 0, health: 30, cold: 0, intoxication: -20 }, price: 50, slot: null, description: "Восстанавливает 30 здоровья, -20 опьянения" },
    mineralwater: { id: "mineralwater", name: "Минералка", type: "medicine", icon: "💧", image: "images/items/mineralwater.png", effect: { hunger: 5, health: 0, cold: 0, intoxication: -15 }, price: 20, slot: null, description: "+5 голода, -15 опьянения" },
    
    // Сигареты
    cigarettes: { id: "cigarettes", name: "Сигареты", type: "drug", icon: "🚬", image: "images/items/cigarettes.png", effect: { hunger: 0, health: -5, cold: 10, intoxication: 0 }, price: 20, slot: null, description: "+10 тепла, -5 здоровья" },
    
    // Одежда
    ushanka: { id: "ushanka", name: "Шапка-ушанка", type: "clothes", icon: "🧢", image: "images/items/ushanka.png", effect: { cold: 15 }, price: 80, slot: "head", description: "+15 к теплу" },
    puhovik: { id: "puhovik", name: "Пуховик", type: "clothes", icon: "🧥", image: "images/items/puhovik.png", effect: { cold: 25 }, price: 200, slot: "body", description: "+25 к теплу" },
    termo: { id: "termo", name: "Термобельё", type: "clothes", icon: "👖", image: "images/items/termo.png", effect: { cold: 10 }, price: 120, slot: "legs", description: "+10 к теплу" },
    bercy: { id: "bercy", name: "Берцы", type: "clothes", icon: "👢", image: "images/items/bercy.png", effect: { cold: 10 }, price: 150, slot: "feet", description: "+10 к теплу" },
    old_hat: { id: "old_hat", name: "Старая шапка", type: "clothes", icon: "🧢", image: "images/items/old_hat.png", effect: { cold: 5 }, price: 20, slot: "head", description: "+5 к теплу" },
    
    // Хлам
    empty_bottle: { id: "empty_bottle", name: "Пустая бутылка", type: "junk", icon: "🍾", image: "images/items/empty_bottle.png", effect: {}, price: 5, slot: null, description: "Можно продать за 5₽" },
    fishing_rod: { id: "fishing_rod", name: "Удочка", type: "tool", icon: "🎣", image: "images/items/fishing_rod.png", effect: {}, price: 200, slot: null, description: "Для рыбалки на реке Уводь" },
    
    // Рыба
    fish_small: { id: "fish_small", name: "Мелкая рыбёшка", type: "food", icon: "🐟", image: "images/items/fish_small.png", effect: { hunger: 10, health: 0, cold: 0, intoxication: 0 }, price: 15, slot: null, description: "Восстанавливает 10 голода" },
    fish_medium: { id: "fish_medium", name: "Средняя рыба", type: "food", icon: "🐠", image: "images/items/fish_medium.png", effect: { hunger: 20, health: 0, cold: 0, intoxication: 0 }, price: 30, slot: null, description: "Восстанавливает 20 голода" },
    fish_big: { id: "fish_big", name: "Крупная рыба", type: "food", icon: "🐡", image: "images/items/fish_big.png", effect: { hunger: 35, health: 0, cold: 0, intoxication: 0 }, price: 50, slot: null, description: "Восстанавливает 35 голода" },
    fish_carp: { id: "fish_carp", name: "Сазан", type: "food", icon: "🎏", image: "images/items/fish_carp.png", effect: { hunger: 50, health: 5, cold: 0, intoxication: 0 }, price: 100, slot: null, description: "Восстанавливает 50 голода, +5 здоровья" },
    fish_pike: { id: "fish_pike", name: "Щука", type: "food", icon: "🐊", image: "images/items/fish_pike.png", effect: { hunger: 60, health: 10, cold: 0, intoxication: 0 }, price: 150, slot: null, description: "Восстанавливает 60 голода, +10 здоровья" },
    fish_sword: { id: "fish_sword", name: "Рыба-меч", type: "food", icon: "🗡️🐟", image: "images/items/fish_sword.png", effect: { hunger: 100, health: 30, cold: 0, intoxication: 0 }, price: 500, slot: null, description: "Восстанавливает 100 голода, +30 здоровья! Легендарная рыба!" },
    
    // Мусор
    old_boot: { id: "old_boot", name: "Старый ботинок", type: "junk", icon: "👢", image: "images/items/old_boot.png", effect: {}, price: 0, slot: null, description: "Просто мусор... Можно выбросить" },
    rusty_can: { id: "rusty_can", name: "Ржавая банка", type: "junk", icon: "🥫", image: "images/items/rusty_can.png", effect: {}, price: 0, slot: null, description: "Просто мусор... Можно выбросить" },
    torn_net: { id: "torn_net", name: "Рваная сеть", type: "junk", icon: "🕸️", image: "images/items/torn_net.png", effect: {}, price: 0, slot: null, description: "Просто мусор... Можно выбросить" },
    plastic_bottle: { id: "plastic_bottle", name: "Пластиковая бутылка", type: "junk", icon: "🍾", image: "images/items/plastic_bottle.png", effect: {}, price: 0, slot: null, description: "Можно сдать на переработку? Нет, это просто мусор" },
    dirty_rag: { id: "dirty_rag", name: "Грязная тряпка", type: "junk", icon: "🧽", image: "images/items/dirty_rag.png", effect: {}, price: 0, slot: null, description: "Просто мусор... Можно выбросить" }
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
    
    let intoxicationText = '';
    if (item.effect.intoxication && item.effect.intoxication > 0) {
        intoxicationText = `<div>🍺 Опьянение: +${item.effect.intoxication}</div>`;
    } else if (item.effect.intoxication && item.effect.intoxication < 0) {
        intoxicationText = `<div>💧 Опьянение: ${item.effect.intoxication}</div>`;
    }
    
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${item.name}</strong>
        </div>
        <div class="tooltip-content">
            ${item.description || ''}
            ${item.effect.hunger ? `<div>🍗 Голод: ${item.effect.hunger > 0 ? '+' : ''}${item.effect.hunger}</div>` : ''}
            ${item.effect.health ? `<div>❤️ Здоровье: ${item.effect.health > 0 ? '+' : ''}${item.effect.health}</div>` : ''}
            ${item.effect.cold ? `<div>🔥 Тепло: ${item.effect.cold > 0 ? '+' : ''}${item.effect.cold}</div>` : ''}
            ${intoxicationText}
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

// Функция для обновления информации о странице в шапке
function updateInventoryPageInfo(currentPageNum, totalPagesNum) {
    const pageInfo = document.getElementById('inventoryPageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Страница ${currentPageNum + 1} / ${Math.max(1, totalPagesNum)}`;
    }
}

// Функция для обновления отображения бонуса тепла в шапке
function updateEquipmentBonusDisplay() {
    const bonusElement = document.getElementById('equipmentTotalBonus');
    if (bonusElement) {
        const totalColdBonus = calculateEquippedColdBonus();
        bonusElement.textContent = `🔥 +${totalColdBonus}`;
        bonusElement.title = `Суммарный бонус тепла от одежды: +${totalColdBonus}`;
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ЖИЛЬЯ ==========
function getHousingTypeName(homeId) {
    if (!homeId) return 'Неизвестно';
    if (homeId.startsWith('dorm')) return '🏢 Общага';
    if (homeId.startsWith('apartment')) return '🏢 Квартира';
    if (homeId.startsWith('house')) return '🏠 Дом';
    return '🏠 Жильё';
}

function getHousingCapacity(homeId) {
    if (!homeId) return 0;
    if (homeId.startsWith('dorm')) return 10;
    if (homeId.startsWith('apartment')) return 20;
    if (homeId.startsWith('house')) return 40;
    return 0;
}

function getDailyCostForHome(homeId) {
    if (!homeId) return 0;
    if (homeId.startsWith('dorm')) return 250;
    if (homeId.startsWith('apartment')) return 500;
    if (homeId.startsWith('house')) return 1000;
    return 0;
}

function getCostName(homeId) {
    if (!homeId) return '';
    if (homeId.startsWith('dorm')) return 'Аренда';
    return 'Коммуналка';
}

// ========== ПОПОЛНЕНИЕ / СНЯТИЕ СО СЧЁТА (модальное окно) ==========
function showDepositModal(homeId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10050';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <h3>💰 Управление счётом</h3>
            <p style="margin-bottom: 10px;">${homeId.toUpperCase().replace(/_/g, ' ')}</p>
            <p>💰 Ваши деньги: <span id="depositMoneyAmount">${Math.floor(money)}</span>₽</p>
            <p>🏦 Баланс счёта: <span id="depositAccountAmount">${housingAccount}</span>₽</p>
            
            <div style="margin: 15px 0; padding: 10px; background: var(--stat-bg); border-radius: 32px;">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="number" id="depositAmount" placeholder="Сумма" min="1" style="width: 100%; padding: 10px; border-radius: 40px; background: var(--card-bg); color: var(--text-primary); border: 1px solid var(--card-border);">
                </div>
                
                <div style="font-weight: bold; margin: 10px 0;">📥 Пополнение счёта</div>
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button id="deposit500" class="action-btn" style="flex: none; padding: 6px 12px;">500₽</button>
                    <button id="deposit1000" class="action-btn" style="flex: none; padding: 6px 12px;">1000₽</button>
                    <button id="deposit5000" class="action-btn" style="flex: none; padding: 6px 12px;">5000₽</button>
                    <button id="depositMax" class="action-btn" style="flex: none; padding: 6px 12px;">Макс</button>
                </div>
                
                <div style="font-weight: bold; margin: 15px 0 10px 0;">📤 Снятие со счёта</div>
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button id="withdraw500" class="reset-btn" style="flex: none; padding: 6px 12px;">500₽</button>
                    <button id="withdraw1000" class="reset-btn" style="flex: none; padding: 6px 12px;">1000₽</button>
                    <button id="withdraw5000" class="reset-btn" style="flex: none; padding: 6px 12px;">5000₽</button>
                    <button id="withdrawAll" class="reset-btn" style="flex: none; padding: 6px 12px;">Всё</button>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="depositConfirmBtn" class="action-btn" style="flex: 1;">✅ Применить</button>
                <button id="depositCancelBtn" class="reset-btn" style="flex: 1;">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const amountInput = modal.querySelector('#depositAmount');
    const depositMoneySpan = modal.querySelector('#depositMoneyAmount');
    const depositAccountSpan = modal.querySelector('#depositAccountAmount');
    
    const updateMoneyDisplay = () => {
        depositMoneySpan.textContent = Math.floor(money);
        depositAccountSpan.textContent = housingAccount;
    };
    
    // Кнопки пополнения (устанавливаем положительные значения)
    modal.querySelector('#deposit500').onclick = () => { amountInput.value = 500; };
    modal.querySelector('#deposit1000').onclick = () => { amountInput.value = 1000; };
    modal.querySelector('#deposit5000').onclick = () => { amountInput.value = 5000; };
    modal.querySelector('#depositMax').onclick = () => { 
        const maxDeposit = Math.min(Math.floor(money), 20000 - housingAccount);
        amountInput.value = maxDeposit > 0 ? maxDeposit : 0;
    };
    
    // Кнопки снятия (устанавливаем отрицательные значения)
    modal.querySelector('#withdraw500').onclick = () => { amountInput.value = -500; };
    modal.querySelector('#withdraw1000').onclick = () => { amountInput.value = -1000; };
    modal.querySelector('#withdraw5000').onclick = () => { amountInput.value = -5000; };
    modal.querySelector('#withdrawAll').onclick = () => { amountInput.value = -housingAccount; };
    
    // Подтверждение
    modal.querySelector('#depositConfirmBtn').onclick = async () => {
        let amount = parseInt(amountInput.value);
        if (isNaN(amount) || amount === 0) {
            showMessage('❌ Введите сумму', '#e74c3c');
            return;
        }
        
        if (amount > 0) {
            // Пополнение
            if (amount > money) {
                showMessage(`❌ Не хватает денег! Нужно ${amount}₽`, '#e74c3c');
                updateMoneyDisplay();
                return;
            }
            
            const maxDeposit = 20000 - housingAccount;
            if (amount > maxDeposit) {
                showMessage(`❌ Счёт не может превысить 20000₽. Максимум можно положить ${maxDeposit}₽`, '#ffd966');
                amountInput.value = maxDeposit;
                return;
            }
            
            const success = await depositToHousingAccount(amount);
            if (success) {
                updateMoneyDisplay();
                renderHousingTab();
                amountInput.value = '';
                modal.remove();
            } else {
                updateMoneyDisplay();
            }
        } else if (amount < 0) {
            // Снятие
            const withdrawAmount = Math.abs(amount);
            if (withdrawAmount > housingAccount) {
                showMessage(`❌ Недостаточно средств на счету! Доступно: ${housingAccount}₽`, '#e74c3c');
                updateMoneyDisplay();
                return;
            }
            
            const success = await withdrawFromHousingAccount(withdrawAmount);
            if (success) {
                updateMoneyDisplay();
                renderHousingTab();
                amountInput.value = '';
                modal.remove();
            } else {
                updateMoneyDisplay();
            }
        }
    };
    
    modal.querySelector('#depositCancelBtn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    updateMoneyDisplay();
}

// ========== РЕНДЕР ВКЛАДКИ "МОЁ ЖИЛЬЁ" (с кнопкой продажи игроку) ==========
export async function renderHousingTab() {
    // Принудительно загружаем актуальную недвижимость из real_estate
    await loadOwnedHomesFromRealEstate();
    
    const container = document.getElementById('housingTab');
    if (!container) return;
    
    if (!ownedHomes || ownedHomes.length === 0) {
        container.innerHTML = '<div class="empty-inventory">🏠 У вас пока нет недвижимости. Купите её на карте!</div>';
        return;
    }
    
    let html = '<div class="housing-list" style="display: flex; flex-direction: column; gap: 12px;">';
    
    for (const homeId of ownedHomes) {
        const isCurrent = (currentHome === homeId);
        const typeName = getHousingTypeName(homeId);
        const capacity = getHousingCapacity(homeId);
        const sellPrice = Math.floor(getPriceByHomeId(homeId) / 2);
        const dailyCost = getDailyCostForHome(homeId);
        const costName = getCostName(homeId);
        const accountBalance = housingAccount;
        const debt = housingDebt;
        
        // Рассчитываем дни до выселения
        let daysLeft = '∞';
        let debtWarning = '';
        if (debt > 0) {
            const daysToEvict = Math.max(0, Math.ceil((dailyCost * 3 - debt) / dailyCost));
            daysLeft = `${daysToEvict} дн.`;
            debtWarning = `<div style="color: #e74c3c; font-size: 0.8rem;">⚠️ Долг: ${debt}₽</div>`;
        } else if (accountBalance < dailyCost && dailyCost > 0) {
            const days = Math.floor(accountBalance / dailyCost);
            daysLeft = `${days} дн.`;
        } else if (dailyCost > 0) {
            const days = Math.floor(accountBalance / dailyCost);
            daysLeft = `${days} дн.`;
        }
        
        let displayName = homeId.toUpperCase().replace(/_/g, ' ');
        
        html += `
            <div class="housing-item ${isCurrent ? 'current-home' : ''}" style="
                background: var(--stat-bg);
                border-radius: 24px;
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
                ${isCurrent ? 'border-left: 4px solid #ffd966;' : 'border-left: 4px solid var(--accent-gold);'}
            ">
                <div class="housing-item-info" style="flex: 2;">
                    <div class="housing-item-name" style="font-weight: bold; font-size: 1rem; color: var(--accent-gold);">
                        ${displayName}
                    </div>
                    <div class="housing-item-type" style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${typeName} • 📦 Вместимость: ${capacity}
                    </div>
                    ${dailyCost > 0 ? `
                        <div class="housing-item-cost" style="font-size: 0.8rem; color: #ffd966; margin-top: 4px;">
                            📅 ${costName}: ${dailyCost}₽/день
                        </div>
                        <div class="housing-item-account" style="font-size: 0.8rem; color: #4caf50;">
                            🏦 Счёт: ${accountBalance}₽ • Осталось дней: ${daysLeft}
                        </div>
                        ${debtWarning}
                    ` : ''}
                    <div class="housing-item-sell-price" style="font-size: 0.8rem; color: #ffd966; margin-top: 4px;">
                        💰 Цена продажи городу: ${sellPrice.toLocaleString()}₽
                    </div>
                </div>
                <div class="housing-item-status" style="font-size: 0.85rem;">
                    ${isCurrent ? '⭐ Текущее основное' : ''}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${dailyCost > 0 ? `
                        <button class="housing-deposit-btn action-btn" data-id="${homeId}" style="
                            background: #2196F3;
                            border: none;
                            padding: 8px 20px;
                            border-radius: 40px;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        ">💰 Управление счётом</button>
                    ` : ''}
                    ${!isCurrent ? `
                        <button class="housing-set-primary-btn action-btn" data-id="${homeId}" style="
                            background: var(--buy-btn-bg);
                            border: none;
                            padding: 8px 20px;
                            border-radius: 40px;
                            color: white;
                            cursor: pointer;
                            font-weight: bold;
                        ">🏠 Сделать основным</button>
                    ` : ''}
                    <button class="housing-sell-to-player-btn" data-id="${homeId}" data-name="${displayName}" style="
                        background: #e67e22;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 40px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                    ">📢 Продать игроку</button>
                    <button class="housing-sell-btn" data-id="${homeId}" data-price="${sellPrice}" style="
                        background: #c0392b;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 40px;
                        color: white;
                        cursor: pointer;
                        font-weight: bold;
                    ">💰 Продать городу</button>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Обработчики для кнопок "Управление счётом"
    document.querySelectorAll('.housing-deposit-btn').forEach(btn => {
        btn.removeEventListener('click', btn._depositHandler);
        const handler = () => {
            const homeId = btn.dataset.id;
            playClick();
            showDepositModal(homeId);
        };
        btn.addEventListener('click', handler);
        btn._depositHandler = handler;
    });
    
    // Обработчики для кнопок "Сделать основным"
    document.querySelectorAll('.housing-set-primary-btn').forEach(btn => {
        btn.removeEventListener('click', btn._handler);
        const handler = async () => {
            const homeId = btn.dataset.id;
            playClick();
            const success = await setPrimaryHome(homeId);
            if (success) {
                renderHousingTab();
                showMessage(`🏠 Основным жильём выбрано: ${homeId.toUpperCase().replace(/_/g, ' ')}`, '#4caf50');
            }
        };
        btn.addEventListener('click', handler);
        btn._handler = handler;
    });
    
    // ===== НОВЫЙ ОБРАБОТЧИК: Продажа игроку =====
    document.querySelectorAll('.housing-sell-to-player-btn').forEach(btn => {
        btn.removeEventListener('click', btn._sellToPlayerHandler);
        const handler = async () => {
            const homeId = btn.dataset.id;
            const displayName = btn.dataset.name;
            playClick();
            
            const price = prompt(`💰 Введите цену для "${displayName}" (минимум 100₽):\n\nПосле выставления объявление появится в "Агентстве недвижимости Авит0"`, '10000');
            if (!price) return;
            
            const numPrice = parseInt(price);
            if (isNaN(numPrice) || numPrice < 100) {
                showMessage('❌ Цена должна быть не менее 100₽', '#e74c3c');
                return;
            }
            
            const { listPropertyForSale } = await import('./realEstateMarket.js');
            const success = await listPropertyForSale(homeId, numPrice);
            if (success) {
                renderHousingTab(); // обновляем вкладку
                showMessage(`✅ "${displayName}" выставлен на продажу за ${numPrice.toLocaleString()}₽`, '#4caf50');
            }
        };
        btn.addEventListener('click', handler);
        btn._sellToPlayerHandler = handler;
    });
    
    // Обработчики для кнопок "Продать городу"
    document.querySelectorAll('.housing-sell-btn').forEach(btn => {
        btn.removeEventListener('click', btn._sellHandler);
        const handler = async () => {
            const homeId = btn.dataset.id;
            const sellPriceVal = parseInt(btn.dataset.price);
            playClick();
            
            const confirm = window.confirm(`💰 Продать ${homeId.toUpperCase().replace(/_/g, ' ')} городу за ${sellPriceVal.toLocaleString()}₽?\n\nВернуть будет нельзя!`);
            if (confirm) {
                await sellPropertyToCity(homeId, sellPriceVal);
                renderHousingTab();
            }
        };
        btn.addEventListener('click', handler);
        btn._sellHandler = handler;
    });
}

// ========== НОВАЯ ФУНКЦИЯ: ПОЛУЧИТЬ ЦЕНУ ПОКУПКИ ПО ID ==========
function getPriceByHomeId(homeId) {
    if (homeId.startsWith('dorm')) return 5000;
    if (homeId.startsWith('apartment')) return 25000;
    if (homeId.startsWith('house')) return 100000;
    return 0;
}

// ========== НОВАЯ ФУНКЦИЯ: ПРОДАЖА НЕДВИЖИМОСТИ ГОРОДУ (с автоматическим снятием объявления) ==========
async function sellPropertyToCity(propertyId, sellPrice) {
    console.log(`💰 Продажа ${propertyId} за ${sellPrice}₽`);
    
    try {
        const { auth } = await import('./auth.js');
        const { db } = await import('./firestore.js');
        const { doc, runTransaction, deleteField, collection, query, where, getDocs, updateDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { money, setStats, updateUI, currentHome, setPrimaryHome, ownedHomes } = await import('./gameState.js');
        const { showMessage: showMsg } = await import('./utils.js');
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            showMsg('Ошибка авторизации', '#e74c3c');
            return;
        }
        
        // ===== НОВОЕ: Проверяем, есть ли активное объявление на эту недвижимость =====
        let hadActiveListing = false;
        try {
            const listingsQuery = query(
                collection(db, 'real_estate_listings'),
                where('propertyId', '==', propertyId),
                where('status', '==', 'active')
            );
            const listingsSnapshot = await getDocs(listingsQuery);
            
            for (const listingDoc of listingsSnapshot.docs) {
                hadActiveListing = true;
                // Снимаем объявление (статус cancelled)
                await updateDoc(doc(db, 'real_estate_listings', listingDoc.id), {
                    status: 'cancelled',
                    cancelledAt: new Date().toISOString(),
                    cancelledReason: 'sold_to_city'
                });
                console.log(`📢 Объявление для ${propertyId} снято с продажи (продано городу)`);
            }
        } catch (err) {
            console.warn('Ошибка при проверке объявлений:', err);
        }
        
        await runTransaction(db, async (transaction) => {
            // 1. Читаем документ недвижимости
            const propertyRef = doc(db, 'real_estate', propertyId);
            const propertySnap = await transaction.get(propertyRef);
            
            if (!propertySnap.exists()) {
                throw new Error('Объект не найден');
            }
            
            const propertyData = propertySnap.data();
            if (propertyData.ownerId !== currentUser.uid) {
                throw new Error('Это не ваша недвижимость');
            }
            
            // 2. Читаем документ пользователя
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data();
            const currentMoney = userData?.money || 0;
            const newMoney = currentMoney + sellPrice;
            
            // 3. Удаляем propertyId из ownedHomes
            const currentOwned = userData?.housing?.owned || [];
            const newOwnedHomes = currentOwned.filter(id => id !== propertyId);
            
            // 4. Если продаётся текущее основное жильё — выбираем новое
            let newCurrentHome = userData?.housing?.current;
            if (newCurrentHome === propertyId) {
                newCurrentHome = newOwnedHomes.length > 0 ? newOwnedHomes[0] : null;
            }
            
            // 5. Очищаем владельца в объекте недвижимости
            transaction.update(propertyRef, {
                ownerId: deleteField(),
                ownerName: deleteField(),
                purchasedAt: deleteField(),
                debt: deleteField(),
                lastTaxPaid: deleteField()
            });
            
            // 6. Обновляем пользователя
            transaction.update(userRef, {
                money: newMoney,
                'housing.owned': newOwnedHomes,
                'housing.current': newCurrentHome,
                'housing.storageCapacity': newCurrentHome ? getCapacityByHomeId(newCurrentHome) : 0
            });
        });
        
        // Обновляем локальное состояние
        const newMoney = money + sellPrice;
        setStats(null, null, null, newMoney);
        
        // Обновляем локальные массивы
        const index = ownedHomes.indexOf(propertyId);
        if (index !== -1) ownedHomes.splice(index, 1);
        
        if (currentHome === propertyId && ownedHomes.length > 0) {
            await setPrimaryHome(ownedHomes[0]);
        } else if (ownedHomes.length === 0) {
            const { setCurrentLocation } = await import('./gameState.js');
            setCurrentLocation('dump_home');
        }
        
        updateUI();
        
        // ===== НОВОЕ: Показываем сообщение о снятии объявления =====
        if (hadActiveListing) {
            showMsg(`💰 Продано! ${propertyId.toUpperCase().replace(/_/g, ' ')} за ${sellPrice.toLocaleString()}₽\n📢 Объявление автоматически снято с продажи`, '#4caf50');
        } else {
            showMsg(`💰 Продано! ${propertyId.toUpperCase().replace(/_/g, ' ')} за ${sellPrice.toLocaleString()}₽`, '#4caf50');
        }
        
    } catch (error) {
        console.error('Ошибка продажи:', error);
        const { showMessage: showMsg } = await import('./utils.js');
        showMsg(`❌ Ошибка при продаже: ${error.message}`, '#e74c3c');
    }
}

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ВМЕСТИМОСТЬ ПО ID ==========
function getCapacityByHomeId(homeId) {
    if (homeId.startsWith('dorm')) return 10;
    if (homeId.startsWith('apartment')) return 20;
    if (homeId.startsWith('house')) return 40;
    return 0;
}

// Функция для рендера сетки инвентаря
export function renderItemsTab() {
    const itemsTab = document.getElementById('itemsTab');
    if (!itemsTab) return;
    
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
        updateInventoryPageInfo(0, 1);
        return;
    }
    
    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
    const start = currentPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = allItems.slice(start, end);
    
    updateInventoryPageInfo(currentPage, totalPages);
    
    let html = '<div class="inventory-grid">';
    
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
        const item = pageItems[i];
        
        if (item) {
            // Определяем тип для CSS класса и иконки кнопки
            let itemTypeClass = 'usable';
            let buttonIcon = '🔨';
            
            if (item.type === 'clothes') {
                itemTypeClass = 'clothes';
                buttonIcon = '👕';
            } else if (item.type === 'junk') {
                itemTypeClass = 'junk';
                buttonIcon = '🗑️';
            }
            
            html += `
                <div class="inventory-slot ${itemTypeClass}" data-id="${item.id}" data-name="${item.name}">
                    <img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy">
                    <span class="item-count">×${item.count}</span>
                    <div class="item-actions">
                        <button class="slot-use-btn" data-id="${item.id}">${buttonIcon}</button>
                    </div>
                </div>
            `;
        } else {
            html += `<div class="inventory-slot empty-slot">🔲</div>`;
        }
    }
    
    html += '</div>';
    
    if (totalPages > 1) {
        html += `<div class="inventory-pagination">
            <button class="page-btn" id="prevPageBtn" ${currentPage === 0 ? 'disabled' : ''}>◀ Назад</button>
            <span class="page-info">${currentPage + 1} / ${totalPages}</span>
            <button class="page-btn" id="nextPageBtn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Вперед ▶</button>
        </div>`;
    }
    
    itemsTab.innerHTML = html;
    
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
    
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 0) {
                currentPage--;
                renderItemsTab();
                renderEquipmentTab();
                updateEquipmentBonusDisplay();
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages - 1) {
                currentPage++;
                renderItemsTab();
                renderEquipmentTab();
                updateEquipmentBonusDisplay();
            }
        });
    }
}

// Функции useItem, equipItem, unequipItem
async function useItem(itemId) {
    if (window._usingItem) {
        console.log('⚠️ useItem уже выполняется, пропускаем');
        return;
    }
    window._usingItem = true;
    
    console.trace('useItem вызван!');
    playClick();
    const itemIndex = inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || inventory[itemIndex].count <= 0) { 
        showMessage("Нет предмета!", "#e74c3c");
        window._usingItem = false;
        return; 
    }
    const itemData = itemsDB[itemId];
    if (!itemData) {
        window._usingItem = false;
        return;
    }
    
    // ===== НОВАЯ ОБРАБОТКА ДЛЯ МУСОРА =====
    if (itemData.type === 'junk') {
        // Удаляем предмет из инвентаря
        if (inventory[itemIndex].count === 1) {
            inventory.splice(itemIndex, 1);
        } else {
            inventory[itemIndex].count--;
        }
        updateUI();
        await saveGameData();
        showMessage(`🗑️ Вы выбросили ${itemData.name}`, "#6c757d");
        logAction(`Выброшен мусор: ${itemData.name}`, 'item');
        window._usingItem = false;
        return;
    }
    
    // ===== ОСТАЛЬНОЙ КОД (еда, лекарства, алкоголь и т.д.) =====
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
    if (itemData.effect.intoxication) {
        if (itemData.effect.intoxication > 0) {
            const oldIntoxication = intoxication;
            addIntoxication(itemData.effect.intoxication);
            effText += `Опьянение +${itemData.effect.intoxication}. `;
            
            updateAchievementStats('totalAlcoholConsumed', 1);
            
            if (oldIntoxication < 100 && oldIntoxication + itemData.effect.intoxication >= 100) {
                updateAchievementStats('maxIntoxication', 100);
            }
        } else if (itemData.effect.intoxication < 0) {
            reduceIntoxication(Math.abs(itemData.effect.intoxication));
            effText += `Опьянение ${itemData.effect.intoxication}. `;
        }
    }
    
    if (inventory[itemIndex].count === 1) inventory.splice(itemIndex,1);
    else inventory[itemIndex].count--;
    updateUI();
    await saveGameData();
    
    updateEquipmentBonusDisplay();
    showMessage(`🍺 Использовали ${itemData.name}. ${effText}`, "#4caf50");
    logAction(`Использован предмет: ${itemData.name} (${effText.trim()})`, 'item');
    
    window._usingItem = false;
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
    updateEquipmentBonusDisplay();
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
    updateEquipmentBonusDisplay();
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
    
    let html = '<div class="equipment-grid">';
    
    for (let s of slots) {
        const itemId = equipped[s.key];
        const itemData = itemId ? itemsDB[itemId] : null;
        
        if (itemData) {
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
    eqTab.innerHTML = html;
    
    document.querySelectorAll('.unequip-btn').forEach(btn => { 
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await unequipItem(btn.dataset.slot);
        });
    });
    
    document.querySelectorAll('.equipment-slot.empty').forEach(slot => {
        slot.addEventListener('click', () => {
            showMessage('Сначала выберите предмет в инвентаре и нажмите "Надеть"', '#ffd966');
        });
    });
    
    updateEquipmentBonusDisplay();
}

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

export function resetInventoryPage() {
    currentPage = 0;
}

// ========== АЧИВКИ ==========
export function renderAchievementsTabWrapper() {
    renderAchievementsTab();
}

// ========== НОВАЯ ФУНКЦИЯ: РЕНДЕР НЕДВИЖИМОСТИ В ТОРГОВЛЕ ==========
export async function renderTradeHousingSelector() {
    const container = document.getElementById('tradeHousingItems');
    if (!container) return;
    
    if (!ownedHomes || ownedHomes.length === 0) {
        container.innerHTML = '<div class="empty-inventory">🏠 У вас нет недвижимости для продажи</div>';
        return;
    }
    
    let html = '<div class="inventory-grid">';
    
    for (const homeId of ownedHomes) {
        const typeName = getHousingTypeName(homeId);
        const capacity = getHousingCapacity(homeId);
        const dailyCost = getDailyCostForHome(homeId);
        const costName = getCostName(homeId);
        let displayName = homeId.toUpperCase().replace(/_/g, ' ');
        
        html += `
            <div class="inventory-slot trade-slot" data-id="${homeId}" data-side="housing">
                <div style="font-size: 2rem;">${typeName.includes('Общага') ? '🏢' : (typeName.includes('Квартира') ? '🏢' : '🏠')}</div>
                <div class="item-name" style="font-size: 0.8rem; text-align: center;">${displayName}</div>
                <div style="font-size: 0.65rem; color: var(--text-secondary);">${typeName} • ${capacity} сл.</div>
                ${dailyCost > 0 ? `<div style="font-size: 0.6rem; color: #ffd966;">${costName}: ${dailyCost}₽/день</div>` : ''}
                <button class="trade-add-btn" data-id="${homeId}" data-side="housing" style="margin-top: 6px;">➕ Добавить</button>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Добавляем обработчики для кнопок добавления недвижимости
    document.querySelectorAll('#tradeHousingItems .trade-add-btn').forEach(btn => {
        btn.removeEventListener('click', btn._housingHandler);
        const handler = async (e) => {
            e.stopPropagation();
            const homeId = btn.dataset.id;
            const typeName = getHousingTypeName(homeId);
            let displayName = homeId.toUpperCase().replace(/_/g, ' ');
            
            const selectedContainer = document.getElementById('tradeSelectedHousing');
            if (!selectedContainer) return;
            
            // Проверяем, не добавлена ли уже эта недвижимость
            let existingItem = null;
            for (const el of selectedContainer.querySelectorAll('.selected-item')) {
                if (el.dataset.id === homeId) {
                    existingItem = el;
                    break;
                }
            }
            
            if (existingItem) {
                showMessage(`❌ Недвижимость ${displayName} уже добавлена`, '#e74c3c');
                return;
            }
            
            const newItemHtml = `
                <div class="selected-item" data-id="${homeId}" data-type="housing">
                    <span>${typeName.includes('Общага') ? '🏢' : (typeName.includes('Квартира') ? '🏢' : '🏠')} ${displayName}</span>
                    <button class="remove-item-btn">✖️</button>
                </div>
            `;
            selectedContainer.insertAdjacentHTML('beforeend', newItemHtml);
            selectedContainer.querySelector('.remove-item-btn:last-child').addEventListener('click', (e) => {
                e.target.closest('.selected-item').remove();
            });
        };
        btn.addEventListener('click', handler);
        btn._housingHandler = handler;
    });
}

// ========== РЕНДЕР ИНВЕНТАРЯ В ТОРГОВЛЕ (для предметов) ==========
async function renderTradeInventorySelector(side) {
    const user = window.auth?.currentUser;
    if (!user) return;
    
    const container = document.getElementById(`trade${side === 'from' ? 'FromItems' : 'ToItems'}`);
    if (!container) return;
    
    // Динамически импортируем Firebase
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
    const { db } = await import('./firestore.js');
    
    if (side === 'from') {
        // Отображаем инвентарь игрока (что отдаёт)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userInv = userDoc.data()?.inventory || [];
        
        if (userInv.length === 0) {
            container.innerHTML = '<div class="empty-inventory">📦 Инвентарь пуст</div>';
            return;
        }
        
        let html = '<div class="inventory-grid">';
        
        for (const item of userInv) {
            const itemData = itemsDB[item.id];
            if (!itemData) continue;
            
            html += `
                <div class="inventory-slot trade-slot" data-id="${item.id}" data-count="${item.count}" data-side="from">
                    <img src="${itemData.image}" alt="${itemData.name}" class="item-image" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${itemData.icon}%3C/text%3E%3C/svg%3E'">
                    <span class="item-name">${itemData.name}</span>
                    <span class="item-count">×${item.count}</span>
                    <button class="trade-add-btn" data-id="${item.id}" data-max="${item.count}" data-side="from">➕</button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Добавляем тултипы
        document.querySelectorAll('#tradeFromItems .trade-slot').forEach(slot => {
            const itemId = slot.dataset.id;
            const itemData = itemsDB[itemId];
            const count = parseInt(slot.dataset.count);
            
            slot.addEventListener('mouseenter', (e) => {
                showTradeTooltip(itemData, e, count);
            });
            slot.addEventListener('mouseleave', hideTradeTooltip);
            slot.addEventListener('mousemove', (e) => {
                if (activeTradeTooltip) {
                    activeTradeTooltip.style.left = (e.clientX + 15) + 'px';
                    activeTradeTooltip.style.top = (e.clientY + 15) + 'px';
                }
            });
        });
        
    } else {
        // Отображаем все доступные предметы (что можно получить)
        const allItems = Object.values(itemsDB);
        
        let html = '<div class="inventory-grid">';
        
        for (const item of allItems) {
            html += `
                <div class="inventory-slot trade-slot" data-id="${item.id}" data-side="to">
                    <img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${item.icon}%3C/text%3E%3C/svg%3E'">
                    <span class="item-name">${item.name}</span>
                    <button class="trade-add-btn" data-id="${item.id}" data-side="to">➕</button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        document.querySelectorAll('#tradeToItems .trade-slot').forEach(slot => {
            const itemId = slot.dataset.id;
            const itemData = itemsDB[itemId];
            
            slot.addEventListener('mouseenter', (e) => {
                showTradeTooltip(itemData, e);
            });
            slot.addEventListener('mouseleave', hideTradeTooltip);
            slot.addEventListener('mousemove', (e) => {
                if (activeTradeTooltip) {
                    activeTradeTooltip.style.left = (e.clientX + 15) + 'px';
                    activeTradeTooltip.style.top = (e.clientY + 15) + 'px';
                }
            });
        });
    }
    
    // Обработчики для кнопок добавления предметов
    document.querySelectorAll('.trade-add-btn').forEach(btn => {
        btn.removeEventListener('click', btn._handler);
        const handler = async (e) => {
            e.stopPropagation();
            const sideType = btn.dataset.side === 'from' ? 'from' : 'to';
            const itemId = btn.dataset.id;
            const itemData = itemsDB[itemId];
            let maxCount = Infinity;
            if (sideType === 'from') {
                maxCount = parseInt(btn.dataset.max);
            }
            const count = prompt(`Сколько ${itemData?.name} вы хотите ${sideType === 'from' ? 'отдать' : 'получить'}? ${sideType === 'from' ? `(макс. ${maxCount})` : ''}`, '1');
            const numCount = parseInt(count);
            if (isNaN(numCount) || numCount < 1 || (sideType === 'from' && numCount > maxCount)) {
                showMessage('Некорректное количество', '#e74c3c');
                return;
            }
            const selectedContainer = document.getElementById(`tradeSelected${sideType === 'from' ? 'From' : 'To'}`);
            if (!selectedContainer) return;
            
            let existingItem = null;
            for (const el of selectedContainer.querySelectorAll('.selected-item')) {
                if (el.dataset.id === itemId) {
                    existingItem = el;
                    break;
                }
            }
            if (existingItem) {
                const countSpan = existingItem.querySelector('.selected-count');
                const currentCount = parseInt(countSpan.textContent);
                const newCount = currentCount + numCount;
                if (sideType === 'from' && newCount > maxCount) {
                    showMessage(`Нельзя добавить больше, чем есть в инвентаре (${maxCount})`, '#e74c3c');
                    return;
                }
                countSpan.textContent = newCount;
            } else {
                const newItemHtml = `
                    <div class="selected-item" data-id="${itemId}" data-count="${numCount}">
                        <span>${itemData.icon} ${itemData.name} ×<span class="selected-count">${numCount}</span></span>
                        <button class="remove-item-btn">✖️</button>
                    </div>
                `;
                selectedContainer.insertAdjacentHTML('beforeend', newItemHtml);
                selectedContainer.querySelector('.remove-item-btn:last-child').addEventListener('click', (e) => {
                    e.target.closest('.selected-item').remove();
                });
            }
        };
        btn.addEventListener('click', handler);
        btn._handler = handler;
    });
}

// Функция для показа тултипа в торговле
let activeTradeTooltip = null;

function hideTradeTooltip() {
    if (activeTradeTooltip && activeTradeTooltip.remove) {
        activeTradeTooltip.remove();
        activeTradeTooltip = null;
    }
}

function showTradeTooltip(item, event, count = 1) {
    hideTradeTooltip();
    
    const sellPrice = Math.max(1, Math.floor((item.price || 0) / 2));
    
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
            <div class="tooltip-divider"></div>
            <div>💰 Покупка: ${item.price || 0}₽</div>
            <div>💸 Продажа: ${sellPrice}₽</div>
            ${count > 1 ? `<div>📦 В наличии: ${count} шт.</div>` : ''}
        </div>
    `;
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    tooltip.style.zIndex = '10001';
    
    document.body.appendChild(tooltip);
    activeTradeTooltip = tooltip;
}

// ========== ОБНОВЛЁННАЯ ФУНКЦИЯ ОТКРЫТИЯ ТОРГОВЛИ (с вкладками) ==========
export async function openTradeOfferModal(targetUserId, targetUserNick) {
    const modal = document.getElementById('tradeOfferModal');
    if (!modal) return;
    modal.dataset.targetUserId = targetUserId;
    modal.dataset.targetUserNick = targetUserNick;
    const title = modal.querySelector('.modal-content h3');
    if (title) title.innerHTML = `💼 Предложить обмен игроку ${escapeHtml(targetUserNick)}`;
    
    // Очищаем все контейнеры
    document.getElementById('tradeFromItems').innerHTML = '<div class="empty-inventory">📦 Инвентарь пуст</div>';
    document.getElementById('tradeToItems').innerHTML = '<div class="empty-inventory">📦 Загрузка...</div>';
    document.getElementById('tradeHousingItems').innerHTML = '<div class="empty-inventory">🏠 Загрузка...</div>';
    document.getElementById('tradeSelectedFrom').innerHTML = '';
    document.getElementById('tradeSelectedTo').innerHTML = '';
    document.getElementById('tradeSelectedHousing').innerHTML = '';
    document.getElementById('tradeFromMoney').value = 0;
    document.getElementById('tradeToMoney').value = 0;
    
    modal.style.display = 'flex';
    
    // Загружаем данные
    await renderTradeInventorySelector('from');
    await renderTradeInventorySelector('to');
    await renderTradeHousingSelector();
    
    // Настройка переключения вкладок
    const tabs = modal.querySelectorAll('.trade-tab-btn');
    const itemsTab = document.getElementById('tradeItemsTab');
    const housingTab = document.getElementById('tradeHousingTab');
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', tab._tradeHandler);
        const handler = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.tradeTab === 'items') {
                itemsTab.style.display = 'flex';
                housingTab.style.display = 'none';
            } else if (tab.dataset.tradeTab === 'receive') {
                itemsTab.style.display = 'flex';
                housingTab.style.display = 'none';
            } else if (tab.dataset.tradeTab === 'housing') {
                itemsTab.style.display = 'none';
                housingTab.style.display = 'block';
            }
        };
        tab.addEventListener('click', handler);
        tab._tradeHandler = handler;
    });
}

// ОБНОВЛЁННАЯ initInventoryTabs с поддержкой вкладки housing
export function initInventoryTabs() {
    const modal = document.getElementById('inventoryModal');
    if (!modal) return;
    const tabs = modal.querySelectorAll('.tab-btn');
    const itemsTab = document.getElementById('itemsTab');
    const equipmentTab = document.getElementById('equipmentTab');
    const achievementsTab = document.getElementById('achievementsTab');
    const housingTab = document.getElementById('housingTab');
    
    if (!tabs.length || !itemsTab || !equipmentTab || !achievementsTab || !housingTab) return;
    
    tabs.forEach(tab => { tab.removeEventListener('click', tab._listener); });
    
    const switchTab = (tab) => {
        playClick();
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Скрываем все вкладки
        itemsTab.style.display = 'none';
        equipmentTab.style.display = 'none';
        achievementsTab.style.display = 'none';
        housingTab.style.display = 'none';
        
        // Показываем нужную
        if (tab.dataset.tab === 'items') {
            itemsTab.style.display = 'flex';
            renderItemsTab();
        } else if (tab.dataset.tab === 'equipment') {
            equipmentTab.style.display = 'flex';
            renderEquipmentTab();
        } else if (tab.dataset.tab === 'achievements') {
            achievementsTab.style.display = 'flex';
            renderAchievementsTab();
        } else if (tab.dataset.tab === 'housing') {
            housingTab.style.display = 'flex';
            renderHousingTab();
        }
    };
    
    tabs.forEach(tab => {
        const handler = () => switchTab(tab);
        tab.addEventListener('click', handler);
        tab._listener = handler;
    });
    
    const activeTab = modal.querySelector('.tab-btn.active');
    if (activeTab) switchTab(activeTab);
    else if (tabs[0]) switchTab(tabs[0]);
}

// Функция escapeHtml для безопасности
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
