import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';

class FakeWorker {
    constructor(url, options) {
        this.url = url;
        this.options = options;
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
    it('initializes the module worker with world generation version two', async () => {
        const { World } = await import('../js/world.js');
        new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        const initialization = worker.messages.find(entry => entry.message.type === 'init');

        expect(worker.options).toEqual({ type: 'module' });
        expect(initialization.message.worldGenerationVersion).toBe(2);
    }, 15000);

    it('switches the worker back to legacy generation for a legacy save', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;

        world.setGenerationVersion(1);

        expect(world.worldGenerationVersion).toBe(1);
        expect(worker.messages.at(-1).message).toEqual({ type: 'worldGenerationVersion', version: 1 });
    }, 15000);

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

    it('indexes structure, chest, gate and spawner metadata without duplicates', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        world.viewCenterX = 0;
        world.viewCenterZ = 0;
        world.viewRenderDistance = 1;
        const structure = {
            id: 'dungeon:0,0:v2',
            kind: 'dungeon',
            gate: { x: 8, y: 18, z: 9, widthAxis: 'z' }
        };
        const message = {
            type: 'terrain',
            cx: 0,
            cz: 0,
            epoch: world.meshEpoch,
            data: new Uint8Array(16 * 64 * 16),
            structureInfos: [structure, structure],
            chestInfos: [{ x: 4, y: 20, z: 5, structureId: structure.id, role: 'dungeon_key', lootTable: 'dungeon_catacomb' }],
            spawnerInfos: [{ x: 6, y: 19, z: 7, structureId: structure.id, role: 'upper-combat' }]
        };

        worker.onmessage({ data: message });

        expect([...world.structures.keys()]).toEqual([structure.id]);
        expect(world.structureChests.get('chest,4,20,5')).toMatchObject({ role: 'dungeon_key' });
        expect(world.structureGates.get('8,18,9')).toMatchObject({ structureId: structure.id });
        expect(world.spawnerMeta['6,19,7']).toMatchObject({ structureId: structure.id, role: 'upper-combat' });
    }, 15000);

    it('keeps ownership of transferred terrain data without copying it', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const worker = FakeWorker.instance;
        const data = new Uint8Array(16 * 64 * 16);
        world.viewCenterX = 0;
        world.viewCenterZ = 0;
        world.viewRenderDistance = 0;

        worker.onmessage({ data: { type: 'terrain', cx: 0, cz: 0, epoch: world.meshEpoch, data } });

        expect(world.chunks.get('0,0').data).toBe(data);
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
    it('reuses transferred typed arrays when creating buffer attributes', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const arrays = {
            pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            col: new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1]),
            norm: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uv: new Float32Array([0, 0, 1, 0, 0, 1]),
            sway: new Float32Array([0, 0, 0]),
            atlasUV: new Float32Array([-1, -1, -1, -1, -1, -1]),
            idx: new Uint32Array([0, 1, 2])
        };

        const mesh = world._createMeshFromArrays(arrays, new THREE.MeshBasicMaterial(), 0, 0);

        expect(mesh.geometry.getAttribute('position').array).toBe(arrays.pos);
        expect(mesh.geometry.getAttribute('color').array).toBe(arrays.col);
        expect(mesh.geometry.getAttribute('normal').array).toBe(arrays.norm);
        expect(mesh.geometry.getAttribute('uv').array).toBe(arrays.uv);
        expect(mesh.geometry.getAttribute('aSway').array).toBe(arrays.sway);
        expect(mesh.geometry.getAttribute('aAtlasUV').array).toBe(arrays.atlasUV);
        expect(mesh.geometry.index.array).toBe(arrays.idx);
    }, 15000);

    it('keeps placed torches in the runtime light index', async () => {
        const { World } = await import('../js/world.js');
        const world = new World(new THREE.Scene());
        const data = new Uint8Array(16 * 64 * 16);
        world.chunks.set('0,0', { cx: 0, cz: 0, data, mesh: null, waterMesh: null });

        world.setBlock(2, 4, 6, 101, false);
        expect(world.torchKeys).toEqual(new Set(['2,4,6']));

        world.setBlock(2, 4, 6, 0, false);
        expect(world.torchKeys.size).toBe(0);

        world.setBlock(3, 5, 6, 104, false);
        expect(world.torchKeys).toEqual(new Set(['3,5,6']));
    }, 15000);

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
