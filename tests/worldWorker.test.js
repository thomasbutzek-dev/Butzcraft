import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';

class FakeWorker {
    constructor() {
        this.messages = [];
        FakeWorker.instance = this;
    }

    postMessage(message, transfer = []) {
        if (transfer.some(value => !(value instanceof ArrayBuffer))) {
            throw new DOMException('Found invalid value in transferList.', 'DataCloneError');
        }
        this.messages.push({ message, transfer });
    }
}

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            if (!(property in target)) target[property] = () => {};
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
    globalThis.Worker = FakeWorker;
});

describe('World worker buffer recycling', () => {
    it('forwards generated minecart data to the game thread', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        const generated = [];
        const onGenerated = event => generated.push(event.detail);
        window.addEventListener('minecartGenerated', onGenerated);

        world.viewCenterX = 0;
        world.viewCenterZ = 0;
        world.viewRenderDistance = 0;
        worker.onmessage({
            data: {
                type: 'terrain',
                cx: 0,
                cz: 0,
                epoch: world.meshEpoch,
                data: new Uint8Array(16 * 64 * 16),
                minecartInfos: [{ id: 'minecart:test', x: 2, y: 20, z: 3 }]
            }
        });

        window.removeEventListener('minecartGenerated', onGenerated);
        expect(generated).toEqual([{ id: 'minecart:test', x: 2, y: 20, z: 3 }]);
    }, 15000);

    it('reuses a late terrain response as a transferable buffer', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;

        world.viewCenterX = 0;
        world.viewCenterZ = 0;
        world.viewRenderDistance = 0;
        worker.onmessage({
            data: {
                type: 'terrain',
                cx: 10,
                cz: 10,
                epoch: world.meshEpoch,
                data: new Uint8Array(16 * 64 * 16)
            }
        });

        expect(() => world.generateChunk(0, 0)).not.toThrow();
        const generation = worker.messages.at(-1);
        expect(generation.message.type).toBe('generate');
        expect(generation.message.buffer).toBeInstanceOf(ArrayBuffer);
        expect(generation.transfer).toEqual([generation.message.buffer]);
    }, 15000);

    it('reuses the buffer from a stale terrain epoch', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        const staleData = new Uint8Array(16 * 64 * 16);

        worker.onmessage({
            data: {
                type: 'terrain',
                cx: 0,
                cz: 0,
                epoch: world.meshEpoch - 1,
                data: staleData
            }
        });
        expect(world.chunkPool).toHaveLength(1);
        expect(world.chunkPool[0]).toBe(staleData.buffer);

        world.generateChunk(0, 0);

        expect(worker.messages.at(-1).message.buffer === staleData.buffer).toBe(true);
    }, 15000);
});

describe('World mesh result scheduling', () => {
    it('waits for active-view neighbors before the first mesh build', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        world.viewCenterX = 0;
        world.viewCenterZ = 0;
        world.viewRenderDistance = 1;

        const sendTerrain = (cx, cz) => worker.onmessage({
            data: {
                type: 'terrain',
                cx,
                cz,
                epoch: world.meshEpoch,
                data: new Uint8Array(16 * 64 * 16)
            }
        });

        sendTerrain(0, 0);
        expect(worker.messages.filter(entry => entry.message.type === 'mesh')).toHaveLength(0);

        for (let cx = -1; cx <= 1; cx++) {
            for (let cz = -1; cz <= 1; cz++) {
                if (cx !== 0 || cz !== 0) sendTerrain(cx, cz);
            }
        }

        const meshMessages = worker.messages.filter(entry => entry.message.type === 'mesh');
        expect(meshMessages).toHaveLength(9);
        expect(new Set(meshMessages.map(entry => `${entry.message.cx},${entry.message.cz}`))).toHaveLength(9);
        expect(world.dirtyMeshes.size).toBe(0);
    }, 15000);

    it('applies at most the requested number of mesh results per frame', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        const arrays = {
            pos: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            col: [1, 1, 1, 1, 1, 1, 1, 1, 1],
            norm: [0, 0, 1, 0, 0, 1, 0, 0, 1],
            uv: [0, 0, 1, 0, 0, 1],
            sway: [0, 0, 0],
            atlasUV: [-1, -1, -1, -1, -1, -1],
            idx: [0, 1, 2]
        };

        for (const cx of [0, 1]) {
            const key = world.getChunkKey(cx, 0);
            world.chunks.set(key, {
                cx,
                cz: 0,
                data: new Uint8Array(16 * 64 * 16),
                mesh: null,
                waterMesh: null,
                spawnerKeys: new Set()
            });
            world.pendingMeshes.add(key);
            worker.onmessage({
                data: { type: 'meshResult', cx, cz: 0, opaque: arrays, water: null, epoch: world.meshEpoch }
            });
        }

        expect(world.pendingMeshResults).toHaveLength(2);
        expect(world.chunks.get('0,0').mesh).toBeNull();
        expect(world.chunks.get('1,0').mesh).toBeNull();

        expect(world.processPendingMeshResults(1)).toBe(1);
        expect(world.chunks.get('0,0').mesh).toBeInstanceOf(THREE.Mesh);
        expect(world.chunks.get('1,0').mesh).toBeNull();
        expect(world.pendingMeshResults).toHaveLength(1);

        expect(world.processPendingMeshResults(1)).toBe(1);
        expect(world.chunks.get('1,0').mesh).toBeInstanceOf(THREE.Mesh);
        expect(world.pendingMeshResults).toHaveLength(0);
    }, 15000);
});
