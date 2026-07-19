/* js/furnace.js – Ofen-System: Zustand, Schmelz-Logik, UI */
import { BLOCK_TYPES, BLOCK_TEX, atlasDataURL } from './blocks.js?v=20260717y';
import { createBlockHTML, getItemName, inventorySlots } from './inventory.js?v=20260719b';
import { Game } from './Game.js?v=20260716b';
import { activateDialog, deactivateDialog } from './dialogFocus.js?v=20260718b';

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

function createFurnaceState() {
    return {
        input: { type: 0, count: 0 },
        fuel: { type: 0, count: 0 },
        output: { type: 0, count: 0 },
        fuelUsesRemaining: 0,
        activeFuelType: 0,
        smeltProgress: 0,
        smeltActive: false,
        lastTick: 0,
    };
}

function getFurnaceKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

const furnaceStates = new Map();
let furnaceOpen = false;
let furnacePos = null;
let furnaceState = null;
let activeTarget = 'input';
let renderedInventorySignature = '';

export function openFurnace(x, y, z, controls) {
    furnacePos = { x, y, z };
    const key = getFurnaceKey(x, y, z);
    if (!furnaceStates.has(key)) furnaceStates.set(key, createFurnaceState());
    furnaceState = furnaceStates.get(key);
    furnaceState.smeltActive = false;
    furnaceOpen = true;
    furnaceState.lastTick = performance.now();
    activeTarget = 'input';
    renderedInventorySignature = '';
    const overlay = document.getElementById('furnace-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        activateDialog(overlay, '.panel-close-button');
    }
    if (controls && controls.isLocked) controls.unlock();
    renderFurnaceUI();
}

export function closeFurnace(controls) {
    furnaceOpen = false;
    if (furnaceState) furnaceState.smeltActive = false;
    const overlay = document.getElementById('furnace-overlay');
    deactivateDialog(overlay);
    if (overlay) overlay.style.display = 'none';
    if (controls && !Game.touchActive) {
        if (typeof window.resumeGame === 'function') window.resumeGame();
        else controls.lock();
    }
}

window.closeFurnace = () => closeFurnace(window._furnaceControls);

export function isFurnaceOpen() { return furnaceOpen; }

function renderFurnaceUI() {
    if (!furnaceState) return;
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
        const targetName = elId === 'furnace-input-slot' ? 'input' : elId === 'furnace-fuel-slot' ? 'fuel' : null;
        el.classList.toggle('furnace-target-active', targetName === activeTarget);
        if (targetName) el.setAttribute('aria-pressed', String(targetName === activeTarget));
        el.onclick = () => handleFurnaceSlotClick(elId);
    };
    renderSlot('furnace-input-slot', furnaceState.input);
    renderSlot('furnace-fuel-slot', furnaceState.fuel);
    renderSlot('furnace-output-slot', furnaceState.output);
    renderFurnaceInventory();
    renderFurnaceProgress();
}

function renderFurnaceInventory() {
    const grid = document.getElementById('furnace-inventory-grid');
    if (!grid || !furnaceState) return;

    const targetSlot = furnaceState[activeTarget];
    const selectionTitle = document.getElementById('furnace-selection-title');
    if (selectionTitle) {
        selectionTitle.textContent = activeTarget === 'input'
            ? 'Schmelzen / Garen: geeigneten Gegenstand wählen'
            : 'Brennstoff: geeigneten Gegenstand wählen';
    }
    const signature = `${activeTarget}:${targetSlot.type}:${targetSlot.count}|` +
        inventorySlots.map(item => `${item?.type || 0}:${item?.count || 0}`).join('|');
    if (signature === renderedInventorySignature) return;
    renderedInventorySignature = signature;
    grid.innerHTML = '';

    let itemCount = 0;
    inventorySlots.forEach((item, index) => {
        if (index >= 8 && index <= 15) return;
        if (!item || item.count <= 0) return;
        const acceptsType = activeTarget === 'input' ? Boolean(SMELT_RECIPES[item.type]) : getFuelValue(item.type) > 0;
        if (!acceptsType) return;
        itemCount++;
        const canStack = targetSlot.count === 0 || targetSlot.type === item.type;
        const optionDescription = activeTarget === 'input'
            ? `${getItemName(item.type)} → ${getItemName(SMELT_RECIPES[item.type].type)}`
            : `${getItemName(item.type)} · ${getFuelValue(item.type)} Ladungen`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inv-slot furnace-inventory-item';
        button.dataset.furnaceInventoryIndex = String(index);
        button.disabled = !canStack || targetSlot.count >= 64;
        button.setAttribute('aria-label', `${optionDescription}, ${item.count} Stück`);
        button.title = button.disabled ? `${optionDescription} · zuerst belegten Slot leeren` : optionDescription;
        button.innerHTML = createBlockHTML(item.type);
        const count = document.createElement('span');
        count.className = 'slot-count';
        count.textContent = item.count > 1 ? item.count : '';
        button.appendChild(count);
        button.onclick = () => moveInventoryStackToTarget(index);
        grid.appendChild(button);
    });

    if (itemCount === 0) {
        const empty = document.createElement('div');
        empty.className = 'furnace-inventory-empty';
        empty.textContent = activeTarget === 'input'
            ? 'Kein schmelz- oder garbarer Gegenstand im Inventar'
            : 'Kein Brennstoff im Inventar';
        grid.appendChild(empty);
    }
}

