import { readFileSync } from 'node:fs';
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
    const source = readFileSync('js/chunkWorker.js', 'utf8');
    vm.runInContext(
        `${source}\nself.__villageGenerator = { createVillagePlan, spawnVillage, mulberry32, BIOMES };`,
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
    it('builds four to seven buildings around three distinct layouts and centers', () => {
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
                expect(plan.buildings.length).toBeGreaterThanOrEqual(4);
                expect(plan.buildings.length).toBeLessThanOrEqual(7);
            }
        }
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
});
