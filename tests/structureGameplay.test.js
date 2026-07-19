import { describe, expect, it } from 'vitest';
import { classifyChestLoot, getLootDiscoveryMessage, rollLoot } from '../js/structures.js';

function blockReader(blocks) {
    return (x, y, z) => blocks.get(`${x},${y},${z}`) || 0;
}

describe('structure-specific gameplay', () => {
    it('recognizes village stores from generated house positions', () => {
        const villages = [{
            layout: 'courtyard',
            houses: [{ x: 12, y: 35, z: -4 }]
        }];

        expect(classifyChestLoot({ x: 14, y: 35, z: -2, biome: 'Wüste', villages })).toBe('village_courtyard');
    });

    it('recognizes all three dungeon themes from their enclosed reward rooms', () => {
        const blocks = new Map([
            ['1,20,0', 85], ['0,20,1', 84], ['-1,20,0', 85]
        ]);
        const common = { x: 0, y: 20, z: 0, getBlock: blockReader(blocks) };

        expect(classifyChestLoot({ ...common, biome: 'Grasland' })).toBe('dungeon_catacomb');
        expect(classifyChestLoot({ ...common, biome: 'Urwald' })).toBe('dungeon_ruins');
        expect(classifyChestLoot({ ...common, biome: 'Schneefeld' })).toBe('dungeon_frozen');
    });

    it('distinguishes a trapped desert temple and a tracked frozen mine', () => {
        const templeBlocks = new Map([['0,25,3', 79]]);
        const mineBlocks = new Map([['3,29,0', 80]]);

        expect(classifyChestLoot({
            x: 0, y: 25, z: 0, biome: 'Wüste', getBlock: blockReader(templeBlocks)
        })).toBe('temple');
        expect(classifyChestLoot({
            x: 0, y: 29, z: 0, biome: 'Schneefeld', getBlock: blockReader(mineBlocks)
        })).toBe('mine_frozen');
    });

    it('keeps themed loot deterministic and supplies discovery feedback', () => {
        expect(rollLoot('dungeon_ruins', 4182)).toEqual(rollLoot('dungeon_ruins', 4182));
        expect(rollLoot('dungeon_ruins', 4182)).not.toEqual(rollLoot('mine_timber', 4182));
        expect(getLootDiscoveryMessage('dungeon_ruins')).toBe('Dungeon-Schatz entdeckt!');
        expect(getLootDiscoveryMessage('village_farmstead')).toBe('Dorfvorrat gefunden.');
    });
});
