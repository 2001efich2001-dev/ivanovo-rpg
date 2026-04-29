import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, runTransaction, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { 
    health, hunger, cold, money, inventory, equipped, setStats, updateUI, 
    accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, 
    getActionLog, setActionLog, experience, level, setExpData, energy, setEnergy
} from './gameState.js';
import { showMessage } from './utils.js';

let db = null;
let unsubscribeUserListener = null; // Для Real-time подписки

export function initFirestore(auth) {
    db = getFirestore(auth.app);
}

export async function saveGameData() {
    // Защита от автосохранения во время обмена
    if (window._preventAutoSave) {
        console.log('🛡️ Автосохранение заблокировано (обмен в процессе)');
        return;
    }
    
    const user = window.auth?.currentUser;
    if (!user || !db) return;
    
    // Импортируем актуальные значения напрямую из модуля
    const gameState = await import('./gameState.js');
    
    // Получаем значения с защитой от undefined
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
    console.log("Данные сохранены", { 
        currentWeather: currentWeatherVal, 
        energy: energyVal,
        temperature: currentTemperatureVal 
    });
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
        
        const savedLocation = data.currentLocation || 'church';
        const { setCurrentLocation } = await import('./gameState.js');
        setCurrentLocation(savedLocation);
        
        updateUI();
        console.log("Данные загружены");
   } else {
    // Импортируем gameState для явной установки
    const gameState = await import('./gameState.js');
    
    // Устанавливаем через экспортированные функции
    gameState.setStats(100, 100, 100, 200);
    
    // Очищаем и заполняем инвентарь
    gameState.inventory.length = 0;
    gameState.inventory.push(
        { id: "bread", count: 2 }, { id: "vodka", count: 1 }, { id: "cigarettes", count: 1 },
        { id: "medkit", count: 1 }, { id: "ushanka", count: 1 }, { id: "puhovik", count: 1 }
    );
    
    // Сбрасываем экипировку
    gameState.equipped.head = null;
    gameState.equipped.body = null;
    gameState.equipped.legs = null;
    gameState.equipped.feet = null;
    
    // Устанавливаем время и погоду напрямую
    gameState.accumulatedMinutes = 720;
    gameState.currentWeather = 'sunny';
    gameState.currentTemperature = 15;
    
    // Сбрасываем лог
    gameState.setActionLog([]);
    
    // Сбрасываем опыт и уровень
    gameState.setExpData(0, 1);
    
    // Устанавливаем энергию
    gameState.setEnergy(100);
    gameState.lastEnergyUpdate = Date.now();
    
    // Устанавливаем локацию
    await gameState.setCurrentLocation('church');
    
    // Обновляем UI
    gameState.updateUI();
    
    // Сохраняем в БД
    await saveGameData();
    
    showMessage('Новый аккаунт создан', '#4caf50');
}

