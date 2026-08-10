/* tests/touch.test.js
 *
 * Tests fuer die Touch-Detection-Heuristik in touch.js.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyTouchLookDelta, initTouchControls, isTouchDevice } from '../js/touch.js';
import { Game } from '../js/Game.js';
import { Input } from '../js/Input.js';

const origMaxTouchPoints = navigator.maxTouchPoints;
const origMatchMedia = window.matchMedia;
const origOnTouchStart = 'ontouchstart' in window ? window.ontouchstart : undefined;

function dispatchTouchEvent(el, type, touch) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: [touch] });
    Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [touch] });
    el.dispatchEvent(event);
}

function dispatchTouches(el, type, touches, changedTouches = touches) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: changedTouches });
    Object.defineProperty(event, 'touches', { value: touches });
    el.dispatchEvent(event);
}

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
    Game.touchActive = false;
    Input.moveF = Input.moveB = Input.moveL = Input.moveR = Input.moveUp = false;
    Input.touchJumpHeld = Input.touchJumpQueued = false;
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
        expect(Game.touchActive).toBe(true);
        expect(document.getElementById('touch-btn-jump')).not.toBeNull();
        expect(document.getElementById('touch-btn-place')).not.toBeNull();
        expect(document.getElementById('touch-btn-inv')).not.toBeNull();
        expect(document.getElementById('touch-btn-pause')).not.toBeNull();
        expect(document.getElementById('touch-btn-camera')).not.toBeNull();
        expect(document.getElementById('touch-btn-dig')).toBeNull();
        expect(document.getElementById('touch-btn-slot-prev')).toBeNull();
        expect(document.getElementById('touch-btn-slot-next')).toBeNull();
    });

    it('wechselt die Kamera im Touch-HUD ohne externe Tastatur', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const player = { cameraMode: 'first' };
        const toggleCameraMode = vi.fn(() => {
            player.cameraMode = player.cameraMode === 'third' ? 'first' : 'third';
            return player.cameraMode;
        });

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            player,
            toggleCameraMode,
            isInventoryOpenedProvider: () => false
        });

        const cameraButton = document.getElementById('touch-btn-camera');
        expect(cameraButton.textContent).toBe('3P');

        dispatchTouchEvent(cameraButton, 'touchstart', {
            identifier: 4,
            clientX: 10,
            clientY: 10
        });

        expect(toggleCameraMode).toHaveBeenCalledOnce();
        expect(cameraButton.textContent).toBe('1P');
        expect(cameraButton.getAttribute('aria-label')).toBe('Zu First Person wechseln');
    });

    it('Touch-Bauen feuert eine Rechtsklick-Interaktion', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const buttons = [];
        const onMouseDown = (e) => buttons.push(e.button);
        document.addEventListener('mousedown', onMouseDown);

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false
        });

        dispatchTouchEvent(document.getElementById('touch-btn-place'), 'touchstart', {
            identifier: 1,
            clientX: 10,
            clientY: 10
        });

        document.removeEventListener('mousedown', onMouseDown);
        expect(buttons).toEqual([2]);
    });

    it('Touch-Pause verwendet den zentralen Pause- und Fortsetzen-Pfad', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const pauseGame = vi.fn();
        const resumeGame = vi.fn();
        let paused = false;

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false,
            isPausedProvider: () => paused,
            pauseGame,
            resumeGame
        });

        const pauseButton = document.getElementById('touch-btn-pause');
        dispatchTouchEvent(pauseButton, 'touchstart', { identifier: 2, clientX: 10, clientY: 10 });
        expect(pauseGame).toHaveBeenCalledOnce();

        paused = true;
        dispatchTouchEvent(pauseButton, 'touchstart', { identifier: 3, clientX: 10, clientY: 10 });
        expect(resumeGame).toHaveBeenCalledOnce();
    });

    it('kurzer Tap im Look-Bereich feuert eine Linksklick-Interaktion', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const buttons = [];
        const onMouseDown = (e) => buttons.push(e.button);
        document.addEventListener('mousedown', onMouseDown);

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false
        });

        const area = document.getElementById('touch-look-area');
        dispatchTouchEvent(area, 'touchstart', { identifier: 7, clientX: 100, clientY: 100 });
        dispatchTouchEvent(area, 'touchend', { identifier: 7, clientX: 102, clientY: 101 });

        document.removeEventListener('mousedown', onMouseDown);
        expect(buttons).toEqual([0]);
    });

    it('haelt den Abbau bis zum Loslassen aktiv', () => {
        vi.useFakeTimers();
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const events = [];
        const onMouseDown = (e) => events.push(`down:${e.button}`);
        const onMouseUp = (e) => events.push(`up:${e.button}`);
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);

        try {
            initTouchControls({
                camera: { rotation: { x: 0 } },
                controls: { getObject: () => ({ rotation: { y: 0 } }) },
                isInventoryOpenedProvider: () => false
            });

            const area = document.getElementById('touch-look-area');
            dispatchTouchEvent(area, 'touchstart', { identifier: 8, clientX: 100, clientY: 100 });
            vi.advanceTimersByTime(181);
            expect(events).toEqual(['down:0']);

            dispatchTouchEvent(area, 'touchend', { identifier: 8, clientX: 100, clientY: 100 });
            expect(events).toEqual(['down:0', 'up:0']);
        } finally {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mouseup', onMouseUp);
            vi.useRealTimers();
        }
    });

    it('loest bei einem abgebrochenen Touch keinen Schlag aus', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const buttons = [];
        const onMouseDown = (e) => buttons.push(e.button);
        document.addEventListener('mousedown', onMouseDown);

        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false
        });

        const area = document.getElementById('touch-look-area');
        dispatchTouchEvent(area, 'touchstart', { identifier: 9, clientX: 100, clientY: 100 });
        dispatchTouchEvent(area, 'touchcancel', { identifier: 9, clientX: 100, clientY: 100 });

        document.removeEventListener('mousedown', onMouseDown);
        expect(buttons).toEqual([]);
    });

    it('Pinch-Zoom veraendert den Abstand ohne Angriff', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const attacks = [];
        const onAttack = (event) => attacks.push(event.button);
        document.addEventListener('mousedown', onAttack);
        let distance = 4.2;
        const player = {
            cameraMode: 'third',
            getThirdPersonCameraDistance: () => distance,
            setThirdPersonCameraDistance: (value) => { distance = value; }
        };
        initTouchControls({
            camera: { rotation: { x: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            player,
            isInventoryOpenedProvider: () => false
        });

        const area = document.getElementById('touch-look-area');
        const first = { identifier: 10, clientX: 100, clientY: 100 };
        const second = { identifier: 11, clientX: 200, clientY: 100 };
        dispatchTouches(area, 'touchstart', [first], [first]);
        dispatchTouches(area, 'touchstart', [first, second], [second]);
        dispatchTouches(area, 'touchmove', [first, { ...second, clientX: 230 }]);
        dispatchTouches(area, 'touchend', [], [first, second]);
        document.removeEventListener('mousedown', onAttack);

        expect(distance).toBeLessThan(4.2);
        expect(attacks).toEqual([]);
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

    it('kombiniert Springen und Kameradrehung auf dem Sprungbutton', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const camera = { rotation: { x: 0, y: 0, z: 0, order: 'YXZ' } };
        const attacks = [];
        const onAttack = (event) => attacks.push(event.button);
        document.addEventListener('mousedown', onAttack);

        initTouchControls({
            camera,
            controls: { getObject: () => camera },
            isInventoryOpenedProvider: () => false
        });
        Input.moveF = true;

        const jump = document.getElementById('touch-btn-jump');
        const start = { identifier: 20, clientX: 300, clientY: 300 };
        dispatchTouches(jump, 'touchstart', [start], [start]);
        expect(Input.touchJumpQueued).toBe(true);
        expect(Input.touchJumpHeld).toBe(true);

        dispatchTouches(jump, 'touchmove', [{ ...start, clientX: 325, clientY: 285 }]);
        dispatchTouches(jump, 'touchend', [], [{ ...start, clientX: 325, clientY: 285 }]);
        document.removeEventListener('mousedown', onAttack);

        expect(camera.rotation.y).toBeLessThan(0);
        expect(camera.rotation.x).toBeGreaterThan(0);
        expect(Input.moveF).toBe(true);
        expect(Input.touchJumpHeld).toBe(false);
        expect(attacks).toEqual([]);
    });

    it('loest beim Ziehen vom Blickbereich in die Sprungzone genau einen Sprung aus', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        const camera = { rotation: { x: 0, y: 0, z: 0, order: 'YXZ' } };
        initTouchControls({
            camera,
            controls: { getObject: () => camera },
            isInventoryOpenedProvider: () => false
        });

        const jump = document.getElementById('touch-btn-jump');
        jump.getBoundingClientRect = () => ({
            left: 250, right: 310, top: 250, bottom: 310, width: 60, height: 60
        });
        const area = document.getElementById('touch-look-area');
        const start = { identifier: 21, clientX: 200, clientY: 200 };
        dispatchTouches(area, 'touchstart', [start], [start]);
        dispatchTouches(area, 'touchmove', [{ ...start, clientX: 270, clientY: 270 }]);

        expect(Input.touchJumpQueued).toBe(true);
        expect(Input.touchJumpHeld).toBe(true);
        Input.touchJumpQueued = false; // simuliert den vom nächsten Spielframe verbrauchten Sprung

        dispatchTouches(area, 'touchmove', [{ ...start, clientX: 280, clientY: 280 }]);
        expect(Input.touchJumpQueued).toBe(false);

        dispatchTouches(area, 'touchend', [], [{ ...start, clientX: 280, clientY: 280 }]);
        expect(Input.touchJumpHeld).toBe(false);
    });

    it('setzt eine abgebrochene Sprunggeste vollständig zurück', () => {
        Object.defineProperty(navigator, 'maxTouchPoints', { value: 4, configurable: true });
        initTouchControls({
            camera: { rotation: { x: 0, y: 0, z: 0 } },
            controls: { getObject: () => ({ rotation: { y: 0 } }) },
            isInventoryOpenedProvider: () => false
        });

        const jump = document.getElementById('touch-btn-jump');
        const touch = { identifier: 22, clientX: 300, clientY: 300 };
        dispatchTouches(jump, 'touchstart', [touch], [touch]);
        dispatchTouches(jump, 'touchcancel', [], [touch]);

        expect(Input.touchJumpHeld).toBe(false);
        expect(Input.touchJumpQueued).toBe(false);
    });
});
