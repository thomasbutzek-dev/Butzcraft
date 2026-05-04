/* js/inventory.js - Butzcraft Inventory Module */
import { craftingGridData, craftingResultData, checkCrafting } from './crafting.js';
import { craftingRecipes } from './recipes.js';
import { initRecipeBook } from './recipe_book.js';
import { BLOCK_TYPES, BLOCK_TEX, atlasDataURL } from './blocks.js';
import { SoundManager } from './sound.js';

// Sprint 6: Tooltip-Hint für essbare Items.
// Quelle der Wahrheit für Hunger-Werte ist PlayerInteraction.handleInteraction (Type-Match-Switch).
// Hier dupliziert für UI-Anzeige — bei Änderung BEIDE Stellen synchron halten oder nach
// CONFIG.GAMEPLAY zentralisieren (Future-Work).
const HUNGER_RESTORES = {
    17: 5,   // EGG
    18: 15,  // MILK
    21: 10,  // FISH
    22: 15,  // MEAT
    23: 10,  // CHICKEN
    24: 5,   // ROTTEN_FLESH (30% Schaden-Risiko!)
    25: 12,  // MUTTON
    51: 8,   // BERRIES
    55: 12   // TURTLE_MEAT
};
function buildItemTooltip(name, type) {
    let tip = name;
    const hunger = HUNGER_RESTORES[type];
    if (hunger !== undefined) {
        tip += `\n+${hunger} Hunger`;
        if (type === 24) tip += ' (30% Risiko: -5 HP!)';
    }
    return tip;
}

export const inventorySlots = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
export let cursorItem = { type: 0, count: 0 };
export let selectedSlot = 0;
export let inventoryOpened = false;

// Temporäre Migrations-Map für altes Speichersystem
export const oldInventoryMap = { 1: 0, 2: 1, 3: 2, 7: 3, 5: 4, 6: 5, 11: 6, 12: 7, 15: 8, 16: 9, 17: 10, 18: 11 };

const TRANSLATIONS = {
    'STONE': 'Stein', 'DIRT': 'Erde', 'GRASS': 'Gras', 'WOOD': 'Eichenholz',
    'LEAVES': 'Eichenblätter', 'SAND': 'Sand', 'ICE': 'Eis', 'SNOW': 'Schnee',
    'WATER': 'Wasser', 'EGG': 'Ei', 'MEAT': 'Fleisch', 'MILK': 'Milch', 'WOOL': 'Wolle', 'FISH': 'Roher Fisch', 'RAW_MEAT': 'Rohes Fleisch', 'RAW_CHICKEN': 'Rohes Hähnchen', 'ROTTEN_FLESH': 'Zombie-Innereien', 'MUTTON': 'Hammelfleisch', 'BONE': 'Knochen',
    'FLOWER_RED': 'Rote Blume', 'FLOWER_YELLOW': 'Gelbe Blume', 'CLOUD': 'Wolke',
    'JUNGLE_WOOD': 'Dschungelholz', 'JUNGLE_LEAVES': 'Dschungelblätter', 
    'PALM_WOOD': 'Palmenholz', 'PALM_LEAVES': 'Palmenblätter', 'BEDROCK': 'Grundgestein',
    'PLANKS': 'Holzbretter', 'STICK': 'Stock', 'WORKBENCH': 'Werkbank', 'STONE_BRICK': 'Steinziegel', 'SANDSTONE': 'Sandstein', 'WORKBENCH_SIDE': 'Werkbank-Teil',
    'WINDOW': 'Fenster', 'DOOR_BOTTOM': 'Tür', 'DOOR_TOP': 'Tür-Oberteil', 'BED_HEAD': 'Bett', 'BED_FOOT': 'Bett-Fußteil',
    'BERRY_BUSH': 'Beerenbusch', 'TALL_GRASS': 'Hohes Gras', 'CACTUS': 'Kaktus', 'DEAD_BUSH': 'Toter Strauch',
    'MUSHROOM_RED': 'Roter Pilz', 'MUSHROOM_BROWN': 'Brauner Pilz', 'SUGARCANE': 'Zuckerrohr',
    'FERN': 'Farn', 'BERRIES': 'Beeren', 'BERRY_BUSH_EMPTY': 'Leerer Beerenbusch', 'SEAGRASS': 'Seegras', 'TURTLE_MEAT': 'Schildkrötenfleisch',
    'COAL_ORE': 'Kohle-Erz', 'IRON_ORE': 'Eisen-Erz', 'GOLD_ORE': 'Gold-Erz', 'FURNACE': 'Ofen',
    'COAL': 'Kohle', 'IRON_INGOT': 'Eisenbarren', 'GOLD_INGOT': 'Goldbarren',
    'WOOD_PICKAXE': 'Holz-Spitzhacke', 'STONE_PICKAXE': 'Stein-Spitzhacke', 'IRON_PICKAXE': 'Eisen-Spitzhacke', 'GOLD_PICKAXE': 'Gold-Spitzhacke',
    'WOOD_AXE': 'Holz-Axt', 'STONE_AXE': 'Stein-Axt', 'IRON_AXE': 'Eisen-Axt', 'GOLD_AXE': 'Gold-Axt',
    'WOOD_SHOVEL': 'Holz-Schaufel', 'STONE_SHOVEL': 'Stein-Schaufel', 'IRON_SHOVEL': 'Eisen-Schaufel', 'GOLD_SHOVEL': 'Gold-Schaufel',
    'CHEST': 'Truhe', 'SNOW_BLOCK': 'Schneeblock', 'ICE_BLOCK': 'Eisblock', 'PRESSURE_PLATE': 'Druckplatte', 'MINE_RAIL': 'Minengleis', 'MINE_SUPPORT': 'Minenbalken', 'SANDSTONE_CARVED': 'Gravierter Sandstein'
};


