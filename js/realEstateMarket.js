// js/realEstateMarket.js
import { db } from './firestore.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, deleteDoc, orderBy, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage, showTutorialTip } from './utils.js';
import { saveGameData } from './firestore.js';
import { activateTradeGuard, deactivateTradeGuard } from './tradeGuard.js';
import { markTutorialShown, isTutorialShown, tutorialEnabled } from './gameState.js';

// ========== ВЫСТАВИТЬ НЕДВИЖИМОСТЬ НА ПРОДАЖУ ==========
export async function listPropertyForSale(propertyId, price) {
    const user = window.auth?.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return false;
    }
    
    if (!price || price < 100) {
        showMessage('❌ Цена должна быть не менее 100₽', '#e74c3c');
        return false;
    }
    
    // ===== НОВАЯ ПРОВЕРКА: хранилище должно быть пустым =====
    const gameState = await import('./gameState.js');
    
    // Проверяем, есть ли вещи в хранилище
    if (gameState.homeStorage && gameState.homeStorage.length > 0) {
        const itemsCount = gameState.homeStorage.length;
        showMessage(`❌ Нельзя продать жильё с вещами в хранилище! Заберите ${itemsCount} предмет(ов) из хранилища.`, '#e74c3c');
        return false;
    }
    // =====================================================
    
    // Проверяем, что недвижимость принадлежит игроку
    const propertyRef = doc(db, 'real_estate', propertyId);
    const propertySnap = await getDoc(propertyRef);
    
    if (!propertySnap.exists()) {
        showMessage('❌ Объект не найден', '#e74c3c');
        return false;
    }
    
    const propertyData = propertySnap.data();
    
    if (propertyData.ownerId !== user.uid) {
        showMessage('❌ Это не ваша недвижимость!', '#e74c3c');
        return false;
    }
    
    // Проверяем, нет ли уже активного объявления
    const existingQuery = query(
        collection(db, 'real_estate_listings'),
        where('propertyId', '==', propertyId),
        where('status', '==', 'active')
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
        showMessage('❌ Этот объект уже выставлен на продажу', '#e74c3c');
        return false;
    }
    
    // Создаём объявление
    await addDoc(collection(db, 'real_estate_listings'), {
        propertyId: propertyId,
        propertyName: propertyData.name || propertyId,
        propertyType: getPropertyType(propertyId),
        sellerId: user.uid,
        sellerName: user.displayName || 'Игрок',
        price: price,
        createdAt: new Date().toISOString(),
        status: 'active'
    });
    
    showMessage(`🏠 "${propertyData.name || propertyId}" выставлен на продажу за ${price}₽`, '#4caf50');
    return true;
}

// ========== СНЯТЬ С ПРОДАЖИ ==========
export async function removeFromMarket(propertyId) {
    const user = window.auth?.currentUser;
    if (!user) return false;
    
    const q = query(
        collection(db, 'real_estate_listings'),
        where('propertyId', '==', propertyId),
        where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        showMessage('❌ Объявление не найдено', '#e74c3c');
        return false;
    }
    
    for (const docSnap of snapshot.docs) {
        const listing = docSnap.data();
        if (listing.sellerId !== user.uid) {
            showMessage('❌ Это не ваше объявление', '#e74c3c');
            return false;
        }
        await updateDoc(doc(db, 'real_estate_listings', docSnap.id), {
            status: 'cancelled'
        });
    }
    
    showMessage('🏠 Объявление снято с продажи', '#ffd966');
    return true;
}

