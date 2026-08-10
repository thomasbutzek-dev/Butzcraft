import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Player } from '../js/Player.js';

function createPlayer() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2.651, 0);
    return new Player(scene, camera, document.createElement('canvas'), CONFIG, null);
}

const sound = { playStep: vi.fn() };

describe('Player mobile jump input', () => {
    it('verbraucht einen Touch-Sprung an Land genau einmal', () => {
        const player = createPlayer();
        const world = { getBlock: (_x, y) => y <= 0 ? 1 : 0 };
        const input = { touchJumpQueued: true, touchJumpHeld: true };
        player.canJ = true;

        player.updatePhysics(1 / 60, input, world, sound);

        expect(player.velocity.y).toBeGreaterThan(0);
        expect(input.touchJumpQueued).toBe(false);

        player.controls.getObject().position.set(0, 2.651, 0);
        player.velocity.set(0, 0, 0);
        player.canJ = true;
        player.updatePhysics(1 / 60, input, world, sound);

        expect(player.velocity.y).toBeLessThanOrEqual(0);
    });

    it('nutzt Halten weiterhin zum Auftauchen im Wasser', () => {
        const player = createPlayer();
        const world = { getBlock: () => 4 };
        const input = { touchJumpQueued: false, touchJumpHeld: true };

        player.updatePhysics(1 / 60, input, world, sound);

        expect(player.velocity.y).toBeGreaterThan(0);
    });
});
