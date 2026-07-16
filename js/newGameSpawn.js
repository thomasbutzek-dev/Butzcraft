import { CONFIG } from '../config.js?v=20260511a';
import { BIOMES, getBiomeAt, getHeightAt } from './world.js?v=20260716c';

const MAX_SPAWN_ATTEMPTS = 2048;

export function findNewGameSpawn(random = Math.random) {
    let firstLandCandidate = null;

    for (let attempt = 0; attempt < MAX_SPAWN_ATTEMPTS; attempt++) {
        const x = Math.floor(random() * 2000 - 1000);
        const z = Math.floor(random() * 2000 - 1000);
        const height = getHeightAt(x, z);

        if (height > CONFIG.WORLD.WATER_LEVEL) {
            const candidate = { x, z, height, biome: getBiomeAt(x, z) };
            if (!firstLandCandidate) firstLandCandidate = candidate;
            if (candidate.biome === BIOMES.PLAINS) return candidate;
        }
    }

    if (firstLandCandidate) return firstLandCandidate;
    throw new Error('Kein sicherer Land-Spawn gefunden');
}
