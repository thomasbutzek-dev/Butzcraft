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

async function simulateWalker({
    type,
    wallHeight,
    delta = 0.05,
    duration = 10,
    ceiling = false,
    corner = false
}) {
    const { Mob } = await import('../js/mobs.js');
    const mob = new Mob(new THREE.Scene(), type, 0.5, 0, 0.5);
    const playerPos = new THREE.Vector3(15, 0, corner ? 15 : 0.5);
    const world = {
        getBlock: (x, y, z) => {
            if (y === -1) return 1;
            if (y >= 0 && y < wallHeight) {
                if (x === 2 && (!corner || z <= 2)) return 1;
                if (corner && z === 2 && x <= 2) return 1;
            }
            if (ceiling && y === 2 && x <= 2 && z === 0) return 1;
            return 0;
        }
    };
    let maxY = mob.group.position.y;
    const frames = Math.ceil(duration / delta);

    for (let frame = 0; frame < frames; frame++) {
        mob.update(delta, playerPos, world, () => {}, 0.5, frame * delta * 1000);
        maxY = Math.max(maxY, mob.group.position.y);
    }

    return { mob, maxY };
}

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

    it.each(['zombie', 'skeleton'])('climbs a one-block obstacle as a %s', async (type) => {
        const { mob } = await simulateWalker({ type, wallHeight: 1 });

        expect(mob.group.position.x).toBeGreaterThan(3.3);
    });

    it.each([
        ['zombie', 2, 0.016],
        ['zombie', 2, 0.05],
        ['zombie', 3, 0.016],
        ['zombie', 3, 0.05],
        ['skeleton', 2, 0.016],
        ['skeleton', 2, 0.05],
        ['skeleton', 3, 0.016],
        ['skeleton', 3, 0.05]
    ])('keeps a %s before a %i-block wall at delta %f', async (type, wallHeight, delta) => {
        const { mob, maxY } = await simulateWalker({ type, wallHeight, delta });

        expect(mob.group.position.x).toBeLessThan(2);
        expect(maxY).toBeLessThan(wallHeight);
    });

    it.each(['zombie', 'skeleton'])('does not teleport through a wall under a ceiling as a %s', async (type) => {
        const { mob, maxY } = await simulateWalker({ type, wallHeight: 2, ceiling: true });

        expect(mob.group.position.x).toBeLessThan(2);
        expect(maxY).toBeLessThan(2);
    });

    it.each(['zombie', 'skeleton'])('does not penetrate an inside corner as a %s', async (type) => {
        const { mob } = await simulateWalker({ type, wallHeight: 3, corner: true });

        expect(mob.group.position.x).toBeLessThan(2);
        expect(mob.group.position.z).toBeLessThan(2);
    });
});
