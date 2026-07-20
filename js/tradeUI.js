/* js/tradeUI.js — Butzcraft Handels-UI (Tier 3: NPC-Dorf)
 *
 * Öffnet ein Trade-Overlay wenn der Spieler einen NPC rechtsklickt.
 * Zeigt die Trades des NPC-Berufs an.
 * Spieler klickt auf ein Angebot → Items werden getauscht wenn genug vorhanden.
 */

import { createBlockHTML, getItemName, inventorySlots, tryAddItemsToInventory, tryExchangeInventory } from './inventory.js?v=20260720q';
import {
    acceptSideQuest,
    completeSideQuest,
    getAdjustedTrade,
    getQuestProgress,
    getSideQuestProgress,
    getTrustTier
} from './quests.js?v=20260720q';
import { Game } from './Game.js?v=20260716b';
import { STORY_EVENTS } from './storyProgress.js?v=20260720q';
import { activateDialog, deactivateDialog } from './dialogFocus.js?v=20260718b';

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
    const questState = window.getQuestState?.() || null;
    const villageState = npc.villageId ? questState?.villages?.[npc.villageId] : null;
    const trustTier = getTrustTier(villageState?.trust || 0);
    if (title) {
        const npcName = npc.displayName && npc.displayName !== prof.name ? `${npc.displayName} · ` : '';
        title.textContent = `🤝 ${npcName}${prof.name}${villageState ? ` · ${trustTier.label}` : ''}`;
    }

    // Trade-Slots befüllen
    const grid = overlay.querySelector('#trade-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const villageQuestRows = buildVillageQuestRows(npc, questState, villageState);
    villageQuestRows.forEach(row => grid.appendChild(row));

    if (villageQuestRows.length === 0 && prof.quest) {
        grid.appendChild(buildQuestRow(prof.quest));
    }

    prof.trades.forEach((trade, idx) => {
        const pricedTrade = villageState ? getAdjustedTrade(trade, villageState.trust) : trade;
        const row = document.createElement('div');
        row.className = 'trade-row';
        row.id = `trade-row-${idx}`;

        // "Geben"-Seite
        const giveDiv = document.createElement('div');
        giveDiv.className = 'trade-item';
        giveDiv.innerHTML = `
            <div class="trade-icon">${createBlockHTML(pricedTrade.give.type)}</div>
            <span class="trade-label">${pricedTrade.give.count}× ${getItemName(pricedTrade.give.type)}</span>
        `;

        // Pfeil
        const arrow = document.createElement('div');
        arrow.className = 'trade-arrow';
        arrow.textContent = '➜';

        // "Erhalten"-Seite
        const receiveDiv = document.createElement('div');
        receiveDiv.className = 'trade-item';
        receiveDiv.innerHTML = `
            <div class="trade-icon">${createBlockHTML(pricedTrade.receive.type)}</div>
            <span class="trade-label">${pricedTrade.receive.count}× ${getItemName(pricedTrade.receive.type)}</span>
        `;

        // Trade-Button
        const btn = document.createElement('button');
        btn.className = 'trade-btn';
        btn.textContent = 'Tauschen';
        btn.addEventListener('click', () => executeTrade(pricedTrade, idx));

        row.appendChild(giveDiv);
        row.appendChild(arrow);
        row.appendChild(receiveDiv);
        row.appendChild(btn);
        grid.appendChild(row);
    });

    overlay.style.display = 'flex';
    activateDialog(overlay, '.trade-btn:not(:disabled), .panel-close-button');
    window.dispatchEvent(new CustomEvent(STORY_EVENTS.VILLAGER_MET, { detail: { npc } }));
    if (controls) controls.unlock();
}

