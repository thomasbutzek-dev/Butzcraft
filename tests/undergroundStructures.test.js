import { describe, expect, it } from 'vitest';
import { generateUndergroundStructures } from '../js/undergroundStructures.js';

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 64;

function blockAt(chunks, x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const data = chunks.get(`${cx},${cz}`);
    if (!data || y < 0 || y >= CHUNK_HEIGHT) return -1;
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return data[(y * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx];
}

describe('underground structure generation', () => {
    it('generates one deterministic multi-level mine expedition in a mine region', () => {
        const chunks = new Map();
        const structures = [];
        const entities = [];
        const chests = [];
        const context = {
            world: {
                seed: 0,
                version: 2,
                chunkSize: CHUNK_SIZE,
                chunkHeight: CHUNK_HEIGHT,
                waterLevel: 32
            },
            terrain: {
                biomeAt: () => 'Grasland',
                heightAt: () => 44
            }
        };

        for (let cx = 0; cx < 12; cx++) {
            for (let cz = 0; cz < 12; cz++) {
                const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
                const result = generateUndergroundStructures({
                    ...context,
                    chunk: { cx, cz, data }
                });
                chunks.set(`${cx},${cz}`, data);
                structures.push(...result.structures);
                entities.push(...result.entities);
                chests.push(...result.chests);
            }
        }

        expect(structures).toHaveLength(1);
        expect(structures[0]).toMatchObject({
            id: 'mine:0,0:v2',
            kind: 'mine',
            theme: 'timber'
        });
        expect(structures[0].moduleCount).toBeGreaterThanOrEqual(15);
        expect(structures[0].moduleCount).toBeLessThanOrEqual(25);
        expect(structures[0].levels).toBeGreaterThanOrEqual(2);
        expect(structures[0].levels).toBeLessThanOrEqual(3);
        expect(entities.filter(entity => entity.structureId === structures[0].id).length).toBeGreaterThanOrEqual(2);
        expect(chests).toContainEqual(expect.objectContaining({
            structureId: structures[0].id,
            role: 'mine_reward',
            lootTable: 'mine_timber'
        }));

        const railLevels = new Set();
        const bounds = structures[0].bounds;
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
                for (let y = bounds.minY; y <= bounds.maxY; y++) {
                    if (blockAt(chunks, x, y, z) === 80) railLevels.add(y);
                }
            }
        }
        expect(railLevels.size).toBeGreaterThanOrEqual(5);
    });

    it('generates a two-level dungeon expedition with key, gate, combat and reward metadata', () => {
        const chunks = new Map();
        const structures = [];
        const chests = [];
        const spawners = [];
        const context = {
            world: {
                seed: 0,
                version: 2,
                chunkSize: CHUNK_SIZE,
                chunkHeight: CHUNK_HEIGHT,
                waterLevel: 32
            },
            terrain: {
                biomeAt: () => 'Grasland',
                heightAt: () => 44
            }
        };

        for (let cx = 0; cx < 24; cx++) {
            for (let cz = 0; cz < 24; cz++) {
                const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
                const result = generateUndergroundStructures({
                    ...context,
                    chunk: { cx, cz, data }
                });
                chunks.set(`${cx},${cz}`, data);
                structures.push(...result.structures);
                chests.push(...result.chests);
                spawners.push(...result.spawners);
            }
        }

        const dungeons = structures.filter(structure => structure.kind === 'dungeon');
        expect(dungeons).toHaveLength(1);
        expect(dungeons[0]).toMatchObject({
            id: 'dungeon:0,0:v2',
            kind: 'dungeon',
            theme: 'catacomb',
            levels: 2,
            progression: {
                keyRequired: true,
                gateCount: 1,
                hasSecret: true,
                hasEndChamber: true
            }
        });
        expect(dungeons[0].roomCount).toBeGreaterThanOrEqual(10);
        expect(dungeons[0].roomCount).toBeLessThanOrEqual(16);
        expect(dungeons[0].altar).toMatchObject({
            structureId: dungeons[0].id,
            interaction: expect.objectContaining({ y: expect.any(Number) }),
            spawn: expect.objectContaining({ y: expect.any(Number) })
        });
        expect(dungeons[0].altar.blocks).toHaveLength(4);
        expect(blockAt(chunks, dungeons[0].altar.interaction.x, dungeons[0].altar.interaction.y, dungeons[0].altar.interaction.z)).toBe(58);
        expect(blockAt(chunks, dungeons[0].altar.interaction.x, dungeons[0].altar.interaction.y - 1, dungeons[0].altar.interaction.z)).toBe(84);

        const dungeonChests = chests.filter(chest => chest.structureId === dungeons[0].id);
        expect(dungeonChests.map(chest => chest.role).sort()).toEqual(['dungeon_key', 'dungeon_reward']);
        expect(spawners.filter(spawner => spawner.structureId === dungeons[0].id).length)
            .toBeGreaterThanOrEqual(2);
    });
});
