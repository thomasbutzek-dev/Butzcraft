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

describe('painterly mine and village variants', () => {
    it('varies rails, supports, paths, and cobblestone within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 80, 80)]).toEqual(expect.arrayContaining([80, 167, 168, 169]));
        expect([...collectVariants(selectTexture, 81, 81)]).toEqual(expect.arrayContaining([81, 170, 171, 172]));
        expect([...collectVariants(selectTexture, 87, 87)]).toEqual(expect.arrayContaining([87, 173, 174, 175]));
        expect([...collectVariants(selectTexture, 85, 85)]).toEqual(expect.arrayContaining([85, 176, 177, 178]));
    });

    it('keeps variant A on the original mine and village tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(80, null, 12, 33, -6, 80)).toBe(80);
        expect(selectTexture(81, null, 12, 33, -6, 81)).toBe(81);
        expect(selectTexture(87, null, 12, 33, -6, 87)).toBe(87);
        expect(selectTexture(85, null, 12, 33, -6, 85)).toBe(85);
    });
});
