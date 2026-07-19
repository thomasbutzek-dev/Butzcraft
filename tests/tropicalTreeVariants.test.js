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
            variants.add(selectTexture(blockType, null, x, 39, z, fallback));
        }
    }
    return variants;
}

describe('painterly tropical tree variants', () => {
    it('varies jungle and palm bark and leaves within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 13, 10)]).toEqual(expect.arrayContaining([10, 228, 229, 230]));
        expect([...collectVariants(selectTexture, 14, 11)]).toEqual(expect.arrayContaining([11, 231, 232, 233]));
        expect([...collectVariants(selectTexture, 15, 12)]).toEqual(expect.arrayContaining([12, 234, 235, 236]));
        expect([...collectVariants(selectTexture, 16, 13)]).toEqual(expect.arrayContaining([13, 237, 238, 239]));
    });

    it('keeps variant A on the original tropical tree tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(13, null, 12, 39, -6, 10)).toBe(10);
        expect(selectTexture(14, null, 12, 39, -6, 11)).toBe(11);
        expect(selectTexture(15, null, 12, 39, -6, 12)).toBe(12);
        expect(selectTexture(16, null, 12, 39, -6, 13)).toBe(13);
    });
});
