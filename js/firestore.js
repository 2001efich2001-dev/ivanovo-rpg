import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, runTransaction, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';

let db = null;
let unsubscribeUserListener = null;

export function initFirestore(auth) {
    db = getFirestore(auth.app);
}

export async function saveGameData() {    
    const user = window.auth?.currentUser;
    if (!user || !db) return;
    
    const gameState = await import('./gameState.js');
    
    const healthVal = gameState.health ?? 100;
    const hungerVal = gameState.hunger ?? 100;
    const coldVal = gameState.cold ?? 100;
    const moneyVal = gameState.money ?? 200;
    const energyVal = gameState.energy ?? 100;
    const intoxicationVal = gameState.intoxication ?? 0;
    const currentWeatherVal = gameState.currentWeather ?? 'sunny';
    const currentTemperatureVal = gameState.currentTemperature ?? 15;
    const accumulatedMinutesVal = gameState.accumulatedMinutes ?? 720;
    const experienceVal = gameState.experience ?? 0;
    const levelVal = gameState.level ?? 1;
    const currentLocationVal = gameState.currentLocation ?? 'church';
    const lastEnergyUpdateVal = gameState.lastEnergyUpdate ?? Date.now();
    const lastIntoxicationUpdateVal = gameState.lastIntoxicationUpdate ?? Date.now();
    
    const dailyBonusLastClaimVal = gameState.dailyBonusLastClaim ?? null;
    const dailyBonusStreakVal = gameState.dailyBonusStreak ?? 0;
    
    let achievementsData = null;
    try {
        const { getAchievementsData } = await import('./achievements.js');
        achievementsData = getAchievementsData();
    } catch (err) {
        console.warn('Модуль ачивок не загружен');
    }
    
    const housingData = {
        current: gameState.currentHome ?? null,
        owned: gameState.ownedHomes ?? [],
        storage: gameState.homeStorage ?? [],
        storageCapacity: gameState.homeStorageCapacity ?? 0,
        debt: gameState.housingDebt ?? 0,
        lastTaxPaid: gameState.lastTaxPaid ?? null,
        account: gameState.housingAccount ?? 20000,
        dailyCost: gameState.housingDailyCost ?? 0,
        lastHousingCheck: gameState.lastHousingCheck ?? null,
        lastGlobalHousingCheck: gameState.lastGlobalHousingCheck ?? null
    };
    
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
        intoxication: intoxicationVal,
        lastEnergyUpdate: lastEnergyUpdateVal,
        lastIntoxicationUpdate: lastIntoxicationUpdateVal,
        lastUpdated: new Date().toISOString(),
        dailyBonusLastClaim: dailyBonusLastClaimVal,
        dailyBonusStreak: dailyBonusStreakVal,
        achievements: achievementsData,
        housing: housingData
    }, { merge: true });
    console.log("Данные сохранены", { achievements: achievementsData, housing: housingData });
}

