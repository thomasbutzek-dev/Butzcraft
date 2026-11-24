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
        `${source}\nself.__villageGenerator = { createVillagePlan, spawnVillage, generateTerrain, getVillageCandidate, getTerrainHeightAt, getRawTerrainHeightAt, setWorldGenerationVersion: version => { WORLD_GENERATION_VERSION = version; }, mulberry32, BIOMES, VILLAGE_MIN_SPACING, VILLAGE_FLAT_RADIUS };`,
        context
    );
    return self.__villageGenerator;
}

function countBlocks(data, blockType) {
    let count = 0;
    for (const block of data) if (block === blockType) count++;
    return count;
}

function findV3Villages(generator, range = 40) {
    const villages = [];
    for (let cx = -range; cx <= range; cx++) {
        for (let cz = -range; cz <= range; cz++) {
            const village = generator.getVillageCandidate(cx, cz, 3);
            if (village) villages.push(village);
        }
    }
    return villages;
}

function generateVillageArea(generator, village, radiusChunks = 3) {
    const centerCx = Math.floor(village.x / 16);
    const centerCz = Math.floor(village.z / 16);
    const chunks = new Map();
    for (let cx = centerCx - radiusChunks; cx <= centerCx + radiusChunks; cx++) {
        for (let cz = centerCz - radiusChunks; cz <= centerCz + radiusChunks; cz++) {
            chunks.set(`${cx},${cz}`, generator.generateTerrain(cx, cz, new ArrayBuffer(16 * 64 * 16)).data);
        }
    }
    const getBlock = (wx, y, wz) => {
        const data = chunks.get(`${Math.floor(wx / 16)},${Math.floor(wz / 16)}`);
        if (!data || y < 0 || y >= 64) return 0;
        const lx = ((wx % 16) + 16) % 16;
        const lz = ((wz % 16) + 16) % 16;
        return data[y * 256 + lz * 16 + lx];
    };
    return { chunks, getBlock, minX: (centerCx - radiusChunks) * 16, maxX: (centerCx + radiusChunks + 1) * 16, minZ: (centerCz - radiusChunks) * 16, maxZ: (centerCz + radiusChunks + 1) * 16 };
}