export function setSelectedSlot(idx) {
    selectedSlot = idx;
}

export function getSelectedSlot() {
    return selectedSlot;
}

export function isInventoryOpened() {
    return inventoryOpened;
}

export function addItemToInventory(type, count) {
    if (type === 0) return;
    for (let i = 0; i < 64; i++) {
        if (i >= 8 && i <= 15) continue; 
        if (inventorySlots[i].type === type && inventorySlots[i].count < 64) {
            const add = Math.min(count, 64 - inventorySlots[i].count);
            inventorySlots[i].count += add;
            count -= add;
            if (count <= 0) { updateInventoryUI(); return; }
        }
    }
    for (let i = 0; i < 64; i++) {
        if (i >= 8 && i <= 15) continue;
        if (inventorySlots[i].type === 0 || inventorySlots[i].count <= 0) {
            const add = Math.min(count, 64);
            inventorySlots[i] = { type: type, count: add };
            count -= add;
            if (count <= 0) { updateInventoryUI(); return; }
        }
    }
    updateInventoryUI();
}

export function updateInventoryUI() {
        const createBlockHTML = (type) => {
        if (type === 21) return `<div class="flat-icon" style="font-size:24px; display:flex; justify-content:center; align-items:center; width:100%; height:100%; text-shadow:1px 1px 0 #000;">🐟</div>`;
        if (type === 22) return `<div class="flat-icon" style="font-size:24px; display:flex; justify-content:center; align-items:center; width:100%; height:100%; text-shadow:1px 1px 0 #000;">🥩</div>`;
        if (type === 23) return `<div class="flat-icon" style="font-size:24px; display:flex; justify-content:center; align-items:center; width:100%; height:100%; text-shadow:1px 1px 0 #000;">🍗</div>`;
        if (type === 24) return `<div class="flat-icon" style="font-size:24px; display:flex; justify-content:center; align-items:center; width:100%; height:100%; text-shadow:1px 1px 0 #000;">🧟</div>`;
        if (type === 25) return `<div class="flat-icon" style="font-size:24px; display:flex; justify-content:center; align-items:center; width:100%; height:100%; text-shadow:1px 1px 0 #000;">🍖</div>`;

        const is2D = (type === 9 || type === 10 || type === 17 || type === 18 || type === 19 || type === 21 || type === 22 || type === 23 || type === 24 || type === 25 || type === 27 || type === 31
            || (type >= 60 && type <= 74)); // Kohle, Barren, Werkzeuge als 2D-Icons
        let texIdx = 0;
        if (type === 17) texIdx = 21; else if (type === 18) texIdx = 23; else if (type === 19) texIdx = 26; else texIdx = BLOCK_TEX[type] || 0;
        const u = (texIdx % 16) * 100 / 15; const v = Math.floor(texIdx / 16) * 100 / 15;
        const bgPos = `${u}% ${v}%`;
        if (is2D) return `<div class="flat-icon" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>`;
        else return `<div class="mc-cube"><div class="mc-face mc-top" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-front" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-right" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div></div>`;
    };

    const hotbarSlots = document.querySelectorAll('#inventory .slot');
    hotbarSlots.forEach((slot, i) => {
        const item = inventorySlots[i];
        let keyHint = slot.querySelector('.key-hint');
        let icon = slot.querySelector('.slot-color-preview');
        let count = slot.querySelector('.slot-count');
        let name = slot.querySelector('.slot-name');
        if (!slot.dataset.initialized) {
            slot.innerHTML = '';
            keyHint = document.createElement('span'); keyHint.className = 'key-hint'; keyHint.textContent = (i + 1); keyHint.style.pointerEvents = 'none';
            icon = document.createElement('div'); icon.className = 'slot-color-preview'; icon.style.pointerEvents = 'none'; icon.style.background = 'none'; icon.style.display = 'flex'; icon.style.justifyContent = 'center';
            count = document.createElement('span'); count.className = 'slot-count'; count.style.pointerEvents = 'none';
            name = document.createElement('span'); name.className = 'slot-name'; name.style.pointerEvents = 'none';
            slot.append(keyHint, icon, count, name);
            slot.dataset.initialized = 'true';
        }
        if (item && item.count > 0) {
            icon.style.display = 'flex'; count.style.display = 'block'; name.style.display = 'block';
            icon.innerHTML = createBlockHTML(item.type); icon.style.background = 'none'; icon.style.backgroundColor = 'transparent';
            if (count.textContent !== String(item.count)) count.textContent = item.count;
            const bName = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === item.type) || '';
            const translatedName = TRANSLATIONS[bName] ? TRANSLATIONS[bName].toUpperCase() : bName.toUpperCase();
            if (name.textContent !== translatedName) name.textContent = translatedName;
            slot.title = buildItemTooltip(TRANSLATIONS[bName] || bName, item.type);
        } else {
            icon.style.display = 'none'; count.style.display = 'none'; name.style.display = 'none'; slot.title = '';
        }
        if (i === selectedSlot) { if (!slot.classList.contains('active')) slot.classList.add('active'); } else { if (slot.classList.contains('active')) slot.classList.remove('active'); }
    });

    const gridSlots = document.querySelectorAll('.inv-slot');
    gridSlots.forEach((slot) => {
        const sType = slot.dataset.slottype;
        const i = parseInt(slot.dataset.index);
        let item = null;
        if (sType === 'inventory') item = inventorySlots[i];
        else if (sType === 'crafting') item = craftingGridData[i];
        else if (sType === 'result') item = craftingResultData;
        
        if (!slot.dataset.initializedGrid) {
            slot.innerHTML = '';
            let iconElement = document.createElement('div');
            iconElement.className = 'slot-color-preview'; 
            iconElement.style.pointerEvents = 'none';
            let countElement = document.createElement('span');
            countElement.className = 'slot-count'; 
            countElement.style.pointerEvents = 'none';
            countElement.style.right = '4px';
            countElement.style.bottom = '4px';
            slot.append(iconElement, countElement);
            slot.dataset.initializedGrid = 'true';
        }

        const icon = slot.querySelector('.slot-color-preview');
        const count = slot.querySelector('.slot-count');

        if (item && item.count > 0) {
            icon.style.display = 'flex'; count.style.display = 'block';
            icon.innerHTML = createBlockHTML(item.type);
            if (count.textContent !== String(item.count)) count.textContent = item.count;
            const bName = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === item.type) || '';
            slot.title = buildItemTooltip(TRANSLATIONS[bName] || bName, item.type);
        } else {
            icon.style.display = 'none'; count.style.display = 'none';
            icon.innerHTML = ''; slot.title = '';
        }
    });
}

