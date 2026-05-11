/* tests/touch.test.js
 *
 * Tests fuer die Touch-Detection-Heuristik in touch.js.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyTouchLookDelta, initTouchControls, isTouchDevice } from '../js/touch.js';

const origMaxTouchPoints = navigator.maxTouchPoints;
const origMatchMedia = window.matchMedia;
const origOnTouchStart = 'ontouchstart' in window ? window.ontouchstart : undefined;

beforeEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    delete window.ontouchstart;
    window.matchMedia = () => ({ matches: false });
});

afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: origMaxTouchPoints, configurable: true });
    if (origOnTouchStart !== undefined) window.ontouchstart = origOnTouchStart;
    window.matchMedia = origMatchMedia;
    document.getElementById('touch-overlay')?.remove();
    document.getElementById('touch-controls-styles')?.remove();
    document.documentElement.classList.remove('touch-device');
    document.body.classList.remove('touch-device');
});

describe('isTouchDevice', () => {
    it('Desktop ohne Touch und ohne coarse pointer -> false', () => {
        expect(isTouchDevice()).toBe(false);
    });

    it('iOS-Style: ontouchstart in window -> true', () => {
        window.ontouchstart = null;
        expect(isTouchDevice()).toBe(true);
    });

    it('Android-Style: navigator.maxTouchPoints > 0 -> true', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
        expect(isTouchDevice()).toBe(true);
    });

    it('Tablet-Hybrid: matchMedia(pointer: coarse) -> true', () => {
        window.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' });
        expect(isTouchDevice()).toBe(true);
    });

    it('matchMedia ohne coarse -> false', () => {
        window.matchMedia = () => ({ matches: false });
        expect(isTouchDevice()).toBe(false);
    });

    it('initialisiert die mobile Ansicht auf Touch-Geraeten', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false
        });

        expect(document.getElementById('touch-overlay')).not.toBeNull();
        expect(document.documentElement.classList.contains('touch-device')).toBe(true);
        expect(document.body.classList.contains('touch-device')).toBe(true);
    });

    it('Touch-Look erzeugt keinen Roll/Seitwaerts-Kippwinkel', () => {
        const camera = {
            rotation: { x: 0, y: 0, z: 0.8, order: 'XYZ' },
            quaternion: { setFromEuler: (rotation) => { camera.lastEuler = { ...rotation }; } }
        };

        applyTouchLookDelta({
            camera,
            controls: { getObject: () => camera }
        }, 40, -20);

        expect(camera.rotation.order).toBe('YXZ');
        expect(camera.rotation.z).toBe(0);
        expect(camera.lastEuler.z).toBe(0);
    });

    it('Touch-Look klemmt Pitch auf PointerLock-Grenzen', () => {
        const camera = { rotation: { x: 10, y: 0, z: -0.4, order: 'XYZ' } };

        applyTouchLookDelta({
            camera,
            controls: { getObject: () => camera }
        }, 0, -10000);

        expect(camera.rotation.x).toBeLessThan(Math.PI / 2);
        expect(camera.rotation.z).toBe(0);
    });
});
