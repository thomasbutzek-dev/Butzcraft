/* js/inventory.js - Butzcraft Inventory Module */
import { craftingGridData, craftingResultData, checkCrafting, setCraftingGridSize } from './crafting.js?v=20260721b';
import { craftingRecipes, getRecipeTrustLockReason } from './recipes.js?v=20260723e';
import { initRecipeBook } from './recipe_book.js?v=20260723e';
import { BLOCK_TYPES, BLOCK_TEX, atlasDataURL } from './blocks.js?v=20260723e';
import { SoundManager } from './sound.js?v=20260507b';
import { Game } from './Game.js?v=20260716b';
import { getToolInfo } from './miningRules.js?v=20260716a';
import { getBowInfo, getSwordInfo } from './combatRules.js?v=20260716b';
import { getFoodInfo } from './foodRules.js?v=20260723e';
import { getArmorIconHTML, getArmorInfo } from './equipmentRules.js?v=20260723e';
import { activateDialog, deactivateDialog } from './dialogFocus.js?v=20260718b';

function getDurableItemInfo(type) {
    return getToolInfo(type) || getSwordInfo(type) || getBowInfo(type) || getArmorInfo(type);
}

function isDurableItemType(type) {
    return getDurableItemInfo(type) !== null;
}

// Sprint 6: Tooltip-Hint für essbare Items.
// Quelle der Wahrheit für Hunger-Werte ist PlayerInteraction.handleInteraction (Type-Match-Switch).
// Hier dupliziert für UI-Anzeige — bei Änderung BEIDE Stellen synchron halten oder nach
// CONFIG.GAMEPLAY zentralisieren (Future-Work).
function buildItemTooltip(name, type) {
    let tip = name;
    const armor = getArmorInfo(type);
    if (armor) {
        tip += `\n${Math.round(armor.protection * 100)}% Schutz · ${armor.slot === 'body' ? 'Körper' : armor.slot}`;
    }
    const food = getFoodInfo(type);
    if (food) {
        tip += `\n+${food.hunger} Hunger`;
        if (food.damageChance) tip += ` (${Math.round(food.damageChance * 100)}% Risiko: -${food.damage} HP!)`;
    }
    return tip;
}

export const inventorySlots = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
export let cursorItem = { type: 0, count: 0 };
export let selectedSlot = 0;
export let inventoryOpened = false;
export let craftingStation = 'inventory';

export function getCraftingStation() {
    return craftingStation;
}

function clearItem(item) {
    item.type = 0;
    item.count = 0;
    delete item.durability;
    delete item.spoilAt;
}

function moveItem(target, source) {
    target.type = source.type;
    target.count = source.count;
    if (Number.isFinite(source.durability)) target.durability = source.durability;
    else delete target.durability;
    if (Number.isFinite(source.spoilAt)) target.spoilAt = source.spoilAt;
    else delete target.spoilAt;
    clearItem(source);
}

function swapItems(first, second) {
    const snapshot = { ...first };
    first.type = second.type;
    first.count = second.count;
    if (Number.isFinite(second.durability)) first.durability = second.durability;
    else delete first.durability;
    if (Number.isFinite(second.spoilAt)) first.spoilAt = second.spoilAt;
    else delete first.spoilAt;
    second.type = snapshot.type;
    second.count = snapshot.count;
    if (Number.isFinite(snapshot.durability)) second.durability = snapshot.durability;
    else delete second.durability;
    if (Number.isFinite(snapshot.spoilAt)) second.spoilAt = snapshot.spoilAt;
    else delete second.spoilAt;
}