describe('worldgen-v3 villages', () => {
    it('keeps villages at least the minimum spacing apart', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const villages = findV3Villages(generator);

        expect(villages.length).toBeGreaterThan(5);
        for (let first = 0; first < villages.length; first++) {
            for (let second = first + 1; second < villages.length; second++) {
                const a = villages[first];
                const b = villages[second];
                expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.scx},${a.scz} vs ${b.scx},${b.scz}`)
                    .toBeGreaterThanOrEqual(generator.VILLAGE_MIN_SPACING);
            }
        }
    }, 30000);

    it('still finds villages in all three village biomes', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const biomes = new Set(findV3Villages(generator, 60).map(village => village.biome));

        expect(biomes).toEqual(new Set([generator.BIOMES.PLAINS, generator.BIOMES.DESERT, generator.BIOMES.SNOW]));
    }, 30000);

    it('levels the village grounds so houses and paths need no raised foundations', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const villages = findV3Villages(generator).slice(0, 6);

        for (const village of villages) {
            for (let dx = -generator.VILLAGE_FLAT_RADIUS; dx <= generator.VILLAGE_FLAT_RADIUS; dx += 4) {
                for (let dz = -generator.VILLAGE_FLAT_RADIUS; dz <= generator.VILLAGE_FLAT_RADIUS; dz += 4) {
                    if (Math.hypot(dx, dz) > generator.VILLAGE_FLAT_RADIUS) continue;
                    expect(generator.getTerrainHeightAt(village.x + dx, village.z + dz), `${village.scx},${village.scz} at ${dx},${dz}`)
                        .toBe(village.baseY);
                }
            }

            const { villageInfos } = generator.generateTerrain(village.scx, village.scz, new ArrayBuffer(16 * 64 * 16));
            const info = villageInfos[0];
            expect(info.houses.length).toBeGreaterThanOrEqual(6);
            for (const house of info.houses) {
                // Floors and porches sit directly on the levelled ground: no foundation steps, no raised paths.
                expect(house.home.y, `${village.scx},${village.scz} ${house.type} floor`).toBe(village.baseY);
                expect(house.porch.y, `${village.scx},${village.scz} ${house.type} porch`).toBe(village.baseY);
            }
        }
    }, 30000);

    it('keeps trees, palms, cacti and snow rocks out of the village grounds', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const villages = findV3Villages(generator, 60);
        const byBiome = new Map();
        for (const village of villages) if (!byBiome.has(village.biome)) byBiome.set(village.biome, village);
        const foliage = new Set([6, 14, 16, 45]);

        for (const village of byBiome.values()) {
            const area = generateVillageArea(generator, village);
            for (let wx = village.x - generator.VILLAGE_FLAT_RADIUS; wx <= village.x + generator.VILLAGE_FLAT_RADIUS; wx++) {
                for (let wz = village.z - generator.VILLAGE_FLAT_RADIUS; wz <= village.z + generator.VILLAGE_FLAT_RADIUS; wz++) {
                    if (Math.hypot(wx - village.x, wz - village.z) > generator.VILLAGE_FLAT_RADIUS) continue;
                    // Trees reach at most about ten blocks; floating-island vines hang higher up.
                    for (let y = village.baseY; y < village.baseY + 11; y++) {
                        const block = area.getBlock(wx, y, wz);
                        expect(foliage.has(block), `${village.biome} ${village.scx},${village.scz}: block ${block} at ${wx},${y},${wz}`).toBe(false);
                        if (village.biome === generator.BIOMES.SNOW && y === village.baseY) {
                            expect(block, `snow rock at ${wx},${y},${wz}`).not.toBe(3);
                        }
                    }
                }
            }
        }
    }, 30000);

    it('stands every village lantern, fence and gate on something solid', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const villages = findV3Villages(generator, 60);
        const byBiome = new Map();
        for (const village of villages) if (!byBiome.has(village.biome)) byBiome.set(village.biome, village);
        let lanterns = 0;

        for (const village of byBiome.values()) {
            const area = generateVillageArea(generator, village);
            for (let wx = village.x - 46; wx <= village.x + 46; wx++) {
                for (let wz = village.z - 46; wz <= village.z + 46; wz++) {
                    for (let y = 1; y < 64; y++) {
                        const block = area.getBlock(wx, y, wz);
                        if (block !== 104 && block !== 102 && block !== 103) continue;
                        if (block === 104) lanterns++;
                        expect(area.getBlock(wx, y - 1, wz), `${village.biome}: block ${block} floating at ${wx},${y},${wz}`).not.toBe(0);
                    }
                }
            }
        }
        expect(lanterns).toBeGreaterThan(0);
    }, 30000);

    it('blends the village grounds into the surrounding terrain without cliffs', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        let checked = 0;
        for (const village of findV3Villages(generator).slice(0, 8)) {
            for (let dx = -100; dx <= 100; dx++) {
                for (let dz = -100; dz <= 100; dz += 3) {
                    const distance = Math.hypot(dx, dz);
                    if (distance < generator.VILLAGE_FLAT_RADIUS || distance > 100) continue;
                    const step = height => {
                        const here = height(village.x + dx, village.z + dz);
                        return Math.max(
                            Math.abs(here - height(village.x + dx + 1, village.z + dz)),
                            Math.abs(here - height(village.x + dx, village.z + dz + 1))
                        );
                    };
                    // At most one block steeper than the natural terrain at the same spot:
                    // rounding may add a single step, but never a terrace or cliff.
                    expect(step(generator.getTerrainHeightAt), `${village.scx},${village.scz} at ${dx},${dz}`)
                        .toBeLessThanOrEqual(step(generator.getRawTerrainHeightAt) + 1);
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(1000);
    }, 30000);

    it('lets players climb to the upper floor of every landmark building', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(3);
        const villages = findV3Villages(generator, 60);
        const byBiome = new Map();
        for (const village of villages) if (!byBiome.has(village.biome)) byBiome.set(village.biome, village);
        const passable = new Set([0, 33, 34, 101, 104, 9, 10, 43, 44, 46]);

        for (const village of byBiome.values()) {
            const area = generateVillageArea(generator, village, 2);
            const info = generator.generateTerrain(village.scx, village.scz, new ArrayBuffer(16 * 64 * 16)).villageInfos[0];
            const landmark = info.houses.find(house => house.isLandmark);
            const floorY = landmark.home.y - 1;
            const free = (x, y, z) => passable.has(area.getBlock(x, y, z));
            const canStand = (x, y, z) => !free(x, y - 1, z) && free(x, y, z) && free(x, y + 1, z);
            // Walk from inside the door; one-block steps up need an extra free block for the jump.
            const inward = landmark.door.z === landmark.porch.z + 1 ? 1 : -1;
            const start = { x: landmark.door.x, y: floorY + 1, z: landmark.door.z + inward };
            const seen = new Set([`${start.x},${start.y},${start.z}`]);
            const queue = [start];
            let reachedUpper = false;
            while (queue.length && !reachedUpper) {
                const cell = queue.shift();
                for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    for (const dy of [0, 1, -1]) {
                        const next = { x: cell.x + dx, y: cell.y + dy, z: cell.z + dz };
                        if (Math.abs(next.x - landmark.home.x) > 6 || Math.abs(next.z - landmark.home.z) > 7) continue;
                        if (!canStand(next.x, next.y, next.z)) continue;
                        if (dy === 1 && !free(cell.x, cell.y + 2, cell.z)) continue;
                        const key = `${next.x},${next.y},${next.z}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        if (next.y === floorY + 5) reachedUpper = true;
                        queue.push(next);
                    }
                }
            }
            expect(reachedUpper, `${village.biome} landmark at ${landmark.home.x},${landmark.home.z}`).toBe(true);
            expect(info.chests.some(chest => chest.y === floorY + 5), `${village.biome} upstairs chest`).toBe(true);
        }
    }, 30000);

    it('keeps desert temples out of the village grounds', () => {
        const self = {};
        const context = vm.createContext({ self, console, Math, Set, Map, Uint8Array, Int16Array, Float32Array, Uint32Array, ArrayBuffer });
        vm.runInContext(
            `${readChunkWorkerSource()}\nWORLD_GENERATION_VERSION = 3;\nself.temples = [];\nspawnDesertTemple = (data, x, y, z, worldX, worldZ) => self.temples.push([worldX, worldZ]);\nself.api = { generateTerrain, getVillageCandidate, BIOMES };`,
            context
        );
        const generator = self.api;
        const villages = findV3Villages(generator, 60);
        const desertVillages = villages.filter(village => village.biome === generator.BIOMES.DESERT).slice(0, 4);
        expect(desertVillages.length).toBeGreaterThan(0);
        for (const village of desertVillages) generateVillageArea(generator, village, 5);
        expect(self.temples.length, 'temples elsewhere in the searched area').toBeGreaterThan(0);
        for (const village of villages) {
            for (const [x, z] of self.temples) {
                expect(Math.hypot(x - village.x, z - village.z), `temple at ${x},${z}`).toBeGreaterThan(66);
            }
        }
    }, 60000);

    it('leaves worldgen-v2 terrain untouched', () => {
        const generator = loadVillageGenerator();
        generator.setWorldGenerationVersion(2);
        for (const [wx, wz] of [[0, 0], [952, 128], [-152, -824], [-688, -320]]) {
            expect(generator.getTerrainHeightAt(wx, wz)).toBe(generator.getRawTerrainHeightAt(wx, wz));
        }
    });
});