// ========== ПОЛУЧИТЬ ВСЕ АКТИВНЫЕ ОБЪЯВЛЕНИЯ ==========
export async function getActiveListings(limitCount = 50) {
    const q = query(
        collection(db, 'real_estate_listings'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ========== ПОЛУЧИТЬ ОБЪЯВЛЕНИЯ ИГРОКА ==========
export async function getMyListings() {
    const user = window.auth?.currentUser;
    if (!user) return [];
    
    const q = query(
        collection(db, 'real_estate_listings'),
        where('sellerId', '==', user.uid),
        where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ========== ПРОВЕРИТЬ, ВЫСТАВЛЕНА ЛИ НЕДВИЖИМОСТЬ НА ПРОДАЖУ ==========
export async function isPropertyOnMarket(propertyId) {
    const q = query(
        collection(db, 'real_estate_listings'),
        where('propertyId', '==', propertyId),
        where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
}

// ========== КУПИТЬ НЕДВИЖИМОСТЬ С ДОСКИ ==========
export async function buyProperty(listingId, buyerId) {
    const user = window.auth?.currentUser;
    if (!user || user.uid !== buyerId) {
        showMessage('❌ Ошибка авторизации', '#e74c3c');
        return false;
    }
    
    // Активируем защиту
    activateTradeGuard(10000, { action: 'buyProperty', listingId });
    window._preventAutoSave = true;
    window._lastLocalUpdate = new Date().toISOString();
    console.log('🛡️ TradeGuard активирован для покупки недвижимости');
    
    const listingRef = doc(db, 'real_estate_listings', listingId);
    const listingSnap = await getDoc(listingRef);
    
    if (!listingSnap.exists()) {
        showMessage('❌ Объявление не найдено', '#e74c3c');
        deactivateTradeGuard();
        window._preventAutoSave = false;
        return false;
    }
    
    const listing = listingSnap.data();
    
    if (listing.status !== 'active') {
        showMessage('❌ Объявление уже неактивно', '#e74c3c');
        deactivateTradeGuard();
        window._preventAutoSave = false;
        return false;
    }
    
    if (listing.sellerId === buyerId) {
        showMessage('❌ Нельзя купить у самого себя', '#e74c3c');
        deactivateTradeGuard();
        window._preventAutoSave = false;
        return false;
    }
    
    // Сохраняем данные для обновления UI
    const sellerId = listing.sellerId;
    const sellerName = listing.sellerName;
    const propertyId = listing.propertyId;
    const propertyName = listing.propertyName;
    const price = listing.price;
    
    // Переменные для хранения результатов транзакции
    let finalBuyerMoney = 0;
    let finalSellerMoney = 0;
    
    try {
        await runTransaction(db, async (transaction) => {
            const buyerRef = doc(db, 'users', buyerId);
            const buyerSnap = await transaction.get(buyerRef);
            const buyerData = buyerSnap.data();
            const buyerMoney = buyerData?.money || 0;
            
            if (buyerMoney < price) {
                throw new Error(`Не хватает денег! Нужно ${price}₽`);
            }
            
            const sellerRef = doc(db, 'users', sellerId);
            const sellerSnap = await transaction.get(sellerRef);
            const sellerData = sellerSnap.data();
            const sellerMoney = sellerData?.money || 0;
            
            const propertyRef = doc(db, 'real_estate', propertyId);
            const propertySnap = await transaction.get(propertyRef);
            
            if (!propertySnap.exists()) {
                throw new Error('Объект недвижимости не найден');
            }
            
            const propertyData = propertySnap.data();
            if (propertyData.ownerId !== sellerId) {
                throw new Error('Продавец уже продал эту недвижимость');
            }
            
            const now = new Date().toISOString();
            
            // Сохраняем результаты
            finalBuyerMoney = buyerMoney - price;
            finalSellerMoney = sellerMoney + price;
            
            // Обновляем
            transaction.update(buyerRef, { 
                money: finalBuyerMoney,
                lastUpdated: now 
            });
            transaction.update(sellerRef, { 
                money: finalSellerMoney,
                lastUpdated: now 
            });
            
            // 👇 ИСПРАВЛЕНО: добавляем debt и lastTaxPaid
            transaction.update(propertyRef, {
                ownerId: buyerId,
                ownerName: user.displayName,
                purchasedAt: now,
                debt: 0,
                lastTaxPaid: now
            });
            
            transaction.update(listingRef, {
                status: 'sold',
                soldAt: now,
                buyerId: buyerId,
                buyerName: user.displayName
            });
        });
        
        console.log('✅ Транзакция покупки недвижимости успешна');
        
        // ===== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ UI ДЛЯ ПОКУПАТЕЛЯ =====
        const currentUser = window.auth?.currentUser;
        
        if (currentUser && currentUser.uid === buyerId) {
            const gameState = await import('./gameState.js');
            
            gameState.setStats(null, null, null, finalBuyerMoney);
            
         // Добавляем недвижимость в ownedHomes
if (!gameState.ownedHomes.includes(propertyId)) {
    gameState.ownedHomes.push(propertyId);
}

// Обновляем вместимость хранилища
if (propertyId.startsWith('dorm')) gameState.updateStorageCapacity('dorm');
else if (propertyId.startsWith('apartment')) gameState.updateStorageCapacity('apartment');
else if (propertyId.startsWith('house')) gameState.updateStorageCapacity('house');

// 👇 ИСПРАВЛЕНО: используем setPrimaryHome вместо прямого присваивания
await gameState.setPrimaryHome(propertyId);
            
            gameState.updateUI();
            
            const { renderItemsTab, renderEquipmentTab, initInventoryTabs, renderHousingTab } = await import('./inventory.js');
            renderItemsTab();
            renderEquipmentTab();
            initInventoryTabs();
            renderHousingTab();
            
            console.log('🏠 UI покупателя обновлён принудительно');
            showMessage(`🏠 Вы купили ${propertyName} за ${price}₽`, '#4caf50');
            
            // ===== ПРОВЕРКА: если покупатель находится на карте и купил дом — обновляем локацию =====
            const { currentLocation, setCurrentLocation, getHomeLocationId } = await import('./gameState.js');
            const homeLoc = getHomeLocationId(propertyId);
            
            if (currentLocation === homeLoc) {
                // Игрок уже в этом доме — обновляем локацию (чтобы перерисовать фон)
                setCurrentLocation(homeLoc);
                console.log('🏠 Локация покупателя обновлена');
            }
            
            // 👇 ПОДСКАЗКА: первая покупка с доски
            if (tutorialEnabled && !isTutorialShown('shown_estate_buy')) {
                showTutorialTip('🏠 Поздравляем с покупкой! Теперь у тебя есть новое жильё. Не забывай пополнять счёт для коммуналки, чтобы не выселили!', 4000);
                markTutorialShown('shown_estate_buy');
                await import('./firestore.js').then(m => m.saveGameData());
            }
        }
        
        // ===== ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ UI ДЛЯ ПРОДАВЦА =====
        if (currentUser && currentUser.uid === sellerId) {
            const gameState = await import('./gameState.js');
            
            gameState.setStats(null, null, null, finalSellerMoney);
            
            // Удаляем недвижимость из ownedHomes продавца
            const index = gameState.ownedHomes.indexOf(propertyId);
            if (index !== -1) gameState.ownedHomes.splice(index, 1);
            
            // Если продавец продал своё текущее жильё — сбрасываем currentHome
            if (gameState.currentHome === propertyId) {
                gameState.currentHome = gameState.ownedHomes.length > 0 ? gameState.ownedHomes[0] : null;
            }
            
            gameState.updateUI();
            
            const { renderItemsTab, renderEquipmentTab, initInventoryTabs, renderHousingTab } = await import('./inventory.js');
            renderItemsTab();
            renderEquipmentTab();
            initInventoryTabs();
            renderHousingTab();
            
            console.log('🏠 UI продавца обновлён принудительно');
            showMessage(`💰 Ваша недвижимость "${propertyName}" продана! +${price}₽`, '#4caf50');
        }
        
        // Снимаем блокировку через 5 секунд
        setTimeout(() => { 
            window._preventAutoSave = false;
            deactivateTradeGuard();
            console.log('✅ Защита покупки недвижимости снята');
        }, 5000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка покупки недвижимости:', error);
        showMessage(`Ошибка: ${error.message}`, '#e74c3c');
        window._preventAutoSave = false;
        deactivateTradeGuard();
        return false;
    }
}

function getPropertyType(propertyId) {
    if (propertyId.startsWith('dorm')) return 'dorm';
    if (propertyId.startsWith('apartment')) return 'apartment';
    if (propertyId.startsWith('house')) return 'house';
    return 'unknown';
}
