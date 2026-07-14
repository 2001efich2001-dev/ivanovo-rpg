// js/administrationUI.js
import { auth } from './auth.js';
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { money, setStats, updateUI } from './gameState.js';
import { 
    getAllMandates, 
    getActiveDeputies, 
    getDeputyBoard, 
    purchaseMandate,
    isDeputy 
} from './mandates.js';
import { 
    getCandidates, 
    isCandidate, 
    registerAsCandidate, 
    saveSlogan, 
    voteForCandidate, 
    hasVoted, 
    getVotedFor,
    isElectionPeriod,
    getElectionPeriod,
    getElectionStats
} from './elections.js';

// ========== ОТКРЫТЬ АДМИНИСТРАЦИЮ ==========
export async function openAdministrationModal() {
    const modal = document.getElementById('administrationModal');
    if (!modal) {
        console.error('Модальное окно администрации не найдено');
        showMessage('❌ Система администрации временно недоступна', '#e74c3c');
        return;
    }
    
    modal.style.display = 'flex';
    
    // По умолчанию показываем вкладку "Депутаты"
    await renderDeputiesTab();
    
    // Настраиваем переключение вкладок
    setupTabs();
    
    // Настраиваем обработчики кнопок
    setupHandlers();
}

// ========== НАСТРОЙКА ВКЛАДОК ==========
function setupTabs() {
    const tabs = document.querySelectorAll('#administrationModal .tab-btn');
    const contents = {
        deputies: document.getElementById('deputiesTab'),
        candidates: document.getElementById('candidatesTab'),
        buy: document.getElementById('buyTab'),
        vote: document.getElementById('voteTab')
    };
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', tab._handler);
        const handler = async () => {
            // Снимаем активность со всех вкладок
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Скрываем все содержимое
            Object.values(contents).forEach(c => c.style.display = 'none');
            
            // Показываем нужное
            const tabName = tab.dataset.tab;
            if (contents[tabName]) {
                contents[tabName].style.display = 'block';
                
                // Рендерим содержимое вкладки
                switch (tabName) {
                    case 'deputies':
                        await renderDeputiesTab();
                        break;
                    case 'candidates':
                        await renderCandidatesTab();
                        break;
                    case 'buy':
                        await renderBuyTab();
                        break;
                    case 'vote':
                        await renderVoteTab();
                        break;
                }
            }
        };
        tab.addEventListener('click', handler);
        tab._handler = handler;
    });
}

// ========== НАСТРОЙКА ОБРАБОТЧИКОВ ==========
function setupHandlers() {
    // Кнопка "Выдвинуться на выборы"
    const registerBtn = document.getElementById('registerCandidateBtn');
    if (registerBtn) {
        registerBtn.removeEventListener('click', registerBtn._handler);
        registerBtn.addEventListener('click', async () => {
            await handleRegisterCandidate();
        });
        registerBtn._handler = registerBtn._handler || (() => {});
    }
    
    // Кнопка "Сохранить лозунг"
    const sloganBtn = document.getElementById('saveSloganBtn');
    if (sloganBtn) {
        sloganBtn.removeEventListener('click', sloganBtn._handler);
        sloganBtn.addEventListener('click', async () => {
            await handleSaveSlogan();
        });
        sloganBtn._handler = sloganBtn._handler || (() => {});
    }
    
    // Закрытие модального окна
    const closeBtns = document.querySelectorAll('#administrationModal .close-modal');
    closeBtns.forEach(btn => {
        btn.removeEventListener('click', btn._closeHandler);
        btn.addEventListener('click', () => {
            document.getElementById('administrationModal').style.display = 'none';
        });
        btn._closeHandler = btn._closeHandler || (() => {});
    });
    
    // Закрытие по клику вне окна
    const modal = document.getElementById('administrationModal');
    modal.removeEventListener('click', modal._outsideHandler);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    modal._outsideHandler = modal._outsideHandler || (() => {});
}

