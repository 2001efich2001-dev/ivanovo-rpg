// js/main.js
import { initDOM, updateUI, setLocationChangeCallback, currentLocation, actionLog, setLogUpdateCallback, setExpUpdateCallback, addExperience, updateEnergy, setEnergyUpdateCallback, updateFromFirestoreWithGuard, isTradeBlocked, getTradeBlockTimeRemaining, currentTitle, ownedTitles, setCurrentTitle, tutorialEnabled, tutorialFlags, resetTutorialFlags, setTutorialEnabled, markTutorialShown, isTutorialShown, currentAvatar, ownedAvatars } from './gameState.js';
import { initAuth, auth } from './auth.js';
import { renderItemsTab, renderEquipmentTab, recalcColdFromEquipment, itemsDB, initInventoryTabs, openTradeOfferModal, renderTitlesTab } from './inventory.js';
import { renderInteractiveMap } from './map.js';
import { renderLocation } from './locations.js';
import { startTimeWeatherUpdates, stopTimeWeatherUpdates, updateTimeWeatherUI } from './timeWeather.js';
import { stopWeatherEffects } from './weatherEffects.js';
import { logAction, showMessage, showTutorialTip } from './utils.js';
import { collection, query, orderBy, limit, getDocs, doc, getDoc, where, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { db, getIncomingTradeOffers, getOutgoingTradeOffers, cancelTradeOffer, acceptTradeOffer, rejectTradeOffer, createTradeOffer, subscribeToUserChanges, unsubscribeFromUserChanges } from './firestore.js';
import { initCheats, initQuickCheats } from './cheats.js';
import { setAchievementsData } from './achievements.js';
import { showNewsIfNeeded, initNewsModal } from './news.js';
import { isTradeGuardActive, getPendingTrade } from './tradeGuard.js';
import { updateProfile } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { initChat } from './chat.js';

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

// ========== ОТОБРАЖЕНИЕ ТИТУЛА (БЕЙДЖИКА) ==========
function updatePlayerTitle() {
    const titleSpan = document.getElementById('playerTitle');
    if (!titleSpan) return;
    
    if (currentTitle) {
        titleSpan.textContent = currentTitle;
        titleSpan.style.display = 'inline-block';
    } else {
        titleSpan.style.display = 'none';
    }
}

// ========== УПРАВЛЕНИЕ ТУТОРИАЛОМ ==========
async function handleToggleTutorial() {
    const btn = document.getElementById('toggleTutorialBtn');
    if (!btn) return;
    
    const newState = !tutorialEnabled;
    setTutorialEnabled(newState);
    await import('./firestore.js').then(m => m.saveGameData());
    
    if (newState) {
        btn.textContent = '💡 Подсказки: Вкл';
        btn.style.background = '#2c3e50';
        showMessage('💡 Подсказки включены!', '#4caf50');
    } else {
        btn.textContent = '💡 Подсказки: Выкл';
        btn.style.background = '#7f8c8d';
        showMessage('💡 Подсказки выключены. Ты можешь включить их в любой момент.', '#ffd966');
    }
}

async function handleResetTutorial() {
    resetTutorialFlags();
    await import('./firestore.js').then(m => m.saveGameData());
    showMessage('💡 Все подсказки сброшены! Они появятся снова, когда ты встретишь соответствующую механику.', '#8e44ad');
}

// ========== СТАТИСТИКА ИГРОКОВ ==========
async function updatePlayerStats() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        
        // Общее количество игроков
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalPlayers = usersSnapshot.size;
        document.getElementById('totalPlayersCount').textContent = totalPlayers;
        
        // РЕАЛЬНЫЙ ОНЛАЙН — считаем только тех, кто был активен в последние 2 минуты
        const onlineSnapshot = await getDocs(collection(db, 'online'));
        const now = Date.now();
        const TWO_MINUTES = 2 * 60 * 1000; // 2 минуты
        
        let onlineCount = 0;
        for (const doc of onlineSnapshot.docs) {
            const data = doc.data();
            const lastSeen = data.lastSeen ? new Date(data.lastSeen).getTime() : 0;
            if (now - lastSeen < TWO_MINUTES) {
                onlineCount++;
            }
        }
        document.getElementById('onlineCount').textContent = onlineCount;
        
        console.log(`📊 Статистика: ${onlineCount} онлайн, ${totalPlayers} всего игроков`);
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ========== ОБНОВЛЕНИЕ СТАТУСА ОНЛАЙН (HEARTBEAT) ==========
async function updateOnlineStatus() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const { db } = await import('./firestore.js');
        
        await setDoc(doc(db, 'online', user.uid), {
            uid: user.uid,
            displayName: user.displayName || 'Игрок',
            lastSeen: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        // тихо игнорируем
    }
}

// ========== ПОЛУЧЕНИЕ СПИСКА ОНЛАЙН UID ==========
let onlineUids = new Set();

async function fetchOnlineUids() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        const onlineSnapshot = await getDocs(collection(db, 'online'));
        const now = Date.now();
        const TWO_MINUTES = 2 * 60 * 1000;
        const uids = new Set();
        
        for (const doc of onlineSnapshot.docs) {
            const data = doc.data();
            const lastSeen = data.lastSeen ? new Date(data.lastSeen).getTime() : 0;
            if (now - lastSeen < TWO_MINUTES) {
                uids.add(doc.id);
            }
        }
        onlineUids = uids;
        return uids;
    } catch (error) {
        console.error('Ошибка загрузки онлайн UID:', error);
        return new Set();
    }
}

