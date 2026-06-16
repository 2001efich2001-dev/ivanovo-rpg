// js/npcSystemUI.js
import { showMessage, logAction } from './utils.js';
import { npcDB, getNpcQuests, checkNpcQuestProgress, handleNpcChoice, getDialog, getItemStock, decreaseItemStock, checkAndRestockNpc, getQuestCooldownRemaining } from './npcSystem.js';
import { money, inventory, setStats, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';

let currentNpcId = null;
let currentDialogId = 'greeting';
let currentMode = 'dialog'; // 'dialog' | 'shop' | 'quest'

// ========== ОТКРЫТЬ NPC ==========
export async function openNpcDialog(npcId) {
    const npc = npcDB[npcId];
    if (!npc) {
        showMessage('NPC не найден', '#e74c3c');
        return;
    }
    
    currentNpcId = npcId;
    currentDialogId = 'greeting';
    currentMode = 'dialog';
    
    const modal = document.getElementById('npcModal');
    if (!modal) {
        console.error('NPC модальное окно не найдено');
        return;
    }
    
    document.getElementById('npcName').textContent = npc.name;
    document.getElementById('npcDescription').textContent = npc.description;
    const avatar = document.getElementById('npcAvatar');
    if (avatar) avatar.src = npc.avatar || 'images/npc/default.png';
    
    modal.style.display = 'flex';
    showDialog(npcId, 'greeting');
}

// ========== ПОКАЗАТЬ ДИАЛОГ ==========
function showDialog(npcId, dialogId) {
    const npc = npcDB[npcId];
    if (!npc) return;
    
    currentDialogId = dialogId;
    currentMode = 'dialog';
    
    const dialog = getDialog(npcId, dialogId);
    if (!dialog) {
        const greeting = getDialog(npcId, 'greeting');
        if (greeting) {
            document.getElementById('npcText').textContent = greeting.text;
            renderOptions(greeting.options);
        }
        return;
    }
    
    document.getElementById('npcText').textContent = dialog.text;
    renderOptions(dialog.options);
}

// ========== ПОКАЗАТЬ КНОПКИ ==========
function renderOptions(options) {
    const container = document.getElementById('npcOptions');
    container.innerHTML = '';
    
    if (!options || options.length === 0) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'npc-option-btn';
        closeBtn.textContent = '❌ Закрыть';
        closeBtn.addEventListener('click', () => closeNpcModal());
        container.appendChild(closeBtn);
        return;
    }
    
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'npc-option-btn';
        btn.textContent = option.text;
        btn.addEventListener('click', () => onNpcChoice(option.action));
        container.appendChild(btn);
    });
}

// ========== ОБРАБОТКА ВЫБОРА ==========
async function onNpcChoice(action) {
    const result = await handleNpcChoice(currentNpcId, action, window.auth?.currentUser?.uid);
    
    if (!result) {
        showMessage('Ошибка обработки выбора', '#e74c3c');
        return;
    }
    
    if (result.type === 'goodbye') {
        document.getElementById('npcText').textContent = result.text;
        renderOptions([{ text: '❌ Закрыть', action: 'close' }]);
        return;
    }
    
    if (result.type === 'shop') {
        if (result.mode === 'buy') {
            await showNpcShop('buy');
        } else if (result.mode === 'sell') {
            await showNpcShop('sell');
        }
        return;
    }
    
    if (result.type === 'quest') {
        await showNpcQuests();
        return;
    }
    
    if (result.text) {
        document.getElementById('npcText').textContent = result.text;
        renderOptions(result.options);
    }
}