function mergeSpoilage(target, source) {
    const deadlines = [target.spoilAt, source.spoilAt].filter(Number.isFinite);
    if (deadlines.length > 0) target.spoilAt = Math.min(...deadlines);
    else delete target.spoilAt;
}

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
    'CHEST': 'Truhe', 'SNOW_BLOCK': 'Schneeblock', 'ICE_BLOCK': 'Eisblock', 'PRESSURE_PLATE': 'Druckplatte', 'MINE_RAIL': 'Minengleis', 'MINE_SUPPORT': 'Minenbalken', 'SANDSTONE_CARVED': 'Gravierter Sandstein',
    'SPAWNER': 'Mob-Spawner', 'MOSSY_STONE': 'Moosiger Stein', 'COBBLESTONE': 'Bruchstein', 'FIRE': 'Feuer', 'VILLAGE_PATH': 'Dorfweg', 'HAY_BALE': 'Strohballen',
    'WOOD_SWORD': 'Holzschwert', 'STONE_SWORD': 'Steinschwert', 'IRON_SWORD': 'Eisenschwert', 'GOLD_SWORD': 'Goldschwert',
    'STRING': 'Sehne', 'BOW': 'Bogen', 'ARROW': 'Pfeil',
    'COOKED_FISH': 'Gebratener Fisch', 'COOKED_MEAT': 'Gebratenes Fleisch', 'COOKED_CHICKEN': 'Gebratenes Hähnchen',
    'COOKED_MUTTON': 'Gebratenes Hammelfleisch', 'COOKED_TURTLE_MEAT': 'Gebratenes Schildkrötenfleisch',
    'TORCH': 'Fackel', 'WOOD_FENCE': 'Holzzaun', 'WOOD_GATE': 'Holzgatter', 'VILLAGE_LANTERN': 'Dorflaterne',
    'POLAR_BEAR_FUR': 'Eisbärenfell', 'SPOILED_FOOD': 'Verdorbene Nahrung'
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

const TOUCH_LONG_PRESS_MS = 420;
const TOUCH_MOVE_CANCEL_PX = 10;

export function canAddItemToInventory(type, count) {
    if (type === 0 || count <= 0) return false;
    if (isDurableItemType(type)) {
        let freeSlots = 0;
        for (let i = 0; i < inventorySlots.length; i++) {
            if (i >= 8 && i <= 15) continue;
            const slot = inventorySlots[i];
            if (slot.type === 0 || slot.count <= 0) freeSlots++;
        }
        return freeSlots >= count;
    }
    let remaining = count;
    for (let i = 0; i < inventorySlots.length; i++) {
        if (i >= 8 && i <= 15) continue;
        const slot = inventorySlots[i];
        if (slot.type === type) remaining -= Math.max(0, 64 - slot.count);
        else if (slot.type === 0 || slot.count <= 0) remaining -= 64;
        if (remaining <= 0) return true;
    }
    return false;
}

export function tryAddItemsToInventory(items) {
    if (!Array.isArray(items) || items.length === 0) return { added: false, reason: 'invalid-items' };
    const snapshot = inventorySlots.map(slot => ({ ...slot }));

    for (const item of items) {
        if (!item || item.type === 0 || item.count <= 0) {
            for (let i = 0; i < inventorySlots.length; i++) inventorySlots[i] = snapshot[i];
            updateInventoryUI();
            return { added: false, reason: 'invalid-items' };
        }
        const result = addItemToInventory(item.type, item.count);
        if (result.remaining > 0) {
            for (let i = 0; i < inventorySlots.length; i++) inventorySlots[i] = snapshot[i];
            updateInventoryUI();
            return { added: false, reason: 'inventory-full' };
        }
    }

    return { added: true, reason: null };
}

export function tryExchangeInventory(give, receive) {
    const receiveItems = Array.isArray(receive?.items) ? receive.items : [receive];
    if (
        !give || give.type === 0 || give.count <= 0 ||
        receiveItems.length === 0 ||
        receiveItems.some(item => !item || item.type === 0 || item.count <= 0)
    ) {
        return { exchanged: false, reason: 'invalid-exchange' };
    }

    let available = 0;
    for (let i = 0; i < inventorySlots.length; i++) {
        if (i >= 8 && i <= 15) continue;
        if (inventorySlots[i].type === give.type) available += inventorySlots[i].count;
    }
    if (available < give.count) return { exchanged: false, reason: 'insufficient-items' };

    const snapshot = inventorySlots.map(slot => ({ ...slot }));
    let toRemove = give.count;
    for (let i = 0; i < inventorySlots.length && toRemove > 0; i++) {
        if (i >= 8 && i <= 15) continue;
        const slot = inventorySlots[i];
        if (slot.type !== give.type) continue;
        const remove = Math.min(slot.count, toRemove);
        slot.count -= remove;
        toRemove -= remove;
        if (slot.count <= 0) inventorySlots[i] = { type: 0, count: 0 };
    }

    for (const item of receiveItems) {
        const result = addItemToInventory(item.type, item.count);
        if (result.remaining > 0) {
            for (let i = 0; i < inventorySlots.length; i++) inventorySlots[i] = snapshot[i];
            updateInventoryUI();
            return { exchanged: false, reason: 'inventory-full' };
        }
    }

    return { exchanged: true, reason: null };
}

