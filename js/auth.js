import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { initFirestore, loadGameData, saveGameData } from './firestore.js';
import { initDOM, updateUI, inventory, equipped } from './gameState.js';

const firebaseConfig = {
    apiKey: "AIzaSyCB2rBhMavOvxrd2Wox967_Xm23_oSMX8Y",
    authDomain: "ivanovo-a6770.firebaseapp.com",
    projectId: "ivanovo-a6770",
    storageBucket: "ivanovo-a6770.firebasestorage.app",
    messagingSenderId: "5386313391",
    appId: "1:5386313391:web:8ee5528233044dd1603e5a",
    measurementId: "G-9VSWLN6S5Y"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
initFirestore(auth);
window.auth = auth;

const db = getFirestore(app);

async function saveUserNickOnRegister(userId, email, nick) {
    await setDoc(doc(db, 'users', userId), {
        displayName: nick,
        userEmail: email,
        role: 'user',           // 👈 НОВОЕ
        ban: null,              // 👈 НОВОЕ
        health: 100,
        hunger: 100,
        cold: 100,
        money: 200,
        inventory: [
            { id: "bread", count: 2 },
            { id: "vodka", count: 1 },
            { id: "cigarettes", count: 1 },
            { id: "medkit", count: 1 },
            { id: "ushanka", count: 1 },
            { id: "puhovik", count: 1 }
        ],
        equipped: { head: null, body: null, legs: null, feet: null }
    }, { merge: true });
    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: nick });
}

// Функция для скрытия сплеша при ошибке
function hideSplashOnError() {
    if (typeof window.hideSplashOnError === 'function') {
        window.hideSplashOnError();
    }
}

// ========== ДОБАВЛЕНИЕ/УДАЛЕНИЕ ИЗ ОНЛАЙНА ==========
async function addUserToOnline(user) {
    try {
        await setDoc(doc(db, 'online', user.uid), {
            uid: user.uid,
            displayName: user.displayName || 'Игрок',
            lastSeen: new Date().toISOString()
        }, { merge: true });
        console.log('🟢 Пользователь добавлен в онлайн');
    } catch (e) {
        console.warn('Ошибка добавления в онлайн:', e);
    }
}

async function removeUserFromOnline(user) {
    try {
        await deleteDoc(doc(db, 'online', user.uid));
        console.log('🔴 Пользователь удалён из онлайна');
    } catch (e) {
        console.warn('Ошибка удаления из онлайна:', e);
    }
}

export function initAuth(authContainer, gameContainer, loginFormDiv, registerFormDiv, playerNickSpan, onLoginCallback) {
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const authError = document.getElementById('authError');
    const regError = document.getElementById('regError');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = 'block';
        if (authError) authError.innerText = '';
        if (regError) regError.innerText = '';
        hideSplashOnError();
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormDiv.style.display = 'none';
        loginFormDiv.style.display = 'block';
        if (authError) authError.innerText = '';
        if (regError) regError.innerText = '';
        hideSplashOnError();
    });

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (authError) authError.innerText = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (authError) authError.innerText = error.message;
            hideSplashOnError();
        }
    });

    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');

    function onEnterPress(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            loginBtn.click();
        }
    }

    if (loginEmail) loginEmail.addEventListener('keypress', onEnterPress);
    if (loginPassword) loginPassword.addEventListener('keypress', onEnterPress);

    registerBtn.addEventListener('click', async () => {
        const nick = document.getElementById('regNick').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (regError) regError.innerText = '';
        if (!nick) {
            if (regError) regError.innerText = 'Введите игровой ник';
            hideSplashOnError();
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await saveUserNickOnRegister(userCredential.user.uid, email, nick);
            await updateProfile(auth.currentUser, { displayName: nick });
            showMessage('Регистрация успешна!', '#4caf50');
        } catch (error) {
            if (regError) regError.innerText = error.message;
            hideSplashOnError();
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 👇 ДОБАВЛЯЕМ В ОНЛАЙН
            await addUserToOnline(user);
            
            authContainer.style.display = 'none';
            gameContainer.style.display = 'block';
            playerNickSpan.innerText = user.displayName || 'Игрок';
            await loadGameData(user.uid);
            if (onLoginCallback) onLoginCallback();
        } else {
            // 👇 УДАЛЯЕМ ИЗ ОНЛАЙНА (если был)
            if (window._lastUser) {
                await removeUserFromOnline(window._lastUser);
            }
            
            gameContainer.style.display = 'none';
            authContainer.style.display = 'block';
            loginFormDiv.style.display = 'block';
            registerFormDiv.style.display = 'none';
            if (authError) authError.innerText = '';
            if (regError) regError.innerText = '';
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            document.getElementById('regNick').value = '';
            document.getElementById('regEmail').value = '';
            document.getElementById('regPassword').value = '';
            hideSplashOnError();
        }
        
        // Сохраняем последнего пользователя для удаления из онлайна при выходе
        window._lastUser = user;
    });
}