export async function loadGameData(userId) {
    if (!userId || !db) return;
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        const { setStats, inventory, equipped, setTimeWeather, setActionLog, setExpData, setEnergy, updateUI, setCurrentLocation, setIntoxication, setLastIntoxicationUpdate } = await import('./gameState.js');
        
        setStats(data.health ?? 100, data.hunger ?? 100, data.cold ?? 100, data.money ?? 200);
        inventory.length = 0;
        inventory.push(...(data.inventory ?? []));
        Object.assign(equipped, data.equipped ?? { head: null, body: null, legs: null, feet: null });
        setTimeWeather(data.accumulatedMinutes ?? 720, data.currentWeather ?? 'sunny', data.currentTemperature ?? 15);
        setActionLog(data.actionLog ?? []);
        setExpData(data.experience ?? 0, data.level ?? 1);
        setEnergy(data.energy ?? 100);
        setIntoxication(data.intoxication ?? 0);
        if (data.lastIntoxicationUpdate) {
            setLastIntoxicationUpdate(data.lastIntoxicationUpdate);
        }
        await setCurrentLocation(data.currentLocation || 'church');
        
        const { setDailyBonusData } = await import('./dailyBonus.js');
        setDailyBonusData(data.dailyBonusLastClaim ?? null, data.dailyBonusStreak ?? 0);
        
        if (data.achievements) {
            try {
                const { setAchievementsData } = await import('./achievements.js');
                setAchievementsData(data.achievements);
                console.log('🏆 Загружены данные достижений');
            } catch (err) {
                console.warn('Модуль ачивок не загружен');
            }
        }
        
        if (data.housing) {
            const { setHousingData } = await import('./gameState.js');
            setHousingData(data.housing);
            console.log('🏠 Загружены данные жилья:', data.housing);
        } else {
            const { initHousingData } = await import('./gameState.js');
            initHousingData();
        }
        
        updateUI();
        console.log("Данные загружены", { dailyBonusStreak: data.dailyBonusStreak, intoxication: data.intoxication });
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
        gameState.setIntoxication(0);
        gameState.lastEnergyUpdate = Date.now();
        gameState.lastIntoxicationUpdate = Date.now();
        await gameState.setCurrentLocation('church');
        
        const { setDailyBonusData } = await import('./dailyBonus.js');
        setDailyBonusData(null, 0);
        
        const { initHousingData } = await import('./gameState.js');
        initHousingData();
        
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
export async function createTradeOffer(fromUserId, fromUserNick, toUserId, toUserNick, fromItems, fromMoney, toItems, toMoney, fromHousing, toHousing) {
    if (!db) return null;
    const offer = {
        fromUserId, fromUserNick, toUserId, toUserNick,
        fromItems: fromItems || [], fromMoney: fromMoney || 0,
        toItems: toItems || [], toMoney: toMoney || 0,
        fromHousing: fromHousing || [],
        toHousing: toHousing || [],
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

// ========== ТРАНЗАКЦИЯ С ПОВТОРОМ ПРИ КОНФЛИКТЕ (поддержка недвижимости) ==========
export async function acceptTradeOffer(offerId, userId) {
    if (!db) return false;
    
    window._preventAutoSave = true;
    
    let retries = 3;
    
    while (retries > 0) {
        try {
            await runTransaction(db, async (transaction) => {
                const offerRef = doc(db, 'trade_offers', offerId);
                const offerSnap = await transaction.get(offerRef);
                if (!offerSnap.exists()) throw new Error('Предложение не найдено');
                
                const offer = offerSnap.data();
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
                
                // Получаем недвижимость
                let fromHousing = fromUserData?.housing?.owned || [];
                let toHousing = toUserData?.housing?.owned || [];
                const fromHousingOffer = offer.fromHousing || [];
                const toHousingOffer = offer.toHousing || [];
                
                console.log('🏠 ===== ДО ОБНОВЛЕНИЯ =====');
                console.log('🏠 fromHousing (продавец):', fromHousing);
                console.log('🏠 toHousing (покупатель):', toHousing);
                console.log('🏠 fromHousingOffer (продаётся):', fromHousingOffer);
                
                // ===== ПРОВЕРКИ =====
                for (const item of offer.fromItems || []) {
                    const idx = fromInventory.findIndex(i => i.id === item.id);
                    if (idx === -1 || fromInventory[idx].count < (item.count || 1)) {
                        throw new Error(`Нет предмета ${item.id}`);
                    }
                }
                for (const item of offer.toItems || []) {
                    const idx = toInventory.findIndex(i => i.id === item.id);
                    if (idx === -1 || toInventory[idx].count < (item.count || 1)) {
                        throw new Error(`Нет предмета ${item.id}`);
                    }
                }
                for (const homeId of fromHousingOffer) {
                    if (!fromHousing.includes(homeId)) {
                        throw new Error(`Нет недвижимости ${homeId}`);
                    }
                }
                for (const homeId of toHousingOffer) {
                    if (!toHousing.includes(homeId)) {
                        throw new Error(`Нет недвижимости ${homeId}`);
                    }
                }
                if (fromMoneyNum > 0 && (fromUserData.money || 0) < fromMoneyNum) {
                    throw new Error('Недостаточно денег у отправителя');
                }
                if (toMoneyNum > 0 && (toUserData.money || 0) < toMoneyNum) {
                    throw new Error('Недостаточно денег у вас');
                }
                
                // ===== ОБНОВЛЕНИЕ ОТПРАВИТЕЛЯ =====
                // Предметы
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
                // Недвижимость (отдаёт)
                for (const homeId of fromHousingOffer) {
                    const idx = fromHousing.indexOf(homeId);
                    if (idx !== -1) fromHousing.splice(idx, 1);
                    const propertyRef = doc(db, 'real_estate', homeId);
                    transaction.update(propertyRef, {
                        ownerId: null,
                        ownerName: null,
                        purchasedAt: null
                    });
                }
                // Недвижимость (получает)
                for (const homeId of toHousingOffer) {
                    if (!fromHousing.includes(homeId)) {
                        fromHousing.push(homeId);
                    }
                }
                
                // ===== ОБНОВЛЕНИЕ ПОЛУЧАТЕЛЯ =====
                // Предметы
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
                // Недвижимость (отдаёт)
                for (const homeId of toHousingOffer) {
                    const idx = toHousing.indexOf(homeId);
                    if (idx !== -1) toHousing.splice(idx, 1);
                    const propertyRef = doc(db, 'real_estate', homeId);
                    transaction.update(propertyRef, {
                        ownerId: null,
                        ownerName: null,
                        purchasedAt: null
                    });
                }
                // Недвижимость (получает)
                let newToHousing = [...toHousing];
                for (const homeId of fromHousingOffer) {
                    if (!newToHousing.includes(homeId)) {
                        newToHousing.push(homeId);
                        const propertyRef = doc(db, 'real_estate', homeId);
                        transaction.update(propertyRef, {
                            ownerId: offer.toUserId,
                            ownerName: offer.toUserNick,
                            purchasedAt: new Date().toISOString()
                        });
                    }
                }
                console.log('🏠 newToHousing (покупатель после добавления):', newToHousing);
                
                // Деньги
                const fromNewMoney = (fromUserData.money || 0) - fromMoneyNum + toMoneyNum;
                const toNewMoney = (toUserData.money || 0) - toMoneyNum + fromMoneyNum;
                
                // Новое основное жильё для отправителя
                let fromNewCurrent = fromUserData?.housing?.current;
                if (fromHousingOffer.includes(fromNewCurrent)) {
                    fromNewCurrent = fromHousing.length > 0 ? fromHousing[0] : null;
                }
                let fromNewCapacity = 0;
                if (fromNewCurrent) {
                    if (fromNewCurrent.startsWith('dorm')) fromNewCapacity = 10;
                    else if (fromNewCurrent.startsWith('apartment')) fromNewCapacity = 20;
                    else if (fromNewCurrent.startsWith('house')) fromNewCapacity = 40;
                }
                
                // Новое основное жильё для получателя
                let toNewCurrent = toUserData?.housing?.current;
                let toNewCapacity = toUserData?.housing?.storageCapacity || 0;
                
                console.log('🏠 ===== СОХРАНЯЕМ =====');
                console.log('🏠 toUserRef, housing.owned:', newToHousing);
                console.log('🏠 fromUserRef, housing.owned:', fromHousing);
                
                transaction.update(fromUserRef, {
                    inventory: fromInventory,
                    money: fromNewMoney,
                    'housing.owned': fromHousing,
                    'housing.current': fromNewCurrent,
                    'housing.storageCapacity': fromNewCapacity
                });
                
                transaction.update(toUserRef, {
                    inventory: toInventory,
                    money: toNewMoney,
                    'housing.owned': newToHousing,
                    'housing.current': toNewCurrent,
                    'housing.storageCapacity': toNewCapacity
                });
                
                transaction.update(offerRef, { status: 'accepted', completedAt: new Date().toISOString() });
            });
            
            showMessage('Обмен успешно завершён!', '#4caf50');
            
            // ===== УПРОЩЁННО: просто снимаем блокировку, real-time сам обновит =====
            setTimeout(() => { 
                window._preventAutoSave = false; 
            }, 5000);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Ошибка транзакции (осталось попыток: ${retries - 1}):`, error);
            
            if (error.message?.includes('failed-precondition') || error.code === 'failed-precondition') {
                if (retries > 1) {
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
            
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
