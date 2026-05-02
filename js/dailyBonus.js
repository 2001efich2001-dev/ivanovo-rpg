// js/dailyBonus.js
import { showMessage } from './utils.js';
import { addExperience, money, setStats, inventory, updateUI } from './gameState.js';
import { itemsDB } from './inventory.js';

// Хранилище данных бонуса
export let dailyBonusLastClaim = null;
export let dailyBonusStreak = 0;

// Награды по дням
const rewards = {
    1: { money: 100, exp: 5, item: null },
    2: { money: 300, exp: 10, item: null },
    3: { money: 500, exp: 15, item: 'bread' },
    4: { money: 750, exp: 20, item: null },
    5: { money: 1000, exp: 25, item: 'medkit' },
    6: { money: 1500, exp: 30, item: null },
    7: { money: 2000, exp: 50, item: 'random' }
};

// Случайные предметы для 7-го дня
const rareItems = ['puhovik', 'ushanka', 'termo', 'bercy'];

// Установка данных при загрузке
export function setDailyBonusData(lastClaim, streak) {
    dailyBonusLastClaim = lastClaim;
    dailyBonusStreak = streak || 0;
    console.log('📦 Загружены данные бонуса:', { lastClaim, streak: dailyBonusStreak });
}

// Проверка, можно ли получить бонус
export function canClaimBonus() {
    if (!dailyBonusLastClaim) {
        console.log('🎁 Бонус доступен (никогда не получал)');
        return true;
    }
    
    const lastDate = new Date(dailyBonusLastClaim);
    const today = new Date();
    
    const isToday = lastDate.getDate() === today.getDate() &&
                    lastDate.getMonth() === today.getMonth() &&
                    lastDate.getFullYear() === today.getFullYear();
    
    if (isToday) {
        console.log('🎁 Бонус НЕ доступен (уже получен сегодня)');
        return false;
    }
    
    console.log('🎁 Бонус доступен (новый день)');
    return true;
}

// Получение текущей серии (для отображения)
export function getCurrentStreak() {
    if (!dailyBonusLastClaim) return 0;
    
    const lastDate = new Date(dailyBonusLastClaim);
    const today = new Date();
    
    const isToday = lastDate.getDate() === today.getDate() &&
                    lastDate.getMonth() === today.getMonth() &&
                    lastDate.getFullYear() === today.getFullYear();
    
    if (isToday) return dailyBonusStreak;
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const wasYesterday = lastDate.getDate() === yesterday.getDate() &&
                         lastDate.getMonth() === yesterday.getMonth() &&
                         lastDate.getFullYear() === yesterday.getFullYear();
    
    return wasYesterday ? dailyBonusStreak : 0;
}

// Выдача бонуса
export async function claimDailyBonus() {
    console.log('🔍 claimDailyBonus вызван');
    
    if (!canClaimBonus()) {
        console.log('❌ Бонус не доступен');
        return false;
    }
    
    // Определяем новую серию
    let newStreak = 1;
    if (dailyBonusLastClaim) {
        const lastDate = new Date(dailyBonusLastClaim);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const wasYesterday = lastDate.getDate() === yesterday.getDate() &&
                             lastDate.getMonth() === yesterday.getMonth() &&
                             lastDate.getFullYear() === yesterday.getFullYear();
        
        if (wasYesterday) {
            newStreak = Math.min(dailyBonusStreak + 1, 7);
            console.log(`📈 Серия продолжается: ${dailyBonusStreak} → ${newStreak}`);
        } else {
            newStreak = 1;
            console.log(`🔄 Серия сброшена до 1`);
        }
    } else {
        console.log(`🌟 Первое получение бонуса, серия: 1`);
    }
    
    // Получаем награду
    const reward = rewards[newStreak];
    if (!reward) return false;
    
    console.log(`🎁 Награда за день ${newStreak}: ${reward.money}₽, ${reward.exp} опыта, предмет: ${reward.item || 'нет'}`);
    
    // Начисляем деньги
    const newMoney = money + reward.money;
    setStats(null, null, null, newMoney);
    
    // Начисляем опыт
    addExperience(reward.exp);
    
    // Начисляем предмет
    let itemId = reward.item;
    let itemName = '';
    
    if (itemId === 'random') {
        const randomIndex = Math.floor(Math.random() * rareItems.length);
        itemId = rareItems[randomIndex];
        console.log(`🎲 Случайный предмет: ${itemId}`);
    }
    
    if (itemId) {
        const itemExists = inventory.find(i => i.id === itemId);
        if (itemExists) {
            itemExists.count++;
        } else {
            inventory.push({ id: itemId, count: 1 });
        }
        itemName = itemsDB[itemId]?.name || itemId;
    }
    
    // Обновляем данные бонуса
    dailyBonusLastClaim = new Date().toISOString();
    dailyBonusStreak = newStreak;
    
    console.log('💾 Сохраняем бонус:', { lastClaim: dailyBonusLastClaim, streak: dailyBonusStreak });
    
    updateUI();
    
    // ===== ПРИНУДИТЕЛЬНОЕ СОХРАНЕНИЕ В FIRESTORE =====
    try {
        const { saveGameData } = await import('./firestore.js');
        await saveGameData();
        console.log('✅ Бонус успешно сохранён в Firestore');
    } catch (err) {
        console.error('❌ Ошибка при сохранении бонуса:', err);
    }
    
    // Показываем модальное окно с наградой
    showBonusModal(reward.money, reward.exp, itemName, newStreak);
    
    return true;
}

// Показать модальное окно с наградой
function showBonusModal(moneyReward, expReward, itemReward, streak) {
    const modal = document.getElementById('eventModal');
    const modalContent = document.getElementById('eventModalContent');
    if (!modal || !modalContent) return;
    
    const itemText = itemReward ? `<div>🎁 +1 ${itemReward}</div>` : '';
    
    modalContent.innerHTML = `
        <h3>🎁 ЕЖЕДНЕВНЫЙ БОНУС!</h3>
        <img src="images/daily_bonus.png" alt="Бонус" style="width: 100%; max-width: 200px; border-radius: 32px; margin: 10px 0;">
        <p>День ${streak} подряд! 🔥</p>
        <div>💰 +${moneyReward}₽</div>
        <div>⭐ +${expReward} опыта</div>
        ${itemText}
        <button id="bonusOkBtn" class="action-btn" style="margin-top: 15px;">Отлично! 🎉</button>
    `;
    
    modal.style.display = 'flex';
    
    const btn = document.getElementById('bonusOkBtn');
    if (btn) {
        btn.onclick = () => {
            modal.style.display = 'none';
        };
    }
}

// Получить информацию о бонусе для UI
export function getBonusInfo() {
    const canClaim = canClaimBonus();
    const streak = getCurrentStreak();
    const nextStreak = Math.min(streak + 1, 7);
    const nextReward = rewards[nextStreak];
    
    return {
        canClaim,
        streak,
        nextReward
    };
}
