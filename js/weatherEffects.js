// js/weatherEffects.js
import { accumulatedMinutes, currentWeather } from './gameState.js';

let darkOverlay = null;
let particlesCanvas = null;
let animationId = null;
let particles = [];
let currentEffectType = null;

// Принудительное обновление размеров canvas
function resizeCanvas() {
    if (!particlesCanvas) return;
    const container = particlesCanvas.parentElement;
    if (container) {
        particlesCanvas.width = container.clientWidth;
        particlesCanvas.height = container.clientHeight;
    }
}

// Создание слоёв (вызывается из renderLocation)
export function createWeatherLayers(container) {
    // Удаляем старые, если есть
    removeWeatherLayers();
    
    // Слой затемнения
    darkOverlay = document.createElement('div');
    darkOverlay.id = 'darkOverlay';
    darkOverlay.style.position = 'absolute';
    darkOverlay.style.top = '0';
    darkOverlay.style.left = '0';
    darkOverlay.style.width = '100%';
    darkOverlay.style.height = '100%';
    darkOverlay.style.backgroundColor = 'black';
    darkOverlay.style.pointerEvents = 'none';
    darkOverlay.style.zIndex = '4';
    darkOverlay.style.opacity = '0';
    container.appendChild(darkOverlay);
    
    // Canvas для частиц
    particlesCanvas = document.createElement('canvas');
    particlesCanvas.id = 'particlesCanvas';
    particlesCanvas.style.position = 'absolute';
    particlesCanvas.style.top = '0';
    particlesCanvas.style.left = '0';
    particlesCanvas.style.width = '100%';
    particlesCanvas.style.height = '100%';
    particlesCanvas.style.pointerEvents = 'none';
    particlesCanvas.style.zIndex = '5';
    container.appendChild(particlesCanvas);
    
    // Устанавливаем размеры canvas
    resizeCanvas();
    
    // Обновляем размеры canvas при ресайзе
    window.addEventListener('resize', () => {
        if (particlesCanvas && particlesCanvas.parentElement) {
            resizeCanvas();
        }
    });
    
    // Принудительно обновляем эффекты после создания слоёв
    setTimeout(() => {
        updateDarkness();
        updateWeatherEffects();
    }, 30);
}

// Удаление слоёв
export function removeWeatherLayers() {
    if (darkOverlay && darkOverlay.remove) darkOverlay.remove();
    if (particlesCanvas && particlesCanvas.remove) particlesCanvas.remove();
    stopParticleAnimation();
    darkOverlay = null;
    particlesCanvas = null;
}

// Обновление размеров canvas (экспортируем для внешнего вызова)
export function updateCanvasSize() {
    resizeCanvas();
}

// Расчёт затемнения по часам
function calculateDarkness(hours) {
    let h = hours % 24;
    if (h >= 6 && h <= 18) return 0;
    if (h > 18 && h <= 22) return ((h - 18) / 4) * 0.4;
    if (h > 22 || h < 4) return 0.5;
    if (h >= 4 && h < 6) return ((6 - h) / 2) * 0.4;
    return 0;
}

// Обновление затемнения
export function updateDarkness() {
    if (!darkOverlay) return;
    const totalMinutes = accumulatedMinutes;
    const hours = totalMinutes / 60;
    const darkness = calculateDarkness(hours);
    darkOverlay.style.opacity = Math.min(0.5, Math.max(0, darkness));
}

function stopParticleAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    particles = [];
}

function startParticleAnimation(weather) {
    stopParticleAnimation();
    
    if (!particlesCanvas) return;
    resizeCanvas();
    
    let count = 0;
    let speedMultiplier = 1;
    let char = '💧';
    let color = 'rgba(150, 200, 255, 0.7)';
    
    switch (weather) {
        case 'rain':
            count = 60;
            speedMultiplier = 8;
            char = '💧';
            break;
        case 'snow':
            count = 40;
            speedMultiplier = 2.5;
            char = '❄️';
            color = 'rgba(200, 220, 255, 0.9)';
            break;
        default:
            return;
    }
    
    const ctx = particlesCanvas.getContext('2d');
    if (!ctx) return;
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * particlesCanvas.width,
            y: Math.random() * particlesCanvas.height,
            speed: speedMultiplier * (1 + Math.random() * 2),
            size: 16 + Math.random() * 8,
            char: char,
            color: color,
            sway: weather === 'snow' ? (Math.random() - 0.5) * 0.5 : 0
        });
    }
    
    function draw() {
        if (!particlesCanvas || !particlesCanvas.parentElement) {
            stopParticleAnimation();
            return;
        }
        
        const container = particlesCanvas.parentElement;
        if (container && container.offsetParent === null) {
            requestAnimationFrame(draw);
            return;
        }
        
        ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
        ctx.font = `20px "Segoe UI Emoji"`;
        
        for (let p of particles) {
            ctx.fillStyle = p.color;
            ctx.fillText(p.char, p.x, p.y);
            
            p.y += p.speed;
            if (weather === 'snow') {
                p.x += p.sway;
            }
            
            if (p.y > particlesCanvas.height + 50) {
                p.y = -30;
                p.x = Math.random() * particlesCanvas.width;
            }
            if (weather === 'snow' && (p.x < -50 || p.x > particlesCanvas.width + 50)) {
                p.x = Math.random() * particlesCanvas.width;
            }
        }
        
        animationId = requestAnimationFrame(draw);
    }
    
    draw();
}

// Обновление эффектов при смене погоды
export function updateWeatherEffects() {
    if (!particlesCanvas) return;
    
    if (currentWeather === 'rain' || currentWeather === 'snow') {
        if (currentEffectType !== currentWeather) {
            currentEffectType = currentWeather;
            startParticleAnimation(currentWeather);
        }
    } else {
        if (currentEffectType !== null) {
            currentEffectType = null;
            stopParticleAnimation();
            if (particlesCanvas) {
                const ctx = particlesCanvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
            }
        }
    }
}

// Остановка всех эффектов (при выходе из игры)
export function stopWeatherEffects() {
    stopParticleAnimation();
    if (particlesCanvas) {
        const ctx = particlesCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    }
    currentEffectType = null;
}