function handleSlotClick(e, sType, index) {
    if (e.button !== 0 && e.button !== 2) return; 
    
    let itemObj = null;
    if (sType === 'inventory') itemObj = inventorySlots[index];
    else if (sType === 'crafting') itemObj = craftingGridData[index];
    else if (sType === 'result') itemObj = craftingResultData;
    
    if (!itemObj) return;

    if (sType === 'result') {
        if (itemObj.count > 0 && (cursorItem.count === 0 || (cursorItem.type === itemObj.type && cursorItem.count + itemObj.count <= 64))) {
            if (e.button === 0 || e.button === 2) {
                if (cursorItem.count === 0) cursorItem.type = itemObj.type;
                cursorItem.count += itemObj.count;
                itemObj.count = 0;
                itemObj.type = 0;

                for (let i = 0; i < 9; i++) {
                    if (craftingGridData[i] && craftingGridData[i].count > 0) {
                        craftingGridData[i].count--;
                        if (craftingGridData[i].count <= 0) craftingGridData[i].type = 0;
                    }
                }
                checkCrafting();
                updateInventoryUI();
                // Crafting-Click: dig_wood bei hoher Pitch klingt wie ein Werkbank-Klick.
                // Vorher: step_grass — semantisch falsch (Schritte beim Craften?).
                SoundManager.playSound('dig_wood', 0.4, 1.8);
            }
        }
        return;
    }

    if (e.button === 0) { 
        if (cursorItem.count === 0) {
            if (itemObj.count > 0) {
                cursorItem.type = itemObj.type; cursorItem.count = itemObj.count;
                itemObj.type = 0; itemObj.count = 0;
            }
        } else {
            if (itemObj.count === 0) {
                itemObj.type = cursorItem.type; itemObj.count = cursorItem.count;
                cursorItem.type = 0; cursorItem.count = 0;
            } else if (itemObj.type === cursorItem.type) {
                const space = 64 - itemObj.count;
                if (space > 0) {
                    const add = Math.min(space, cursorItem.count);
                    itemObj.count += add;
                    cursorItem.count -= add;
                    if (cursorItem.count <= 0) cursorItem.type = 0;
                }
            } else {
                const tempType = itemObj.type, tempCount = itemObj.count;
                itemObj.type = cursorItem.type; itemObj.count = cursorItem.count;
                cursorItem.type = tempType; cursorItem.count = tempCount;
            }
        }
    } else if (e.button === 2) { 
        if (cursorItem.count === 0) {
            if (itemObj.count > 0) {
                const half = Math.ceil(itemObj.count / 2);
                cursorItem.type = itemObj.type; cursorItem.count = half;
                itemObj.count -= half;
                if (itemObj.count <= 0) itemObj.type = 0;
            }
        } else {
            if (itemObj.count === 0) {
                itemObj.type = cursorItem.type; itemObj.count = 1;
                cursorItem.count--;
                if (cursorItem.count <= 0) cursorItem.type = 0;
            } else if (itemObj.type === cursorItem.type && itemObj.count < 64) {
                itemObj.count++;
                cursorItem.count--;
                if (cursorItem.count <= 0) cursorItem.type = 0;
            }
        }
    }
    
    if (sType === 'crafting') checkCrafting();
    updateInventoryUI();
    
    document.dispatchEvent(new MouseEvent('mousemove', {clientX: e.clientX, clientY: e.clientY}));
}

