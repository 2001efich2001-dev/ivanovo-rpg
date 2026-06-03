// js/main.js
import { initDOM, updateUI, setLocationChangeCallback, currentLocation, actionLog, setLogUpdateCallback, setExpUpdateCallback, addExperience, updateEnergy, setEnergyUpdateCallback, updateFromFirestoreWithGuard, isTradeBlocked, getTradeBlockTimeRemaining } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment, itemsDB, initInventoryTabs, openTradeOfferModal } from './inventory.js';
import { renderInteractiveMap } from './map.js';
import { renderLocation } from './locations.js';
import { startTimeWeatherUpdates, stopTimeWeatherUpdates, updateTimeWeatherUI } from './timeWeather.js';
import { stopWeatherEffects } from './weatherEffects.js';
import { logAction, showMessage } from './utils.js';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { db, getIncomingTradeOffers, getOutgoingTradeOffers, cancelTradeOffer, acceptTradeOffer, rejectTradeOffer, createTradeOffer, subscribeToUserChanges, unsubscribeFromUserChanges } from './firestore.js';
import { initCheats, initQuickCheats } from './cheats.js';
import { setAchievementsData } from './achievements.js';
import { showNewsIfNeeded, initNewsModal } from './news.js';
import { isTradeGuardActive, getPendingTrade } from './tradeGuard.js';

// ========== ЗВУКИ И МУЗЫКА ==========
let audioCtx = null;
let bgMusic = null;
let isMusicEnabled = true;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration, volume = 0.15) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => playToneInternal(freq, duration, volume));
    } else {
        playToneInternal(freq, duration, volume);
    }
}

function playToneInternal(freq, duration, volume) {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start();
    osc.stop(now + duration);
}

window.playClickSound = () => playTone(880, 0.08, 0.1);
window.playPurchaseSound = () => playTone(660, 0.12, 0.12);
window.playActionSound = () => playTone(523, 0.15, 0.12);

function playClick() { playTone(880, 0.08, 0.1); }
function playPurchase() { playTone(660, 0.12, 0.12); }

function initMusic() {
    if (bgMusic) return;
    bgMusic = new Audio('background.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
    const saved = localStorage.getItem('musicEnabled');
    isMusicEnabled = saved !== null ? saved === 'true' : true;
    const btn = document.getElementById('musicToggle');
    if (btn) btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
}

function startMusic() {
    if (!isMusicEnabled) return;
    if (!bgMusic) initMusic();
    if (bgMusic && bgMusic.paused) bgMusic.play().catch(e => console.log('Автозапуск музыки заблокирован', e));
}

function stopMusic() {
    if (bgMusic && !bgMusic.paused) bgMusic.pause();
}

function toggleMusic() {
    isMusicEnabled = !isMusicEnabled;
    localStorage.setItem('musicEnabled', isMusicEnabled);
    const btn = document.getElementById('musicToggle');
    if (btn) btn.textContent = isMusicEnabled ? '🎵 Музыка Вкл' : '🔇 Музыка Выкл';
    if (isMusicEnabled) startMusic();
    else stopMusic();
}

function showSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.style.opacity = '1';
        splash.style.display = 'flex';
    }
}

function hideSplash() {
    const splash = document.getElementById('splash');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 300);
    }
}

window.hideSplashOnError = () => hideSplash();

function onLocationChanged(newLocationId) {
    console.log(`Смена локации на: ${newLocationId}`);
    renderLocation(newLocationId);
    import('./randomEvents.js').then(m => {
        m.checkAndTriggerEvent('location', { locationId: newLocationId });
    });
}

