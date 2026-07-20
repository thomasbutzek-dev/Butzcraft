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

describe('painterly undergrowth variants', () => {
    it('varies flowers, mushrooms, and dead bushes within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 9, 15)]).toEqual(expect.arrayContaining([15, 148, 149, 150]));
        expect([...collectVariants(selectTexture, 10, 16)]).toEqual(expect.arrayContaining([16, 151, 152, 153]));
        expect([...collectVariants(selectTexture, 47, 47)]).toEqual(expect.arrayContaining([47, 154]));
        expect([...collectVariants(selectTexture, 48, 48)]).toEqual(expect.arrayContaining([48, 155]));
        expect([...collectVariants(selectTexture, 46, 46)]).toEqual(expect.arrayContaining([46, 156, 157, 158]));
    });

    it('keeps variant A on the original plant tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(9, null, 12, 33, -6, 15)).toBe(15);
        expect(selectTexture(47, null, 12, 33, -6, 47)).toBe(47);
        expect(selectTexture(46, null, 12, 33, -6, 46)).toBe(46);
    });
});
