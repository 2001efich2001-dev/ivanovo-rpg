// js/randomEventsDB.js
// База случайных событий

export const eventsDB = {
    // ===== ТИП А: Без выбора =====
    find_vodka: {
        id: "find_vodka",
        name: "Находка на свалке",
        description: "Вы наткнулись на полную бутылку водки!",
        image: "images/events/vodka_bottle.jpg",
        type: "auto",
        trigger: "location",
        locationId: "dump",
        chance: 0.3,
        effect: { items: ["vodka"] },
        effectMessage: "+1 водка добавлена в инвентарь"
    },

    // ===== ТИП Б: С выбором =====
    suspicious_suitcase: {
        id: "suspicious_suitcase",
        name: "Одинокий чемодан",
        description: "Вы увидели одиноко стоящий чемодан. Что будете делать?",
        image: "images/events/suitcase.jpg",
        type: "choice",
        trigger: "location",
        locationId: "railway",
        chance: 0.2,
        choices: [
            {
                text: "Украсть чемодан",
                risk: 0.5,
                success: { items: ["empty_bottle", "old_hat", "medkit"] }, // случайный предмет из списка
                successMessage: "Вам повезло! В чемодане кое-что было.",
                fail: { health: -30 },
                failMessage: "Вас заметили! Охранник ударил вас."
            },
            {
                text: "Оставить чемодан",
                effect: {},
                message: "Вы решили не рисковать и прошли мимо."
            }
        ]
    },

    // ===== ТИП В: Погодное событие (с временным эффектом) =====
    blizzard: {
        id: "blizzard",
        name: "Сильная метель",
        description: "Наблюдается сильная буря. Вы замерзаете быстрее!",
        image: "images/events/blizzard.jpg",
        type: "weather",
        trigger: "weather",
        weatherCondition: "snow",
        chance: 0.15,
        duration: 60000,            // 60 секунд реального времени
        effect: { coldMultiplier: 2.0 },  // ускорение падения тепла в 2 раза
        effectMessage: "Буря утихла. Теперь вы замерзаете нормально."
    }
};
