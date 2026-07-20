import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadPainterlyHelpers(graphicsVariant) {
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
    vm.runInContext(`${source}\nself.__materials = { getBiomeAt, painterlyTextureFor, BIOMES };`, context);
    vm.runInContext(`GRAPHICS_VARIANT = '${graphicsVariant}';`, context);
    return self.__materials;
}

function collectTiles(helpers, biome, blockType, face, fallback) {
    const tiles = new Set();
    for (let x = -720; x <= 720; x += 6) {
        for (let z = -720; z <= 720; z += 6) {
            if (helpers.getBiomeAt(x, z) !== biome) continue;
            tiles.add(helpers.painterlyTextureFor(blockType, face, x, 32, z, fallback));
        }
    }
    return tiles;
}

describe('painterly biome material variants', () => {
    it('uses coherent variant families for desert, coast, snow, and jungle ground', () => {
        const helpers = loadPainterlyHelpers('B');
        const top = { d: [0, 1, 0] };

        const desert = collectTiles(helpers, helpers.BIOMES.DESERT, 7, top, 6);
        const coast = collectTiles(helpers, helpers.BIOMES.OCEAN, 7, top, 6);
        const snow = collectTiles(helpers, helpers.BIOMES.SNOW, 11, top, 8);
        const jungle = collectTiles(helpers, helpers.BIOMES.JUNGLE, 1, top, 0);

        expect([...desert]).toEqual(expect.arrayContaining([6, 134, 135, 136]));
        expect([...coast]).toEqual(expect.arrayContaining([140, 141, 142, 143]));
        expect([...snow]).toEqual(expect.arrayContaining([8, 137, 138, 139]));
        expect([...jungle]).toEqual(expect.arrayContaining([144, 145, 146, 147]));
    });

    it('keeps comparison variant A on the original atlas tiles', () => {
        const helpers = loadPainterlyHelpers('A');

        expect(helpers.painterlyTextureFor(7, { d: [0, 1, 0] }, 0, 32, 0, 6)).toBe(6);
        expect(helpers.painterlyTextureFor(11, { d: [0, 1, 0] }, 0, 32, 0, 8)).toBe(8);
    });
});
