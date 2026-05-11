/* js/tradeUI.js — Butzcraft Handels-UI (Tier 3: NPC-Dorf)
 *
 * Öffnet ein Trade-Overlay wenn der Spieler einen NPC rechtsklickt.
 * Zeigt die Trades des NPC-Berufs an.
 * Spieler klickt auf ein Angebot → Items werden getauscht wenn genug vorhanden.
 */

import { NPC_PROFESSIONS } from './npc.js?v=20260507b';
import { createBlockHTML, getItemName } from './inventory.js?v=20260507b';

let currentNPC = null;

/**
 * Öffnet das Handels-UI für einen NPC.
 * @param {import('./npc.js').NPC} npc
 * @param {object} controls — PointerLockControls
 */
export function openTradeUI(npc, controls) {
    currentNPC = npc;
    const overlay = document.getElementById('trade-overlay');
    if (!overlay) return;

    const prof = npc.profession;

    // Titel
    const title = overlay.querySelector('#trade-title');
    if (title) title.textContent = `🤝 ${prof.name}`;

    // Trade-Slots befüllen
    const grid = overlay.querySelector('#trade-grid');
    if (!grid) return;
    grid.innerHTML = '';

    prof.trades.forEach((trade, idx) => {
        const row = document.createElement('div');
        row.className = 'trade-row';
        row.id = `trade-row-${idx}`;

        // "Geben"-Seite
        const giveDiv = document.createElement('div');
        giveDiv.className = 'trade-item';
        giveDiv.innerHTML = `
            <div class="trade-icon">${createBlockHTML(trade.give.type)}</div>
            <span class="trade-label">${trade.give.count}× ${getItemName(trade.give.type)}</span>
        `;

        // Pfeil
        const arrow = document.createElement('div');
        arrow.className = 'trade-arrow';
        arrow.textContent = '➜';

        // "Erhalten"-Seite
        const receiveDiv = document.createElement('div');
        receiveDiv.className = 'trade-item';
        receiveDiv.innerHTML = `
            <div class="trade-icon">${createBlockHTML(trade.receive.type)}</div>
            <span class="trade-label">${trade.receive.count}× ${getItemName(trade.receive.type)}</span>
        `;

        // Trade-Button
        const btn = document.createElement('button');
        btn.className = 'trade-btn';
        btn.textContent = 'Tauschen';
        btn.addEventListener('click', () => executeTrade(trade, idx));

        row.appendChild(giveDiv);
        row.appendChild(arrow);
        row.appendChild(receiveDiv);
        row.appendChild(btn);
        grid.appendChild(row);
    });

    overlay.style.display = 'flex';
    if (controls) controls.unlock();
}

/**
 * Trade ausführen.
 */
function executeTrade(trade, idx) {
    const inventorySlots = window.inventorySlots;
    if (!inventorySlots) return;

    // Prüfe ob genug Items vorhanden
    let totalAvailable = 0;
    for (const slot of inventorySlots) {
        if (slot.type === trade.give.type) totalAvailable += slot.count;
    }

    if (totalAvailable < trade.give.count) {
        showTradeMessage('Nicht genug Items! ❌', '#ff4444');
        return;
    }

    // Items abziehen
    let toRemove = trade.give.count;
    for (const slot of inventorySlots) {
        if (toRemove <= 0) break;
        if (slot.type === trade.give.type) {
            const remove = Math.min(slot.count, toRemove);
            slot.count -= remove;
            toRemove -= remove;
            if (slot.count <= 0) { slot.type = 0; slot.count = 0; }
        }
    }

    // Items hinzufügen
    if (window.addItemToInventory) {
        window.addItemToInventory(trade.receive.type, trade.receive.count);
    }

    // UI aktualisieren
    if (window.updateInventoryUI) window.updateInventoryUI();

    showTradeMessage(`+${trade.receive.count}× ${getItemName(trade.receive.type)} ✅`, '#4caf50');

    // Button kurz animieren
    const btn = document.querySelector(`#trade-row-${idx} .trade-btn`);
    if (btn) {
        btn.style.background = '#2e7d32';
        btn.textContent = '✓';
        setTimeout(() => {
            btn.style.background = '';
            btn.textContent = 'Tauschen';
        }, 500);
    }
}

function showTradeMessage(text, color) {
    const msg = document.createElement('div');
    msg.textContent = text;
    msg.style.cssText = `position:absolute; left:50%; top:40%; transform:translate(-50%,-50%); color:${color}; font-weight:bold; font-size:20px; pointer-events:none; animation:fade-up 1.5s forwards; text-shadow:0 0 10px rgba(0,0,0,0.5); z-index:2000;`;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 1500);
}

/**
 * Trade-UI schließen.
 */
export function closeTradeUI(controls) {
    const overlay = document.getElementById('trade-overlay');
    if (overlay) overlay.style.display = 'none';
    currentNPC = null;
    if (controls && !window.touchActive) {
        if (typeof window.resumeGame === 'function') window.resumeGame();
        else controls.lock();
    }
}

export function isTradeOpen() {
    const overlay = document.getElementById('trade-overlay');
    return overlay && overlay.style.display !== 'none';
}
