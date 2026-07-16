import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Game } from '../js/Game.js';

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            if (!(property in target)) target[property] = () => {};
            return target[property];
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
});

describe('Mob drops through the Game seam', () => {
    afterEach(() => Game.reset());

    it('adds defeated mob loot to the central dropped-item collection', async () => {
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        Game.droppedItems = [];
        const pig = new Mob(scene, 'pig', 2, 4, 6);

        pig.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0]).toMatchObject({ blockType: 22, velocityY: 2 });
        expect(scene.children).toContain(Game.droppedItems[0].mesh);
    }, 15000);

    it('recreates a missing dropped-item collection before adding loot', async () => {
        const { Mob } = await import('../js/mobs.js');
        Game.droppedItems = undefined;
        const cow = new Mob(new THREE.Scene(), 'cow', 0, 0, 0);

        cow.takeDamage(100);

        expect(Game.droppedItems).toHaveLength(1);
        expect(Game.droppedItems[0].blockType).toBe(22);
    }, 15000);
});
