// js/map.js
import { setCurrentLocation, teleportHome, markTutorialShown, isTutorialShown, tutorialEnabled, getCurrentHomeLocation, getHomeLocationId, ownedHomes, currentHome, setPrimaryHome } from './gameState.js';
import { showMessage, showTutorialTip } from './utils.js';

// ========== ПОКАЗАТЬ ПОДСКАЗКУ ДЛЯ КАРТЫ ==========
async function showMapTip(flagKey, tipText) {
    if (!tutorialEnabled) return;
    if (isTutorialShown(flagKey)) return;
    
    showTutorialTip(tipText, 4000);
    markTutorialShown(flagKey);
    await import('./firestore.js').then(m => m.saveGameData());
}

// ========== ОБНОВЛЁННЫЙ ТЕЛЕПОРТ ДОМОЙ С ПРОВЕРКАМИ ==========
async function safeTeleportHome() {
    const gameState = await import('./gameState.js');
    
    // Проверяем, есть ли вообще жильё
    if (gameState.ownedHomes.length === 0) {
        gameState.setCurrentLocation('dump_home');
        showMessage(`🗑️ У вас нет жилья. Вы отправились на помойку.`, '#ffd966');
        return;
    }
    
    // Проверяем, валидное ли текущее жильё
    if (gameState.currentHome && gameState.ownedHomes.includes(gameState.currentHome)) {
        // Всё хорошо — телепортируемся
        await gameState.teleportHome();
        return;
    }
    
    // Текущее жильё невалидно — назначаем первое доступное
    if (gameState.ownedHomes.length > 0) {
        const firstHome = gameState.ownedHomes[0];
        await gameState.setPrimaryHome(firstHome);
        const homeLoc = gameState.getHomeLocationId(firstHome);
        gameState.setCurrentLocation(homeLoc);
        showMessage(`🏠 Вы телепортировались в ${firstHome} (основное жильё установлено автоматически)`, '#4caf50');
        return;
    }
    
    // Если ничего не помогло — на помойку
    gameState.setCurrentLocation('dump_home');
    showMessage(`🗑️ У вас нет жилья. Вы отправились на помойку.`, '#ffd966');
}

