import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadTransitionHelpers(graphicsVariant) {
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
    vm.runInContext(`${source}\nself.__transitions = { getBiomeAt, getTransitionSurfaceBlock, BIOMES };`, context);
    vm.runInContext(`GRAPHICS_VARIANT = '${graphicsVariant}';`, context);
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
    it('softens desert and snow borders with deterministic material patches', () => {
        const helpers = loadTransitionHelpers('B');
        const desert = findChangedSurface(helpers, helpers.BIOMES.DESERT, 7);
        const snow = findChangedSurface(helpers, helpers.BIOMES.SNOW, 11);

        expect(desert).not.toBeNull();
        expect([1, 2]).toContain(desert.selected);
        expect(snow).not.toBeNull();
        expect([1, 3]).toContain(snow.selected);
        expect(helpers.getTransitionSurfaceBlock(desert.x, desert.z, helpers.BIOMES.DESERT, 7)).toBe(desert.selected);
    });

    it('leaves comparison variant A unchanged', () => {
        const helpers = loadTransitionHelpers('A');

        for (let x = -120; x <= 120; x += 12) {
            for (let z = -120; z <= 120; z += 12) {
                const biome = helpers.getBiomeAt(x, z);
                const baseBlock = biome === helpers.BIOMES.DESERT ? 7 : biome === helpers.BIOMES.SNOW ? 11 : 1;
                expect(helpers.getTransitionSurfaceBlock(x, z, biome, baseBlock)).toBe(baseBlock);
            }
        }
    });
});
