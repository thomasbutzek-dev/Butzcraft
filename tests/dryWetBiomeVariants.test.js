import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadPainterlyTextureFor(graphicsVariant) {
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
    const source = readFileSync('js/chunkWorker.js', 'utf8');
    vm.runInContext(`${source}\nself.painterlyTextureFor = painterlyTextureFor;`, context);
    vm.runInContext(`GRAPHICS_VARIANT = '${graphicsVariant}';`, context);
    return self.painterlyTextureFor;
}

function collectVariants(selectTexture, blockType, fallback) {
    const variants = new Set();
    for (let x = -48; x <= 48; x += 3) {
        for (let z = -48; z <= 48; z += 3) {
            variants.add(selectTexture(blockType, null, x, 38, z, fallback));
        }
    }
    return variants;
}

describe('painterly dry and wet biome variants', () => {
    it('varies cacti, clouds, sugarcane, and seagrass within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 45, 45)]).toEqual(expect.arrayContaining([45, 216, 217, 218]));
        expect([...collectVariants(selectTexture, 8, 7)]).toEqual(expect.arrayContaining([7, 219, 220, 221]));
        expect([...collectVariants(selectTexture, 49, 49)]).toEqual(expect.arrayContaining([49, 222, 223, 224]));
        expect([...collectVariants(selectTexture, 54, 54)]).toEqual(expect.arrayContaining([54, 225, 226, 227]));
    });

    it('keeps variant A on the original dry and wet biome tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(45, null, 12, 38, -6, 45)).toBe(45);
        expect(selectTexture(8, null, 12, 38, -6, 7)).toBe(7);
        expect(selectTexture(49, null, 12, 38, -6, 49)).toBe(49);
        expect(selectTexture(54, null, 12, 38, -6, 54)).toBe(54);
    });
});
