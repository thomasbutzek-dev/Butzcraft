import { describe, expect, it } from 'vitest';

import { getCompassGuidance, resolveHomeTarget } from '../js/questNavigation.js';

describe('quest compass guidance', () => {
    it('reports direction and distance to a tracked target', () => {
        expect(getCompassGuidance(
            { x: 0, z: 0 },
            { x: 30, z: -40 }
        )).toEqual(expect.objectContaining({
            distance: 50,
            directionName: 'nordöstlich'
        }));
    });

    it('returns a search area for an undiscovered target', () => {
        const guidance = getCompassGuidance(
            { x: 0, z: 0 },
            { x: 96, z: 12, discovered: false, searchRadius: 40 }
        );

        expect(guidance.exact).toBe(false);
        expect(guidance.searchRadius).toBe(40);
        expect(guidance.displayDistance % 50).toBe(0);
    });
});

describe('home compass target', () => {
    it('uses the last bed while either bed half still exists', () => {
        const target = resolveHomeTarget({ x: 5, y: 20, z: -3 }, () => 38);

        expect(target).toEqual({ x: 5.5, y: 20.5, z: -2.5, kind: 'home', discovered: true });
    });

    it('invalidates home after the saved bed is destroyed', () => {
        expect(resolveHomeTarget({ x: 5, y: 20, z: -3 }, () => 0)).toBeNull();
        expect(resolveHomeTarget(null, () => 38)).toBeNull();
    });
});