function buildVillageQuestRows(npc, questState, villageState) {
    if (!questState || !villageState || !npc.villageId) return [];
    const professionIdx = Number.isInteger(npc.professionIdx) ? npc.professionIdx : -1;
    const rows = [];
    const active = (questState.activeSideQuests || []).filter(quest => (
        quest.villageId === npc.villageId && quest.professionIdx === professionIdx
    ));
    active.forEach(quest => rows.push(buildActiveVillageQuestRow(quest, questState)));

    const activeIds = new Set((questState.activeSideQuests || []).map(quest => quest.id));
    const completedIds = new Set(questState.completedQuestIds || []);
    const abandonedIds = new Set(questState.abandonedQuestIds || []);
    for (const offer of villageState.offers || []) {
        if (offer.professionIdx !== professionIdx) continue;
        if (activeIds.has(offer.id) || completedIds.has(offer.id) || abandonedIds.has(offer.id)) continue;
        rows.push(buildVillageQuestOfferRow(offer, questState));
    }
    return rows;
}

function objectiveText(objective) {
    if (!objective) return 'Unbekanntes Ziel';
    if (objective.type === 'delivery') return `${objective.required}× ${getItemName(objective.itemType)} abgeben`;
    if (objective.type === 'craft') return `${objective.required}× ${getItemName(objective.itemType)} herstellen`;
    if (objective.type === 'place') return `${objective.required}× ${getItemName(objective.itemType)} im Dorf platzieren`;
    if (objective.type === 'hunt') return `${objective.required}× ${objective.mobType} besiegen`;
    if (objective.type === 'structure') return `${objective.structureKind === 'mine' ? 'Mine' : 'Dungeon'} abschließen`;
    return objective.type;
}

function buildVillageQuestOfferRow(offer, questState) {
    const row = document.createElement('div');
    row.className = 'trade-row quest-row quest-offer-row';
    const details = document.createElement('div');
    details.className = 'trade-item';
    details.innerHTML = `<strong>${offer.title}</strong><span class="trade-label">${objectiveText(offer.objective)}</span>`;
    const reward = document.createElement('div');
    reward.className = 'trade-item';
    reward.innerHTML = `<div class="trade-icon">${createBlockHTML(offer.reward.type)}</div><span class="trade-label">${offer.reward.count}× ${getItemName(offer.reward.type)} · +${offer.trustReward} Vertrauen</span>`;
    const btn = document.createElement('button');
    btn.className = 'trade-btn';
    btn.textContent = 'Annehmen';
    btn.addEventListener('click', () => {
        const result = acceptSideQuest(questState, offer);
        if (!result.accepted) {
            showTradeMessage(result.reason === 'quest-limit' ? 'Maximal drei Nebenquests.' : 'Quest bereits aktiv.', '#ff9800');
            return;
        }
        showTradeMessage(`Quest angenommen: ${offer.title}`, '#ffe066');
        if (currentNPC) openTradeUI(currentNPC);
    });
    row.append(details, reward, btn);
    return row;
}

function buildActiveVillageQuestRow(quest, questState) {
    const progress = getSideQuestProgress(quest, inventorySlots);
    const row = document.createElement('div');
    row.className = 'trade-row quest-row quest-active-row';
    const details = document.createElement('div');
    details.className = 'trade-item';
    details.innerHTML = `<strong>${quest.title}</strong><span class="trade-label">${progress.current}/${progress.required} · ${objectiveText(quest.objective)}</span>`;
    const reward = document.createElement('div');
    reward.className = 'trade-item';
    reward.innerHTML = `<div class="trade-icon">${createBlockHTML(quest.reward.type)}</div><span class="trade-label">${quest.reward.count}× ${getItemName(quest.reward.type)}</span>`;
    const btn = document.createElement('button');
    btn.className = 'trade-btn';
    btn.textContent = progress.complete ? 'Abgeben' : `Fehlt ${progress.required - progress.current}`;
    btn.disabled = !progress.complete;
    btn.addEventListener('click', () => executeVillageQuest(quest, questState));
    row.append(details, reward, btn);
    return row;
}