// ========== REAL-TIME ПОДПИСКА НА ИЗМЕНЕНИЯ ==========
export function subscribeToUserChanges(userId, onDataChanged) {
    if (!db) {
        console.error('Firestore не инициализирован');
        return;
    }
    
    // Отписываемся от старой подписки, если есть
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
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
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

// Отзыв предложения
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
    
    // Флаг для предотвращения автосохранения
    if (typeof window._preventAutoSave === 'undefined') {
        window._preventAutoSave = false;
    }
    
    try {
        let offerData = null;
        
        await runTransaction(db, async (transaction) => {
            const offerRef = doc(db, 'trade_offers', offerId);
            const offerSnap = await transaction.get(offerRef);
            if (!offerSnap.exists()) throw new Error('Предложение не найдено');
            
            const offer = offerSnap.data();
            offerData = offer;
            if (offer.status !== 'pending') throw new Error('Предложение уже обработано');
            if (offer.toUserId !== userId) throw new Error('Вы не получатель этого предложения');
            if (new Date(offer.expiresAt) < new Date()) throw new Error('Срок предложения истёк');
            
            const fromMoneyNum = Number(offer.fromMoney) || 0;
            const toMoneyNum = Number(offer.toMoney) || 0;
            
            const fromUserRef = doc(db, 'users', offer.fromUserId);
            const toUserRef = doc(db, 'users', offer.toUserId);
            const fromUserSnap = await transaction.get(fromUserRef);
            const toUserSnap = await transaction.get(toUserRef);
            
            if (!fromUserSnap.exists() || !toUserSnap.exists()) throw new Error('Пользователь не найден');
            
            const fromUserData = fromUserSnap.data();
            const toUserData = toUserSnap.data();
            
            let fromInventory = (fromUserData.inventory || []).map(i => ({ ...i }));
            let toInventory = (toUserData.inventory || []).map(i => ({ ...i }));
            
            // Проверки
            for (const item of offer.fromItems || []) {
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || fromInventory[idx].count < (item.count || 1)) {
                    throw new Error(`У отправителя нет ${item.count || 1} шт. ${item.id}`);
                }
            }
            
            for (const item of offer.toItems || []) {
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx === -1 || toInventory[idx].count < (item.count || 1)) {
                    throw new Error(`У вас нет ${item.count || 1} шт. ${item.id}`);
                }
            }
            
            if (fromMoneyNum > 0 && (fromUserData.money || 0) < fromMoneyNum) {
                throw new Error(`У отправителя недостаточно денег (нужно ${fromMoneyNum}₽)`);
            }
            if (toMoneyNum > 0 && (toUserData.money || 0) < toMoneyNum) {
                throw new Error(`У вас недостаточно денег (нужно ${toMoneyNum}₽)`);
            }
            
            // Обновление отправителя: списываем fromItems, добавляем toItems
            for (const item of offer.fromItems || []) {
                const itemCount = item.count || 1;
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (fromInventory[idx].count === itemCount) {
                    fromInventory.splice(idx, 1);
                } else {
                    fromInventory[idx].count -= itemCount;
                }
            }
            for (const item of offer.toItems || []) {
                const itemCount = item.count || 1;
                const idx = fromInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    fromInventory[idx].count += itemCount;
                } else {
                    fromInventory.push({ id: item.id, count: itemCount });
                }
            }
            
            // Обновление получателя: списываем toItems, добавляем fromItems
            for (const item of offer.toItems || []) {
                const itemCount = item.count || 1;
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (toInventory[idx].count === itemCount) {
                    toInventory.splice(idx, 1);
                } else {
                    toInventory[idx].count -= itemCount;
                }
            }
            for (const item of offer.fromItems || []) {
                const itemCount = item.count || 1;
                const idx = toInventory.findIndex(i => i.id === item.id);
                if (idx !== -1) {
                    toInventory[idx].count += itemCount;
                } else {
                    toInventory.push({ id: item.id, count: itemCount });
                }
            }
            
            const fromNewMoney = (fromUserData.money || 0) - fromMoneyNum + toMoneyNum;
            const toNewMoney = (toUserData.money || 0) - toMoneyNum + fromMoneyNum;
            
            transaction.update(fromUserRef, { inventory: fromInventory, money: fromNewMoney });
            transaction.update(toUserRef, { inventory: toInventory, money: toNewMoney });
            transaction.update(offerRef, { status: 'accepted', completedAt: new Date().toISOString() });
        });
        
        showMessage('Обмен успешно завершён!', '#4caf50');
        
        // Защита от автосохранения на 5 секунд
        window._preventAutoSave = true;
        
        // Принудительно обновляем данные у ТЕКУЩЕГО игрока (получатель)
        const currentUser = window.auth?.currentUser;
        if (currentUser) {
            await loadGameData(currentUser.uid);
            const { renderEquipmentTab, renderItemsTab } = await import('./inventory.js');
            renderItemsTab();
            renderEquipmentTab();
        }
        
        // Снимаем защиту через 5 секунд
        setTimeout(() => {
            window._preventAutoSave = false;
        }, 5000);
        
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
