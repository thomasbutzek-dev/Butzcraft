import { describe, expect, it } from 'vitest';

import {
    getMiningPlan,
    getToolInfo,
    isToolType
} from '../js/miningRules.js';

describe('mining progression rules', () => {
    it('lets bare hands gather soft starter resources but not stone', () => {
        expect(getMiningPlan(5, 0).canBreak).toBe(true);
        expect(getMiningPlan(2, 0).canBreak).toBe(true);
        expect(getMiningPlan(7, 0).canBreak).toBe(true);
        expect(getMiningPlan(3, 0)).toMatchObject({
            canBreak: false,
            hint: 'Du brauchst eine Holz-Spitzhacke.'
        });
    });

    it('gates ores through the confirmed pickaxe tiers', () => {
        expect(getMiningPlan(56, 63).canBreak).toBe(true);
        expect(getMiningPlan(57, 63).canBreak).toBe(false);
        expect(getMiningPlan(57, 64).canBreak).toBe(true);
        expect(getMiningPlan(58, 64).canBreak).toBe(false);
        expect(getMiningPlan(58, 65).canBreak).toBe(true);
    });

    it('makes the correct tool faster without wearing out the wrong tool', () => {
        const hand = getMiningPlan(5, 0);
        const axe = getMiningPlan(5, 67);
        const pickaxe = getMiningPlan(5, 63);

        expect(axe.duration).toBeLessThan(hand.duration);
        expect(axe.usesDurability).toBe(true);
        expect(pickaxe.usesDurability).toBe(false);
    });

    it('makes gold fastest and iron most durable', () => {
        expect(getMiningPlan(3, 66).duration).toBeLessThan(getMiningPlan(3, 65).duration);
        expect(getToolInfo(65).maxDurability).toBeGreaterThan(getToolInfo(66).maxDurability);
    });

    it('recognizes tools and keeps bedrock unbreakable', () => {
        expect(isToolType(63)).toBe(true);
        expect(isToolType(74)).toBe(true);
        expect(isToolType(5)).toBe(false);
        expect(getMiningPlan(20, 66)).toMatchObject({
            canBreak: false,
            hint: 'Diesen Block kannst du nicht abbauen.'
        });
    });

    it('silently stops mining stale air and water hits', () => {
        expect(getMiningPlan(0, 0)).toMatchObject({ canBreak: false, hint: '' });
        expect(getMiningPlan(4, 0)).toMatchObject({ canBreak: false, hint: '' });
    });
});
