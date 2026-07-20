import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadWorkerVariants() {
    const self = {};
    const context = vm.createContext({
        self,
        console,
        Math,
        Uint8Array,
        Int16Array,
        Float32Array,
        Uint32Array,
        ArrayBuffer
    });
    const source = readChunkWorkerSource();
    vm.runInContext(`${source}\nself.__variants = { spawnTree, spawnPalm, BIOMES };`, context);
    vm.runInContext("GRAPHICS_VARIANT = 'B';", context);
    return self.__variants;
}

function layerSignature(data, blockType) {
    const layers = [];
    for (let y = 0; y < 64; y++) {
        let count = 0;
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                if (data[y * 16 * 16 + z * 16 + x] === blockType) count++;
            }
        }
        if (count) layers.push(`${y}:${count}`);
    }
    return layers.join('|');
}

describe('environment shape variation', () => {
    it('gives snowy conifers a different silhouette from plains trees', () => {
        const { spawnTree, BIOMES } = loadWorkerVariants();
        const plains = new Uint8Array(16 * 64 * 16);
        const snow = new Uint8Array(16 * 64 * 16);
        const fixedRng = () => 0.4;

        spawnTree(plains, 8, 20, 8, BIOMES.PLAINS, fixedRng, 120, 88);
        spawnTree(snow, 8, 20, 8, BIOMES.SNOW, fixedRng, 120, 88);

        expect(layerSignature(snow, 6)).not.toBe(layerSignature(plains, 6));
        expect(layerSignature(snow, 6).split('|').length).toBeGreaterThan(3);
    });

    it('creates several deterministic palm silhouettes from world position', () => {
        const { spawnPalm } = loadWorkerVariants();
        const positions = [[0, 0], [16, 0], [32, 16], [48, 32], [64, 64], [80, 96]];
        const signatures = positions.map(([worldX, worldZ]) => {
            const data = new Uint8Array(16 * 64 * 16);
            spawnPalm(data, 8, 20, 8, worldX, worldZ);
            return `${layerSignature(data, 15)}#${layerSignature(data, 16)}`;
        });

        expect(new Set(signatures).size).toBeGreaterThanOrEqual(3);

        const first = new Uint8Array(16 * 64 * 16);
        const second = new Uint8Array(16 * 64 * 16);
        spawnPalm(first, 8, 20, 8, 48, 32);
        spawnPalm(second, 8, 20, 8, 48, 32);
        expect(second).toEqual(first);
    });
});