// ========== ТОП ИГРОКОВ С ИНДИКАТОРОМ ОНЛАЙН ==========
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
        // 1. Получаем список онлайн UID
        await fetchOnlineUids();
        
        // 2. Получаем топ игроков
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('level', 'desc'), orderBy('experience', 'desc'));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            container.innerHTML = '<div style="text-align:center;">Пока нет игроков</div>';
            return;
        }
        
        let html = '<div class="players-list">';
        let rank = 1;
        
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            const uid = docSnap.id;
            const nick = data.displayName || 'Аноним';
            const level = data.level ?? 1;
            const exp = data.experience ?? 0;
            const titles = data.titles || {};
            const currentTitle = titles.current || null;
            
            // 👇 ПРОВЕРКА ОНЛАЙН СТАТУСА
            const isOnline = onlineUids.has(uid);
            const statusIcon = isOnline ? '🟢' : '🔴';
            const statusTitle = isOnline ? 'В сети' : 'Не в сети';
            
            let rankClass = '';
            let rankIcon = '';
            if (rank === 1) {
                rankClass = 'top-player-1';
                rankIcon = '👑';
            } else if (rank === 2) {
                rankClass = 'top-player-2';
                rankIcon = '🥈';
            } else if (rank === 3) {
                rankClass = 'top-player-3';
                rankIcon = '🥉';
            } else {
                rankIcon = `${rank}.`;
            }
            
            const requiredExp = Math.floor(100 * Math.pow(1.2, level - 1));
            
            // Формируем отображение бейджика, если он есть
            const titleBadge = currentTitle ? `<span class="player-title-badge" title="${currentTitle}">${currentTitle}</span>` : '';
            
            html += `
                <div class="player-item ${rankClass}" data-user-id="${uid}" data-user-nick="${escapeHtml(nick)}">
                    <div class="player-info">
                        <div class="player-rank-rank">
                            <span class="player-rank">${rankIcon}</span>
                        </div>
                        <div class="player-details">
                            <div class="player-name-row">
                                <span class="player-nick">
                                    ${escapeHtml(nick)}
                                    <span class="online-status" title="${statusTitle}">${statusIcon}</span>
                                </span>
                                ${titleBadge}
                            </div>
                            <div class="player-stats-row">
                                <span class="player-level">⭐ Уровень ${level}</span>
                                <span class="player-exp">📊 ${Math.floor(exp)}/${requiredExp} опыта</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <button class="trade-offer-btn" data-user-id="${uid}" data-user-nick="${escapeHtml(nick)}">💼 Предложить обмен</button>
                    </div>
                </div>
            `;
            rank++;
        }
        
        html += '</div>';
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
                    <img src="${itemData.image}" alt="${item.name}" class="item-image" loading="lazy"
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
        if (isTradeGuardActive()) {
            const pending = getPendingTrade();
            const remaining = getTradeBlockTimeRemaining();
            console.log(`🛡️ Real-time: обновление пропущено (защита активна, осталось ${remaining}с)`, pending);
            return;
        }
        
        const newLastUpdated = newData.lastUpdated ? new Date(newData.lastUpdated).getTime() : 0;
        
        if (localLastUpdated && newLastUpdated <= localLastUpdated) {
            console.log(`🔄 Real-time: пропускаем старые данные (локальное: ${new Date(localLastUpdated).toLocaleTimeString()}, новое: ${new Date(newLastUpdated).toLocaleTimeString()})`);
            return;
        }
        
        console.log('🔄 Real-time: получены свежие данные, обновляем локальное состояние');
        
        const updated = updateFromFirestoreWithGuard(newData, false);
        
        if (updated) {
            localLastUpdated = newLastUpdated;
            updatePlayerTitle();
            updateAvatarDisplay();
            
            try {
                const { renderItemsTab, renderEquipmentTab, initInventoryTabs, renderHousingTab, renderTitlesTab } = await import('./inventory.js');
                const { renderLocation } = await import('./locations.js');
                
                renderItemsTab();
                renderEquipmentTab();
                initInventoryTabs();
                renderHousingTab?.();
                renderTitlesTab?.();
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

// ========== ОТКРЫТИЕ АГЕНТСТВА НЕДВИЖИМОСТИ "АВИТ0" ==========
async function openRealEstateMarket() {
    playClick();
    
    // 👇 ПОДСКАЗКА: первый раз открыли агентство
    if (tutorialEnabled && !isTutorialShown('shown_estate_agency')) {
        showTutorialTip('📢 Агентство недвижимости "Авит0" — здесь можно купить и продать недвижимость другим игрокам. Перед продажей убедись, что хранилище пустое!', 5000);
        markTutorialShown('shown_estate_agency');
        await import('./firestore.js').then(m => m.saveGameData());
    }
    
    const modal = document.getElementById('realEstateMarketModal');
    const container = document.getElementById('marketListings');
    
    if (!modal || !container) {
        console.error('Модальное окно агентства не найдено');
        return;
    }
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">📭 Загрузка объявлений...</div>';
    modal.style.display = 'flex';
    
    try {
        const { getActiveListings, buyProperty } = await import('./realEstateMarket.js');
        const listings = await getActiveListings();
        
        if (listings.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px;">📭 Нет активных объявлений о продаже недвижимости</div>';
            return;
        }
        
        let html = '<div class="market-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px;">';
        
        for (const listing of listings) {
            const typeIcon = listing.propertyType === 'dorm' ? '🏢' : (listing.propertyType === 'apartment' ? '🏠' : '🏡');
            html += `
                <div class="market-card" style="background: var(--card-bg); border-radius: 16px; padding: 16px; text-align: center; border: 1px solid var(--card-border); transition: transform 0.2s;">
                    <div style="font-size: 48px; margin-bottom: 8px;">${typeIcon}</div>
                    <div style="font-weight: bold; font-size: 1rem; margin-bottom: 4px;">${escapeHtml(listing.propertyName)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;">📦 Продавец: ${escapeHtml(listing.sellerName)}</div>
                    <div style="font-size: 1.2rem; color: var(--accent-gold); font-weight: bold; margin-bottom: 12px;">💰 ${listing.price.toLocaleString()}₽</div>
                    <button class="buy-from-market-btn action-btn" data-id="${listing.id}" data-price="${listing.price}" style="background: var(--buy-btn-bg); border: none; padding: 8px 16px; border-radius: 40px; color: white; cursor: pointer; width: 100%;">💸 Купить</button>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        
        document.querySelectorAll('.buy-from-market-btn').forEach(btn => {
            btn.removeEventListener('click', btn._marketHandler);
            const handler = async () => {
                const listingId = btn.dataset.id;
                const price = parseInt(btn.dataset.price);
                const user = auth.currentUser;
                
                if (!user) {
                    showMessage('❌ Авторизуйтесь для покупки', '#e74c3c');
                    return;
                }
                
                if (confirm(`💰 Купить эту недвижимость за ${price.toLocaleString()}₽?`)) {
                    const { buyProperty } = await import('./realEstateMarket.js');
                    const success = await buyProperty(listingId, user.uid);
                    if (success) {
                        await openRealEstateMarket();
                        const { renderHousingTab } = await import('./inventory.js');
                        renderHousingTab();
                        showMessage(`🏠 Поздравляем! Вы купили недвижимость!`, '#4caf50');
                    }
                }
            };
            btn.addEventListener('click', handler);
            btn._marketHandler = handler;
        });
        
    } catch (error) {
        console.error('Ошибка загрузки объявлений:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color: #e74c3c;">❌ Ошибка загрузки объявлений</div>';
    }
}

// ========== СМЕНА НИКНЕЙМА ==========
async function changeNickname(newNick) {
    const user = auth.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return false;
    }
    
    newNick = newNick.trim();
    if (!newNick) {
        showMessage('❌ Ник не может быть пустым', '#e74c3c');
        return false;
    }
    
    if (newNick.length > 20) {
        showMessage('❌ Ник не может быть длиннее 20 символов', '#e74c3c');
        return false;
    }
    
    if (newNick.length < 3) {
        showMessage('❌ Ник должен содержать минимум 3 символа', '#e74c3c');
        return false;
    }
    
    const invalidChars = /[<>{}[\]\\/|@#$%^&*()+=!`~]/;
    if (invalidChars.test(newNick)) {
        showMessage('❌ Ник содержит недопустимые символы', '#e74c3c');
        return false;
    }
    
    const currentNick = user.displayName;
    if (currentNick === newNick) {
        showMessage('❌ Это ваш текущий ник', '#ffd966');
        return false;
    }
    
    showMessage('🔍 Проверка уникальности ника...', '#ffd966');
    
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('displayName', '==', newNick));
        const querySnapshot = await getDocs(q);
        
        let nickExists = false;
        querySnapshot.forEach(doc => {
            if (doc.id !== user.uid) {
                nickExists = true;
            }
        });
        
        if (nickExists) {
            showMessage(`❌ Ник "${newNick}" уже занят! Выберите другой.`, '#e74c3c');
            return false;
        }
        
        await updateProfile(user, { displayName: newNick });
        
        const userRef = doc(db, 'users', user.uid);
        const { updateDoc } = await import('https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js');
        await updateDoc(userRef, {
            displayName: newNick
        });
        
        const playerNickSpan = document.getElementById('playerNick');
        if (playerNickSpan) playerNickSpan.innerText = newNick;
        
        showMessage(`✅ Ник успешно изменён на "${newNick}"!`, '#4caf50');
        
        try {
            const { updateNickInTradeOffers, updateNickInRealEstateListings } = await import('./firestore.js');
            if (typeof updateNickInTradeOffers === 'function') {
                await updateNickInTradeOffers(user.uid, newNick);
            }
            if (typeof updateNickInRealEstateListings === 'function') {
                await updateNickInRealEstateListings(user.uid, newNick);
            }
        } catch (err) {
            console.log('Не удалось обновить ники в предложениях/объявлениях:', err);
        }
        
        return true;
        
    } catch (error) {
        console.error('Ошибка смены ника:', error);
        showMessage(`❌ Ошибка: ${error.message}`, '#e74c3c');
        return false;
    }
}

// ========== ОБНОВЛЕНИЕ АВАТАРА ==========
function updateAvatarDisplay() {
    const avatarImg = document.getElementById('avatarGif');
    if (!avatarImg) return;
    
    if (currentAvatar === 'default') {
        avatarImg.src = 'images/hero2.png';
        return;
    }
    
    const avatar = itemsDB[currentAvatar];
    if (avatar && avatar.image) {
        avatarImg.src = avatar.image;
    } else {
        avatarImg.src = 'images/hero2.png';
    }
}

// ========== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА КВЕСТОВ ==========
async function openQuestsModal() {
    playClick();
    try {
        const { openQuestsModal: openQuestsUI } = await import('./questUI.js');
        await openQuestsUI();
    } catch (error) {
        console.error('Ошибка открытия квестов:', error);
        showMessage('❌ Система квестов временно недоступна', '#e74c3c');
    }
}

// ========== СИСТЕМА БАНОВ ==========
function checkBanStatus(userData) {
    const ban = userData?.ban;
    if (!ban) return null;
    
    const now = Date.now();
    const banTime = new Date(ban).getTime();
    
    if (now < banTime) {
        const remaining = banTime - now;
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        let text = '⛔ У ВАС БАН! ⛔';
        if (days > 0) {
            text += `\nОсталось: ${days}д ${hours}ч ${minutes}м`;
        } else if (hours > 0) {
            text += `\nОсталось: ${hours}ч ${minutes}м`;
        } else {
            text += `\nОсталось: ${minutes}м`;
        }
        
        return {
            isBanned: true,
            remaining: remaining,
            text: text
        };
    }
    
    return null;
}

function showBanScreen(banInfo) {
    // Удаляем старый бан-экран, если есть
    const oldBan = document.getElementById('banScreen');
    if (oldBan) oldBan.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'banScreen';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        animation: banPulse 0.5s ease infinite alternate;
        pointer-events: all;
        cursor: not-allowed;
    `;
    
    overlay.innerHTML = `
        <div style="
            color: #ff0000;
            font-size: 4rem;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 20px rgba(255, 0, 0, 0.8), 0 0 40px rgba(255, 0, 0, 0.5);
            animation: banText 0.3s ease infinite alternate;
            padding: 20px;
            font-family: 'Impact', 'Arial Black', sans-serif;
            line-height: 1.3;
        ">
            ⛔ У ВАС БАН! ⛔
        </div>
        <div style="
            color: #ff6666;
            font-size: 2rem;
            font-weight: bold;
            text-align: center;
            margin-top: 20px;
            text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
            white-space: pre-line;
            line-height: 1.4;
        ">
            ${banInfo.text}
        </div>
        <div style="
            color: #ff4444;
            font-size: 1.2rem;
            text-align: center;
            margin-top: 30px;
            opacity: 0.7;
            max-width: 80%;
        ">
            🔒 Все действия заблокированы до снятия бана.
        </div>
        <div style="
            color: #888;
            font-size: 0.9rem;
            text-align: center;
            margin-top: 20px;
            opacity: 0.5;
        ">
            По вопросам бана обращайтесь к администрации.
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Добавляем стили анимации (если ещё нет)
    if (!document.getElementById('banStyles')) {
        const style = document.createElement('style');
        style.id = 'banStyles';
        style.textContent = `
            @keyframes banPulse {
                0% { background: rgba(0, 0, 0, 0.95); }
                100% { background: rgba(30, 0, 0, 0.98); }
            }
            @keyframes banText {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(1.05); opacity: 0.9; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Блокируем все взаимодействия с игрой
    document.querySelectorAll('.action-btn, .reset-btn, .modal, .location-circle, .housing-circle, .player-item, .trade-offer-btn, .close-modal').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.3';
    });
    
    // Дополнительно блокируем все клики по игре
    document.querySelectorAll('.game-container, .game-right, .game-left').forEach(el => {
        el.style.pointerEvents = 'none';
    });
    
    // Добавляем обработчик для снятия блокировки (только если бан снят)
    setTimeout(() => {
        // Периодически проверяем, не истёк ли бан
        const checkBanInterval = setInterval(() => {
            // Если оверлей всё ещё на месте, но бан мог истечь
            const currentOverlay = document.getElementById('banScreen');
            if (!currentOverlay) {
                clearInterval(checkBanInterval);
                return;
            }
        }, 30000);
    }, 1000);
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
    
    // ===== ОБРАБОТЧИК КНОПКИ ДОНАТА =====
    const donateBtn = document.getElementById('donateBtn');
    const donateModal = document.getElementById('donateModal');
    if (donateBtn && donateModal) {
        donateBtn.addEventListener('click', () => {
            playClick();
            donateModal.style.display = 'flex';
        });
        donateModal.addEventListener('click', (e) => {
            if (e.target === donateModal) {
                donateModal.style.display = 'none';
            }
        });
        const closeDonateBtn = donateModal.querySelector('.close-modal');
        if (closeDonateBtn) {
            closeDonateBtn.addEventListener('click', () => {
                donateModal.style.display = 'none';
            });
        }
    }
    
    // ===== ОБРАБОТЧИКИ КНОПОК ТУТОРИАЛА =====
    const toggleTutorialBtn = document.getElementById('toggleTutorialBtn');
    const resetTutorialBtn = document.getElementById('resetTutorialBtn');
    
    if (toggleTutorialBtn) {
        toggleTutorialBtn.addEventListener('click', handleToggleTutorial);
        // Устанавливаем начальное состояние кнопки
        if (tutorialEnabled) {
            toggleTutorialBtn.textContent = '💡 Подсказки: Вкл';
            toggleTutorialBtn.style.background = '#2c3e50';
        } else {
            toggleTutorialBtn.textContent = '💡 Подсказки: Выкл';
            toggleTutorialBtn.style.background = '#7f8c8d';
        }
    }
    
    if (resetTutorialBtn) {
        resetTutorialBtn.addEventListener('click', handleResetTutorial);
    }
    
    async function afterLogin() {
        const user = window.auth?.currentUser;
        
        if (user) {
            const key = 'trade_needs_refresh_' + user.uid;
            localStorage.removeItem(key);
        }
        
        window._preventAutoSave = false;
        
        // 👇 ПРОВЕРКА БАНА
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const banInfo = checkBanStatus(userData);
                    
                    if (banInfo && banInfo.isBanned) {
                        showBanScreen(banInfo);
                        // Блокируем игру, но оставляем возможность выйти
                        // Кнопка выхода всё ещё должна работать
                        const logoutBtn = document.getElementById('logoutMenuBtn');
                        if (logoutBtn) {
                            logoutBtn.style.pointerEvents = 'auto';
                            logoutBtn.style.opacity = '1';
                        }
                        return; // Прерываем вход, не даём играть
                    }
                }
            } catch (err) {
                console.warn('Ошибка проверки бана:', err);
            }
            
            try {
                if (userDoc.exists() && userDoc.data().lastUpdated) {
                    localLastUpdated = new Date(userDoc.data().lastUpdated).getTime();
                    console.log('📅 Загружена метка времени lastUpdated:', new Date(localLastUpdated).toLocaleTimeString());
                }
            } catch (err) {
                console.warn('Не удалось загрузить lastUpdated:', err);
            }
            
            setupRealTimeUpdates(user.uid);
            initAchievements();
            
            try {
                const { loadNpcStateFromFirestore } = await import('./npcSystem.js');
                await loadNpcStateFromFirestore(user.uid);
                console.log('🗣️ Состояние NPC загружено');
            } catch (err) {
                console.warn('Ошибка загрузки состояния NPC:', err);
            }
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
        updatePlayerTitle();
        updateAvatarDisplay();
        initChat();
        
        // 👉 ОБНОВЛЯЕМ СТАТИСТИКУ ПОСЛЕ ВХОДА
        await updatePlayerStats();
        setInterval(updatePlayerStats, 60000);

        // ===== ОНЛАЙН =====
        await updateOnlineStatus();
        setInterval(updateOnlineStatus, 30000);
        
        // ===== ПОДСКАЗКА ПРИ ПЕРВОМ ВХОДЕ =====
        if (!isTutorialShown('shown_first_enter')) {
            showTutorialTip('Добро пожаловать в Иваново! 🏙️ Ты — бомж. Твоя цель — выжить и разбогатеть. Начни с того, что попроси подаяние на вокзале.', 6000);
            markTutorialShown('shown_first_enter');
            await import('./firestore.js').then(m => m.saveGameData());
        }
        
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
        
        try {
            const gameState = await import('./gameState.js');
            if (typeof gameState.checkAllHousingPayments === 'function') {
                await gameState.checkAllHousingPayments();
                console.log('🏠 Глобальная проверка недвижимости выполнена');
            }
        } catch (err) {
            console.error('Ошибка при глобальной проверке недвижимости:', err);
        }
        
        await checkHousingPayment();
        startHousingCheckTimer();
        
        setupAboutModal();
        
        initNewsModal();
        setTimeout(() => {
            showNewsIfNeeded();
        }, 500);
        
        initTradeGuardIndicator();
        
        import('./npcSystemUI.js').then(module => {
            if (module.initNpcUI) {
                module.initNpcUI();
                console.log('🗣️ NPC UI инициализирован');
            }
        });
        // ===== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ВЫБОРОВ =====
import('./electionInitializer.js').then(m => m.initElectionSystem());
    }
    
    initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, afterLogin);
    setLocationChangeCallback(onLocationChanged);
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const inventoryBtn = document.getElementById('inventoryBtn');
    const mapBtn = document.getElementById('mapBtn');
    const shopBtn = document.getElementById('shopBtn');
    const questsBtn = document.getElementById('questsBtn');
    const realEstateMarketBtn = document.getElementById('realEstateMarketBtn');
    const topPlayersBtn = document.getElementById('topPlayersBtn');
    const myOffersBtn = document.getElementById('myOffersBtn');
    const logoutMenuBtn = document.getElementById('logoutMenuBtn');
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');
    const changeNickBtn = document.getElementById('changeNickBtn');
    const sendTradeBtn = document.getElementById('sendTradeBtn');
    
    // 👇 НОВАЯ КНОПКА СПРАВОЧНИКА
    const handbookBtn = document.getElementById('handbookBtn');
    
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
            
            setTimeout(() => {
                const activeTab = modal.querySelector('.tab-btn.active');
                if (activeTab) {
                    if (activeTab.dataset.shopTab === 'buy') {
                        buyTab.style.display = 'flex';
                        sellTab.style.display = 'none';
                        shop.renderShopBuyTab();
                    } else if (activeTab.dataset.shopTab === 'sell') {
                        buyTab.style.display = 'none';
                        sellTab.style.display = 'flex';
                        shop.renderShopSellTab();
                    }
                }
                const moneySpan = document.getElementById('shopMoneyValue');
                if (moneySpan) {
                    import('./gameState.js').then(gameState => {
                        moneySpan.textContent = Math.floor(gameState.money);
                    });
                }
            }, 50);
        });
    }
    
    if (questsBtn) {
        questsBtn.addEventListener('click', openQuestsModal);
    }
    
    if (realEstateMarketBtn) {
        realEstateMarketBtn.addEventListener('click', openRealEstateMarket);
    }
    
    if (topPlayersBtn) {
        topPlayersBtn.addEventListener('click', async () => {
            playClick();
            
            // 👇 ПОДСКАЗКА: первый раз открыли топ
            if (tutorialEnabled && !isTutorialShown('shown_top_players')) {
                showTutorialTip('🏆 Топ игроков — здесь ты видишь лучших игроков города. Поднимайся в топ, выполняя квесты и зарабатывая опыт!', 4000);
                markTutorialShown('shown_top_players');
                await import('./firestore.js').then(m => m.saveGameData());
            }
            
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
            
            try {
                const user = auth.currentUser;
                if (user) {
                    await deleteDoc(doc(db, 'online', user.uid));
                    console.log('🔴 Пользователь удалён из онлайна');
                }
            } catch (e) {
                console.warn('Ошибка удаления из онлайна:', e);
            }
            
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
    
    // 👇 ОБРАБОТЧИК ДЛЯ КНОПКИ СПРАВОЧНИКА
    if (handbookBtn) {
        handbookBtn.addEventListener('click', () => {
            playClick();
            import('./handbook.js').then(module => {
                module.openHandbook();
            });
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
    
    if (changeNickBtn) {
        changeNickBtn.addEventListener('click', () => {
            playClick();
            const currentNick = auth.currentUser?.displayName || 'Игрок';
            document.getElementById('currentNickDisplay').innerText = currentNick;
            document.getElementById('newNickInput').value = '';
            document.getElementById('changeNickModal').style.display = 'flex';
        });
    }
    
    const confirmNickBtn = document.getElementById('confirmChangeNickBtn');
    if (confirmNickBtn) {
        confirmNickBtn.addEventListener('click', async () => {
            const newNick = document.getElementById('newNickInput').value;
            if (newNick) {
                await changeNickname(newNick);
                document.getElementById('changeNickModal').style.display = 'none';
            } else {
                showMessage('❌ Введите новый ник', '#e74c3c');
            }
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
