import { describe, expect, it } from 'vitest';
import {
    getFloatingIslandAt,
    getNaturalSpawnSurfaceAt,
    isNaturalSpawnSurfaceAllowed
} from '../js/naturalSpawnRules.js';

function findFloatingIslandSurface() {
    for (let x = -250; x <= 250; x++) {
        for (let z = -250; z <= 250; z++) {
            const island = getFloatingIslandAt(x, z);
            if (island?.thick > 0) return { x, z };
        }
    }
    throw new Error('expected a deterministic floating-island sample');
}

describe('natural spawn surfaces', () => {
    it('classifies generated floating-island columns semantically', () => {
        const sample = findFloatingIslandSurface();

        expect(getNaturalSpawnSurfaceAt(sample.x, sample.z)).toBe('floatingIsland');
        expect(getNaturalSpawnSurfaceAt(10_000, 10_000)).toBe('ground');
    });

    it.each(['zombie', 'skeleton'])(
        'rejects a natural %s spawn on a floating island independently of height',
        mobType => {
            const sample = findFloatingIslandSurface();
            const surface = getNaturalSpawnSurfaceAt(sample.x, sample.z);

            expect(isNaturalSpawnSurfaceAllowed(surface, mobType)).toBe(false);
            expect(isNaturalSpawnSurfaceAllowed('ground', mobType)).toBe(true);
        }
    );

    it('treats a column as island only where the island top actually is', () => {
        const sample = findFloatingIslandSurface();
        const island = getFloatingIslandAt(sample.x, sample.z);
        const top = island.y + island.thick - 1;

        expect(getNaturalSpawnSurfaceAt(sample.x, sample.z, { surfaceY: top, generationVersion: 2 })).toBe('floatingIsland');
        // Worldgen 3 lifts islands by four blocks.
        expect(getNaturalSpawnSurfaceAt(sample.x, sample.z, { surfaceY: top + 4, generationVersion: 3 })).toBe('floatingIsland');
        expect(getNaturalSpawnSurfaceAt(sample.x, sample.z, { surfaceY: top, generationVersion: 3 })).toBe('ground');
        // Worldgen 3 drops some islands: the column then shows ordinary ground far below.
        expect(getNaturalSpawnSurfaceAt(sample.x, sample.z, { surfaceY: 40, generationVersion: 3 })).toBe('ground');
    });
});
