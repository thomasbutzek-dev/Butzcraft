import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadDungeonGenerator() {
    const self = {};
    const context = vm.createContext({
        self,
        console,
        Math,
        Set,
        Map,
        Uint8Array,
        Int16Array,
        Float32Array,
        Uint32Array,
        ArrayBuffer
    });
    const source = readChunkWorkerSource();
    vm.runInContext(
        `${source}\nself.__dungeonGenerator = { createDungeonPlan, spawnDungeon, spawnDungeonMarker, mulberry32, BIOMES };`,
        context
    );
    return self.__dungeonGenerator;
}

function countBlocks(data, blockType) {
    let count = 0;
    for (const block of data) if (block === blockType) count++;
    return count;
}

describe('modular dungeon generation', () => {
    it('builds five to seven rooms around a readable main route', () => {
        const { createDungeonPlan, mulberry32, BIOMES } = loadDungeonGenerator();

        for (let seed = 1; seed <= 60; seed++) {
            const plan = createDungeonPlan(mulberry32(seed), BIOMES.PLAINS);
            expect(plan.rooms.length).toBeGreaterThanOrEqual(5);
            expect(plan.rooms.length).toBeLessThanOrEqual(7);
            expect(plan.connections.filter(connection => connection.kind === 'branch').length).toBeLessThanOrEqual(1);
            expect(plan.connections.filter(connection => connection.kind === 'loop').length).toBeLessThanOrEqual(1);
            expect(plan.rooms.some(room => room.role === 'entrance')).toBe(true);
            expect(plan.rooms.some(room => room.role === 'encounter')).toBe(true);
            expect(plan.rooms.some(room => room.role === 'reward')).toBe(true);
            expect(plan.bounds.maxX).toBeLessThanOrEqual(15);
            expect(plan.bounds.minX).toBeGreaterThanOrEqual(-15);
            expect(plan.bounds.maxZ).toBeLessThanOrEqual(15);
            expect(plan.bounds.minZ).toBeGreaterThanOrEqual(-15);
        }
    });

    it('provides at least eight room types across deterministic layouts', () => {
        const { createDungeonPlan, mulberry32, BIOMES } = loadDungeonGenerator();
        const roomTypes = new Set();
        for (let seed = 1; seed <= 120; seed++) {
            for (const room of createDungeonPlan(mulberry32(seed), BIOMES.PLAINS).rooms) {
                roomTypes.add(room.type);
            }
        }
        expect(roomTypes.size).toBeGreaterThanOrEqual(8);
    });

    it('uses distinct catacomb, ruin, and frozen-crypt themes', () => {
        const { createDungeonPlan, mulberry32, BIOMES } = loadDungeonGenerator();
        expect(createDungeonPlan(mulberry32(4), BIOMES.PLAINS).theme).toBe('catacomb');
        expect(createDungeonPlan(mulberry32(4), BIOMES.JUNGLE).theme).toBe('ruins');
        expect(createDungeonPlan(mulberry32(4), BIOMES.SNOW).theme).toBe('frozenCrypt');
    });

    it('stamps one spawner and reachable rewards across chunk boundaries', () => {
        const { spawnDungeon, mulberry32, BIOMES } = loadDungeonGenerator();
        const dungeonX = 15;
        const dungeonZ = 15;
        const dungeonY = 20;
        const seed = 4419;
        const chunks = [];

        for (let cx = -1; cx <= 1; cx++) {
            for (let cz = -1; cz <= 1; cz++) {
                const data = new Uint8Array(16 * 64 * 16);
                spawnDungeon(
                    data,
                    dungeonX - cx * 16,
                    dungeonY,
                    dungeonZ - cz * 16,
                    mulberry32(seed),
                    BIOMES.JUNGLE
                );
                chunks.push(data);
            }
        }

        expect(chunks.reduce((count, data) => count + countBlocks(data, 83), 0)).toBe(1);
        expect(chunks.reduce((count, data) => count + countBlocks(data, 75), 0)).toBeGreaterThanOrEqual(1);
    });

    it('marks the surface entrance with exactly two torches', () => {
        const { spawnDungeonMarker } = loadDungeonGenerator();
        const data = new Uint8Array(16 * 64 * 16);
        spawnDungeonMarker(data, 8, 24, 8);

        expect(countBlocks(data, 101)).toBe(2);
    });
});