export function addItemToInventory(type, count) {
    if (type === 0) return { added: 0, remaining: count };
    const requestedCount = count;
    const durableInfo = getDurableItemInfo(type);
    if (durableInfo) {
        for (let i = 0; i < inventorySlots.length && count > 0; i++) {
            if (i >= 8 && i <= 15) continue;
            if (inventorySlots[i].type !== 0 && inventorySlots[i].count > 0) continue;
            inventorySlots[i] = { type, count: 1, durability: durableInfo.maxDurability };
            count--;
        }
        updateInventoryUI();
        return { added: requestedCount - count, remaining: count };
    }
    for (let i = 0; i < 64; i++) {
        if (i >= 8 && i <= 15) continue; 
        if (inventorySlots[i].type === type && inventorySlots[i].count < 64) {
            const add = Math.min(count, 64 - inventorySlots[i].count);
            inventorySlots[i].count += add;
            count -= add;
            if (count <= 0) {
                updateInventoryUI();
                return { added: requestedCount, remaining: 0 };
            }
        }
    }
    for (let i = 0; i < 64; i++) {
        if (i >= 8 && i <= 15) continue;
        if (inventorySlots[i].type === 0 || inventorySlots[i].count <= 0) {
            const add = Math.min(count, 64);
            inventorySlots[i] = { type: type, count: add };
            count -= add;
            if (count <= 0) {
                updateInventoryUI();
                return { added: requestedCount, remaining: 0 };
            }
        }
    }
    updateInventoryUI();
    return { added: requestedCount - count, remaining: count };
}

// Erzeugt HTML für ein Block-/Item-Icon (2D flat oder 3D Cube)
export function createBlockHTML(type) {
    if (getArmorInfo(type)) return getArmorIconHTML(type);
    const is2D = (type === 9 || type === 10 || type === 17 || type === 18 || type === 19 || type === 21 || type === 22 || type === 23 || type === 24 || type === 25 || type === 27 || type === 31
        || (type >= 60 && type <= 74) || (type >= 89 && type <= 101) || type === BLOCK_TYPES.POLAR_BEAR_FUR); // Kohle, Barren, Werkzeuge, Waffen, Nahrung, Fackel und Fell als 2D-Icons
    let texIdx = 0;
    if (type === 17) texIdx = 21; else if (type === 18) texIdx = 23; else if (type === 19) texIdx = 26; else texIdx = BLOCK_TEX[type] || 0;
    const u = (texIdx % 16) * 100 / 15; const v = Math.floor(texIdx / 16) * 100 / 15;
    const bgPos = `${u}% ${v}%`;
    if (is2D) return `<div class="flat-icon" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>`;
    else return `<div class="mc-cube"><div class="mc-face mc-top" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-front" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-right" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div></div>`;
}

// Gibt den deutschen Namen eines Block-Types zurück
export function getItemName(type) {
    const armor = getArmorInfo(type);
    if (armor) return armor.name;
    const bName = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === type) || '';
    return TRANSLATIONS[bName] || bName;
}

function buildSlotLabel(kind, index, item) {
    const prefix = `${kind} Slot ${index + 1}`;
    if (!item || item.count <= 0) return `${prefix} leer`;
    return `${prefix} ${getItemName(item.type)} x${item.count}`;
}

