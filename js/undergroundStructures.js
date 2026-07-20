const BLOCK = Object.freeze({
    AIR: 0,
    STONE: 3,
    WATER: 4,
    PLANKS: 26,
    WORKBENCH: 28,
    COAL_ORE: 56,
    IRON_ORE: 57,
    FURNACE: 59,
    CHEST: 75,
    ICE: 78,
    RAIL: 80,
    SUPPORT: 81,
    MOSSY_STONE: 84,
    COBBLESTONE: 85,
    TORCH: 101
});

const MINE_REGION_CHUNKS = 12;
const MINE_MODULE_MIN = 15;
const MINE_MODULE_MAX = 25;
const DUNGEON_REGION_CHUNKS = 24;
const DUNGEON_ROOM_MIN = 10;
const DUNGEON_ROOM_MAX = 16;

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function regionSeed(regionX, regionZ, worldSeed) {
    return Math.imul(regionX, 92837111)
        ^ Math.imul(regionZ, 689287499)
        ^ Math.imul(worldSeed | 0, 283923481)
        ^ 0x51f15e;
}

function themeForBiome(biome) {
    if (biome === 'Urwald') return 'overgrown';
    if (biome === 'Schneefeld') return 'frozen';
    return biome === 'Grasland' ? 'timber' : null;
}

function paletteForTheme(theme) {
    if (theme === 'overgrown') {
        return { floor: BLOCK.MOSSY_STONE, support: 13, accent: 14, hazard: 'flooded' };
    }
    if (theme === 'frozen') {
        return { floor: BLOCK.ICE, support: 5, accent: 77, hazard: 'frozen' };
    }
    return { floor: BLOCK.STONE, support: BLOCK.SUPPORT, accent: BLOCK.PLANKS, hazard: 'collapse' };
}

function dungeonThemeForBiome(biome) {
    if (biome === 'Urwald') return 'ruins';
    if (biome === 'Schneefeld') return 'frozen';
    return biome === 'Grasland' ? 'catacomb' : null;
}

function dungeonPaletteForTheme(theme) {
    if (theme === 'ruins') {
        return { wall: BLOCK.MOSSY_STONE, floor: BLOCK.MOSSY_STONE, accent: 14 };
    }
    if (theme === 'frozen') {
        return { wall: BLOCK.COBBLESTONE, floor: BLOCK.ICE, accent: 77 };
    }
    return { wall: BLOCK.COBBLESTONE, floor: BLOCK.COBBLESTONE, accent: BLOCK.MOSSY_STONE };
}

function lineBetween(from, to) {
    const dx = Math.sign(to.x - from.x);
    const dz = Math.sign(to.z - from.z);
    const xDistance = Math.abs(to.x - from.x);
    const zDistance = Math.abs(to.z - from.z);
    const distance = xDistance + zDistance;
    const cells = [];
    for (let step = 0; step <= distance; step++) {
        const xStep = Math.min(step, xDistance);
        const zStep = Math.max(0, step - xDistance);
        cells.push({
            x: from.x + dx * xStep,
            y: Math.round(from.y + (to.y - from.y) * (distance === 0 ? 0 : step / distance)),
            z: from.z + dz * zStep
        });
    }
    return cells;
}

