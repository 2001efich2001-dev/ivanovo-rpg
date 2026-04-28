import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { 
    health, hunger, cold, money, inventory, equipped, setStats, updateUI, 
    accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, 
    getActionLog, setActionLog, experience, level, setExpData, energy, setEnergy,
    setLastEnergyUpdate  
} from './gameState.js';
import { showMessage } from './utils.js';

let db = null;

export function initFirestore(auth) {
    db = getFirestore(auth.app);
}

export async function saveGameData() {
    const user = window.auth?.currentUser;
    if (!user || !db) return;
    
    const { currentLocation, lastEnergyUpdate } = await import('./gameState.js');
    
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, {
        health, hunger, cold, money, inventory, equipped,
        accumulatedMinutes,
        currentWeather,
        currentTemperature,
        currentLocation: currentLocation || 'church',
        actionLog: getActionLog(),
        experience,
        level,
        energy,
        lastEnergyUpdate,
        lastUpdated: new Date().toISOString()
    }, { merge: true });
    console.log("Данные сохранены");
}

export async function loadGameData(userId) {
    if (!userId || !db) return;
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        setStats(data.health ?? 100, data.hunger ?? 100, data.cold ?? 100, data.money ?? 200);
        inventory.length = 0;
        inventory.push(...(data.inventory ?? []));
        Object.assign(equipped, data.equipped ?? { head: null, body: null, legs: null, feet: null });
        
        const minutes = data.accumulatedMinutes ?? 0;
        const weather = data.currentWeather ?? 'sunny';
        const temp = data.currentTemperature ?? 15;
        setTimeWeather(minutes, weather, temp);
        
        setActionLog(data.actionLog ?? []);
        setExpData(data.experience ?? 0, data.level ?? 1);
        
        const savedEnergy = data.energy ?? 100;
        setEnergy(savedEnergy);
        
       const savedLastUpdate = data.lastEnergyUpdate ?? Date.now();
setLastEnergyUpdate(savedLastUpdate);
        
        const savedLocation = data.currentLocation || 'church';
        const { setCurrentLocation } = await import('./gameState.js');
        setCurrentLocation(savedLocation);
        
        updateUI();
        console.log("Данные загружены");
    } else {
        setStats(100, 100, 100, 200);
        inventory.push(
            { id: "bread", count: 2 }, { id: "vodka", count: 1 }, { id: "cigarettes", count: 1 },
            { id: "medkit", count: 1 }, { id: "ushanka", count: 1 }, { id: "puhovik", count: 1 }
        );
        Object.assign(equipped, { head: null, body: null, legs: null, feet: null });
        setTimeWeather(720, 'sunny', 15);
        setActionLog([]);
        setExpData(0, 1);
        setEnergy(100);
        const { setCurrentLocation } = await import('./gameState.js');
        setCurrentLocation('church');
        updateUI();
        await saveGameData();
        showMessage('Новый аккаунт создан', '#4caf50');
    }
}

// ========== ТОРГОВЛЯ МЕЖДУ ИГРОКАМИ ==========

// Создание предложения обмена
export async function createTradeOffer(fromUserId, fromUserNick, toUserId, toUserNick, fromItems, fromMoney, toItems, toMoney) {
    if (!db) return null;
    const offer = {
        fromUserId,
        fromUserNick,
        toUserId,
        toUserNick,
        fromItems: fromItems || [],
        fromMoney: fromMoney || 0,
        toItems: toItems || [],
        toMoney: toMoney || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 часа
    };
    const docRef = await addDoc(collection(db, 'trade_offers'), offer);
    return docRef.id;
}