describe('biome-specific village generation', () => {
    it('keeps accepted V2 village foundations within two blocks of local terrain', () => {
        const { getVillageCandidate, createVillagePlan, spawnVillage, getTerrainHeightAt, mulberry32, BIOMES } = loadVillageGenerator();
        const foundBiomes = new Set();
        const formerExtremeSite = getVillageCandidate(-44, 3, 2);

        expect(formerExtremeSite).not.toBeNull();

        for (let cx = -45; cx <= 30; cx++) {
            for (let cz = -30; cz <= 30; cz++) {
                const village = getVillageCandidate(cx, cz, 2);
                if (!village) continue;
                foundBiomes.add(village.biome);
                let minimumCenterTerrainY = Infinity;
                for (let dx = -3; dx <= 3; dx++) {
                    for (let dz = -3; dz <= 3; dz++) {
                        minimumCenterTerrainY = Math.min(
                            minimumCenterTerrainY,
                            getTerrainHeightAt(village.x + dx, village.z + dz)
                        );
                    }
                }
                expect(village.baseY - 1 - minimumCenterTerrainY, `${village.biome} ${cx},${cz} center`).toBeLessThanOrEqual(2);
                const villageSeed = (village.x * 428759) ^ (village.z * 756839) ^ 314159;
                const plan = createVillagePlan(mulberry32(villageSeed), village.biome, 2);
                const info = spawnVillage(
                    new Uint8Array(16 * 64 * 16),
                    8,
                    village.baseY,
                    8,
                    mulberry32(villageSeed),
                    village.x,
                    village.z,
                    village.biome,
                    village.variant,
                    2
                );

                for (let index = 0; index < plan.buildings.length; index++) {
                    const building = plan.buildings[index];
                    const house = info.houses[index];
                    const iglooRadius = building.purpose === 'hall' ? 4 : 3;
                    const footprint = village.biome === BIOMES.SNOW && !building.isLandmark
                        ? {
                            x: village.x + building.dx + Math.floor(building.width / 2) - iglooRadius,
                            z: village.z + building.dz + Math.floor(building.depth / 2) - iglooRadius,
                            width: iglooRadius * 2 + 1,
                            depth: iglooRadius * 2 + 1
                        }
                        : {
                            x: village.x + building.dx,
                            z: village.z + building.dz,
                            width: building.width,
                            depth: building.depth
                        };
                    let minimumTerrainY = Infinity;
                    for (let dx = 0; dx < footprint.width; dx++) {
                        for (let dz = 0; dz < footprint.depth; dz++) {
                            minimumTerrainY = Math.min(
                                minimumTerrainY,
                                getTerrainHeightAt(footprint.x + dx, footprint.z + dz)
                            );
                        }
                    }
                    const foundationHeight = house.home.y - 1 - minimumTerrainY;
                    expect(foundationHeight, `${village.biome} ${cx},${cz} ${building.type}`).toBeLessThanOrEqual(2);
                }
            }
        }

        expect(foundBiomes).toEqual(new Set([BIOMES.PLAINS, BIOMES.DESERT, BIOMES.SNOW]));
    });

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
        expect(result.chestInfos).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'village_supply',
                villageId: 'village:11,-4',
                lootTable: 'village_courtyard'
            })
        ]));
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

