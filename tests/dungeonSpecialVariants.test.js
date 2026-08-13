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
            variants.add(selectTexture(blockType, null, x, 24, z, fallback));
        }
    }
    return variants;
}

describe('painterly dungeon and special-block variants', () => {
    it('varies mossy stone, spawners, pressure plates, and fire within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor();

        expect([...collectVariants(selectTexture, 84, 84)]).toEqual(expect.arrayContaining([84, 191, 192, 193]));
        expect([...collectVariants(selectTexture, 83, 83)]).toEqual(expect.arrayContaining([83, 194, 195, 196]));
        expect([...collectVariants(selectTexture, 79, 79)]).toEqual(expect.arrayContaining([79, 197, 198, 199]));
        expect([...collectVariants(selectTexture, 86, 86)]).toEqual(expect.arrayContaining([86, 201, 202, 203]));
    });
});
