import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { readChunkWorkerSource } from './chunkWorkerSource.js';

function loadBuildMesh() {
    const self = {};
    const context = vm.createContext({
        self, console, Math, Set, Map, Uint8Array, Int16Array, Float32Array, Uint32Array, ArrayBuffer
    });
    vm.runInContext(`${readChunkWorkerSource()}\nself.buildMesh = buildMesh;`, context);
    return self.buildMesh;
}

function axisValues(mesh, axis) {
    const offset = axis === 'x' ? 0 : 2;
    return mesh.pos.filter((_, index) => index % 3 === offset);
}

describe('thin door, fence and gate meshes', () => {
    it.each([
        [0, 'x', 'z'],
        [1, 'z', 'x']
    ])('opens door orientation %i around a side hinge', (rotation, hingeAxis, swingAxis) => {
        const buildMesh = loadBuildMesh();
        const getDoor = (x, y, z) => x === 0 && y === 1 && z === 0 ? 33 : 0;
        const open = buildMesh(0, 0, getDoor, false, { '0,1,0': rotation | 4 });
        const hingeValues = axisValues(open, hingeAxis);
        const swingValues = axisValues(open, swingAxis);

        expect(Math.max(...hingeValues) - Math.min(...hingeValues)).toBeLessThan(0.2);
        expect(Math.min(...hingeValues)).toBeLessThan(0.1);
        expect(Math.max(...swingValues)).toBeGreaterThan(1.1);
    });

    it('renders a narrow post and extends rails toward neighboring fence blocks', () => {
        const buildMesh = loadBuildMesh();
        const isolated = buildMesh(0, 0, (x, y, z) => x === 0 && y === 1 && z === 0 ? 102 : 0, false, {});
        const connected = buildMesh(0, 0, (x, y, z) =>
            y === 1 && z === 0 && (x === 0 || x === 1) ? 102 : 0, false, {});

        expect(Math.min(...isolated.pos)).toBeGreaterThan(0);
        expect(Math.max(...isolated.pos.filter((_, index) => index % 3 === 0))).toBeLessThan(1);
        expect(connected.pos.length).toBeGreaterThan(isolated.pos.length);
    });

    it.each([
        [0, 'z'],
        [1, 'x']
    ])('opens gate orientation %i around its left post', (rotation, swingAxis) => {
        const buildMesh = loadBuildMesh();
        const getGate = (x, y, z) => x === 0 && y === 1 && z === 0 ? 103 : 0;
        const closed = buildMesh(0, 0, getGate, false, { '0,1,0': rotation });
        const open = buildMesh(0, 0, getGate, false, { '0,1,0': rotation | 4 });

        expect(closed.pos).not.toEqual(open.pos);
        expect(closed.pos.length).toBe(open.pos.length);
        expect(Math.max(...axisValues(open, swingAxis))).toBeGreaterThan(1.05);
    });
});
