/* tests/Physics.test.js
 *
 * Tests für AABB-Kollisionen und Solid/Non-Solid-Klassifizierung.
 * Wir mocken `world.getBlock`, weil die echte Welt einen Worker + Three.js benötigt.
 */
import { describe, it, expect } from 'vitest';
import { Physics } from '../js/Physics.js';

// Mini-World-Mock: Map<"x,y,z", blockType>. Default 0 (Luft).
function mockWorld(blocks = {}) {
    return {
        getBlock(x, y, z) {
            return blocks[`${x},${y},${z}`] ?? 0;
        }
    };
}

describe('Physics.isSolid', () => {
    it('Luft (0) ist nicht solide', () => {
        const w = mockWorld();
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(false);
    });

    it('Stein (3) ist solide', () => {
        const w = mockWorld({ '0,0,0': 3 });
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(true);
    });

    it('Wasser (4) ist nicht solide für Spieler (default)', () => {
        const w = mockWorld({ '0,0,0': 4 });
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(false);
    });

    it('Wasser (4) ist solide für Mobs (treatWaterAsSolid=true)', () => {
        const w = mockWorld({ '0,0,0': 4 });
        expect(Physics.isSolid(w, 0, 0, 0, true)).toBe(true);
    });

    it('Türen (33, 34) sind durchlässig für Spieler, solide für Mobs', () => {
        const w = mockWorld({ '0,0,0': 33 });
        expect(Physics.isSolid(w, 0, 0, 0, false)).toBe(false);
        expect(Physics.isSolid(w, 0, 0, 0, true)).toBe(true);
    });

    it('Pflanzen (44=hohes Gras) sind nicht solide', () => {
        const w = mockWorld({ '0,0,0': 44 });
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(false);
    });

    it('Wolken (8) sind nicht solide', () => {
        const w = mockWorld({ '0,0,0': 8 });
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(false);
    });

    it('Block -1 (ungeladener Chunk) wirkt wie unsichtbare Wand', () => {
        const w = { getBlock: () => -1 };
        expect(Physics.isSolid(w, 0, 0, 0)).toBe(true);
    });
});

describe('Physics.checkAABBCollision', () => {
    // Player-Hitbox: width 0.3, yMin -1.6 (Füße), yMax 0.10 (Kopf)
    const PW = 0.3, YMIN = -1.6, YMAX = 0.10;

    it('Free-Air-Position ist kollisionsfrei', () => {
        const w = mockWorld();
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX)).toBe(false);
    });

    it('Block direkt unter den Füßen kollidiert', () => {
        // Spieler-Füße bei y-1.6 = 48.4 → Block bei (5, 48, 5) wird getroffen
        const w = mockWorld({ '5,48,5': 3 });
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX)).toBe(true);
    });

    it('Block über dem Kopf kollidiert', () => {
        // Kopf bei y+0.10 = 50.1 → Block bei (5, 50, 5) wird getroffen
        const w = mockWorld({ '5,50,5': 3 });
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX)).toBe(true);
    });

    it('Block knapp außerhalb der x-Hitbox kollidiert NICHT', () => {
        // Hitbox-Breite 0.3 → minX = 5 - 0.3 = 4.7 → floor = 4. Block bei x=3 ist außerhalb.
        const w = mockWorld({ '3,49,5': 3 });
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX)).toBe(false);
    });

    it('Crouch-Hitbox (yMax = -0.45) lässt 1-Block-Lücke offen', () => {
        // Decke bei y = 50 (über Kopfhöhe -0.45 = 49.55 → floor 49 → Block 50 würde stehend kollidieren)
        // Crouching ymax = -0.45 → max-y = 50 - 0.45 = 49.55 → floor 49 → Block bei y=50 wird NICHT getroffen
        const w = mockWorld({ '5,50,5': 3 });
        const stehend = Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, 0.10);
        const hocked  = Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, -0.45);
        expect(stehend).toBe(true);
        expect(hocked).toBe(false);
    });

    it('Wasser blockiert NICHT (default)', () => {
        const w = mockWorld({ '5,49,5': 4 });
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX)).toBe(false);
    });

    it('Wasser blockiert für Mobs (treatWaterAsSolid=true)', () => {
        const w = mockWorld({ '5,49,5': 4 });
        expect(Physics.checkAABBCollision(w, { x: 5, y: 50, z: 5 }, PW, YMIN, YMAX, true)).toBe(true);
    });
});
