
// js/mandateItems.js
import { inventory, ownedTitles, currentTitle, setCurrentTitle, money, setStats, updateUI, addLogEntry } from './gameState.js';
import { saveGameData, db } from './firestore.js';
import { showMessage } from './utils.js';
import { itemsDB } from './inventory.js';
import { doc, updateDoc, getDoc, deleteField } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';

// ========== ДОБАВИТЬ МАНДАТ В ИНВЕНТАРЬ ==========
export function addMandateToInventory(mandateNumber, type = 'elected') {
    // Проверяем, есть ли уже такой мандат
    const existing = inventory.find(item => item.id === 'mandate' && item.mandateNumber === mandateNumber);
    if (existing) {
        existing.count = (existing.count || 1) + 1;
        saveGameData();
        return true;
    }
    
    inventory.push({
        id: 'mandate',
        count: 1,
        mandateNumber: mandateNumber,
        type: type,
        acquiredAt: new Date().toISOString()
    });
    
    saveGameData();
    console.log(`📜 Мандат №${mandateNumber} добавлен в инвентарь`);
    return true;
}

// ========== УДАЛИТЬ МАНДАТ ИЗ ИНВЕНТАРЯ ==========
export function removeMandateFromInventory(mandateNumber) {
    const index = inventory.findIndex(item => item.id === 'mandate' && item.mandateNumber === mandateNumber);
    if (index === -1) return false;
    
    if (inventory[index].count <= 1) {
        inventory.splice(index, 1);
    } else {
        inventory[index].count--;
    }
    
    saveGameData();
    console.log(`📜 Мандат №${mandateNumber} удалён из инвентаря`);
    return true;
}

// ========== ПРОВЕРИТЬ, ЕСТЬ ЛИ МАНДАТ ==========
export function hasMandate(mandateNumber) {
    return inventory.some(item => item.id === 'mandate' && item.mandateNumber === mandateNumber);
}

// ========== ПОЛУЧИТЬ ВСЕ МАНДАТЫ ИГРОКА ==========
export function getPlayerMandates() {
    return inventory.filter(item => item.id === 'mandate');
}

