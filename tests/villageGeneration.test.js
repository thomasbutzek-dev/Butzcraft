import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadVillageGenerator() {
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
        `${source}\nself.__villageGenerator = { createVillagePlan, spawnVillage, generateTerrain, getVillageCandidate, setWorldGenerationVersion: version => { WORLD_GENERATION_VERSION = version; }, mulberry32, BIOMES };`,
        context
    );
    return self.__villageGenerator;
}

function countBlocks(data, blockType) {
    let count = 0;
    for (const block of data) if (block === blockType) count++;
    return count;
}

describe('biome-specific village generation', () => {
    it('keeps V2 desert villages discoverable in a practical search area', () => {
        const { getVillageCandidate, BIOMES } = loadVillageGenerator();
        const candidates = [];
        for (let cx = -30; cx <= 30; cx++) {
            for (let cz = -30; cz <= 30; cz++) {
                const candidate = getVillageCandidate(cx, cz, 2);
                if (candidate) candidates.push(candidate);
            }
        }

        expect(candidates.some(candidate => candidate.biome === BIOMES.DESERT)).toBe(true);
    });

    it('generates a desert village within practical travel distance', () => {
        const { generateTerrain } = loadVillageGenerator();
        const buffer = new ArrayBuffer(16 * 64 * 16);

        const result = generateTerrain(11, -4, buffer);

        expect(result.villageInfos).toEqual([
            expect.objectContaining({ layout: 'courtyard', center: 'market' })
        ]);
    });

    it('supports V2 village posts and gates instead of leaving them floating', () => {
        const { generateTerrain, getVillageCandidate, setWorldGenerationVersion, BIOMES } = loadVillageGenerator();
        let sourceChunk;
        for (let cx = -30; cx <= 30 && !sourceChunk; cx++) {
            for (let cz = -30; cz <= 30; cz++) {
                const candidate = getVillageCandidate(cx, cz, 2);
                if (candidate?.biome === BIOMES.DESERT) {
                    sourceChunk = candidate;
                    break;
                }
            }
        }
        setWorldGenerationVersion(2);
        const result = generateTerrain(sourceChunk.scx, sourceChunk.scz, new ArrayBuffer(16 * 64 * 16));
        const stride = 16 * 16;
        let checked = 0;
        for (let y = 1; y < 64; y++) {
            for (let z = 0; z < 16; z++) {
                for (let x = 0; x < 16; x++) {
                    const index = y * stride + z * 16 + x;
                    if (result.data[index] !== 102 && result.data[index] !== 103) continue;
                    expect(result.data[index - stride]).not.toBe(0);
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('builds six to nine larger buildings around three distinct layouts and centers', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();
        const cases = [
            [BIOMES.PLAINS, 'farmstead', 'well'],
            [BIOMES.DESERT, 'courtyard', 'market'],
            [BIOMES.SNOW, 'shelteredLine', 'hearth']
        ];

        for (const [biome, layout, center] of cases) {
            for (let seed = 1; seed <= 40; seed++) {
                const plan = createVillagePlan(mulberry32(seed), biome);
                expect(plan.layout).toBe(layout);
                expect(plan.center).toBe(center);
                expect(plan.buildings.length).toBeGreaterThanOrEqual(6);
                expect(plan.buildings.length).toBeLessThanOrEqual(9);
                expect(plan.buildings.every(building => building.width >= 7 && building.depth >= 7)).toBe(true);
                expect(plan.buildings.filter(building => building.isLandmark)).toHaveLength(1);
                expect(plan.buildings.filter(building => building.hasPen)).toHaveLength(1);
                expect(plan.residentCount).toBeGreaterThanOrEqual(7);
                expect(plan.residentCount).toBeLessThanOrEqual(12);
            }
        }
    });

    it('keeps legacy world generation on the compact village geometry', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();
        const plan = createVillagePlan(mulberry32(12), BIOMES.PLAINS, 1);

        expect(plan.buildings.length).toBeGreaterThanOrEqual(4);
        expect(plan.buildings.length).toBeLessThanOrEqual(7);
        expect(plan.buildings.every(building => building.width <= 6 && building.depth <= 6)).toBe(true);
    });

    it('offers at least six recognizable building types in every biome', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();

        for (const biome of [BIOMES.PLAINS, BIOMES.DESERT, BIOMES.SNOW]) {
            const types = new Set();
            for (let seed = 1; seed <= 80; seed++) {
                for (const building of createVillagePlan(mulberry32(seed), biome).buildings) {
                    types.add(building.type);
                }
            }
            expect(types.size).toBeGreaterThanOrEqual(6);
        }
    });

    it('assigns villagers to professions matching each building purpose', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();
        const professions = { home: 1, storage: 1, workshop: 0, trade: 2, hall: 3, special: 1 };

        for (const biome of [BIOMES.PLAINS, BIOMES.DESERT, BIOMES.SNOW]) {
            for (const building of createVillagePlan(mulberry32(48), biome).buildings) {
                expect(building.professionIdx).toBe(professions[building.purpose]);
            }
        }
    });

    it('keeps loose plains, compact desert, and linear snow silhouettes', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();
        const plains = createVillagePlan(mulberry32(12), BIOMES.PLAINS);
        const desert = createVillagePlan(mulberry32(12), BIOMES.DESERT);
        const snow = createVillagePlan(mulberry32(12), BIOMES.SNOW);
        const span = (plan, axis) => {
            const values = plan.buildings.map(building => building[axis]);
            return Math.max(...values) - Math.min(...values);
        };

        expect(span(plains, 'dx')).toBeGreaterThan(span(desert, 'dx'));
        expect(span(plains, 'dz')).toBeGreaterThan(span(desert, 'dz'));
        expect(span(snow, 'dx')).toBeGreaterThan(span(snow, 'dz'));
    });

    it('keeps V2 building footprints from overlapping', () => {
        const { createVillagePlan, mulberry32, BIOMES } = loadVillageGenerator();
        for (const biome of [BIOMES.PLAINS, BIOMES.DESERT, BIOMES.SNOW]) {
            for (let seed = 1; seed <= 40; seed++) {
                const buildings = createVillagePlan(mulberry32(seed), biome, 2).buildings;
                for (let first = 0; first < buildings.length; first++) {
                    for (let second = first + 1; second < buildings.length; second++) {
                        const a = buildings[first];
                        const b = buildings[second];
                        const separated = a.dx + a.width <= b.dx || b.dx + b.width <= a.dx ||
                            a.dz + a.depth <= b.dz || b.dz + b.depth <= a.dz;
                        expect(separated, `${biome} seed ${seed}: ${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(true);
                    }
                }
            }
        }
    });

    it('stamps the biome-specific center and functional interiors', () => {
        const { spawnVillage, mulberry32, BIOMES } = loadVillageGenerator();
        const generate = (biome) => {
            const chunks = [];
            for (let cx = -1; cx <= 1; cx++) {
                for (let cz = -1; cz <= 1; cz++) {
                    const data = new Uint8Array(16 * 64 * 16);
                    spawnVillage(data, 8 - cx * 16, 34, 8 - cz * 16, mulberry32(27), 8, 8, biome);
                    chunks.push(data);
                }
            }
            return chunks;
        };
        const total = (chunks, block) => chunks.reduce((sum, data) => sum + countBlocks(data, block), 0);
        const plains = generate(BIOMES.PLAINS);
        const desert = generate(BIOMES.DESERT);
        const snow = generate(BIOMES.SNOW);

        expect(total(plains, 4)).toBeGreaterThan(0);
        expect(total(desert, 4)).toBe(0);
        expect(total(desert, 88)).toBeGreaterThan(0);
        expect(total(snow, 86)).toBeGreaterThan(0);
        expect(total(plains, 28) + total(plains, 59) + total(plains, 75)).toBeGreaterThan(0);
    });

    it('stamps doors, lanterns, fences, gates and resident waypoints in V2 villages', () => {
        const { spawnVillage, mulberry32, BIOMES } = loadVillageGenerator();
        const chunks = [];
        let villageInfo;
        for (let cx = -3; cx <= 3; cx++) {
            for (let cz = -3; cz <= 3; cz++) {
                const data = new Uint8Array(16 * 64 * 16);
                const info = spawnVillage(data, 8 - cx * 16, 34, 8 - cz * 16, mulberry32(41), 8, 8, BIOMES.PLAINS, 0, 2);
                if (cx === 0 && cz === 0) villageInfo = info;
                chunks.push(data);
            }
        }
        const total = block => chunks.reduce((sum, data) => sum + countBlocks(data, block), 0);

        expect(total(33)).toBeGreaterThan(0);
        expect(total(34)).toBeGreaterThan(0);
        expect(total(102)).toBeGreaterThan(0);
        expect(total(103)).toBeGreaterThan(0);
        expect(total(104)).toBeGreaterThanOrEqual(4);
        expect(villageInfo.houses.length).toBeGreaterThanOrEqual(6);
        expect(villageInfo.houses.length).toBeLessThanOrEqual(9);
        expect(villageInfo.residentCount).toBeGreaterThanOrEqual(7);
        expect(villageInfo.waypoints.some(point => point.role === 'center')).toBe(true);
        expect(villageInfo.houses.every(house => house.home && house.door && house.porch && house.work)).toBe(true);
    });
});