function createMinePlan(random, theme, surfaceY) {
    const levels = 2 + Math.floor(random() * 2);
    const moduleCount = MINE_MODULE_MIN
        + Math.floor(random() * (MINE_MODULE_MAX - MINE_MODULE_MIN + 1));
    const modules = [];
    const connections = [];

    for (let level = 0; level < levels; level++) {
        for (let slot = 0; slot < 5; slot++) {
            const id = `main-${level}-${slot}`;
            const previous = modules.at(-1);
            const module = {
                id,
                role: level === 0 && slot === 0 ? 'entrance' : 'passage',
                type: slot % 2 === 0 ? 'tunnel' : 'junction',
                level,
                x: level * 10,
                y: -level * 4,
                z: (level % 2 === 0 ? slot : 4 - slot) * 8
            };
            modules.push(module);
            if (previous) connections.push({ from: previous.id, to: id, kind: 'main' });
        }
    }

    const mainModules = [...modules];
    const branchTypes = ['ore', 'storage', 'workshop', paletteForTheme(theme).hazard];
    let branchIndex = 0;
    while (modules.length < moduleCount) {
        const source = mainModules[1 + branchIndex % Math.max(1, mainModules.length - 2)];
        const side = source.level % 2 === 0 ? -1 : 1;
        const depth = 6 + Math.floor(branchIndex / mainModules.length) * 6;
        const branch = {
            id: `branch-${branchIndex}`,
            role: 'optional',
            type: branchTypes[branchIndex % branchTypes.length],
            level: source.level,
            x: source.x + side * depth,
            y: source.y,
            z: source.z
        };
        modules.push(branch);
        connections.push({ from: source.id, to: branch.id, kind: 'branch' });
        branchIndex++;
    }

    const reward = mainModules.at(-1);
    reward.role = 'reward';
    reward.type = 'reward';

    const moduleById = new Map(modules.map(module => [module.id, module]));
    const trackByPosition = new Map();
    const addTrack = (cell, mainline) => {
        const key = `${cell.x},${cell.y},${cell.z}`;
        const existing = trackByPosition.get(key);
        if (existing) existing.mainline ||= mainline;
        else trackByPosition.set(key, { ...cell, mainline });
    };
    for (const connection of connections) {
        for (const cell of lineBetween(moduleById.get(connection.from), moduleById.get(connection.to))) {
            addTrack(cell, connection.kind === 'main');
        }
    }

    const baseY = surfaceY - 7;
    const surfaceEntrance = { x: 0, y: surfaceY - baseY, z: -7 };
    for (const cell of lineBetween(surfaceEntrance, mainModules[0])) addTrack(cell, true);

    const cells = [...trackByPosition.values()];
    const minX = Math.min(...modules.map(module => module.x - 3), ...cells.map(cell => cell.x - 2));
    const maxX = Math.max(...modules.map(module => module.x + 3), ...cells.map(cell => cell.x + 2));
    const minY = Math.min(...modules.map(module => module.y - 1), ...cells.map(cell => cell.y - 1));
    const maxY = Math.max(...modules.map(module => module.y + 4), ...cells.map(cell => cell.y + 3));
    const minZ = Math.min(...modules.map(module => module.z - 3), ...cells.map(cell => cell.z - 2));
    const maxZ = Math.max(...modules.map(module => module.z + 3), ...cells.map(cell => cell.z + 2));

    return {
        theme,
        levels,
        baseY,
        modules,
        connections,
        track: cells,
        bounds: { minX, maxX, minY, maxY, minZ, maxZ }
    };
}

function createMineCandidate(regionX, regionZ, world, terrain) {
    const random = mulberry32(regionSeed(regionX, regionZ, world.seed));
    const regionStartX = regionX * MINE_REGION_CHUNKS;
    const regionStartZ = regionZ * MINE_REGION_CHUNKS;
    let placement = null;
    for (let attempt = 0; attempt < 24; attempt++) {
        const originCx = regionStartX + 5 + Math.floor(random() * 3);
        const originCz = regionStartZ + 5 + Math.floor(random() * 3);
        const x = originCx * world.chunkSize + Math.floor(world.chunkSize / 2);
        const z = originCz * world.chunkSize + Math.floor(world.chunkSize / 2);
        const biome = terrain.biomeAt(x, z);
        const theme = themeForBiome(biome);
        const surfaceY = terrain.heightAt(x, z);
        if (theme && surfaceY > world.waterLevel + 2) {
            placement = { originCx, originCz, x, z, biome, theme, surfaceY };
            break;
        }
    }
    if (!placement) return null;

    const { originCx, originCz, x, z, biome, theme, surfaceY } = placement;

    const plan = createMinePlan(random, theme, surfaceY);
    return {
        id: `mine:${regionX},${regionZ}:v${world.version}`,
        kind: 'mine',
        regionX,
        regionZ,
        originCx,
        originCz,
        x,
        z,
        surfaceY,
        biome,
        plan,
        bounds: {
            minX: x + plan.bounds.minX,
            maxX: x + plan.bounds.maxX,
            minY: plan.baseY + plan.bounds.minY,
            maxY: plan.baseY + plan.bounds.maxY,
            minZ: z + plan.bounds.minZ,
            maxZ: z + plan.bounds.maxZ
        }
    };
}

