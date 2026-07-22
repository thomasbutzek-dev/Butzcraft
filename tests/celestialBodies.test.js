import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
    BLOOD_MOON_SIZE,
    CELESTIAL_RADIUS,
    MOON_SIZE,
    calculateCelestialState,
    createCelestialSystem,
    updateCelestialSystem
} from '../js/celestialBodies.js';

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createRadialGradient') return () => gradient;
            if (!(property in target)) target[property] = () => {};
            return target[property];
        },
        set(target, property, value) {
            target[property] = value;
            return true;
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
});

describe('celestial bodies', () => {
    it('places the sun high in the sky at noon and uses it as the main light', () => {
        const state = calculateCelestialState(0.5, false);

        expect(state.sunY).toBeCloseTo(CELESTIAL_RADIUS);
        expect(state.sunVisible).toBe(true);
        expect(state.moonVisible).toBe(false);
        expect(state.sunLightIntensity).toBeGreaterThan(1);
        expect(state.moonLightIntensity).toBe(0);
    });

    it('places a textured moon and cool moonlight in the night sky', () => {
        const system = createCelestialSystem(new THREE.Scene());
        const state = updateCelestialSystem(system, new THREE.Vector3(10, 20, 30), 0, false);

        expect(state.moonVisible).toBe(true);
        expect(system.moonSprite.material.map).toBe(system.moonTexture);
        expect(system.moonSprite.scale.x).toBe(MOON_SIZE);
        expect(system.moonLight.intensity).toBeCloseTo(0.2);
        expect(system.moonLight.color.getHex()).toBe(0x91abdc);
    });

    it('turns the night moon into a huge textured blood moon with red light', () => {
        const system = createCelestialSystem(new THREE.Scene());
        const state = updateCelestialSystem(system, new THREE.Vector3(), 0, true);

        expect(state.bloodMoonActive).toBe(true);
        expect(system.moonSprite.material.map).toBe(system.bloodMoonTexture);
        expect(system.moonSprite.scale.x).toBe(BLOOD_MOON_SIZE);
        expect(BLOOD_MOON_SIZE).toBeGreaterThan(MOON_SIZE * 2);
        expect(system.moonLight.intensity).toBeCloseTo(0.55);
        expect(system.moonLight.color.getHex()).toBe(0xff5963);
    });
});
