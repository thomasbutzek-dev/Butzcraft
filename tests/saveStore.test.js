import { describe, it, expect } from 'vitest';
import { isValidSaveName, normalizeImportedSave, serializeSaveFile } from '../js/saveStore.js';

describe('saveStore names', () => {
    it('accepts the same safe save names as the server', () => {
        expect(isValidSaveName('Emy Test')).toBe(true);
        expect(isValidSaveName('World_1-2')).toBe(true);
    });

    it('rejects traversal and reserved Windows names', () => {
        expect(isValidSaveName('../save')).toBe(false);
        expect(isValidSaveName(' con ')).toBe(false);
        expect(isValidSaveName('CON')).toBe(false);
    });
});

describe('normalizeImportedSave', () => {
    it('reads wrapped exports', () => {
        const gameData = { version: 4, health: 80 };
        const save = normalizeImportedSave({ name: 'World 1', gameData }, 'ignored.json');

        expect(save).toEqual({ name: 'World 1', gameData });
    });

    it('uses the file name for plain save JSON', () => {
        const gameData = { version: 4, health: 80 };
        const save = normalizeImportedSave(gameData, 'Plain Save.json');

        expect(save).toEqual({ name: 'Plain Save', gameData });
    });
});

describe('serializeSaveFile', () => {
    it('exports a wrapped save file', () => {
        const text = serializeSaveFile('World 1', { health: 80 });
        expect(JSON.parse(text)).toEqual({
            name: 'World 1',
            gameData: { health: 80 }
        });
    });
});
