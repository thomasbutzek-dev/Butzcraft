import { describe, expect, it } from 'vitest';
import {
    THIRD_PERSON_MAX_DISTANCE,
    THIRD_PERSON_MAX_PITCH,
    THIRD_PERSON_MIN_DISTANCE,
    THIRD_PERSON_MIN_PITCH,
    clampThirdPersonDistance,
    clampThirdPersonPitch,
    orbitDirection
} from '../js/characterCamera.js';

describe('third-person camera math', () => {
    it('clamps zoom and pitch to playable bounds', () => {
        expect(clampThirdPersonDistance(-20)).toBe(THIRD_PERSON_MIN_DISTANCE);
        expect(clampThirdPersonDistance(20)).toBe(THIRD_PERSON_MAX_DISTANCE);
        expect(clampThirdPersonPitch(-20)).toBe(THIRD_PERSON_MIN_PITCH);
        expect(clampThirdPersonPitch(20)).toBe(THIRD_PERSON_MAX_PITCH);
    });

    it('supports a full horizontal orbit', () => {
        const behind = orbitDirection(0, 0);
        const front = orbitDirection(Math.PI, 0);
        expect(behind.z).toBeCloseTo(-1);
        expect(front.z).toBeCloseTo(1);
        expect(front.x).toBeCloseTo(0);
    });
});
