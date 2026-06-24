// js/handbook.js
import { handbookSections } from './handbookData.js';

let currentPageIndex = 0;
let isMenuMode = true;
let modal = null;

// ========== ОТКРЫТЬ СПРАВОЧНИК ==========
export function openHandbook() {
    // Удаляем старый справочник, если есть
    const oldModal = document.getElementById('handbookModal');
    if (oldModal) oldModal.remove();

    currentPageIndex = 0;
    isMenuMode = true;

    modal = document.createElement('div');
    modal.id = 'handbookModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    `;

    render();
    document.body.appendChild(modal);

    // Закрытие по Escape
    const closeHandler = (e) => {
        if (e.key === 'Escape') {
            closeHandbook();
        }
    };
    document.addEventListener('keydown', closeHandler);
    modal._closeHandler = closeHandler;

    // Закрытие по клику вне окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeHandbook();
        }
    });
}

// ========== ЗАКРЫТЬ ==========
function closeHandbook() {
    if (modal) {
        if (modal._closeHandler) {
            document.removeEventListener('keydown', modal._closeHandler);
        }
        modal.remove();
        modal = null;
    }
}

// ========== РЕНДЕРИНГ ==========
function render() {
    if (!modal) return;

    const container = document.createElement('div');
    container.style.cssText = `
        max-width: 1000px;
        width: 100%;
        max-height: 90vh;
        background: var(--card-bg, #1a1a2e);
        border-radius: 24px;
        border: 1px solid var(--card-border, #333);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
    `;

    // ===== ЗАГОЛОВОК =====
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid var(--card-border, #333);
        flex-shrink: 0;
        background: var(--card-bg, #1a1a2e);
    `;
    header.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:1.5rem;">📖</span>
            <span style="font-size:1.3rem; font-weight:bold; color: var(--text-primary, #fff);">СПРАВОЧНИК</span>
            <span style="font-size:0.8rem; color: var(--text-secondary, #888);">${isMenuMode ? '📚 Меню' : `${currentPageIndex + 1} / ${handbookSections.length}`}</span>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
            <button id="handbookMenuBtn" style="
                background: ${isMenuMode ? 'var(--accent-gold, #ffd966)' : 'var(--stat-bg, #2a2a3e)'};
                border: none;
                border-radius: 40px;
                padding: 6px 14px;
                color: ${isMenuMode ? '#1a1a2e' : 'var(--text-primary, #fff)'};
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: bold;
                transition: all 0.3s;
            ">📚 Меню</button>
            <button id="handbookCloseBtn" style="
                background: none;
                border: none;
                color: var(--text-primary, #fff);
                font-size: 1.5rem;
                cursor: pointer;
                opacity: 0.6;
                transition: opacity 0.3s;
            ">✕</button>
        </div>
    `;
    container.appendChild(header);

    // ===== ОСНОВНАЯ ЧАСТЬ =====
    const body = document.createElement('div');
    body.style.cssText = `
        display: flex;
        flex: 1;
        overflow: hidden;
        min-height: 0;
    `;

    // ===== МЕНЮ (слева) =====
    const menu = document.createElement('div');
    menu.style.cssText = `
        width: ${isMenuMode ? '250px' : '0'};
        overflow-y: auto;
        padding: ${isMenuMode ? '16px' : '0'};
        border-right: ${isMenuMode ? '1px solid var(--card-border, #333)' : 'none'};
        flex-shrink: 0;
        transition: all 0.3s ease;
        background: var(--card-bg, #1a1a2e);
    `;

    if (isMenuMode) {
        menu.innerHTML = handbookSections.map((section, index) => `
            <div class="handbook-menu-item" data-index="${index}" style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 14px;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
                color: var(--text-primary, #fff);
                margin-bottom: 4px;
                background: ${currentPageIndex === index ? 'var(--accent-gold, rgba(255,215,0,0.15))' : 'transparent'};
                border-left: ${currentPageIndex === index ? '3px solid #ffd700' : '3px solid transparent'};
            ">
                <span style="font-size:1.2rem;">${section.icon}</span>
                <span style="font-size:0.9rem;">${section.title}</span>
            </div>
        `).join('');

        // Обработчики кликов по пунктам меню
        menu.querySelectorAll('.handbook-menu-item').forEach(el => {
            el.addEventListener('click', () => {
                const index = parseInt(el.dataset.index);
                currentPageIndex = index;
                isMenuMode = false;
                render();
            });
            el.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            });
            el.addEventListener('mouseleave', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                e.currentTarget.style.background = currentPageIndex === idx ? 'var(--accent-gold, rgba(255,215,0,0.15))' : 'transparent';
            });
        });
    }
    body.appendChild(menu);

    // ===== КОНТЕНТ (справа) =====
    const content = document.createElement('div');
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 20px 28px;
        background: var(--card-bg, #1a1a2e);
        color: var(--text-primary, #e0e0e0);
        line-height: 1.7;
        font-size: 0.95rem;
    `;

    const section = handbookSections[currentPageIndex];
    if (section) {
        content.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; border-bottom:1px solid var(--card-border, #333); padding-bottom:12px;">
                <span style="font-size:2rem;">${section.icon}</span>
                <h2 style="margin:0; color: var(--text-primary, #fff); font-size:1.5rem;">${section.title}</h2>
            </div>
            <div class="handbook-content">
                ${section.content}
            </div>
            <div style="margin-top:20px; padding-top:12px; border-top:1px solid var(--card-border, #333); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; gap:10px;">
                    <button id="handbookPrevBtn" style="
                        background: var(--stat-bg, #2a2a3e);
                        border: none;
                        border-radius: 40px;
                        padding: 6px 16px;
                        color: var(--text-primary, #fff);
                        cursor: pointer;
                        font-size: 0.85rem;
                        transition: all 0.3s;
                    " ${currentPageIndex === 0 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}>◀ Назад</button>
                    <button id="handbookNextBtn" style="
                        background: var(--stat-bg, #2a2a3e);
                        border: none;
                        border-radius: 40px;
                        padding: 6px 16px;
                        color: var(--text-primary, #fff);
                        cursor: pointer;
                        font-size: 0.85rem;
                        transition: all 0.3s;
                    " ${currentPageIndex === handbookSections.length - 1 ? 'disabled style="opacity:0.3;cursor:default;"' : ''}>Вперед →</button>
                </div>
                <div style="font-size:0.8rem; color: var(--text-secondary, #888);">
                    ${currentPageIndex + 1} / ${handbookSections.length}
                </div>
            </div>
        `;

        // Обработчики навигации
        const prevBtn = content.querySelector('#handbookPrevBtn');
        const nextBtn = content.querySelector('#handbookNextBtn');

        if (prevBtn && !prevBtn.disabled) {
            prevBtn.addEventListener('click', () => {
                if (currentPageIndex > 0) {
                    currentPageIndex--;
                    render();
                }
            });
        }

        if (nextBtn && !nextBtn.disabled) {
            nextBtn.addEventListener('click', () => {
                if (currentPageIndex < handbookSections.length - 1) {
                    currentPageIndex++;
                    render();
                }
            });
        }
    }

    body.appendChild(content);
    container.appendChild(body);

    // ===== ФУТЕР (опционально) =====
    const footer = document.createElement('div');
    footer.style.cssText = `
        padding: 10px 24px;
        border-top: 1px solid var(--card-border, #333);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
        background: var(--card-bg, #1a1a2e);
        font-size: 0.7rem;
        color: var(--text-secondary, #666);
        flex-wrap: wrap;
        gap: 8px;
    `;
    footer.innerHTML = `
        <span>📖 Иваново RPG · Справочник</span>
        <span>${isMenuMode ? '📚 Выбери раздел в меню' : `${section?.icon} ${section?.title || ''}`}</span>
    `;
    container.appendChild(footer);

    modal.innerHTML = '';
    modal.appendChild(container);

    // ===== ОБРАБОТЧИКИ =====
    const closeBtn = container.querySelector('#handbookCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeHandbook);
    }

    const menuBtn = container.querySelector('#handbookMenuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            isMenuMode = !isMenuMode;
            render();
        });
    }
}

// ========== ДОБАВЛЯЕМ СТИЛИ ДЛЯ КОНТЕНТА ==========
if (!document.getElementById('handbookStyles')) {
    const style = document.createElement('style');
    style.id = 'handbookStyles';
    style.textContent = `
        .handbook-content h2 {
            color: #ffd966;
            font-size: 1.3rem;
            margin: 16px 0 8px 0;
        }
        .handbook-content h3 {
            color: #ffd966;
            font-size: 1.1rem;
            margin: 14px 0 6px 0;
        }
        .handbook-content p {
            margin: 6px 0;
            color: var(--text-primary, #e0e0e0);
        }
        .handbook-content strong {
            color: #ffd966;
        }
        .handbook-content .highlight {
            background: rgba(255,215,0,0.1);
            padding: 2px 8px;
            border-radius: 6px;
        }
        .handbook-content ul {
            margin: 6px 0;
            padding-left: 20px;
        }
        .handbook-content li {
            margin: 4px 0;
        }
        .handbook-content .emoji-big {
            font-size: 2rem;
            text-align: center;
            display: block;
            margin: 10px 0;
        }
    `;
    document.head.appendChild(style);
}
