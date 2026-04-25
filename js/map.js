import { setCurrentLocation } from './gameState.js';
import { showMessage } from './utils.js';

export function renderInteractiveMap() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    const zones = [
        { id: "railway", name: "Вокзал", cx: 328, cy: 30, r: 20 },
        { id: "market", name: "Рынок", cx: 271, cy: 277, r: 20 },
        { id: "shelter", name: "Ночлежка", cx: 355, cy: 185, r: 20 },
        { id: "dump", name: "Свалка", cx: 300, cy: 1, r: 20 },
        { id: "church", name: "Церковь", cx: 304, cy: 243, r: 20 },
        { id: "bar", name: "Бар", cx: 331, cy: 215, r: 20 }
    ];
    
    container.innerHTML = `
        <div style="position: relative; display: inline-block; width: 100%;">
            <img src="map.png" alt="Карта Иваново" class="map-image" style="width:100%; height:auto;">
            <svg class="map-overlay" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet" style="position: absolute; top:0; left:0; width:100%; height:100%;">
                ${zones.map(z => `<circle cx="${z.cx}" cy="${z.cy}" r="${z.r}" data-location="${z.id}" data-name="${z.name}" fill="rgba(0,200,0,0.25)" stroke="rgba(0,200,0,0.6)" stroke-width="2" />`).join('')}
            </svg>
        </div>
    `;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'location-tooltip';
    document.body.appendChild(tooltip);
    
    const circles = document.querySelectorAll('.map-overlay circle');
    circles.forEach(circle => {
        const name = circle.getAttribute('data-name');
        const locationId = circle.getAttribute('data-location');
        
        circle.addEventListener('mouseenter', (e) => {
            tooltip.textContent = name;
            tooltip.style.display = 'block';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY - 30 + 'px';
        });
        circle.addEventListener('mouseleave', () => { 
            tooltip.style.display = 'none'; 
        });
        
        circle.addEventListener('click', async () => {
            if (locationId) {
                if (typeof window.playClickSound === 'function') window.playClickSound();
                const mapModal = document.getElementById('mapModal');
                if (mapModal) mapModal.style.display = 'none';
                setCurrentLocation(locationId);
                showMessage(`📍 Вы перешли в локацию "${name}"`, '#4caf50');
            } else {
                showMessage("Локация не добавлена", "#f0ad4e");
            }
        });
    });
}