// Получение входящих предложений для пользователя
export async function getIncomingTradeOffers(userId) {
    if (!db) return [];
    const q = query(collection(db, 'trade_offers'), where('toUserId', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Получение исходящих предложений
export async function getOutgoingTradeOffers(userId) {
    if (!db) return [];
    const q = query(collection(db, 'trade_offers'), where('fromUserId', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Отзыв предложения (только для отправителя)
export async function cancelTradeOffer(offerId, userId) {
    if (!db) return false;
    const offerRef = doc(db, 'trade_offers', offerId);
    const offerSnap = await getDoc(offerRef);
    if (!offerSnap.exists()) return false;
    const data = offerSnap.data();
    if (data.fromUserId !== userId) {
        showMessage('Вы можете отозвать только свои предложения', '#e74c3c');
        return false;
    }
    if (data.status !== 'pending') {
        showMessage('Это предложение уже неактивно', '#e74c3c');
        return false;
    }
    await updateDoc(offerRef, { status: 'cancelled' });
    return true;
}

// Принятие предложения (транзакция)
// Принятие предложения (транзакция)
// Принятие предложения (транзакция)
export async function acceptTradeOffer(offerId, userId) {
    if (!db) return false;
    
    try {
        const result = await runTransaction(db, async (transaction) => {
            const offerRef = doc(db, 'trade_offers', offerId);
            const offerSnap = await transaction.get(offerRef);
            if (!offerSnap.exists()) throw new Error('Предложение не найдено');
            
            const offer = offerSnap.data();
            if (offer.status !== 'pending') throw new Error('Предложение уже обработано');
            if (offer.toUserId !== userId) throw new Error('Вы не получатель этого предложения');
            if (new Date(offer.expiresAt) < new Date()) throw new Error('Срок предложения истёк');
            
            // ===== ВАЖНО: приводим деньги к числам (могут приходить как строки) =====
            const fromMoneyNum = Number(offer.fromMoney) || 0;
            const toMoneyNum = Number(offer.toMoney) || 0;
            
            console.log('💰 fromMoneyNum:', fromMoneyNum, 'toMoneyNum:', toMoneyNum);
            
            // Получаем данные отправителя и получателя
            const fromUserRef = doc(db, 'users', offer.fromUserId);
            const toUserRef = doc(db, 'users', offer.toUserId);
            const fromUserSnap = await transaction.get(fromUserRef);
            const toUserSnap = await transaction.get(toUserRef);
            
            if (!fromUserSnap.exists() || !toUserSnap.exists()) throw new Error('Пользователь не найден');
            
            const fromUserData = fromUserSnap.data();
            const toUserData = toUserSnap.data();
            
            console.log('👤 Отправитель до:', { money: fromUserData.money, inventory: fromUserData.inventory });
            console.log('👤 Получатель до:', { money: toUserData.money, inventory: toUserData.inventory });
            
            // Копируем инвентари (глубокое копирование)
            let fromInventory = (fromUserData.inventory || []).map(i => ({ ...i }));
            let toInventory = (toUserData.inventory || []).map(i => ({ ...i }));
            
            // ===== 1. ПРОВЕРКА: у отправителя есть предметы из offer.fromItems =====
            for (const item of offer.fromItems || []) {
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || fromInventory[idx].count < (item.count || 1)) {
                    throw new Error(`У отправителя нет ${item.count || 1} шт. ${item.id}`);
                }
            }
            
            // ===== 2. ПРОВЕРКА: у получателя есть предметы из offer.toItems =====
            for (const item of offer.toItems || []) {
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || toInventory[idx].count < (item.count || 1)) {
                    throw new Error(`У вас нет ${item.count || 1} шт. ${item.id}`);
                }
            }
            
            // ===== 3. ПРОВЕРКА ДЕНЕГ =====
            const fromCurrentMoney = fromUserData.money || 0;
            const toCurrentMoney = toUserData.money || 0;
            
            if (fromMoneyNum > 0 && fromCurrentMoney < fromMoneyNum) {
                throw new Error(`У отправителя недостаточно денег (нужно ${fromMoneyNum}₽)`);
            }
            if (toMoneyNum > 0 && toCurrentMoney < toMoneyNum) {
                throw new Error(`У вас недостаточно денег (нужно ${toMoneyNum}₽)`);
            }
            
            // ===== 4. ОБНОВЛЕНИЕ ИНВЕНТАРЯ ОТПРАВИТЕЛЯ =====
            // Списать offer.fromItems (отдаёт)
            for (const item of offer.fromItems || []) {
                const itemCount = item.count || 1;
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (fromInventory[idx].count === itemCount) {
                    fromInventory.splice(idx, 1);
                } else {
                    fromInventory[idx].count -= itemCount;
                }
            }
            // Добавить offer.toItems (получает)
            for (const item of offer.toItems || []) {
                const itemCount = item.count || 1;
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    fromInventory[idx].count += itemCount;
                } else {
                    fromInventory.push({ id: item.id, count: itemCount });
                }
            }
            
            // ===== 5. ОБНОВЛЕНИЕ ИНВЕНТАРЯ ПОЛУЧАТЕЛЯ =====
            // Списать offer.toItems (отдаёт)
            for (const item of offer.toItems || []) {
                const itemCount = item.count || 1;
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (toInventory[idx].count === itemCount) {
                    toInventory.splice(idx, 1);
                } else {
                    toInventory[idx].count -= itemCount;
                }
            }
            // Добавить offer.fromItems (получает)
            for (const item of offer.fromItems || []) {
                const itemCount = item.count || 1;
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    toInventory[idx].count += itemCount;
                } else {
                    toInventory.push({ id: item.id, count: itemCount });
                }
            }
            
            // ===== 6. ОБНОВЛЕНИЕ ДЕНЕГ =====
            const fromNewMoney = fromCurrentMoney - fromMoneyNum + toMoneyNum;
            const toNewMoney = toCurrentMoney - toMoneyNum + fromMoneyNum;
            
            console.log('💰 После расчёта:', { fromNewMoney, toNewMoney });
            console.log('📦 fromInventory после:', JSON.stringify(fromInventory));
            console.log('📦 toInventory после:', JSON.stringify(toInventory));
            
            // ===== 7. СОХРАНЕНИЕ =====
            transaction.update(fromUserRef, { inventory: fromInventory, money: fromNewMoney });
            transaction.update(toUserRef, { inventory: toInventory, money: toNewMoney });
            transaction.update(offerRef, { status: 'accepted', completedAt: new Date().toISOString() });
        });
        
        showMessage('Обмен успешно завершён!', '#4caf50');
        
        // ===== 8. ОБНОВЛЕНИЕ ЛОКАЛЬНЫХ ДАННЫХ У ОБОИХ ИГРОКОВ =====
        const currentUser = window.auth?.currentUser;
        if (currentUser) {
            await loadGameData(currentUser.uid);
            const { renderEquipmentTab, renderItemsTab } = await import('./inventory.js');
            renderItemsTab();
            renderEquipmentTab();
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка в acceptTradeOffer:', error);
        showMessage(`Ошибка: ${error.message}`, '#e74c3c');
        return false;
    }
}

// Отклонение предложения
export async function rejectTradeOffer(offerId, userId) {
    if (!db) return false;
    const offerRef = doc(db, 'trade_offers', offerId);
    const offerSnap = await getDoc(offerRef);
    if (!offerSnap.exists()) return false;
    const data = offerSnap.data();
    if (data.toUserId !== userId) {
        showMessage('Вы не можете отклонить это предложение', '#e74c3c');
        return false;
    }
    await updateDoc(offerRef, { status: 'rejected' });
    showMessage('Предложение отклонено', '#6c757d');
    return true;
}

export { db };
