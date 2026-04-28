import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { health, hunger, cold, money, inventory, equipped, setStats, updateUI, accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, getActionLog, setActionLog, experience, level, setExpData, energy, setEnergy } from './gameState.js';
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
        import('./gameState.js').then(m => {
            m.lastEnergyUpdate = savedLastUpdate;
        });
        
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
            
            // Получаем данные отправителя и получателя
            const fromUserRef = doc(db, 'users', offer.fromUserId);
            const toUserRef = doc(db, 'users', userId);
            const fromUserSnap = await transaction.get(fromUserRef);
            const toUserSnap = await transaction.get(toUserRef);
            
            if (!fromUserSnap.exists() || !toUserSnap.exists()) throw new Error('Пользователь не найден');
            
            const fromUserData = fromUserSnap.data();
            const toUserData = toUserSnap.data();
            
            // Проверяем, что у отправителя есть предметы
            let fromInventory = [...(fromUserData.inventory || [])];
            for (const item of offer.fromItems) {
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || fromInventory[idx].count < item.count) {
                    throw new Error(`У отправителя нет ${item.count} шт. ${item.id}`);
                }
            }
            
            // Проверяем, что у получателя есть предметы
            let toInventory = [...(toUserData.inventory || [])];
            for (const item of offer.toItems) {
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || toInventory[idx].count < item.count) {
                    throw new Error(`У вас нет ${item.count} шт. ${item.id}`);
                }
            }
            
            // Проверяем деньги
            if (offer.fromMoney > 0 && (fromUserData.money || 0) < offer.fromMoney) {
                throw new Error(`У отправителя недостаточно денег (нужно ${offer.fromMoney}₽)`);
            }
            if (offer.toMoney > 0 && (toUserData.money || 0) < offer.toMoney) {
                throw new Error(`У вас недостаточно денег (нужно ${offer.toMoney}₽)`);
            }
            
            // Обновляем инвентарь отправителя (списываем предметы, добавляем полученные)
            // Списываем предметы, которые отдаёт
            for (const item of offer.fromItems) {
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (fromInventory[idx].count === item.count) {
                    fromInventory.splice(idx, 1);
                } else {
                    fromInventory[idx].count -= item.count;
                }
            }
            // Добавляем предметы, которые получает
            for (const item of offer.toItems) {
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    fromInventory[idx].count += item.count;
                } else {
                    fromInventory.push({ id: item.id, count: item.count });
                }
            }
            
            // Обновляем инвентарь получателя
            for (const item of offer.toItems) {
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (toInventory[idx].count === item.count) {
                    toInventory.splice(idx, 1);
                } else {
                    toInventory[idx].count -= item.count;
                }
            }
            for (const item of offer.fromItems) {
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    toInventory[idx].count += item.count;
                } else {
                    toInventory.push({ id: item.id, count: item.count });
                }
            }
            
            // Обновляем деньги
            const fromNewMoney = (fromUserData.money || 0) - offer.fromMoney + offer.toMoney;
            const toNewMoney = (toUserData.money || 0) - offer.toMoney + offer.fromMoney;
            
            // Обновляем документы
            transaction.update(fromUserRef, { inventory: fromInventory, money: fromNewMoney });
            transaction.update(toUserRef, { inventory: toInventory, money: toNewMoney });
            transaction.update(offerRef, { status: 'accepted' });
        });
        
        showMessage('Обмен успешно завершён!', '#4caf50');
        return true;
    } catch (error) {
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