// ========== ПОКАЗАТЬ МАГАЗИН NPC ==========
async function showNpcShop(mode) {
    const npc = npcDB[currentNpcId];
    if (!npc) return;
    
    // Проверяем обновление стока
    checkAndRestockNpc(currentNpcId);
    
    currentMode = 'shop';
    const container = document.getElementById('npcShop');
    const itemsContainer = container.querySelector('.npc-shop-items');
    
    container.style.display = 'block';
    document.getElementById('npcOptions').innerHTML = '';
    document.getElementById('npcText').textContent = mode === 'buy' 
        ? '🛍️ Вот что у меня есть для продажи:' 
        : '💰 Что хочешь продать?';
    
    let items = mode === 'buy' ? npc.shop_items : npc.buy_items;
    let html = '<div class="shop-grid">';
    
    for (const item of items) {
        const itemData = itemsDB[item.id];
        if (!itemData) continue;
        
        const price = item.price;
        let stock = '∞';
        let isAvailable = true;
        
        if (mode === 'buy') {
            stock = getItemStock(currentNpcId, item.id);
            isAvailable = stock > 0;
        }
        
        const count = mode === 'sell' ? (inventory.find(i => i.id === item.id)?.count || 0) : stock;
        
        html += `
            <div class="shop-item">
                <span>${itemData.icon} ${itemData.name}</span>
                <span>${price}₽</span>
                <span class="shop-stock">(${count})</span>
                <button class="shop-trade-btn" data-id="${item.id}" data-price="${price}" data-mode="${mode}" ${!isAvailable ? 'disabled style="opacity:0.5;"' : ''}>
                    ${mode === 'buy' ? (isAvailable ? '🛍️ Купить' : '❌ Закончился') : '💰 Продать'}
                </button>
            </div>
        `;
    }
    
    html += '</div>';
    itemsContainer.innerHTML = html;
    
    // Обработчики кнопок
    document.querySelectorAll('.shop-trade-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemId = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const modeType = btn.dataset.mode;
            
            if (modeType === 'buy') {
                const currentStock = getItemStock(currentNpcId, itemId);
                if (currentStock <= 0) {
                    showMessage('❌ Товар закончился!', '#e74c3c');
                    return;
                }
                
                if (money < price) {
                    showMessage(`❌ Не хватает денег! Нужно ${price}₽`, '#e74c3c');
                    return;
                }
                
                // Уменьшаем сток
                decreaseItemStock(currentNpcId, itemId);
                
                const newMoney = money - price;
                setStats(null, null, null, newMoney);
                
                const existingItem = inventory.find(i => i.id === itemId);
                if (existingItem) {
                    existingItem.count++;
                } else {
                    inventory.push({ id: itemId, count: 1 });
                }
                
                const itemName = itemsDB[itemId]?.name || itemId;
                showMessage(`🛍️ Вы купили ${itemName} за ${price}₽`, '#4caf50');
                logAction(`Куплено у NPC: ${itemName} за ${price}₽`, 'economy');
            } else {
                const itemIndex = inventory.findIndex(i => i.id === itemId);
                if (itemIndex === -1 || inventory[itemIndex].count === 0) {
                    showMessage(`❌ У вас нет этого предмета`, '#e74c3c');
                    return;
                }
                
                const newMoney = money + price;
                setStats(null, null, null, newMoney);
                
                if (inventory[itemIndex].count === 1) {
                    inventory.splice(itemIndex, 1);
                } else {
                    inventory[itemIndex].count--;
                }
                
                const itemName = itemsDB[itemId]?.name || itemId;
                showMessage(`💰 Вы продали ${itemName} за ${price}₽`, '#4caf50');
                logAction(`Продано NPC: ${itemName} за ${price}₽`, 'economy');
            }
            
            await saveGameData();
            updateUI();
            await showNpcShop(mode);
        });
    });
    
    const backBtn = document.createElement('button');
    backBtn.className = 'npc-option-btn';
    backBtn.textContent = '🔙 Назад к диалогу';
    backBtn.style.marginTop = '12px';
    backBtn.addEventListener('click', () => {
        document.getElementById('npcShop').style.display = 'none';
        showDialog(currentNpcId, 'greeting');
    });
    document.getElementById('npcOptions').appendChild(backBtn);
}

// ========== ПОКАЗАТЬ КВЕСТЫ NPC ==========
async function showNpcQuests() {
    const npc = npcDB[currentNpcId];
    if (!npc) return;
    
    currentMode = 'quest';
    const container = document.getElementById('npcQuestList');
    container.style.display = 'block';
    document.getElementById('npcShop').style.display = 'none';
    document.getElementById('npcOptions').innerHTML = '';
    document.getElementById('npcText').textContent = '📜 Вот что я могу тебе предложить:';
    
    const quests = getNpcQuests(currentNpcId);
    
    if (quests.length === 0) {
        document.getElementById('npcText').textContent = '📜 У меня пока нет для тебя заданий. Зайди позже!';
        const backBtn = document.createElement('button');
        backBtn.className = 'npc-option-btn';
        backBtn.textContent = '🔙 Назад';
        backBtn.addEventListener('click', () => {
            document.getElementById('npcQuestList').style.display = 'none';
            showDialog(currentNpcId, 'greeting');
        });
        document.getElementById('npcOptions').appendChild(backBtn);
        return;
    }
    
    let html = '<div class="quest-grid">';
    for (const quest of quests) {
        html += `
            <div class="quest-item">
                <div class="quest-name">${quest.name}</div>
                <div class="quest-desc">${quest.description}</div>
                <div class="quest-reward">
                    ${quest.reward.money ? `💰 ${quest.reward.money}₽ ` : ''}
                    ${quest.reward.exp ? `⭐ +${quest.reward.exp} ` : ''}
                    ${quest.reward.item ? `🎁 ${itemsDB[quest.reward.item]?.name || quest.reward.item}` : ''}
                </div>
                <button class="quest-accept-btn" data-quest-id="${quest.id}">✅ Выполнить задание</button>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    document.querySelectorAll('.quest-accept-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const questId = btn.dataset.questId;
            const success = await checkNpcQuestProgress(currentNpcId, questId);
            if (success) {
                await showNpcQuests();
                showDialog(currentNpcId, 'greeting');
            }
        });
    });
    
    const backBtn = document.createElement('button');
    backBtn.className = 'npc-option-btn';
    backBtn.textContent = '🔙 Назад';
    backBtn.style.marginTop = '12px';
    backBtn.addEventListener('click', () => {
        document.getElementById('npcQuestList').style.display = 'none';
        showDialog(currentNpcId, 'greeting');
    });
    document.getElementById('npcOptions').appendChild(backBtn);
}

// ========== ЗАКРЫТЬ NPC ==========
function closeNpcModal() {
    document.getElementById('npcModal').style.display = 'none';
    document.getElementById('npcShop').style.display = 'none';
    document.getElementById('npcQuestList').style.display = 'none';
    currentNpcId = null;
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
export function initNpcUI() {
    const closeBtn = document.getElementById('closeNpcBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNpcModal);
    }
    
    const modal = document.getElementById('npcModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeNpcModal();
        });
    }
}
