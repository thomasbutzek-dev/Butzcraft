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
            variants.add(selectTexture(blockType, null, x, 33, z, fallback));
        }
    }
    return variants;
}

describe('painterly crafted wood variants', () => {
    it('varies workbenches, chests, and crafted planks within their atlas families', () => {
        const selectTexture = loadPainterlyTextureFor();

        expect([...collectVariants(selectTexture, 28, 29)]).toEqual(expect.arrayContaining([29, 159, 160, 161]));
        expect([...collectVariants(selectTexture, 75, 75)]).toEqual(expect.arrayContaining([75, 164, 165, 166]));
        expect([...collectVariants(selectTexture, 26, 27)]).toEqual(expect.arrayContaining([27, 131, 132, 133]));
    });

    it('keeps each door bottom paired with its matching top', () => {
        const selectTexture = loadPainterlyTextureFor();
        const pairs = new Set();

        for (let x = -48; x <= 48; x += 3) {
            for (let z = -48; z <= 48; z += 3) {
                const bottom = selectTexture(33, null, x, 32, z, 39);
                const top = selectTexture(34, null, x, 33, z, 40);
                pairs.add(`${bottom}:${top}`);
            }
        }

        expect([...pairs]).toEqual(expect.arrayContaining(['39:40', '162:163']));
        expect([...pairs].every(pair => pair === '39:40' || pair === '162:163')).toBe(true);
    });
});
