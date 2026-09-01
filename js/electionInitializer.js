// js/electionInitializer.js
import { checkElectionsOnLogin } from './electionNotification.js';
import { isElectionPeriod, isElectionEnd, isResetDay, finishElections, clearCandidates } from './elections.js';
import { showMessage } from './utils.js';

// ========== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ВЫБОРОВ ==========
export async function initElectionSystem() {
    try {
        console.log('🗳️ Инициализация системы выборов...');
        
        // ===== 1. Проверяем, нужно ли завершить выборы =====
        await checkAndFinishElections();
        
        // ===== 2. Проверяем уведомления =====
        await checkElectionsOnLogin();
        
        console.log('✅ Система выборов инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации выборов:', error);
    }
}

// ========== ПРОВЕРКА И ЗАВЕРШЕНИЕ ВЫБОРОВ ==========
async function checkAndFinishElections() {
    try {
        // Проверяем, наступило ли 6-е число (день завершения)
        if (isElectionEnd()) {
            console.log('📢 Обнаружено 6-е число! Завершаем выборы...');
            
            // Завершаем выборы
            const winners = await finishElections();
            
            if (winners && winners.length > 0) {
                console.log(`🏛️ Выборы завершены! Выдано ${winners.length} мандатов.`);
                showMessage(`🏛️ Выборы завершены! ${winners.length} кандидатов получили мандаты.`, '#4caf50');
            } else {
                console.log('🏛️ Выборы завершены, но победителей нет.');
                showMessage('🏛️ Выборы завершены. Победителей нет.', '#ffd966');
            }
            
            // Очищаем кандидатов (на всякий случай, если finishElections не очистила)
            await clearCandidates();
            console.log('🗑️ Кандидаты очищены после выборов.');
            
        } else if (isElectionPeriod()) {
            console.log('🗳️ Идут выборы (1-5 число).');
        } else if (isResetDay()) {
            console.log('🔄 Сегодня 1-е число. Голоса сброшены.');
            // Здесь можно добавить сброс голосов, если нужно
        } else {
            console.log('⏳ Выборы не идут.');
        }
    } catch (error) {
        console.error('❌ Ошибка при проверке завершения выборов:', error);
    }
}

// ========== ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ МЕСТАХ ==========
export { isElectionPeriod, isElectionEnd, isResetDay };
