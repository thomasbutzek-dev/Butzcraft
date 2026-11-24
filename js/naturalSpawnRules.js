export const NATURAL_SPAWN_SURFACES = Object.freeze({
    GROUND: 'ground',
    FLOATING_ISLAND: 'floatingIsland'
});

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

// Returns the island of the 100-block cell containing (wx, wz), or null if the cell has none.
export function getFloatingIslandCellAt(wx, wz) {
    const cellSize = 100;
    const cellX = Math.floor(wx / cellSize);
    const cellZ = Math.floor(wz / cellSize);
    const rng = mulberry32(cellX * 91827 + cellZ * 12345);
    if (rng() > 0.3) return null;

    return {
        centerX: cellX * cellSize + 20 + rng() * 60,
        centerZ: cellZ * cellSize + 20 + rng() * 60,
        radius: 6 + rng() * 4,
        y: 48 + rng() * 5,
        maxThick: 3 + rng() * 3
    };
}

export function getFloatingIslandAt(wx, wz) {
    const cell = getFloatingIslandCellAt(wx, wz);
    if (!cell) return null;
    const islandRadius = cell.radius;
    const islandY = cell.y;
    const dx = wx - cell.centerX;
    const dz = wz - cell.centerZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= islandRadius * islandRadius) return null;

    const maxThick = cell.maxThick;
    const thickness = maxThick * (1 - distSq / (islandRadius * islandRadius));
    return {
        y: Math.floor(islandY),
        thick: Math.floor(thickness)
    };
}

// Worldgen 3 lifts every floating island by this many blocks (and drops some islands).
export const FLOATING_ISLAND_LIFT_V3 = 4;

// With the found surface height, a column only counts as island when its top block is
// where the island's top would be. Worldgen 3 drops islands over villages and high
// ground; those columns then show ordinary ground and must allow spawns again.
export function getNaturalSpawnSurfaceAt(wx, wz, { surfaceY = null, generationVersion = 2 } = {}) {
    const island = getFloatingIslandAt(wx, wz);
    if (!((island?.thick || 0) > 0)) return NATURAL_SPAWN_SURFACES.GROUND;
    if (surfaceY === null) return NATURAL_SPAWN_SURFACES.FLOATING_ISLAND;
    const lift = generationVersion >= 3 ? FLOATING_ISLAND_LIFT_V3 : 0;
    return surfaceY === island.y + lift + island.thick - 1
        ? NATURAL_SPAWN_SURFACES.FLOATING_ISLAND
        : NATURAL_SPAWN_SURFACES.GROUND;
}

export function isNaturalSpawnSurfaceAllowed(surface) {
    return surface !== NATURAL_SPAWN_SURFACES.FLOATING_ISLAND;
}
