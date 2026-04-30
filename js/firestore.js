import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, runTransaction, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';

let db = null;
let unsubscribeUserListener = null;

export function initFirestore(auth) {
    db = getFirestore(auth.app);
}

export async function saveGameData() {
    if (window._preventAutoSave) {
        console.log('🛡️ Автосохранение заблокировано');
        return;
    }
    
    const user = window.auth?.currentUser;
    if (!user || !db) return;
    
    const gameState = await import('./gameState.js');
    
    const healthVal = gameState.health ?? 100;
    const hungerVal = gameState.hunger ?? 100;
    const coldVal = gameState.cold ?? 100;
    const moneyVal = gameState.money ?? 200;
    const energyVal = gameState.energy ?? 100;
    const currentWeatherVal = gameState.currentWeather ?? 'sunny';
    const currentTemperatureVal = gameState.currentTemperature ?? 15;
    const accumulatedMinutesVal = gameState.accumulatedMinutes ?? 720;
    const experienceVal = gameState.experience ?? 0;
    const levelVal = gameState.level ?? 1;
    const currentLocationVal = gameState.currentLocation ?? 'church';
    const lastEnergyUpdateVal = gameState.lastEnergyUpdate ?? Date.now();
    
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, {
        health: healthVal,
        hunger: hungerVal,
        cold: coldVal,
        money: moneyVal,
        inventory: gameState.inventory || [],
        equipped: gameState.equipped || { head: null, body: null, legs: null, feet: null },
        accumulatedMinutes: accumulatedMinutesVal,
        currentWeather: currentWeatherVal,
        currentTemperature: currentTemperatureVal,
        currentLocation: currentLocationVal,
        actionLog: gameState.getActionLog() || [],
        experience: experienceVal,
        level: levelVal,
        energy: energyVal,
        lastEnergyUpdate: lastEnergyUpdateVal,
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
        const { setStats, inventory, equipped, setTimeWeather, setActionLog, setExpData, setEnergy, updateUI, setCurrentLocation } = await import('./gameState.js');
        
        setStats(data.health ?? 100, data.hunger ?? 100, data.cold ?? 100, data.money ?? 200);
        inventory.length = 0;
        inventory.push(...(data.inventory ?? []));
        Object.assign(equipped, data.equipped ?? { head: null, body: null, legs: null, feet: null });
        setTimeWeather(data.accumulatedMinutes ?? 720, data.currentWeather ?? 'sunny', data.currentTemperature ?? 15);
        setActionLog(data.actionLog ?? []);
        setExpData(data.experience ?? 0, data.level ?? 1);
        setEnergy(data.energy ?? 100);
        await setCurrentLocation(data.currentLocation || 'church');
        updateUI();
        console.log("Данные загружены");
    } else {
        const gameState = await import('./gameState.js');
        
        gameState.setStats(100, 100, 100, 200);
        
        gameState.inventory.length = 0;
        gameState.inventory.push(
            { id: "bread", count: 2 }, { id: "vodka", count: 1 }, { id: "cigarettes", count: 1 },
            { id: "medkit", count: 1 }, { id: "ushanka", count: 1 }, { id: "puhovik", count: 1 }
        );
        
        gameState.equipped.head = null;
        gameState.equipped.body = null;
        gameState.equipped.legs = null;
        gameState.equipped.feet = null;
        
        gameState.setTimeWeather(720, 'sunny', 15);
        gameState.setActionLog([]);
        gameState.setExpData(0, 1);
        gameState.setEnergy(100);
        gameState.lastEnergyUpdate = Date.now();
        await gameState.setCurrentLocation('church');
        gameState.updateUI();
        
        await saveGameData();
        showMessage('Новый аккаунт создан', '#4caf50');
    }
}

// ========== REAL-TIME ПОДПИСКА ==========
export function subscribeToUserChanges(userId, onDataChanged) {
    if (!db) {
        console.error('Firestore не инициализирован');
        return;
    }
    
    if (unsubscribeUserListener) {
        unsubscribeUserListener();
        unsubscribeUserListener = null;
    }
    
    const userRef = doc(db, 'users', userId);
    unsubscribeUserListener = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists() && onDataChanged) {
            console.log('🔄 Real-time: данные изменились в БД');
            onDataChanged(docSnap.data());
        }
    }, (error) => {
        console.error('Ошибка в onSnapshot:', error);
    });
}

export function unsubscribeFromUserChanges() {
    if (unsubscribeUserListener) {
        unsubscribeUserListener();
        unsubscribeUserListener = null;
        console.log('🔄 Отписка от Real-time обновлений');
    }
}