// ========== ДОБАВИТЬ ТИТУЛ ДЕПУТАТА ==========
export async function addDeputyTitle(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return false;
        
        const userData = userSnap.data();
        let titles = userData.titles || [];
        
        // Если titles — объект (старый формат), конвертируем в массив
        if (!Array.isArray(titles)) {
            titles = titles.owned || [];
        }
        
        // Добавляем титул, если его нет
        if (!titles.includes('👑 Депутат')) {
            titles.push('👑 Депутат');
            await updateDoc(userRef, {
                titles: titles
            });
            
            // Синхронизируем с gameState
            if (!ownedTitles.includes('👑 Депутат')) {
                ownedTitles.push('👑 Депутат');
                if (!currentTitle) {
                    setCurrentTitle('👑 Депутат');
                }
                updateUI();
                console.log(`👑 Титул "Депутат" добавлен игроку ${uid}`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Ошибка добавления титула:', error);
        return false;
    }
}

// ========== СНЯТЬ ТИТУЛ ДЕПУТАТА ==========
export async function removeDeputyTitle(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return false;
        
        const userData = userSnap.data();
        let titles = userData.titles || [];
        
        if (!Array.isArray(titles)) {
            titles = titles.owned || [];
        }
        
        const index = titles.indexOf('👑 Депутат');
        if (index !== -1) {
            titles.splice(index, 1);
            await updateDoc(userRef, {
                titles: titles
            });
            
            // Синхронизируем с gameState
            const localIndex = ownedTitles.indexOf('👑 Депутат');
            if (localIndex !== -1) {
                ownedTitles.splice(localIndex, 1);
                if (currentTitle === '👑 Депутат') {
                    setCurrentTitle(ownedTitles.length > 0 ? ownedTitles[0] : null);
                }
                updateUI();
                console.log(`👑 Титул "Депутат" снят у игрока ${uid}`);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Ошибка снятия титула:', error);
        return false;
    }
}

// ========== ПРОДАТЬ МАНДАТ ГОРОДУ ==========
export async function sellMandateToCity(mandateNumber, price = 100000) {
    // Проверяем, есть ли мандат
    if (!hasMandate(mandateNumber)) {
        showMessage('❌ У вас нет такого мандата!', '#e74c3c');
        return false;
    }
    
    // Проверяем, не является ли мандат выборным (первые 10 — только через выборы)
    if (mandateNumber <= 10) {
        showMessage('❌ Выборные мандаты (№1-10) нельзя продать!', '#e74c3c');
        return false;
    }
    
    // Удаляем из инвентаря
    const removed = removeMandateFromInventory(mandateNumber);
    if (!removed) return false;
    
    // Добавляем деньги
    const newMoney = money + price;
    setStats(null, null, null, newMoney);
    
    // Проверяем, есть ли ещё мандаты
    const remaining = getPlayerMandates();
    if (remaining.length === 0) {
        const user = window.auth?.currentUser;
        if (user) {
            await removeDeputyTitle(user.uid);
        }
    }
    
    // Освобождаем мандат в Firestore
    try {
        const mandateRef = doc(db, 'mandates', `mandate_${mandateNumber}`);
        await updateDoc(mandateRef, {
            ownerId: null,
            ownerName: null,
            acquiredAt: null,
            isActive: false
        });
    } catch (error) {
        console.error('Ошибка освобождения мандата:', error);
    }
    
    updateUI();
    await saveGameData();
    
    showMessage(`💰 Мандат №${mandateNumber} продан за ${price.toLocaleString()}₽`, '#4caf50');
    addLogEntry(`📜 Мандат №${mandateNumber} продан городу за ${price.toLocaleString()}₽`, 'economy');
    return true;
}

// ========== ПРОВЕРИТЬ, ЯВЛЯЕТСЯ ЛИ ИГРОК ДЕПУТАТОМ (ЛОКАЛЬНО) ==========
export function isDeputyLocal() {
    return inventory.some(item => item.id === 'mandate');
}

// ========== СИНХРОНИЗИРОВАТЬ МАНДАТЫ ИЗ FIRESTORE ==========
export async function syncMandatesFromFirestore(uid) {
    try {
        const { getPlayerMandates: getFirestoreMandates } = await import('./mandates.js');
        const firestoreMandates = await getFirestoreMandates(uid);
        
        // Удаляем все локальные мандаты
        const toRemove = [];
        for (const item of inventory) {
            if (item.id === 'mandate') {
                toRemove.push(item);
            }
        }
        for (const item of toRemove) {
            const index = inventory.indexOf(item);
            if (index !== -1) inventory.splice(index, 1);
        }
        
        // Добавляем мандаты из Firestore
        for (const mandate of firestoreMandates) {
            addMandateToInventory(mandate.number, mandate.type || 'elected');
        }
        
        // Проверяем титул
        const hasMandates = firestoreMandates.length > 0;
        const hasTitle = ownedTitles.includes('👑 Депутат');
        
        if (hasMandates && !hasTitle) {
            await addDeputyTitle(uid);
        } else if (!hasMandates && hasTitle) {
            await removeDeputyTitle(uid);
        }
        
        console.log(`🔄 Синхронизировано ${firestoreMandates.length} мандатов`);
        updateUI();
        return firestoreMandates;
    } catch (error) {
        console.error('Ошибка синхронизации мандатов:', error);
        return [];
    }
}
// ========== СИНХРОНИЗИРОВАТЬ МАНДАТЫ ИЗ FIRESTORE ==========
export async function syncMandatesFromFirestore(uid) {
    try {
        const { getPlayerMandates: getFirestoreMandates } = await import('./mandates.js');
        const firestoreMandates = await getFirestoreMandates(uid);
        
        // Удаляем все локальные мандаты
        const toRemove = [];
        for (const item of inventory) {
            if (item.id === 'mandate') {
                toRemove.push(item);
            }
        }
        for (const item of toRemove) {
            const index = inventory.indexOf(item);
            if (index !== -1) inventory.splice(index, 1);
        }
        
        // Добавляем мандаты из Firestore
        for (const mandate of firestoreMandates) {
            addMandateToInventory(mandate.number, mandate.type || 'elected');
        }
        
        // Проверяем титул
        const hasMandates = firestoreMandates.length > 0;
        const hasTitle = ownedTitles.includes('👑 Депутат');
        
        if (hasMandates && !hasTitle) {
            await addDeputyTitle(uid);
        } else if (!hasMandates && hasTitle) {
            await removeDeputyTitle(uid);
        }
        
        console.log(`🔄 Синхронизировано ${firestoreMandates.length} мандатов из Firestore`);
        updateUI();
        return firestoreMandates;
    } catch (error) {
        console.error('Ошибка синхронизации мандатов:', error);
        return [];
    }
}
