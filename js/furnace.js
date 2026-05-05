/* js/furnace.js – Ofen-System: Zustand, Schmelz-Logik, UI */
import { BLOCK_TYPES, BLOCK_TEX, atlasDataURL } from './blocks.js?v=20260504a';
import { createBlockHTML, getItemName } from './inventory.js';

// Schmelz-Rezepte: Input-Block → Output-Item
const SMELT_RECIPES = {
    [BLOCK_TYPES.COAL_ORE]:  { type: BLOCK_TYPES.COAL,       count: 1 },
    [BLOCK_TYPES.IRON_ORE]:  { type: BLOCK_TYPES.IRON_INGOT, count: 1 },
    [BLOCK_TYPES.GOLD_ORE]:  { type: BLOCK_TYPES.GOLD_INGOT, count: 1 },
    [BLOCK_TYPES.STONE]:     { type: BLOCK_TYPES.STONE_BRICK, count: 1 },
    [BLOCK_TYPES.SAND]:      { type: BLOCK_TYPES.SANDSTONE,   count: 1 },
    [BLOCK_TYPES.WOOD]:      { type: BLOCK_TYPES.COAL,        count: 1 }, // Holzkohle
};

const SMELT_TIME = 10000; // 10 Sekunden in ms
const FUEL_ITEMS = new Set([BLOCK_TYPES.COAL, BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, BLOCK_TYPES.WOOD]);

// Ofen-State
let furnaceOpen = false;
let furnacePos = null; // {x, y, z}
let furnaceInput  = { type: 0, count: 0 };
let furnaceFuel   = { type: 0, count: 0 };
let furnaceOutput = { type: 0, count: 0 };
let smeltProgress = 0;   // 0..1
let smeltActive = false;
let lastTick = 0;

export function openFurnace(x, y, z, controls) {
    furnacePos = { x, y, z };
    furnaceOpen = true;
    lastTick = performance.now();
    const overlay = document.getElementById('furnace-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (controls && controls.isLocked) controls.unlock();
    renderFurnaceUI();
}

export function closeFurnace(controls) {
    furnaceOpen = false;
    const overlay = document.getElementById('furnace-overlay');
    if (overlay) overlay.style.display = 'none';
    if (controls && !window.touchActive) controls.lock();
}

window.closeFurnace = () => closeFurnace(window._furnaceControls);

export function isFurnaceOpen() { return furnaceOpen; }

function renderFurnaceUI() {
    const renderSlot = (elId, item) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.innerHTML = '';
        if (item && item.count > 0) {
            const iconWrap = document.createElement('div');
            iconWrap.className = 'slot-color-preview';
            iconWrap.style.pointerEvents = 'none';
            iconWrap.style.background = 'none';
            iconWrap.style.display = 'flex';
            iconWrap.style.justifyContent = 'center';
            iconWrap.innerHTML = createBlockHTML(item.type);
            const cnt = document.createElement('span');
            cnt.className = 'slot-count';
            cnt.style.pointerEvents = 'none';
            cnt.textContent = item.count > 1 ? item.count : '';
            el.style.position = 'relative';
            el.appendChild(iconWrap); el.appendChild(cnt);
            el.title = getItemName(item.type);
        } else {
            el.title = '';
        }
        el.onclick = () => handleFurnaceSlotClick(elId);
    };
    renderSlot('furnace-input-slot', furnaceInput);
    renderSlot('furnace-fuel-slot', furnaceFuel);
    renderSlot('furnace-output-slot', furnaceOutput);
    const bar = document.getElementById('furnace-progress-bar');
    if (bar) bar.style.width = (smeltProgress * 100).toFixed(1) + '%';
    const status = document.getElementById('furnace-status');
    if (status) {
        if (smeltActive) status.textContent = 'Schmelzt... ' + Math.round(smeltProgress * 100) + '%';
        else if (furnaceInput.count > 0 && SMELT_RECIPES[furnaceInput.type]) status.textContent = 'Warte auf Brennstoff';
        else if (furnaceInput.count > 0) status.textContent = 'Kein Rezept';
        else status.textContent = 'Bereit';
    }
}

function handleFurnaceSlotClick(slotId) {
    const inv = window.inventorySlots;
    const selIdx = window.getSelectedSlot ? window.getSelectedSlot() : 0;
    const hand = inv && inv[selIdx];

    if (slotId === 'furnace-input-slot') {
        if (hand && hand.count > 0 && SMELT_RECIPES[hand.type]) {
            if (furnaceInput.type === hand.type && furnaceInput.count < 64) {
                furnaceInput.count++; hand.count--;
            } else if (furnaceInput.count === 0) {
                furnaceInput = { type: hand.type, count: 1 }; hand.count--;
            }
            if (hand.count <= 0) hand.type = 0;
            if (window.updateInventoryUI) window.updateInventoryUI();
        } else if (furnaceInput.count > 0) {
            if (window.addItemToInventory) window.addItemToInventory(furnaceInput.type, furnaceInput.count);
            furnaceInput = { type: 0, count: 0 };
        }
    } else if (slotId === 'furnace-fuel-slot') {
        if (hand && hand.count > 0 && FUEL_ITEMS.has(hand.type)) {
            if (furnaceFuel.type === hand.type && furnaceFuel.count < 64) {
                furnaceFuel.count++; hand.count--;
            } else if (furnaceFuel.count === 0) {
                furnaceFuel = { type: hand.type, count: 1 }; hand.count--;
            }
            if (hand.count <= 0) hand.type = 0;
            if (window.updateInventoryUI) window.updateInventoryUI();
        } else if (furnaceFuel.count > 0) {
            if (window.addItemToInventory) window.addItemToInventory(furnaceFuel.type, furnaceFuel.count);
            furnaceFuel = { type: 0, count: 0 };
        }
    } else if (slotId === 'furnace-output-slot') {
        if (furnaceOutput.count > 0) {
            if (window.addItemToInventory) window.addItemToInventory(furnaceOutput.type, furnaceOutput.count);
            furnaceOutput = { type: 0, count: 0 };
            if (window.updateInventoryUI) window.updateInventoryUI();
        }
    }
    renderFurnaceUI();
}

// Tick-Funktion — wird jeden Frame aus dem Game-Loop aufgerufen
export function tickFurnace(controls) {
    window._furnaceControls = controls;
    if (!furnaceOpen) return;

    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;

    const recipe = furnaceInput.count > 0 ? SMELT_RECIPES[furnaceInput.type] : null;
    const hasFuel = furnaceFuel.count > 0;
    const canOutput = furnaceOutput.count === 0 || (recipe && furnaceOutput.type === recipe.type && furnaceOutput.count < 64);

    if (recipe && hasFuel && canOutput) {
        smeltActive = true;
        smeltProgress += dt / SMELT_TIME;
        if (smeltProgress >= 1) {
            smeltProgress = 0;
            furnaceInput.count--;
            if (furnaceInput.count <= 0) furnaceInput = { type: 0, count: 0 };
            furnaceFuel.count--;
            if (furnaceFuel.count <= 0) furnaceFuel = { type: 0, count: 0 };
            if (furnaceOutput.count === 0) furnaceOutput = { type: recipe.type, count: 1 };
            else furnaceOutput.count++;
        }
    } else {
        smeltActive = false;
        if (!recipe || !canOutput) smeltProgress = 0;
    }

    renderFurnaceUI();
}
