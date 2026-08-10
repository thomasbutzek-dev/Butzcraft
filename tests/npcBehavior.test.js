import { describe, expect, it } from 'vitest';
import { findNpcPath, getNpcRoutine, getProfessionWorkplace } from '../js/npcBehavior.js';

const schedule = {
    home: { x: 0, y: 1, z: 0 },
    porch: { x: 1, y: 1, z: 0 },
    work: { x: 5, y: 1, z: 0 },
    gathering: { x: 8, y: 1, z: 0 },
    community: { x: 12, y: 1, z: 0 }
};

describe('villager daily routines', () => {
    it('sends residents home at night and to their profession during work hours', () => {
        expect(getNpcRoutine(0.1, 0, schedule)).toMatchObject({
            phase: 'sleep',
            action: 'sleeping',
            target: schedule.home
        });
        expect(getNpcRoutine(0.4, 0, schedule)).toMatchObject({
            phase: 'morning-work',
            action: 'forging',
            target: schedule.work
        });
        expect(getNpcRoutine(0.4, 1, schedule).action).toBe('tending');

        const smithy = { professionIdx: 0, work: { x: 14, y: 1, z: 3 } };
        const residentHouse = { professionIdx: 3, work: { x: 2, y: 1, z: 2 } };
        expect(getProfessionWorkplace([residentHouse, smithy], 0, residentHouse.work)).toBe(smithy.work);
    });

    it('uses the community house as an evening tavern with the trader serving', () => {
        expect(getNpcRoutine(0.78, 2, schedule)).toMatchObject({
            phase: 'evening',
            action: 'serving',
            target: schedule.community
        });
        expect(getNpcRoutine(0.78, 3, schedule).action).toBe('socializing');
    });
});

describe('villager pathfinding', () => {
    it('finds a walkable route around a wall instead of running into it', () => {
        const wall = new Set(['1,0', '1,1', '1,2']);
        const path = findNpcPath({
            start: { x: 0, y: 1, z: 1 },
            target: { x: 3, y: 1, z: 1 },
            getFootY: (x, z) => wall.has(`${x},${z}`) ? null : 1,
            goalRadius: 0
        });

        expect(path.at(-1)).toEqual({ x: 3, y: 1, z: 1 });
        expect(path.some(point => wall.has(`${point.x},${point.z}`))).toBe(false);
        expect(path.length).toBeGreaterThan(4);
    });

    it('rejects climbs higher than one block and unreachable targets', () => {
        const path = findNpcPath({
            start: { x: 0, y: 1, z: 0 },
            target: { x: 2, y: 3, z: 0 },
            getFootY: (x, z) => x >= 1 ? 3 : 1,
            maxDistance: 4,
            goalRadius: 0
        });

        expect(path).toEqual([]);
    });
});