function createDungeonPlan(random, theme, surfaceY) {
    const baseY = Math.max(12, surfaceY - 18);
    const rooms = [
        { id: 'entrance', role: 'entrance', type: 'entrance', level: 0, x: 0, y: 0, z: 0 },
        { id: 'gallery', role: 'passage', type: 'gallery', level: 0, x: 0, y: 0, z: 8 },
        { id: 'upper-combat', role: 'encounter', type: 'spawner', level: 0, x: 0, y: 0, z: 16 },
        { id: 'junction', role: 'junction', type: 'junction', level: 0, x: 8, y: 0, z: 16 },
        { id: 'key-room', role: 'key', type: 'key', level: 0, x: 16, y: 0, z: 16 },
        { id: 'descent', role: 'passage', type: 'descent', level: 0, x: 24, y: 0, z: 16 },
        { id: 'lower-entry', role: 'passage', type: 'lower-entry', level: 1, x: 32, y: -7, z: 16 },
        { id: 'trap', role: 'trap', type: 'trap', level: 1, x: 32, y: -7, z: 24 },
        { id: 'gate-approach', role: 'gate', type: 'gate', level: 1, x: 24, y: -7, z: 24 },
        { id: 'lower-combat', role: 'encounter', type: 'spawner', level: 1, x: 16, y: -7, z: 24 },
        { id: 'reward', role: 'reward', type: 'end-chamber', level: 1, x: 8, y: -7, z: 24 },
        { id: 'secret', role: 'secret', type: 'secret', level: 1, x: 32, y: -7, z: 32 }
    ];
    const connections = [
        { from: 'entrance', to: 'gallery', kind: 'main' },
        { from: 'gallery', to: 'upper-combat', kind: 'main' },
        { from: 'upper-combat', to: 'junction', kind: 'main' },
        { from: 'junction', to: 'key-room', kind: 'main' },
        { from: 'key-room', to: 'descent', kind: 'main' },
        { from: 'descent', to: 'lower-entry', kind: 'descent' },
        { from: 'lower-entry', to: 'trap', kind: 'main' },
        { from: 'trap', to: 'gate-approach', kind: 'main' },
        { from: 'gate-approach', to: 'lower-combat', kind: 'gate' },
        { from: 'lower-combat', to: 'reward', kind: 'main' },
        { from: 'lower-entry', to: 'secret', kind: 'secret' }
    ];

    const targetRoomCount = Math.max(
        rooms.length,
        DUNGEON_ROOM_MIN + Math.floor(random() * (DUNGEON_ROOM_MAX - DUNGEON_ROOM_MIN + 1))
    );
    const branchSources = ['gallery', 'junction', 'key-room', 'trap'];
    let branchIndex = 0;
    while (rooms.length < targetRoomCount) {
        const source = rooms.find(room => room.id === branchSources[branchIndex % branchSources.length]);
        const branch = {
            id: `annex-${branchIndex}`,
            role: 'optional',
            type: branchIndex % 2 === 0 ? 'crypt' : 'store',
            level: source.level,
            x: source.x + (branchIndex % 2 === 0 ? -8 : 8),
            y: source.y,
            z: source.z + (branchIndex < 2 ? 0 : 8)
        };
        rooms.push(branch);
        connections.push({ from: source.id, to: branch.id, kind: 'branch' });
        branchIndex++;
    }

    const roomById = new Map(rooms.map(room => [room.id, room]));
    const passages = [];
    for (const connection of connections) {
        const from = roomById.get(connection.from);
        const to = roomById.get(connection.to);
        const widthAxis = from.x === to.x ? 'x' : 'z';
        passages.push(...lineBetween(from, to)
            .map(cell => ({ ...cell, kind: connection.kind, widthAxis })));
    }
    const gateConnection = connections.find(connection => connection.kind === 'gate');
    const gatePath = lineBetween(roomById.get(gateConnection.from), roomById.get(gateConnection.to));
    const gate = gatePath[Math.floor(gatePath.length / 2)];

    const minX = Math.min(...rooms.map(room => room.x - 3), ...passages.map(cell => cell.x - 2));
    const maxX = Math.max(...rooms.map(room => room.x + 3), ...passages.map(cell => cell.x + 2));
    const minY = Math.min(...rooms.map(room => room.y - 1), ...passages.map(cell => cell.y - 1));
    const maxY = Math.max(surfaceY - baseY + 3, ...rooms.map(room => room.y + 5));
    const minZ = Math.min(...rooms.map(room => room.z - 3), ...passages.map(cell => cell.z - 2));
    const maxZ = Math.max(...rooms.map(room => room.z + 3), ...passages.map(cell => cell.z + 2));

    return {
        theme,
        levels: 2,
        baseY,
        rooms,
        connections,
        passages,
        gate,
        bounds: { minX, maxX, minY, maxY, minZ, maxZ }
    };
}

