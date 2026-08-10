import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SNOW_CHUNKS = [[-10, 19], [-9, 19], [-10, 20], [-9, 20]];
const SNOW_EDGE_CHUNKS = Array.from({ length: 343 }, (_, index) => [
    -2 + index % 7,
    -24 + Math.floor(index / 7)
]);
let chunks;
let edgeChunks;

async function generateChunks(coordinates) {
    const messages = [];
    const worker = {
        postMessage(message) {
            messages.push(message);
        }
    };
    vi.stubGlobal('self', worker);
    await import('../js/chunkWorker.js?snow-biome');

    worker.onmessage({
        data: {
            type: 'init',
            config: { CHUNK_SIZE: 16, CHUNK_HEIGHT: 64, WATER_LEVEL: 32, CLOUD_HEIGHT: 58 },
            blockColors: {},
            blockTex: {},
            worldGenerationVersion: 2
        }
    });

    return coordinates.map(([cx, cz]) => {
        worker.onmessage({
            data: {
                type: 'generate',
                cx,
                cz,
                epoch: 0,
                buffer: new ArrayBuffer(16 * 64 * 16)
            }
        });
        return messages.pop().data;
    });
}

function countTreeTrunks(data) {
    let count = 0;
    for (let y = 1; y < 64; y++) {
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                const index = y * 16 * 16 + z * 16 + x;
                if (data[index] === 5 && data[index - 16 * 16] === 11) count++;
            }
        }
    }
    return count;
}

function countUncoveredLeavesOnSnowTrees(data) {
    const uncovered = new Set();
    for (let y = 1; y < 52; y++) {
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                const rootIndex = y * 16 * 16 + z * 16 + x;
                if (data[rootIndex] !== 5 || data[rootIndex - 16 * 16] !== 11) continue;
                for (let leafY = y + 3; leafY < Math.min(63, y + 12); leafY++) {
                    for (let leafZ = Math.max(0, z - 4); leafZ <= Math.min(15, z + 4); leafZ++) {
                        for (let leafX = Math.max(0, x - 4); leafX <= Math.min(15, x + 4); leafX++) {
                            const leafIndex = leafY * 16 * 16 + leafZ * 16 + leafX;
                            if (data[leafIndex] === 6 && data[leafIndex + 16 * 16] === 0) {
                                uncovered.add(leafIndex);
                            }
                        }
                    }
                }
            }
        }
    }
    return uncovered.size;
}

function countUncoveredLeaves(data) {
    let count = 0;
    for (let y = 0; y < 63; y++) {
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                const index = y * 16 * 16 + z * 16 + x;
                if (data[index] === 6 && data[index + 16 * 16] === 0) count++;
            }
        }
    }
    return count;
}

function countOverheightSnowCaps(data) {
    let count = 0;
    for (let y = 1; y < 52; y++) {
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                const rootIndex = y * 16 * 16 + z * 16 + x;
                if (data[rootIndex] !== 5 || data[rootIndex - 16 * 16] !== 11) continue;
                let topWoodY = y;
                while (topWoodY + 1 < 64 && data[(topWoodY + 1) * 16 * 16 + z * 16 + x] === 5) topWoodY++;
                for (let capY = topWoodY + 4; capY < Math.min(64, topWoodY + 7); capY++) {
                    for (let capZ = Math.max(0, z - 4); capZ <= Math.min(15, z + 4); capZ++) {
                        for (let capX = Math.max(0, x - 4); capX <= Math.min(15, x + 4); capX++) {
                            if (data[capY * 16 * 16 + capZ * 16 + capX] === 77) count++;
                        }
                    }
                }
            }
        }
    }
    return count;
}

function countSurfaceBlocks(data, blockType) {
    let count = 0;
    for (let y = 1; y < 64; y++) {
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                const index = y * 16 * 16 + z * 16 + x;
                if (data[index] === blockType && data[index - 16 * 16] === 11) count++;
            }
        }
    }
    return count;
}

describe('snow biome generation', () => {
    beforeAll(async () => {
        const generated = await generateChunks([...SNOW_CHUNKS, ...SNOW_EDGE_CHUNKS]);
        chunks = generated.slice(0, SNOW_CHUNKS.length);
        edgeChunks = generated.slice(SNOW_CHUNKS.length);
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('keeps the snowy landscape sparsely wooded', () => {
        expect(chunks.reduce((sum, data) => sum + countTreeTrunks(data), 0)).toBeLessThanOrEqual(2);
    });

    it('leaves no green upper surface exposed on snowy conifers', () => {
        const uncoveredLeafCount = chunks.reduce((sum, data) => sum + countUncoveredLeaves(data), 0);

        expect(uncoveredLeafCount).toBe(0);
    });

    it('integrates snow into the crown instead of stacking blocks above it', () => {
        const overheightSnowCaps = chunks.reduce((sum, data) => sum + countOverheightSnowCaps(data), 0);

        expect(overheightSnowCaps).toBe(0);
    });

    it('keeps trees rooted in transition snow sparse and covered', () => {
        const treeCount = edgeChunks.reduce((sum, data) => sum + countTreeTrunks(data), 0);
        const uncoveredByChunk = edgeChunks.flatMap((data, index) => {
            const uncoveredLeafCount = countUncoveredLeavesOnSnowTrees(data);
            return uncoveredLeafCount > 0 ? [{ coordinates: SNOW_EDGE_CHUNKS[index], uncoveredLeafCount }] : [];
        });

        expect(uncoveredByChunk).toEqual([]);
        expect(treeCount).toBeLessThanOrEqual(12);
    });

    it('breaks up the snowfield with exposed rocks', () => {
        const rockCount = chunks.reduce((sum, data) => sum + countSurfaceBlocks(data, 3), 0);

        expect(rockCount).toBeGreaterThan(0);
    });

    it('adds ice mounds to the frozen terrain', () => {
        const iceCount = chunks.reduce((sum, data) => sum + countSurfaceBlocks(data, 78), 0);

        expect(iceCount).toBeGreaterThan(0);
    });

    it('scatters dead bushes across the snowfield', () => {
        const deadBushCount = chunks.reduce((sum, data) => sum + countSurfaceBlocks(data, 46), 0);

        expect(deadBushCount).toBeGreaterThanOrEqual(20);
    });
});
