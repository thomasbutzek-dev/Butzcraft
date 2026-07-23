/* js/saveMigrations.js - Versionierte Spielstand-Migrationen
 *
 * Konzept:
 *   - Jeder Spielstand bekommt ein `version`-Feld (Number).
 *   - Beim Laden iterieren wir alle Migrations von save.version+1 bis CURRENT_VERSION.
 *   - Beim Speichern wird CURRENT_VERSION immer mitgeschrieben.
 *   - Alte Saves ohne `version` werden als v0 behandelt.
 *
 * Wenn du das Save-Format änderst:
 *   1. CURRENT_VERSION inkrementieren
 *   2. Neue Migration in MIGRATIONS unter dem neuen Versions-Key registrieren
 *   3. Migration ist eine Pure Function: data → migrated data (mutation OK, return required)
 *
 * Vorteil ggü. der vorigen Inline-Migration: Eine Stelle, eine Versions-Reihe, testbar.
 */

import { getToolInfo } from './miningRules.js?v=20260716a';
import { normalizeCharacterProfile } from './characterProfile.js?v=20260602a';
import { createQuestState, normalizeQuestState } from './quests.js?v=20260723e';

// Aktuelle Save-Version. INKREMENTIEREN bei jeder Format-Änderung.
export const CURRENT_SAVE_VERSION = 15;
export const CURRENT_WORLD_GENERATION_VERSION = 2;

export function getWorldGenerationLoadNotice(rawData, saveName) {
    if (rawData?.worldGenerationVersion === CURRENT_WORLD_GENERATION_VERSION) return null;
    const suffix = ' - Worldgen 1 Backup';
    const baseName = String(saveName || 'Legacy World').slice(0, 64 - suffix.length).trimEnd();
    return {
        backupName: `${baseName}${suffix}`,
        message: 'Dieser Spielstand nutzt die alte Weltgenerierung. Eine Sicherung wurde angelegt. Für die neuen großen Minen und Dungeons wird eine neue Welt empfohlen.'
    };
}

// Migration v0 → v1: Inventory-Format vom Objekt {type: count} auf Array<{type, count}>
const OLD_INVENTORY_MAP = { 1: 0, 2: 1, 3: 2, 7: 3, 5: 4, 6: 5, 11: 6, 12: 7, 15: 8, 16: 9, 17: 10, 18: 11 };

function migrateV0toV1(data) {
    if (data.inventory && !Array.isArray(data.inventory)) {
        const arr = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
        for (const [oldType, count] of Object.entries(data.inventory)) {
            const slotIdx = OLD_INVENTORY_MAP[oldType];
            if (slotIdx !== undefined) {
                arr[slotIdx] = { type: parseInt(oldType, 10), count: count };
            }
        }
        data.inventory = arr;
    }
    return data;
}

// Migration v1 → v2: Tür-Rotation aus gepackten Block-Werten in blockMeta auslagern.
// Vorher: modifiedBlocks["x,y,z"] = 33|(rotation<<6) = 97/161/225.
// Jetzt:  modifiedBlocks["x,y,z"] = 33, blockMeta["x,y,z"] = rotation.
function migrateV1toV2(data) {
    if (!data.blockMeta) data.blockMeta = {};
    if (!data.chestContents) data.chestContents = {};
    if (data.modifiedBlocks) {
        for (const key in data.modifiedBlocks) {
            const val = data.modifiedBlocks[key];
            const baseId = val & 0x3f;
            if ((baseId === 33 || baseId === 34) && val > 63) {
                data.modifiedBlocks[key] = baseId;
                data.blockMeta[key] = (val >> 6) & 0x3;
            }
        }
    }
    return data;
}

// Migration v2 → v3: lootedChests-Array einführen (leere Liste für alte Saves).
// Alte Saves haben kein lootedChests → Kisten erhalten beim ersten Öffnen Loot wie gewohnt.
function migrateV2toV3(data) {
    if (!data.lootedChests) data.lootedChests = [];
    return data;
}

