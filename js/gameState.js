//  js/gameState.js
export let health = 100;
export let maxHealth = 100;
export let hunger = 100;
export let maxHunger = 100;
export let cold = 100;
export let maxCold = 100;
export let money = 500;

export let inventory = [];
export let equipped = { head: null, body: null, legs: null, feet: null };

export let healthValueSpan, hungerValueSpan, coldValueSpan, moneyValueSpan;
export let healthFill, hungerFill, coldFill;

export function initDOM() {
    healthValueSpan = document.getElementById('healthValue');
    hungerValueSpan = document.getElementById('hungerValue');
    coldValueSpan = document.getElementById('coldValue');
    moneyValueSpan = document.getElementById('moneyValue');
    healthFill = document.getElementById('healthFill');
    hungerFill = document.getElementById('hungerFill');
    coldFill = document.getElementById('coldFill');
}

export function updateUI() {
    if (healthValueSpan) healthValueSpan.innerText = `${Math.floor(health)} / ${maxHealth}`;
    if (hungerValueSpan) hungerValueSpan.innerText = `${Math.floor(hunger)} / ${maxHunger}`;
    if (coldValueSpan) coldValueSpan.innerText = `${Math.floor(cold)} / ${maxCold}`;
    if (moneyValueSpan) moneyValueSpan.innerText = Math.floor(money);
    if (healthFill) healthFill.style.width = (health / maxHealth) * 100 + '%';
    if (hungerFill) hungerFill.style.width = (hunger / maxHunger) * 100 + '%';
    if (coldFill) coldFill.style.width = (cold / maxCold) * 100 + '%';
}

export function setStats(h, hu, c, m) {
    health = h;
    hunger = hu;
    cold = c;
    money = m;
    updateUI();
}
