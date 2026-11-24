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

function railQuadYs(rails, cell) {
    const buildMesh = loadBuildMesh();
    const getBlock = (x, y, z) => rails.has(`${x},${y},${z}`) ? 80 : 0;
    const mesh = buildMesh(0, 0, getBlock, false, {});
    const ys = [];
    for (let index = 0; index < mesh.pos.length; index += 3) {
        const [x, y, z] = [mesh.pos[index], mesh.pos[index + 1], mesh.pos[index + 2]];
        if (x >= cell.x && x <= cell.x + 1 && z >= cell.z && z <= cell.z + 1 && y >= cell.y && y < cell.y + 1.5) ys.push({ x, y: +y.toFixed(2) });
    }
    return ys;
}

describe('mine rail ramps', () => {
    it('draws a rail that climbs to the next block as a ramp', () => {
        // Track along +x: (4,20) -> (5,20) -> (6,21).
        const corners = railQuadYs(new Set(['4,20,5', '5,20,5', '6,21,5']), { x: 5, y: 20, z: 5 });
        expect(corners).toHaveLength(4);
        for (const corner of corners) expect(corner.y).toBe(corner.x > 5.5 ? 21.08 : 20.08);
    });

    it('keeps level rails flat', () => {
        const corners = railQuadYs(new Set(['4,20,5', '5,20,5', '6,20,5']), { x: 5, y: 20, z: 5 });
        expect(corners.map(corner => corner.y)).toEqual([20.08, 20.08, 20.08, 20.08]);
    });
});
