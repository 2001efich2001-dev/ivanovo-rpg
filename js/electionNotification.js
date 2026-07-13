// js/electionNotification.js
import { auth } from './auth.js';
import { showMessage, showPopupNotification } from './utils.js';
import { db } from './firestore.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import {
    isElectionPeriod,
    isElectionEnd,
    isResetDay,
    getElectionPeriod,
    finishElections,
    hasVoted,
    getCandidates
} from './elections.js';
import { resetAllMandates, getActiveDeputies } from './mandates.js';

// ========== КЛЮЧИ ДЛЯ ХРАНЕНИЯ СОСТОЯНИЯ В FIRESTORE ==========
// Будем хранить в документе пользователя поле electionState

// ========== ПРОВЕРКА ВЫБОРОВ ПРИ ВХОДЕ ==========
export async function checkElectionsOnLogin() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const now = new Date();
        const day = now.getDate();
        const month = now.getMonth();
        const year = now.getFullYear();
        const currentPeriod = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        // Загружаем состояние выборов у пользователя
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const electionState = userData.electionState || {};
        const lastNotified = electionState.lastNotified || '';
        const hasVotedThisPeriod = electionState.votedPeriod === currentPeriod;
        
        // ===== 1. ПРОВЕРКА: СБРОС МАНДАТОВ (1-е число) =====
        if (isResetDay()) {
            const lastReset = electionState.lastReset || '';
            if (lastReset !== currentPeriod) {
                console.log('🏛️ Сброс мандатов на 1-е число...');
                await resetAllMandates();
                await updateDoc(userRef, {
                    'electionState.lastReset': currentPeriod
                });
                showPopupNotification(
                    'images/events/election.png',
                    '📅 НОВЫЙ МЕСЯЦ!',
                    'Все мандаты депутатов сброшены. Выборы стартуют 1-го числа!',
                    null,
                    5000
                );
            }
        }
        
        // ===== 2. ПРОВЕРКА: ПЕРИОД ВЫБОРОВ (1-5 число) =====
        if (isElectionPeriod()) {
            // Показываем уведомление о выборах (если ещё не показывали в этом месяце)
            if (lastNotified !== currentPeriod) {
                await showElectionNotification();
                await updateDoc(userRef, {
                    'electionState.lastNotified': currentPeriod
                });
            }
            
            // Если игрок ещё не голосовал в этом месяце — дополнительное напоминание
            if (!hasVotedThisPeriod) {
                // Показываем напоминание о голосовании (если есть кандидаты)
                const candidates = await getCandidates();
                if (candidates.length > 0) {
                    setTimeout(() => {
                        showPopupNotification(
                            'images/events/election.png',
                            '🗳️ НЕ ЗАБУДЬ ПРОГОЛОСОВАТЬ!',
                            'На Площади Революции в Администрации ты можешь отдать свой голос за кандидата.\n\nВыборы проходят с 1 по 5 число!',
                            null,
                            6000
                        );
                    }, 3000);
                }
            }
        }
        
        // ===== 3. ПРОВЕРКА: ЗАВЕРШЕНИЕ ВЫБОРОВ (6-е число) =====
        if (isElectionEnd()) {
            const lastFinished = electionState.lastFinished || '';
            if (lastFinished !== currentPeriod) {
                console.log('🏛️ Завершение выборов (6-е число)...');
                const winners = await finishElections();
                await updateDoc(userRef, {
                    'electionState.lastFinished': currentPeriod
                });
                
                // Показываем уведомление о результатах
                await showElectionResults(winners);
            }
        }
        
    } catch (error) {
        console.error('Ошибка проверки выборов:', error);
    }
}

// ========== ПОКАЗАТЬ УВЕДОМЛЕНИЕ О ВЫБОРАХ ==========
export async function showElectionNotification() {
    const user = auth.currentUser;
    if (!user) return;
    
    const period = getElectionPeriod();
    const hasVotedAlready = await hasVoted(user.uid);
    const candidates = await getCandidates();
    const candidatesCount = candidates.length;
    
    if (hasVotedAlready) {
        showPopupNotification(
            'images/events/election.png',
            '🗳️ ВЫБОРЫ В ГОРОДЕ!',
            `В городе проходят выборы депутатов (${period}).\n\n✅ Вы уже проголосовали!\nСледите за результатами 6-го числа.`,
            null,
            6000
        );
    } else if (candidatesCount > 0) {
        showPopupNotification(
            'images/events/election.png',
            '🗳️ ВЫБОРЫ В ГОРОДЕ!',
            `В городе проходят выборы депутатов (${period}).\n\n📢 Зарегистрировано кандидатов: ${candidatesCount}\n\nПройдите в Администрацию на Площади Революции и отдайте свой голос!\n\n🏆 Топ-10 по голосам получат мандаты депутатов!`,
            null,
            8000
        );
    } else {
        showPopupNotification(
            'images/events/election.png',
            '🗳️ ВЫБОРЫ В ГОРОДЕ!',
            `В городе проходят выборы депутатов (${period}).\n\n📭 Пока нет кандидатов.\nВыдвигайся первым и стань депутатом!`,
            null,
            5000
        );
    }
}

// ========== ПОКАЗАТЬ РЕЗУЛЬТАТЫ ВЫБОРОВ ==========
export async function showElectionResults(winners) {
    if (!winners || winners.length === 0) {
        showPopupNotification(
            'images/events/election.png',
            '📊 ИТОГИ ВЫБОРОВ',
            'Выборы завершены.\nК сожалению, никто не проголосовал 😢',
            null,
            5000
        );
        return;
    }
    
    // Формируем список победителей
    let listHtml = winners.map((w, i) => 
        `${i+1}. ${w.displayName} — ${w.votes} голосов`
    ).join('\n');
    
    showPopupNotification(
        'images/events/election.png',
        '👑 ИТОГИ ВЫБОРОВ!',
        `Топ-10 получают мандаты депутатов:\n\n${listHtml}`,
        'sounds/win.mp3',
        8000
    );
    
    // Дополнительно показываем в логе
    console.log('🏛️ ПОБЕДИТЕЛИ ВЫБОРОВ:');
    winners.forEach((w, i) => {
        console.log(`   ${i+1}. ${w.displayName} — ${w.votes} голосов`);
    });
}

// ========== ПРОВЕРИТЬ, ПОКАЗЫВАЛОСЬ ЛИ УВЕДОМЛЕНИЕ ==========
export async function wasNotifiedThisMonth(uid) {
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const data = userSnap.data();
        const electionState = data.electionState || {};
        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return electionState.lastNotified === currentPeriod;
    } catch (error) {
        console.error('Ошибка проверки уведомления:', error);
        return false;
    }
}

// ========== ПОЛУЧИТЬ СТАТУС ВЫБОРОВ ДЛЯ UI ==========
export async function getElectionStatus() {
    const isActive = isElectionPeriod();
    const period = getElectionPeriod();
    const candidates = await getCandidates();
    const deputies = await getActiveDeputies();
    const user = auth.currentUser;
    const hasVotedAlready = user ? await hasVoted(user.uid) : false;
    
    return {
        isActive,
        period,
        candidatesCount: candidates.length,
        deputiesCount: deputies.length,
        hasVoted: hasVotedAlready,
        isElectionEnd: isElectionEnd(),
        isResetDay: isResetDay()
    };
}
