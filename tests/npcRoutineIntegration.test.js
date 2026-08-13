import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NPC } from '../js/npc.js';

function createWorld(walls = new Set(), blocks = new Map()) {
    const metadata = new Map();
    return {
        getBlock(x, y, z) {
            if (y === 0) return 1;
            if (blocks.has(`${x},${y},${z}`)) return blocks.get(`${x},${y},${z}`);
            return walls.has(`${x},${y},${z}`) ? 1 : 0;
        },
        getBlockMeta(x, y, z) {
            return metadata.get(`${x},${y},${z}`) || 0;
        },
        setBlockMeta(x, y, z, value) {
            metadata.set(`${x},${y},${z}`, value);
        }
    };
}

describe('villager routine integration', () => {
    beforeEach(() => {
        HTMLCanvasElement.prototype.getContext = () => ({
            fillStyle: '',
            font: '',
            textAlign: '',
            fillRect() {},
            fillText() {}
        });
    });

    it('walks around a wall and starts the scheduled profession activity', () => {
        const walls = new Set();
        for (let z = -1; z <= 3; z++) {
            walls.add(`2,1,${z}`);
            walls.add(`2,2,${z}`);
        }
        const world = createWorld(walls);
        const scene = new THREE.Scene();
        const npc = new NPC(scene, 0, 1, 1, 0, {
            npcId: 'npc:test:smith',
            home: { x: 0, y: 1, z: 1 },
            porch: { x: 0, y: 1, z: 2 },
            work: { x: 5, y: 1, z: 1 }
        });

        for (let frame = 0; frame < 800; frame++) {
            npc.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, [npc]);
        }

        expect(npc.group.position.x).toBeGreaterThan(3.5);
        expect(
            npc.activity,
            `position=${npc.group.position.x},${npc.group.position.y},${npc.group.position.z} path=${npc.pathIndex}/${npc.path.length}`
        ).toBe('forging');
        expect(npc.isWalking).toBe(false);
        npc.dispose();
    });

    it('keeps residents apart while they cross the same village path', () => {
        const world = createWorld();
        const scene = new THREE.Scene();
        const left = new NPC(scene, -3, 1, 0, 0, {
            npcId: 'npc:test:left',
            home: { x: -3, y: 1, z: 0 },
            work: { x: 3, y: 1, z: 0 }
        });
        const right = new NPC(scene, 3, 1, 0, 1, {
            npcId: 'npc:test:right',
            home: { x: 3, y: 1, z: 0 },
            work: { x: -3, y: 1, z: 0 }
        });
        const residents = [left, right];
        let minimumDistance = Infinity;

        for (let frame = 0; frame < 500; frame++) {
            left.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, residents);
            right.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, residents);
            minimumDistance = Math.min(
                minimumDistance,
                left.group.position.distanceTo(right.group.position)
            );
        }

        expect(minimumDistance).toBeGreaterThanOrEqual(0.5);
        const positions = `left=${left.group.position.x},${left.group.position.z} right=${right.group.position.x},${right.group.position.z}`;
        expect(left.group.position.x, positions).toBeGreaterThan(1.5);
        expect(right.group.position.x, positions).toBeLessThan(-1.5);
        left.dispose();
        right.dispose();
    });

    it('opens a closed village door when the route passes through it', () => {
        const blocks = new Map([
            ['2,1,0', 33],
            ['2,2,0', 34]
        ]);
        const world = createWorld(new Set(), blocks);
        const scene = new THREE.Scene();
        const npc = new NPC(scene, 0, 1, 0, 3, {
            npcId: 'npc:test:librarian',
            home: { x: 0, y: 1, z: 0 },
            work: { x: 4, y: 1, z: 0 }
        });

        for (let frame = 0; frame < 300; frame++) {
            npc.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, [npc]);
        }

        expect(world.getBlockMeta(2, 1, 0) & 4).toBe(4);
        expect(npc.group.position.x).toBeGreaterThan(2.5);
        expect(npc.activity).toBe('studying');
        npc.dispose();
    });

    it('throttles route retries when a destination is temporarily unreachable', () => {
        const walls = new Set();
        for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            walls.add(`${x},1,${z}`);
            walls.add(`${x},2,${z}`);
        }
        const world = createWorld(walls);
        const scene = new THREE.Scene();
        const npc = new NPC(scene, 0, 1, 0, 1, {
            npcId: 'npc:test:blocked',
            home: { x: 0, y: 1, z: 0 },
            work: { x: 4, y: 1, z: 0 }
        });
        const planPath = vi.spyOn(npc, '_planPath');

        for (let frame = 0; frame < 10; frame++) {
            npc.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, [npc]);
        }

        expect(planPath).toHaveBeenCalledTimes(1);
        expect(npc.activity).toBe('waiting');
        npc.dispose();
    });

    it('keeps a resident on the room floor below a ceiling for 2,000 simulation steps', () => {
        const blocks = new Map();
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                blocks.set(`${x},3,${z}`, 1);
            }
        }
        const world = createWorld(new Set(), blocks);
        const scene = new THREE.Scene();
        const npc = new NPC(scene, 0, 1, 0, 0, {
            npcId: 'npc:test:room-floor',
            home: { x: 0, y: 1, z: 0 },
            work: { x: 0, y: 1, z: 0 }
        });
        let minimumY = Infinity;
        let maximumY = -Infinity;

        for (let frame = 0; frame < 2000; frame++) {
            npc.update(0.05, new THREE.Vector3(20, 1, 20), world, 0.4, [npc]);
            minimumY = Math.min(minimumY, npc.group.position.y);
            maximumY = Math.max(maximumY, npc.group.position.y);
        }

        expect(minimumY).toBe(1);
        expect(maximumY).toBe(1);
        npc.dispose();
    });

    it('crosses a one-block stair at a chunk boundary without leaving valid ground', () => {
        const blocks = new Map();
        for (let x = 16; x <= 20; x++) {
            for (let z = -1; z <= 1; z++) {
                blocks.set(`${x},1,${z}`, 1);
            }
        }
        const world = createWorld(new Set(), blocks);
        const scene = new THREE.Scene();
        const npc = new NPC(scene, 14, 1, 0, 1, {
            npcId: 'npc:test:chunk-stair',
            home: { x: 14, y: 1, z: 0 },
            work: { x: 19, y: 2, z: 0 }
        });
        const visitedHeights = new Set();

        for (let frame = 0; frame < 2000; frame++) {
            npc.update(0.05, new THREE.Vector3(30, 1, 20), world, 0.4, [npc]);
            visitedHeights.add(npc.group.position.y);
        }

        expect(npc.group.position.x).toBeGreaterThan(17.5);
        expect(npc.group.position.y).toBe(2);
        expect([...visitedHeights].every(y => y === 1 || y === 2)).toBe(true);
        npc.dispose();
    });
});
