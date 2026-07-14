// js/elections.js
import { db } from './firestore.js';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, runTransaction } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';

// ========== ПРОВЕРКА ПЕРИОДА ВЫБОРОВ ==========

// Выборы проходят с 1 по 5 число каждого месяца
export function isElectionPeriod() {
    const now = new Date();
    const day = now.getDate();
    return day >= 1 && day <= 5;
}

// День завершения выборов (6-е число)
export function isElectionEnd() {
    const now = new Date();
    const day = now.getDate();
    return day === 6;
}

// День сброса (1-е число) — сбрасываем голоса и проверяем мандаты
export function isResetDay() {
    const now = new Date();
    const day = now.getDate();
    return day === 1;
}

// Получить месяц и год выборов (для отображения)
export function getElectionPeriod() {
    const now = new Date();
    const month = now.toLocaleString('ru', { month: 'long' });
    const year = now.getFullYear();
    return `${month} ${year}`;
}

// ========== УПРАВЛЕНИЕ КАНДИДАТАМИ ==========

// Получить всех кандидатов (с сортировкой по голосам)
export async function getCandidates() {
    try {
        const snapshot = await getDocs(collection(db, 'candidates'));
        const candidates = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            candidates.push({
                uid: doc.id,
                displayName: data.displayName || 'Аноним',
                slogan: data.slogan || 'Без лозунга',
                votes: data.votes || 0,
                voters: data.voters || [],
                registeredAt: data.registeredAt || null
            });
        });
        // Сортируем по голосам (от большего к меньшему)
        return candidates.sort((a, b) => b.votes - a.votes);
    } catch (error) {
        console.error('Ошибка загрузки кандидатов:', error);
        return [];
    }
}

