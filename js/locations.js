// js/locations.js
import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction, showTutorialTip } from './utils.js';
import { createWeatherLayers, removeWeatherLayers, updateDarkness, updateWeatherEffects } from './weatherEffects.js';
import { addExperience, inventory, health, hunger, cold, money, maxHealth, maxHunger, maxCold, setStats, updateUI, hasEnoughEnergy, spendEnergy, energy, setEnergy, intoxication, getIntoxicationLuckModifier, getIntoxicationDamageModifier, canPerformAction, addIntoxication, reduceIntoxication, markTutorialShown, isTutorialShown, tutorialEnabled, coldFloor } from './gameState.js';
import { updateAchievementStats } from './achievements.js';

// Локальный вызов звука (через глобальную функцию из main.js)
function playClick() {
    if (typeof window.playClickSound === 'function') window.playClickSound();
}

// Стоимость энергии для разных действий
const energyCosts = {
    beg: 10,
    search: 15,
    trade: 5,
    steal: 20,
    scavenge: 15,
    pray: 5,
    get_food: 10,
    drink: 5,
    fight: 25,
    eat: 5,
    sleep: 0,
    fishing: 15,
    relax: 0,
    collect_water: 5,
    darts: 10,
    slot_machine: 0,
    rest_dump: 0,
    storage: 0,
    talk: 0,
    zombie_shooter: 20
};

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ КВЕСТОВ ==========
async function updateQuest(statType, value = 1, context = {}) {
    try {
        const { updateQuestProgress } = await import('./questSystem.js');
        await updateQuestProgress(statType, value, context);
    } catch (err) {
        if (!err.message?.includes('Failed to fetch')) {
            console.warn('Ошибка обновления квеста:', err);
        }
    }
}

// ========== ПОКАЗАТЬ ПОДСКАЗКУ ДЛЯ ДЕЙСТВИЯ ==========
async function showActionTip(flagKey, tipText) {
    if (!tutorialEnabled) return;
    if (isTutorialShown(flagKey)) return;
    
    showTutorialTip(tipText, 4000);
    markTutorialShown(flagKey);
    await import('./firestore.js').then(m => m.saveGameData());
}

// Модификация риска в зависимости от опьянения
function applyIntoxicationToRisk(originalRisk, intoxicationLevel) {
    if (intoxicationLevel < 20) return originalRisk;
    if (intoxicationLevel < 50) return originalRisk + 10;
    if (intoxicationLevel < 80) return originalRisk + 25;
    return originalRisk + 50;
}

// Модификация урона/потери здоровья в зависимости от опьянения
function applyIntoxicationToDamage(originalDamage, intoxicationLevel, isSuccess = true) {
    if (!isSuccess) return originalDamage;
    const modifier = getIntoxicationDamageModifier();
    if (modifier === 1.0) return originalDamage;
    return Math.floor(originalDamage * modifier);
}

// ========== ФУНКЦИЯ ДЛЯ ПРИМЕНЕНИЯ ТЕПЛА С ПОРОГОМ ==========
function applyColdWithFloor(newColdValue) {
    const floor = coldFloor || 0;
    return Math.min(maxCold, Math.max(floor, newColdValue));
}

// ========== ЕДИНАЯ ФУНКЦИЯ ОТДЫХА (ПОЛНОСТЬЮ КАК В НОЧЛЕЖКЕ) ==========
async function restInHome(locationId, locationName) {
    // Список локаций, где доступен отдых
    const restLocations = ['dump_home', 'dorm_home', 'apartment_home', 'house_home'];
    if (!restLocations.includes(locationId)) {
        showMessage('❌ Здесь нельзя отдохнуть', '#e74c3c');
        return false;
    }

    // Проверка голода
    if (hunger < 15) {
        showMessage('❌ Вы слишком голодны, чтобы спать. Поешьте сначала!', '#e74c3c');
        return false;
    }

    // ===== ПОЛНОСТЬЮ КАК В НОЧЛЕЖКЕ =====
    // 1. Создаём затемнение
    const overlay = document.createElement('div');
    overlay.id = 'sleepOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.zIndex = '10002';
    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.opacity = '0';
    document.body.appendChild(overlay);
    
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    
    // 2. Восстанавливаем параметры в зависимости от жилья
    let healthRestore, energyRestore;
    
    switch (locationId) {
        case 'dump_home':
            healthRestore = 15;
            energyRestore = 30;
            break;
        case 'dorm_home':
            healthRestore = 25;
            energyRestore = 40;
            break;
        case 'apartment_home':
            healthRestore = 35;
            energyRestore = 50;
            break;
        case 'house_home':
            healthRestore = 50;
            energyRestore = 60;
            break;
        default:
            healthRestore = 20;
            energyRestore = 30;
    }
    
    // Применяем восстановление
    const newHealth = Math.min(maxHealth, health + healthRestore);
    const newEnergy = Math.min(100, energy + energyRestore);
    setStats(newHealth, hunger, cold, money);
    setEnergy(newEnergy);
    reduceIntoxication(30);
    
    // 3. Пропускаем 8 часов
    setTimeout(async () => {
        const { addGameHours } = await import('./timeWeather.js');
        addGameHours(8);
        updateUI();
        await saveGameData();
    }, 500);
    
    // 4. Убираем затемнение через 3.5 секунды
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }, 3500);
    
    // 5. Показываем сообщение
    const message = `🛌 Сон в ${locationName} завершён! +${healthRestore}❤️, +${energyRestore}⚡`;
    addLogEntry(`🛌 Вы спали в ${locationName}. Прошло 8 часов.`, 'system');
    showMessage(message, '#4caf50');
    
    return true;
}