describe('worldgen-v3 tree canopies', () => {
    it('continues canopies across chunk borders instead of cutting them flat', () => {
        const generator = loadVillageGenerator();
        // Jungle strip of 4 x 2 chunks with dense trees.
        const origin = [-190, -185];
        const leaf = block => block === 6 || block === 14 || block === 77;
        const edgeRatio = version => {
            generator.setWorldGenerationVersion(version);
            const chunks = new Map();
            for (let a = 0; a < 4; a++) {
                for (let b = 0; b < 2; b++) {
                    chunks.set(`${a},${b}`, generator.generateTerrain(origin[0] + a, origin[1] + b, new ArrayBuffer(16 * 64 * 16)).data);
                }
            }
            const get = (x, y, z) => chunks.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)[y * 256 + (z % 16) * 16 + (x % 16)];
            let border = 0, interior = 0, borderPlanes = 0, interiorPlanes = 0;
            for (let x = 0; x < 63; x++) {
                let faces = 0;
                for (let z = 0; z < 32; z++) {
                    for (let y = 1; y < 64; y++) {
                        const a = get(x, y, z), b = get(x + 1, y, z);
                        if ((leaf(a) && b === 0) || (leaf(b) && a === 0)) faces++;
                    }
                }
                if (x % 16 === 15) { border += faces; borderPlanes++; } else { interior += faces; interiorPlanes++; }
            }
            return (border / borderPlanes) / (interior / interiorPlanes);
        };

        // Cut canopies leave far more exposed leaf faces on the chunk border planes.
        expect(edgeRatio(2)).toBeGreaterThan(1.5);
        expect(edgeRatio(3)).toBeLessThan(1.3);
    }, 60000);
});

