import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../config.js';

describe('dungeon generation', () => {
    const source = readFileSync('js/chunkWorker.js', 'utf8');

    it('platziert Dungeons flach relativ zur Oberflaeche statt tief bei Y 8-18', () => {
        expect(source).toContain('const dungeonDepth = 10 + Math.floor(srng() * 5)');
        expect(source).toContain('const dungeonY = Math.max(18, surfaceY - dungeonDepth)');
        expect(source).not.toContain('const dungeonY = 8 + Math.floor(srng() * 11)');
        expect(CONFIG.DUNGEON.Y_MIN).toBe(18);
    });

    it('erzeugt einen Altar-Zugangsschacht nach dem Marker', () => {
        expect(source).toContain('function spawnDungeonEntrance');
        expect(source.indexOf('spawnDungeonMarker(data, lx, surfaceY, lz)'))
            .toBeLessThan(source.indexOf('spawnDungeonEntrance(data, lx, dungeonY, lz, surfaceY)'));
    });

    it('verwendet modulare Raumplaene statt eines vereinheitlichenden Hubs', () => {
        expect(source).toContain('function createDungeonPlan');
        expect(source).not.toContain('Gemeinsamer Hub');
    });
});
