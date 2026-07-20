import { describe, expect, it } from 'vitest';
import { findNearestFootY } from '../js/npc.js';

describe('villager ground selection', () => {
    it('keeps the resident on the nearby floor instead of snapping onto the roof', () => {
        const standable = new Set([40, 45]);
        expect(findNearestFootY(40, y => standable.has(y))).toBe(40);
    });

    it('finds the closest safe step in either vertical direction', () => {
        expect(findNearestFootY(40, y => y === 38 || y === 43)).toBe(38);
    });
});
