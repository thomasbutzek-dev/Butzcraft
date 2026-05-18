import { describe, it, expect } from 'vitest';
import { blocksPrecipitation, findPrecipitationImpactY } from '../js/particles.js';

describe('precipitation collision helpers', () => {
    it('lets precipitation pass through air, water and clouds only', () => {
        expect(blocksPrecipitation(0)).toBe(false);
        expect(blocksPrecipitation(4)).toBe(false);
        expect(blocksPrecipitation(8)).toBe(false);
        expect(blocksPrecipitation(26)).toBe(true);
        expect(blocksPrecipitation(32)).toBe(true);
    });

    it('finds a blocking roof between particle frames', () => {
        const world = {
            getBlock: (_x, y, _z) => y === 10 ? 26 : 0
        };

        expect(findPrecipitationImpactY(world, 4.2, 12.0, 9.8, -3.5)).toBe(10);
        expect(findPrecipitationImpactY(world, 4.2, 9.5, 8.8, -3.5)).toBeNull();
    });
});
