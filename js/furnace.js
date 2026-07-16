/* js/furnace.js – Ofen-System: Zustand, Schmelz-Logik, UI */
import { BLOCK_TYPES, BLOCK_TEX, atlasDataURL } from './blocks.js?v=20260716e';
import { createBlockHTML, getItemName, inventorySlots } from './inventory.js?v=20260716l';
import { Game } from './Game.js?v=20260716b';

// Schmelz-Rezepte: Input-Block → Output-Item
const SMELT_RECIPES = {
    [BLOCK_TYPES.COAL_ORE]:  { type: BLOCK_TYPES.COAL,       count: 1 },
    [BLOCK_TYPES.IRON_ORE]:  { type: BLOCK_TYPES.IRON_INGOT, count: 1 },
    [BLOCK_TYPES.GOLD_ORE]:  { type: BLOCK_TYPES.GOLD_INGOT, count: 1 },
    [BLOCK_TYPES.STONE]:     { type: BLOCK_TYPES.STONE_BRICK, count: 1 },
    [BLOCK_TYPES.SAND]:      { type: BLOCK_TYPES.SANDSTONE,   count: 1 },
    [BLOCK_TYPES.WOOD]:      { type: BLOCK_TYPES.COAL,        count: 1 }, // Holzkohle
    [BLOCK_TYPES.FISH]:      { type: BLOCK_TYPES.COOKED_FISH, count: 1 },
    [BLOCK_TYPES.RAW_MEAT]:  { type: BLOCK_TYPES.COOKED_MEAT, count: 1 },
    [BLOCK_TYPES.RAW_CHICKEN]: { type: BLOCK_TYPES.COOKED_CHICKEN, count: 1 },
    [BLOCK_TYPES.MUTTON]:    { type: BLOCK_TYPES.COOKED_MUTTON, count: 1 },
    [BLOCK_TYPES.TURTLE_MEAT]: { type: BLOCK_TYPES.COOKED_TURTLE_MEAT, count: 1 },
};

export function getSmeltRecipe(type) {
    return SMELT_RECIPES[type] || null;
}

const SMELT_TIME = 6000;
const FUEL_VALUES = new Map([
    [BLOCK_TYPES.COAL, 8],
    [BLOCK_TYPES.WOOD, 3],
    [BLOCK_TYPES.PLANKS, 2],
    [BLOCK_TYPES.STICK, 1],
]);

export function getFuelValue(type) {
    return FUEL_VALUES.get(type) || 0;
}

export function getSmeltTime() {
    return SMELT_TIME;
}

// Ofen-State
let furnaceOpen = false;
let furnacePos = null; // {x, y, z}
let furnaceInput  = { type: 0, count: 0 };
let furnaceFuel   = { type: 0, count: 0 };
let furnaceOutput = { type: 0, count: 0 };
let fuelUsesRemaining = 0;
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
    if (controls && !Game.touchActive) {
        if (typeof window.resumeGame === 'function') window.resumeGame();
        else controls.lock();
    }
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
        const fuelStatus = fuelUsesRemaining > 0 ? ` · Brennstoff: ${fuelUsesRemaining}` : '';
        const recipe = furnaceInput.count > 0 ? SMELT_RECIPES[furnaceInput.type] : null;
        const outputBlocked = recipe && furnaceOutput.count > 0 &&
            (furnaceOutput.type !== recipe.type || furnaceOutput.count >= 64);
        if (smeltActive) status.textContent = 'Verarbeitet... ' + Math.round(smeltProgress * 100) + '%' + fuelStatus;
        else if (outputBlocked) status.textContent = 'Ausgabe leeren';
        else if (furnaceInput.count > 0 && SMELT_RECIPES[furnaceInput.type] && fuelUsesRemaining <= 0 && furnaceFuel.count <= 0) status.textContent = 'Warte auf Brennstoff';
        else if (fuelUsesRemaining > 0) status.textContent = `Bereit · Brennstoff: ${fuelUsesRemaining}`;
        else if (furnaceInput.count > 0 && !SMELT_RECIPES[furnaceInput.type]) status.textContent = 'Kein Rezept';
        else status.textContent = 'Bereit';
    }
}