function updateDurabilityBar(slot, item) {
    let track = slot.querySelector('.durability-track');
    const durableInfo = item && item.count > 0 ? getDurableItemInfo(item.type) : null;
    if (!durableInfo) {
        if (track) track.remove();
        return false;
    }

    if (!track) {
        track = document.createElement('span');
        track.className = 'durability-track';
        const fill = document.createElement('span');
        fill.className = 'durability-fill';
        track.appendChild(fill);
        slot.appendChild(track);
    }
    const durability = Number.isFinite(item.durability) ? item.durability : durableInfo.maxDurability;
    const ratio = Math.max(0, Math.min(1, durability / durableInfo.maxDurability));
    track.querySelector('.durability-fill').style.width = `${Math.round(ratio * 100)}%`;
    track.classList.toggle('low', ratio <= 0.15);
    track.title = `Haltbarkeit ${Math.ceil(durability)}/${durableInfo.maxDurability}`;
    return true;
}

export function updateInventoryUI() {

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
            const durable = updateDurabilityBar(slot, item);
            icon.style.display = 'flex'; count.style.display = durable ? 'none' : 'block'; name.style.display = 'block';
            if (icon.dataset.itemType !== String(item.type) || !icon.firstElementChild) {
                icon.innerHTML = createBlockHTML(item.type);
                icon.dataset.itemType = String(item.type);
            }
            icon.style.background = 'none'; icon.style.backgroundColor = 'transparent';
            if (count.textContent !== String(item.count)) count.textContent = item.count;
            const translatedName = getItemName(item.type).toUpperCase();
            if (name.textContent !== translatedName) name.textContent = translatedName;
            slot.title = buildItemTooltip(getItemName(item.type), item.type);
        } else {
            updateDurabilityBar(slot, null);
            icon.style.display = 'none'; count.style.display = 'none'; name.style.display = 'none'; slot.title = buildSlotLabel('Hotbar', i, item);
        }
        slot.setAttribute('aria-label', buildSlotLabel('Hotbar', i, item));
        slot.setAttribute('role', 'button');
        slot.tabIndex = 0;
        if (i === selectedSlot) { if (!slot.classList.contains('active')) slot.classList.add('active'); } else { if (slot.classList.contains('active')) slot.classList.remove('active'); }
    });

    const gridSlots = document.querySelectorAll('.inv-slot');
    gridSlots.forEach((slot) => {
        const sType = slot.dataset.slottype;
        const i = parseInt(slot.dataset.index);
        if (!sType || Number.isNaN(i)) return;
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
            const durable = updateDurabilityBar(slot, item);
            icon.style.display = 'flex'; count.style.display = durable ? 'none' : 'block';
            if (icon.dataset.itemType !== String(item.type) || !icon.firstElementChild) {
                icon.innerHTML = createBlockHTML(item.type);
                icon.dataset.itemType = String(item.type);
            }
            if (count.textContent !== String(item.count)) count.textContent = item.count;
            slot.title = buildItemTooltip(getItemName(item.type), item.type);
        } else {
            updateDurabilityBar(slot, null);
            icon.style.display = 'none'; count.style.display = 'none';
            icon.innerHTML = '';
            delete icon.dataset.itemType;
            slot.title = buildSlotLabel(sType === 'inventory' ? 'Inventar' : sType === 'crafting' ? 'Crafting' : 'Ergebnis', i, item);
        }
        slot.setAttribute('aria-label', buildSlotLabel(sType === 'inventory' ? 'Inventar' : sType === 'crafting' ? 'Crafting' : 'Ergebnis', i, item));
    });

    const craftButton = document.getElementById('crafting-create-btn');
    if (craftButton) craftButton.disabled = craftingResultData.count <= 0;
}

window.addEventListener('butzcraft:atlas-ready', () => {
    document.querySelectorAll('.slot-color-preview .flat-icon, .slot-color-preview .mc-face').forEach(element => {
        element.style.backgroundImage = `url("${atlasDataURL}")`;
    });
});

