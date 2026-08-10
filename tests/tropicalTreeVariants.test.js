import { readChunkWorkerSource } from './chunkWorkerSource.js';
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
        const selectTexture = loadPainterlyTextureFor();

        expect([...collectVariants(selectTexture, 13, 10)]).toEqual(expect.arrayContaining([10, 228, 229, 230]));
        expect([...collectVariants(selectTexture, 14, 11)]).toEqual(expect.arrayContaining([11, 231, 232, 233]));
        expect([...collectVariants(selectTexture, 15, 12)]).toEqual(expect.arrayContaining([12, 234, 235, 236]));
        expect([...collectVariants(selectTexture, 16, 13)]).toEqual(expect.arrayContaining([13, 237, 238, 239]));
    });
});
