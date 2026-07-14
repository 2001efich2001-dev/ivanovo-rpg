// js/mandates.js
import { db } from './firestore.js';
import { collection, doc, getDocs, getDoc, updateDoc, setDoc, query, where } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';
import { addMandateToInventory, addDeputyTitle, removeDeputyTitle } from './mandateItems.js';

const TOTAL_MANDATES = 20;
const PURCHASABLE_START = 11;
const PURCHASE_PRICE = 1000000;

// ========== ПОЛУЧИТЬ ВСЕ МАНДАТЫ ==========
export async function getAllMandates() {
    try {
        const snapshot = await getDocs(collection(db, 'mandates'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Ошибка загрузки мандатов:', error);
        return [];
    }
}

// ========== ПОЛУЧИТЬ МАНДАТ ПО НОМЕРУ ==========
export async function getMandate(number) {
    try {
        const docRef = doc(db, 'mandates', `mandate_${number}`);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error(`Ошибка загрузки мандата ${number}:`, error);
        return null;
    }
}

// ========== ПОЛУЧИТЬ МАНДАТЫ ИГРОКА ==========
export async function getPlayerMandates(uid) {
    try {
        const snapshot = await getDocs(collection(db, 'mandates'));
        return snapshot.docs
            .filter(doc => doc.data().ownerId === uid && doc.data().isActive === true)
            .map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Ошибка загрузки мандатов игрока:', error);
        return [];
    }
}

// ========== ПРОВЕРИТЬ, ЯВЛЯЕТСЯ ЛИ ИГРОК ДЕПУТАТОМ ==========
export async function isDeputy(uid) {
    try {
        const mandates = await getPlayerMandates(uid);
        return mandates.length > 0;
    } catch (error) {
        console.error('Ошибка проверки депутата:', error);
        return false;
    }
}

// ========== ВЫДАТЬ МАНДАТ ИГРОКУ ==========
export async function assignMandate(number, uid, userName, type = 'elected') {
    try {
        const mandateRef = doc(db, 'mandates', `mandate_${number}`);
        const mandateSnap = await getDoc(mandateRef);
        
        if (!mandateSnap.exists()) {
            throw new Error(`Мандат №${number} не найден`);
        }
        
        const data = mandateSnap.data();
        if (data.ownerId) {
            throw new Error(`Мандат №${number} уже занят`);
        }
        
        const now = new Date().toISOString();
        await updateDoc(mandateRef, {
            ownerId: uid,
            ownerName: userName,
            type: type,
            acquiredAt: now,
            isActive: true
        });
        
        // ===== ДОБАВЛЯЕМ МАНДАТ В ИНВЕНТАРЬ =====
        addMandateToInventory(number, type);
        
        // ===== ДОБАВЛЯЕМ ТИТУЛ (С СИНХРОНИЗАЦИЕЙ) =====
        await addDeputyTitle(uid);
        
        console.log(`✅ Мандат №${number} выдан ${userName}`);
        return true;
    } catch (error) {
        console.error('Ошибка выдачи мандата:', error);
        throw error;
    }
}

// ========== СНЯТЬ МАНДАТ ==========
export async function revokeMandate(number) {
    try {
        const mandateRef = doc(db, 'mandates', `mandate_${number}`);
        const mandateSnap = await getDoc(mandateRef);
        
        if (!mandateSnap.exists()) {
            throw new Error(`Мандат №${number} не найден`);
        }
        
        const data = mandateSnap.data();
        if (!data.ownerId) {
            throw new Error(`Мандат №${number} и так свободен`);
        }
        
        const ownerId = data.ownerId;
        
        await updateDoc(mandateRef, {
            ownerId: null,
            ownerName: null,
            acquiredAt: null,
            isActive: false
        });
        
        // Проверяем, есть ли у игрока ещё мандаты
        const playerMandates = await getPlayerMandates(ownerId);
        if (playerMandates.length === 0) {
            await removeDeputyTitle(ownerId);
        }
        
        console.log(`✅ Мандат №${number} снят`);
        return true;
    } catch (error) {
        console.error('Ошибка снятия мандата:', error);
        throw error;
    }
}

// ========== КУПИТЬ МАНДАТ ==========
export async function purchaseMandate(number, uid, userName, money) {
    try {
        // Проверяем, доступен ли мандат для покупки
        if (number < PURCHASABLE_START) {
            throw new Error('Этот мандат можно только получить на выборах');
        }
        
        const mandate = await getMandate(number);
        if (!mandate) {
            throw new Error(`Мандат №${number} не найден`);
        }
        
        if (mandate.ownerId) {
            throw new Error(`Мандат №${number} уже занят`);
        }
        
        if (money < PURCHASE_PRICE) {
            throw new Error(`Не хватает денег! Нужно ${PURCHASE_PRICE}₽`);
        }
        
        // Выдаём мандат
        await assignMandate(number, uid, userName, 'purchasable');
        
        // Списываем деньги (через gameState)
        const gameState = await import('./gameState.js');
        const newMoney = money - PURCHASE_PRICE;
        gameState.setStats(null, null, null, newMoney);
        await saveGameData();
        
        return true;
    } catch (error) {
        console.error('Ошибка покупки мандата:', error);
        throw error;
    }
}

// ========== СБРОСИТЬ ВСЕ МАНДАТЫ (ПЕРЕД НОВЫМИ ВЫБОРАМИ) ==========
export async function resetAllMandates() {
    try {
        const snapshot = await getDocs(collection(db, 'mandates'));
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const oldOwnerId = data.ownerId;
            
            await updateDoc(docSnap.ref, {
                ownerId: null,
                ownerName: null,
                acquiredAt: null,
                isActive: false
            });
            
            // Если у игрока больше нет мандатов — снимаем титул
            if (oldOwnerId) {
                const playerMandates = await getPlayerMandates(oldOwnerId);
                if (playerMandates.length === 0) {
                    await removeDeputyTitle(oldOwnerId);
                }
            }
        }
        
        console.log('✅ Все мандаты сброшены');
        return true;
    } catch (error) {
        console.error('Ошибка сброса мандатов:', error);
        throw error;
    }
}

// ========== ПОЛУЧИТЬ АКТИВНЫХ ДЕПУТАТОВ ==========
export async function getActiveDeputies() {
    try {
        const snapshot = await getDocs(collection(db, 'mandates'));
        const deputies = [];
        
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.ownerId && data.isActive) {
                deputies.push({
                    number: data.number,
                    ownerId: data.ownerId,
                    ownerName: data.ownerName || 'Аноним',
                    type: data.type || 'elected',
                    acquiredAt: data.acquiredAt
                });
            }
        }
        
        // Сортируем по номеру мандата
        return deputies.sort((a, b) => a.number - b.number);
    } catch (error) {
        console.error('Ошибка загрузки депутатов:', error);
        return [];
    }
}

