const DB_NAME = 'butzcraft-saves';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const SAFE_SAVE_NAME = /^[A-Za-z0-9 _-]{1,64}$/;
const RESERVED_WIN_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

let dbPromise = null;

export function isValidSaveName(name) {
    return (
        typeof name === 'string' &&
        name.trim() === name &&
        SAFE_SAVE_NAME.test(name) &&
        !RESERVED_WIN_NAMES.test(name)
    );
}

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not available'));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    });
    return dbPromise;
}

export async function listBrowserSaves() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
            const saves = request.result || [];
            saves.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            resolve(saves.map(save => save.name));
        };
        request.onerror = () => reject(request.error || new Error('Save list failed'));
    });
}

export async function loadBrowserSave(name) {
    if (!isValidSaveName(name)) throw new Error('Invalid name');
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(name);
        request.onsuccess = () => resolve(request.result ? request.result.gameData : null);
        request.onerror = () => reject(request.error || new Error('Save load failed'));
    });
}

export async function saveBrowserSave(name, gameData) {
    if (!isValidSaveName(name)) throw new Error('Invalid name');
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ name, gameData, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('Save write failed'));
    });
}

function fallbackSaveName(rawName) {
    const base = String(rawName || 'Imported Save')
        .replace(/\.json$/i, '')
        .replace(/[^A-Za-z0-9 _-]+/g, '_')
        .trim()
        .slice(0, 64);
    return isValidSaveName(base) ? base : 'Imported Save';
}

export function normalizeImportedSave(raw, fallbackName) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid save file');
    const name = isValidSaveName(raw.name) ? raw.name : fallbackSaveName(fallbackName);
    const gameData = raw.gameData && typeof raw.gameData === 'object' ? raw.gameData : raw;
    return { name, gameData };
}

export function serializeSaveFile(name, gameData) {
    return JSON.stringify({ name, gameData }, null, 2);
}
