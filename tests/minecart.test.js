import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Minecart, advanceMinecartState, chooseRailNeighbor, getRailNeighbors } from '../js/minecart.js';

function railMap(cells) {
    const rails = new Set(cells.map(cell => `${cell.x},${cell.y},${cell.z}`));
    return (x, y, z) => rails.has(`${x},${y},${z}`) ? 80 : 0;
}

describe('minecart rail movement', () => {
    it('finds flat and sloped neighboring rails', () => {
        const getBlock = railMap([
            { x: 0, y: 10, z: -1 },
            { x: 1, y: 11, z: 0 },
            { x: -1, y: 9, z: 0 }
        ]);

        expect(getRailNeighbors(getBlock, { x: 0, y: 10, z: 0 })).toEqual([
            { x: 0, y: 10, z: -1 },
            { x: 1, y: 11, z: 0 },
            { x: -1, y: 9, z: 0 }
        ]);
    });

    it('prefers straight rails and lets left/right input choose junction branches', () => {
        const cell = { x: 0, y: 10, z: 0 };
        const neighbors = [
            { x: 1, y: 10, z: 0 },
            { x: 0, y: 10, z: -1 },
            { x: 0, y: 10, z: 1 },
            { x: -1, y: 10, z: 0 }
        ];
        const east = { x: 1, z: 0 };

        expect(chooseRailNeighbor(cell, neighbors, east, 0)).toEqual({ x: 1, y: 10, z: 0 });
        expect(chooseRailNeighbor(cell, neighbors, east, -1)).toEqual({ x: 0, y: 10, z: -1 });
        expect(chooseRailNeighbor(cell, neighbors, east, 1)).toEqual({ x: 0, y: 10, z: 1 });
    });

    it('uses the reverse rail only at a dead end', () => {
        const cell = { x: 2, y: 10, z: 0 };
        const west = { x: -1, z: 0 };

        expect(chooseRailNeighbor(cell, [{ x: 1, y: 10, z: 0 }], west)).toEqual({ x: 1, y: 10, z: 0 });
    });

    it('advances across curves without leaving the rail graph', () => {
        const getBlock = railMap([
            { x: 0, y: 10, z: 0 },
            { x: 1, y: 10, z: 0 },
            { x: 1, y: 10, z: 1 }
        ]);
        const state = {
            cell: { x: 0, y: 10, z: 0 },
            nextCell: null,
            direction: { x: 1, z: 0 },
            progress: 0
        };

        expect(advanceMinecartState(state, 1.5, getBlock)).toBe(true);
        expect(state.cell).toEqual({ x: 1, y: 10, z: 0 });
        expect(state.nextCell).toEqual({ x: 1, y: 10, z: 1 });
        expect(state.progress).toBeCloseTo(0.5);
    });

    it('accelerates only with a rider and preserves its rail state for saves', () => {
        const scene = new THREE.Scene();
        const getBlock = railMap([
            { x: 0, y: 10, z: 0 },
            { x: 1, y: 10, z: 0 },
            { x: 2, y: 10, z: 0 }
        ]);
        const minecart = new Minecart(scene, {
            id: 'minecart:test',
            x: 0,
            y: 10,
            z: 0,
            direction: { x: 1, z: 0 }
        });

        minecart.update(0.1, { moveF: true }, { getBlock });
        expect(minecart.speed).toBe(0);

        minecart.hasRider = true;
        minecart.update(0.1, { moveF: true }, { getBlock });
        expect(minecart.speed).toBeCloseTo(0.4);
        expect(minecart.serialize()).toMatchObject({
            id: 'minecart:test',
            direction: { x: 1, z: 0 },
            speed: 0.4
        });

        minecart.dispose(scene);
        expect(scene.children).not.toContain(minecart.group);
    });
});