// ========== ТОРГОВЛЯ ==========
export async function createTradeOffer(fromUserId, fromUserNick, toUserId, toUserNick, fromItems, fromMoney, toItems, toMoney) {
    if (!db) return null;
    const offer = {
        fromUserId, fromUserNick, toUserId, toUserNick,
        fromItems: fromItems || [], fromMoney: fromMoney || 0,
        toItems: toItems || [], toMoney: toMoney || 0,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    const docRef = await addDoc(collection(db, 'trade_offers'), offer);
    return docRef.id;
}

export async function getIncomingTradeOffers(userId) {
    if (!db) return [];
    const q = query(collection(db, 'trade_offers'), where('toUserId', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOutgoingTradeOffers(userId) {
    if (!db) return [];
    const q = query(collection(db, 'trade_offers'), where('fromUserId', '==', userId), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

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

// ========== ИСПРАВЛЕННАЯ ТРАНЗАКЦИЯ С ПОВТОРОМ ПРИ КОНФЛИКТЕ ==========
export async function acceptTradeOffer(offerId, userId) {
    if (!db) return false;
    
    // БЛОКИРУЕМ АВТОСОХРАНЕНИЕ ПЕРЕД ТРАНЗАКЦИЕЙ
    window._preventAutoSave = true;
    
    let retries = 3;
    
    while (retries > 0) {
        try {
            let offerData = null;
            
            await runTransaction(db, async (transaction) => {
                const offerRef = doc(db, 'trade_offers', offerId);
                const offerSnap = await transaction.get(offerRef);
                if (!offerSnap.exists()) throw new Error('Предложение не найдено');
                
                const offer = offerSnap.data();
                offerData = offer;
                if (offer.status !== 'pending') throw new Error('Предложение уже обработано');
                if (offer.toUserId !== userId) throw new Error('Вы не получатель');
                if (new Date(offer.expiresAt) < new Date()) throw new Error('Срок истёк');
                
                const fromMoneyNum = Number(offer.fromMoney) || 0;
                const toMoneyNum = Number(offer.toMoney) || 0;
                
                const fromUserRef = doc(db, 'users', offer.fromUserId);
                const toUserRef = doc(db, 'users', offer.toUserId);
                const fromUserSnap = await transaction.get(fromUserRef);
                const toUserSnap = await transaction.get(toUserRef);
                
                const fromUserData = fromUserSnap.data();
                const toUserData = toUserSnap.data();
                
                let fromInventory = (fromUserData.inventory || []).map(i => ({ ...i }));
                let toInventory = (toUserData.inventory || []).map(i => ({ ...i }));
                
                // Проверки
                for (const item of offer.fromItems || []) {
                    const idx = fromInventory.findIndex(i => i.id === item.id);
                    if (idx === -1 || fromInventory[idx].count < (item.count || 1)) {
                        throw new Error(`Нет ${item.id}`);
                    }
                }
                for (const item of offer.toItems || []) {
                    const idx = toInventory.findIndex(i => i.id === item.id);
                    if (idx === -1 || toInventory[idx].count < (item.count || 1)) {
                        throw new Error(`Нет ${item.id}`);
                    }
                }
                
                if (fromMoneyNum > 0 && (fromUserData.money || 0) < fromMoneyNum) {
                    throw new Error('Недостаточно денег у отправителя');
                }
                if (toMoneyNum > 0 && (toUserData.money || 0) < toMoneyNum) {
                    throw new Error('Недостаточно денег у вас');
                }
                
                // Обновление отправителя
                for (const item of offer.fromItems || []) {
                    const cnt = item.count || 1;
                    const idx = fromInventory.findIndex(i => i.id === item.id);
                    if (fromInventory[idx].count === cnt) fromInventory.splice(idx, 1);
                    else fromInventory[idx].count -= cnt;
                }
                for (const item of offer.toItems || []) {
                    const cnt = item.count || 1;
                    const idx = fromInventory.findIndex(i => i.id === item.id);
                    if (idx !== -1) fromInventory[idx].count += cnt;
                    else fromInventory.push({ id: item.id, count: cnt });
                }
                
                // Обновление получателя
                for (const item of offer.toItems || []) {
                    const cnt = item.count || 1;
                    const idx = toInventory.findIndex(i => i.id === item.id);
                    if (toInventory[idx].count === cnt) toInventory.splice(idx, 1);
                    else toInventory[idx].count -= cnt;
                }
                for (const item of offer.fromItems || []) {
                    const cnt = item.count || 1;
                    const idx = toInventory.findIndex(i => i.id === item.id);
                    if (idx !== -1) toInventory[idx].count += cnt;
                    else toInventory.push({ id: item.id, count: cnt });
                }
                
                const fromNewMoney = (fromUserData.money || 0) - fromMoneyNum + toMoneyNum;
                const toNewMoney = (toUserData.money || 0) - toMoneyNum + fromMoneyNum;
                
                transaction.update(fromUserRef, { inventory: fromInventory, money: fromNewMoney });
                transaction.update(toUserRef, { inventory: toInventory, money: toNewMoney });
                transaction.update(offerRef, { status: 'accepted', completedAt: new Date().toISOString() });
            });
            
            // Успех — выходим из цикла
            showMessage('Обмен успешно завершён!', '#4caf50');
            
            // Обновляем данные текущего игрока (получателя)
            const currentUser = window.auth?.currentUser;
            if (currentUser) {
                await loadGameData(currentUser.uid);
                const { renderEquipmentTab, renderItemsTab } = await import('./inventory.js');
                renderItemsTab();
                renderEquipmentTab();
            }
            
            // Снимаем блокировку через 5 секунд
            setTimeout(() => { 
                window._preventAutoSave = false; 
            }, 5000);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Ошибка транзакции (осталось попыток: ${retries - 1}):`, error);
            
            // Если конфликт версий и есть ещё попытки — повторяем
            if (error.message?.includes('failed-precondition') || error.code === 'failed-precondition') {
                if (retries > 1) {
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
            
            // Неустранимая ошибка или кончились попытки
            showMessage(`Ошибка: ${error.message}`, '#e74c3c');
            window._preventAutoSave = false;
            return false;
        }
    }
    
    window._preventAutoSave = false;
    return false;
}

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