export function createSlotElement(i, sType = 'inventory') {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.dataset.index = i;
    slot.dataset.slottype = sType;
    
    const iconContainer = document.createElement('div');
    iconContainer.className = 'slot-icon'; iconContainer.style.position = 'absolute'; iconContainer.style.left = '14px'; iconContainer.style.top = '14px'; iconContainer.style.transform = 'translateZ(10px)';
    iconContainer.style.borderRadius = '4px';
    iconContainer.style.width = '32px';
    iconContainer.style.height = '32px';
    iconContainer.style.display = 'none';
    iconContainer.style.alignItems = 'center'; 
    iconContainer.style.justifyContent = 'center';
    iconContainer.style.pointerEvents = 'none';
    slot.appendChild(iconContainer);
    
    const countLabel = document.createElement('div');
    countLabel.className = 'slot-count-label'; countLabel.style.transform = 'translateZ(10px)';
    countLabel.style.position = 'absolute';
    countLabel.style.bottom = '2px';
    countLabel.style.right = '4px';
    countLabel.style.fontSize = '12px';
    countLabel.style.color = 'white';
    countLabel.style.textShadow = '1px 1px 0 #000';
    countLabel.style.display = 'none';
    countLabel.style.pointerEvents = 'none';
    slot.appendChild(countLabel);
    
    slot.addEventListener('mousedown', (e) => handleSlotClick(e, sType, i));
    slot.addEventListener('contextmenu', (e) => e.preventDefault());
    
    return slot;
}

