const PASSIVE_ANIMALS = new Set(['cow', 'sheep', 'pig', 'chicken']);
const PASSABLE_BLOCKS = new Set([0, 8, 9, 10, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52, 54, 80, 101, 104]);

export function isKeepableAnimal(type) {
    return PASSIVE_ANIMALS.has(type);
}

export function getAnimalLureItem(type) {
    if (type === 'cow' || type === 'sheep') return 88;
    if (type === 'pig' || type === 'chicken') return 51;
    return 0;
}

function isPassable(world, x, y, z) {
    const block = world.getBlock(x, y, z);
    if (block === -1) return null;
    if (block === 103 || block === 33 || block === 34) {
        return (world.getBlockMeta?.(x, y, z) & 4) !== 0;
    }
    return PASSABLE_BLOCKS.has(block);
}

export function isAnimalPenEnclosed(world, x, footY, z, options = {}) {
    const maxRadius = options.maxRadius || 12;
    const maxCells = options.maxCells || 400;
    const startX = Math.floor(x);
    const startZ = Math.floor(z);
    const y = Math.floor(footY);
    const fenceSearchRadius = Math.min(maxRadius, 6);
    let nearbyFence = false;
    for (let distance = 1; distance <= fenceSearchRadius && !nearbyFence; distance++) {
        for (const [dx, dz] of [[distance,0],[-distance,0],[0,distance],[0,-distance]]) {
            const block = world.getBlock(startX + dx, y, startZ + dz);
            if (block === 102 || block === 103) {
                nearbyFence = true;
                break;
            }
        }
    }
    if (!nearbyFence) return false;

    const queue = [[startX, startZ]];
    const visited = new Set([`${startX},${startZ}`]);
    let foundFence = false;

    for (let cursor = 0; cursor < queue.length; cursor++) {
        if (queue.length > maxCells) return false;
        const [cellX, cellZ] = queue[cursor];
        for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nextX = cellX + dx;
            const nextZ = cellZ + dz;
            if (Math.abs(nextX - startX) > maxRadius || Math.abs(nextZ - startZ) > maxRadius) return false;

            const block = world.getBlock(nextX, y, nextZ);
            if (block === -1) return false;
            if (block === 102 || (block === 103 && (world.getBlockMeta?.(nextX, y, nextZ) & 4) === 0)) {
                foundFence = true;
                continue;
            }

            const feetOpen = isPassable(world, nextX, y, nextZ);
            const headOpen = isPassable(world, nextX, y + 1, nextZ);
            if (feetOpen === null || headOpen === null) return false;
            if (!feetOpen || !headOpen) continue;

            const floor = world.getBlock(nextX, y - 1, nextZ);
            if (floor === -1 || floor === 0 || floor === 4 || PASSABLE_BLOCKS.has(floor)) return false;

            const key = `${nextX},${nextZ}`;
            if (!visited.has(key)) {
                visited.add(key);
                queue.push([nextX, nextZ]);
            }
        }
    }

    return foundFence;
}
