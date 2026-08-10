import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadTransitionHelpers() {
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
    vm.runInContext(`${source}\nself.__transitions = { getBiomeAt, getOceanDepthFactor, getTerrainHeightAt, getTransitionSurfaceBlock, BIOMES };`, context);
    return self.__transitions;
}

function findChangedSurface(helpers, biome, baseBlock) {
    for (let x = -360; x <= 360; x += 3) {
        for (let z = -360; z <= 360; z += 3) {
            if (helpers.getBiomeAt(x, z) !== biome) continue;
            const selected = helpers.getTransitionSurfaceBlock(x, z, biome, baseBlock);
            if (selected !== baseBlock) return { x, z, selected };
        }
    }
    return null;
}

describe('painterly biome transitions', () => {
    it('keeps neighboring ocean and land heights within three blocks', () => {
        const helpers = loadTransitionHelpers();
        let coastlineEdges = 0;
        let maximumDelta = 0;

        for (let x = -180; x <= 180; x++) {
            for (let z = -180; z <= 180; z++) {
                for (const [dx, dz] of [[1, 0], [0, 1]]) {
                    const firstBiome = helpers.getBiomeAt(x, z);
                    const secondBiome = helpers.getBiomeAt(x + dx, z + dz);
                    if (firstBiome === secondBiome) continue;
                    if (firstBiome !== helpers.BIOMES.OCEAN && secondBiome !== helpers.BIOMES.OCEAN) continue;
                    coastlineEdges++;
                    maximumDelta = Math.max(
                        maximumDelta,
                        Math.abs(
                            helpers.getTerrainHeightAt(x, z) -
                            helpers.getTerrainHeightAt(x + dx, z + dz)
                        )
                    );
                }
            }
        }

        expect(coastlineEdges).toBeGreaterThan(0);
        expect(maximumDelta).toBeLessThanOrEqual(3);
        expect(helpers.getOceanDepthFactor(0, -0.7)).toBe(1);
        expect(helpers.getOceanDepthFactor(0, -0.25)).toBe(0);
    });

    it('softens desert and snow borders with deterministic material patches', () => {
        const helpers = loadTransitionHelpers();
        const desert = findChangedSurface(helpers, helpers.BIOMES.DESERT, 7);
        const snow = findChangedSurface(helpers, helpers.BIOMES.SNOW, 11);

        expect(desert).not.toBeNull();
        expect([1, 2]).toContain(desert.selected);
        expect(snow).not.toBeNull();
        expect([1, 3]).toContain(snow.selected);
        expect(helpers.getTransitionSurfaceBlock(desert.x, desert.z, helpers.BIOMES.DESERT, 7)).toBe(desert.selected);
    });
});
