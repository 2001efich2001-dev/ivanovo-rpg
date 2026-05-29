// js/news.js
import { showMessage } from './utils.js';

// URL к файлу с новостями (можно заменить на API позже)
const NEWS_FILE_URL = 'news.json';

// Хранилище текущих новостей
let currentNews = null;
let hasShownThisSession = false;

// Загрузка новостей из JSON файла
export async function loadNews() {
    try {
        const response = await fetch(NEWS_FILE_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        currentNews = data;
        console.log('📰 Новости загружены:', currentNews);
        return currentNews;
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error);
        // Запасные новости на случай ошибки
        currentNews = {
            title: "📢 Добро пожаловать!",
            image: "images/news_default.png",
            text: "Добро пожаловать в игру! Здесь будут появляться новости и объявления."
        };
        return currentNews;
    }
}

// Показать модальное окно с новостями
export function showNewsModal(news) {
    const modal = document.getElementById('newsModal');
    if (!modal) {
        console.error('❌ Модальное окно новостей не найдено');
        return;
    }
    
    const titleEl = document.getElementById('newsTitle');
    const imageEl = document.getElementById('newsImage');
    const textEl = document.getElementById('newsText');
    
    if (titleEl) titleEl.textContent = news.title || '📢 НОВОСТИ';
    if (imageEl) {
        imageEl.src = news.image || 'images/news_default.png';
        imageEl.alt = news.title || 'Новости';
        // Обработка ошибки загрузки картинки
        imageEl.onerror = () => {
            imageEl.src = 'images/news_default.png';
        };
    }
    if (textEl) textEl.textContent = news.text || '';
    
    modal.style.display = 'flex';
    
    // Сохраняем флаг, что показали
    hasShownThisSession = true;
}

// Закрыть модальное окно
export function closeNewsModal() {
    const modal = document.getElementById('newsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Основная функция для показа новостей (вызывать после авторизации)
export async function showNewsIfNeeded(force = false) {
    // Если уже показывали в этой сессии и не принудительно — не показываем
    if (hasShownThisSession && !force) {
        console.log('📰 Новости уже показаны в этой сессии');
        return false;
    }
    
    const news = await loadNews();
    showNewsModal(news);
    return true;
}

// Инициализация обработчиков новостного окна
export function initNewsModal() {
    const closeBtn = document.getElementById('newsCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeNewsModal();
        });
    }
    
    // Закрытие по клику вне окна
    const modal = document.getElementById('newsModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeNewsModal();
            }
        });
    }
}
