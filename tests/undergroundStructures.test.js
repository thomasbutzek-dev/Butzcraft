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

function generateMineRegion({ seed = 0, biome = 'Grasland' } = {}) {
    const chunks = new Map();
    const structures = [];
    const entities = [];
    const chests = [];
    const context = {
        world: {
            seed,
            version: 2,
            chunkSize: CHUNK_SIZE,
            chunkHeight: CHUNK_HEIGHT,
            waterLevel: 32
        },
        terrain: {
            biomeAt: () => biome,
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

    return { chunks, structures, entities, chests };
}

function getRailNeighbors(chunks, rail) {
    const neighbors = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (const dy of [-1, 0, 1]) {
            const candidate = { x: rail.x + dx, y: rail.y + dy, z: rail.z + dz };
            if (blockAt(chunks, candidate.x, candidate.y, candidate.z) !== 80) continue;
            neighbors.push(candidate);
            break;
        }
    }
    return neighbors;
}

function collectMineRails(chunks, bounds) {
    const rails = [];
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
            for (let y = bounds.minY; y <= bounds.maxY; y++) {
                if (blockAt(chunks, x, y, z) === 80) rails.push({ x, y, z });
            }
        }
    }
    return rails;
}

function countRailComponents(chunks, rails) {
    const keyFor = rail => `${rail.x},${rail.y},${rail.z}`;
    const remaining = new Map(rails.map(rail => [keyFor(rail), rail]));
    let componentCount = 0;
    while (remaining.size > 0) {
        componentCount++;
        const first = remaining.values().next().value;
        const pending = [first];
        remaining.delete(keyFor(first));
        while (pending.length > 0) {
            for (const neighbor of getRailNeighbors(chunks, pending.pop())) {
                const key = keyFor(neighbor);
                const next = remaining.get(key);
                if (!next) continue;
                remaining.delete(key);
                pending.push(next);
            }
        }
    }
    return componentCount;
}

