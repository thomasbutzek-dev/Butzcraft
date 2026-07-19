import { describe, expect, it } from 'vitest';

import { getFoodInfo, isFoodType } from '../js/foodRules.js';

describe('food rules', () => {
    it('makes cooked food clearly more filling than its raw version', () => {
        expect(getFoodInfo(96).hunger).toBeGreaterThan(getFoodInfo(21).hunger);
        expect(getFoodInfo(97).hunger).toBeGreaterThan(getFoodInfo(22).hunger);
        expect(getFoodInfo(98).hunger).toBeGreaterThan(getFoodInfo(23).hunger);
        expect(getFoodInfo(99).hunger).toBeGreaterThan(getFoodInfo(25).hunger);
        expect(getFoodInfo(100).hunger).toBeGreaterThan(getFoodInfo(55).hunger);
    });

    it('keeps rotten flesh risky while cooked food is safe', () => {
        expect(getFoodInfo(24)).toMatchObject({ damageChance: 0.3, damage: 5 });
        expect(getFoodInfo(97).damageChance).toBeUndefined();
    });

    it('recognizes raw, simple and cooked food but no building items', () => {
        expect(isFoodType(17)).toBe(true);
        expect(isFoodType(51)).toBe(true);
        expect(isFoodType(100)).toBe(true);
        expect(isFoodType(3)).toBe(false);
    });
});
