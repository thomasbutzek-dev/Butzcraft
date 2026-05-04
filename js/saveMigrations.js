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

// Aktuelle Save-Version. INKREMENTIEREN bei jeder Format-Änderung.
export const CURRENT_SAVE_VERSION = 2;

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

// Map: Ziel-Version → Migration-Funktion (von Vorgänger-Version aus).
const MIGRATIONS = {
    1: migrateV0toV1,
    2: migrateV1toV2
};

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
    return data;
}

/**
 * Stempelt ein neues Save-Object mit der aktuellen Version, vor dem Schreiben.
 */
export function stampSaveVersion(data) {
    if (data && typeof data === 'object') data.version = CURRENT_SAVE_VERSION;
    return data;
}
