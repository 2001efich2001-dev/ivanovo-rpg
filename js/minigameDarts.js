// js/minigameDarts.js
import { showMessage } from './utils.js';
import { saveGameData } from './firestore.js';
import { spendEnergy, addExperience, updateUI, addLogEntry, setStats, money, intoxication, hasEnoughEnergy } from './gameState.js';

let dartsModal = null;
let dartsIframe = null;
let isDartsOpen = false;

// ========== ОТКРЫТЬ МИНИ-ИГРУ ==========
export async function openDartsGame() {
    const gameState = await import('./gameState.js');
    
    // ПРОВЕРКА: нужна энергия
    if (!gameState.hasEnoughEnergy(10)) {
        showMessage("❌ Не хватает энергии! Нужно 10⚡", "#e74c3c");
        return;
    }
    
    // ПРОВЕРКА: опьянение должно быть не менее 20%
    if (gameState.intoxication < 20) {
        showMessage("🍺 Бармен не даёт дротики трезвым! Выпей сначала! (нужно 20% опьянения)", "#ffd966");
        return;
    }
    
    // Если окно уже открыто — не открываем новое
    if (isDartsOpen) {
        console.log('Окно дротиков уже открыто');
        return;
    }
    
    gameState.spendEnergy(10);
    isDartsOpen = true;
    
    if (dartsModal) {
        dartsModal.remove();
        dartsModal = null;
    }
    
    dartsModal = document.createElement('div');
    dartsModal.id = 'dartsGameModal';
    dartsModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        z-index: 20000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(5px);
    `;
    
    dartsIframe = document.createElement('iframe');
    dartsIframe.src = '/darts-game.html';
    dartsIframe.style.cssText = `
        width: 100%;
        height: 100%;
        max-width: 900px;
        max-height: 750px;
        border: none;
        border-radius: 28px;
        box-shadow: 0 0 30px rgba(0,0,0,0.5);
    `;
    
    dartsModal.appendChild(dartsIframe);
    document.body.appendChild(dartsModal);
    
    dartsIframe.onload = () => {
        const iframeWindow = dartsIframe.contentWindow;
        if (iframeWindow && iframeWindow.setDartsCallbacks) {
            iframeWindow.setDartsCallbacks(
                (isSuccess, rewardMoney, rewardExp) => {
                    if (rewardMoney > 0) {
                        const newMoney = gameState.money + rewardMoney;
                        gameState.setStats(null, null, null, newMoney);
                        showMessage(`🎯 Вы выиграли ${rewardMoney}₽!`, "#4caf50");
                    }
                    if (rewardExp !== 0) {
                        if (rewardExp > 0) {
                            gameState.addExperience(rewardExp);
                            showMessage(`⭐ +${rewardExp} опыта!`, "#4caf50");
                        } else if (rewardExp < 0) {
                            showMessage(`💀 -${Math.abs(rewardExp)} опыта... Позор!`, "#e74c3c");
                        }
                    }
                    gameState.updateUI();
                    saveGameData();
                    addLogEntry(`🎯 Игра в дротики: ${currentScore} очков, награда: ${rewardMoney}₽, опыт: ${rewardExp}`, 'item');
                },
                gameState.intoxication,
                gameState.money
            );
        }
    };
    
    // Слушаем событие закрытия из iframe
    window.addEventListener('message', function onMessage(event) {
        if (event.data === 'closeDartsGame') {
            closeDartsGame();
            window.removeEventListener('message', onMessage);
        }
    });
    
    const closeHandler = (e) => {
        if (e.key === 'Escape') {
            closeDartsGame();
        }
    };
    window.addEventListener('keydown', closeHandler);
    dartsModal._closeHandler = closeHandler;
}

function closeDartsGame() {
    if (dartsModal) {
        if (dartsModal._closeHandler) {
            window.removeEventListener('keydown', dartsModal._closeHandler);
        }
        dartsModal.remove();
        dartsModal = null;
        dartsIframe = null;
    }
    isDartsOpen = false;
}
