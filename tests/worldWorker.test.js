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
});