export function renderInteractiveMap() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    // 👇 ПОДСКАЗКА: первый раз открыли карту
    showMapTip('shown_map', '🗺️ Карта города. Перемещайся между локациями, чтобы искать приключения.');
    
    // Основные локации для перемещения (ВСЕ ЛОКАЦИИ)
    const zones = [
        { id: "railway", name: "Вокзал", cx: 328, cy: 30, r: 10 },
        { id: "market", name: "Рынок", cx: 271, cy: 277, r: 10 },
        { id: "shelter", name: "Ночлежка", cx: 355, cy: 185, r: 10 },
        { id: "dump", name: "Свалка", cx: 300, cy: 1, r: 10 },
        { id: "church", name: "Церковь", cx: 304, cy: 243, r: 10 },
        { id: "bar", name: "Бар", cx: 331, cy: 215, r: 10 },
        { id: "fishing_spot", name: "🏞️ Река Уводь", cx: 340, cy: 145, r: 10 },
        // ===== НОВЫЕ ЛОКАЦИИ =====
        { id: "ploshchad", name: "🏛️ Площадь Революции", cx: 350, cy: 215, r: 10 },
        { id: "mall", name: "🏬 ТЦ «Золотой город»", cx: 370, cy: 120, r: 10 },
        { id: "red_church", name: "⛪ Красная церковь", cx: 390, cy: 100, r: 10 },
        { id: "sheremet", name: "🛣️ Шереметевский километр", cx: 410, cy: 120, r: 10 }
    ];
    
    // Точки для недвижимости
    const housingZones = [
        { id: "housing_dorm", name: "Общага", cx: 211, cy: 185, r: 10, type: "dorm" },
        { id: "housing_apartment", name: "ЖК Огни Москвы", cx: 305, cy: 185, r: 10, type: "apartment" },
        { id: "housing_house", name: "Минеево", cx: 240, cy: -40, r: 10, type: "house" }
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
            await showMapTip('shown_housing_buy', '🏠 Покупка недвижимости даёт тебе дом, хранилище и возможность телепортироваться.');
            openHousingModal(type);
        });
    });
    
    // ===== ОБНОВЛЁННЫЙ ОБРАБОТЧИК КНОПКИ "ДОМОЙ" =====
    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
        const newHomeBtn = homeBtn.cloneNode(true);
        homeBtn.parentNode.replaceChild(newHomeBtn, homeBtn);
        
        newHomeBtn.addEventListener('click', async () => {
            if (typeof window.playClickSound === 'function') window.playClickSound();
            // 👇 ПОДСКАЗКА: телепорт домой
            await showMapTip('shown_home_teleport', '🏠 Телепорт домой. Если у тебя есть жильё — ты сразу окажешься там.');
            
            // 👇 ИСПОЛЬЗУЕМ ОБНОВЛЁННУЮ ФУНКЦИЮ
            await safeTeleportHome();
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
    
    await loadHousingList(type);
    
    const closeBtns = modal.querySelectorAll('.close-modal, .close-modal-btn, .housing-close-btn');
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            modal.style.display = 'none';
        };
    });
    
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
        
        let html = '<div class="housing-list">';
        
        for (const id of housingIds) {
            const data = housingData[id];
            const isOwned = data?.ownerId && data.ownerId !== null;
            const ownerId = data?.ownerId;
            const isCurrentOwner = isOwned && ownerId === currentUser?.uid;
            
            const displayName = data?.name || id.replace(/_/g, ' ').toUpperCase();
            
            if (isOwned && !isCurrentOwner) {
                const ownerName = data?.ownerName || 'Неизвестный';
                html += `
                    <div class="housing-item sold">
                        <div class="housing-item-info">
                            <div class="housing-item-name">${escapeHtml(displayName)}</div>
                            <div class="housing-item-price">💰 ${price.toLocaleString()}₽</div>
                            <div class="housing-item-owner">👤 Владелец: ${escapeHtml(ownerName)}</div>
                        </div>
                        <div class="housing-item-status">🔒 Продано</div>
                    </div>
                `;
            } else if (isOwned && isCurrentOwner) {
                html += `
                    <div class="housing-item owned">
                        <div class="housing-item-info">
                            <div class="housing-item-name">${escapeHtml(displayName)}</div>
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
                            <div class="housing-item-name">${escapeHtml(displayName)}</div>
                            <div class="housing-item-price">💰 ${price.toLocaleString()}₽</div>
                            <div class="housing-item-status">✅ Свободно</div>
                        </div>
                        <button class="housing-buy-btn" data-id="${id}" data-price="${price}" data-type="${type}" data-name="${displayName}">Купить</button>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        document.querySelectorAll('.housing-buy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const propertyId = btn.dataset.id;
                const priceNum = parseInt(btn.dataset.price);
                const propertyType = btn.dataset.type;
                const propertyName = btn.dataset.name;
                await buyProperty(propertyId, priceNum, propertyType, propertyName);
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки списка недвижимости:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px;">❌ Ошибка загрузки. Попробуйте позже.</div>';
    }
}

// ========== ПОКУПКА НЕДВИЖИМОСТИ ==========
async function buyProperty(propertyId, price, type, propertyName) {
    console.log(`🏠 Покупка ${propertyId} за ${price}₽`);
    
    try {
        const { auth } = await import('./auth.js');
        const { db } = await import('./firestore.js');
        const { doc, runTransaction } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { money, setStats, updateUI, updateStorageCapacity, ownedHomes, setPrimaryHome } = await import('./gameState.js');
        const { showMessage: showMsg } = await import('./utils.js');
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            showMsg('Ошибка авторизации', '#e74c3c');
            return;
        }
        
        if (money < price) {
            showMsg(`❌ Не хватает денег! Нужно ${price.toLocaleString()}₽`, '#e74c3c');
            return;
        }
        
        await runTransaction(db, async (transaction) => {
            const propertyRef = doc(db, 'real_estate', propertyId);
            const propertySnap = await transaction.get(propertyRef);
            
            if (propertySnap.exists()) {
                const propertyData = propertySnap.data();
                if (propertyData.ownerId && propertyData.ownerId !== null) {
                    throw new Error('Недвижимость уже продана');
                }
            }
            
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data();
            const currentMoney = userData?.money || 0;
            
            if (currentMoney < price) {
                throw new Error('Недостаточно денег');
            }
            
            const newMoney = currentMoney - price;
            
            const currentOwned = userData?.housing?.owned || [];
            
            if (currentOwned.includes(propertyId)) {
                throw new Error('Вы уже владеете этой недвижимостью');
            }
            
            const newOwnedHomes = [...currentOwned, propertyId];
            
            console.log(`🏠 Было в собственности: ${currentOwned.length} объектов`);
            console.log(`🏠 Становится: ${newOwnedHomes.length} объектов`);
            
            transaction.update(propertyRef, {
                ownerId: currentUser.uid,
                ownerName: currentUser.displayName || 'Игрок',
                purchasedAt: new Date().toISOString(),
                debt: 0,
                lastTaxPaid: new Date().toISOString()
            });
            
            transaction.update(userRef, {
                money: newMoney,
                'housing.owned': newOwnedHomes,
                'housing.current': propertyId,
                'housing.storageCapacity': getCapacityForType(type),
                'housing.debt': 0,
                'housing.lastTaxPaid': new Date().toISOString()
            });
        });
        
        const newMoney = money - price;
        setStats(null, null, null, newMoney);
        updateStorageCapacity(type);
        
        if (!ownedHomes.includes(propertyId)) {
            ownedHomes.push(propertyId);
        }
        await setPrimaryHome(propertyId);
        
        updateUI();
        
        const finalName = propertyName || propertyId.replace(/_/g, ' ').toUpperCase();
        showMsg(`✅ Поздравляем! Вы купили ${finalName}! Теперь у вас ${ownedHomes.length} объектов недвижимости`, '#4caf50');
        
        const modal = document.getElementById('housingModal');
        if (modal) modal.style.display = 'none';
        
        setTimeout(() => {
            openHousingModal(type);
        }, 500);
        
    } catch (error) {
        console.error('Ошибка покупки:', error);
        const { showMessage: showMsg } = await import('./utils.js');
        showMsg(`❌ Ошибка при покупке: ${error.message}`, '#e74c3c');
    }
}

// Функция escapeHtml для безопасности
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