function renderFurnaceProgress() {
    if (!furnaceState) return;
    const bar = document.getElementById('furnace-progress-bar');
    if (bar) bar.style.width = (furnaceState.smeltProgress * 100).toFixed(1) + '%';
    const reserve = document.getElementById('furnace-fuel-reserve');
    if (reserve) {
        reserve.textContent = furnaceState.fuelUsesRemaining > 0
            ? `🔥 Aktiv: ${getItemName(furnaceState.activeFuelType)} · ${furnaceState.fuelUsesRemaining} Ladungen`
            : 'Keine aktive Brennstoffladung';
        reserve.classList.toggle('active', furnaceState.fuelUsesRemaining > 0);
    }
    const status = document.getElementById('furnace-status');
    if (status) {
        const fuelStatus = furnaceState.fuelUsesRemaining > 0 ? ` · Brennstoff: ${furnaceState.fuelUsesRemaining}` : '';
        const recipe = furnaceState.input.count > 0 ? SMELT_RECIPES[furnaceState.input.type] : null;
        const outputBlocked = recipe && furnaceState.output.count > 0 &&
            (furnaceState.output.type !== recipe.type || furnaceState.output.count >= 64);
        if (furnaceState.smeltActive) status.textContent = 'Verarbeitet... ' + Math.round(furnaceState.smeltProgress * 100) + '%' + fuelStatus;
        else if (outputBlocked) status.textContent = 'Ausgabe leeren';
        else if (furnaceState.input.count > 0 && recipe && furnaceState.fuelUsesRemaining <= 0 && furnaceState.fuel.count <= 0) status.textContent = 'Warte auf Brennstoff';
        else if (furnaceState.fuelUsesRemaining > 0) status.textContent = `Bereit · Brennstoff: ${furnaceState.fuelUsesRemaining}`;
        else if (furnaceState.input.count > 0 && !recipe) status.textContent = 'Kein Rezept';
        else status.textContent = 'Bereit';
    }
}

function handleFurnaceSlotClick(slotId) {
    if (!furnaceState) return;
    if (slotId === 'furnace-output-slot') {
        if (furnaceState.output.count > 0) {
            furnaceState.output = returnItemToInventory(furnaceState.output);
            if (window.updateInventoryUI) window.updateInventoryUI();
        }
    } else {
        const targetName = slotId === 'furnace-fuel-slot' ? 'fuel' : 'input';
        const targetSlot = furnaceState[targetName];
        if (activeTarget === targetName && targetSlot.count > 0) {
            furnaceState[targetName] = returnItemToInventory(targetSlot);
        } else {
            activeTarget = targetName;
        }
    }
    renderedInventorySignature = '';
    renderFurnaceUI();
}

function returnItemToInventory(item) {
    if (!window.addItemToInventory) return item;
    const result = window.addItemToInventory(item.type, item.count);
    if (!result || result.remaining <= 0) return { type: 0, count: 0 };
    return { type: item.type, count: result.remaining };
}

function moveInventoryStackToTarget(sourceIndex) {
    if (!furnaceState) return false;
    const source = inventorySlots[sourceIndex];
    const targetSlot = furnaceState[activeTarget];
    if (!source || source.count <= 0 || targetSlot.count >= 64) return false;

    const acceptsType = activeTarget === 'input' ? Boolean(SMELT_RECIPES[source.type]) : getFuelValue(source.type) > 0;
    if (!acceptsType || (targetSlot.count > 0 && targetSlot.type !== source.type)) return false;

    const moved = Math.min(source.count, 64 - targetSlot.count);
    if (targetSlot.count === 0) targetSlot.type = source.type;
    targetSlot.count += moved;
    source.count -= moved;
    if (source.count <= 0) {
        source.type = 0;
        source.count = 0;
    }
    renderedInventorySignature = '';
    if (window.updateInventoryUI) window.updateInventoryUI();
    renderFurnaceUI();
    return true;
}

// Tick-Funktion — wird jeden Frame aus dem Game-Loop aufgerufen
export function tickFurnace(controls) {
    window._furnaceControls = controls;
    if (!furnaceOpen || !furnaceState) return;

    const now = performance.now();
    const dt = now - furnaceState.lastTick;
    furnaceState.lastTick = now;

    const recipe = furnaceState.input.count > 0 ? SMELT_RECIPES[furnaceState.input.type] : null;
    const hasFuel = furnaceState.fuelUsesRemaining > 0 || furnaceState.fuel.count > 0;
    const canOutput = furnaceState.output.count === 0 || (recipe && furnaceState.output.type === recipe.type && furnaceState.output.count < 64);
    let slotsChanged = false;

    if (recipe && hasFuel && canOutput) {
        if (furnaceState.fuelUsesRemaining <= 0) {
            furnaceState.activeFuelType = furnaceState.fuel.type;
            furnaceState.fuelUsesRemaining = getFuelValue(furnaceState.fuel.type);
            furnaceState.fuel.count--;
            if (furnaceState.fuel.count <= 0) furnaceState.fuel = { type: 0, count: 0 };
            slotsChanged = true;
        }
        furnaceState.smeltActive = true;
        furnaceState.smeltProgress += dt / SMELT_TIME;
        if (furnaceState.smeltProgress >= 1) {
            furnaceState.smeltProgress = 0;
            furnaceState.input.count--;
            if (furnaceState.input.count <= 0) furnaceState.input = { type: 0, count: 0 };
            furnaceState.fuelUsesRemaining--;
            if (furnaceState.fuelUsesRemaining <= 0) furnaceState.activeFuelType = 0;
            if (furnaceState.output.count === 0) furnaceState.output = { type: recipe.type, count: 1 };
            else furnaceState.output.count++;
            slotsChanged = true;
        }
    } else {
        furnaceState.smeltActive = false;
        if (!recipe || !canOutput) furnaceState.smeltProgress = 0;
    }

    if (slotsChanged) {
        renderedInventorySignature = '';
        renderFurnaceUI();
    } else {
        renderFurnaceProgress();
    }
}