function createDungeonCandidate(regionX, regionZ, world, terrain) {
    const random = mulberry32(regionSeed(regionX, regionZ, world.seed) ^ 0x6d2b79f5);
    const regionStartX = regionX * DUNGEON_REGION_CHUNKS;
    const regionStartZ = regionZ * DUNGEON_REGION_CHUNKS;
    let placement = null;
    for (let attempt = 0; attempt < 32; attempt++) {
        const originCx = regionStartX + 10 + Math.floor(random() * 5);
        const originCz = regionStartZ + 10 + Math.floor(random() * 5);
        const x = originCx * world.chunkSize + Math.floor(world.chunkSize / 2);
        const z = originCz * world.chunkSize + Math.floor(world.chunkSize / 2);
        const biome = terrain.biomeAt(x, z);
        const theme = dungeonThemeForBiome(biome);
        const surfaceY = terrain.heightAt(x, z);
        if (theme && surfaceY > world.waterLevel + 2) {
            placement = { originCx, originCz, x, z, biome, theme, surfaceY };
            break;
        }
    }
    if (!placement) return null;

    const plan = createDungeonPlan(random, placement.theme, placement.surfaceY);
    return {
        id: `dungeon:${regionX},${regionZ}:v${world.version}`,
        kind: 'dungeon',
        regionX,
        regionZ,
        ...placement,
        plan,
        bounds: {
            minX: placement.x + plan.bounds.minX,
            maxX: placement.x + plan.bounds.maxX,
            minY: plan.baseY + plan.bounds.minY,
            maxY: plan.baseY + plan.bounds.maxY,
            minZ: placement.z + plan.bounds.minZ,
            maxZ: placement.z + plan.bounds.maxZ
        }
    };
}

function intersectsChunk(candidate, cx, cz, chunkSize) {
    const minX = cx * chunkSize;
    const minZ = cz * chunkSize;
    return candidate.bounds.maxX >= minX
        && candidate.bounds.minX < minX + chunkSize
        && candidate.bounds.maxZ >= minZ
        && candidate.bounds.minZ < minZ + chunkSize;
}

function setBlock(data, chunk, world, x, y, z, blockType) {
    if (y < 0 || y >= world.chunkHeight) return;
    const minX = chunk.cx * world.chunkSize;
    const minZ = chunk.cz * world.chunkSize;
    const lx = x - minX;
    const lz = z - minZ;
    if (lx < 0 || lx >= world.chunkSize || lz < 0 || lz >= world.chunkSize) return;
    data[(y * world.chunkSize * world.chunkSize) + (lz * world.chunkSize) + lx] = blockType;
}

