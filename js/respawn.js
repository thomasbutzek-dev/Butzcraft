const BED_BLOCKS = new Set([38, 39]);
const PASSABLE_BLOCKS = new Set([0, 4, 8, 9]);

export function normalizeRespawnBed(value) {
    if (!value || typeof value !== 'object') return null;
    if (![value.x, value.y, value.z].every(Number.isFinite)) return null;
    return { x: Math.floor(value.x), y: Math.floor(value.y), z: Math.floor(value.z) };
}

export function findSafeBedRespawn(world, bedPosition) {
    const bed = normalizeRespawnBed(bedPosition);
    if (!bed || !world?.getBlock || !BED_BLOCKS.has(world.getBlock(bed.x, bed.y, bed.z))) return null;

    const candidates = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    for (const [dx, dz] of candidates) {
        const x = bed.x + dx;
        const z = bed.z + dz;
        const feet = world.getBlock(x, bed.y, z);
        const head = world.getBlock(x, bed.y + 1, z);
        const ground = world.getBlock(x, bed.y - 1, z);
        if (feet !== 0 || head !== 0 || PASSABLE_BLOCKS.has(ground)) continue;
        return { x: x + 0.5, y: bed.y + 1.7, z: z + 0.5 };
    }
    return null;
}
