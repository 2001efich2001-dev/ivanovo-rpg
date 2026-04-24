// js/firestore.js
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { auth } from './auth.js';
import { health, hunger, cold, money, inventory, equipped, setStats, updateUI } from './gameState.js';
import { showMessage } from './utils.js';

const db = getFirestore(auth.app);

export async function saveGameData() {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = doc(db, 'users', user.uid);
    await setDoc(docRef, {
        health: health,
        hunger: hunger,
        cold: cold,
        money: money,
        inventory: inventory,
        equipped: equipped,
        lastUpdated: new Date().toISOString()
    }, { merge: true });
    console.log("Данные сохранены");
}

export async function loadGameData(userId) {
    if (!userId) return;
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        setStats(data.health ?? 100, data.hunger ?? 100, data.cold ?? 100, data.money ?? 200);
        inventory.length = 0;
        inventory.push(...(data.inventory ?? []));
        Object.assign(equipped, data.equipped ?? { head: null, body: null, legs: null, feet: null });
        updateUI();
        // recalcColdFromEquipment вызовем из main.js после загрузки
        console.log("Данные загружены");
    } else {
        setStats(100, 100, 100, 200);
        inventory.push(
            { id: "bread", count: 2 }, { id: "vodka", count: 1 }, { id: "cigarettes", count: 1 },
            { id: "medkit", count: 1 }, { id: "ushanka", count: 1 }, { id: "puhovik", count: 1 }
        );
        Object.assign(equipped, { head: null, body: null, legs: null, feet: null });
        updateUI();
        await saveGameData();
        showMessage('Новый аккаунт создан', '#4caf50');
    }
}
