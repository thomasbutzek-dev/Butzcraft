import { afterEach, describe, expect, it, vi } from 'vitest';

describe('chunk worker underground structure integration', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('publishes one worldgen-v2 mine for a complete mine region', async () => {
        const messages = [];
        const worker = {
            postMessage(message) {
                messages.push(message);
            }
        };
        vi.stubGlobal('self', worker);
        await import('../js/chunkWorker.js?underground-integration');

        worker.onmessage({
            data: {
                type: 'init',
                config: { CHUNK_SIZE: 16, CHUNK_HEIGHT: 64, WATER_LEVEL: 32, CLOUD_HEIGHT: 58 },
                blockColors: {},
                blockTex: {},
                graphicsVariant: 'A',
                reducedGraphicsDetail: false,
                worldGenerationVersion: 2
            }
        });

        const structures = [];
        for (let cx = 0; cx < 12; cx++) {
            for (let cz = 12; cz < 24; cz++) {
                worker.onmessage({
                    data: {
                        type: 'generate',
                        cx,
                        cz,
                        epoch: 0,
                        buffer: new ArrayBuffer(16 * 64 * 16)
                    }
                });
                const terrain = messages.pop();
                structures.push(...(terrain.structureInfos || []));
            }
        }

        expect(structures.filter(structure => structure.kind === 'mine')).toHaveLength(1);
        expect(structures[0]).toMatchObject({
            id: 'mine:0,1:v2',
            kind: 'mine'
        });
    }, 15000);
});
