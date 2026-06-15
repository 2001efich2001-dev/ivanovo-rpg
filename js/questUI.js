// js/questUI.js
import { getAvailableQuests, getCompletedQuests, updateQuestProgress } from './questSystem.js';
import { questsDB } from './quests.js';
import { showMessage } from './utils.js';

// ========== ОТКРЫТЬ МОДАЛЬНОЕ ОКНО КВЕСТОВ ==========
export async function openQuestsModal() {
    const modal = document.getElementById('questsModal');
    if (!modal) {
        console.error('Модальное окно квестов не найдено');
        return;
    }
    
    modal.style.display = 'flex';
    await renderQuestsPanel();
}

// ========== РЕНДЕР ПАНЕЛИ КВЕСТОВ ==========
export async function renderQuestsPanel() {
    const container = document.getElementById('questsList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:20px;">📜 Загрузка квестов...</div>';
    
    try {
        const { static: staticQuests, daily: dailyQuests, race: raceQuests, completed, dailyProgress } = await getAvailableQuests();
        const completedQuests = await getCompletedQuests();
        
        let html = `
            <div class="quests-tabs">
                <button class="quest-tab-btn active" data-tab="active">📋 Активные</button>
                <button class="quest-tab-btn" data-tab="daily">🔄 Ежедневные</button>
                <button class="quest-tab-btn" data-tab="race">🏆 Расовые</button>
                <button class="quest-tab-btn" data-tab="completed">✅ Выполненные</button>
            </div>
            <div id="questsTabContent" class="quests-tab-content">
                ${renderActiveQuests(staticQuests, dailyQuests, raceQuests, dailyProgress)}
            </div>
        `;
        
        container.innerHTML = html;
        
        // Добавляем обработчики для вкладок
        document.querySelectorAll('.quest-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quest-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const tab = btn.dataset.tab;
                let content = '';
                
                if (tab === 'active') {
                    content = renderActiveQuests(staticQuests, dailyQuests, raceQuests, dailyProgress);
                } else if (tab === 'daily') {
                    content = renderDailyQuests(dailyQuests, dailyProgress);
                } else if (tab === 'race') {
                    content = renderRaceQuests(raceQuests);
                } else if (tab === 'completed') {
                    content = renderCompletedQuests(completedQuests);
                }
                
                document.getElementById('questsTabContent').innerHTML = content;
            });
        });
        
    } catch (error) {
        console.error('Ошибка загрузки квестов:', error);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#e74c3c;">❌ Ошибка загрузки квестов</div>';
    }
}

// ========== РЕНДЕР АКТИВНЫХ КВЕСТОВ ==========
function renderActiveQuests(staticQuests, dailyQuests, raceQuests, dailyProgress) {
    if (staticQuests.length === 0 && dailyQuests.length === 0 && raceQuests.length === 0) {
        return '<div class="empty-quests">🎉 Все квесты выполнены! Загляните завтра за новыми!</div>';
    }
    
    let html = '<div class="quests-grid">';
    
    // Статические квесты
    for (const quest of staticQuests) {
        html += renderQuestCard(quest, 'static', null);
    }
    
    // Ежедневные квесты
    for (const quest of dailyQuests) {
        const progress = dailyProgress[quest.id]?.progress || 0;
        html += renderQuestCard(quest, 'daily', progress);
    }
    
    // Расовые квесты
    for (const quest of raceQuests) {
        html += renderQuestCard(quest, 'race', null);
    }
    
    html += '</div>';
    return html;
}

// ========== РЕНДЕР ЕЖЕДНЕВНЫХ КВЕСТОВ (отдельная вкладка) ==========
function renderDailyQuests(dailyQuests, dailyProgress) {
    if (dailyQuests.length === 0) {
        return '<div class="empty-quests">🎉 Все ежедневные квесты выполнены! Завтра будут новые!</div>';
    }
    
    let html = '<div class="quests-grid">';
    
    for (const quest of dailyQuests) {
        const progress = dailyProgress[quest.id]?.progress || 0;
        html += renderQuestCard(quest, 'daily', progress);
    }
    
    html += '</div>';
    return html;
}