describe('worldgen-v3 sky', () => {
    function loadSky() {
        const self = {};
        const context = vm.createContext({ self, console, Math, Set, Map, Uint8Array, Int16Array, Float32Array, Uint32Array, ArrayBuffer });
        vm.runInContext(
            `${readChunkWorkerSource()}
CLOUD_HEIGHT = 58;
self.api = { generateTerrain, getWorldFloatingIslandAt, getFloatingIslandCellAt, getTerrainHeightAt, setWorldGenerationVersion: version => { WORLD_GENERATION_VERSION = version; } };`,
            context
        );
        return self.api;
    }

    it('keeps floating islands well above the ground below them', () => {
        const sky = loadSky();
        sky.setWorldGenerationVersion(3);
        let kept = 0;
        for (let cellX = -15; cellX < 15; cellX++) {
            for (let cellZ = -15; cellZ < 15; cellZ++) {
                const cell = sky.getFloatingIslandCellAt(cellX * 100 + 1, cellZ * 100 + 1);
                if (!cell) continue;
                const centerX = Math.floor(cell.centerX), centerZ = Math.floor(cell.centerZ);
                const island = sky.getWorldFloatingIslandAt(centerX, centerZ);
                if (!island) continue;
                kept++;
                for (let dx = -Math.ceil(cell.radius); dx <= Math.ceil(cell.radius); dx++) {
                    for (let dz = -Math.ceil(cell.radius); dz <= Math.ceil(cell.radius); dz++) {
                        if (!sky.getWorldFloatingIslandAt(centerX + dx, centerZ + dz)) continue;
                        // Vines hang up to seven blocks; trees grow about eight blocks tall.
                        expect(island.y - sky.getTerrainHeightAt(centerX + dx, centerZ + dz), `island ${centerX},${centerZ}`)
                            .toBeGreaterThanOrEqual(12);
                    }
                }
            }
        }
        expect(kept).toBeGreaterThan(50);
    }, 30000);

    it('moves clouds to the top of the world and keeps them off high ground', () => {
        const sky = loadSky();
        const cloudLayers = version => {
            sky.setWorldGenerationVersion(version);
            const layers = new Map();
            for (let cx = 0; cx < 8; cx++) {
                for (let cz = 0; cz < 8; cz++) {
                    const data = sky.generateTerrain(cx * 3, cz * 3, new ArrayBuffer(16 * 64 * 16)).data;
                    for (let index = 0; index < data.length; index++) {
                        if (data[index] !== 8) continue;
                        const y = Math.floor(index / 256);
                        layers.set(y, (layers.get(y) || 0) + 1);
                        if (version === 3) {
                            const wx = cx * 3 * 16 + (index % 16), wz = cz * 3 * 16 + Math.floor((index % 256) / 16);
                            expect(sky.getTerrainHeightAt(wx, wz), `cloud over ${wx},${wz}`).toBeLessThan(63 - 14);
                        }
                    }
                }
            }
            return [...layers.keys()];
        };

        expect(cloudLayers(2)).toEqual([58]);
        expect(cloudLayers(3)).toEqual([63]);
    }, 30000);
});