export function initInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    
    const cGrid = document.getElementById('crafting-grid');
    const cResult = document.getElementById('crafting-result');
    cGrid.innerHTML = ''; cResult.innerHTML = '';
    
    for (let i = 0; i < 9; i++) cGrid.appendChild(createSlotElement(i, 'crafting'));
    cResult.appendChild(createSlotElement(0, 'result'));

    const hbTitle = document.createElement('div');
    hbTitle.className = 'inv-section-title';
    hbTitle.textContent = 'Hotbar';
    grid.appendChild(hbTitle);

    for (let i = 0; i < 8; i++) {
        grid.appendChild(createSlotElement(i, 'inventory'));
    }

    const divider = document.createElement('div');
    divider.id = 'inventory-divider';
    grid.appendChild(divider);

    const invTitle = document.createElement('div');
    invTitle.className = 'inv-section-title';
    invTitle.textContent = 'Hauptinventar';
    grid.appendChild(invTitle);

    for (let i = 16; i < 64; i++) {
        grid.appendChild(createSlotElement(i, 'inventory'));
    }
}

export function toggleInventory(gameStarted, spawning, controls) {
    if (!gameStarted || spawning) return false;
    inventoryOpened = !inventoryOpened;
    
    // Rezeptbuch initialisieren/umbauen
    if (inventoryOpened) {
        initRecipeBook(atlasDataURL, BLOCK_TEX, craftingRecipes, BLOCK_TYPES, TRANSLATIONS);
        if(window.updateRecipeList) window.updateRecipeList();
    }
    
    document.getElementById('inventory-overlay').style.display = inventoryOpened ? 'flex' : 'none';
    if (inventoryOpened) {
        if (!window.touchActive) controls.unlock();
        initInventoryGrid();
        updateInventoryUI();
    } else {
        if (!window.touchActive) controls.lock();
    }
    return inventoryOpened;
}

export function setupInventoryEvents() {
    // Hotbar-Slot per Klick/Tap auswählen (funktioniert auf Desktop und Mobile)
    const hotbarEl = document.getElementById('inventory');
    if (hotbarEl) {
        hotbarEl.addEventListener('click', (e) => {
            const slotEl = e.target.closest('.slot[data-slot]');
            if (!slotEl) return;
            const idx = parseInt(slotEl.dataset.slot, 10);
            if (!isNaN(idx) && idx >= 0 && idx < 8) {
                selectedSlot = idx;
                updateInventoryUI();
            }
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!inventoryOpened) return;
        const cursorEl = document.getElementById('cursor-item');
        if (cursorItem.count > 0 && cursorItem.type > 0) {
            cursorEl.style.display = 'block';
            cursorEl.style.left = e.clientX + 'px';
            cursorEl.style.top = e.clientY + 'px';
            
            const is2D = (cursorItem.type === 9 || cursorItem.type === 10 || cursorItem.type === 17 || cursorItem.type === 18 || cursorItem.type === 19);
            let texIdx = 0;
            if (cursorItem.type === 17) texIdx = 21; else if (cursorItem.type === 18) texIdx = 23; else if (cursorItem.type === 19) texIdx = 26; else texIdx = BLOCK_TEX[cursorItem.type] || 0;
            const u = (texIdx % 16) * 100 / 15; const v = Math.floor(texIdx / 16) * 100 / 15;
            const bgPos = `${u}% ${v}%`;
            
            const iconDiv = cursorEl.querySelector('.cursor-icon');
            iconDiv.innerHTML = is2D ? `<div class="flat-icon" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>` 
                                     : `<div class="mc-cube"><div class="mc-face mc-top" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-front" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-right" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div></div>`;
            cursorEl.querySelector('.cursor-count').textContent = cursorItem.count > 1 ? cursorItem.count : '';
        } else {
            cursorEl.style.display = 'none';
        }
    });
}