// ========== ПОЛУЧИТЬ ДОСКУ ДЕПУТАТОВ (20 мест) ==========
export async function getDeputyBoard() {
    const deputies = await getActiveDeputies();
    const board = [];
    
    for (let i = 1; i <= TOTAL_MANDATES; i++) {
        const deputy = deputies.find(d => d.number === i);
        board.push({
            number: i,
            isOccupied: !!deputy,
            ownerId: deputy?.ownerId || null,
            ownerName: deputy?.ownerName || null,
            type: deputy?.type || null,
            isPurchasable: i >= PURCHASABLE_START
        });
    }
    
    return board;
}

// ========== ОТКРЫТЬ МОДАЛЬНОЕ ОКНО ПОКУПКИ МАНДАТА ==========
export async function openMandatePurchase() {
    const user = window.auth?.currentUser;
    if (!user) {
        showMessage('❌ Вы не авторизованы!', '#e74c3c');
        return;
    }
    
    // Проверяем, есть ли уже мандаты
    const playerMandates = await getPlayerMandates(user.uid);
    if (playerMandates.length > 0) {
        showMessage('❌ У вас уже есть мандаты! Нельзя купить больше одного.', '#e74c3c');
        return;
    }
    
    // Проверяем, идут ли выборы
    const { isElectionPeriod } = await import('./elections.js');
    if (isElectionPeriod()) {
        showMessage('⚠️ Сейчас идут выборы (1-5 число). Дождитесь их завершения!', '#ffd966');
        return;
    }
    
    // Получаем доступные мандаты для покупки
    const allMandates = await getAllMandates();
    const available = allMandates.filter(m => 
        !m.ownerId && 
        m.number >= 11 && 
        m.number <= 20
    );
    
    if (available.length === 0) {
        showMessage('❌ Нет доступных мандатов для покупки', '#e74c3c');
        return;
    }
    
    const gameState = await import('./gameState.js');
    const currentMoney = gameState.money || 0;
    
    if (currentMoney < PURCHASE_PRICE) {
        showMessage(`❌ Не хватает денег! Нужно ${PURCHASE_PRICE.toLocaleString()}₽, у вас ${currentMoney.toLocaleString()}₽`, '#e74c3c');
        return;
    }
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '10050';
    
    let html = `
        <div class="modal-content" style="max-width: 500px;">
            <h3>💰 Покупка мандата</h3>
            <p style="color: var(--text-secondary);">Выберите мандат для покупки:</p>
            <p style="color: #ffd966;">💰 Ваши деньги: ${currentMoney.toLocaleString()}₽</p>
            <p style="color: #4caf50;">💳 Цена: ${PURCHASE_PRICE.toLocaleString()}₽</p>
            <div style="margin: 15px 0; max-height: 300px; overflow-y: auto;">
    `;
    
    for (const mandate of available) {
        html += `
            <button class="mandate-buy-option" data-number="${mandate.number}" style="
                display: block;
                width: 100%;
                padding: 12px 16px;
                margin: 8px 0;
                background: var(--stat-bg);
                border: 1px solid var(--card-border);
                border-radius: 16px;
                color: var(--text-primary);
                cursor: pointer;
                text-align: left;
                font-size: 1rem;
                transition: all 0.2s ease;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>📜 Мандат №${mandate.number}</span>
                    <span style="color: #ffd966;">${PURCHASE_PRICE.toLocaleString()}₽</span>
                </div>
            </button>
        `;
    }
    
    html += `
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="cancelPurchaseBtn" class="reset-btn" style="flex: 1;">Отмена</button>
            </div>
        </div>
    `;
    
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    // Обработчики для кнопок покупки
    modal.querySelectorAll('.mandate-buy-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const number = parseInt(btn.dataset.number);
            try {
                await purchaseMandate(number, user.uid, user.displayName || 'Игрок', currentMoney);
                modal.remove();
                showMessage(`✅ Мандат №${number} успешно куплен!`, '#4caf50');
                // Обновляем инвентарь
                const { renderMandatesTab, renderTitlesTab, renderItemsTab } = await import('./inventory.js');
                renderMandatesTab();
                renderTitlesTab();
                renderItemsTab();
            } catch (error) {
                showMessage(`❌ Ошибка: ${error.message}`, '#e74c3c');
            }
        });
        
        btn.addEventListener('mouseenter', (e) => {
            e.target.style.background = 'var(--card-bg)';
            e.target.style.borderColor = '#ffd966';
        });
        btn.addEventListener('mouseleave', (e) => {
            e.target.style.background = 'var(--stat-bg)';
            e.target.style.borderColor = 'var(--card-border)';
        });
    });
    
    modal.querySelector('#cancelPurchaseBtn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}
