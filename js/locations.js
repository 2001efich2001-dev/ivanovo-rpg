import { itemsDB } from './inventory.js';
import { saveGameData } from './firestore.js';
import { showMessage, logAction } from './utils.js';
import { createWeatherLayers, removeWeatherLayers, updateDarkness, updateWeatherEffects } from './weatherEffects.js';
import { addExperience, inventory, health, hunger, cold, money, maxHealth, maxHunger, maxCold, setStats, updateUI, hasEnoughEnergy, spendEnergy, energy, setEnergy, intoxication, getIntoxicationLuckModifier, getIntoxicationDamageModifier, canPerformAction } from './gameState.js';
import { updateAchievementStats } from './achievements.js';

// Локальный вызов звука (через глобальную функцию из main.js)
function playClick() {
    if (typeof window.playClickSound === 'function') window.playClickSound();
}

// Стоимость энергии для разных действий
const energyCosts = {
    beg: 10,      // попросить подаяние
    search: 15,   // поискать вещи
    trade: 5,     // обменять бутылки
    steal: 20,    // украсть еду
    scavenge: 15, // покопаться в мусоре
    pray: 5,      // помолиться
    get_food: 10, // попросить еду
    drink: 5,     // выпить водку
    fight: 25,    // подраться
    eat: 5,       // поесть в столовой
    sleep: 0,     // сон (восстанавливает энергию, не тратит)
    fishing: 15,  // рыбалка
    relax: 0,     // отдых
    collect_water: 5, // набор воды
    darts: 10,    // дротики
    rest_dump: 0, // отдых на помойке
    storage: 0    // открытие хранилища (не тратит энергию)
};

// Модификация риска в зависимости от опьянения (чем выше опьянение, тем выше шанс неудачи)
function applyIntoxicationToRisk(originalRisk, intoxicationLevel) {
    if (intoxicationLevel < 20) return originalRisk;
    if (intoxicationLevel < 50) return originalRisk + 10;  // +10% к риску
    if (intoxicationLevel < 80) return originalRisk + 25;  // +25% к риску
    return originalRisk + 50;  // +50% к риску
}

// Модификация урона/потери здоровья в зависимости от опьянения
function applyIntoxicationToDamage(originalDamage, intoxicationLevel, isSuccess = true) {
    if (!isSuccess) return originalDamage; // при неудаче не модифицируем
    const modifier = getIntoxicationDamageModifier();
    if (modifier === 1.0) return originalDamage;
    return Math.floor(originalDamage * modifier);
}