// Migration v3 → v4: Weather-System, NPCs, Villages, FireBlocks, Spawner-Metadaten.
function migrateV3toV4(data) {
    if (!data.weather) data.weather = { state: 'clear', stateTimer: 120, intensity: 0 };
    if (!data.npcs) data.npcs = [];
    if (!data.villages) data.villages = [];
    if (!data.fireBlocks) data.fireBlocks = {};
    if (!data.spawnerMeta) data.spawnerMeta = {};
    return data;
}

function migrateV4toV5(data) {
    if (typeof data.lastBloodMoonRewardDay !== 'number') data.lastBloodMoonRewardDay = -1;
    return data;
}

function migrateV5toV6(data) {
    if (typeof data.onboardingObjectiveIndex !== 'number') data.onboardingObjectiveIndex = 0;
    if (typeof data.pendingBloodMoonRewardDay !== 'number') data.pendingBloodMoonRewardDay = -1;
    return data;
}

function migrateV6toV7(data) {
    if (typeof data.storyObjectiveIndex !== 'number') data.storyObjectiveIndex = 0;
    return data;
}

function migrateV7toV8(data) {
    if (!Array.isArray(data.inventory)) return data;
    const extraTools = [];
    for (const slot of data.inventory) {
        if (!slot || typeof slot !== 'object') continue;
        const toolInfo = getToolInfo(slot.type);
        if (!toolInfo || slot.count <= 0) continue;
        const extraCount = Math.max(0, Math.floor(slot.count) - 1);
        for (let i = 0; i < extraCount; i++) extraTools.push(slot.type);
        slot.count = 1;
        slot.durability = Number.isFinite(slot.durability)
            ? Math.max(1, Math.min(toolInfo.maxDurability, Math.floor(slot.durability)))
            : toolInfo.maxDurability;
    }

    for (const type of extraTools) {
        let freeIndex = -1;
        for (let index = 0; index < 64; index++) {
            if (index >= 8 && index < 16) continue;
            const slot = data.inventory[index];
            if (!slot || slot.type === 0 || slot.count <= 0) {
                freeIndex = index;
                break;
            }
        }
        if (freeIndex === -1) break;
        data.inventory[freeIndex] = { type, count: 1, durability: getToolInfo(type).maxDurability };
    }
    return data;
}

function migrateV8toV9(data) {
    if (!data.respawnBed || typeof data.respawnBed !== 'object') data.respawnBed = null;
    return data;
}

function migrateV9toV10(data) {
    if (!Object.prototype.hasOwnProperty.call(data, 'characterProfile')) data.characterProfile = null;
    if (!data.thirdPersonCamera || typeof data.thirdPersonCamera !== 'object') {
        data.thirdPersonCamera = { distance: 4.2 };
    }
    return data;
}

function migrateV10toV11(data) {
    if (!Array.isArray(data.minecarts)) data.minecarts = [];
    return data;
}

function migrateV11toV12(data) {
    if (data.worldGenerationVersion !== 1 && data.worldGenerationVersion !== 2) {
        data.worldGenerationVersion = 1;
    }
    if (!data.structureProgress || typeof data.structureProgress !== 'object' || Array.isArray(data.structureProgress)) {
        data.structureProgress = {};
    }
    return data;
}

function migrateV12toV13(data) {
    if (!Array.isArray(data.keptAnimals)) data.keptAnimals = [];
    return data;
}

function migrateV13toV14(data) {
    data.questState = normalizeQuestState(data.questState, data.storyObjectiveIndex);
    return data;
}

function migrateV14toV15(data) {
    return data;
}

// Map: Ziel-Version → Migration-Funktion (von Vorgänger-Version aus).
const MIGRATIONS = {
    1: migrateV0toV1,
    2: migrateV1toV2,
    3: migrateV2toV3,
    4: migrateV3toV4,
    5: migrateV4toV5,
    6: migrateV5toV6,
    7: migrateV6toV7,
    8: migrateV7toV8,
    9: migrateV8toV9,
    10: migrateV9toV10,
    11: migrateV10toV11,
    12: migrateV11toV12,
    13: migrateV12toV13,
    14: migrateV13toV14,
    15: migrateV14toV15
};

