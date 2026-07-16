import { describe, expect, it } from 'vitest';

import { getAttackProfile, getBowInfo, getSwordInfo, isBowType, isSwordType } from '../js/combatRules.js';

describe('combat quality rules', () => {
    it('keeps bare hands weak but viable and tools only slightly stronger', () => {
        expect(getAttackProfile(0)).toMatchObject({ kind: 'hand', damage: 2, usesDurability: false });
        expect(getAttackProfile(63)).toMatchObject({ kind: 'tool', damage: 3, usesDurability: false });
    });

    it('gives every confirmed sword quality its own damage and durability', () => {
        expect(getSwordInfo(89)).toMatchObject({ material: 'Holz', damage: 5, maxDurability: 100 });
        expect(getSwordInfo(90)).toMatchObject({ material: 'Stein', damage: 7, maxDurability: 200 });
        expect(getSwordInfo(91)).toMatchObject({ material: 'Eisen', damage: 9, maxDurability: 450 });
        expect(getSwordInfo(92)).toMatchObject({ material: 'Gold', damage: 11, maxDurability: 180 });
    });

    it('makes gold strongest and fastest while iron remains most durable', () => {
        expect(getSwordInfo(92).damage).toBeGreaterThan(getSwordInfo(91).damage);
        expect(getSwordInfo(92).cooldown).toBeLessThan(getSwordInfo(91).cooldown);
        expect(getSwordInfo(91).maxDurability).toBeGreaterThan(getSwordInfo(92).maxDurability);
    });

    it('recognizes only the four sword item ids', () => {
        expect([89, 90, 91, 92].every(isSwordType)).toBe(true);
        expect(isSwordType(63)).toBe(false);
        expect(isSwordType(0)).toBe(false);
    });

    it('defines one durable bow as the ranged weapon', () => {
        expect(getBowInfo(94)).toMatchObject({ damage: 6, cooldown: 0.75, maxDurability: 180 });
        expect(isBowType(94)).toBe(true);
        expect(isBowType(95)).toBe(false);
    });
});
