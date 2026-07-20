import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ParticleSystem, blocksPrecipitation, findPrecipitationImpactY, getPrecipitationVisualProfile } from '../js/particles.js';

describe('precipitation collision helpers', () => {
    it('lets precipitation pass through air, water and clouds only', () => {
        expect(blocksPrecipitation(0)).toBe(false);
        expect(blocksPrecipitation(4)).toBe(false);
        expect(blocksPrecipitation(8)).toBe(false);
        expect(blocksPrecipitation(26)).toBe(true);
        expect(blocksPrecipitation(32)).toBe(true);
    });

    it('finds a blocking roof between particle frames', () => {
        const world = {
            getBlock: (_x, y, _z) => y === 10 ? 26 : 0
        };

        expect(findPrecipitationImpactY(world, 4.2, 12.0, 9.8, -3.5)).toBe(10);
        expect(findPrecipitationImpactY(world, 4.2, 9.5, 8.8, -3.5)).toBeNull();
    });
});

describe('painterly precipitation', () => {
    it('keeps the original particle shape in variant A', () => {
        const rain = getPrecipitationVisualProfile('rain', false);
        const snow = getPrecipitationVisualProfile('snow', false);

        expect(rain).toMatchObject({ width: 0.05, height: 0.3, opacity: 0.5 });
        expect(snow).toMatchObject({ width: 0.08, height: 0.08, opacity: 0.75 });
        expect(rain.colors).toHaveLength(1);
        expect(snow.colors).toHaveLength(1);
    });

    it('uses several restrained shapes and tones in variants B and C', () => {
        const rain = getPrecipitationVisualProfile('rain', true);
        const snow = getPrecipitationVisualProfile('snow', true);

        expect(rain.height).toBeGreaterThan(0.3);
        expect(rain.colors.length).toBeGreaterThan(1);
        expect(snow.colors.length).toBeGreaterThan(1);
        expect(snow.scaleRange).toBeGreaterThan(0);
    });

    it('updates and uploads only currently visible instances', () => {
        const particles = new ParticleSystem(new THREE.Scene(), 'rain', 10);
        const setMatrixAt = vi.spyOn(particles.mesh, 'setMatrixAt');

        particles.update(1 / 60, new THREE.Vector3(0, 20, 0), 0.3);
        const expectedActiveCount = Math.floor(particles.count * 0.3);

        expect(particles.mesh.count).toBe(expectedActiveCount);
        expect(particles.activeCount).toBe(expectedActiveCount);
        expect(setMatrixAt).toHaveBeenCalledTimes(expectedActiveCount);
        expect(particles.mesh.instanceMatrix.updateRanges).toEqual([{ start: 0, count: expectedActiveCount * 16 }]);

        setMatrixAt.mockClear();
        particles.update(1 / 60, new THREE.Vector3(0, 20, 0), 0);
        expect(particles.mesh.count).toBe(0);
        expect(setMatrixAt).not.toHaveBeenCalled();
    });

});
