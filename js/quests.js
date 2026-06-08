// js/quests.js
// ========== БАЗА ДАННЫХ КВЕСТОВ ==========

export const questsDB = {
    // ========== СТАТИЧЕСКИЕ КВЕСТЫ (один раз) ==========
    fishing_master: {
        id: "fishing_master",
        name: "🎣 Рыбный мастер",
        description: "Поймать 10 рыб",
        type: "static",
        requirements: { type: "fishing", count: 10 },
        rewards: { money: 200, exp: 50, item: "fishing_rod" },
        icon: "🎣"
    },
    drunk_master: {
        id: "drunk_master",
        name: "🍺 Пьяный снайпер",
        description: "Выиграть в дротики с опьянением ≥80%",
        type: "static",
        requirements: { type: "darts_win_with_intoxication", minIntoxication: 80 },
        rewards: { money: 300, exp: 100, item: "golden_dart" },
        icon: "🎯"
    },
    fight_club: {
        id: "fight_club",
        name: "👊 Уличный боец",
        description: "Выиграть 5 драк",
        type: "static",
        requirements: { type: "fights_won", count: 5 },
        rewards: { money: 200, exp: 75, item: "brass_knuckles" },
        icon: "👊"
    },
    garbage_king: {
        id: "garbage_king",
        name: "🗑️ Король мусора",
        description: "Найти 15 мусора",
        type: "static",
        requirements: { type: "trash_found", count: 15 },
        rewards: { money: 150, exp: 50, item: "old_boot" },
        icon: "🗑️"
    },
    property_owner: {
        id: "property_owner",
        name: "🏠 Домовладелец",
        description: "Купить любую недвижимость",
        type: "static",
        requirements: { type: "buy_property", count: 1 },
        rewards: { money: 500, exp: 100 },
        icon: "🏠"
    },
    millionaire: {
        id: "millionaire",
        name: "💰 Миллионер",
        description: "Накопить 1,000,000₽",
        type: "static",
        requirements: { type: "money_reach", targetMoney: 1000000 },
        rewards: { money: 100000, exp: 500, title: "🌟 Миллионер" },
        icon: "💰"
    },
    prayer: {
        id: "prayer",
        name: "🙏 Благочестивый",
        description: "Помолиться в церкви 10 раз",
        type: "static",
        requirements: { type: "pray_count", count: 10 },
        rewards: { money: 100, exp: 30, item: "holy_cross" },
        icon: "🙏"
    },
    thief: {
        id: "thief",
        name: "🫳 Ловкий воришка",
        description: "Успешно украсть еду на рынке 3 раза",
        type: "static",
        requirements: { type: "steal_success", count: 3 },
        rewards: { money: 150, exp: 40 },
        icon: "🫳"
    },
    
    // ========== ЕЖЕДНЕВНЫЕ КВЕСТЫ (дейлики) ==========
    daily_catch_fish: {
        id: "daily_catch_fish",
        name: "🐟 Рыбный день",
        description: "Поймать 3 рыбы сегодня",
        type: "daily",
        requirements: { type: "fishing", count: 3 },
        rewards: { money: 50, exp: 20 },
        icon: "🐟"
    },
    daily_win_fight: {
        id: "daily_win_fight",
        name: "💪 Сила духа",
        description: "Выиграть 1 драку сегодня",
        type: "daily",
        requirements: { type: "fights_won", count: 1 },
        rewards: { money: 80, exp: 25 },
        icon: "💪"
    },
    daily_find_trash: {
        id: "daily_find_trash",
        name: "🗑️ Чистый город",
        description: "Найти 3 мусора сегодня",
        type: "daily",
        requirements: { type: "trash_found", count: 3 },
        rewards: { money: 30, exp: 15 },
        icon: "🗑️"
    },
    daily_drink_alcohol: {
        id: "daily_drink_alcohol",
        name: "🍻 Похмелье",
        description: "Выпить 2 алкоголя сегодня",
        type: "daily",
        requirements: { type: "alcohol_consumed", count: 2 },
        rewards: { money: 40, exp: 15 },
        icon: "🍻"
    },
    daily_pray: {
        id: "daily_pray",
        name: "🙏 Благое дело",
        description: "Помолиться в церкви 1 раз сегодня",
        type: "daily",
        requirements: { type: "pray_count", count: 1 },
        rewards: { health: 15, exp: 10 },
        icon: "🙏"
    },
    daily_visit_bar: {
        id: "daily_visit_bar",
        name: "🍺 Завсегдатай",
        description: "Посетить бар 1 раз сегодня",
        type: "daily",
        requirements: { type: "visit_location", locationId: "bar", count: 1 },
        rewards: { money: 20, exp: 10 },
        icon: "🍺"
    },
    
    // ========== РАСОВЫЕ КВЕСТЫ (первые выполнившие) ==========
    race_dart_champion: {
        id: "race_dart_champion",
        name: "🏆 Легенда дартса",
        description: "Первым набрать 300 очков в дротики",
        type: "race",
        requirements: { type: "darts_score", targetScore: 300 },
        rewards: { money: 1000, exp: 500, item: "champion_dart", title: "🏆 Легенда дартса" },
        icon: "🏆"
    },
    race_first_fish_sword: {
        id: "race_first_fish_sword",
        name: "🗡️ Повелитель рыб",
        description: "Первым поймать рыбу-меч",
        type: "race",
        requirements: { type: "catch_fish", fishId: "fish_sword", count: 1 },
        rewards: { money: 500, exp: 200, title: "🗡️ Повелитель рыб" },
        icon: "🗡️"
    },
    race_first_million: {
        id: "race_first_million",
        name: "💎 Первый миллионер",
        description: "Первым накопить 1,000,000₽",
        type: "race",
        requirements: { type: "money_reach", targetMoney: 1000000 },
        rewards: { money: 100000, exp: 500, title: "💎 Миллионер" },
        icon: "💎"
    }
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Получить все квесты определённого типа
export function getQuestsByType(type) {
    return Object.values(questsDB).filter(q => q.type === type);
}

// Получить статические квесты
export function getStaticQuests() {
    return getQuestsByType('static');
}

// Получить ежедневные квесты
export function getDailyQuests() {
    return getQuestsByType('daily');
}

// Получить расовые квесты
export function getRaceQuests() {
    return getQuestsByType('race');
}

// Получить квест по ID
export function getQuestById(questId) {
    return questsDB[questId];
}

// Проверить, выполнен ли статический квест
export function isStaticQuestCompleted(completedQuests, questId) {
    return completedQuests.includes(questId);
}

// Проверить, выполнен ли ежедневный квест
export function isDailyQuestCompleted(dailyProgress, questId) {
    return dailyProgress[questId]?.completed === true;
}

// Получить прогресс ежедневного квеста
export function getDailyQuestProgress(dailyProgress, questId) {
    return dailyProgress[questId]?.progress || 0;
}
