import { describe, expect, it } from 'vitest';
import { getAnimalLureItem, isAnimalPenEnclosed } from '../js/animalHusbandry.js';

function createPenWorld({ openGate = false } = {}) {
    const blocks = new Map();
    const metadata = new Map();
    for (let x = -3; x <= 3; x++) {
        for (let z = -3; z <= 3; z++) blocks.set(`${x},0,${z}`, 1);
    }
    for (let n = -2; n <= 2; n++) {
        blocks.set(`${n},1,-2`, n === 0 ? 103 : 102);
        blocks.set(`${n},1,2`, 102);
        blocks.set(`-2,1,${n}`, 102);
        blocks.set(`2,1,${n}`, 102);
    }
    if (openGate) metadata.set('0,1,-2', 4);
    return {
        getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0,
        getBlockMeta: (x, y, z) => metadata.get(`${x},${y},${z}`) ?? 0
    };
}

describe('animal husbandry', () => {
    it('uses hay for cattle and sheep, berries for pigs and chickens', () => {
        expect(getAnimalLureItem('cow')).toBe(88);
        expect(getAnimalLureItem('sheep')).toBe(88);
        expect(getAnimalLureItem('pig')).toBe(51);
        expect(getAnimalLureItem('chicken')).toBe(51);
    });

    it('recognizes a closed fence pen and rejects an open gate', () => {
        expect(isAnimalPenEnclosed(createPenWorld(), 0, 1, 0)).toBe(true);
        expect(isAnimalPenEnclosed(createPenWorld({ openGate: true }), 0, 1, 0)).toBe(false);
    });
});