// ========== ВКЛАДКА "ДЕПУТАТЫ" ==========
async function renderDeputiesTab() {
    const container = document.getElementById('deputiesTab');
    if (!container) return;
    
    const board = await getDeputyBoard();
    const user = auth.currentUser;
    const isUserDeputy = user ? await isDeputy(user.uid) : false;
    
    let html = `
        <div style="margin-bottom: 12px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
            🏛️ Городская дума — ${board.length} мест
            ${isUserDeputy ? ' | 👑 Вы депутат!' : ''}
        </div>
        <div style="display: grid; grid-template-columns: 60px 1fr 1fr 80px; gap: 4px; padding: 8px; background: var(--stat-bg); border-radius: 8px; margin-bottom: 8px; font-weight: bold; font-size: 0.85rem;">
            <span>№</span>
            <span>Владелец</span>
            <span>Тип</span>
            <span>Статус</span>
        </div>
    `;
    
    for (const seat of board) {
        const isOwn = seat.ownerId === user?.uid;
        const statusColor = seat.isOccupied ? '#4caf50' : '#666';
        const statusText = seat.isOccupied ? '✅ Занят' : '📭 Вакантно';
        
        html += `
            <div style="display: grid; grid-template-columns: 60px 1fr 1fr 80px; gap: 4px; padding: 6px 8px; background: ${isOwn ? 'rgba(255,215,0,0.1)' : 'var(--card-bg)'}; border-radius: 4px; ${isOwn ? 'border-left: 3px solid #ffd966;' : ''}">
                <span style="font-weight: bold; color: var(--accent-gold);">${seat.number}</span>
                <span style="color: ${isOwn ? '#ffd966' : 'var(--text-color)'};">
                    ${seat.isOccupied ? (isOwn ? '⭐ ' : '') + (seat.ownerName || 'Аноним') : '—'}
                </span>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">
                    ${seat.isOccupied ? (seat.type === 'elected' ? '🗳️ Выборный' : '💳 Покупной') : '—'}
                </span>
                <span style="color: ${statusColor}; font-size: 0.85rem;">${statusText}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ========== ВКЛАДКА "КАНДИДАТЫ" ==========
async function renderCandidatesTab() {
    const container = document.getElementById('candidatesTab');
    if (!container) return;
    
    const user = auth.currentUser;
    const candidates = await getCandidates();
    const isElectionActive = isElectionPeriod();
    const isUserCandidate = user ? await isCandidate(user.uid) : false;
    const userSlogan = isUserCandidate ? candidates.find(c => c.uid === user.uid)?.slogan : '';
    
    let html = `
        <div style="margin-bottom: 12px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
            ${isElectionActive ? '🗳️ Выборы идут! (1-5 число)' : '⏳ Выборы не идут (ждут 1-5 число)'}
            ${isUserCandidate ? ' | ✅ Вы кандидат!' : ''}
        </div>
    `;
    
    // Форма для лозунга (если пользователь кандидат)
    if (isUserCandidate) {
        html += `
            <div style="margin-bottom: 12px; padding: 12px; background: var(--stat-bg); border-radius: 8px;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <input type="text" id="sloganInput" value="${escapeHtml(userSlogan || '')}" placeholder="Ваш лозунг..." maxlength="200" style="
                        flex: 1;
                        min-width: 200px;
                        padding: 8px 14px;
                        border-radius: 40px;
                        border: 1px solid var(--card-border);
                        background: var(--input-bg);
                        color: var(--text-color);
                    ">
                    <button id="saveSloganBtn" class="action-btn" style="padding: 8px 20px;">💾 Сохранить</button>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">
                    ⚡ Лозунг будет виден всем игрокам при голосовании
                </div>
            </div>
        `;
    }
    
    // Список кандидатов
    if (candidates.length === 0) {
        html += `
            <div style="text-align:center; padding:20px; color:var(--text-secondary);">
                📭 Пока нет кандидатов
                ${isElectionActive ? ' — стань первым!' : ''}
            </div>
        `;
    } else {
        html += `
            <div style="display: grid; gap: 6px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 2fr 60px; gap: 6px; padding: 6px 8px; background: var(--stat-bg); border-radius: 8px; font-weight: bold; font-size: 0.85rem;">
                    <span>👤 Игрок</span>
                    <span>📝 Лозунг</span>
                    <span>🗳️ Голосов</span>
                </div>
        `;
        
        for (const candidate of candidates) {
            const isOwn = candidate.uid === user?.uid;
            html += `
                <div style="display: grid; grid-template-columns: 1fr 2fr 60px; gap: 6px; padding: 6px 8px; background: ${isOwn ? 'rgba(255,215,0,0.1)' : 'var(--card-bg)'}; border-radius: 4px; ${isOwn ? 'border-left: 3px solid #ffd966;' : ''}">
                    <span style="font-weight: ${isOwn ? 'bold' : 'normal'}; color: ${isOwn ? '#ffd966' : 'var(--text-color)'}">
                        ${isOwn ? '⭐ ' : ''}${escapeHtml(candidate.displayName)}
                    </span>
                    <span style="font-style: italic; color: var(--text-secondary); font-size: 0.9rem; word-break: break-word;">
                        «${escapeHtml(candidate.slogan)}»
                    </span>
                    <span style="font-weight: bold; color: ${candidate.votes > 0 ? '#4caf50' : 'var(--text-secondary)'};">
                        ${candidate.votes}
                    </span>
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    // Кнопка выдвижения (только если выборы идут и пользователь не кандидат)
    if (isElectionActive && !isUserCandidate && user) {
        html += `
            <div style="margin-top: 12px; text-align: center;">
                <button id="registerCandidateBtn" class="action-btn" style="background: #2196F3; padding: 10px 30px;">
                    🗳️ Выдвинуться на выборы
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Перепривязываем обработчики
    setupHandlers();
}

// ========== ВКЛАДКА "КУПИТЬ МАНДАТ" ==========
async function renderBuyTab() {
    const container = document.getElementById('buyTab');
    if (!container) return;
    
    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">🔒 Авторизуйтесь, чтобы покупать мандаты</div>';
        return;
    }
    
    const board = await getDeputyBoard();
    const purchasable = board.filter(s => s.isPurchasable && !s.isOccupied);
    const userMandates = await import('./mandates.js').then(m => m.getPlayerMandates(user.uid));
    const hasMandate = userMandates.length > 0;
    
    if (hasMandate) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-secondary);">
                👑 У вас уже есть мандат! Один игрок может иметь только один мандат.
            </div>
        `;
        return;
    }
    
    if (purchasable.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-secondary);">
                💳 Все покупные мандаты (11-20) уже заняты.
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="margin-bottom: 12px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
            💳 Купить мандат депутата — 1 000 000₽
        </div>
        <div style="display: grid; gap: 8px;">
    `;
    
    for (const seat of purchasable) {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: var(--card-bg); border-radius: 8px; border-left: 3px solid #ffd966;">
                <div>
                    <span style="font-weight: bold; color: var(--accent-gold);">№${seat.number}</span>
                    <span style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 12px;">💳 Покупной</span>
                </div>
                <button class="buy-mandate-btn" data-number="${seat.number}" style="
                    background: var(--buy-btn-bg);
                    border: none;
                    padding: 6px 20px;
                    border-radius: 40px;
                    color: white;
                    cursor: pointer;
                    font-weight: bold;
                    transition: 0.2s;
                ">💰 Купить</button>
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Обработчики для кнопок покупки
    document.querySelectorAll('.buy-mandate-btn').forEach(btn => {
        btn.removeEventListener('click', btn._buyHandler);
        btn.addEventListener('click', async () => {
            const number = parseInt(btn.dataset.number);
            await handleBuyMandate(number);
        });
        btn._buyHandler = btn._buyHandler || (() => {});
    });
}

// ========== ВКЛАДКА "ГОЛОСОВАНИЕ" ==========
async function renderVoteTab() {
    const container = document.getElementById('voteTab');
    if (!container) return;
    
    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">🔒 Авторизуйтесь, чтобы голосовать</div>';
        return;
    }
    
    const isElectionActive = isElectionPeriod();
    const candidates = await getCandidates();
    const hasVotedAlready = await hasVoted(user.uid);
    const votedFor = await getVotedFor(user.uid);
    const isUserCandidate = await isCandidate(user.uid);
    
    if (!isElectionActive) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-secondary);">
                ⏳ Выборы не идут. Голосование доступно с 1 по 5 число каждого месяца.
            </div>
        `;
        return;
    }
    
    if (hasVotedAlready) {
        const candidateName = votedFor?.displayName || 'неизвестный кандидат';
        container.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size: 2rem; margin-bottom: 12px;">✅</div>
                <div style="color: var(--text-primary); font-size: 1.1rem; font-weight: bold;">Вы уже проголосовали!</div>
                <div style="color: var(--text-secondary); margin-top: 8px;">За кандидата: <strong>${escapeHtml(candidateName)}</strong></div>
            </div>
        `;
        return;
    }
    
    if (isUserCandidate) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size: 2rem; margin-bottom: 12px;">🗳️</div>
                <div style="color: var(--text-primary); font-size: 1.1rem; font-weight: bold;">Вы кандидат!</div>
                <div style="color: var(--text-secondary); margin-top: 8px;">Вы не можете голосовать за себя.</div>
            </div>
        `;
        return;
    }
    
    if (candidates.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-secondary);">
                📭 Пока нет кандидатов. Приходите позже!
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="margin-bottom: 12px; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
            🗳️ Выберите кандидата, за которого хотите проголосовать
        </div>
        <div style="display: grid; gap: 6px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
    `;
    
    for (const candidate of candidates) {
        if (candidate.uid === user.uid) continue; // Не показываем себя
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--card-bg); border-radius: 8px;">
                <div>
                    <div style="font-weight: bold;">${escapeHtml(candidate.displayName)}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">
                        «${escapeHtml(candidate.slogan)}»
                    </div>
                </div>
                <button class="vote-btn" data-candidate="${candidate.uid}" style="
                    background: #2196F3;
                    border: none;
                    padding: 6px 20px;
                    border-radius: 40px;
                    color: white;
                    cursor: pointer;
                    font-weight: bold;
                    transition: 0.2s;
                ">🗳️ Голосовать</button>
            </div>
        `;
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Обработчики для кнопок голосования
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.removeEventListener('click', btn._voteHandler);
        btn.addEventListener('click', async () => {
            const candidateId = btn.dataset.candidate;
            await handleVote(candidateId);
        });
        btn._voteHandler = btn._voteHandler || (() => {});
    });
}

