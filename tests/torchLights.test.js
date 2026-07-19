import { describe, expect, it } from 'vitest';
import {
    TORCH_TYPE,
    TorchLightSystem,
    getTorchMount,
    selectNearestLightPositions,
    selectNearestTorchPositions
} from '../js/torchLights.js';

describe('torch placement', () => {
    it('supports floors and the four wall directions, but not ceilings', () => {
        expect(getTorchMount({ x: 0, y: 1, z: 0 })).toBe(0);
        expect(getTorchMount({ x: 1, y: 0, z: 0 })).toBe(1);
        expect(getTorchMount({ x: -1, y: 0, z: 0 })).toBe(2);
        expect(getTorchMount({ x: 0, y: 0, z: 1 })).toBe(3);
        expect(getTorchMount({ x: 0, y: 0, z: -1 })).toBe(4);
        expect(getTorchMount({ x: 0, y: -1, z: 0 })).toBeNull();
    });

    it('adds a warm light position for generated dungeon fire', () => {
        expect(selectNearestLightPositions(
            {},
            new Set(['3,5,0']),
            { x: 0, y: 5, z: 0 },
            8,
            12
        )).toEqual([{ x: 3.5, y: 5.55, z: 0.5 }]);
    });
});

describe('placed torch light selection', () => {
    it('caps runtime point lights at four by default', () => {
        const scene = { add() {} };
        const system = new TorchLightSystem(scene);

        expect(system.lights).toHaveLength(4);
        expect(system.maxDistance).toBe(24);
    });

    it('returns only nearby torches in nearest-first order and respects the pool limit', () => {
        const modifiedBlocks = {
            '2,4,0': TORCH_TYPE,
            '7,4,0': TORCH_TYPE,
            '4,4,0': TORCH_TYPE,
            '1,4,0': 0,
            '40,4,0': TORCH_TYPE
        };

        expect(selectNearestTorchPositions(modifiedBlocks, { x: 0, y: 4, z: 0 }, 2, 12)).toEqual([
            { x: 2.5, y: 4.72, z: 0.5 },
            { x: 4.5, y: 4.72, z: 0.5 }
        ]);
    });
});
