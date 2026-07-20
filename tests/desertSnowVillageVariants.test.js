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
            variants.add(selectTexture(blockType, null, x, 33, z, fallback));
        }
    }
    return variants;
}

describe('painterly desert and snow village variants', () => {
    it('varies sandstone, reliefs, hay, ice, and snow within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 30, 31)]).toEqual(expect.arrayContaining([31, 179, 180, 181]));
        expect([...collectVariants(selectTexture, 82, 82)]).toEqual(expect.arrayContaining([82, 182, 183, 184]));
        expect([...collectVariants(selectTexture, 88, 88)]).toEqual(expect.arrayContaining([88, 185, 186, 187]));
        expect([...collectVariants(selectTexture, 78, 9)]).toEqual(expect.arrayContaining([9, 188, 189, 190]));
        expect([...collectVariants(selectTexture, 77, 8)]).toEqual(expect.arrayContaining([8, 137, 138, 139]));
    });

    it('keeps variant A on the original desert and snow village tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(30, null, 12, 33, -6, 31)).toBe(31);
        expect(selectTexture(82, null, 12, 33, -6, 82)).toBe(82);
        expect(selectTexture(88, null, 12, 33, -6, 88)).toBe(88);
        expect(selectTexture(78, null, 12, 33, -6, 9)).toBe(9);
        expect(selectTexture(77, null, 12, 33, -6, 8)).toBe(8);
    });
});