function renderLogPanel() {
    const container = document.getElementById('logPanel');
    if (!container) return;
    if (actionLog.length === 0) {
        container.innerHTML = '<div class="log-entry system" style="text-align:center; opacity:0.6;">История действий пуста</div>';
        return;
    }
    let html = '';
    const logsToShow = actionLog.slice(-30);
    for (const entry of logsToShow) {
        html += `<div class="log-entry ${entry.type}"><span class="log-time">[${entry.time}]</span>${escapeHtml(entry.message)}</div>`;
    }
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== ТОП ИГРОКОВ ==========
let topPlayersCache = null;
let topPlayersCacheTime = 0;
const TOP_CACHE_TTL = 5 * 60 * 1000;

async function loadTopPlayers(forceRefresh = false) {
    const container = document.getElementById('topPlayersList');
    if (!container) return;
    if (!db) {
        console.error('Firestore не инициализирован');
        container.innerHTML = '<div style="text-align:center;">Ошибка: база данных не инициализирована</div>';
        return;
    }
    const now = Date.now();
    if (!forceRefresh && topPlayersCache && (now - topPlayersCacheTime < TOP_CACHE_TTL)) {
        container.innerHTML = topPlayersCache;
        attachTradeButtons();
        return;
    }
    container.innerHTML = '<div style="text-align:center;">Загрузка...</div>';
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('level', 'desc'), orderBy('experience', 'desc'), limit(20));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            container.innerHTML = '<div style="text-align:center;">Пока нет игроков</div>';
            return;
        }
        let html = '';
        let rank = 1;
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const nick = data.displayName || 'Аноним';
            const level = data.level ?? 1;
            const exp = data.experience ?? 0;
            let rankClass = '';
            if (rank === 1) rankClass = 'top-player-1';
            else if (rank === 2) rankClass = 'top-player-2';
            else if (rank === 3) rankClass = 'top-player-3';
            const requiredExp = Math.floor(100 * Math.pow(1.2, level - 1));
            html += `
                <div class="player-item ${rankClass}" data-user-id="${docSnap.id}" data-user-nick="${escapeHtml(nick)}">
                    <div class="player-info">
                        <span class="player-rank">${rank}.</span>
                        <span class="player-nick">${escapeHtml(nick)}</span>
                        <span class="player-level">⭐ ${level}</span>
                        <span class="player-exp">${Math.floor(exp)}/${requiredExp} опыта</span>
                    </div>
                    <div>
                        <button class="trade-offer-btn" data-user-id="${docSnap.id}" data-user-nick="${escapeHtml(nick)}">💼 Предложить обмен</button>
                    </div>
                </div>
            `;
            rank++;
        }
        container.innerHTML = html;
        topPlayersCache = html;
        topPlayersCacheTime = now;
        attachTradeButtons();
    } catch (error) {
        console.error(error);
        container.innerHTML = '<div style="text-align:center;">Ошибка загрузки топа</div>';
    }
}

function attachTradeButtons() {
    document.querySelectorAll('.trade-offer-btn').forEach(btn => {
        btn.removeEventListener('click', btn._handler);
        const handler = () => {
            const targetUserId = btn.dataset.userId;
            const targetUserNick = btn.dataset.userNick;
            if (targetUserId === auth.currentUser?.uid) {
                showMessage('Нельзя предложить обмен самому себе', '#e74c3c');
                return;
            }
            openTradeOfferModal(targetUserId, targetUserNick);
        };
        btn.addEventListener('click', handler);
        btn._handler = handler;
    });
}

// ========== ТОРГОВЛЯ (обновленная сетка) ==========
let tradeNotificationInterval = null;
let activeTradeTooltip = null;

function hideTradeTooltip() {
    if (activeTradeTooltip && activeTradeTooltip.remove) {
        activeTradeTooltip.remove();
        activeTradeTooltip = null;
    }
}

