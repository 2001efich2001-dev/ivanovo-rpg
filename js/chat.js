// js/chat.js
import { doc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { db, auth } from './firestore.js';
import { showMessage } from './utils.js';

const MAX_MESSAGES = 200;
const SEND_DELAY = 1500; // 1.5 секунды для сбора сообщений

let messageQueue = [];
let sendTimeout = null;
let chatUnsubscribe = null;
let isChatOpen = false;
let lastMessageCount = 0;
let unreadCount = 0;

// ========== ИНИЦИАЛИЗАЦИЯ ЧАТА ==========
export function initChat() {
    const chatBtn = document.getElementById('chatBtn');
    const modal = document.getElementById('chatModal');
    const closeBtn = modal?.querySelector('.close-modal');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    
    if (!chatBtn || !modal) {
        console.warn('⚠️ Элементы чата не найдены');
        return;
    }
    
    // Открытие чата
    chatBtn.addEventListener('click', () => {
        if (isChatOpen) {
            closeChat();
        } else {
            openChat();
        }
    });
    
    // Закрытие
    closeBtn?.addEventListener('click', closeChat);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeChat();
    });
    
    // Отправка
    sendBtn?.addEventListener('click', () => sendMessage());
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 👇 ПОДПИСКА НА ЧАТ (ДАЖЕ КОГДА ЗАКРЫТ!)
    subscribeToChat();
}

// ========== ОТКРЫТЬ ЧАТ ==========
function openChat() {
    const modal = document.getElementById('chatModal');
    if (!modal) return;
    modal.style.display = 'flex';
    isChatOpen = true;
    unreadCount = 0;
    updateChatBadge();
    // Фокус на поле ввода
    setTimeout(() => {
        const input = document.getElementById('chatInput');
        if (input) input.focus();
    }, 300);
}

// ========== ЗАКРЫТЬ ЧАТ ==========
function closeChat() {
    const modal = document.getElementById('chatModal');
    if (modal) modal.style.display = 'none';
    isChatOpen = false;
}

// ========== ПОДПИСКА НА ОБНОВЛЕНИЯ ==========
function subscribeToChat() {
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }
    
    const chatRef = doc(db, 'chat', 'messages');
    chatUnsubscribe = onSnapshot(chatRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const messages = data.history || [];
            renderMessages(messages);
            
            // 👇 ОБНОВЛЯЕМ ИНДИКАТОР НОВЫХ СООБЩЕНИЙ
            if (!isChatOpen) {
                if (messages.length > lastMessageCount) {
                    unreadCount += (messages.length - lastMessageCount);
                    updateChatBadge();
                }
            }
            lastMessageCount = messages.length;
        } else {
            renderMessages([]);
            lastMessageCount = 0;
        }
    }, (error) => {
        console.error('Ошибка подписки на чат:', error);
        renderMessages([]);
    });
}

// ========== ОБНОВЛЕНИЕ БЕЙДЖИКА НА КНОПКЕ ==========
function updateChatBadge() {
    const chatBtn = document.getElementById('chatBtn');
    if (!chatBtn) return;
    
    // Удаляем старый бейджик
    const oldBadge = chatBtn.querySelector('.chat-badge');
    if (oldBadge) oldBadge.remove();
    
    if (unreadCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'chat-badge';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.cssText = `
            display: inline-block;
            background: #ff0000;
            color: white;
            font-size: 0.65rem;
            font-weight: bold;
            padding: 1px 6px;
            border-radius: 40px;
            margin-left: 4px;
            animation: chatPulse 0.8s ease infinite alternate;
            min-width: 18px;
            text-align: center;
            line-height: 1.4;
        `;
        chatBtn.appendChild(badge);
        
        // Добавляем анимацию, если ещё нет
        if (!document.getElementById('chatStyles')) {
            const style = document.createElement('style');
            style.id = 'chatStyles';
            style.textContent = `
                @keyframes chatPulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(1.1); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const user = auth.currentUser;
    
    if (!user) {
        showMessage('❌ Авторизуйтесь, чтобы писать в чат', '#e74c3c');
        return;
    }
    
    const text = input?.value?.trim();
    if (!text || text.length === 0) return;
    if (text.length > 200) {
        showMessage('❌ Сообщение не длиннее 200 символов!', '#e74c3c');
        return;
    }
    
    // Добавляем в очередь
    messageQueue.push({
        uid: user.uid,
        nick: user.displayName || 'Аноним',
        text: text,
        time: new Date().toISOString()
    });
    
    input.value = '';
    input.focus();
    
    // Запускаем таймер, если не запущен
    if (!sendTimeout) {
        sendTimeout = setTimeout(async () => {
            const messagesToSend = [...messageQueue];
            messageQueue = [];
            sendTimeout = null;
            await flushMessages(messagesToSend);
        }, SEND_DELAY);
    }
}

// ========== ОТПРАВКА ПАКЕТА СООБЩЕНИЙ ==========
async function flushMessages(messages) {
    if (messages.length === 0) return;
    
    const chatRef = doc(db, 'chat', 'messages');
    
    try {
        await runTransaction(db, async (transaction) => {
            const chatDoc = await transaction.get(chatRef);
            const history = chatDoc.exists() ? chatDoc.data().history : [];
            
            for (const msg of messages) {
                history.push(msg);
            }
            
            if (history.length > MAX_MESSAGES) {
                history.splice(0, history.length - MAX_MESSAGES);
            }
            
            transaction.set(chatRef, {
                history: history,
                lastUpdated: new Date().toISOString()
            });
        });
        console.log(`✅ Отправлено ${messages.length} сообщений`);
    } catch (error) {
        console.error('Ошибка отправки сообщений:', error);
        messageQueue = [...messages, ...messageQueue];
        
        if (error.message?.includes('Too many writes')) {
            showMessage('⏳ Перегрузка чата! Повторите через секунду.', '#ffd966');
        }
    }
}

// ========== РЕНДЕР СООБЩЕНИЙ ==========
function renderMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 0.9rem;">
                💬 Пока нет сообщений. Напиши первым!
            </div>
        `;
        return;
    }
    
    const user = auth.currentUser;
    const currentUid = user?.uid;
    
    let html = '';
    // Показываем последние 50 сообщений
    const showMessages = messages.slice(-50);
    
    for (const msg of showMessages) {
        const isOwn = msg.uid === currentUid;
        const time = new Date(msg.time);
        const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        html += `
            <div style="
                display: flex;
                align-items: baseline;
                gap: 8px;
                padding: 4px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                ${isOwn ? 'background: rgba(255,215,0,0.05); border-radius: 4px; padding-left: 8px;' : ''}
            ">
                <span style="
                    font-weight: bold;
                    color: ${isOwn ? 'var(--accent-gold)' : '#4fc3f7'};
                    font-size: 0.85rem;
                    min-width: 100px;
                    max-width: 120px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                ">${escapeHtml(msg.nick)}</span>
                <span style="color: var(--text-secondary); font-size: 0.7rem; min-width: 40px;">${timeStr}</span>
                <span style="
                    color: var(--text-color);
                    font-size: 0.9rem;
                    word-break: break-word;
                    flex: 1;
                ">${escapeHtml(msg.text)}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ========== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== ПРИ ВЫХОДЕ ==========
window.addEventListener('beforeunload', () => {
    if (sendTimeout) {
        clearTimeout(sendTimeout);
        sendTimeout = null;
    }
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }
});
