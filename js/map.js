import { openLocationModal } from './locations.js';
import { showMessage } from './utils.js';

export function renderInteractiveMap() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    const zones = [
        { id: "railway", name: "Вокзал", cx: 125, cy: 100, r: 45 },
        { id: "market", name: "Рынок", cx: 375, cy: 100, r: 50 },
        { id: "shelter", name: "Ночлежка", cx: 625, cy: 115, r: 48 },
        { id: "dump", name: "Свалка", cx: 155, cy: 360, r: 50 },
        { id: "church", name: "Церковь", cx: 395, cy: 360, r: 48 },
        { id: "bar", name: "Бар", cx: 655, cy: 375, r: 45 }
    ];
    container.innerHTML = `
        <div style="position: relative; display: inline-block; width: 100%;">
            <img src="map.png" alt="Карта Иваново" class="map-image" style="width:100%; height:auto;">
            <svg class="map-overlay" viewBox="0 0 800 600" preserveAspectRatio="none" style="position: absolute; top:0; left:0; width:100%; height:100%;">
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
        circle.addEventListener('mouseenter', (e) => {
            tooltip.textContent = name;
            tooltip.style.display = 'block';
        });
        circle.addEventListener('mousemove', (e) => {
            tooltip.style.left = e.clientX + 15 + 'px';
            tooltip.style.top = e.clientY - 30 + 'px';
        });
        circle.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
        circle.addEventListener('click', () => {
            const locId = circle.getAttribute('data-location');
            if (locId) openLocationModal(locId);
            else showMessage("Локация не добавлена", "#f0ad4e");
        });
    });
}
