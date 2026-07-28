// js/news.js
import { showMessage } from './utils.js';

const NEWS_STORAGE_KEY = 'last_news_shown';

export async function showNewsIfNeeded() {
    try {
        const response = await fetch('news.json');
        if (!response.ok) {
            console.warn('Новости не найдены');
            return;
        }
        
        const newsData = await response.json();
        const lastShown = localStorage.getItem(NEWS_STORAGE_KEY);
        const today = new Date().toDateString();
        
        // Показываем новости, если сегодня ещё не показывали
        if (lastShown !== today) {
            showNewsModal(newsData);
            localStorage.setItem(NEWS_STORAGE_KEY, today);
        }
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
    }
}

function showNewsModal(newsData) {
    const modal = document.getElementById('newsModal');
    const title = document.getElementById('newsTitle');
    const image = document.getElementById('newsImage');
    const text = document.getElementById('newsText');
    const closeBtn = document.getElementById('newsCloseBtn');
    
    if (!modal || !title || !image || !text) {
        console.error('Элементы новостей не найдены');
        return;
    }
    
    // Устанавливаем заголовок
    title.textContent = newsData.title || '📢 НОВОСТИ';
    
    // Устанавливаем изображение (с fallback)
    if (newsData.image) {
        image.src = newsData.image;
        image.alt = newsData.title || 'Новости';
        image.onerror = () => {
            image.src = 'images/news_default.png';
        };
        image.style.display = 'block';
    } else {
        image.style.display = 'none';
    }
    
    // Обрабатываем текст с ссылками
    if (newsData.links && newsData.links.length > 0) {
        // Если есть ссылки, форматируем текст с кнопками
        let html = newsData.text ? `<p>${escapeHtml(newsData.text)}</p>` : '';
        
        html += '<div class="news-links" style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px; align-items: center;">';
        for (const link of newsData.links) {
            html += `
                <a href="${link.url}" target="_blank" rel="noopener noreferrer" 
                   style="
                       display: inline-block;
                       padding: 12px 24px;
                       background: #1a73e8;
                       color: #fff;
                       text-decoration: none;
                       border-radius: 40px;
                       font-weight: bold;
                       font-size: 1rem;
                       transition: all 0.3s ease;
                       box-shadow: 0 4px 15px rgba(26, 115, 232, 0.3);
                       width: 100%;
                       max-width: 300px;
                       text-align: center;
                   "
                   onmouseenter="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 25px rgba(26, 115, 232, 0.5)'"
                   onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(26, 115, 232, 0.3)'"
                >
                    ${link.text}
                </a>
            `;
        }
        html += '</div>';
        
        text.innerHTML = html;
    } else {
        // Обычный текст (с поддержкой переносов)
        text.innerHTML = newsData.text ? escapeHtml(newsData.text).replace(/\n/g, '<br>') : '';
    }
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    
    // Обработчик закрытия
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    // Закрытие по клику вне окна
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

export function initNewsModal() {
    // Инициализация уже сделана в showNewsIfNeeded
    console.log('📢 Система новостей инициализирована');
}

// ===== ДЛЯ ТЕСТИРОВАНИЯ: принудительно показать новости =====
export function forceShowNews() {
    fetch('news.json')
        .then(response => response.json())
        .then(data => {
            // Очищаем localStorage, чтобы новости точно показались
            localStorage.removeItem(NEWS_STORAGE_KEY);
            showNewsModal(data);
        })
        .catch(error => console.error('Ошибка принудительного показа новостей:', error));
}

// Для отладки в консоли
window.forceShowNews = forceShowNews;
