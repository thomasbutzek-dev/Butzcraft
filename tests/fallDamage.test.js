import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Player, getFallDamage } from '../js/Player.js';

// Flat ground: solid at y = 0..9, so the player stands with the camera at about y 11.65.
const GROUND_TOP = 10;
const world = { getBlock: (x, y) => (y < GROUND_TOP ? 3 : 0) };

function dropFrom(blocks) {
    const camera = new THREE.PerspectiveCamera();
    const player = new Player(new THREE.Scene(), camera, document.createElement('canvas'), CONFIG, null);
    const position = player.controls.getObject().position;
    position.set(0.5, GROUND_TOP + 1.651 + blocks, 0.5);
    for (let frame = 0; frame < 600 && player.pendingFallDamage === 0; frame++) {
        player.updatePhysics(1 / 60, {}, world, {});
        if (player.canJ && frame > 0) break;
    }
    return player.pendingFallDamage;
}

describe('fall damage', () => {
    it('grows with the impact speed above the threshold', () => {
        expect(getFallDamage(20, -26.5, 2)).toBe(0);
        expect(getFallDamage(26.5, -26.5, 2)).toBe(0);
        expect(getFallDamage(36.5, -26.5, 2)).toBe(20);
    });

    it('spares short falls and hurts from about nine blocks on', () => {
        expect(dropFrom(3)).toBe(0);
        expect(dropFrom(8)).toBe(0);
        expect(dropFrom(12)).toBeGreaterThan(0);
        expect(dropFrom(25)).toBeGreaterThan(dropFrom(12));
        expect(dropFrom(25)).toBeLessThan(CONFIG.GAMEPLAY.MAX_HEALTH);
    });

    it('counts every landing, also one that ends just above the ground', () => {
        // Some heights used to stop a frame within 0.05 blocks of the ground, where the
        // ground check zeroed the speed without any damage.
        let previous = 0;
        for (let blocks = 10; blocks <= 40; blocks++) {
            const damage = dropFrom(blocks);
            expect(damage, `${blocks} blocks`).toBeGreaterThan(0);
            expect(damage, `${blocks} blocks`).toBeGreaterThanOrEqual(previous);
            previous = damage;
        }
    });
});