function handleSlotClick(e, sType, index) {
    if (e.button !== 0 && e.button !== 2) return; 
    
    let itemObj = null;
    if (sType === 'inventory') itemObj = inventorySlots[index];
    else if (sType === 'crafting') itemObj = craftingGridData[index];
    else if (sType === 'result') itemObj = craftingResultData;
    
    if (!itemObj) return;

    if (sType === 'result') return;
    if (sType === 'crafting' && cursorItem.count > 0 && isDurableItemType(cursorItem.type)) {
        setCraftingStatus('Werkzeuge und Waffen sind keine Bastelzutaten.', 'error');
        return;
    }

    if (e.button === 0) { 
        if (cursorItem.count === 0) {
            if (itemObj.count > 0) {
                moveItem(cursorItem, itemObj);
            }
        } else {
            if (itemObj.count === 0) {
                moveItem(itemObj, cursorItem);
            } else if (itemObj.type === cursorItem.type && !isDurableItemType(itemObj.type)) {
                const space = 64 - itemObj.count;
                if (space > 0) {
                    const add = Math.min(space, cursorItem.count);
                    mergeSpoilage(itemObj, cursorItem);
                    itemObj.count += add;
                    cursorItem.count -= add;
                    if (cursorItem.count <= 0) clearItem(cursorItem);
                }
            } else {
                swapItems(itemObj, cursorItem);
            }
        }
    } else if (e.button === 2) { 
        if (cursorItem.count === 0) {
            if (itemObj.count > 0) {
                if (isDurableItemType(itemObj.type)) {
                    moveItem(cursorItem, itemObj);
                } else {
                    const half = Math.ceil(itemObj.count / 2);
                    cursorItem.type = itemObj.type;
                    cursorItem.count = half;
                    if (Number.isFinite(itemObj.spoilAt)) cursorItem.spoilAt = itemObj.spoilAt;
                    else delete cursorItem.spoilAt;
                    itemObj.count -= half;
                    if (itemObj.count <= 0) clearItem(itemObj);
                }
            }
        } else {
            if (itemObj.count === 0) {
                if (isDurableItemType(cursorItem.type)) {
                    moveItem(itemObj, cursorItem);
                } else {
                    itemObj.type = cursorItem.type;
                    itemObj.count = 1;
                    if (Number.isFinite(cursorItem.spoilAt)) itemObj.spoilAt = cursorItem.spoilAt;
                    else delete itemObj.spoilAt;
                    cursorItem.count--;
                    if (cursorItem.count <= 0) clearItem(cursorItem);
                }
            } else if (itemObj.type === cursorItem.type && !isDurableItemType(itemObj.type) && itemObj.count < 64) {
                mergeSpoilage(itemObj, cursorItem);
                itemObj.count++;
                cursorItem.count--;
                if (cursorItem.count <= 0) clearItem(cursorItem);
            }
        }
    }
    
    if (sType === 'crafting') checkCrafting();
    updateInventoryUI();
    
    document.dispatchEvent(new MouseEvent('mousemove', {clientX: e.clientX, clientY: e.clientY}));
}

function makeSlotClickEvent(sourceEvent, button) {
    return {
        button,
        clientX: sourceEvent.clientX || 0,
        clientY: sourceEvent.clientY || 0,
        preventDefault: () => sourceEvent.preventDefault && sourceEvent.preventDefault(),
        stopPropagation: () => sourceEvent.stopPropagation && sourceEvent.stopPropagation()
    };
}

export function createSlotElement(i, sType = 'inventory') {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    slot.dataset.index = i;
    slot.dataset.slottype = sType;
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.setAttribute('aria-label', buildSlotLabel(sType === 'inventory' ? 'Inventar' : sType === 'crafting' ? 'Crafting' : 'Ergebnis', i, null));
    
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
    slot.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        let handled = false;
        let cancelled = false;

        if (slot.setPointerCapture) {
            try { slot.setPointerCapture(e.pointerId); } catch (err) {}
        }

        const cleanup = () => {
            clearTimeout(longPressTimer);
            slot.removeEventListener('pointermove', onMove);
            slot.removeEventListener('pointerup', onUp);
            slot.removeEventListener('pointercancel', onCancel);
            if (slot.releasePointerCapture) {
                try { slot.releasePointerCapture(e.pointerId); } catch (err) {}
            }
        };
        const onMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_CANCEL_PX) {
                cancelled = true;
                cleanup();
            }
        };
        const onCancel = () => {
            cancelled = true;
            cleanup();
        };
        const onUp = (upEvent) => {
            if (!handled && !cancelled) {
                handleSlotClick(makeSlotClickEvent(upEvent, 0), sType, i);
                handled = true;
            }
            cleanup();
        };
        const longPressTimer = setTimeout(() => {
            if (cancelled || handled) return;
            handleSlotClick(makeSlotClickEvent(e, 2), sType, i);
            handled = true;
            cleanup();
        }, TOUCH_LONG_PRESS_MS);

        slot.addEventListener('pointermove', onMove);
        slot.addEventListener('pointerup', onUp);
        slot.addEventListener('pointercancel', onCancel);
    });
    slot.addEventListener('contextmenu', (e) => e.preventDefault());
    
    return slot;
}

