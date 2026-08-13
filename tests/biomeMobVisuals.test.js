import { beforeAll, describe, expect, it } from 'vitest';
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

describe('biome mob visuals', () => {
    it('makes the polar bear substantially larger than ordinary livestock', async () => {
        const { Mob } = await import('../js/mobs.js');
        const scene = new THREE.Scene();
        const bear = new Mob(scene, 'polarBear', 0, 0, 0);
        const cow = new Mob(scene, 'cow', 0, 0, 0);
        const bearSize = new THREE.Box3().setFromObject(bear.group).getSize(new THREE.Vector3());
        const cowSize = new THREE.Box3().setFromObject(cow.group).getSize(new THREE.Vector3());

        expect(bearSize.x).toBeGreaterThanOrEqual(cowSize.x * 1.6);
        expect(bearSize.y).toBeGreaterThanOrEqual(cowSize.y * 1.5);
        expect(bearSize.z).toBeGreaterThanOrEqual(cowSize.z * 1.6);
    }, 15000);

    it('places both seal eyes in front of the head surface', async () => {
        const { Mob } = await import('../js/mobs.js');
        const seal = new Mob(new THREE.Scene(), 'seal', 0, 0, 0);
        const eyes = seal.group.children.filter(child => child.material?.color?.getHex() === 0x111111);

        expect(eyes).toHaveLength(2);
        expect(eyes.every(eye => eye.position.z >= 0.92)).toBe(true);
    }, 15000);

    it.each([
        ['camel', 1.39],
        ['fennec', 0.77],
        ['scorpion', 0.74]
    ])(
        'places both %s eyes on the visible front of the model',
        async (type, frontSurfaceZ) => {
            const { Mob } = await import('../js/mobs.js');
            const mob = new Mob(new THREE.Scene(), type, 0, 0, 0);
            const eyes = mob.group.children.filter(child => child.material?.color?.getHex() === 0x111111);

            expect(eyes).toHaveLength(2);
            expect(eyes.every(eye => eye.position.z >= frontSurfaceZ)).toBe(true);
        },
        15000
    );

    it.each(['penguin', 'seal', 'polarBear', 'camel', 'fennec', 'scorpion'])(
        'uses a surface texture on %s',
        async type => {
            const { Mob } = await import('../js/mobs.js');
            const mob = new Mob(new THREE.Scene(), type, 0, 0, 0);
            const texturedParts = mob.group.children.filter(child => child.material?.map);

            expect(texturedParts.length).toBeGreaterThan(0);
        },
        15000
    );
});
