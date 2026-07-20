import { describe, expect, it } from 'vitest';
import { readChunkWorkerSource } from './chunkWorkerSource.js';

describe('village roads', () => {
    const source = readChunkWorkerSource();

    it('berechnet Dorf-Kandidaten unabhaengig fuer Doerfer und Wege', () => {
        expect(source).toContain('function getVillageCandidate');
        expect(source).toContain('const village = getVillageCandidate(scx, scz, WORLD_GENERATION_VERSION)');
    });

    it('verbindet nahe Doerfer mit chunkuebergreifenden Wegen', () => {
        expect(source).toContain('const VILLAGE_ROAD_MAX_DISTANCE = 180');
        expect(source).toContain('function drawVillageRoads');
        expect(source).toContain('drawVillageRoad(data, cx, cz, village, nearest)');
        expect(source).toContain('drawVillageRoads(data, cx, cz)');
    });

    it('legt Wege nur auf trockenem Terrain an und macht den Laufraum frei', () => {
        expect(source).toContain('if (surfaceY <= WATER_LEVEL + 1) return');
        expect(source).toContain('setBlockLocal(data, lx, pathY - 1, lz, pathBlock)');
        expect(source).toContain('setBlockLocal(data, lx, pathY, lz, 0)');
        expect(source).toContain('setBlockLocal(data, lx, pathY + 1, lz, 0)');
    });
});