describe('underground structure generation', () => {
    it('generates one deterministic multi-level mine expedition in a mine region', () => {
        const { chunks, structures, entities, chests } = generateMineRegion();

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

    it.each(['Grasland', 'Urwald', 'Schneefeld'].flatMap(
        biome => [0, 1, 2].map(seed => [biome, seed])
    ))(
        'keeps the %s mine railway for seed %i connected, supported, clear and usable by every minecart',
        (biome, seed) => {
            const { chunks, structures, entities } = generateMineRegion({ biome, seed });
            const mine = structures.find(structure => structure.kind === 'mine');
            const rails = collectMineRails(chunks, mine.bounds);

            expect(rails.length).toBeGreaterThan(0);
            expect(countRailComponents(chunks, rails)).toBe(1);
            for (const rail of rails) {
                expect(getRailNeighbors(chunks, rail).length).toBeGreaterThan(0);
                expect([0, 4]).not.toContain(blockAt(chunks, rail.x, rail.y - 1, rail.z));
                expect(blockAt(chunks, rail.x, rail.y + 1, rail.z)).toBe(0);
                expect(blockAt(chunks, rail.x, rail.y + 2, rail.z)).toBe(0);
            }

            expect(blockAt(chunks, mine.entrance.x, mine.entrance.y, mine.entrance.z)).toBe(80);
            const minecarts = entities.filter(entity => entity.structureId === mine.id);
            expect(minecarts).toHaveLength(2);
            for (const minecart of minecarts) {
                expect(blockAt(chunks, minecart.x, minecart.y, minecart.z)).toBe(80);
                expect(Math.abs(minecart.direction.x) + Math.abs(minecart.direction.z)).toBe(1);
                expect([-1, 0, 1].some(dy => blockAt(
                    chunks,
                    minecart.x + minecart.direction.x,
                    minecart.y + dy,
                    minecart.z + minecart.direction.z
                ) === 80)).toBe(true);
            }
        }
    );

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

    it('places no mine or dungeon entrance on reserved ground such as village grounds', () => {
        const generateRegion = isReserved => {
            const structures = [];
            for (let cx = 0; cx < 24; cx++) {
                for (let cz = 0; cz < 24; cz++) {
                    structures.push(...generateUndergroundStructures({
                        world: { seed: 0, version: 3, chunkSize: CHUNK_SIZE, chunkHeight: CHUNK_HEIGHT, waterLevel: 32 },
                        terrain: { biomeAt: () => 'Grasland', heightAt: () => 44, isReserved },
                        chunk: { cx, cz, data: new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE) }
                    }).structures);
                }
            }
            return structures;
        };

        const free = generateRegion(undefined);
        expect(free.length).toBeGreaterThan(0);
        expect(generateRegion(() => true)).toHaveLength(0);

        const reservedAround = free.map(structure => structure.entrance);
        const isReserved = (x, z) => reservedAround.some(point => Math.hypot(x - point.x, z - point.z) < 12);
        for (const structure of generateRegion(isReserved)) {
            expect(isReserved(structure.origin.x, structure.origin.z), structure.id).toBe(false);
        }
    });

    function generateV3Region({ heightAt = () => 44, size = 24 } = {}) {
        const chunks = new Map();
        const structures = [];
        const chests = [];
        const terrain = { biomeAt: () => 'Grasland', heightAt };
        for (let cx = 0; cx < size; cx++) {
            for (let cz = 0; cz < size; cz++) {
                const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
                const result = generateUndergroundStructures({
                    world: { seed: 0, version: 3, chunkSize: CHUNK_SIZE, chunkHeight: CHUNK_HEIGHT, waterLevel: 32 },
                    terrain,
                    chunk: { cx, cz, data }
                });
                structures.push(...result.structures);
                chests.push(...result.chests);
                chunks.set(`${cx},${cz}`, data);
            }
        }
        return { chunks, structures, chests };
    }

    it('sinks worldgen-v3 mines below the lowest ground of their footprint', () => {
        // Mines start in chunks 5..7 of their region and run 36 blocks towards +z: the
        // entrance stands on a terrace six blocks above the ground the far end runs under.
        const regionOffset = value => ((Math.floor(value / 16) % 12) + 12) % 12;
        const heightAt = (x, z) => regionOffset(z) <= 6 ? 44 : 38;
        const { chunks, structures } = generateV3Region({ heightAt, size: 12 });
        const mines = structures.filter(structure => structure.kind === 'mine');
        expect(mines.length).toBeGreaterThan(0);
        for (const mine of mines) {
            let rails = 0;
            for (let x = mine.bounds.minX; x <= mine.bounds.maxX; x++) {
                for (let z = mine.bounds.minZ; z <= mine.bounds.maxZ; z++) {
                    for (let y = mine.bounds.minY; y <= mine.bounds.maxY; y++) {
                        if (blockAt(chunks, x, y, z) !== 80) continue;
                        if (x === mine.entrance.x && z < mine.origin.z) continue; // entrance ramp
                        rails++;
                        expect(heightAt(x, z) - y, `${mine.id} rail at ${x},${y},${z}`).toBeGreaterThanOrEqual(5);
                    }
                }
            }
            expect(rails).toBeGreaterThan(50);
        }
    });

    it('gives worldgen-v3 dungeons a climbable spiral staircase, a marked gate and lit passages', () => {
        const { chunks, structures, chests } = generateV3Region();
        // Furnishing must never overwrite a loot chest (a store annex can overlap the key room).
        for (const chest of chests) expect(blockAt(chunks, chest.x, chest.y, chest.z), chest.role).toBe(75);
        const dungeon = structures.find(structure => structure.kind === 'dungeon');
        expect(dungeon).toBeTruthy();
        const block = (x, y, z) => blockAt(chunks, x, y, z);
        const free = (x, y, z) => block(x, y, z) === 0 || block(x, y, z) === 101;
        const canStand = (x, y, z) => !free(x, y - 1, z) && free(x, y, z) && free(x, y + 1, z);
        const { x: ex, z: ez } = dungeon.entrance;
        const start = { x: ex + 2, y: dungeon.origin.y, z: ez };
        expect(canStand(start.x, start.y, start.z)).toBe(true);
        const seen = new Set([`${start.x},${start.y},${start.z}`]);
        const queue = [start];
        let reachedSurface = false;
        while (queue.length && !reachedSurface) {
            const cell = queue.shift();
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                for (const dy of [0, 1, -1]) {
                    const next = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
                    if (Math.abs(next.x - ex) > 2 || Math.abs(next.z - ez) > 2) continue;
                    if (!canStand(next.x, next.y, next.z)) continue;
                    if (dy === 1 && !free(cell.x, cell.y + 2, cell.z)) continue;
                    const key = `${next.x},${next.y},${next.z}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    if (next.y >= dungeon.entrance.y) reachedSurface = true;
                    queue.push(next);
                }
            }
        }
        expect(reachedSurface, 'climb from the entrance room to the surface').toBe(true);

        const gate = dungeon.gate;
        for (let width = -1; width <= 1; width++) {
            for (let dy = 0; dy <= 2; dy++) expect(block(gate.x, gate.y + dy, gate.z + width)).toBe(26);
        }
        expect(block(gate.x, gate.y + 3, gate.z)).toBe(29);

        let torches = 0;
        for (let x = dungeon.bounds.minX; x <= dungeon.bounds.maxX; x++) {
            for (let z = dungeon.bounds.minZ; z <= dungeon.bounds.maxZ; z++) {
                for (let y = dungeon.bounds.minY; y < dungeon.entrance.y; y++) if (block(x, y, z) === 101) torches++;
            }
        }
        expect(torches).toBeGreaterThanOrEqual(15);
    });
});
