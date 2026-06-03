// js/realEstateMarket.js
import { db } from './firestore.js';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
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

// ========== КУПИТЬ НЕДВИЖИМОСТЬ С ДОСКИ ==========
export async function buyProperty(listingId, buyerId) {
    const user = window.auth?.currentUser;
    if (!user || user.uid !== buyerId) {
        showMessage('❌ Ошибка авторизации', '#e74c3c');
        return false;
    }
    
    // Активируем защиту
    activateTradeGuard(8000, { action: 'buyProperty', listingId });
    
    const listingRef = doc(db, 'real_estate_listings', listingId);
    const listingSnap = await getDoc(listingRef);
    
    if (!listingSnap.exists()) {
        showMessage('❌ Объявление не найдено', '#e74c3c');
        deactivateTradeGuard();
        return false;
    }
    
    const listing = listingSnap.data();
    
    if (listing.status !== 'active') {
        showMessage('❌ Объявление уже неактивно', '#e74c3c');
        deactivateTradeGuard();
        return false;
    }
    
    if (listing.sellerId === buyerId) {
        showMessage('❌ Нельзя купить у самого себя', '#e74c3c');
        deactivateTradeGuard();
        return false;
    }
    
    try {
        await runTransaction(db, async (transaction) => {
            const buyerRef = doc(db, 'users', buyerId);
            const buyerSnap = await transaction.get(buyerRef);
            const buyerData = buyerSnap.data();
            const buyerMoney = buyerData?.money || 0;
            
            if (buyerMoney < listing.price) {
                throw new Error(`Не хватает денег! Нужно ${listing.price}₽`);
            }
            
            const sellerRef = doc(db, 'users', listing.sellerId);
            const sellerSnap = await transaction.get(sellerRef);
            const sellerData = sellerSnap.data();
            const sellerMoney = sellerData?.money || 0;
            
            const propertyRef = doc(db, 'real_estate', listing.propertyId);
            const propertySnap = await transaction.get(propertyRef);
            
            if (!propertySnap.exists()) {
                throw new Error('Объект недвижимости не найден');
            }
            
            const propertyData = propertySnap.data();
            if (propertyData.ownerId !== listing.sellerId) {
                throw new Error('Продавец уже продал эту недвижимость');
            }
            
            // Обновляем деньги
            transaction.update(buyerRef, { money: buyerMoney - listing.price });
            transaction.update(sellerRef, { money: sellerMoney + listing.price });
            
            // Передаём недвижимость
            transaction.update(propertyRef, {
                ownerId: buyerId,
                ownerName: user.displayName,
                purchasedAt: new Date().toISOString()
            });
            
            // Обновляем объявление
            transaction.update(listingRef, {
                status: 'sold',
                soldAt: new Date().toISOString(),
                buyerId: buyerId,
                buyerName: user.displayName
            });
        });
        
        // Обновляем локальное состояние покупателя
        const gameState = await import('./gameState.js');
        const buyerRef = doc(db, 'users', buyerId);
        const buyerSnap = await getDoc(buyerRef);
        const buyerData = buyerSnap.data();
        
        gameState.setStats(null, null, null, buyerData.money);
        
        // Добавляем недвижимость в ownedHomes, если её там нет
        if (!gameState.ownedHomes.includes(listing.propertyId)) {
            gameState.ownedHomes.push(listing.propertyId);
        }
        
        // Обновляем вместимость хранилища, если это текущее жильё
        if (gameState.currentHome === listing.propertyId) {
            if (listing.propertyId.startsWith('dorm')) gameState.updateStorageCapacity('dorm');
            else if (listing.propertyId.startsWith('apartment')) gameState.updateStorageCapacity('apartment');
            else if (listing.propertyId.startsWith('house')) gameState.updateStorageCapacity('house');
        }
        
        await saveGameData();
        gameState.updateUI();
        
        showMessage(`🏠 Поздравляем! Вы купили ${listing.propertyName} за ${listing.price}₽`, '#4caf50');
        
        setTimeout(() => deactivateTradeGuard(), 3000);
        return true;
        
    } catch (error) {
        showMessage(`❌ Ошибка покупки: ${error.message}`, '#e74c3c');
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