function normalizeCharacterSettings(data) {
    if (data.characterProfile) data.characterProfile = normalizeCharacterProfile(data.characterProfile);
    if (!data.thirdPersonCamera || typeof data.thirdPersonCamera !== 'object') data.thirdPersonCamera = {};
    const distance = Number(data.thirdPersonCamera.distance);
    data.thirdPersonCamera.distance = Number.isFinite(distance)
        ? Math.max(2, Math.min(6, distance))
        : 4.2;
    return data;
}

function normalizeInventory(data) {
    if (!Array.isArray(data.inventory)) data.inventory = [];
    data.inventory.length = Math.min(data.inventory.length, 64);
    for (let i = 0; i < 64; i++) {
        const slot = data.inventory[i];
        if (!slot || typeof slot !== 'object') data.inventory[i] = { type: 0, count: 0 };
    }
    return data;
}

function normalizeWorldGeneration(data) {
    if (data.worldGenerationVersion !== 1 && data.worldGenerationVersion !== 2) {
        data.worldGenerationVersion = CURRENT_WORLD_GENERATION_VERSION;
    }
    if (!data.structureProgress || typeof data.structureProgress !== 'object' || Array.isArray(data.structureProgress)) {
        data.structureProgress = {};
    }
    return data;
}

function normalizeQuestProgress(data) {
    data.questState = normalizeQuestState(data.questState || createQuestState(data.storyObjectiveIndex), data.storyObjectiveIndex);
    return data;
}

/**
 * Wendet alle nötigen Migrations an, damit das Save-Object die CURRENT_SAVE_VERSION hat.
 * Idempotent: bereits aktuelle Saves werden unverändert zurückgegeben.
 *
 * @param {object} data - rohe Save-Daten vom Server (oder localStorage)
 * @returns {object} migrierte Daten + .version === CURRENT_SAVE_VERSION
 */
export function migrateSave(data) {
    if (!data || typeof data !== 'object') return data;
    let v = typeof data.version === 'number' ? data.version : 0;
    while (v < CURRENT_SAVE_VERSION) {
        const next = v + 1;
        const migrate = MIGRATIONS[next];
        if (!migrate) {
            console.warn(`[saveMigrations] Keine Migration v${v}→v${next} registriert. Save bleibt auf v${v}.`);
            break;
        }
        data = migrate(data) || data;
        v = next;
    }
    data.version = v;
    return normalizeQuestProgress(normalizeWorldGeneration(normalizeCharacterSettings(normalizeInventory(data))));
}

export function prepareSaveForLoad(rawData) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        throw new Error('Ungültiger Spielstand');
    }
    if (typeof rawData.version === 'number' && rawData.version > CURRENT_SAVE_VERSION) {
        throw new Error('Spielstandversion wird nicht unterstützt');
    }

    const data = migrateSave(rawData);
    const pos = data.pos;
    if (
        !pos || typeof pos !== 'object' ||
        !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)
    ) {
        throw new Error('Spielstand enthält keine gültige Position');
    }
    if (!Number.isFinite(data.health) || !Number.isFinite(data.hunger) || !Number.isFinite(data.time)) {
        throw new Error('Spielstand enthält ungültige Spielerwerte');
    }
    return data;
}

/**
 * Stempelt ein neues Save-Object mit der aktuellen Version, vor dem Schreiben.
 */
export function stampSaveVersion(data) {
    if (data && typeof data === 'object') {
        data.version = CURRENT_SAVE_VERSION;
        if (data.worldGenerationVersion !== 1 && data.worldGenerationVersion !== 2) {
            data.worldGenerationVersion = CURRENT_WORLD_GENERATION_VERSION;
        }
        if (!data.structureProgress || typeof data.structureProgress !== 'object' || Array.isArray(data.structureProgress)) {
            data.structureProgress = {};
        }
        data.questState = normalizeQuestState(data.questState || createQuestState(data.storyObjectiveIndex), data.storyObjectiveIndex);
    }
    return data;
}
