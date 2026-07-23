import { describe, expect, it } from 'vitest';
import { isPlayerTouchingFire } from '../js/environmentHazards.js';

describe('fire hazards', () => {
    it('detects fire at feet, body or head height', () => {
        const blocks = new Map([['2,8,3', 86]]);
        const world = { getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0 };
        expect(isPlayerTouchingFire(world, { x: 2.4, y: 10, z: 3.7 }, 86)).toBe(true);
        expect(isPlayerTouchingFire(world, { x: 4, y: 10, z: 3 }, 86)).toBe(false);
    });
});
