import { describe, expect, it } from 'vitest';
import { selectBiomeAnimal } from '../js/biomeSpawnRules.js';

function selectedTypes(biome, habitat, isNight = false) {
    return new Set(Array.from({ length: 1001 }, (_, index) => (
        selectBiomeAnimal({ biome, habitat, isNight, roll: index / 1001 })?.type
    )).filter(Boolean));
}

describe('biome animal spawning', () => {
    it('limits the snow biome to cold-climate animals', () => {
        expect([...selectedTypes('Schneefeld', 'land')].sort()).toEqual([
            'penguin',
            'polarBear',
            'seal'
        ]);
        expect([...selectedTypes('Schneefeld', 'water')].sort()).toEqual([
            'fish',
            'penguin',
            'seal'
        ]);
    });

    it('uses desert animals and brings out scorpions at night', () => {
        expect([...selectedTypes('Wüste', 'land')].sort()).toEqual([
            'camel',
            'fennec'
        ]);
        expect([...selectedTypes('Wüste', 'land', true)].sort()).toEqual([
            'fennec',
            'scorpion'
        ]);
        expect([...selectedTypes('Wüste', 'water')]).toEqual(['fish']);
    });

    it('keeps temperate, jungle and ocean fauna separate', () => {
        expect([...selectedTypes('Grasland', 'land')].sort()).toEqual([
            'chicken',
            'cow',
            'pig',
            'sheep'
        ]);
        expect([...selectedTypes('Urwald', 'land')].sort()).toEqual(['chicken', 'pig']);
        expect([...selectedTypes('Ozean', 'land')]).toEqual([]);
        expect([...selectedTypes('Ozean', 'water')].sort()).toEqual([
            'fish',
            'octopus',
            'turtle'
        ]);
    });
});
