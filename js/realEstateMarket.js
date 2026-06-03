// js/realEstateMarket.js
import { db } from './firestore.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, deleteDoc, orderBy, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { activateTradeGuard, deactivateTradeGuard } from './tradeGuard.js';

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
// ========== КУПИТЬ НЕДВИЖИМОСТЬ С ДОСКИ (С ОБНОВЛЕНИЕМ ПРОДАВЦА) ==========
export async function buyProperty(listingId, buyerId) {
    const user = window.auth?.currentUser;
    if (!user || user.uid !== buyerId) {
        showMessage('❌ Ошибка авторизации', '#e74c3c');
        return false;
    }
    
    // ===== 1. АКТИВИРУЕМ ЗАЩИТУ =====
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
    
    // Сохраняем данные продавца для принудительного обновления
    const sellerId = listing.sellerId;
    const sellerName = listing.sellerName;
    const propertyId = listing.propertyId;
    const propertyName = listing.propertyName;
    const price = listing.price;
    
    try {
        // ===== 2. ТРАНЗАКЦИЯ =====
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
            
            // Обновляем деньги (с lastUpdated)
            transaction.update(buyerRef, { 
                money: buyerMoney - price,
                lastUpdated: now 
            });
            transaction.update(sellerRef, { 
                money: sellerMoney + price,
                lastUpdated: now 
            });
            
            // Передаём недвижимость
            transaction.update(propertyRef, {
                ownerId: buyerId,
                ownerName: user.displayName,
                purchasedAt: now
            });
            
            // Обновляем объявление
            transaction.update(listingRef, {
                status: 'sold',
                soldAt: now,
                buyerId: buyerId,
                buyerName: user.displayName
            });
        });
        
        console.log('✅ Транзакция покупки недвижимости успешна');
        
        // ===== 3. ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ UI ПОКУПАТЕЛЯ =====
        const gameState = await import('./gameState.js');
        
        // Загружаем свежие данные покупателя
        const buyerRef = doc(db, 'users', buyerId);
        const buyerSnap = await getDoc(buyerRef);
        const buyerData = buyerSnap.data();
        const newBuyerMoney = buyerData?.money || 0;
        
        console.log(`💰 Новый баланс покупателя (${user.displayName}): ${newBuyerMoney}`);
        
        gameState.setStats(null, null, null, newBuyerMoney);
        
        // Добавляем недвижимость в ownedHomes покупателя
        if (!gameState.ownedHomes.includes(propertyId)) {
            gameState.ownedHomes.push(propertyId);
        }
        
        // Обновляем вместимость хранилища покупателя
        if (propertyId.startsWith('dorm')) gameState.updateStorageCapacity('dorm');
        else if (propertyId.startsWith('apartment')) gameState.updateStorageCapacity('apartment');
        else if (propertyId.startsWith('house')) gameState.updateStorageCapacity('house');
        
        await saveGameData();
        gameState.updateUI();
        
        // ===== 4. ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ UI ПРОДАВЦА (если продавец онлайн) =====
        const currentUser = window.auth?.currentUser;
        
        // Если текущий пользователь НЕ продавец, но продавец онлайн — обновляем через реальное время?
        // Но проще: если продавец - другой человек, мы не можем обновить его UI напрямую.
        // Однако можем отправить сигнал или надеяться на realtime.
        
        // Пытаемся обновить продавца, если он в том же окне (не наш случай)
        // В реальности продавец получит realtime обновление после снятия защиты.
        
        console.log(`📢 Продавец (${sellerName}) получит обновление через realtime через 5 секунд`);
        
        // Обновляем вкладки UI покупателя
        const { renderItemsTab, renderEquipmentTab, initInventoryTabs, renderHousingTab } = await import('./inventory.js');
        renderItemsTab();
        renderEquipmentTab();
        initInventoryTabs();
        renderHousingTab();
        
        showMessage(`🏠 Поздравляем! Вы купили ${propertyName} за ${price}₽`, '#4caf50');
        showMessage(`💰 Ваш новый баланс: ${newBuyerMoney}₽`, '#4caf50');
        
        // ===== 5. СНИМАЕМ ЗАЩИТУ ЧЕРЕЗ 5 СЕКУНД =====
        setTimeout(() => {
            window._preventAutoSave = false;
            deactivateTradeGuard();
            console.log('✅ Защита покупки недвижимости снята');
            
            // После снятия защиты отправляем сигнал на обновление продавца
            // (если нужно принудительно)
            if (typeof window.refreshSellerAfterPurchase === 'function') {
                window.refreshSellerAfterPurchase(sellerId);
            }
        }, 5000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка покупки недвижимости:', error);
        showMessage(`❌ Ошибка покупки: ${error.message}`, '#e74c3c');
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