export function initInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    const cGrid = document.getElementById('crafting-grid');
    const cResult = document.getElementById('crafting-result');
    const isWorkbench = craftingStation === 'workbench';
    const expectedCraftingSlots = isWorkbench ? 9 : 4;
    const gridReady = grid.dataset.craftingStation === craftingStation
        && grid.querySelectorAll('.inv-slot').length === 56
        && cGrid.querySelectorAll('.inv-slot').length === expectedCraftingSlots
        && cResult.querySelectorAll('.inv-slot').length === 1;
    if (gridReady) return;

    grid.innerHTML = '';
    cGrid.innerHTML = ''; cResult.innerHTML = '';

    setCraftingGridSize(isWorkbench ? 3 : 2);
    cGrid.classList.toggle('inventory-crafting', !isWorkbench);
    cGrid.classList.toggle('workbench-crafting', isWorkbench);
    const craftingIndices = isWorkbench ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4];
    for (const index of craftingIndices) cGrid.appendChild(createSlotElement(index, 'crafting'));
    cResult.appendChild(createSlotElement(0, 'result'));

    const label = document.getElementById('crafting-label');
    if (label) label.textContent = isWorkbench ? 'Werkbank (3×3)' : 'Im Inventar (2×2)';

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
    grid.dataset.craftingStation = craftingStation;
}

function getRecipeGrid(recipe) {
    const grid = Array(9).fill(0);
    if (recipe.kind === 'shapeless') {
        const slots = craftingStation === 'workbench'
            ? [0, 1, 2, 3, 4, 5, 6, 7, 8]
            : [0, 1, 3, 4];
        recipe.ingredients.slice(0, slots.length).forEach((type, index) => grid[slots[index]] = type);
    } else if (recipe.gridSize === 3) {
        recipe.pattern.slice(0, 9).forEach((type, index) => grid[index] = type);
    } else {
        const slots = [0, 1, 3, 4];
        recipe.pattern.slice(0, 4).forEach((type, index) => grid[slots[index]] = type);
    }
    return grid;
}

function getActiveCraftingIndices() {
    return craftingStation === 'workbench'
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8]
        : [0, 1, 3, 4];
}

function getMissingRecipeItems(recipe) {
    const required = new Map();
    for (const type of getRecipeGrid(recipe)) {
        if (type !== 0) required.set(type, (required.get(type) || 0) + 1);
    }

    const available = new Map();
    for (let i = 0; i < inventorySlots.length; i++) {
        if (i >= 8 && i <= 15) continue;
        const item = inventorySlots[i];
        if (item && item.type !== 0 && item.count > 0) {
            available.set(item.type, (available.get(item.type) || 0) + item.count);
        }
    }
    for (const item of craftingGridData) {
        if (item && item.type !== 0 && item.count > 0) {
            available.set(item.type, (available.get(item.type) || 0) + item.count);
        }
    }

    const missing = [];
    for (const [type, count] of required) {
        const missingCount = count - (available.get(type) || 0);
        if (missingCount > 0) missing.push({ type, count: missingCount });
    }
    return missing;
}

function formatMissingItems(missing) {
    return `Fehlt: ${missing.map(item => `${item.count}× ${getItemName(item.type)}`).join(', ')}.`;
}

function getRecipeLockReason(recipe) {
    if (recipe.gridSize === 3 && craftingStation !== 'workbench') return 'Werkbank erforderlich.';
    const trustLock = getRecipeTrustLockReason(recipe, window.getHighestVillageTrust?.() || 0);
    if (trustLock) return trustLock;
    const missing = getMissingRecipeItems(recipe);
    return missing.length > 0 ? formatMissingItems(missing) : '';
}

