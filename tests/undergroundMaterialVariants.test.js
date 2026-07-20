import { readChunkWorkerSource } from './chunkWorkerSource.js';
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
    const source = readChunkWorkerSource();
    vm.runInContext(`${source}\nself.painterlyTextureFor = painterlyTextureFor;`, context);
    vm.runInContext(`GRAPHICS_VARIANT = '${graphicsVariant}';`, context);
    return self.painterlyTextureFor;
}

function collectVariants(selectTexture, blockType, fallback) {
    const variants = new Set();
    for (let x = -48; x <= 48; x += 3) {
        for (let z = -48; z <= 48; z += 3) {
            variants.add(selectTexture(blockType, null, x, 18, z, fallback));
        }
    }
    return variants;
}

describe('painterly underground material variants', () => {
    it('varies stone brick and ores within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 29, 30)]).toEqual(expect.arrayContaining([30, 204, 205, 206]));
        expect([...collectVariants(selectTexture, 56, 56)]).toEqual(expect.arrayContaining([56, 207, 208, 209]));
        expect([...collectVariants(selectTexture, 57, 57)]).toEqual(expect.arrayContaining([57, 210, 211, 212]));
        expect([...collectVariants(selectTexture, 58, 58)]).toEqual(expect.arrayContaining([58, 213, 214, 215]));
    });

    it('keeps variant A on the original underground tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(29, null, 12, 18, -6, 30)).toBe(30);
        expect(selectTexture(56, null, 12, 18, -6, 56)).toBe(56);
        expect(selectTexture(57, null, 12, 18, -6, 57)).toBe(57);
        expect(selectTexture(58, null, 12, 18, -6, 58)).toBe(58);
    });
});
