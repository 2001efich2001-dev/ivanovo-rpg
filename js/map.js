import { setCurrentLocation } from './gameState.js';
import { showMessage } from './utils.js';

export function renderInteractiveMap() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    // Основные локации для перемещения
    const zones = [
        { id: "railway", name: "Вокзал", cx: 328, cy: 30, r: 20 },
        { id: "market", name: "Рынок", cx: 271, cy: 277, r: 20 },
        { id: "shelter", name: "Ночлежка", cx: 355, cy: 185, r: 20 },
        { id: "dump", name: "Свалка", cx: 300, cy: 1, r: 20 },
        { id: "church", name: "Церковь", cx: 304, cy: 243, r: 20 },
        { id: "bar", name: "Бар", cx: 331, cy: 215, r: 20 }
    ];
    
    // Точки для недвижимости
    const housingZones = [
        { id: "housing_dorm", name: "Общага", cx: 250, cy: 350, r: 25, type: "dorm" },
        { id: "housing_apartment", name: "ЖК Огни Москвы", cx: 450, cy: 400, r: 25, type: "apartment" },
        { id: "housing_house", name: "Минеево", cx: 550, cy: 200, r: 25, type: "house" }
    ];
    
    container.innerHTML = `
        <div style="position: relative; display: inline-block; width: 100%;">
            <img src="map.png" alt="Карта Иваново" class="map-image" style="width:100%; height:auto;">
            <svg class="map-overlay" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" style="position: absolute; top:0; left:0; width:100%; height:100%;">
                ${zones.map(z => `<circle cx="${z.cx}" cy="${z.cy}" r="${z.r}" data-location="${z.id}" data-name="${z.name}" class="location-circle" fill="rgba(0,200,0,0.25)" stroke="rgba(0,200,0,0.6)" stroke-width="2" />`).join('')}
                ${housingZones.map(z => `<circle cx="${z.cx}" cy="${z.cy}" r="${z.r}" data-location="${z.id}" data-name="${z.name}" data-type="${z.type}" class="housing-circle" fill="rgba(255,140,0,0.3)" stroke="rgba(255,140,0,0.9)" stroke-width="3" />`).join('')}
            </svg>
        </div>
    `;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'location-tooltip';
    document.body.appendChild(tooltip);
    
    // Обработчики для обычных локаций
    const locationCircles = document.querySelectorAll('.location-circle');
    locationCircles.forEach(circle => {
        const name = circle.getAttribute('data-name');
        const locationId = circle.getAttribute('data-location');
        
        circle.addEventListener('mouseenter', (e) => {
            tooltip.textContent = name;
            tooltip.style.display = 'block';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY - 30 + 'px';
        });
        circle.addEventListener('mouseleave', () => { 
            tooltip.style.display = 'none'; 
        });
        
        circle.addEventListener('click', async () => {
            if (locationId) {
                if (typeof window.playClickSound === 'function') window.playClickSound();
                const mapModal = document.getElementById('mapModal');
                if (mapModal) mapModal.style.display = 'none';
                setCurrentLocation(locationId);
                showMessage(`📍 Вы перешли в локацию "${name}"`, '#4caf50');
            } else {
                showMessage("Локация не добавлена", "#f0ad4e");
            }
        });
    });
    
    // Обработчики для точек недвижимости
    const housingCircles = document.querySelectorAll('.housing-circle');
    housingCircles.forEach(circle => {
        const name = circle.getAttribute('data-name');
        const type = circle.getAttribute('data-type');
        
        circle.addEventListener('mouseenter', (e) => {
            tooltip.textContent = `🏠 ${name} (Недвижимость)`;
            tooltip.style.display = 'block';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY - 30 + 'px';
        });
        circle.addEventListener('mouseleave', () => { 
            tooltip.style.display = 'none'; 
        });
        
        circle.addEventListener('click', async () => {
            if (typeof window.playClickSound === 'function') window.playClickSound();
            openHousingModal(type);
        });
    });
    
    // ===== ОБРАБОТЧИК КНОПКИ "ДОМОЙ" =====
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        // Убираем старые обработчики
        const newHomeBtn = homeBtn.cloneNode(true);
        homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
        
        newHomeBtn.addEventListener('click', async () => {
            if (typeof window.playClickSound === 'function') window.playClickSound();
            await teleportHome();
        });
    }
    
    // ===== ОБРАБОТЧИК КНОПКИ "ЗАКРЫТЬ" =====
    const closeMapBtn = document.getElementById('closeMapModal');
    if (closeMapBtn) {
        const newCloseBtn = closeMapBtn.cloneNode(true);
        closeMapBtn.parentNode.replaceChild(newCloseBtn, closeMapBtn);
        
        newCloseBtn.addEventListener('click', () => {
            const mapModal = document.getElementById('mapModal');
            if (mapModal) mapModal.style.display = 'none';
        });
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С НЕДВИЖИМОСТЬЮ ==========

// Цены для каждого типа
function getPriceForType(type) {
    switch (type) {
        case 'dorm': return 5000;
        case 'apartment': return 25000;
        case 'house': return 100000;
        default: return 0;
    }
}

// Названия типов
function getTypeName(type) {
    switch (type) {
        case 'dorm': return 'Общага';
        case 'apartment': return 'ЖК Огни Москвы';
        case 'house': return 'Минеево';
        default: return 'Недвижимость';
    }
}

// Формирование ID объектов
function getHousingIds(type) {
    if (type === 'dorm') {
        return Array.from({ length: 100 }, (_, i) => `dorm_${i + 1}`);
    } else if (type === 'apartment') {
        return Array.from({ length: 50 }, (_, i) => `apartment_${i + 1}`);
    } else {
        return Array.from({ length: 10 }, (_, i) => `house_${i + 1}`);
    }
}

// Вместимость хранилища в зависимости от типа
function getCapacityForType(type) {
    switch (type) {
        case 'dorm': return 10;
        case 'apartment': return 20;
        case 'house': return 40;
        default: return 0;
    }
}

// Открытие модального окна со списком недвижимости
export async function openHousingModal(type) {
    const modal = document.getElementById('housingModal');
    if (!modal) {
        console.error('Модальное окно housingModal не найдено');
        showMessage('Система недвижимости временно недоступна', '#e74c3c');
        return;
    }
    
    const titleEl = document.getElementById('housingModalTitle');
    if (titleEl) titleEl.textContent = `🏠 ${getTypeName(type)}`;
    
    modal.style.display = 'flex';
    
    // Загружаем список
    await loadHousingList(type);
    
    // Обработчики закрытия
    const closeBtns = modal.querySelectorAll('.close-modal, .close-modal-btn, .housing-close-btn');
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            modal.style.display = 'none';
        };
    });
    
    // Закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Загрузка списка объектов недвижимости
