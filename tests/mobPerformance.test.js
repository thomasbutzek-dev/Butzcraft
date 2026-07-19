import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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

afterEach(() => vi.restoreAllMocks());

function countVisibleDrawables(scene) {
    let count = 0;
    scene.traverseVisible((object) => {
        if (object.isMesh || object.isLine || object.isPoints || object.isSprite) count++;
    });
    return count;
}

describe('mob rendering budget', () => {
    it('keeps animals recognizable across the medium and far view ranges', async () => {
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        const playerPosition = new THREE.Vector3(0, 1, 0);

        const mediumPig = new Mob(scene, 'pig', 20, 1, 0);
        mediumPig.updateVisualLod(playerPosition);
        expect(mediumPig.lodMesh.visible).toBe(false);
        expect(mediumPig.detailObjects.some(object => object.visible)).toBe(true);

        const farPig = new Mob(scene, 'pig', 40, 1, 0);
        farPig.updateVisualLod(playerPosition);
        expect(farPig.lodMesh.visible).toBe(true);
        expect(farPig.lodMesh.material.map).toBeTruthy();
        expect(farPig.lodMesh.geometry.attributes.position.count).toBeGreaterThan(24);
    }, 15000);

    it('keeps a 20-mob mixed-distance scene below 90 drawables', async () => {
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        const playerPosition = new THREE.Vector3(0, 2, 0);
        const world = {
            getBlock(x, y) {
                return y <= 0 ? 1 : 0;
            }
        };
        const types = ['cow', 'pig', 'sheep', 'chicken'];

        const mobs = Array.from({ length: 20 }, (_, index) => {
            const distance = 8 + index * 3.5;
            return new Mob(scene, types[index % types.length], distance, 1, 0);
        });
        for (const mob of mobs) mob.update(0, playerPosition, world, () => {}, 0.5);

        expect(countVisibleDrawables(scene)).toBeLessThanOrEqual(90);
    }, 15000);

    it('keeps 60 frames of mixed-distance mob simulation below 9000 world reads', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        const playerPosition = new THREE.Vector3(0, 2, 0);
        let worldReads = 0;
        const world = {
            getBlock(x, y) {
                worldReads++;
                return y <= 0 ? 1 : 0;
            }
        };
        const types = ['cow', 'pig', 'sheep', 'chicken'];
        const mobs = Array.from({ length: 20 }, (_, index) => {
            const distance = 8 + index * 3.5;
            return new Mob(scene, types[index % types.length], distance, 1, 0);
        });

        for (let frame = 0; frame < 60; frame++) {
            for (const mob of mobs) mob.update(1 / 60, playerPosition, world, () => {}, 0.5);
        }

        expect(worldReads).toBeLessThanOrEqual(9000);
    }, 15000);
});
