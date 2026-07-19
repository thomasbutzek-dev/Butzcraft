import { describe, expect, it } from 'vitest';

import { findSafeBedRespawn, normalizeRespawnBed } from '../js/respawn.js';

describe('bed respawn', () => {
    it('finds a safe standing place next to an existing bed', () => {
        const blocks = new Map([
            ['0,0,0', 38],
            ['1,-1,0', 3]
        ]);
        const world = { getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0 };

        expect(findSafeBedRespawn(world, { x: 0, y: 0, z: 0 })).toEqual({ x: 1.5, y: 1.7, z: 0.5 });
    });

    it('rejects a missing bed and unsafe surroundings', () => {
        const missingBed = { getBlock: () => 0 };
        expect(findSafeBedRespawn(missingBed, { x: 0, y: 0, z: 0 })).toBeNull();

        const unsafe = { getBlock: (x, y, z) => x === 0 && y === 0 && z === 0 ? 38 : 0 };
        expect(findSafeBedRespawn(unsafe, { x: 0, y: 0, z: 0 })).toBeNull();
    });

    it('normalizes only finite integer bed coordinates', () => {
        expect(normalizeRespawnBed({ x: 2.9, y: 4, z: -1.2 })).toEqual({ x: 2, y: 4, z: -2 });
        expect(normalizeRespawnBed({ x: NaN, y: 4, z: 1 })).toBeNull();
        expect(normalizeRespawnBed(null)).toBeNull();
    });
});