function showTradeTooltip(item, event, count = 1) {
    hideTradeTooltip();
    
    const sellPrice = Math.max(1, Math.floor((item.price || 0) / 2));
    
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <strong>${item.name}</strong>
        </div>
        <div class="tooltip-content">
            ${item.description || ''}
            ${item.effect?.hunger ? `<div>🍗 Голод: ${item.effect.hunger > 0 ? '+' : ''}${item.effect.hunger}</div>` : ''}
            ${item.effect?.health ? `<div>❤️ Здоровье: ${item.effect.health > 0 ? '+' : ''}${item.effect.health}</div>` : ''}
            ${item.effect?.cold ? `<div>🔥 Тепло: ${item.effect.cold > 0 ? '+' : ''}${item.effect.cold}</div>` : ''}
            <div class="tooltip-divider"></div>
            <div>💰 Покупка: ${item.price || 0}₽</div>
            <div>💸 Продажа: ${sellPrice}₽</div>
            ${count > 1 ? `<div>📦 В наличии: ${count} шт.</div>` : ''}
        </div>
    `;
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
    tooltip.style.zIndex = '10001';
    
    document.body.appendChild(tooltip);
    activeTradeTooltip = tooltip;
}

async function checkNewTradeOffers() {
    const user = auth.currentUser;
    if (!user) return;
    const offers = await getIncomingTradeOffers(user.uid);
    const notification = document.getElementById('tradeNotification');
    if (notification) {
        if (offers.length > 0) {
            notification.style.display = 'flex';
            notification.querySelector('.trade-count')?.setAttribute('data-count', offers.length);
        } else {
            notification.style.display = 'none';
        }
    }
}

async function renderTradeInventorySelector(side) {
    const user = auth.currentUser;
    if (!user) return;
    
    const container = document.getElementById(`trade${side === 'from' ? 'FromItems' : 'ToItems'}`);
    if (!container) return;
    
    if (side === 'from') {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userInv = userDoc.data()?.inventory || [];
        if (userInv.length === 0) {
            container.innerHTML = '<div class="empty-inventory">📦 Инвентарь пуст</div>';
            return;
        }
        
        let html = '<div class="inventory-grid">';
        
        for (const item of userInv) {
            const itemData = itemsDB[item.id];
            if (!itemData) continue;
            
            html += `
                <div class="inventory-slot trade-slot" data-id="${item.id}" data-count="${item.count}" data-side="from">
                    <img src="${itemData.image}" alt="${itemData.name}" class="item-image" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${itemData.icon}%3C/text%3E%3C/svg%3E'">
                    <span class="item-name">${itemData.name}</span>
                    <span class="item-count">×${item.count}</span>
                    <button class="trade-add-btn" data-id="${item.id}" data-max="${item.count}" data-side="from">➕</button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        document.querySelectorAll('#tradeFromItems .trade-slot').forEach(slot => {
            const itemId = slot.dataset.id;
            const itemData = itemsDB[itemId];
            const count = parseInt(slot.dataset.count);
            
            slot.addEventListener('mouseenter', (e) => {
                showTradeTooltip(itemData, e, count);
            });
            slot.addEventListener('mouseleave', hideTradeTooltip);
            slot.addEventListener('mousemove', (e) => {
                if (activeTradeTooltip) {
                    activeTradeTooltip.style.left = (e.clientX + 15) + 'px';
                    activeTradeTooltip.style.top = (e.clientY + 15) + 'px';
                }
            });
        });
        
    } else {
        const allItems = Object.values(itemsDB);
        
        let html = '<div class="inventory-grid">';
        
        for (const item of allItems) {
            html += `
                <div class="inventory-slot trade-slot" data-id="${item.id}" data-side="to">
                    <img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Ctext x=%2232%22 y=%2232%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2230%22%3E${item.icon}%3C/text%3E%3C/svg%3E'">
                    <span class="item-name">${item.name}</span>
                    <button class="trade-add-btn" data-id="${item.id}" data-side="to">➕</button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        document.querySelectorAll('#tradeToItems .trade-slot').forEach(slot => {
            const itemId = slot.dataset.id;
            const itemData = itemsDB[itemId];
            
            slot.addEventListener('mouseenter', (e) => {
                showTradeTooltip(itemData, e);
            });
            slot.addEventListener('mouseleave', hideTradeTooltip);
            slot.addEventListener('mousemove', (e) => {
                if (activeTradeTooltip) {
                    activeTradeTooltip.style.left = (e.clientX + 15) + 'px';
                    activeTradeTooltip.style.top = (e.clientY + 15) + 'px';
                }
            });
        });
    }
    
    document.querySelectorAll('.trade-add-btn').forEach(btn => {
        btn.removeEventListener('click', btn._handler);
        const handler = async (e) => {
            e.stopPropagation();
            const sideType = btn.dataset.side === 'from' ? 'from' : 'to';
            const itemId = btn.dataset.id;
            const itemData = itemsDB[itemId];
            let maxCount = Infinity;
            if (sideType === 'from') {
                maxCount = parseInt(btn.dataset.max);
            }
            const count = prompt(`Сколько ${itemData?.name} вы хотите ${sideType === 'from' ? 'отдать' : 'получить'}? ${sideType === 'from' ? `(макс. ${maxCount})` : ''}`, '1');
            const numCount = parseInt(count);
            if (isNaN(numCount) || numCount < 1 || (sideType === 'from' && numCount > maxCount)) {
                showMessage('Некорректное количество', '#e74c3c');
                return;
            }
            const selectedContainer = document.getElementById(`tradeSelected${sideType === 'from' ? 'From' : 'To'}`);
            if (!selectedContainer) return;
            
            let existingItem = null;
            for (const el of selectedContainer.querySelectorAll('.selected-item')) {
                if (el.dataset.id === itemId) {
                    existingItem = el;
                    break;
                }
            }
            if (existingItem) {
                const countSpan = existingItem.querySelector('.selected-count');
                const currentCount = parseInt(countSpan.textContent);
                const newCount = currentCount + numCount;
                if (sideType === 'from' && newCount > maxCount) {
                    showMessage(`Нельзя добавить больше, чем есть в инвентаре (${maxCount})`, '#e74c3c');
                    return;
                }
                countSpan.textContent = newCount;
            } else {
                const newItemHtml = `
                    <div class="selected-item" data-id="${itemId}" data-count="${numCount}">
                        <span>${itemData.icon} ${itemData.name} ×<span class="selected-count">${numCount}</span></span>
                        <button class="remove-item-btn">✖️</button>
                    </div>
                `;
                selectedContainer.insertAdjacentHTML('beforeend', newItemHtml);
                selectedContainer.querySelector('.remove-item-btn:last-child').addEventListener('click', (e) => {
                    e.target.closest('.selected-item').remove();
                });
            }
        };
        btn.addEventListener('click', handler);
        btn._handler = handler;
    });
}

// ========== ОБНОВЛЁННАЯ ФУНКЦИЯ ОТПРАВКИ ПРЕДЛОЖЕНИЯ ==========
async function sendTradeOffer() {
    const modal = document.getElementById('tradeOfferModal');
    const targetUserId = modal.dataset.targetUserId;
    const targetUserNick = modal.dataset.targetUserNick;
    const user = auth.currentUser;
    if (!user || !targetUserId) return;
    
    // Собираем предметы, которые отдаём
    const fromItems = [];
    for (const el of document.querySelectorAll('#tradeSelectedFrom .selected-item')) {
        const itemId = el.dataset.id;
        const count = parseInt(el.querySelector('.selected-count').textContent);
        fromItems.push({ id: itemId, count });
    }
    
    // Собираем предметы, которые получаем
    const toItems = [];
    for (const el of document.querySelectorAll('#tradeSelectedTo .selected-item')) {
        const itemId = el.dataset.id;
        const count = parseInt(el.querySelector('.selected-count').textContent);
        toItems.push({ id: itemId, count });
    }
    
    // Собираем недвижимость, которую продаём
    const fromHousing = [];
    for (const el of document.querySelectorAll('#tradeSelectedHousing .selected-item')) {
        const homeId = el.dataset.id;
        fromHousing.push(homeId);
    }
    
    // Недвижимость, которую хотим получить
    const toHousing = [];
    
    const fromMoney = parseInt(document.getElementById('tradeFromMoney').value) || 0;
    const toMoney = parseInt(document.getElementById('tradeToMoney').value) || 0;
    
    if (fromItems.length === 0 && fromMoney === 0 && toItems.length === 0 && toMoney === 0 && fromHousing.length === 0 && toHousing.length === 0) {
        showMessage('Предложите хоть что-то в обмен', '#e74c3c');
        return;
    }
    
    try {
        await createTradeOffer(user.uid, user.displayName, targetUserId, targetUserNick, fromItems, fromMoney, toItems, toMoney, fromHousing, toHousing);
        showMessage('Предложение обмена отправлено!', '#4caf50');
        modal.style.display = 'none';
        document.getElementById('tradeSelectedFrom').innerHTML = '';
        document.getElementById('tradeSelectedTo').innerHTML = '';
        document.getElementById('tradeSelectedHousing').innerHTML = '';
        document.getElementById('tradeFromMoney').value = 0;
        document.getElementById('tradeToMoney').value = 0;
    } catch (error) {
        showMessage(`Ошибка: ${error.message}`, '#e74c3c');
    }
}

async function openMyOffersModal() {
    const user = auth.currentUser;
    if (!user) return;
    const incoming = await getIncomingTradeOffers(user.uid);
    const outgoing = await getOutgoingTradeOffers(user.uid);
    const modal = document.getElementById('myOffersModal');
    if (!modal) return;
    const container = document.getElementById('myOffersList');
    if (!container) return;
    let html = '<div style="margin-bottom: 12px;"><strong>📥 Входящие предложения</strong></div>';
    if (incoming.length === 0) {
        html += '<div class="inventory-item" style="justify-content:center;">Нет входящих предложений</div>';
    } else {
        for (const offer of incoming) {
            html += `
                <div class="inventory-item">
                    <div class="item-info">
                        <div><strong>${offer.fromUserNick}</strong><br>
                        ${offer.fromItems.map(i => `${itemsDB[i.id]?.icon} ${itemsDB[i.id]?.name} ×${i.count}`).join(', ') || '—'}
                        ${offer.fromMoney > 0 ? ` + ${offer.fromMoney}₽` : ''}
                        → 
                        ${offer.toItems.map(i => `${itemsDB[i.id]?.icon} ${itemsDB[i.id]?.name} ×${i.count}`).join(', ') || '—'}
                        ${offer.toMoney > 0 ? ` + ${offer.toMoney}₽` : ''}
                        </div>
                    </div>
                    <div>
                        <button class="accept-offer-btn" data-id="${offer.id}">✅ Принять</button>
                        <button class="reject-offer-btn" data-id="${offer.id}">❌ Отклонить</button>
                    </div>
                </div>
            `;
        }
    }
    html += '<div style="margin-top: 16px; margin-bottom: 12px;"><strong>📤 Исходящие предложения</strong></div>';
    if (outgoing.length === 0) {
        html += '<div class="inventory-item" style="justify-content:center;">Нет исходящих предложений</div>';
    } else {
        for (const offer of outgoing) {
            html += `
                <div class="inventory-item">
                    <div class="item-info">
                        <div><strong>Для: ${offer.toUserNick}</strong><br>
                        ${offer.fromItems.map(i => `${itemsDB[i.id]?.icon} ${itemsDB[i.id]?.name} ×${i.count}`).join(', ') || '—'}
                        ${offer.fromMoney > 0 ? ` + ${offer.fromMoney}₽` : ''}
                        → 
                        ${offer.toItems.map(i => `${itemsDB[i.id]?.icon} ${itemsDB[i.id]?.name} ×${i.count}`).join(', ') || '—'}
                        ${offer.toMoney > 0 ? ` + ${offer.toMoney}₽` : ''}
                        </div>
                    </div>
                    <div>
                        <button class="cancel-offer-btn" data-id="${offer.id}">✖️ Отозвать</button>
                    </div>
                </div>
            `;
        }
    }
    container.innerHTML = html;
    document.querySelectorAll('.accept-offer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await acceptTradeOffer(btn.dataset.id, user.uid);
            openMyOffersModal();
            checkNewTradeOffers();
        });
    });
    document.querySelectorAll('.reject-offer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await rejectTradeOffer(btn.dataset.id, user.uid);
            openMyOffersModal();
            checkNewTradeOffers();
        });
    });
    document.querySelectorAll('.cancel-offer-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await cancelTradeOffer(btn.dataset.id, user.uid);
            openMyOffersModal();
        });
    });
    modal.style.display = 'flex';
}

// ========== REAL-TIME ОБНОВЛЕНИЕ ДАННЫХ (С ЗАЩИТОЙ TRADEGUARD) ==========
let realTimeUnsubscribe = null;
let localLastUpdated = null;

function setupRealTimeUpdates(userId) {
    if (realTimeUnsubscribe) {
        realTimeUnsubscribe();
        realTimeUnsubscribe = null;
    }
    
    subscribeToUserChanges(userId, async (newData, isRealtime = true) => {
        // ===== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: ИСПОЛЬЗУЕМ TRADEGUARD =====
        // Если защита активна — полностью пропускаем realtime обновление
        if (isTradeGuardActive()) {
            const pending = getPendingTrade();
            const remaining = getTradeBlockTimeRemaining();
            console.log(`🛡️ Real-time: обновление пропущено (защита активна, осталось ${remaining}с)`, pending);
            return;
        }
        
        // Проверяем, что данные не старые
        const newLastUpdated = newData.lastUpdated ? new Date(newData.lastUpdated).getTime() : 0;
        
        if (localLastUpdated && newLastUpdated <= localLastUpdated) {
            console.log(`🔄 Real-time: пропускаем старые данные (локальное: ${new Date(localLastUpdated).toLocaleTimeString()}, новое: ${new Date(newLastUpdated).toLocaleTimeString()})`);
            return;
        }
        
        console.log('🔄 Real-time: получены свежие данные, обновляем локальное состояние');
        
        // Используем защищённую функцию обновления
        const updated = updateFromFirestoreWithGuard(newData, false);
        
        if (updated) {
            localLastUpdated = newLastUpdated;
            
            // Обновляем UI компоненты
            try {
                const { renderItemsTab, renderEquipmentTab, initInventoryTabs, renderHousingTab } = await import('./inventory.js');
                const { renderLocation } = await import('./locations.js');
                
                renderItemsTab();
                renderEquipmentTab();
                initInventoryTabs();
                renderHousingTab?.();
                renderLocation(currentLocation);
                
                showMessage('🔄 Данные синхронизированы', '#4caf50');
            } catch (err) {
                console.error('Ошибка при обновлении UI:', err);
            }
        } else {
            console.log('🛡️ Real-time: обновление отклонено защитой');
        }
    });
    
    realTimeUnsubscribe = () => unsubscribeFromUserChanges();
}

// ========== КОММУНАЛКА/АРЕНДА ==========
let housingCheckInterval = null;

async function checkHousingPayment() {
    const user = window.auth?.currentUser;
    if (!user) return;
    
    try {
        const gameState = await import('./gameState.js');
        const result = await gameState.checkHousingPayment();
        
        if (result && result.success === false) {
            const { renderHousingTab } = await import('./inventory.js');
            const housingTab = document.getElementById('housingTab');
            if (housingTab && housingTab.style.display !== 'none') {
                renderHousingTab();
            }
            
            const { currentLocation, setCurrentLocation } = gameState;
            if (currentLocation === 'dorm_home' || currentLocation === 'apartment_home' || currentLocation === 'house_home') {
                setCurrentLocation('dump_home');
            }
        }
    } catch (err) {
        console.error('Ошибка при проверке коммуналки:', err);
    }
}

function startHousingCheckTimer() {
    if (housingCheckInterval) clearInterval(housingCheckInterval);
    
    housingCheckInterval = setInterval(() => {
        console.log('🏠 Плановая проверка коммуналки/аренды...');
        checkHousingPayment();
    }, 24 * 60 * 60 * 1000);
}

function stopHousingCheckTimer() {
    if (housingCheckInterval) {
        clearInterval(housingCheckInterval);
        housingCheckInterval = null;
    }
}

// ========== ЕЖЕДНЕВНЫЙ БОНУС ==========
let bonusIndicatorInterval = null;

async function checkDailyBonus() {
    try {
        const dailyBonus = await import('./dailyBonus.js');
        if (await dailyBonus.canClaimBonus()) {
            await dailyBonus.claimDailyBonus();
            await updateBonusIndicator();
        }
    } catch (err) {
        console.error('Ошибка при проверке бонуса:', err);
    }
}

async function updateBonusIndicator() {
    const indicator = document.getElementById('dailyBonusIndicator');
    if (!indicator) return;
    
    try {
        const dailyBonus = await import('./dailyBonus.js');
        const canClaim = await dailyBonus.canClaimBonus();
        const streak = await dailyBonus.getCurrentStreak();
        
        indicator.style.display = 'inline-block';
        
        if (canClaim) {
            indicator.style.animation = 'bonusPulse 1s infinite';
            indicator.style.opacity = '1';
            indicator.title = `🎁 Бонус доступен! Нажми, чтобы получить`;
        } else {
            indicator.style.animation = 'none';
            indicator.style.opacity = '0.7';
            indicator.title = `✅ Бонус получен сегодня! Серия: ${streak} день(ей) 🔥`;
        }
    } catch (err) {
        console.error('Ошибка при обновлении индикатора бонуса:', err);
    }
}

// ========== МОДАЛЬНОЕ ОКНО "ОБ АВТОРЕ" ==========
function setupAboutModal() {
    const developerLink = document.getElementById('developerLink');
    const aboutModal = document.getElementById('aboutModal');
    const closeAboutBtn = document.getElementById('closeAboutModal');
    
    if (developerLink && aboutModal) {
        developerLink.addEventListener('click', () => {
            aboutModal.style.display = 'flex';
            if (typeof window.playClickSound === 'function') window.playClickSound();
        });
    }
    
    if (closeAboutBtn && aboutModal) {
        closeAboutBtn.addEventListener('click', () => {
            aboutModal.style.display = 'none';
        });
    }
    
    if (aboutModal) {
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                aboutModal.style.display = 'none';
            }
        });
    }
}

// ========== АЧИВКИ ==========
async function initAchievements() {
    try {
        const { setAchievementsData: setData } = await import('./achievements.js');
        
        const user = auth.currentUser;
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().achievements) {
                setData(userDoc.data().achievements);
                console.log('🏆 Данные достижений загружены');
            } else {
                console.log('📭 Ачивок в Firestore нет');
            }
        }
        
        console.log('🏆 Система достижений инициализирована');
    } catch (err) {
        console.error('Ошибка инициализации ачивок:', err);
    }
}

// ========== ДОБАВЛЯЕМ ВИЗУАЛЬНЫЙ ИНДИКАТОР ЗАЩИТЫ ==========
function initTradeGuardIndicator() {
    // Добавляем индикатор в правый верхний угол (рядом с аватаром)
    const gameRight = document.querySelector('.game-right');
    if (gameRight && !document.getElementById('tradeGuardStatus')) {
        const indicator = document.createElement('div');
        indicator.id = 'tradeGuardStatus';
        indicator.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(46, 125, 50, 0.9);
            color: white;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
            display: none;
            align-items: center;
            gap: 5px;
            z-index: 100;
            backdrop-filter: blur(4px);
            pointer-events: none;
        `;
        indicator.innerHTML = '🛡️ Обмен...';
        gameRight.style.position = 'relative';
        gameRight.appendChild(indicator);
    }
    
    // Периодически проверяем статус защиты
    setInterval(() => {
        const indicator = document.getElementById('tradeGuardStatus');
        if (indicator) {
            if (isTradeGuardActive()) {
                const remaining = getTradeBlockTimeRemaining();
                indicator.style.display = 'flex';
                indicator.innerHTML = `🛡️ Обмен (${remaining}с)`;
                indicator.style.background = 'rgba(46, 125, 50, 0.9)';
            } else {
                indicator.style.display = 'none';
            }
        }
    }, 500);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('gameContainer');
    const authContainer = document.getElementById('authContainer');
    if (gameContainer) gameContainer.classList.add('game-container-hidden');
    if (authContainer) authContainer.style.display = 'block';
    initDOM();
    const loginFormDiv = document.getElementById('loginForm');
    const registerFormDiv = document.getElementById('registerForm');
    const playerNickSpan = document.getElementById('playerNick');
    setLogUpdateCallback(() => { renderLogPanel(); });
    setExpUpdateCallback(() => { updateUI(); });
    
    async function afterLogin() {
        const user = window.auth?.currentUser;
        
        if (user) {
            const key = 'trade_needs_refresh_' + user.uid;
            localStorage.removeItem(key);
        }
        
        window._preventAutoSave = false;
        
        if (user) {
            // Загружаем lastUpdated из Firestore при входе
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists() && userDoc.data().lastUpdated) {
                    localLastUpdated = new Date(userDoc.data().lastUpdated).getTime();
                    console.log('📅 Загружена метка времени lastUpdated:', new Date(localLastUpdated).toLocaleTimeString());
                }
            } catch (err) {
                console.warn('Не удалось загрузить lastUpdated:', err);
            }
            
            setupRealTimeUpdates(user.uid);
            initAchievements();
        }
        
        renderItemsTab();
        renderEquipmentTab();
        recalcColdFromEquipment();
        initInventoryTabs();
        renderLocation(currentLocation);
        updateTimeWeatherUI();
        startTimeWeatherUpdates();
        renderLogPanel();
        updateUI();
        
        if (gameContainer) gameContainer.classList.remove('game-container-hidden');
        hideSplash();
        
        if (isMusicEnabled && bgMusic && bgMusic.paused) startMusic();
        
        setEnergyUpdateCallback(() => { updateUI(); });
        setInterval(() => { updateEnergy(); }, 120000);
        
        if (tradeNotificationInterval) clearInterval(tradeNotificationInterval);
        tradeNotificationInterval = setInterval(() => {
            checkNewTradeOffers();
        }, 30000);
        checkNewTradeOffers();
        
        // ===== ЕЖЕДНЕВНЫЙ БОНУС =====
        updateBonusIndicator();
        
        if (bonusIndicatorInterval) clearInterval(bonusIndicatorInterval);
        bonusIndicatorInterval = setInterval(() => {
            updateBonusIndicator();
        }, 60000);
        
        const bonusIndicator = document.getElementById('dailyBonusIndicator');
        if (bonusIndicator) {
            bonusIndicator.addEventListener('click', async () => {
                const dailyBonus = await import('./dailyBonus.js');
                const canClaim = await dailyBonus.canClaimBonus();
                
                if (canClaim) {
                    await dailyBonus.claimDailyBonus();
                    await updateBonusIndicator();
                    showMessage('🎁 Бонус получен! Загляни завтра снова!', '#4caf50');
                } else {
                    const streak = await dailyBonus.getCurrentStreak();
                    showMessage(`📅 Бонус уже получен сегодня! Серия: ${streak} день(ей) подряд 🔥`, '#ffd966');
                }
            });
        }
        
        // ===== ГЛОБАЛЬНАЯ ПРОВЕРКА НЕДВИЖИМОСТИ =====
        try {
            const gameState = await import('./gameState.js');
            if (typeof gameState.checkAllHousingPayments === 'function') {
                await gameState.checkAllHousingPayments();
                console.log('🏠 Глобальная проверка недвижимости выполнена');
            }
        } catch (err) {
            console.error('Ошибка при глобальной проверке недвижимости:', err);
        }
        
        // ===== ПРОВЕРКА ТЕКУЩЕГО ЖИЛЬЯ =====
        await checkHousingPayment();
        startHousingCheckTimer();
        
        // ===== МОДАЛЬНОЕ ОКНО "ОБ АВТОРЕ" =====
        setupAboutModal();
        
        // ===== НОВОСТНОЕ ОКНО =====
        initNewsModal();
        setTimeout(() => {
            showNewsIfNeeded();
        }, 500);
        
        // ===== ИНИЦИАЛИЗАЦИЯ ИНДИКАТОРА ЗАЩИТЫ =====
        initTradeGuardIndicator();
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    setLocationChangeCallback(onLocationChanged);
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const shopBtn = document.getElementById('shopBtn');
    const topPlayersBtn = document.getElementById('topPlayersBtn');
    const myOffersBtn = document.getElementById('myOffersBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');
    const sendTradeBtn = document.getElementById('sendTradeBtn');
    
    if (loginBtn) loginBtn.addEventListener('click', () => { playClick(); showSplash(); });
    if (registerBtn) registerBtn.addEventListener('click', () => { playClick(); showSplash(); });
    
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            playClick();
            renderItemsTab();
            renderEquipmentTab();
            initInventoryTabs();
            document.getElementById('inventoryModal').style.display = 'flex';
        });
    }
    
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            playClick();
            renderInteractiveMap();
            document.getElementById('mapModal').style.display = 'flex';
        });
    }
    
    if (shopBtn) {
        shopBtn.addEventListener('click', async () => {
            playClick();
            const shop = await import('./shop.js');
            shop.renderShopBuyTab();
            shop.renderShopSellTab();
            const modal = document.getElementById('shopModal');
            const tabs = modal.querySelectorAll('.tab-btn');
            const buyTab = document.getElementById('shopBuyTab');
            const sellTab = document.getElementById('shopSellTab');
            const switchShopTab = (tab) => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                if (tab.dataset.shopTab === 'buy') {
                    buyTab.style.display = 'flex';
                    sellTab.style.display = 'none';
                    shop.renderShopBuyTab();
                } else {
                    buyTab.style.display = 'none';
                    sellTab.style.display = 'flex';
                    shop.renderShopSellTab();
                }
            };
            const newTabs = modal.querySelectorAll('.tab-btn');
            newTabs.forEach(tab => {
                tab.removeEventListener('click', tab._shopListener);
                const handler = () => switchShopTab(tab);
                tab.addEventListener('click', handler);
                tab._shopListener = handler;
            });
            modal.style.display = 'flex';
        });
    }
    
    if (topPlayersBtn) {
        topPlayersBtn.addEventListener('click', async () => {
            playClick();
            const modal = document.getElementById('topModal');
            await loadTopPlayers();
            modal.style.display = 'flex';
            const refreshBtn = document.getElementById('refreshTopBtn');
            if (refreshBtn) {
                refreshBtn.onclick = () => {
                    loadTopPlayers(true);
                };
            }
        });
    }
    
    if (myOffersBtn) {
        myOffersBtn.addEventListener('click', () => {
            playClick();
            openMyOffersModal();
        });
    }
    
    if (sendTradeBtn) {
        sendTradeBtn.addEventListener('click', () => {
            sendTradeOffer();
        });
    }
    
    if (logoutMenuBtn) {
        logoutMenuBtn.addEventListener('click', async () => {
            playClick();
            stopWeatherEffects();
            stopTimeWeatherUpdates();
            stopHousingCheckTimer();
            
            if (realTimeUnsubscribe) {
                realTimeUnsubscribe();
                realTimeUnsubscribe = null;
            }
            
            if (bonusIndicatorInterval) {
                clearInterval(bonusIndicatorInterval);
                bonusIndicatorInterval = null;
            }
            
            await auth.signOut();
            if (gameContainer) gameContainer.classList.add('game-container-hidden');
            if (authContainer) authContainer.style.display = 'block';
            hideSplash();
            if (tradeNotificationInterval) clearInterval(tradeNotificationInterval);
        });
    }
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            playClick();
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('rpgTheme', isLight ? 'light' : 'dark');
        });
        const savedTheme = localStorage.getItem('rpgTheme');
        if (savedTheme === 'light') document.body.classList.add('light-theme');
    }
    
    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            playClick();
            toggleMusic();
        });
    }
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            playClick();
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    initMusic();
    const startMusicOnFirstClick = () => {
        if (isMusicEnabled && bgMusic && bgMusic.paused) startMusic();
        document.body.removeEventListener('click', startMusicOnFirstClick);
    };
    document.body.addEventListener('click', startMusicOnFirstClick);
    
    setTimeout(() => {
        if (!auth.currentUser) hideSplash();
    }, 1500);
    
    setInterval(() => {
        import('./randomEvents.js').then(m => {
            m.checkAndTriggerEvent('timer');
        });
    }, 15 * 60 * 1000);
    
    updateUI();
});

window.addEventListener('beforeunload', () => {
    import('./firestore.js').then(m => {
        if (typeof m.saveGameData === 'function') m.saveGameData();
    });
});

initCheats();
initQuickCheats();