// База локаций с фонами, зонами и действиями
export const locationsDB = {
    railway: {
        id: "railway",
        name: "Вокзал",
        description: "Шум, люди, поезда. Можно попросить подаяние или поискать забытые вещи.",
        bgImage: "images/railway_bg.jpg",
        zones: [
            { id: "beg_zone", name: "Площадь у вокзала", description: "Попросить подаяние: получить 10-50₽ (риск 30%)", cx: 150, cy: 200, r: 50, actionId: "beg" },
            { id: "search_zone", name: "Зал ожидания", description: "Поискать вещи: хлеб или вода (риск 20%)", cx: 400, cy: 180, r: 45, actionId: "search" }
        ],
        actions: [
            { id: "beg", name: "Попросить подаяние", desc: "Риск: 30% получить отказ", effect: { money: [10, 50] }, risk: 30, riskEffect: { money: -10, health: -5 } },
            { id: "search", name: "Поискать забытые вещи", desc: "Риск: 20% найти мусор", effect: { items: ["bread", "water"] }, risk: 20, riskEffect: { health: -10, hunger: -5 } }
        ]
    },
    market: {
        id: "market",
        name: "Рынок",
        description: "Оживлённое место, можно обменять вещи или украсть еду.",
        bgImage: "images/market_bg.jpg",
        zones: [
            { id: "trade_zone", name: "Прилавок", description: "Обменять пустые бутылки: 5-15₽", cx: 200, cy: 150, r: 50, actionId: "trade" },
            { id: "steal_zone", name: "Лотки с едой", description: "Украсть еду: +1 хлеб (риск 50%)", cx: 450, cy: 200, r: 55, actionId: "steal" }
        ],
        actions: [
            { id: "trade", name: "Обменять пустые бутылки", desc: "Требуется пустая бутылка", needsItem: "empty_bottle", effect: { money: [5, 15] }, risk: 0 },
            { id: "steal", name: "Украсть еду", desc: "Риск: 50% поймают", effect: { items: ["bread"] }, risk: 50, riskEffect: { money: -30, health: -15 } }
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
        zones: [
            { id: "scavenge_zone", name: "Куча мусора", description: "Покопаться: найти бутылку или старую шапку (риск 40%)", cx: 200, cy: 200, r: 70, actionId: "scavenge" }
        ],
        actions: [
            { id: "scavenge", name: "Покопаться в мусоре", desc: "Риск: 40% получить инфекцию", effect: { items: ["empty_bottle", "old_hat"] }, risk: 40, riskEffect: { health: -15, hunger: -5 } }
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
        description: "Можно выпить, подраться или сыграть в дротики.",
        bgImage: "images/bar_bg.jpg",
        zones: [
            { id: "drink_zone", name: "Стойка", description: "Выпить водку: +10 здоровья, -5 голода, 40₽", cx: 150, cy: 200, r: 50, actionId: "drink" },
            { id: "fight_zone", name: "Танцпол", description: "Подраться: получить 20-100₽ (риск 50%)", cx: 400, cy: 220, r: 65, actionId: "fight" },
            { id: "darts_zone", name: "🎯 Дартс", description: "Сыграть в пьяный дротик (тратит 10 энергии, нужно 20% опьянения)", cx: 600, cy: 200, r: 50, actionId: "darts" }
        ],
        actions: [
            { id: "drink", name: "Выпить водку", desc: "Здоровье +10, голод -5, стоит 40₽", effect: { health: 10, hunger: -5 }, cost: 40, risk: 0 },
            { id: "fight", name: "Подраться", desc: "Риск: 50% получить травму", effect: { money: [20, 100] }, risk: 50, riskEffect: { health: -20 } },
            { id: "darts", name: "🎯 Пьяный дротик", desc: "Сыграть в дартс (10 энергии, нужно 20% опьянения)", effect: {}, cost: 0, risk: 0 }
        ]
    },

    // ========== ЛОКАЦИИ ДЛЯ ЖИЛЬЯ ==========
    dump_home: {
        id: "dump_home",
        name: "🗑️ Моя помойка",
        description: "Твоё любимое место на свалке. Картонка, крыса рядом...",
        bgImage: "images/dump_home.jpg",
        zones: [
            { id: "rest_zone", name: "Картонка", description: "Отдохнуть: +10 здоровья, +5 энергии", cx: 200, cy: 200, r: 60, actionId: "rest_dump" },
            { id: "scavenge_zone", name: "Помойка", description: "Покопаться в мусоре", cx: 400, cy: 200, r: 55, actionId: "scavenge_home" }
        ],
        actions: [
            { id: "rest_dump", name: "Отдохнуть", desc: "Восстановить здоровье и энергию", effect: { health: 10, energy: 5 }, cost: 0, risk: 0 },
            { id: "scavenge_home", name: "Покопаться в мусоре", desc: "Найти что-то полезное", effect: { items: ["empty_bottle", "old_hat"] }, risk: 30, riskEffect: { health: -5 } }
        ]
    },
    dorm_home: {
        id: "dorm_home",
        name: "🛏️ Моя комната в общаге",
        description: "Уютная комнатка. Есть кровать и тумбочка.",
        bgImage: "images/dorm_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать: +20 здоровья, +20 энергии", cx: 200, cy: 200, r: 60, actionId: "sleep_dorm" },
            { id: "storage_zone", name: "Тумбочка", description: "Достать вещи из хранилища", cx: 400, cy: 200, r: 55, actionId: "storage_open" }
        ],
        actions: [
            { id: "sleep_dorm", name: "Поспать", desc: "Восстановить здоровье и энергию", effect: { health: 20, energy: 20 }, cost: 0, risk: 0 },
            { id: "storage_open", name: "Открыть хранилище", desc: "Достать вещи из хранилища", effect: {}, cost: 0, risk: 0 }
        ]
    },
    apartment_home: {
        id: "apartment_home",
        name: "🏢 Моя квартира",
        description: "Просторная квартира. Полный уют и комфорт.",
        bgImage: "images/apartment_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать: +30 здоровья, +30 энергии", cx: 200, cy: 200, r: 60, actionId: "sleep_apartment" },
            { id: "kitchen_zone", name: "Кухня", description: "Приготовить еду", cx: 400, cy: 200, r: 55, actionId: "cook" }
        ],
        actions: [
            { id: "sleep_apartment", name: "Поспать", desc: "Восстановить здоровье и энергию", effect: { health: 30, energy: 30 }, cost: 0, risk: 0 },
            { id: "cook", name: "Приготовить еду", desc: "Сделать бутерброд", effect: { items: ["bread"] }, cost: 0, risk: 0 }
        ]
    },
    house_home: {
        id: "house_home",
        name: "🏠 Мой дом",
        description: "Роскошный дом. Сауна, гараж, всё включено!",
        bgImage: "images/house_home.jpg",
        zones: [
            { id: "sleep_zone", name: "Кровать", description: "Поспать: +50 здоровья, +50 энергии", cx: 150, cy: 200, r: 50, actionId: "sleep_house" },
            { id: "sauna_zone", name: "Сауна", description: "Попариться: +20 здоровья, -10 голода", cx: 350, cy: 200, r: 50, actionId: "sauna" },
            { id: "garage_zone", name: "Гараж", description: "Хранилище", cx: 550, cy: 200, r: 50, actionId: "garage_storage" }
        ],
        actions: [
            { id: "sleep_house", name: "Поспать", desc: "Восстановить здоровье и энергию", effect: { health: 50, energy: 50 }, cost: 0, risk: 0 },
            { id: "sauna", name: "Сауна", desc: "Попариться", effect: { health: 20, hunger: -10 }, cost: 0, risk: 0 },
            { id: "garage_storage", name: "Открыть гараж", desc: "Хранилище вещей", effect: {}, cost: 0, risk: 0 }
        ]
    },

    // ========== НОВАЯ ЛОКАЦИЯ: РЕКА УВОДЬ (РЫБАЛКА) ==========
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
    
    // Удаляем старые слои погоды
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
    
    zonesContainer.innerHTML = '';
    zonesContainer.appendChild(svg);
    
    // Создаём слои для погодных эффектов
    createWeatherLayers(locationContainer);
    
    // Обновляем затемнение и погодные эффекты
    updateDarkness();
    updateWeatherEffects();
    
    // Принудительно обновляем canvas после небольшой задержки (чтобы размеры успели установиться)
    setTimeout(() => {
        updateDarkness();
        updateWeatherEffects();
    }, 50);
    
    // ===== АЧИВКИ: отслеживаем посещение новой локации =====
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
    
    // ===== НОВЫЙ ОСОБЫЙ СЛУЧАЙ: ОТКРЫТЬ ХРАНИЛИЩЕ =====
    if (action.id === 'storage_open' || action.id === 'garage_storage') {
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
    
    // Особый случай: дротики
    if (action.id === 'darts') {
        // Проверка энергии
        const energyCost = energyCosts.darts || 10;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        // Проверка опьянения (нельзя играть трезвым)
        if (intoxication < 20) {
            showMessage(`🍺 Бармен не даёт дротики трезвым! Выпей сначала! (нужно 20% опьянения)`, '#e74c3c');
            return;
        }
        
        // Проверка возможности выполнения действия
        if (!canPerformAction(action.name)) {
            return;
        }
        
        // Тратим энергию
        spendEnergy(energyCost);
        
        // Открываем мини-игру дротиков
        try {
            const { openDartsGame } = await import('./minigameDarts.js');
            await openDartsGame();
            
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - начало игры в дротики`, 'location');
        } catch (error) {
            console.error('Ошибка открытия дротиков:', error);
            showMessage("❌ Ошибка запуска игры. Попробуйте позже.", "#e74c3c");
            // Возвращаем энергию при ошибке
            setEnergy(Math.min(100, energy + energyCost));
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // Особый случай: рыбалка
    if (action.id === 'fishing') {
        // Проверяем наличие удочки
        const hasRod = inventory.find(i => i.id === 'fishing_rod' && i.count > 0);
        if (!hasRod) {
            showMessage("❌ У вас нет удочки! Купите её в магазине.", "#e74c3c");
            return;
        }
        
        // Проверка энергии
        const energyCost = energyCosts.fishing || 15;
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
        
        // Проверка возможности выполнения действия
        if (!canPerformAction(action.name)) {
            return;
        }
        
        // Тратим энергию
        spendEnergy(energyCost);
        
        // Открываем мини-игру рыбалки
        try {
            const { openFishingGame } = await import('./minigameFishing.js');
            await openFishingGame();
            
            // Логируем действие
            logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - начало рыбалки`, 'location');
        } catch (error) {
            console.error('Ошибка открытия рыбалки:', error);
            showMessage("❌ Ошибка запуска рыбалки. Попробуйте позже.", "#e74c3c");
            // Возвращаем энергию при ошибке
            setEnergy(Math.min(100, energy + energyCost));
        }
        
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // Особый случай: отдых у реки
    if (action.id === 'relax') {
        const newHealth = Math.min(maxHealth, health + 5);
        const newHunger = Math.min(maxHunger, hunger + 5);
        const newCold = Math.min(maxCold, cold + 5);
        setStats(newHealth, newHunger, newCold, money);
        updateUI();
        await saveGameData();
        showMessage("🌿 Вы отдохнули у реки! +5 здоровья, +5 голода, +5 тепла", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - +5 здоровья, +5 голода, +5 тепла`, 'location');
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // Особый случай: отдых на помойке
    if (action.id === 'rest_dump') {
        const newHealth = Math.min(maxHealth, health + (action.effect?.health || 10));
        const newEnergy = Math.min(100, energy + (action.effect?.energy || 5));
        setStats(newHealth, hunger, cold, money);
        setEnergy(newEnergy);
        updateUI();
        await saveGameData();
        showMessage("🛌 Вы отдохнули на картонке! +10 здоровья, +5 энергии", "#4caf50");
        logAction(`В локации "${locationsDB[locationId]?.name}": ${action.name} - +10 здоровья, +5 энергии`, 'location');
        document.getElementById('locationModal').style.display = 'none';
        return;
    }
    
    // Особый случай: набор воды
    if (action.id === 'collect_water') {
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
    
    // Проверка энергии (кроме сна, так как он восстанавливает)
    const energyCost = energyCosts[action.id] || 0;
    if (energyCost > 0) {
        if (!hasEnoughEnergy(energyCost)) {
            showMessage(`❌ Не хватает энергии! Нужно ${energyCost}⚡`, '#e74c3c');
            return;
        }
    }
    
    // Проверка возможности выполнения действия (из-за сильного опьянения)
    if (!canPerformAction(action.name)) {
        return;
    }
    
    let success = true;
    let msg = "";
    let actionLogMessage = '';
    let gainedExp = 0;
    
    // ========== ОБРАБОТКА СНА (НОЧЛЕЖКА + ЖИЛЬЁ) ==========
    if (action.id === 'sleep' || action.id === 'sleep_dorm' || action.id === 'sleep_apartment' || action.id === 'sleep_house') {
        // Проверяем деньги (только для ночлежки)
        if (action.cost && action.cost > 0) {
            if (money < action.cost) { 
                showMessage(`Не хватает ${action.cost}₽`, "#e74c3c"); 
                return; 
            }
            setStats(health, hunger, cold, money - action.cost);
            actionLogMessage += `-${action.cost}₽. `;
        }
        
        // Восстанавливаем здоровье
        if (action.effect && action.effect.health) {
            const add = action.effect.health;
            const newHealth = Math.min(maxHealth, Math.max(0, health + add));
            setStats(newHealth, hunger, cold, money);
            msg += `Здоровье +${add}. `;
            actionLogMessage += `Здоровье +${add}. `;
        }
        
        // Восстанавливаем энергию
        if (action.effect && action.effect.energy) {
            const add = action.effect.energy;
            setEnergy(Math.min(100, energy + add));
            actionLogMessage += `+${add}⚡. `;
            msg += `Энергия +${add}. `;
        }
        
        // Для ночлежки ещё и опьянение снимаем + анимация
        if (action.id === 'sleep') {
            const { reduceIntoxication } = await import('./gameState.js');
            reduceIntoxication(30);
            actionLogMessage += `🍺 Опьянение -30. `;
            
            // Затемняем экран
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
        }
        
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
    
    // Обычная обработка для остальных действий
    if (action.needsItem) {
        const has = inventory.find(i => i.id === action.needsItem && i.count > 0);
        if (!has) { showMessage(`Нет ${itemsDB[action.needsItem]?.name || action.needsItem}`, "#e74c3c"); return; }
    }
    if (action.cost && action.cost > 0) {
        if (money < action.cost) { showMessage(`Не хватает ${action.cost}₽`, "#e74c3c"); return; }
        setStats(health, hunger, cold, money - action.cost);
        actionLogMessage += `-${action.cost}₽. `;
    }
    
    // Модифицированный риск с учётом опьянения
    if (action.risk && action.risk > 0) {
        const modifiedRisk = applyIntoxicationToRisk(action.risk, intoxication);
        const roll = Math.random() * 100;
        
        if (roll < modifiedRisk) {
            success = false;
            msg = "❌ Неудача! ";
            if (action.riskEffect) {
                let newMoney = money + (action.riskEffect.money || 0);
                let newHealth = health + (action.riskEffect.health || 0);
                // Применяем модификатор урона от опьянения
                if (action.riskEffect.health) {
                    const modifiedDamage = applyIntoxicationToDamage(action.riskEffect.health, intoxication, false);
                    newHealth = health + modifiedDamage;
                }
                let newHunger = hunger + (action.riskEffect.hunger || 0);
                setStats(Math.min(maxHealth, Math.max(0, newHealth)), Math.min(maxHunger, Math.max(0, newHunger)), cold, Math.max(0, newMoney));
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
            if (action.effect.items) {
                let items = Array.isArray(action.effect.items) ? action.effect.items : [action.effect.items];
                items.forEach(it => {
                    const idx = inventory.findIndex(i => i.id === it);
                    if (idx !== -1) inventory[idx].count++;
                    else inventory.push({ id: it, count: 1 });
                    msg += `+1 ${itemsDB[it]?.name}. `;
                    actionLogMessage += `+1 ${itemsDB[it]?.name}. `;
                    gainedExp += 10;
                });
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
        
        if (action.id === 'fight') gainedExp += 20;
        if (action.id === 'steal') gainedExp += 15;
        if (action.id === 'pray') gainedExp += 5;
        if (action.id === 'eat' && locationId === 'shelter') gainedExp += 5;
        if (action.id === 'get_food') gainedExp += 10;
        
        if (gainedExp > 0) {
            addExperience(gainedExp);
            logAction(`Получено ${gainedExp} опыта за действие "${action.name}"`, 'system');
        }
        
        // Списание энергии только при успешном действии
        if (energyCost > 0) {
            spendEnergy(energyCost);
            actionLogMessage += `-${energyCost}⚡. `;
        }
        
        // ===== АЧИВКИ =====
        // Отслеживаем попрошайничество (beg) и получение еды (get_food)
        if (action.id === 'beg' || action.id === 'get_food') {
            updateAchievementStats('totalBegs');
        }
        // Отслеживаем выигранные драки
        if (action.id === 'fight' && success) {
            updateAchievementStats('fightsWon');
        }
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
