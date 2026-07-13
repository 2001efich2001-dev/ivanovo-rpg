// js/mandates.js
import { db } from './firestore.js';
import { collection, doc, getDocs, getDoc, updateDoc, setDoc, query, where } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { saveGameData } from './firestore.js';
import { showMessage } from './utils.js';

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
        
        // Добавляем титул (бейджик) игроку
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
        
        await updateDoc(mandateRef, {
            ownerId: null,
            ownerName: null,
            acquiredAt: null,
            isActive: false
        });
        
        // Проверяем, есть ли у игрока ещё мандаты
        const playerMandates = await getPlayerMandates(data.ownerId);
        if (playerMandates.length === 0) {
            await removeDeputyTitle(data.ownerId);
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
        const now = new Date().toISOString();
        
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

// ========== ДОБАВИТЬ ТИТУЛ "ДЕПУТАТ" ==========
async function addDeputyTitle(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return;
        
        const data = userSnap.data();
        const titles = data.titles || {};
        const owned = titles.owned || [];
        
        if (!owned.includes('👑 Депутат')) {
            owned.push('👑 Депутат');
            await updateDoc(userRef, {
                'titles.owned': owned
            });
            console.log(`👑 Титул "Депутат" добавлен игроку ${uid}`);
        }
    } catch (error) {
        console.error('Ошибка добавления титула:', error);
    }
}

// ========== СНЯТЬ ТИТУЛ "ДЕПУТАТ" ==========
async function removeDeputyTitle(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) return;
        
        const data = userSnap.data();
        const titles = data.titles || {};
        const owned = titles.owned || [];
        
        const index = owned.indexOf('👑 Депутат');
        if (index !== -1) {
            owned.splice(index, 1);
            await updateDoc(userRef, {
                'titles.owned': owned
            });
            console.log(`👑 Титул "Депутат" снят у игрока ${uid}`);
        }
    } catch (error) {
        console.error('Ошибка снятия титула:', error);
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
