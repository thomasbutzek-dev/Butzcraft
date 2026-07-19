import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config.js';

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

describe('spider contact damage', () => {
    it('damages a player standing directly beside it', async () => {
        const { Mob } = await import('../js/mobs.js');
        const spider = new Mob(new THREE.Scene(), 'spider', 0, 0, 0);
        const playerPos = new THREE.Vector3(0.5, 1.6, 0);
        const onDamage = vi.fn();
        const world = { getBlock: () => 0 };

        spider.update(0.016, playerPos, world, onDamage, 0.5);

        expect(onDamage).toHaveBeenCalledWith(expect.any(Number));
        expect(onDamage.mock.calls[0][0]).toBeGreaterThan(0);
    });

    it('reduces health even while passive regeneration is active', async () => {
        const { Mob } = await import('../js/mobs.js');
        const spider = new Mob(new THREE.Scene(), 'spider', 0, 0, 0);
        const playerPos = new THREE.Vector3(0.5, 1.6, 0);
        const world = { getBlock: () => 0 };
        const delta = 0.02;
        let health = 50;

        spider.update(delta, playerPos, world, damage => {
            health -= damage;
        }, 0.5);
        health += CONFIG.GAMEPLAY.REGEN_RATE * delta;

        expect(health).toBeLessThan(50);
    });
});
