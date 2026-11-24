import { afterEach, describe, expect, it, vi } from 'vitest';

describe('worldgen-v3 dungeon entrances', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps trees and palms clear of the gatehouse', async () => {
        const messages = [];
        const worker = { postMessage(message) { messages.push(message); } };
        vi.stubGlobal('self', worker);
        await import('../js/chunkWorker.js?dungeon-entrance-trees');
        worker.onmessage({
            data: {
                type: 'init',
                config: { CHUNK_SIZE: 16, CHUNK_HEIGHT: 64, WATER_LEVEL: 32, CLOUD_HEIGHT: 58 },
                blockColors: {},
                blockTex: {},
                worldGenerationVersion: 3
            }
        });
        const chunks = new Map();
        const generate = (cx, cz) => {
            const key = `${cx},${cz}`;
            if (!chunks.has(key)) {
                worker.onmessage({ data: { type: 'generate', cx, cz, epoch: 0, buffer: new ArrayBuffer(16 * 64 * 16) } });
                chunks.set(key, messages.pop());
            }
            return chunks.get(key);
        };
        const blockAt = (x, y, z) => generate(Math.floor(x / 16), Math.floor(z / 16))
            .data[y * 256 + (((z % 16) + 16) % 16) * 16 + (((x % 16) + 16) % 16)];

        // Dungeon origins lie in chunks 10..14 of their 24-chunk region.
        const dungeons = [];
        for (let cx = 10; cx <= 14; cx++) {
            for (let cz = 10; cz <= 14; cz++) {
                dungeons.push(...generate(cx, cz).structureInfos.filter(structure => structure.kind === 'dungeon'));
            }
        }
        expect(dungeons).toHaveLength(1);
        const { x, y, z } = dungeons[0].entrance;
        const treeBlocks = new Set([5, 6, 13, 14, 15, 16, 77]);
        for (let dx = -6; dx <= 6; dx++) {
            for (let dz = -6; dz <= 6; dz++) {
                for (let dy = -1; dy <= 12; dy++) {
                    const block = blockAt(x + dx, y + dy, z + dz);
                    const nearGatehouse = Math.max(Math.abs(dx), Math.abs(dz)) <= 2;
                    // Trunks anywhere in the clearance, leaves only over the gatehouse itself.
                    if ([5, 13, 15].includes(block) || (nearGatehouse && treeBlocks.has(block))) {
                        throw new Error(`tree block ${block} at ${x + dx},${y + dy},${z + dz}`);
                    }
                }
            }
        }
    }, 60000);
});
