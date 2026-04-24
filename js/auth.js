// js/auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { showMessage } from './utils.js';
import { loadGameData, saveGameData } from './firestore.js';
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
const db = getFirestore(app);

async function saveUserNickOnRegister(userId, email, nick) {
    await setDoc(doc(db, 'users', userId), {
        displayName: nick, userEmail: email, health:100, hunger:100, cold:100, money:200,
        inventory: [{ id: "bread", count:2 },{ id: "vodka", count:1 },{ id: "cigarettes", count:1 },{ id: "medkit", count:1 },{ id: "ushanka", count:1 },{ id: "puhovik", count:1 }],
        equipped: { head:null, body:null, legs:null, feet:null }
    }, { merge: true });
    if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: nick });
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
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormDiv.style.display = 'none';
        loginFormDiv.style.display = 'block';
        if (authError) authError.innerText = '';
        if (regError) regError.innerText = '';
    });

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        if (authError) authError.innerText = '';
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (authError) authError.innerText = error.message;
        }
    });
    registerBtn.addEventListener('click', async () => {
        const nick = document.getElementById('regNick').value.trim();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        if (regError) regError.innerText = '';
        if (!nick) {
            if (regError) regError.innerText = 'Введите игровой ник';
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await saveUserNickOnRegister(userCredential.user.uid, email, nick);
            await updateProfile(auth.currentUser, { displayName: nick });
            showMessage('Регистрация успешна!', '#4caf50');
        } catch (error) {
            if (regError) regError.innerText = error.message;
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            authContainer.style.display = 'none';
            gameContainer.style.display = 'block';
            playerNickSpan.innerText = user.displayName || 'Игрок';
            await loadGameData(user.uid);
            if (onLoginCallback) onLoginCallback(); // вызовем из main.js для обновления инвентаря
        } else {
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
        }
    });
}
