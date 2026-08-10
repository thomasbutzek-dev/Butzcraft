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

export function getFloatingIslandAt(wx, wz) {
    const cellSize = 100;
    const cellX = Math.floor(wx / cellSize);
    const cellZ = Math.floor(wz / cellSize);
    const rng = mulberry32(cellX * 91827 + cellZ * 12345);
    if (rng() > 0.3) return null;

    const centerX = cellX * cellSize + 20 + rng() * 60;
    const centerZ = cellZ * cellSize + 20 + rng() * 60;
    const islandRadius = 6 + rng() * 4;
    const islandY = 48 + rng() * 5;
    const dx = wx - centerX;
    const dz = wz - centerZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= islandRadius * islandRadius) return null;

    const maxThick = 3 + rng() * 3;
    const thickness = maxThick * (1 - distSq / (islandRadius * islandRadius));
    return {
        y: Math.floor(islandY),
        thick: Math.floor(thickness)
    };
}

export function getNaturalSpawnSurfaceAt(wx, wz) {
    return (getFloatingIslandAt(wx, wz)?.thick || 0) > 0
        ? NATURAL_SPAWN_SURFACES.FLOATING_ISLAND
        : NATURAL_SPAWN_SURFACES.GROUND;
}

export function isNaturalSpawnSurfaceAllowed(surface) {
    return surface !== NATURAL_SPAWN_SURFACES.FLOATING_ISLAND;
}