function stampRoom(candidate, module, chunk, world, palette) {
    const centerX = candidate.x + module.x;
    const centerY = candidate.plan.baseY + module.y;
    const centerZ = candidate.z + module.z;
    const radius = module.role === 'reward' || module.type === 'storage' ? 3 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            setBlock(chunk.data, chunk, world, centerX + dx, centerY - 1, centerZ + dz, palette.floor);
            for (let dy = 0; dy <= 3; dy++) {
                setBlock(chunk.data, chunk, world, centerX + dx, centerY + dy, centerZ + dz, BLOCK.AIR);
            }
        }
    }
}

function decorateRoom(candidate, module, chunk, world, palette) {
    const x = candidate.x + module.x;
    const y = candidate.plan.baseY + module.y;
    const z = candidate.z + module.z;
    if (module.role === 'reward') {
        setBlock(chunk.data, chunk, world, x + 2, y, z + 2, BLOCK.CHEST);
        setBlock(chunk.data, chunk, world, x - 2, y, z + 2, palette.accent);
    } else if (module.type === 'ore') {
        setBlock(chunk.data, chunk, world, x + 2, y + 1, z, BLOCK.COAL_ORE);
        setBlock(chunk.data, chunk, world, x - 2, y + 1, z + 1, BLOCK.IRON_ORE);
    } else if (module.type === 'storage') {
        setBlock(chunk.data, chunk, world, x + 2, y, z + 2, BLOCK.FURNACE);
        setBlock(chunk.data, chunk, world, x - 2, y, z + 2, BLOCK.PLANKS);
    } else if (module.type === 'workshop') {
        setBlock(chunk.data, chunk, world, x + 2, y, z + 2, BLOCK.WORKBENCH);
    } else if (module.type === 'collapse') {
        setBlock(chunk.data, chunk, world, x + 1, y, z, BLOCK.COBBLESTONE);
        setBlock(chunk.data, chunk, world, x + 1, y + 1, z, BLOCK.STONE);
    } else if (module.type === 'flooded') {
        setBlock(chunk.data, chunk, world, x + 1, y, z, BLOCK.WATER);
        setBlock(chunk.data, chunk, world, x + 2, y, z, BLOCK.WATER);
    } else if (module.type === 'frozen') {
        setBlock(chunk.data, chunk, world, x + 1, y, z, BLOCK.ICE);
        setBlock(chunk.data, chunk, world, x + 2, y, z, BLOCK.ICE);
    }
}

function stampMine(candidate, chunk, world) {
    const palette = paletteForTheme(candidate.plan.theme);
    for (const module of candidate.plan.modules) stampRoom(candidate, module, chunk, world, palette);

    for (const cell of candidate.plan.track) {
        const x = candidate.x + cell.x;
        const y = candidate.plan.baseY + cell.y;
        const z = candidate.z + cell.z;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                setBlock(chunk.data, chunk, world, x + dx, y - 1, z + dz, palette.floor);
                for (let dy = 0; dy <= 2; dy++) {
                    setBlock(chunk.data, chunk, world, x + dx, y + dy, z + dz, BLOCK.AIR);
                }
            }
        }
    }
    for (const cell of candidate.plan.track) {
        const x = candidate.x + cell.x;
        const y = candidate.plan.baseY + cell.y;
        const z = candidate.z + cell.z;
        setBlock(chunk.data, chunk, world, x, y, z, BLOCK.RAIL);
    }

    for (let index = 0; index < candidate.plan.track.length; index += 5) {
        const cell = candidate.plan.track[index];
        const x = candidate.x + cell.x;
        const y = candidate.plan.baseY + cell.y;
        const z = candidate.z + cell.z;
        for (let dy = 0; dy <= 2; dy++) {
            setBlock(chunk.data, chunk, world, x - 2, y + dy, z, palette.support);
            setBlock(chunk.data, chunk, world, x + 2, y + dy, z, palette.support);
        }
    }

    for (const module of candidate.plan.modules) decorateRoom(candidate, module, chunk, world, palette);
    setBlock(chunk.data, chunk, world, candidate.x - 2, candidate.surfaceY, candidate.z - 7, palette.support);
    setBlock(chunk.data, chunk, world, candidate.x + 2, candidate.surfaceY, candidate.z - 7, palette.support);
    setBlock(chunk.data, chunk, world, candidate.x - 2, candidate.surfaceY + 1, candidate.z - 7, BLOCK.TORCH);
    setBlock(chunk.data, chunk, world, candidate.x + 2, candidate.surfaceY + 1, candidate.z - 7, BLOCK.TORCH);
}

