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
});
