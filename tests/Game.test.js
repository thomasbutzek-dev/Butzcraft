/* tests/Game.test.js - Smoke tests for the central Game state.
 *
 * These tests verify owned state, derived values and reset behavior.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../js/Game.js';

describe('Game singleton', () => {
    beforeEach(() => {
        Game.reset();
    });

    it('exportiert eine Singleton-Instanz', () => {
        expect(Game).toBeDefined();
        expect(typeof Game.reset).toBe('function');
    });

    it('macht sich auch als window.Game verfügbar (DevTools-Hook)', () => {
        expect(window.Game).toBe(Game);
    });

    it('owns player state without leaking it to window', () => {
        delete window.player;
        const fakePlayer = { health: 100 };
        Game.player = fakePlayer;
        expect(Game.player).toBe(fakePlayer);
        expect(window.player).toBeUndefined();
    });

    it('playerPosition ist null, solange kein Player gesetzt', () => {
        expect(Game.playerPosition).toBeNull();
    });

    it('playerPosition liest position via player.controls.getObject()', () => {
        const fakePos = { x: 10, y: 20, z: 30 };
        Game.player = {
            controls: { getObject: () => ({ position: fakePos }) }
        };
        expect(Game.playerPosition).toBe(fakePos);
    });

    it('renderStats liefert null ohne Renderer', () => {
        expect(Game.renderStats).toBeNull();
    });

    it('renderStats liefert die Stats-Werte aus dem Renderer', () => {
        Game.renderer = {
            info: {
                render: { calls: 7, triangles: 1234 },
                memory: { geometries: 11, textures: 5 }
            }
        };
        expect(Game.renderStats).toEqual({
            calls: 7, triangles: 1234, geometries: 11, textures: 5
        });
    });

    it('reset() restores every shared state default', () => {
        Game.player = { dummy: true };
        Game.world = { dummy: true };
        Game.renderer = { dummy: true };
        Game.droppedItems = [];
        Game.webglContextLost = true;
        Game.touchActive = true;
        Game.reset();
        expect(Game.player).toBeUndefined();
        expect(Game.world).toBeUndefined();
        expect(Game.renderer).toBeUndefined();
        expect(Game.droppedItems).toBeUndefined();
        expect(Game.webglContextLost).toBe(false);
        expect(Game.touchActive).toBe(false);
    });

    it('owns and resets touchActive without leaking it to window', () => {
        delete window.touchActive;
        Game.touchActive = true;
        expect(window.touchActive).toBeUndefined();
        Game.reset();
        expect(Game.touchActive).toBe(false);
    });
});