function removeInventoryItems(type, count) {
    let remaining = count;
    for (let i = 0; i < inventorySlots.length && remaining > 0; i++) {
        if (i >= 8 && i <= 15) continue;
        const slot = inventorySlots[i];
        if (slot.type !== type || slot.count <= 0) continue;
        const removed = Math.min(slot.count, remaining);
        slot.count -= removed;
        remaining -= removed;
        if (slot.count <= 0) inventorySlots[i] = { type: 0, count: 0 };
    }
    return remaining === 0;
}

function tryFillRecipeFromInventory(recipe) {
    const lockReason = getRecipeLockReason(recipe);
    if (lockReason) return { filled: false, message: lockReason };

    const inventorySnapshot = inventorySlots.map(slot => ({ ...slot }));
    const craftingSnapshot = craftingGridData.map(slot => ({ ...slot }));
    const recipeGrid = getRecipeGrid(recipe);
    const required = new Map();

    recipeGrid.forEach(type => {
        if (type !== 0) required.set(type, (required.get(type) || 0) + 1);
    });

    let canFill = true;
    for (const item of craftingGridData) {
        if (!item || item.type === 0 || item.count <= 0) continue;
        const used = Math.min(item.count, required.get(item.type) || 0);
        if (used > 0) required.set(item.type, required.get(item.type) - used);
        const leftover = item.count - used;
        if (leftover > 0 && addItemToInventory(item.type, leftover).remaining > 0) {
            canFill = false;
            break;
        }
    }

    if (canFill) {
        canFill = [...required].every(([type, count]) => count === 0 || removeInventoryItems(type, count));
    }

    if (!canFill) {
        for (let i = 0; i < inventorySlots.length; i++) inventorySlots[i] = inventorySnapshot[i];
        for (let i = 0; i < craftingGridData.length; i++) craftingGridData[i] = craftingSnapshot[i];
        updateInventoryUI();
        return { filled: false, message: 'Kein Platz für vorhandene Bastelzutaten.' };
    }

    recipeGrid.forEach((type, index) => {
        craftingGridData[index] = type === 0 ? { type: 0, count: 0 } : { type, count: 1 };
    });
    checkCrafting();
    updateInventoryUI();
    return { filled: true, message: 'Rezept eingesetzt.' };
}

function setCraftingStatus(message, state = '') {
    const status = document.getElementById('crafting-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('success', state === 'success');
    status.classList.toggle('error', state === 'error');
}

export function craftCurrentRecipe() {
    if (craftingResultData.type === 0 || craftingResultData.count <= 0) {
        setCraftingStatus('Lege ein gültiges Rezept ein.', 'error');
        return { crafted: false, reason: 'no-recipe' };
    }

    const inventorySnapshot = inventorySlots.map(slot => ({ ...slot }));
    const craftingSnapshot = craftingGridData.map(slot => ({ ...slot }));
    const output = { ...craftingResultData };
    const addResult = addItemToInventory(output.type, output.count);
    if (addResult.remaining > 0) {
        for (let i = 0; i < inventorySlots.length; i++) inventorySlots[i] = inventorySnapshot[i];
        for (let i = 0; i < craftingGridData.length; i++) craftingGridData[i] = craftingSnapshot[i];
        checkCrafting();
        updateInventoryUI();
        setCraftingStatus('Inventar voll – nichts wurde verbraucht.', 'error');
        return { crafted: false, reason: 'inventory-full' };
    }

    for (const index of getActiveCraftingIndices()) {
        const item = craftingGridData[index];
        if (!item || item.count <= 0) continue;
        item.count--;
        if (item.count <= 0) craftingGridData[index] = { type: 0, count: 0 };
    }
    checkCrafting();
    updateInventoryUI();
    setCraftingStatus(`${getItemName(output.type)} hergestellt.`, 'success');
    SoundManager.playSound('dig_wood', 0.4, 1.8);
    window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
        detail: { type: 'craft', itemType: output.type, count: output.count }
    }));
    return { crafted: true, reason: null };
}

