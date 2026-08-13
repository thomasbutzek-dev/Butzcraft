import { readChunkWorkerSource } from './chunkWorkerSource.js';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadMineGenerator() {
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
        `${source}\nself.__mineGenerator = { createMinePlan, spawnMine, getMineRailStyle, mulberry32, BIOMES };`,
        context
    );
    return self.__mineGenerator;
}

function fixedRng(value) {
    return () => value;
}

function assertConnected(track) {
    const keys = new Set(track.map(cell => `${cell.x},${cell.z}`));
    const pending = [track[0]];
    const visited = new Set();

    while (pending.length > 0) {
        const cell = pending.pop();
        const key = `${cell.x},${cell.z}`;
        if (visited.has(key)) continue;
        visited.add(key);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const neighborKey = `${cell.x + dx},${cell.z + dz}`;
            if (keys.has(neighborKey) && !visited.has(neighborKey)) {
                pending.push({ x: cell.x + dx, z: cell.z + dz });
            }
        }
    }

    expect(visited.size).toBe(keys.size);
}

describe('modular mine generation', () => {
    it('builds compact connected plans with five to eight modules and at most two branches', () => {
        const { createMinePlan, mulberry32, BIOMES } = loadMineGenerator();

        for (let seed = 1; seed <= 40; seed++) {
            const plan = createMinePlan(mulberry32(seed), BIOMES.PLAINS);
            expect(plan.modules.length).toBeGreaterThanOrEqual(5);
            expect(plan.modules.length).toBeLessThanOrEqual(8);
            expect(plan.connections.filter(connection => connection.kind === 'branch').length).toBeLessThanOrEqual(2);
            expect(plan.bounds.maxX - plan.bounds.minX).toBeLessThanOrEqual(24);
            expect(plan.bounds.maxZ - plan.bounds.minZ).toBeLessThanOrEqual(24);
            assertConnected(plan.track.filter(cell => cell.mainline));
        }
    });

    it('uses distinct plains, jungle, and snow themes', () => {
        const { createMinePlan, BIOMES } = loadMineGenerator();
        const plains = createMinePlan(fixedRng(0.99), BIOMES.PLAINS);
        const jungle = createMinePlan(fixedRng(0.99), BIOMES.JUNGLE);
        const snow = createMinePlan(fixedRng(0.99), BIOMES.SNOW);

        expect([plains.theme, jungle.theme, snow.theme]).toEqual(['timber', 'overgrown', 'frozen']);
        expect(plains.modules.some(module => module.type === 'collapse')).toBe(true);
        expect(jungle.modules.some(module => module.type === 'flooded')).toBe(true);
        expect(snow.modules.some(module => module.type === 'frozen')).toBe(true);
    });

    it('derives straight, curved, junction, and crossing rail shapes from the track network', () => {
        const { getMineRailStyle } = loadMineGenerator();
        const styleFor = (neighbors) => {
            const rails = new Set(neighbors.map(([x, z]) => `${x},${z}`));
            return getMineRailStyle(0, 20, 0, (x, _y, z) => rails.has(`${x},${z}`) ? 80 : 0);
        };

        expect(styleFor([[0, -1], [0, 1]])).toEqual({ kind: 'straight', rotation: 0 });
        expect(styleFor([[-1, 0], [1, 0]])).toEqual({ kind: 'straight', rotation: 1 });
        expect(styleFor([[0, -1], [1, 0]])).toEqual({ kind: 'curve', rotation: 0 });
        expect(styleFor([[0, -1], [-1, 0], [1, 0]])).toEqual({ kind: 'junction', rotation: 0 });
        expect(styleFor([[0, -1], [1, 0], [0, 1], [-1, 0]])).toEqual({ kind: 'crossing', rotation: 0 });
    });

    it('keeps the visual rail direction across one-block slopes', () => {
        const { getMineRailStyle } = loadMineGenerator();
        const rails = new Set(['0,21,-1', '1,20,0']);
        const style = getMineRailStyle(
            0,
            20,
            0,
            (x, y, z) => rails.has(`${x},${y},${z}`) ? 80 : 0
        );

        expect(style).toEqual({ kind: 'curve', rotation: 0 });
    });

    it('stamps the complete planned railway across chunk boundaries', () => {
        const { createMinePlan, spawnMine, mulberry32, BIOMES } = loadMineGenerator();
        const mineX = 15;
        const mineZ = 15;
        const mineY = 22;
        const surfaceY = 28;
        const seed = 9182;
        const plan = createMinePlan(mulberry32(seed), BIOMES.JUNGLE);
        const chunks = new Map();

        for (let cx = -1; cx <= 1; cx++) {
            for (let cz = -1; cz <= 1; cz++) {
                const data = new Uint8Array(16 * 64 * 16);
                spawnMine(
                    data,
                    mineX - cx * 16,
                    mineY,
                    mineZ - cz * 16,
                    surfaceY,
                    mulberry32(seed),
                    BIOMES.JUNGLE
                );
                chunks.set(`${cx},${cz}`, data);
            }
        }

        const blockAt = (wx, y, wz) => {
            const cx = Math.floor(wx / 16);
            const cz = Math.floor(wz / 16);
            const data = chunks.get(`${cx},${cz}`);
            if (!data) return -1;
            const lx = wx - cx * 16;
            const lz = wz - cz * 16;
            return data[(y * 16 * 16) + (lz * 16) + lx];
        };

        for (const cell of plan.track) {
            expect(
                blockAt(mineX + cell.x, mineY, mineZ + cell.z),
                `missing rail at ${cell.x},${cell.z}`
            ).toBe(80);
        }
        expect([...chunks.values()].reduce(
            (count, data) => count + [...data].filter(block => block === 75).length,
            0
        )).toBeGreaterThanOrEqual(1);
    });
});
