import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { health, hunger, cold, money, inventory, equipped, setStats, updateUI, accumulatedMinutes, currentWeather, currentTemperature, setTimeWeather, getActionLog, setActionLog } from './gameState.js';
import { showMessage } from './utils.js';

let db = null;

export function initFirestore(auth) {
    db = getFirestore(auth.app);
}

export async function saveGameData() {
    const user = window.auth?.currentUser;
    if (!user || !db) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, {
        health, hunger, cold, money, inventory, equipped,
        accumulatedMinutes,
        currentWeather,
        currentTemperature,
        actionLog: getActionLog(),
        lastUpdated: new Date().toISOString()
    }, { merge: true });
    console.log("Данные сохранены");
}

export async function loadGameData(userId) {
    if (!userId || !db) return;
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        setStats(data.health ?? 100, data.hunger ?? 100, data.cold ?? 100, data.money ?? 200);
        inventory.length = 0;
        inventory.push(...(data.inventory ?? []));
        Object.assign(equipped, data.equipped ?? { head: null, body: null, legs: null, feet: null });
        
        // Загружаем время и погоду
        const minutes = data.accumulatedMinutes ?? 0;
        const weather = data.currentWeather ?? 'sunny';
        const temp = data.currentTemperature ?? 15;
        setTimeWeather(minutes, weather, temp);
        
        // Загружаем лог действий
        setActionLog(data.actionLog ?? []);
        
        updateUI();
        console.log("Данные загружены");
    } else {
        setStats(100, 100, 100, 200);
        inventory.push(
            { id: "bread", count: 2 }, { id: "vodka", count: 1 }, { id: "cigarettes", count: 1 },
            { id: "medkit", count: 1 }, { id: "ushanka", count: 1 }, { id: "puhovik", count: 1 }
        );
        Object.assign(equipped, { head: null, body: null, legs: null, feet: null });
        // Начальное время и погода (12:00, солнечно, +15°)
        setTimeWeather(720, 'sunny', 15); // 12:00 = 720 минут
        // Начальный лог действий
        setActionLog([]);
        updateUI();
        await saveGameData();
        showMessage('Новый аккаунт создан', '#4caf50');
    }
}
