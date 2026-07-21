import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Player } from '../js/Player.js';

function createPlayer() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2, 0);
    return new Player(scene, camera, document.createElement('canvas'), CONFIG, null);
}

describe('Player ghost mode', () => {
    it('flies through unloaded and solid world space without gravity or collision checks', () => {
        const player = createPlayer();
        const start = player.controls.getObject().position.clone();
        const world = { getBlock: vi.fn(() => { throw new Error('collision check'); }) };

        player.setGhostMode(true);
        player.updatePhysics(0.5, { moveF: true }, world, {});

        expect(world.getBlock).not.toHaveBeenCalled();
        expect(player.controls.getObject().position.z).toBeCloseTo(start.z - 6);
        expect(player.velocity.lengthSq()).toBe(0);
    });

    it('uses space and control for vertical flight and shift for fast flight', () => {
        const player = createPlayer();
        const startY = player.controls.getObject().position.y;

        player.setGhostMode(true);
        player.updatePhysics(0.2, { moveUp: true, sprint: true }, {}, {});
        expect(player.controls.getObject().position.y).toBeCloseTo(startY + 6);

        player.updatePhysics(0.2, { crouch: true }, {}, {});
        expect(player.controls.getObject().position.y).toBeCloseTo(startY + 3.6);
    });

    it('disables water state and lets the third-person camera pass through blocks', () => {
        const player = createPlayer();
        const sound = { setUnderwater: vi.fn() };
        player.wasHeadInWater = true;
        player.inWater = true;
        player.setCameraMode('third');
        player.setGhostMode(true);
        const eye = player.controls.getObject().position.clone();

        player.updateWaterAndVoid({ getBlock: vi.fn() }, sound, 1);
        const state = player.prepareCameraForRender({ getBlock: () => 1 });
        const cameraDistance = player.camera.position.distanceTo(eye);

        expect(player.inWater).toBe(false);
        expect(sound.setUnderwater).toHaveBeenCalledWith(false);
        expect(cameraDistance).toBeGreaterThan(4);
        player.restoreCameraAfterRender(state);
    });

    it('only exits ghost mode from collision-free space', () => {
        const player = createPlayer();

        expect(player.canExitGhostMode({ getBlock: () => 1 })).toBe(false);
        expect(player.canExitGhostMode({ getBlock: () => 0 })).toBe(true);
    });
});

describe('secret ghost mode shortcut', () => {
    it('requires every modifier and leaves no player-facing hint', () => {
        const gameSource = readFileSync('js/GameMain.js', 'utf8');
        const pageSource = readFileSync('index.html', 'utf8');
        const styleSource = readFileSync('style.css', 'utf8');

        expect(gameSource).toContain(
            "e.code !== 'KeyG' || !e.ctrlKey || !e.altKey || !e.shiftKey || e.metaKey"
        );
        expect(gameSource).not.toContain('showGhostModeMessage');
        expect(pageSource).not.toContain('Ghost-Modus');
        expect(styleSource).not.toContain('ghost-mode-notice');
    });
});