// База локаций с фонами, зонами и действиями
export const locationsDB = {
    railway: {
        id: "railway",
        name: "Вокзал",
        description: "Шум, люди, поезда. Можно попросить подаяние или поискать забытые вещи. А ещё здесь работает таксист Олег.",
        bgImage: "images/railway_bg.jpg",
        npc: {
            id: 'railway_taxi',
            name: '🚕 Олег Таксист',
            avatar: 'images/npc/taxi.png',
            position: { x: 620, y: 840 },
            width: 500,
            height: 500,
            actionId: 'talk_taxi'
        },
        zones: [
            { id: "beg_zone", name: "Площадь у вокзала", description: "Попросить подаяние: получить 10-50₽ (риск 30%)", cx: 150, cy: 200, r: 50, actionId: "beg" },
            { id: "search_zone", name: "Зал ожидания", description: "Поискать вещи: хлеб или вода (риск 20%)", cx: 400, cy: 180, r: 45, actionId: "search" },
            { id: "taxi_zone", name: "🚕 Стоянка такси", description: "Поговорить с Олегом Таксистом", cx: 650, cy: 250, r: 50, actionId: "talk_taxi" }
        ],
        actions: [
            { id: "beg", name: "Попросить подаяние", desc: "Риск: 30% получить отказ", effect: { money: [10, 50] }, risk: 30, riskEffect: { money: -10, health: -5 } },
            { id: "search", name: "Поискать забытые вещи", desc: "Риск: 20% найти мусор", effect: { items: ["bread", "water"] }, risk: 20, riskEffect: { health: -10, hunger: -5 } },
            { id: "talk_taxi", name: "🚕 Поговорить с Олегом", desc: "Поговорить с таксистом", effect: {}, cost: 0, risk: 0 }
        ]
    },
    market: {
        id: "market",
        name: "Рынок",
        description: "Оживлённое место, можно обменять вещи или украсть еду. А ещё здесь есть тир!",
        bgImage: "images/market_bg.jpg",
        zones: [
            { id: "trade_zone", name: "Прилавок", description: "Обменять пустые бутылки: 5-15₽", cx: 200, cy: 150, r: 50, actionId: "trade" },
            { id: "steal_zone", name: "Лотки с едой", description: "Украсть еду: +1 хлеб (риск 50%)", cx: 450, cy: 200, r: 55, actionId: "steal" },
            { id: "zombie_zone", name: "🧟 Зомби-тир", description: "Стреляй по зомби и зарабатывай очки! (тратит 20⚡)", cx: 400, cy: 400, r: 50, actionId: "zombie_shooter" }
        ],
        actions: [
            { id: "trade", name: "Обменять пустые бутылки", desc: "Требуется пустая бутылка", needsItem: "empty_bottle", effect: { money: [5, 15] }, risk: 0 },
            { id: "steal", name: "Украсть еду", desc: "Риск: 50% поймают", effect: { items: ["bread"] }, risk: 50, riskEffect: { money: -30, health: -15 } },
            { id: "zombie_shooter", name: "🧟 Зомби-тир", desc: "Стреляй по зомби и зарабатывай очки! (тратит 20⚡)", effect: {}, cost: 0, risk: 0 }
        ]
    },
    shelter: {
        id: "shelter",
        name: "Ночлежка",
        description: "Тёплое место для ночлега.",
        bgImage: "images/shelter_bg.jpg",
        zones: [
            { id: "sleep_zone", name: "Койка", description: "Переночевать: +30 здоровья (20₽)", cx: 250, cy: 180, r: 60, actionId: "sleep" },
            { id: "eat_zone", name: "Столовая", description: "Поесть: +30 голода (25₽)", cx: 400, cy: 220, r: 45, actionId: "eat" }
        ],
        actions: [
            { id: "sleep", name: "Переночевать", desc: "Восстановить здоровье за 20₽", effect: { health: 30, energy: 50 }, cost: 20, risk: 0 },
            { id: "eat", name: "Поесть в столовой", desc: "Восстановить голод за 25₽", effect: { hunger: 30 }, cost: 25, risk: 0 }
        ]
    },
    dump: {
        id: "dump",
        name: "Свалка",
        description: "Опасно, но можно найти ценные вещи.",
        bgImage: "images/dump_bg.jpg",
        npc: {
            id: 'dump_hobo',
            name: '🗑️ Бомж Семён',
            avatar: 'images/npc/hobo.png',
            position: { x: 610, y: 810 },
            width: 400,
            height: 400,
            actionId: 'talk_hobo'
        },
        zones: [
            { id: "scavenge_zone", name: "Куча мусора", description: "Покопаться: найти бутылку или старую шапку (риск 40%)", cx: 200, cy: 200, r: 70, actionId: "scavenge" },
            { id: "merge_zone", name: "🔄 Объединялка", description: "Соединяй бутылки и получай награду! (тратит 15⚡)", cx: 400, cy: 350, r: 55, actionId: "merge_game" }
        ],
        actions: [
            { id: "scavenge", name: "Покопаться в мусоре", desc: "Риск: 40% получить инфекцию", effect: { items: ["empty_bottle", "old_hat"] }, risk: 40, riskEffect: { health: -15, hunger: -5 } },
            { id: "talk_hobo", name: "🗑️ Поговорить с бомжом", desc: "Поговорить с местным жителем", effect: {}, cost: 0, risk: 0 },
            { id: "merge_game", name: "🔄 Объединялка", desc: "Соединяй бутылки и получай награду! (тратит 15⚡)", effect: {}, cost: 0, risk: 0 }
        ]
    },
    church: {
        id: "church",
        name: "Церковь",
        description: "Место покоя. Можно помолиться или попросить еду.",
        bgImage: "images/church_bg.jpg",
        zones: [
            { id: "pray_zone", name: "Алтарь", description: "Помолиться: +20 здоровья", cx: 200, cy: 150, r: 60, actionId: "pray" },
            { id: "food_zone", name: "Трапезная", description: "Попросить еду: +1 хлеб", cx: 450, cy: 180, r: 50, actionId: "get_food" }
        ],
        actions: [
            { id: "pray", name: "Помолиться", desc: "Восстановить здоровье", effect: { health: 20 }, cost: 0, risk: 0 },
            { id: "get_food", name: "Попросить еду", desc: "Дадут хлеб", effect: { items: ["bread"] }, risk: 0 }
        ]
    },
    bar: {
        id: "bar",
        name: "Бар",
        description: "Можно выпить, подраться, сыграть в дротики или в однорукого бандита.",
        bgImage: "images/bar_bg.jpg",
        zones: [
            { id: "drink_zone", name: "Стойка", description: "Выпить водку: +10 здоровья, -5 голода, +30 опьянения, 40₽", cx: 150, cy: 200, r: 50, actionId: "drink" },
            { id: "fight_zone", name: "Танцпол", description: "Подраться: получить 20-100₽ (риск 50%)", cx: 400, cy: 220, r: 65, actionId: "fight" },
            { id: "darts_zone", name: "🎯 Дартс", description: "Сыграть в пьяный дротик (тратит 10 энергии, нужно 20% опьянения)", cx: 600, cy: 200, r: 50, actionId: "darts" },
            { id: "slot_machine_zone", name: "🎰 Однорукий бандит", description: "Сыграть в игровой автомат", cx: 700, cy: 150, r: 45, actionId: "slot_machine" }
        ],
        actions: [
            { id: "drink", name: "Выпить водку", desc: "Здоровье +10, голод -5, опьянение +30, стоит 40₽", effect: { health: 10, hunger: -5, intoxication: 30 }, cost: 40, risk: 0 },
            { id: "fight", name: "Подраться", desc: "Риск: 50% получить травму", effect: { money: [20, 100] }, risk: 50, riskEffect: { health: -20 } },
            { id: "darts", name: "🎯 Пьяный дротик", desc: "Сыграть в дартс (10 энергии, нужно 20% опьянения)", effect: {}, cost: 0, risk: 0 },
            { id: "slot_machine", name: "🎰 Однорукий бандит", desc: "Сыграть в игровой автомат", effect: {}, cost: 0, risk: 0 }
        ]
    },

    // ========== ЛОКАЦИИ ДЛЯ ЖИЛЬЯ ==========
    dump_home: {
        id: "dump_home",
        name: "🗑️ Моя помойка",
        description: "Твоё любимое место на свалке. Картонка, крыса рядом...",
        bgImage: "images/dump_home.jpg",
        zones: [
            { id: "rest_zone", name: "Картонка", description: "Отдохнуть на картонке", cx: 200, cy: 200, r: 60, actionId: "rest_dump" },
            { id: "scavenge_zone", name: "Помойка", description: "Покопаться в мусоре", cx: 400, cy: 200, r: 55, actionId: "scavenge_home" }
        ],
        actions: [
            { 
                id: "rest_dump", 
                name: "🛌 Поспать", 
                desc: "Восстановить силы на картонке", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    await restInHome('dump_home', 'помойке');
                }
            },
            { id: "scavenge_home", name: "Покопаться в мусоре", desc: "Найти что-то полезное", effect: { items: ["empty_bottle", "old_hat"] }, risk: 30, riskEffect: { health: -5 } }
        ]
    },
    dorm_home: {
        id: "dorm_home",
        name: "🛏️ Моя комната в общаге",
        description: "Уютная комнатка. Есть кровать и тумбочка.",
        bgImage: "images/dorm_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать в кровати", cx: 200, cy: 200, r: 60, actionId: "sleep_dorm" },
            { id: "storage_zone", name: "Тумбочка", description: "Достать вещи из хранилища", cx: 400, cy: 200, r: 55, actionId: "storage_open" }
        ],
        actions: [
            { 
                id: "sleep_dorm", 
                name: "🛌 Поспать", 
                desc: "Хорошо выспаться в кровати", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    await restInHome('dorm_home', 'общаге');
                }
            },
            { id: "storage_open", name: "Открыть хранилище", desc: "Достать вещи из хранилища", effect: {}, cost: 0, risk: 0 }
        ]
    },
    apartment_home: {
        id: "apartment_home",
        name: "🏢 Моя квартира",
        description: "Просторная квартира. Полный уют и комфорт.",
        bgImage: "images/apartment_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать в кровати", cx: 200, cy: 200, r: 60, actionId: "sleep_apartment" },
            { id: "kitchen_zone", name: "Кухня", description: "Приготовить еду", cx: 400, cy: 200, r: 55, actionId: "cook" }
        ],
        actions: [
            { 
                id: "sleep_apartment", 
                name: "🛌 Поспать", 
                desc: "Хорошо выспаться в уютной квартире", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    await restInHome('apartment_home', 'квартире');
                }
            },
            { id: "cook", name: "Приготовить еду", desc: "Сделать бутерброд", effect: { items: ["bread"] }, cost: 0, risk: 0 }
        ]
    },
    house_home: {
        id: "house_home",
        name: "🏠 Мой дом",
        description: "Роскошный дом. Сауна, гараж, всё включено!",
        bgImage: "images/house_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать в кровати", cx: 150, cy: 200, r: 50, actionId: "sleep_house" },
            { id: "sauna_zone", name: "Сауна", description: "Попариться: +20 здоровья, -10 голода", cx: 350, cy: 200, r: 50, actionId: "sauna" },
            { id: "garage_zone", name: "Гараж", description: "Хранилище", cx: 550, cy: 200, r: 50, actionId: "garage_storage" }
        ],
        actions: [
            { 
                id: "sleep_house", 
                name: "🛌 Поспать", 
                desc: "Отлично выспаться в собственном доме", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    await restInHome('house_home', 'доме');
                }
            },
            { id: "sauna", name: "Сауна", desc: "Попариться", effect: { health: 20, hunger: -10 }, cost: 0, risk: 0 },
            { id: "garage_storage", name: "Открыть гараж", desc: "Хранилище вещей", effect: {}, cost: 0, risk: 0 }
        ]
    },

    // ========== РЕКА УВОДЬ (РЫБАЛКА) ==========
    fishing_spot: {
        id: "fishing_spot",
        name: "🏞️ Река Уводь",
        description: "Тихое место на берегу реки Уводь. Вода прозрачная, слышен плеск рыбы. Местные говорят, что здесь водится легендарная рыба-меч!",
        bgImage: "images/fishing_spot_bg.jpg",
        zones: [
            { id: "fishing_zone", name: "🎣 Рыбалка", description: "Забросить удочку и попытать счастья (тратит 15 энергии)", cx: 200, cy: 200, r: 60, actionId: "fishing" },
            { id: "relax_zone", name: "🌿 Отдохнуть", description: "Посмотреть на воду и восстановить силы", cx: 400, cy: 180, r: 50, actionId: "relax" },
            { id: "collect_water_zone", name: "💧 Набрать воды", description: "Набрать свежей речной воды", cx: 600, cy: 220, r: 45, actionId: "collect_water" }
        ],
        actions: [
            { 
                id: "fishing", 
                name: "🎣 Порыбачить", 
                desc: "Забросить удочку и поймать рыбу (требуется удочка, тратит 15 энергии)", 
                effect: { items: [] }, 
                risk: 0,
                needsItem: "fishing_rod",
                cost: 0
            },
            { 
                id: "relax", 
                name: "🌿 Отдохнуть", 
                desc: "Посмотреть на воду и восстановить силы", 
                effect: { health: 5, hunger: 5, cold: 5 }, 
                risk: 0,
                cost: 0
            },
            { 
                id: "collect_water", 
                name: "💧 Набрать воды", 
                desc: "Набрать свежей речной воды", 
                effect: { items: ["water"] }, 
                risk: 0,
                cost: 0
            }
        ]
    },

    // ========== НОВЫЕ ЛОКАЦИИ ==========

    // 1. ПЛОЩАДЬ РЕВОЛЮЦИИ
    ploshchad: {
        id: "ploshchad",
        name: "🏛️ Площадь Революции",
        description: "Главная площадь города. Здесь всегда людно: студенты, торговцы, музыканты. В центре — старый фонтан с позолоченными фигурами. А ещё здесь ошиваются странные типы в узких штанах...",
        bgImage: "images/ploshchad_bg.jpg",
        zones: [
            { 
                id: "beg_zone", 
                name: "У фонтана", 
                description: "Попросить подаяние у прохожих (шанс 25%)", 
                cx: 150, 
                cy: 200, 
                r: 50, 
                actionId: "beg" 
            },
            { 
                id: "search_zone", 
                name: "Скамейки", 
                description: "Поискать забытые вещи на скамейках (риск 15%)", 
                cx: 400, 
                cy: 180, 
                r: 45, 
                actionId: "search_ploshchad" 
            },
            { 
                id: "relax_zone", 
                name: "Фонтан", 
                description: "Послушать воду и отдохнуть", 
                cx: 600, 
                cy: 220, 
                r: 50, 
                actionId: "relax_ploshchad" 
            },
            { 
                id: "fight_zone", 
                name: "👊 Нефоры", 
                description: "Подраться с местными неформалами (риск 35%)", 
                cx: 250, 
                cy: 350, 
                r: 55, 
                actionId: "fight_nefors" 
            },
            { 
                id: "kfc_zone", 
                name: "🍗 КФС", 
                description: "Перекусить в КФС (восстановить голод за 40₽)", 
                cx: 500, 
                cy: 380, 
                r: 50, 
                actionId: "eat_kfc" 
            }
        ],
        actions: [
            { 
                id: "beg", 
                name: "Попросить подаяние", 
                desc: "Риск: 25% получить отказ (но люди здесь добрее)", 
                effect: { money: [15, 60] }, 
                risk: 25, 
                riskEffect: { money: -10, health: -3 } 
            },
            { 
                id: "search_ploshchad", 
                name: "Поискать на скамейках", 
                desc: "Риск: 15% найти мусор вместо вещей", 
                effect: { items: ["bread", "water", "old_hat"] }, 
                risk: 15, 
                riskEffect: { health: -5 } 
            },
            { 
                id: "relax_ploshchad", 
                name: "Отдохнуть у фонтана", 
                desc: "Восстановить силы (+10 здоровья, +5 энергии)", 
                effect: { health: 10, energy: 5 }, 
                cost: 0, 
                risk: 0 
            },
            { 
                id: "fight_nefors", 
                name: "👊 Подраться с неформалами", 
                desc: "Риск: 35% получить люлей (но если победишь — получишь награду)", 
                effect: { money: [50, 150] }, 
                risk: 35, 
                riskEffect: { health: -25, money: -20 },
                isSpecial: true,
                specialCallback: async () => {
                    if (!hasEnoughEnergy(25)) {
                        showMessage(`❌ Не хватает энергии! Нужно 25⚡`, '#e74c3c');
                        return;
                    }
                    
                    if (!canPerformAction('драка с неформалами')) {
                        return;
                    }
                    
                    let successChance = 65;
                    if (intoxication > 50) {
                        successChance -= 20;
                    } else if (intoxication > 20) {
                        successChance -= 10;
                    }
                    
                    const hasWeapon = inventory.find(i => i.id === 'knife' || i.id === 'bat');
                    if (hasWeapon) {
                        successChance += 15;
                        showMessage(`🔪 С оружием у тебя больше шансов!`, '#ffd966');
                    }
                    
                    const roll = Math.random() * 100;
                    const success = roll < successChance;
                    
                    spendEnergy(25);
                    
                    if (success) {
                        const moneyGain = Math.floor(Math.random() * 100) + 50;
                        setStats(health, hunger, cold, money + moneyGain);
                        addExperience(25);
                        addLogEntry(`👊 Ты победил нефоров! +${moneyGain}₽, +25 опыта`, 'combat');
                        showMessage(`👊 Ты разобрался с неформалами! +${moneyGain}₽, +25 опыта`, '#4caf50');
                        
                        if (Math.random() < 0.3) {
                            const loot = ['empty_bottle', 'bread', 'water'][Math.floor(Math.random() * 3)];
                            const idx = inventory.findIndex(i => i.id === loot);
                            if (idx !== -1) inventory[idx].count++;
                            else inventory.push({ id: loot, count: 1 });
                            showMessage(`🎒 Ты нашёл у них ${itemsDB[loot]?.name || loot}!`, '#ffd966');
                        }
                    } else {
                        const healthLoss = Math.floor(Math.random() * 20) + 10;
                        const newHealth = Math.max(0, health - healthLoss);
                        setStats(newHealth, hunger, cold, money);
                        addLogEntry(`👊 Нефоры тебя отпинали! -${healthLoss} здоровья`, 'combat');
                        showMessage(`👊 Нефоры оказались сильнее! -${healthLoss} здоровья`, '#e74c3c');
                        
                        if (Math.random() < 0.3) {
                            const moneyLoss = Math.min(money, 30);
                            setStats(newHealth, hunger, cold, money - moneyLoss);
                            showMessage(`💰 Нефоры обчистили тебя на ${moneyLoss}₽!`, '#e74c3c');
                        }
                    }
                    
                    updateUI();
                    await saveGameData();
                    document.getElementById('locationModal').style.display = 'none';
                }
            },
            { 
                id: "eat_kfc", 
                name: "🍗 Перекусить в КФС", 
                desc: "Восстановить голод и здоровье за 40₽", 
                effect: { hunger: 40, health: 10 }, 
                cost: 40, 
                risk: 0 
            }
        ]
    },

    // 2. ТЦ "ЗОЛОТОЙ ГОРОД" (НАРУЖИ)
    mall: {
        id: "mall",
        name: "🏬 ТЦ «Золотой город»",
        description: "Огромный торговый центр. Стеклянные витрины, эскалаторы и куча народа. Сюда приходят за покупками... или за лёгкой добычей.",
        bgImage: "images/mall_bg.jpg",
        zones: [
            { 
                id: "enter_zone", 
                name: "🚪 Вход в ТЦ", 
                description: "Войти внутрь торгового центра", 
                cx: 400, 
                cy: 250, 
                r: 60, 
                actionId: "enter_mall" 
            },
            { 
                id: "steal_zone", 
                name: "Парковка", 
                description: "Проверить машины на удачу (риск 40%)", 
                cx: 150, 
                cy: 180, 
                r: 50, 
                actionId: "steal_mall" 
            },
            { 
                id: "beg_zone", 
                name: "Входная группа", 
                description: "Попросить у выходящих посетителей (шанс 30%)", 
                cx: 600, 
                cy: 200, 
                r: 50, 
                actionId: "beg_mall" 
            }
        ],
        actions: [
            { 
                id: "enter_mall", 
                name: "🚪 Войти в ТЦ", 
                desc: "Зайти внутрь торгового центра", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    const { setCurrentLocation } = await import('./gameState.js');
                    setCurrentLocation('mall_inside');
                    showMessage('🏬 Вы вошли в ТЦ «Золотой город»', '#4caf50');
                    renderLocation('mall_inside');
                    document.getElementById('locationModal').style.display = 'none';
                }
            },
            { 
                id: "steal_mall", 
                name: "Проверить машины", 
                desc: "Риск: 40% попасться охране", 
                effect: { money: [20, 80] }, 
                risk: 40, 
                riskEffect: { money: -50, health: -15 } 
            },
            { 
                id: "beg_mall", 
                name: "Попросить у посетителей", 
                desc: "Риск: 30% получить отказ", 
                effect: { money: [10, 40] }, 
                risk: 30, 
                riskEffect: { money: -10, health: -5 } 
            }
        ]
    },

    // 3. ТЦ "ЗОЛОТОЙ ГОРОД" (ВНУТРИ)
    mall_inside: {
        id: "mall_inside",
        name: "🏬 ТЦ «Золотой город» (внутри)",
        description: "Внутри шумно и людно. Эскалаторы, бутики, фуд-корт. Охрана ходит по периметру, но есть и тёмные уголки.",
        bgImage: "images/mall_inside_bg.jpg",
        zones: [
            { 
                id: "exit_zone", 
                name: "🚪 Выход из ТЦ", 
                description: "Выйти наружу", 
                cx: 400, 
                cy: 250, 
                r: 60, 
                actionId: "exit_mall" 
            },
            { 
                id: "search_zone", 
                name: "Фуд-корт", 
                description: "Поискать забытую еду на столиках", 
                cx: 200, 
                cy: 180, 
                r: 50, 
                actionId: "search_mall_inside" 
            },
            { 
                id: "steal_zone", 
                name: "Примерочная", 
                description: "Попытаться украсть одежду (риск 50%)", 
                cx: 600, 
                cy: 200, 
                r: 50, 
                actionId: "steal_mall_inside" 
            },
            { 
                id: "rest_zone", 
                name: "Диванчик", 
                description: "Отдохнуть на мягком диване", 
                cx: 350, 
                cy: 350, 
                r: 45, 
                actionId: "rest_mall_inside" 
            }
        ],
        actions: [
            { 
                id: "exit_mall", 
                name: "🚪 Выйти из ТЦ", 
                desc: "Вернуться на улицу", 
                effect: {}, 
                cost: 0, 
                risk: 0,
                callback: async () => {
                    const { setCurrentLocation } = await import('./gameState.js');
                    setCurrentLocation('mall');
                    showMessage('🏬 Вы вышли из ТЦ «Золотой город»', '#4caf50');
                    renderLocation('mall');
                    document.getElementById('locationModal').style.display = 'none';
                }
            },
            { 
                id: "search_mall_inside", 
                name: "Поискать на фуд-корте", 
                desc: "Шанс найти еду (риск 20%)", 
                effect: { items: ["bread", "water", "apple"] }, 
                risk: 20, 
                riskEffect: { health: -5, hunger: -5 } 
            },
            { 
                id: "steal_mall_inside", 
                name: "Украсть из магазина", 
                desc: "Риск: 50% поймает охрана", 
                effect: { items: ["old_hat", "empty_bottle"], money: [30, 100] }, 
                risk: 50, 
                riskEffect: { money: -100, health: -20 } 
            },
            { 
                id: "rest_mall_inside", 
                name: "Отдохнуть на диване", 
                desc: "Восстановить силы (+5 здоровья, +10 энергии)", 
                effect: { health: 5, energy: 10 }, 
                cost: 0, 
                risk: 0 
            }
        ]
    },

    // 4. КРАСНАЯ ЦЕРКОВЬ
    red_church: {
        id: "red_church",
        name: "⛪ Красная церковь",
        description: "Старинная церковь из красного кирпича. Местные говорят, что здесь особая благодать. Можно помолиться или попросить помощи у священника.",
        bgImage: "images/red_church_bg.jpg",
        zones: [
            { 
                id: "pray_zone", 
                name: "Алтарь", 
                description: "Помолиться (+30 здоровья, +5 энергии)", 
                cx: 200, 
                cy: 200, 
                r: 60, 
                actionId: "pray_red" 
            },
            { 
                id: "food_zone", 
                name: "Трапезная", 
                description: "Попросить еду у священника", 
                cx: 450, 
                cy: 180, 
                r: 50, 
                actionId: "get_food_red" 
            },
            { 
                id: "rest_zone", 
                name: "Скамейка", 
                description: "Посидеть в тишине (+5 здоровья, +10 энергии)", 
                cx: 350, 
                cy: 300, 
                r: 45, 
                actionId: "rest_red" 
            }
        ],
        actions: [
            { 
                id: "pray_red", 
                name: "Помолиться", 
                desc: "Восстановить здоровье и энергию", 
                effect: { health: 30, energy: 5 }, 
                cost: 0, 
                risk: 0 
            },
            { 
                id: "get_food_red", 
                name: "Попросить еду", 
                desc: "Дадут хлеб и воду", 
                effect: { items: ["bread", "water"] }, 
                risk: 0 
            },
            { 
                id: "rest_red", 
                name: "Посидеть в тишине", 
                desc: "Восстановить силы", 
                effect: { health: 5, energy: 10 }, 
                cost: 0, 
                risk: 0 
            }
        ]
    },

    // 5. ШЕРЕМЕТЕВСКИЙ КИЛОМЕТР
    sheremet: {
        id: "sheremet",
        name: "🛣️ Шереметевский километр",
        description: "Длинная улица, уходящая за горизонт. Здесь есть магазины, ларьки и много прохожих. Говорят, на Шеремете можно найти всё что угодно.",
        bgImage: "images/sheremet_bg.jpg",
        zones: [
            { 
                id: "beg_zone", 
                name: "У ларька", 
                description: "Попросить у прохожих (шанс 20%)", 
                cx: 150, 
                cy: 200, 
                r: 50, 
                actionId: "beg_sheremet" 
            },
            { 
                id: "search_zone", 
                name: "Мусорка у магазина", 
                description: "Поискать в мусоре (риск 25%)", 
                cx: 400, 
                cy: 180, 
                r: 45, 
                actionId: "search_sheremet" 
            },
            { 
                id: "trade_zone", 
                name: "Ларёк с бутылками", 
                description: "Обменять пустые бутылки (цена выше рыночной)", 
                cx: 600, 
                cy: 220, 
                r: 50, 
                actionId: "trade_sheremet" 
            },
            { 
                id: "fight_zone", 
                name: "Тёмный переулок", 
                description: "Подраться с местными (риск 40%)", 
                cx: 250, 
                cy: 350, 
                r: 45, 
                actionId: "fight_sheremet" 
            }
        ],
        actions: [
            { 
                id: "beg_sheremet", 
                name: "Попросить подаяние", 
                desc: "Риск: 20% получить отказ", 
                effect: { money: [10, 50] }, 
                risk: 20, 
                riskEffect: { money: -15, health: -5 } 
            },
            { 
                id: "search_sheremet", 
                name: "Поискать в мусоре", 
                desc: "Риск: 25% найти гнилые продукты", 
                effect: { items: ["empty_bottle", "bread", "old_hat"] }, 
                risk: 25, 
                riskEffect: { health: -10, hunger: -10 } 
            },
            { 
                id: "trade_sheremet", 
                name: "Сдать бутылки", 
                desc: "Выгодный обмен: каждая бутылка даёт 10-20₽", 
                needsItem: "empty_bottle", 
                effect: { money: [10, 20] }, 
                risk: 0 
            },
            { 
                id: "fight_sheremet", 
                name: "Подраться", 
                desc: "Риск: 40% получить травму", 
                effect: { money: [30, 120] }, 
                risk: 40, 
                riskEffect: { health: -25 } 
            }
        ]
    }
};

