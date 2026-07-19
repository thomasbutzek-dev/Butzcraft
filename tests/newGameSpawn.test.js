import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBiomeAt = vi.fn();
const getHeightAt = vi.fn();

vi.mock('../js/world.js', () => ({
    BIOMES: { PLAINS: 'Grasland' },
    getBiomeAt,
    getHeightAt
}));

const { findNewGameSpawn } = await import('../js/newGameSpawn.js');

describe('new game spawn', () => {
    beforeEach(() => {
        getBiomeAt.mockReset();
        getHeightAt.mockReset();
        getHeightAt.mockReturnValue(40);
    });

    it('skips a jungle candidate in favor of a clearer plains start', () => {
        const values = [0.5, 0.5, 0.55, 0.55];
        const random = () => values.shift();
        getBiomeAt.mockImplementation((x) => x === 0 ? 'Urwald' : 'Grasland');

        expect(findNewGameSpawn(random)).toEqual({
            x: 100,
            z: 100,
            height: 40,
            biome: 'Grasland'
        });
    });

    it('falls back to the first land candidate when no plains candidate is found', () => {
        getBiomeAt.mockReturnValue('Schneefeld');

        expect(findNewGameSpawn(() => 0.5)).toEqual({
            x: 0,
            z: 0,
            height: 40,
            biome: 'Schneefeld'
        });
    });

    it('fails clearly instead of spawning in water when no land candidate exists', () => {
        getBiomeAt.mockReturnValue('Grasland');
        getHeightAt.mockReturnValue(20);

        expect(() => findNewGameSpawn(() => 0.5))
            .toThrow('Kein sicherer Land-Spawn gefunden');
    });
});