// ========== РЕНДЕР РАСОВЫХ КВЕСТОВ ==========
function renderRaceQuests(raceQuests) {
    if (raceQuests.length === 0) {
        return '<div class="empty-quests">🏆 Все расовые квесты уже имеют победителей! Следите за новыми!</div>';
    }
    
    let html = '<div class="quests-grid">';
    
    for (const quest of raceQuests) {
        html += renderQuestCard(quest, 'race', null);
    }
    
    html += '</div>';
    return html;
}

// ========== РЕНДЕР ВЫПОЛНЕННЫХ КВЕСТОВ ==========
function renderCompletedQuests(completedQuests) {
    if (completedQuests.length === 0) {
        return '<div class="empty-quests">📜 Пока нет выполненных квестов</div>';
    }
    
    let html = '<div class="quests-grid completed-grid">';
    
    for (const quest of completedQuests) {
        html += `
            <div class="quest-card completed" data-quest-id="${quest.id}">
                <div class="quest-card-icon">${quest.icon || '✅'}</div>
                <div class="quest-card-info">
                    <div class="quest-card-name">${quest.name}</div>
                    <div class="quest-card-desc">${quest.description}</div>
                    <div class="quest-card-rewards">
                        ${renderRewards(quest.rewards)}
                    </div>
                </div>
                <div class="quest-card-status completed-status">✅ Выполнен</div>
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// ========== РЕНДЕР КАРТОЧКИ КВЕСТА ==========
function renderQuestCard(quest, type, progress) {
    const requirement = quest.requirements;
    let progressText = '';
    let progressPercent = 0;
    
    if (type === 'daily' && progress !== null) {
        progressPercent = (progress / requirement.count) * 100;
        progressText = `
            <div class="quest-progress-bar">
                <div class="quest-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="quest-progress-text">${progress} / ${requirement.count}</div>
        `;
    }
    
    let typeBadge = '';
    if (type === 'daily') typeBadge = '<span class="quest-type-badge daily">🔄 Ежедневный</span>';
    if (type === 'race') typeBadge = '<span class="quest-type-badge race">🏆 Расовый</span>';
    if (type === 'static') typeBadge = '<span class="quest-type-badge static">📜 Сюжетный</span>';
    
    return `
        <div class="quest-card ${type}" data-quest-id="${quest.id}">
            ${typeBadge}
            <div class="quest-card-icon">${quest.icon || '📜'}</div>
            <div class="quest-card-info">
                <div class="quest-card-name">${quest.name}</div>
                <div class="quest-card-desc">${quest.description}</div>
                ${progressText}
                <div class="quest-card-rewards">
                    ${renderRewards(quest.rewards)}
                </div>
            </div>
        </div>
    `;
}

// ========== РЕНДЕР НАГРАД ==========
function renderRewards(rewards) {
    let html = '<div class="rewards-list">';
    
    if (rewards.money) {
        html += `<span class="reward-item" title="Деньги">💰 ${rewards.money.toLocaleString()}₽</span>`;
    }
    if (rewards.exp) {
        html += `<span class="reward-item" title="Опыт">⭐ +${rewards.exp}</span>`;
    }
    if (rewards.health) {
        html += `<span class="reward-item" title="Здоровье">❤️ +${rewards.health}</span>`;
    }
    if (rewards.item) {
        const itemName = getItemName(rewards.item);
        html += `<span class="reward-item" title="Предмет">🎁 ${itemName}</span>`;
    }
    if (rewards.title) {
        html += `<span class="reward-item" title="Титул">🏷️ ${rewards.title}</span>`;
    }
    
    html += '</div>';
    return html;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getItemName(itemId) {
    const itemsMap = {
        'fishing_rod': 'Удочка',
        'golden_dart': 'Золотой дротик',
        'brass_knuckles': 'Кастет',
        'old_boot': 'Старый ботинок',
        'holy_cross': 'Святой крест',
        'champion_dart': 'Чемпионский дротик'
    };
    return itemsMap[itemId] || itemId;
}

// ========== ИНИЦИАЛИЗАЦИЯ КНОПКИ КВЕСТОВ В МЕНЮ ==========
export function initQuestsButton() {
    const questsBtn = document.getElementById('questsBtn');
    if (questsBtn) {
        questsBtn.addEventListener('click', () => {
            if (typeof window.playClickSound === 'function') window.playClickSound();
            openQuestsModal();
        });
    }
}
