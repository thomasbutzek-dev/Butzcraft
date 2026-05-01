/* tests/touch.test.js
 *
 * Tests für die Touch-Detection-Heuristik in touch.js.
 * Wir mocken navigator/window-Properties pro Test, damit jeder Branch durchlaufen wird.
 *
 * NICHT getestet: initTouchControls() selbst — das setzt DOM auf, hat side-effects auf body
 * und braucht eine vollständige Three.js-Camera. Eher Integrations-Test in der Browser-Preview.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTouchDevice } from '../js/touch.js';

const origMaxTouchPoints = navigator.maxTouchPoints;
const origMatchMedia = window.matchMedia;
const origOnTouchStart = 'ontouchstart' in window ? window.ontouchstart : undefined;

beforeEach(() => {
    // Sauberer Default: kein Touch
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
    delete window.ontouchstart;
    window.matchMedia = () => ({ matches: false });
});

afterEach(() => {
    Object.defineProperty(navigator, 'maxTouchPoints', { value: origMaxTouchPoints, configurable: true });
    if (origOnTouchStart !== undefined) window.ontouchstart = origOnTouchStart;
    window.matchMedia = origMatchMedia;
});

describe('isTouchDevice', () => {
    it('Desktop (kein Touch, kein coarse pointer) → false', () => {
        expect(isTouchDevice()).toBe(false);
    });

    it('iOS-Style: ontouchstart in window → true', () => {
        window.ontouchstart = null; // Property muss EXISTIEREN, value egal
        expect(isTouchDevice()).toBe(true);
    });

    it('Android-Style: navigator.maxTouchPoints > 0 → true', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
        expect(isTouchDevice()).toBe(true);
    });

    it('Tablet-Hybrid: matchMedia(pointer: coarse) → true', () => {
        window.matchMedia = (q) => ({ matches: q === '(pointer: coarse)' });
        expect(isTouchDevice()).toBe(true);
    });

    it('matchMedia ohne coarse → false', () => {
        window.matchMedia = (q) => ({ matches: false });
        expect(isTouchDevice()).toBe(false);
    });
});
