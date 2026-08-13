export const SPAWNER_BLOCK_TYPE = 83;

export function canParrotSpawnInBiome(biome) {
    return biome === 'Urwald';
}

function parseSpawnerKey(key) {
    const parts = key.split(',');
    return {
        x: Number(parts[0]),
        y: Number(parts[1]),
        z: Number(parts[2]),
        key
    };
}

export function findSpawnerBlocksInRange(world, px, py, pz, range) {
    const found = [];
    const minY = Math.max(1, py - range);
    const maxY = Math.min(62, py + range);

    if (world.spawnerKeys instanceof Set) {
        for (const key of world.spawnerKeys) {
            const spawner = parseSpawnerKey(key);
            if (
                spawner.x >= px - range && spawner.x <= px + range &&
                spawner.z >= pz - range && spawner.z <= pz + range &&
                spawner.y >= minY && spawner.y <= maxY
            ) {
                found.push(spawner);
            }
        }
        return found;
    }

    for (let x = px - range; x <= px + range; x++) {
        for (let z = pz - range; z <= pz + range; z++) {
            for (let y = minY; y <= maxY; y++) {
                if (world.getBlock(x, y, z) === SPAWNER_BLOCK_TYPE) {
                    found.push({ x, y, z, key: `${x},${y},${z}` });
                }
            }
        }
    }

    return found;
}

export function canSpawnerSpawnAt(world, x, y, z) {
    return world.getBlock(Math.floor(x), y, Math.floor(z)) === 0 &&
        world.getBlock(Math.floor(x), y + 1, Math.floor(z)) === 0;
}