// ========== ОБРАБОТЧИКИ ДЕЙСТВИЙ ==========

// Выдвинуться на выборы
async function handleRegisterCandidate() {
    const user = auth.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return;
    }
    
    try {
        await registerAsCandidate(user.uid, user.displayName);
        showMessage('✅ Вы успешно выдвинулись на выборы!', '#4caf50');
        await renderCandidatesTab();
    } catch (error) {
        showMessage(`❌ ${error.message}`, '#e74c3c');
    }
}

// Сохранить лозунг
async function handleSaveSlogan() {
    const user = auth.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return;
    }
    
    const input = document.getElementById('sloganInput');
    if (!input) return;
    
    const slogan = input.value.trim();
    if (!slogan) {
        showMessage('❌ Лозунг не может быть пустым', '#e74c3c');
        return;
    }
    
    try {
        await saveSlogan(user.uid, slogan);
        showMessage('✅ Лозунг сохранён!', '#4caf50');
        await renderCandidatesTab();
    } catch (error) {
        showMessage(`❌ ${error.message}`, '#e74c3c');
    }
}

// Купить мандат
async function handleBuyMandate(number) {
    const user = auth.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return;
    }
    
    try {
        const gameState = await import('./gameState.js');
        await purchaseMandate(number, user.uid, user.displayName, gameState.money);
        showMessage(`✅ Мандат №${number} куплен!`, '#4caf50');
        await renderBuyTab();
        await renderDeputiesTab();
    } catch (error) {
        showMessage(`❌ ${error.message}`, '#e74c3c');
    }
}

// Проголосовать
async function handleVote(candidateId) {
    const user = auth.currentUser;
    if (!user) {
        showMessage('❌ Авторизуйтесь', '#e74c3c');
        return;
    }
    
    try {
        await voteForCandidate(user.uid, user.displayName, candidateId);
        showMessage('✅ Ваш голос учтён!', '#4caf50');
        await renderVoteTab();
    } catch (error) {
        showMessage(`❌ ${error.message}`, '#e74c3c');
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