function executeVillageQuest(quest, questState) {
    const progress = getSideQuestProgress(quest, inventorySlots);
    if (!progress.complete) return;
    const result = quest.objective.type === 'delivery'
        ? tryExchangeInventory(
            { type: quest.objective.itemType, count: quest.objective.required },
            quest.reward
        )
        : tryAddItemsToInventory([quest.reward]);
    const succeeded = quest.objective.type === 'delivery' ? result.exchanged : result.added;
    if (!succeeded) {
        showTradeMessage('Inventar voll! ❌', '#ff9800');
        return;
    }
    completeSideQuest(questState, quest.id, window.getQuestDayCount?.() || 0);
    const village = questState.villages?.[quest.villageId];
    if (village) village.offers = (village.offers || []).filter(offer => offer.id !== quest.id);
    if (window.updateInventoryUI) window.updateInventoryUI();
    showTradeMessage(`Quest erledigt: +${quest.trustReward} Vertrauen`, '#4caf50');
    window.dispatchEvent(new CustomEvent(STORY_EVENTS.QUEST_COMPLETED, { detail: { quest } }));
    if (currentNPC) openTradeUI(currentNPC);
}

function buildQuestRow(quest) {
    const progress = getQuestProgress(inventorySlots, quest);
    const row = document.createElement('div');
    row.className = 'trade-row quest-row';

    const giveDiv = document.createElement('div');
    giveDiv.className = 'trade-item';
    giveDiv.innerHTML = `
        <div class="trade-icon">${createBlockHTML(quest.give.type)}</div>
        <span class="trade-label">Auftrag: ${progress.current}/${progress.required} ${getItemName(quest.give.type)}</span>
    `;

    const arrow = document.createElement('div');
    arrow.className = 'trade-arrow';
    arrow.textContent = '->';

    const receiveDiv = document.createElement('div');
    receiveDiv.className = 'trade-item';
    receiveDiv.innerHTML = `
        <div class="trade-icon">${createBlockHTML(quest.receive.type)}</div>
        <span class="trade-label">${quest.receive.count}x ${getItemName(quest.receive.type)}</span>
    `;

    const btn = document.createElement('button');
    btn.className = 'trade-btn';
    btn.textContent = progress.complete ? 'Abgeben' : `Fehlt ${progress.missing}`;
    btn.disabled = !progress.complete;
    btn.addEventListener('click', () => executeQuest(quest, btn));

    row.appendChild(giveDiv);
    row.appendChild(arrow);
    row.appendChild(receiveDiv);
    row.appendChild(btn);
    return row;
}

/**
 * Trade ausführen.
 */
function executeTrade(trade, idx) {
    const result = tryExchangeInventory(trade.give, trade.receive);
    if (result.reason === 'insufficient-items') {
        showTradeMessage('Nicht genug Items! ❌', '#ff4444');
        return;
    }
    if (!result.exchanged) {
        showTradeMessage('Inventar voll! ❌', '#ff9800');
        return;
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

function executeQuest(quest, btn) {
    const progress = getQuestProgress(inventorySlots, quest);
    if (!progress.complete) return;

    const result = tryExchangeInventory(quest.give, quest.receive);
    if (!result.exchanged) {
        showTradeMessage('Inventar voll! ❌', '#ff9800');
        return;
    }
    if (window.updateInventoryUI) window.updateInventoryUI();

    showTradeMessage(`Auftrag erledigt: +${quest.receive.count}x ${getItemName(quest.receive.type)}`, '#4caf50');
    window.dispatchEvent(new CustomEvent(STORY_EVENTS.QUEST_COMPLETED));
    if (currentNPC) openTradeUI(currentNPC);
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
    deactivateDialog(overlay);
    if (overlay) overlay.style.display = 'none';
    currentNPC = null;
    if (controls && !Game.touchActive) {
        if (typeof window.resumeGame === 'function') window.resumeGame();
        else controls.lock();
    }
}

export function isTradeOpen() {
    const overlay = document.getElementById('trade-overlay');
    return overlay && overlay.style.display !== 'none';
}
