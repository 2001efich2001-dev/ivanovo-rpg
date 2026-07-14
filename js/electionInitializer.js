// js/electionInitializer.js
import { checkElectionsOnLogin } from './electionNotification.js';
import { isElectionPeriod, isElectionEnd, isResetDay } from './elections.js';

// ========== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ВЫБОРОВ ==========
export async function initElectionSystem() {
    try {
        console.log('🗳️ Инициализация системы выборов...');
        await checkElectionsOnLogin();
        console.log('✅ Система выборов инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации выборов:', error);
    }
}

// ========== ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ МЕСТАХ ==========
export { isElectionPeriod, isElectionEnd, isResetDay };