function stampDungeonRoom(candidate, room, chunk, world, palette) {
    const centerX = candidate.x + room.x;
    const centerY = candidate.plan.baseY + room.y;
    const centerZ = candidate.z + room.z;
    const radius = room.role === 'encounter' || room.role === 'reward' ? 3 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            setBlock(chunk.data, chunk, world, centerX + dx, centerY - 1, centerZ + dz, palette.floor);
            for (let dy = 0; dy <= 5; dy++) {
                const boundary = Math.abs(dx) === radius || Math.abs(dz) === radius || dy === 5;
                setBlock(
                    chunk.data,
                    chunk,
                    world,
                    centerX + dx,
                    centerY + dy,
                    centerZ + dz,
                    boundary ? palette.wall : BLOCK.AIR
                );
            }
        }
    }
}

function carveDungeonPassage(candidate, cell, chunk, world, palette) {
    const x = candidate.x + cell.x;
    const y = candidate.plan.baseY + cell.y;
    const z = candidate.z + cell.z;
    for (let width = -1; width <= 1; width++) {
        const offsetX = cell.widthAxis === 'x' ? width : 0;
        const offsetZ = cell.widthAxis === 'z' ? width : 0;
        setBlock(chunk.data, chunk, world, x + offsetX, y - 1, z + offsetZ, palette.floor);
        for (let dy = 0; dy <= 3; dy++) {
            setBlock(chunk.data, chunk, world, x + offsetX, y + dy, z + offsetZ, BLOCK.AIR);
        }
        setBlock(chunk.data, chunk, world, x + offsetX, y + 4, z + offsetZ, palette.wall);
    }
}

function decorateDungeonRoom(candidate, room, chunk, world, palette) {
    const x = candidate.x + room.x;
    const y = candidate.plan.baseY + room.y;
    const z = candidate.z + room.z;
    if (room.role === 'entrance') {
        setBlock(chunk.data, chunk, world, x - 1, y, z + 1, BLOCK.TORCH);
        setBlock(chunk.data, chunk, world, x + 1, y, z + 1, BLOCK.TORCH);
    } else if (room.role === 'encounter') {
        setBlock(chunk.data, chunk, world, x, y, z, BLOCK.SPAWNER);
        setBlock(chunk.data, chunk, world, x - 2, y, z + 2, palette.accent);
        setBlock(chunk.data, chunk, world, x + 2, y, z - 2, palette.accent);
    } else if (room.role === 'key') {
        setBlock(chunk.data, chunk, world, x + 2, y, z + 2, BLOCK.CHEST);
        setBlock(chunk.data, chunk, world, x - 2, y, z + 2, palette.accent);
    } else if (room.role === 'trap') {
        setBlock(chunk.data, chunk, world, x, y, z, 79);
        setBlock(chunk.data, chunk, world, x + 1, y, z, 79);
        setBlock(chunk.data, chunk, world, x - 1, y, z, 79);
    } else if (room.role === 'reward') {
        setBlock(chunk.data, chunk, world, x + 2, y, z + 2, BLOCK.CHEST);
        setBlock(chunk.data, chunk, world, x - 2, y, z + 2, palette.accent);
        setBlock(chunk.data, chunk, world, x, y, z - 2, BLOCK.TORCH);
    } else if (room.role === 'secret') {
        setBlock(chunk.data, chunk, world, x - 1, y, z, palette.accent);
        setBlock(chunk.data, chunk, world, x + 1, y, z, palette.accent);
    } else if (room.type === 'gallery' || room.type === 'crypt') {
        setBlock(chunk.data, chunk, world, x - 2, y, z, palette.accent);
        setBlock(chunk.data, chunk, world, x + 2, y, z, palette.accent);
    }
}