// Проверить, зарегистрирован ли игрок как кандидат
export async function isCandidate(uid) {
    try {
        const docRef = doc(db, 'candidates', uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error('Ошибка проверки кандидата:', error);
        return false;
    }
}

// Зарегистрироваться как кандидат
export async function registerAsCandidate(uid, displayName) {
    // Проверяем, идут ли выборы
    if (!isElectionPeriod()) {
        throw new Error('Выборы не идут! Ждите 1-5 числа.');
    }
    
    // Проверяем, не зарегистрирован ли уже
    const candidateRef = doc(db, 'candidates', uid);
    const candidateSnap = await getDoc(candidateRef);
    if (candidateSnap.exists()) {
        throw new Error('Вы уже зарегистрированы как кандидат!');
    }
    
    // Создаём кандидата
    await setDoc(candidateRef, {
        uid: uid,
        displayName: displayName || 'Аноним',
        slogan: 'Мой город — моя помойка! 🗑️',
        votes: 0,
        voters: [],
        registeredAt: new Date().toISOString()
    });
    
    console.log(`🗳️ Кандидат зарегистрирован: ${displayName}`);
    return true;
}

// Сохранить/обновить лозунг кандидата
export async function saveSlogan(uid, slogan) {
    if (!slogan || slogan.trim().length === 0) {
        throw new Error('Лозунг не может быть пустым');
    }
    if (slogan.length > 200) {
        throw new Error('Лозунг не может быть длиннее 200 символов');
    }
    
    const candidateRef = doc(db, 'candidates', uid);
    const candidateSnap = await getDoc(candidateRef);
    
    if (!candidateSnap.exists()) {
        throw new Error('Вы не зарегистрированы как кандидат!');
    }
    
    await updateDoc(candidateRef, {
        slogan: slogan.trim()
    });
    
    console.log(`📝 Лозунг обновлён: "${slogan}"`);
    return true;
}

// ========== ГОЛОСОВАНИЕ ==========

// Проголосовать за кандидата
export async function voteForCandidate(voterId, voterName, candidateId) {
    // Проверяем, идут ли выборы
    if (!isElectionPeriod()) {
        throw new Error('Выборы не идут! Голосование доступно только с 1 по 5 число.');
    }
    
    if (voterId === candidateId) {
        throw new Error('Нельзя голосовать за себя!');
    }
    
    // Проверяем, существует ли кандидат
    const candidateRef = doc(db, 'candidates', candidateId);
    const candidateSnap = await getDoc(candidateRef);
    if (!candidateSnap.exists()) {
        throw new Error('Кандидат не найден');
    }
    
    const candidateData = candidateSnap.data();
    const voters = candidateData.voters || [];
    
    // Проверяем, не голосовал ли уже этот игрок
    if (voters.includes(voterId)) {
        throw new Error('Вы уже проголосовали в этом месяце!');
    }
    
    // Проверяем, не голосовал ли игрок за другого кандидата
    const allCandidates = await getCandidates();
    for (const cand of allCandidates) {
        if (cand.voters && cand.voters.includes(voterId)) {
            throw new Error('Вы уже проголосовали за другого кандидата!');
        }
    }
    
    // Добавляем голос
    await runTransaction(db, async (transaction) => {
        const freshSnap = await transaction.get(candidateRef);
        const freshData = freshSnap.data();
        const currentVoters = freshData.voters || [];
        const currentVotes = freshData.votes || 0;
        
        transaction.update(candidateRef, {
            votes: currentVotes + 1,
            voters: [...currentVoters, voterId]
        });
    });
    
    console.log(`🗳️ Голос отдан: ${voterName} → ${candidateData.displayName}`);
    return true;
}

// Проверить, голосовал ли уже игрок
export async function hasVoted(voterId) {
    try {
        const candidates = await getCandidates();
        for (const candidate of candidates) {
            if (candidate.voters && candidate.voters.includes(voterId)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Ошибка проверки голоса:', error);
        return false;
    }
}

// Получить кандидата, за которого проголосовал игрок
export async function getVotedFor(voterId) {
    try {
        const candidates = await getCandidates();
        for (const candidate of candidates) {
            if (candidate.voters && candidate.voters.includes(voterId)) {
                return candidate;
            }
        }
        return null;
    } catch (error) {
        console.error('Ошибка получения голоса:', error);
        return null;
    }
}

// ========== ЗАВЕРШЕНИЕ ВЫБОРОВ ==========

// Завершить выборы (6-е число)
export async function finishElections() {
    try {
        const candidates = await getCandidates();
        const sorted = candidates.sort((a, b) => b.votes - a.votes);
        const winners = sorted.slice(0, 10);
        
        console.log(`🏛️ Победители выборов (топ-${winners.length}):`);
        winners.forEach((w, i) => {
            console.log(`   ${i+1}. ${w.displayName} — ${w.votes} голосов`);
        });
        
        // Выдаём мандаты победителям
        const { assignMandate, resetAllMandates } = await import('./mandates.js');
        
        // Сначала сбрасываем все мандаты
        await resetAllMandates();
        
        // Затем выдаём победителям
        for (let i = 0; i < winners.length; i++) {
            const mandateNumber = i + 1;
            await assignMandate(mandateNumber, winners[i].uid, winners[i].displayName, 'elected');
        }
        
        // Очищаем кандидатов (или оставляем для истории)
        await clearCandidates();
        
        return winners;
    } catch (error) {
        console.error('Ошибка завершения выборов:', error);
        throw error;
    }
}

// Очистить всех кандидатов (после выборов)
export async function clearCandidates() {
    try {
        const snapshot = await getDocs(collection(db, 'candidates'));
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log('🗑️ Кандидаты очищены');
    } catch (error) {
        console.error('Ошибка очистки кандидатов:', error);
    }
}

// Сбросить голоса у кандидатов (но оставить их)
export async function resetVotes() {
    try {
        const snapshot = await getDocs(collection(db, 'candidates'));
        const updatePromises = snapshot.docs.map(doc => 
            updateDoc(doc.ref, { votes: 0, voters: [] })
        );
        await Promise.all(updatePromises);
        console.log('🔄 Голоса сброшены');
    } catch (error) {
        console.error('Ошибка сброса голосов:', error);
    }
}

// ========== ПОЛУЧИТЬ СТАТИСТИКУ ВЫБОРОВ ==========

export async function getElectionStats() {
    const candidates = await getCandidates();
    const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
    const registered = candidates.length;
    
    return {
        totalVotes,
        registeredCandidates: registered,
        candidates: candidates,
        isActive: isElectionPeriod()
    };
}