// Переменная для отслеживания посещённых локаций
let visitedLocations = JSON.parse(localStorage.getItem('visited_locations_' + (window.auth?.currentUser?.uid || 'guest')) || '[]');

// Функция для отрисовки локации на главном экране
export function renderLocation(locationId) {
    const loc = locationsDB[locationId];
    if (!loc) {
        console.error(`Локация ${locationId} не найдена`);
        return;
    }
    
    const locationContainer = document.getElementById('locationContainer');
    if (!locationContainer) return;
    
    removeWeatherLayers();
    
    const bgUrl = loc.bgImage || 'images/default_bg.jpg';
    document.documentElement.style.setProperty('--location-bg', `url(${bgUrl})`);
    
    const locName = document.getElementById('locationName');
    if (locName) {
        locName.textContent = loc.name;
    }
    
    const zonesContainer = document.getElementById('locationZones');
    if (!zonesContainer) return;
    
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 800 600");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";
    
    loc.zones.forEach(zone => {
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", zone.cx);
        circle.setAttribute("cy", zone.cy);
        circle.setAttribute("r", zone.r);
        circle.setAttribute("data-zone-id", zone.id);
        circle.setAttribute("data-action-id", zone.actionId);
        circle.setAttribute("data-location-id", locationId);
        circle.setAttribute("data-name", zone.name);
        circle.setAttribute("data-description", zone.description || '');
        circle.style.pointerEvents = "visible";
        circle.style.cursor = "pointer";
        circle.style.fill = "rgba(0, 200, 0, 0.25)";
        circle.style.stroke = "rgba(0, 200, 0, 0.6)";
        circle.style.strokeWidth = "2";
        circle.style.transition = "fill 0.1s, stroke 0.1s";
        
        circle.addEventListener('mouseenter', (e) => {
            circle.style.fill = "rgba(0, 200, 0, 0.5)";
            circle.style.stroke = "rgba(0, 200, 0, 1)";
            let tip = zone.name;
            if (zone.description) tip += ': ' + zone.description;
            showTooltip(e, tip);
        });
        circle.addEventListener('mouseleave', () => {
            circle.style.fill = "rgba(0, 200, 0, 0.25)";
            circle.style.stroke = "rgba(0, 200, 0, 0.6)";
            hideTooltip();
        });
        circle.addEventListener('click', () => {
            playClick();
            const action = loc.actions.find(a => a.id === zone.actionId);
            if (action) {
                executeAction(locationId, action);
            } else {
                showMessage(`Действие для "${zone.name}" ещё не добавлено`, "#f0ad4e");
            }
        });
        
        svg.appendChild(circle);
    });
    
    // ========== ОТРИСОВКА NPC ==========
    if (loc.npc) {
        const npc = loc.npc;
        
        const npcGroup = document.createElementNS(svgNS, "g");
        npcGroup.style.cursor = "pointer";
        
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", npc.position.x + 30);
        text.setAttribute("y", npc.position.y - 370);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "16px");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("fill", "#ffd966");
        text.setAttribute("stroke", "#000");
        text.setAttribute("stroke-width", "1");
        text.textContent = npc.name;
        text.style.pointerEvents = "visible";
        text.style.transition = "all 0.3s ease";
        npcGroup.appendChild(text);
        
        const foreignObject = document.createElementNS(svgNS, "foreignObject");
        foreignObject.setAttribute("x", npc.position.x - npc.width/2);
        foreignObject.setAttribute("y", npc.position.y - npc.height);
        foreignObject.setAttribute("width", npc.width);
        foreignObject.setAttribute("height", npc.height);
        foreignObject.style.pointerEvents = "visible";
        foreignObject.style.cursor = "pointer";
        
        const img = document.createElement("img");
        img.src = npc.avatar;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.style.pointerEvents = "auto";
        img.style.cursor = "pointer";
        img.style.filter = "drop-shadow(0 4px 8px rgba(0,0,0,0.5))";
        img.style.transition = "transform 0.3s ease";
        
        const clickHandler = () => {
            playClick();
            const action = loc.actions.find(a => a.id === npc.actionId);
            if (action) executeAction(locationId, action);
        };
        
        img.addEventListener('click', clickHandler);
        text.addEventListener('click', clickHandler);
        
        img.addEventListener('mouseenter', () => {
            img.style.transform = "scale(1.05)";
            text.setAttribute("font-size", "20px");
            text.setAttribute("fill", "#ffd700");
        });
        img.addEventListener('mouseleave', () => {
            img.style.transform = "scale(1)";
            text.setAttribute("font-size", "16px");
            text.setAttribute("fill", "#ffd966");
        });
        
        text.addEventListener('mouseenter', () => {
            img.style.transform = "scale(1.05)";
            text.setAttribute("font-size", "20px");
            text.setAttribute("fill", "#ffd700");
        });
        text.addEventListener('mouseleave', () => {
            img.style.transform = "scale(1)";
            text.setAttribute("font-size", "16px");
            text.setAttribute("fill", "#ffd966");
        });
        
        foreignObject.appendChild(img);
        npcGroup.appendChild(foreignObject);
        svg.appendChild(npcGroup);
    }
    
    zonesContainer.innerHTML = '';
    zonesContainer.appendChild(svg);
    
    createWeatherLayers(locationContainer);
    updateDarkness();
    updateWeatherEffects();
    
    setTimeout(() => {
        updateDarkness();
        updateWeatherEffects();
    }, 50);
    
    if (!visitedLocations.includes(locationId)) {
        visitedLocations.push(locationId);
        localStorage.setItem('visited_locations_' + (window.auth?.currentUser?.uid || 'guest'), JSON.stringify(visitedLocations));
        updateAchievementStats('visitedLocations', visitedLocations.length);
    }
}

