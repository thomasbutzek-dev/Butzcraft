/* tests/Game.test.js - Smoke-Test für die Game-Singleton-Proxy.
 *
 * Während Phase 1 der Migration leitet jeder Slot transparent zu window weiter.
 * Diese Tests verifizieren:
 *  - Schreiben auf Game.x setzt window.x (und umgekehrt)
 *  - playerPosition liefert null, wenn kein Player gesetzt ist
 *  - reset() räumt alle Slots auf
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../js/Game.js';

describe('Game-Singleton (Phase-1-Proxy)', () => {
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

    it('Schreiben auf Game.player propagiert zu window.player', () => {
        const fakePlayer = { health: 100 };
        Game.player = fakePlayer;
        expect(window.player).toBe(fakePlayer);
    });

    it('Schreiben auf window.player ist über Game.player lesbar', () => {
        const fakePlayer = { health: 50 };
        window.player = fakePlayer;
        expect(Game.player).toBe(fakePlayer);
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

    it('reset() räumt alle Proxied-Slots auf', () => {
        Game.player = { dummy: true };
        Game.world = { dummy: true };
        Game.scene = { dummy: true };
        Game.reset();
        expect(Game.player).toBeUndefined();
        expect(Game.world).toBeUndefined();
        expect(Game.scene).toBeUndefined();
        expect(window.player).toBeUndefined();
    });

    it('owns and resets touchActive without leaking it to window', () => {
        delete window.touchActive;
        Game.touchActive = true;
        expect(window.touchActive).toBeUndefined();
        Game.reset();
        expect(Game.touchActive).toBe(false);
    });
});