function handleFurnaceSlotClick(slotId) {
    if (slotId === 'furnace-input-slot') {
        if (!moveOneFromInventoryToFurnace(furnaceInput, type => SMELT_RECIPES[type])) {
            if (furnaceInput.count <= 0) return;
            furnaceInput = returnItemToInventory(furnaceInput);
        }
    } else if (slotId === 'furnace-fuel-slot') {
        if (!moveOneFromInventoryToFurnace(furnaceFuel, type => getFuelValue(type) > 0)) {
            if (furnaceFuel.count <= 0) return;
            furnaceFuel = returnItemToInventory(furnaceFuel);
        }
    } else if (slotId === 'furnace-output-slot') {
        if (furnaceOutput.count > 0) {
            furnaceOutput = returnItemToInventory(furnaceOutput);
            if (window.updateInventoryUI) window.updateInventoryUI();
        }
    }
    renderFurnaceUI();
}

function returnItemToInventory(item) {
    if (!window.addItemToInventory) return item;
    const result = window.addItemToInventory(item.type, item.count);
    if (!result || result.remaining <= 0) return { type: 0, count: 0 };
    return { type: item.type, count: result.remaining };
}

function moveOneFromInventoryToFurnace(targetSlot, acceptsType) {
    if (!targetSlot || targetSlot.count >= 64) return false;

    const source = findFurnaceSourceSlot(targetSlot, acceptsType);
    if (!source) return false;

    if (targetSlot.count === 0) targetSlot.type = source.type;
    targetSlot.count++;
    source.count--;
    if (source.count <= 0) {
        source.type = 0;
        source.count = 0;
    }
    if (window.updateInventoryUI) window.updateInventoryUI();
    return true;
}

function findFurnaceSourceSlot(targetSlot, acceptsType) {
    const inv = inventorySlots;
    if (!inv) return null;

    const canUse = (slot) => {
        if (!slot || slot.count <= 0 || !acceptsType(slot.type)) return false;
        return targetSlot.count === 0 || targetSlot.type === slot.type;
    };

    const selIdx = window.getSelectedSlot ? window.getSelectedSlot() : 0;
    if (canUse(inv[selIdx])) return inv[selIdx];

    if (targetSlot.count === 0) return inv.find(canUse) || null;
    return null;
}

// Tick-Funktion — wird jeden Frame aus dem Game-Loop aufgerufen
export function tickFurnace(controls) {
    window._furnaceControls = controls;
    if (!furnaceOpen) return;

    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;

    const recipe = furnaceInput.count > 0 ? SMELT_RECIPES[furnaceInput.type] : null;
    const hasFuel = fuelUsesRemaining > 0 || furnaceFuel.count > 0;
    const canOutput = furnaceOutput.count === 0 || (recipe && furnaceOutput.type === recipe.type && furnaceOutput.count < 64);

    if (recipe && hasFuel && canOutput) {
        if (fuelUsesRemaining <= 0) {
            fuelUsesRemaining = getFuelValue(furnaceFuel.type);
            furnaceFuel.count--;
            if (furnaceFuel.count <= 0) furnaceFuel = { type: 0, count: 0 };
        }
        smeltActive = true;
        smeltProgress += dt / SMELT_TIME;
        if (smeltProgress >= 1) {
            smeltProgress = 0;
            furnaceInput.count--;
            if (furnaceInput.count <= 0) furnaceInput = { type: 0, count: 0 };
            fuelUsesRemaining--;
            if (furnaceOutput.count === 0) furnaceOutput = { type: recipe.type, count: 1 };
            else furnaceOutput.count++;
        }
    } else {
        smeltActive = false;
        if (!recipe || !canOutput) smeltProgress = 0;
    }

    renderFurnaceUI();
}