// Всплывающая подсказка
let tooltipElement = null;
function showTooltip(event, text) {
    if (!tooltipElement) {
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'location-tooltip';
        document.body.appendChild(tooltipElement);
    }
    tooltipElement.textContent = text;
    tooltipElement.style.display = 'block';
    tooltipElement.style.left = event.clientX + 15 + 'px';
    tooltipElement.style.top = event.clientY - 30 + 'px';
}
function hideTooltip() {
    if (tooltipElement) tooltipElement.style.display = 'none';
}

// Функции для действий
async function executeAction(locationId, action) {
    playClick();
    
    // ===== ПРОВЕРКА НА SPECIAL CALLBACK (для драки с неформалами) =====
    if (action.isSpecial && action.specialCallback) {
        await action.specialCallback();
        return;
    }
    
    // ===== ПРОВЕРКА НА CALLBACK (для отдыха и перехода) =====
    if (action.callback) {
        await action.callback();
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ПОДСКАЗКА: первый клик по зоне =====
    if (action.id !== 'talk_hobo' && action.id !== 'storage_open' && action.id !== 'garage_storage') {
        await showActionTip('shown_zone_click', '🟢 Зелёные круги — места для действий. Нажми на них, чтобы сделать что-то.');
    }
    
    // ===== РАЗГОВОР С NPC =====
    if (action.id === 'talk_hobo' || action.id === 'talk_taxi' || action.id.startsWith('talk_')) {
        await showActionTip('shown_npc', '💬 Диалоги с NPC могут открыть новые квесты, магазины и информацию.');
        try {
            const { openNpcDialog } = await import('./npcSystemUI.js');
            const loc = locationsDB[locationId];
            if (loc && loc.npc) {
                await openNpcDialog(loc.npc.id);
                logAction(`В локации "${locationsDB[locationId]?.name}": разговор с NPC`, 'location');
            } else {
                showMessage('NPC не найден в этой локации', '#e74c3c');
            }
        } catch (error) {
            console.error('Ошибка открытия NPC:', error);
            showMessage("❌ Ошибка диалога. Попробуйте позже.", "#e74c3c");
        }
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ОТКРЫТЬ ХРАНИЛИЩЕ =====
    if (action.id === 'storage_open' || action.id === 'garage_storage') {
        await showActionTip('shown_storage', '📦 Хранилище — место для хранения вещей. Вместимость зависит от твоего жилья.');
        try {
            const { openStorageModal } = await import('./inventory.js');
            await openStorageModal();
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - открыто хранилище`, 'location');
        } catch (error) {
            console.error('Ошибка открытия хранилища:', error);
            showMessage("❌ Ошибка открытия хранилища. Попробуйте позже.", "#e74c3c");
        }
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ОДНОРУКИЙ БАНДИТ =====
    if (action.id === 'slot_machine') {
        await showActionTip('shown_slot_machine', '🎰 Однорукий бандит — игра на удачу. Поставь деньги и попробуй сорвать джекпот!');
        try {
            const { openSlotMachine } = await import('./minigameSlotMachine.js');
            await openSlotMachine();
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - открыт игровой автомат`, 'location');
        } catch (error) {
            console.error('Ошибка открытия автомата:', error);
            showMessage("❌ Ошибка запуска автомата. Попробуйте позже.", "#e74c3c");
        }
        document.getElementById('locationModal').style.display = 'none';
        return;
    }

    // ===== ОБЪЕДИНЯЛКА =====
    if (action.id === 'merge_game') {
        await showActionTip('shown_merge_game', '🔄 Объединялка! Соединяй одинаковые бутылки, чтобы получать новые предметы и очки. Чем выше уровень — тем больше награда!');
        
        const energyCost = 15;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        if (!canPerformAction(action.name)) {
            return;
        }
        
        try {
            const { openMergeGame } = await import('./minigameMerge.js');
            await openMergeGame();
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - объединялка`, 'location');
        } catch (error) {
            console.error('Ошибка открытия объединялки:', error);
            showMessage("❌ Ошибка запуска игры. Попробуйте позже.", "#e74c3c");
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ДРОТИКИ =====
    if (action.id === 'darts') {
        await showActionTip('shown_darts', '🎯 Дартс — игра на точность. Чем выше опьянение — тем сложнее попасть, но и выигрыш больше!');
        const energyCost = energyCosts.darts || 10;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        if (intoxication < 20) {
            showMessage(`🍺 Бармен не даёт дротики трезвым! Выпей сначала! (нужно 20% опьянения)`, '#e74c3c');
            return;
        }
        
        if (!canPerformAction(action.name)) {
            return;
        }
        
        spendEnergy(energyCost);
        
        try {
            const { openDartsGame } = await import('./minigameDarts.js');
            await openDartsGame();
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - начало игры в дротики`, 'location');
        } catch (error) {
            console.error('Ошибка открытия дротиков:', error);
            showMessage("❌ Ошибка запуска игры. Попробуйте позже.", "#e74c3c");
            setEnergy(Math.min(100, energy + energyCost));
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== РЫБАЛКА =====
    if (action.id === 'fishing') {
        await showActionTip('shown_fishing', '🎣 Рыбалка — способ добыть еду и редкие трофеи. Нужна удочка!');
        const hasRod = inventory.find(i => i.id === 'fishing_rod' && i.count > 0);
        if (!hasRod) {
            showMessage("❌ У вас нет удочки! Купите её в магазине.", "#e74c3c");
            return;
        }
        
        const energyCost = energyCosts.fishing || 15;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        if (!canPerformAction(action.name)) {
            return;
        }
        
        spendEnergy(energyCost);
        
        try {
            const { openFishingGame } = await import('./minigameFishing.js');
            await openFishingGame();
            await updateQuest('fishing', 1);
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - начало рыбалки`, 'location');
        } catch (error) {
            console.error('Ошибка открытия рыбалки:', error);
            showMessage("❌ Ошибка запуска рыбалки. Попробуйте позже.", "#e74c3c");
            setEnergy(Math.min(100, energy + energyCost));
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ОТДЫХ У РЕКИ =====
    if (action.id === 'relax') {
        await showActionTip('shown_relax', '🌿 Отдых у реки восстанавливает здоровье, голод и тепло.');
        
        const newHealth = Math.min(maxHealth, health + 5);
        const newHunger = Math.min(maxHunger, hunger + 5);
        const newCold = applyColdWithFloor(cold + 5);
        
        setStats(newHealth, newHunger, newCold, money);
        updateUI();
        await saveGameData();
        showMessage("🌿 Вы отдохнули у реки! +5 здоровья, +5 голода, +5 тепла", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - +5 здоровья, +5 голода, +5 тепла`, 'location');
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ОТДЫХ НА ПОМОЙКЕ (старый вариант, заменён на callback) =====
    if (action.id === 'rest_dump') {
        await showActionTip('shown_rest', '🛌 Отдых на помойке восстанавливает здоровье и энергию.');
        
        const newHealth = Math.min(maxHealth, health + (action.effect?.health || 10));
        const newEnergy = Math.min(100, energy + (action.effect?.energy || 5));
        const newCold = cold;
        
        setStats(newHealth, hunger, newCold, money);
        setEnergy(newEnergy);
        updateUI();
        await saveGameData();
        showMessage("🛌 Вы отдохнули на картонке! +10 здоровья, +5 энергии", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - +10 здоровья, +5 энергии`, 'location');
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== НАБОР ВОДЫ =====
    if (action.id === 'collect_water') {
        await showActionTip('shown_collect_water', '💧 Набор воды — пополни запасы чистой воды.');
        const energyCost = energyCosts.collect_water || 5;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        spendEnergy(energyCost);
        
        const existingWater = inventory.find(i => i.id === 'water');
        if (existingWater) {
            existingWater.count++;
        } else {
            inventory.push({ id: 'water', count: 1 });
        }
        
        updateUI();
        await saveGameData();
        showMessage("💧 Вы набрали бутылку свежей воды!", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - +1 бутылка воды`, 'item');
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // ===== ЗОМБИ-ШУТЕР =====
    if (action.id === 'zombie_shooter') {
        await showActionTip('shown_zombie_shooter', '🧟 Добро пожаловать в зомби-тир! Стреляй по зомби, зарабатывай очки и получай награду. Чем сложнее режим — тем больше награда!');
        
        const energyCost = energyCosts.zombie_shooter || 20;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        if (!canPerformAction(action.name)) {
            return;
        }
        
        spendEnergy(energyCost);
        
        try {
            const { openZombieGame } = await import('./minigameZombie.js');
            await openZombieGame();
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - зомби-тир`, 'location');
        } catch (error) {
            console.error('Ошибка открытия зомби-тира:', error);
            showMessage("❌ Ошибка запуска игры. Попробуйте позже.", "#e74c3c");
            setEnergy(Math.min(100, energy + energyCost));
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // Проверка энергии
    const energyCost = energyCosts[action.id] || 0;
    if (energyCost > 0) {
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
    }
    
    if (!canPerformAction(action.name)) {
        return;
    }
    
    let success = true;
    let msg = "";
    let actionLogMessage = '';
    let gainedExp = 0;
    
    // ========== СОН В НОЧЛЕЖКЕ ==========
    if (action.id === 'sleep') {
        await showActionTip('shown_sleep', '🛌 Сон в ночлежке восстанавливает здоровье и энергию. Стоит 20₽.');
        
        if (action.cost && action.cost > 0) {
            if (money < action.cost) { 
                showMessage(`Не хватает ${action.cost}₽`, "#e74c3c"); 
                return; 
            }
            setStats(health, hunger, cold, money - action.cost);
            actionLogMessage += `-${action.cost}₽. `;
        }
        
        if (action.effect && action.effect.health) {
            const add = action.effect.health;
            const newHealth = Math.min(maxHealth, Math.max(0, health + add));
            setStats(newHealth, hunger, cold, money);
            msg += `Здоровье +${add}. `;
            actionLogMessage += `Здоровье +${add}. `;
        }
        
        if (action.effect && action.effect.energy) {
            const add = action.effect.energy;
            setEnergy(Math.min(100, energy + add));
            actionLogMessage += `+${add}⚡. `;
            msg += `Энергия +${add}. `;
        }
        
        reduceIntoxication(30);
        actionLogMessage += `🍺 Опьянение -30. `;
        
        const overlay = document.createElement('div');
        overlay.id = 'sleepOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'black';
        overlay.style.zIndex = '10002';
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        document.body.appendChild(overlay);
        
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
        
        setTimeout(async () => {
            const { addGameHours } = await import('./timeWeather.js');
            addGameHours(8);
            updateUI();
        }, 500);
        
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        }, 3500);
        
        updateUI();
        await saveGameData();
        showMessage(msg || "Вы хорошо отдохнули!", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - ${actionLogMessage}`, 'location');
        document.getElementById('locationModal').style.display = 'none';
        if (document.getElementById('inventoryModal').style.display === 'flex') {
            import('./inventory.js').then(m => { m.renderItemsTab(); m.renderEquipmentTab(); });
        }
        return;
    }
    
    // Обычная обработка
    if (action.needsItem) {
        const has = inventory.find(i => i.id === action.needsItem && i.count > 0);
        if (!has) { showMessage(`Нет ${itemsDB[action.needsItem]?.name || action.needsItem}`, "#e74c3c"); return; }
    }
    if (action.cost && action.cost > 0) {
        if (money < action.cost) { showMessage(`Не хватает ${action.cost}₽`, "#e74c3c"); return; }
        setStats(health, hunger, cold, money - action.cost);
        actionLogMessage += `-${action.cost}₽. `;
    }
    
    // Риск с учётом опьянения
    if (action.risk && action.risk > 0) {
        const modifiedRisk = applyIntoxicationToRisk(action.risk, intoxication);
        const roll = Math.random() * 100;
        
        if (roll < modifiedRisk) {
            success = false;
            msg = "❌ Неудача! ";
            if (action.riskEffect) {
                let newMoney = money + (action.riskEffect.money || 0);
                let newHealth = health + (action.riskEffect.health || 0);
                if (action.riskEffect.health) {
                    const modifiedDamage = applyIntoxicationToDamage(action.riskEffect.health, intoxication, false);
                    newHealth = health + modifiedDamage;
                }
                let newHunger = hunger + (action.riskEffect.hunger || 0);
                const newCold = applyColdWithFloor(cold);
                setStats(Math.min(maxHealth, Math.max(0, newHealth)), Math.min(maxHunger, Math.max(0, newHunger)), newCold, Math.max(0, newMoney));
                msg += `${action.riskEffect.health ? `Здоровье ${action.riskEffect.health>0?'+':''}${action.riskEffect.health}. ` : ''}${action.riskEffect.money ? `Деньги ${action.riskEffect.money>0?'+':''}${action.riskEffect.money}. ` : ''}`;
                actionLogMessage = `Неудача в действии "${action.name}"! ${msg}`;
                
                if (intoxication >= 50) {
                    addLogEntry(`🥴 Из-за опьянения (${Math.floor(intoxication)}%) шанс неудачи был выше!`, 'system');
                }
            }
        }
    }
    
    if (success) {
        msg = "✅ Успех! ";
        if (action.effect) {
            if (action.effect.money) {
                let add = Array.isArray(action.effect.money) ? Math.floor(Math.random()*(action.effect.money[1]-action.effect.money[0]+1)+action.effect.money[0]) : action.effect.money;
                setStats(health, hunger, cold, money + add);
                msg += `+${add}₽. `;
                actionLogMessage += `+${add}₽. `;
            }
            if (action.effect.health) {
                let add = Array.isArray(action.effect.health) ? Math.floor(Math.random()*(action.effect.health[1]-action.effect.health[0]+1)+action.effect.health[0]) : action.effect.health;
                let newHealth = health + add;
                setStats(Math.min(maxHealth, Math.max(0, newHealth)), hunger, cold, money);
                msg += `Здоровье ${add>0?'+':''}${add}. `;
                actionLogMessage += `Здоровье ${add>0?'+':''}${add}. `;
            }
            if (action.effect.hunger) {
                let add = Array.isArray(action.effect.hunger) ? Math.floor(Math.random()*(action.effect.hunger[1]-action.effect.hunger[0]+1)+action.effect.hunger[0]) : action.effect.hunger;
                let newHunger = hunger + add;
                setStats(health, Math.min(maxHunger, Math.max(0, newHunger)), cold, money);
                msg += `Голод ${add>0?'+':''}${add}. `;
                actionLogMessage += `Голод ${add>0?'+':''}${add}. `;
            }
            if (action.effect.intoxication) {
                const oldIntoxication = intoxication;
                addIntoxication(action.effect.intoxication);
                msg += `Опьянение +${action.effect.intoxication}. `;
                actionLogMessage += `Опьянение +${action.effect.intoxication}. `;
                
                await updateQuest('alcohol_consumed', 1);
                
                if (oldIntoxication < 100 && oldIntoxication + action.effect.intoxication >= 100) {
                    updateAchievementStats('maxIntoxication', 100);
                }
            }
            if (action.effect.items) {
                let items = Array.isArray(action.effect.items) ? action.effect.items : [action.effect.items];
                for (const it of items) {
                    const idx = inventory.findIndex(i => i.id === it);
                    if (idx !== -1) inventory[idx].count++;
                    else inventory.push({ id: it, count: 1 });
                    msg += `+1 ${itemsDB[it]?.name}. `;
                    actionLogMessage += `+1 ${itemsDB[it]?.name}. `;
                    gainedExp += 10;
                    
                    if (it === 'old_boot' || it === 'rusty_can' || it === 'torn_net' || it === 'plastic_bottle' || it === 'dirty_rag') {
                        await updateQuest('trash_found', 1);
                    }
                }
            }
        }
        if (action.needsItem) {
            const idx = inventory.findIndex(i => i.id === action.needsItem);
            if (idx !== -1) {
                if (inventory[idx].count === 1) inventory.splice(idx,1);
                else inventory[idx].count--;
                msg += `Израсходован ${itemsDB[action.needsItem]?.name}. `;
                actionLogMessage += `Израсходован ${itemsDB[action.needsItem]?.name}. `;
            }
        }
        
        // ===== ПОДСКАЗКИ ДЛЯ ДЕЙСТВИЙ =====
        if (action.id === 'beg') {
            await showActionTip('shown_beg', '🙏 Попрошайничество — один из первых способов заработать деньги. Риск: могут прогнать.');
        }
        if (action.id === 'search') {
            await showActionTip('shown_search', '🔍 Поиск вещей — можно найти еду или полезные предметы.');
        }
        if (action.id === 'steal') {
            await showActionTip('shown_steal', '🫳 Кража — рискованный способ добыть еду. Если поймают — потеряешь деньги и здоровье.');
        }
        if (action.id === 'scavenge' || action.id === 'scavenge_home') {
            await showActionTip('shown_scavenge', '🗑️ Копка в мусоре — можно найти бутылки, старую одежду или что-то ценное.');
        }
        if (action.id === 'pray') {
            await showActionTip('shown_pray', '🙏 Молитва восстанавливает здоровье. Бесплатно и безопасно.');
        }
        if (action.id === 'fight') {
            await showActionTip('shown_fight', '👊 Драка — можно заработать деньги, но есть риск получить травму.');
            gainedExp += 20;
            await updateQuest('fights_won', 1);
        }
        if (action.id === 'drink') {
            await showActionTip('shown_drink', '🍺 Выпивка повышает опьянение, но даёт здоровье. Не переусердствуй!');
        }
        if (action.id === 'eat') {
            await showActionTip('shown_eat', '🍽️ Еда в столовой восстанавливает голод. Стоит 25₽.');
        }
        if (action.id === 'steal') {
            await updateQuest('steal_success', 1);
        }
        if (action.id === 'pray') {
            await updateQuest('pray_count', 1);
        }
        if (action.id === 'eat' && locationId === 'shelter') gainedExp += 5;
        if (action.id === 'get_food') {
            await showActionTip('shown_get_food', '🍞 В церкви можно попросить хлеб. Бесплатно!');
            gainedExp += 10;
        }
        
        if (gainedExp > 0) {
            addExperience(gainedExp);
            logAction(`Получено ${gainedExp} опыта за действие "${action.name}"`, 'system');
        }
        
        if (energyCost > 0) {
            spendEnergy(energyCost);
            actionLogMessage += `-${energyCost}⚡. `;
        }
        
        if (action.id === 'beg' || action.id === 'get_food') {
            updateAchievementStats('totalBegs');
        }
        if (action.id === 'fight' && success) {
            updateAchievementStats('fightsWon');
        }
    }
    
    if (action.id && locationId) {
        await updateQuest('visit_location', 1, { locationId });
    }
    
    updateUI();
    await saveGameData();
    showMessage(msg, success ? "#4caf50" : "#e74c3c");
    
    if (actionLogMessage) {
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - ${actionLogMessage}`, 'location');
    } else if (success) {
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} (успех)`, 'location');
    } else {
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} (неудача)`, 'location');
    }
    
    document.getElementById('locationModal').style.display = 'none';
    if (document.getElementById('inventoryModal').style.display === 'flex') {
        import('./inventory.js').then(m => { m.renderItemsTab(); m.renderEquipmentTab(); });
    }
}

export function openLocationModal(locationId) {
    const loc = locationsDB[locationId];
    if (!loc) return;
    const modalContent = document.getElementById('locationModalContent');
    modalContent.innerHTML = `
        <h3>${loc.name}</h3>
        <p>${loc.description}</p>
        <div class="inventory-grid">
            ${loc.actions.map(a => `
                <div class="inventory-item" style="margin-bottom:8px;">
                    <div class="item-info"><div><strong>${a.name}</strong><br><small>${a.desc}</small></div></div>
                    <button class="action-location-btn" data-location="${locationId}" data-action-id="${a.id}">Выбрать</button>
                </div>
            `).join('')}
        </div>
        <button class="close-modal">Закрыть</button>
    `;
    document.getElementById('locationModal').style.display = 'flex';
    document.querySelectorAll('.action-location-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const locId = btn.dataset.location;
            const actId = btn.dataset.actionId;
            const act = locationsDB[locId].actions.find(a => a.id === actId);
            if (act) executeAction(locId, act);
        });
    });
    document.querySelector('#locationModal .close-modal').addEventListener('click', () => {
        document.getElementById('locationModal').style.display = 'none';
    });
}
