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

    // Рынок (market) – тип А
    suspicious_vendor: {
        id: "suspicious_vendor",
        name: "Подозрительный продавец",
        description: "Какой-то тип шепнул вам, что у него есть «особый товар» и сунул вам в руку свёрток.",
        image: "images/events/vendor.jpg",
        type: "auto",
        trigger: "location",
        locationId: "market",
        chance: 0.25,
        effect: { items: ["empty_bottle", "old_hat"] }, // случайный предмет из списка
        effectMessage: "В свёртке оказалось что-то любопытное."
    },

    // Церковь (church) – тип А
    generous_donation: {
        id: "generous_donation",
        name: "Щедрое пожертвование",
        description: "Кто-то оставил в церкви щедрое пожертвование, и вам перепало.",
        image: "images/events/donation.jpg",
        type: "auto",
        trigger: "location",
        locationId: "church",
        chance: 0.15,
        effect: { money: [50, 150], experience: 5 },
        effectMessage: "Вы получили свою долю и даже немного опыта."
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

    // Ночлежка (shelter) – тип Б
    noisy_neighbor: {
        id: "noisy_neighbor",
        name: "Сосед по комнате",
        description: "Ваш сосед по комнате храпит и мешает спать. Что делать?",
        image: "images/events/snoring.jpg",
        type: "choice",
        trigger: "location",
        locationId: "shelter",
        chance: 0.2,
        choices: [
            {
                text: "Разбудить и попросить тишины",
                risk: 0.3,
                success: { health: 10, cold: 5 },
                successMessage: "Сосед извинился и перевернулся на другой бок. Вы хорошо выспались.",
                fail: { health: -10 },
                failMessage: "Сосед разозлился и ударил вас."
            },
            {
                text: "Перетерпеть",
                effect: {},
                message: "Вы решили не связываться и просто перетерпели."
            }
        ]
    },

    // Бар (bar) – тип Б
    card_game: {
        id: "card_game",
        name: "Странный незнакомец",
        description: "Незнакомец предлагает вам сыграть в карты на деньги. Соглашаетесь?",
        image: "images/events/cards.jpg",
        type: "choice",
        trigger: "location",
        locationId: "bar",
        chance: 0.25,
        choices: [
            {
                text: "Сыграть",
                risk: 0.6,
                success: { money: 100 },
                successMessage: "Вам повезло! Вы выиграли 100₽.",
                fail: { money: -50, health: -5 },
                failMessage: "Вас обыграли! Вы потеряли 50₽ и получили синяк."
            },
            {
                text: "Отказаться",
                effect: {},
                message: "Вы отказались и продолжили пить в одиночестве."
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