async function loadHousingList(type) {
    const container = document.getElementById('housingList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">Загрузка...</div>';
    
    try {
        const { db } = await import('./firestore.js');
        const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { auth } = await import('./auth.js');
        
        const housingIds = getHousingIds(type);
        const price = getPriceForType(type);
        const currentUser = auth.currentUser;
        
        // Получаем данные из Firestore
        let housingData = {};
        try {
            const housingRef = collection(db, 'real_estate');
            const chunks = [];
            for (let i = 0; i < housingIds.length; i += 30) {
                chunks.push(housingIds.slice(i, i + 30));
            }
            
            for (const chunk of chunks) {
                const q = query(housingRef, where('id', 'in', chunk));
                const snapshot = await getDocs(q);
                snapshot.forEach(docSnap => {
                    housingData[docSnap.id] = docSnap.data();
                });
            }
        } catch (err) {
            console.warn('Не удалось загрузить данные из Firestore, используем локальные данные', err);
        }
        
        // Формируем HTML
        let html = '<div class="housing-list">';
        
        for (const id of housingIds) {
            const data = housingData[id];
            const isOwned = data?.ownerId && data.ownerId !== null;
            const ownerId = data?.ownerId;
            const isCurrentOwner = isOwned && ownerId === currentUser?.uid;
            
            if (isOwned && !isCurrentOwner) {
                const ownerName = data?.ownerName || 'Неизвестный';
                html += `
                    <div class="housing-item sold">
                        <div class="housing-item-info">
                            <div class="housing-item-name">${id.replace(/_/g, ' ').toUpperCase()}</div>
                            <div class="housing-item-price">💰 ${price.toLocaleString()}₽</div>
                            <div class="housing-item-owner">👤 Владелец: ${ownerName}</div>
                        </div>
                        <div class="housing-item-status">🔒 Продано</div>
                    </div>
                `;
            } else if (isOwned && isCurrentOwner) {
                html += `
                    <div class="housing-item owned">
                        <div class="housing-item-info">
                            <div class="housing-item-name">${id.replace(/_/g, ' ').toUpperCase()}</div>
                            <div class="housing-item-price">💰 ${price.toLocaleString()}₽</div>
                            <div class="housing-item-owner">🏠 Ваше жильё</div>
                        </div>
                        <div class="housing-item-status">✅ Ваше</div>
                    </div>
                `;
            } else {
                html += `
                    <div class="housing-item">
                        <div class="housing-item-info">
                            <div class="housing-item-name">${id.replace(/_/g, ' ').toUpperCase()}</div>
                            <div class="housing-item-price">💰 ${price.toLocaleString()}₽</div>
                            <div class="housing-item-status">✅ Свободно</div>
                        </div>
                        <button class="housing-buy-btn" data-id="${id}" data-price="${price}" data-type="${type}">Купить</button>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Добавляем обработчики для кнопок покупки
        document.querySelectorAll('.housing-buy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const propertyId = btn.dataset.id;
                const priceNum = parseInt(btn.dataset.price);
                const propertyType = btn.dataset.type;
                await buyProperty(propertyId, priceNum, propertyType);
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки списка недвижимости:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px;">❌ Ошибка загрузки. Попробуйте позже.</div>';
    }
}

// Покупка недвижимости (исправленная версия)
async function buyProperty(propertyId, price, type) {
    console.log(`🏠 Покупка ${propertyId} за ${price}₽`);
    
    try {
        const { auth } = await import('./auth.js');
        const { db } = await import('./firestore.js');
        const { doc, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { money, setStats, updateUI, updateStorageCapacity, getHousingData } = await import('./gameState.js');
        const { showMessage: showMsg } = await import('./utils.js');
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            showMsg('Ошибка авторизации', '#e74c3c');
            return;
        }
        
        // Проверяем деньги (локально, до транзакции)
        if (money < price) {
            showMsg(`❌ Не хватает денег! Нужно ${price.toLocaleString()}₽`, '#e74c3c');
            return;
        }
        
        // Транзакция покупки (ВАЖНО: сначала читаем, потом пишем)
        await runTransaction(db, async (transaction) => {
            // 1. СНАЧАЛА читаем документ недвижимости
            const propertyRef = doc(db, 'real_estate', propertyId);
            const propertySnap = await transaction.get(propertyRef);
            
            if (propertySnap.exists()) {
                const propertyData = propertySnap.data();
                if (propertyData.ownerId && propertyData.ownerId !== null) {
                    throw new Error('Недвижимость уже продана');
                }
            }
            
            // 2. Читаем документ пользователя
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data();
            const currentMoney = userData?.money || 0;
            
            if (currentMoney < price) {
                throw new Error('Недостаточно денег');
            }
            
            const newMoney = currentMoney - price;
            const ownedHomes = userData?.housing?.owned || [];
            ownedHomes.push(propertyId);
            
            // 3. ПОТОМ пишем (обновляем)
            transaction.update(propertyRef, {
                ownerId: currentUser.uid,
                ownerName: currentUser.displayName || 'Игрок',
                purchasedAt: new Date().toISOString(),
                debt: 0,
                lastTaxPaid: new Date().toISOString()
            });
            
            transaction.update(userRef, {
                money: newMoney,
                'housing.owned': ownedHomes,
                'housing.current': propertyId,
                'housing.storageCapacity': getCapacityForType(type),
                'housing.debt': 0,
                'housing.lastTaxPaid': new Date().toISOString()
            });
        });
        
        // Обновляем локальное состояние
        const newMoney = money - price;
        setStats(null, null, null, newMoney);
        updateStorageCapacity(type);
        
        // Обновляем текущее жильё в локальном gameState
        const { setCurrentHome } = await import('./gameState.js');
        if (typeof setCurrentHome === 'function') {
            setCurrentHome(propertyId);
        }
        
        updateUI();
        
        showMsg(`✅ Поздравляем! Вы купили ${propertyId}!`, '#4caf50');
        
        // Закрываем модальное окно
        const modal = document.getElementById('housingModal');
        if (modal) modal.style.display = 'none';
        
        // Переоткрываем окно, чтобы обновить список
        setTimeout(() => {
            openHousingModal(type);
        }, 500);
        
    } catch (error) {
        console.error('Ошибка покупки:', error);
        const { showMessage: showMsg } = await import('./utils.js');
        showMsg(`❌ Ошибка при покупке: ${error.message}`, '#e74c3c');
    }
}
// ========== ТЕЛЕПОРТ ДОМОЙ ==========
export async function teleportHome() {
    const { setCurrentLocation, currentHome, showMessage } = await import('./gameState.js');
    const { showMessage: showMsg } = await import('./utils.js');
    
    // Если есть текущее жильё — телепортируем туда
    if (currentHome) {
        setCurrentLocation(currentHome);
        showMsg(`🏠 Вы телепортировались домой (${currentHome})`, '#4caf50');
    } else {
        // Нет жилья — отправляем на помойку
        setCurrentLocation('dump');
        showMsg(`🗑️ У вас нет жилья. Вы отправились на помойку.`, '#ffd966');
    }
    
    // Закрываем карту
    const mapModal = document.getElementById('mapModal');
    if (mapModal) mapModal.style.display = 'none';
}
