import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { canParrotSpawnInBiome, canSpawnerSpawnAt, findSpawnerBlocksInRange } from '../js/spawners.js';

describe('spawner helpers', () => {
    it('verbietet Papageien im Schneefeld', () => {
        expect(canParrotSpawnInBiome('Schneefeld')).toBe(false);
    });

    it('allows parrots only in the jungle', () => {
        expect(canParrotSpawnInBiome('Urwald')).toBe(true);
        expect(canParrotSpawnInBiome('Wüste')).toBe(false);
        expect(canParrotSpawnInBiome('Grasland')).toBe(false);
        expect(canParrotSpawnInBiome('Ozean')).toBe(false);
    });

    it('findet Spawner auch wenn sie nicht auf einem Vierer-Raster liegen', () => {
        const blocks = new Map([['3,5,7', 83]]);
        const world = {
            getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) || 0
        };

        expect(findSpawnerBlocksInRange(world, 0, 5, 4, 8)).toEqual([
            { x: 3, y: 5, z: 7, key: '3,5,7' }
        ]);
    });

    it('nutzt den Spawner-Index statt den Raum zu scannen', () => {
        const world = {
            spawnerKeys: new Set(['3,5,7', '50,5,50']),
            getBlock: () => {
                throw new Error('indexed lookup should not scan blocks');
            }
        };

        expect(findSpawnerBlocksInRange(world, 0, 5, 4, 8)).toEqual([
            { x: 3, y: 5, z: 7, key: '3,5,7' }
        ]);
    });

    it('braucht zwei freie Luftbloecke ueber der Spawnposition', () => {
        const blocked = new Set(['1,3,1']);
        const world = {
            getBlock: (x, y, z) => blocked.has(`${x},${y},${z}`) ? 3 : 0
        };

        expect(canSpawnerSpawnAt(world, 1.2, 2, 1.8)).toBe(false);
        expect(canSpawnerSpawnAt(world, 2.2, 2, 1.8)).toBe(true);
    });

    it('scannt im Game-Loop nicht mehr nur jedes vierte Feld', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');
        expect(source).not.toContain('dx += 4');
        expect(source).not.toContain('dy += 4');
        expect(source).not.toContain('dz += 4');
        expect(source).toContain('findSpawnerBlocksInRange');
    });

    it('spawnt fuer den Dungeon-Einstieg erstmal Spinnen', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');
        expect(source).toContain("const mobType = 'spider'");
    });

    it('entfernt aktive Spawner-Mobs wenn der Spawner abgebaut wird', () => {
        const source = readFileSync('js/PlayerInteraction.js', 'utf8');
        expect(source).toContain('mob._spawnerKey === spawnerKey');
        expect(source).toContain('mob.isDead = true');
    });
});