function stampDungeonGate(candidate, chunk, world, palette) {
    const gate = candidate.plan.gate;
    const x = candidate.x + gate.x;
    const y = candidate.plan.baseY + gate.y;
    const z = candidate.z + gate.z;
    for (let width = -1; width <= 1; width++) {
        for (let dy = 0; dy <= 2; dy++) {
            setBlock(chunk.data, chunk, world, x, y + dy, z + width, palette.wall);
        }
    }
}

function stampDungeon(candidate, chunk, world) {
    const palette = dungeonPaletteForTheme(candidate.plan.theme);
    for (const room of candidate.plan.rooms) stampDungeonRoom(candidate, room, chunk, world, palette);
    for (const cell of candidate.plan.passages) carveDungeonPassage(candidate, cell, chunk, world, palette);
    for (const room of candidate.plan.rooms) decorateDungeonRoom(candidate, room, chunk, world, palette);
    stampDungeonGate(candidate, chunk, world, palette);

    for (let y = candidate.plan.baseY; y <= candidate.surfaceY + 1; y++) {
        setBlock(chunk.data, chunk, world, candidate.x, y, candidate.z, BLOCK.AIR);
        setBlock(chunk.data, chunk, world, candidate.x + 1, y, candidate.z, BLOCK.AIR);
        setBlock(chunk.data, chunk, world, candidate.x, y, candidate.z + 1, BLOCK.AIR);
        setBlock(chunk.data, chunk, world, candidate.x + 1, y, candidate.z + 1, BLOCK.AIR);
    }
    for (let dx = -1; dx <= 2; dx++) {
        for (let dz = -1; dz <= 2; dz++) {
            if (dx === -1 || dx === 2 || dz === -1 || dz === 2) {
                setBlock(chunk.data, chunk, world, candidate.x + dx, candidate.surfaceY, candidate.z + dz, palette.wall);
            }
        }
    }
    setBlock(chunk.data, chunk, world, candidate.x - 1, candidate.surfaceY + 1, candidate.z - 1, BLOCK.TORCH);
    setBlock(chunk.data, chunk, world, candidate.x + 2, candidate.surfaceY + 1, candidate.z - 1, BLOCK.TORCH);
}

function publicMineStructure(candidate) {
    return {
        id: candidate.id,
        kind: candidate.kind,
        theme: candidate.plan.theme,
        biome: candidate.biome,
        origin: { x: candidate.x, y: candidate.plan.baseY, z: candidate.z },
        entrance: { x: candidate.x, y: candidate.surfaceY, z: candidate.z - 7 },
        bounds: { ...candidate.bounds },
        moduleCount: candidate.plan.modules.length,
        levels: candidate.plan.levels
    };
}

function publicDungeonStructure(candidate) {
    const gate = candidate.plan.gate;
    return {
        id: candidate.id,
        kind: candidate.kind,
        theme: candidate.plan.theme,
        biome: candidate.biome,
        origin: { x: candidate.x, y: candidate.plan.baseY, z: candidate.z },
        entrance: { x: candidate.x, y: candidate.surfaceY, z: candidate.z },
        bounds: { ...candidate.bounds },
        roomCount: candidate.plan.rooms.length,
        levels: candidate.plan.levels,
        gate: {
            x: candidate.x + gate.x,
            y: candidate.plan.baseY + gate.y,
            z: candidate.z + gate.z,
            widthAxis: 'z'
        },
        progression: {
            keyRequired: true,
            gateCount: 1,
            hasSecret: candidate.plan.rooms.some(room => room.role === 'secret'),
            hasEndChamber: candidate.plan.rooms.some(room => room.type === 'end-chamber')
        }
    };
}

/**
 * Stamps every worldgen-v2 underground structure intersecting one chunk.
 * Runtime metadata is emitted only by the structure's origin chunk.
 */
