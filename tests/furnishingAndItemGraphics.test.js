import { readChunkWorkerSource } from './chunkWorkerSource.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadPainterlyTextureFor() {
    const self = {};
    const context = vm.createContext({
        self,
        console,
        Math,
        Set,
        Uint8Array,
        Int16Array,
        Float32Array,
        Uint32Array,
        ArrayBuffer
    });
    const source = readChunkWorkerSource();
    vm.runInContext(`${source}\nself.painterlyTextureFor = painterlyTextureFor;`, context);
    return self.painterlyTextureFor;
}

function loadFurnitureHelpers() {
    const self = {};
    const context = vm.createContext({
        self,
        console,
        Math,
        Set,
        Uint8Array,
        Int16Array,
        Float32Array,
        Uint32Array,
        ArrayBuffer
    });
    const source = readChunkWorkerSource();
    vm.runInContext(`${source}\nself.furnitureTopUVs = furnitureTopUVs; self.furnitureTextureFor = furnitureTextureFor;`, context);
    return self;
}

function collectVariants(selectTexture, blockType, fallback) {
    const variants = new Set();
    for (let x = -48; x <= 48; x += 3) {
        for (let z = -48; z <= 48; z += 3) {
            variants.add(selectTexture(blockType, null, x, 34, z, fallback));
        }
    }
    return variants;
}

describe('painterly furnishing and item graphics', () => {
    it('varies furnace, workbench side, window, and both bed halves in style B', () => {
        const selectTexture = loadPainterlyTextureFor();

        expect([...collectVariants(selectTexture, 59, 59)]).toEqual(expect.arrayContaining([59, 240, 241, 242]));
        expect([...collectVariants(selectTexture, 36, 36)]).toEqual(expect.arrayContaining([36, 243, 244, 245]));
        expect([...collectVariants(selectTexture, 32, 38)]).toEqual(expect.arrayContaining([38, 246, 247, 248]));
        expect([...collectVariants(selectTexture, 38, 41)]).toEqual(expect.arrayContaining([41, 249]));
        expect([...collectVariants(selectTexture, 39, 42)]).toEqual(expect.arrayContaining([42, 250]));
    });

    it('rotates both furniture halves together and keeps their texture variants paired', () => {
        const { furnitureTopUVs, furnitureTextureFor } = loadFurnitureHelpers();
        const alongX = furnitureTopUVs(0, 0, 1, 1, 0);
        const alongZ = furnitureTopUVs(0, 0, 1, 1, 2);

        expect(alongX).not.toEqual(alongZ);
        expect(alongX).toHaveLength(8);

        const headTile = furnitureTextureFor(38, 10, 20, 30, 0, 41);
        const footTile = furnitureTextureFor(39, 11, 20, 30, 0, 42);
        expect([[41, 42], [249, 250]]).toContainEqual([headTile, footTile]);

        const benchTile = furnitureTextureFor(28, 10, 20, 30, 0, 29);
        const benchSideTile = furnitureTextureFor(36, 11, 20, 30, 0, 36);
        expect([29, 159, 160, 161].indexOf(benchTile)).toBe([36, 243, 244, 245].indexOf(benchSideTile));
    });

    it('loads hand-painted equipment, combat, food, and raw-item atlases', () => {
        const source = readFileSync('js/blocks.js', 'utf8');

        expect(source).toContain('equipment-item-tiles.png');
        expect(source).toContain('combat-food-item-tiles.png');
        expect(source).toContain('raw-item-tiles.png');
        expect(source).toContain('const equipmentItemReplacements');
        expect(source).toContain('const combatFoodItemReplacements');
        expect(source).toContain('const rawItemReplacements');
    });

    it('uses atlas icons instead of emoji for raw food drops', () => {
        const blocksSource = readFileSync('js/blocks.js', 'utf8');
        const inventorySource = readFileSync('js/inventory.js', 'utf8');

        expect(blocksSource).toContain('[BLOCK_TYPES.FISH]: 35');
        expect(blocksSource).toContain('[BLOCK_TYPES.RAW_MEAT]: 37');
        expect(blocksSource).toContain('[BLOCK_TYPES.RAW_CHICKEN]: 55');
        expect(blocksSource).toContain('[BLOCK_TYPES.ROTTEN_FLESH]: 76');
        expect(blocksSource).toContain('[BLOCK_TYPES.MUTTON]: 77');
        expect(blocksSource).toContain('[BLOCK_TYPES.TURTLE_MEAT]: 78');
        expect(inventorySource).not.toContain('if (type === 21) return');
        expect(inventorySource).not.toContain('if (type === 22) return');
        expect(inventorySource).not.toContain('if (type === 23) return');
        expect(inventorySource).not.toContain('if (type === 24) return');
        expect(inventorySource).not.toContain('if (type === 25) return');
    });
});
