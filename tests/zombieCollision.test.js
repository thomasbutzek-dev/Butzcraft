import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

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

describe('zombie contact', () => {
    it('stops advancing once the player is in attack range', async () => {
        const { Mob } = await import('../js/mobs.js');
        const zombie = new Mob(new THREE.Scene(), 'zombie', 0, 0, 0);
        const playerPos = new THREE.Vector3(1, 0, 0);
        const initialZombiePos = zombie.group.position.clone();
        const world = { getBlock: () => 0 };
        const onDamage = vi.fn();

        zombie.update(0.016, playerPos, world, onDamage, 0.5);

        expect(zombie.group.position.x).toBe(initialZombiePos.x);
        expect(zombie.group.position.z).toBe(initialZombiePos.z);
        expect(onDamage).toHaveBeenCalled();
    });
});