export function generateUndergroundStructures({ chunk, world, terrain }) {
    const result = { structures: [], entities: [], chests: [], spawners: [] };
    if (!chunk?.data || world?.version !== 2) return result;

    const centerRegionX = Math.floor(chunk.cx / MINE_REGION_CHUNKS);
    const centerRegionZ = Math.floor(chunk.cz / MINE_REGION_CHUNKS);
    for (let regionX = centerRegionX - 1; regionX <= centerRegionX + 1; regionX++) {
        for (let regionZ = centerRegionZ - 1; regionZ <= centerRegionZ + 1; regionZ++) {
            const candidate = createMineCandidate(regionX, regionZ, world, terrain);
            if (!candidate || !intersectsChunk(candidate, chunk.cx, chunk.cz, world.chunkSize)) continue;
            stampMine(candidate, chunk, world);
            if (candidate.originCx !== chunk.cx || candidate.originCz !== chunk.cz) continue;

            result.structures.push(publicMineStructure(candidate));
            for (const [cartIndex, fraction] of [0.25, 0.7].entries()) {
                const trackIndex = Math.min(
                    candidate.plan.track.length - 2,
                    Math.floor(candidate.plan.track.length * fraction)
                );
                const cell = candidate.plan.track[trackIndex];
                const next = candidate.plan.track[trackIndex + 1];
                result.entities.push({
                    id: `minecart:${candidate.id}:${cartIndex}`,
                    kind: 'minecart',
                    structureId: candidate.id,
                    x: candidate.x + cell.x,
                    y: candidate.plan.baseY + cell.y,
                    z: candidate.z + cell.z,
                    direction: {
                        x: Math.sign(next.x - cell.x),
                        z: Math.sign(next.z - cell.z)
                    }
                });
            }
            const reward = candidate.plan.modules.find(module => module.role === 'reward');
            result.chests.push({
                x: candidate.x + reward.x + 2,
                y: candidate.plan.baseY + reward.y,
                z: candidate.z + reward.z + 2,
                structureId: candidate.id,
                role: 'mine_reward',
                lootTable: `mine_${candidate.plan.theme}`
            });
        }
    }


    const centerDungeonRegionX = Math.floor(chunk.cx / DUNGEON_REGION_CHUNKS);
    const centerDungeonRegionZ = Math.floor(chunk.cz / DUNGEON_REGION_CHUNKS);
    for (let regionX = centerDungeonRegionX - 1; regionX <= centerDungeonRegionX + 1; regionX++) {
        for (let regionZ = centerDungeonRegionZ - 1; regionZ <= centerDungeonRegionZ + 1; regionZ++) {
            const candidate = createDungeonCandidate(regionX, regionZ, world, terrain);
            if (!candidate || !intersectsChunk(candidate, chunk.cx, chunk.cz, world.chunkSize)) continue;
            stampDungeon(candidate, chunk, world);
            if (candidate.originCx !== chunk.cx || candidate.originCz !== chunk.cz) continue;

            result.structures.push(publicDungeonStructure(candidate));
            const keyRoom = candidate.plan.rooms.find(room => room.role === 'key');
            const rewardRoom = candidate.plan.rooms.find(room => room.role === 'reward');
            result.chests.push(
                {
                    x: candidate.x + keyRoom.x + 2,
                    y: candidate.plan.baseY + keyRoom.y,
                    z: candidate.z + keyRoom.z + 2,
                    structureId: candidate.id,
                    role: 'dungeon_key',
                    lootTable: `dungeon_${candidate.plan.theme}`
                },
                {
                    x: candidate.x + rewardRoom.x + 2,
                    y: candidate.plan.baseY + rewardRoom.y,
                    z: candidate.z + rewardRoom.z + 2,
                    structureId: candidate.id,
                    role: 'dungeon_reward',
                    lootTable: `dungeon_${candidate.plan.theme}`
                }
            );
            for (const room of candidate.plan.rooms.filter(room => room.role === 'encounter')) {
                result.spawners.push({
                    x: candidate.x + room.x,
                    y: candidate.plan.baseY + room.y,
                    z: candidate.z + room.z,
                    structureId: candidate.id,
                    role: room.id
                });
            }
        }
    }
    return result;
}