function returnCraftingItemsToInventory() {
    const inventorySnapshot = inventorySlots.map(slot => ({ ...slot }));
    const craftingSnapshot = craftingGridData.map(slot => ({ ...slot }));
    for (let i = 0; i < craftingGridData.length; i++) {
        const item = craftingGridData[i];
        if (!item || item.type === 0 || item.count <= 0) continue;
        const result = addItemToInventory(item.type, item.count);
        if (result.remaining > 0) {
            for (let j = 0; j < inventorySlots.length; j++) inventorySlots[j] = inventorySnapshot[j];
            for (let j = 0; j < craftingGridData.length; j++) craftingGridData[j] = craftingSnapshot[j];
            checkCrafting();
            updateInventoryUI();
            return false;
        }
        craftingGridData[i] = { type: 0, count: 0 };
    }
    checkCrafting();
    updateInventoryUI();
    return true;
}

function renderRecipeBook() {
    const onRecipeClick = (recipe) => {
        const result = tryFillRecipeFromInventory(recipe);
        setCraftingStatus(result.message, result.filled ? 'success' : 'error');
    };
    initRecipeBook(
        atlasDataURL,
        BLOCK_TEX,
        craftingRecipes,
        BLOCK_TYPES,
        TRANSLATIONS,
        onRecipeClick,
        { getLockReason: getRecipeLockReason }
    );
}

export function prepareInventoryUI() {
    if (!document.getElementById('inventory-overlay')) return;
    initInventoryGrid();
    renderRecipeBook();
    updateInventoryUI();
}

function openCraftingOverlay(station, gameStarted, spawning, controls) {
    if (!gameStarted || spawning) return false;
    craftingStation = station;
    inventoryOpened = true;
    setCraftingGridSize(station === 'workbench' ? 3 : 2);
    const overlay = document.getElementById('inventory-overlay');
    overlay.style.display = 'flex';
    window.showInventoryPanel?.('inventory');
    activateDialog(overlay, '#inventory-close-btn');
    if (!Game.touchActive) controls.unlock();
    initInventoryGrid();
    setCraftingStatus(
        station === 'workbench'
            ? '3×3-Werkbank bereit. Wähle ein Rezept.'
            : '2×2-Crafting. Für Werkzeuge brauchst du eine Werkbank.'
    );
    renderRecipeBook();
    updateInventoryUI();
    return true;
}

export function openWorkbenchCrafting(gameStarted, spawning, controls) {
    return openCraftingOverlay('workbench', gameStarted, spawning, controls);
}

export function toggleInventory(gameStarted, spawning, controls) {
    if (!gameStarted || spawning) return false;
    if (!inventoryOpened) return openCraftingOverlay('inventory', gameStarted, spawning, controls);

    if (!returnCraftingItemsToInventory()) {
        setCraftingStatus('Inventar voll – Bastelzutaten können nicht zurückgelegt werden.', 'error');
        return true;
    }
    inventoryOpened = false;
    craftingStation = 'inventory';
    const overlay = document.getElementById('inventory-overlay');
    deactivateDialog(overlay);
    overlay.style.display = 'none';
    if (!Game.touchActive) {
        if (typeof window.resumeGame === 'function') window.resumeGame();
        else controls.lock();
    }
    return false;
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

    const craftButton = document.getElementById('crafting-create-btn');
    if (craftButton) craftButton.addEventListener('click', craftCurrentRecipe);

    const updateCursorPreview = (e) => {
        if (!inventoryOpened) return;
        const cursorEl = document.getElementById('cursor-item');
        if (cursorItem.count > 0 && cursorItem.type > 0) {
            cursorEl.style.display = 'block';
            cursorEl.style.left = e.clientX + 'px';
            cursorEl.style.top = e.clientY + 'px';
            
            const iconDiv = cursorEl.querySelector('.cursor-icon');
            iconDiv.innerHTML = createBlockHTML(cursorItem.type);
            cursorEl.querySelector('.cursor-count').textContent = cursorItem.count > 1 ? cursorItem.count : '';
        } else {
            cursorEl.style.display = 'none';
        }
    };

    document.addEventListener('mousemove', updateCursorPreview);
    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') return;
        updateCursorPreview(e);
    });
}
