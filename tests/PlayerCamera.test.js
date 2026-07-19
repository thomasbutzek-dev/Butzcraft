import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Player } from '../js/Player.js';

describe('Player third-person camera', () => {
    it('keeps the camera in front of a solid wall on every orbit ray', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(0, 2, 0);
        const player = new Player(scene, camera, document.createElement('canvas'), CONFIG, null);
        const world = { getBlock: (_x, _y, z) => z >= 2 ? 1 : 0 };

        const safe = player.getUnblockedCameraPosition(
            world,
            new THREE.Vector3(0, 2, 0),
            new THREE.Vector3(0, 2, 4.2)
        );

        expect(safe.z).toBeGreaterThanOrEqual(0);
        expect(safe.z).toBeLessThan(2);
    });

    it('does not render the avatar when collision pushes the camera into it', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        camera.position.set(0, 2, 0);
        const player = new Player(scene, camera, document.createElement('canvas'), CONFIG, null);
        player.characterGroup = new THREE.Group();
        scene.add(player.characterGroup);
        player.setCameraMode('third');
        const world = { getBlock: (_x, _y, z) => z >= 0.8 ? 1 : 0 };

        const restoreState = player.prepareCameraForRender(world);

        const collisionDistance = camera.position.distanceTo(new THREE.Vector3(0, 2, 0));
        expect(collisionDistance).toBeLessThan(1.1);
        expect(player.characterGroup.visible).toBe(false);

        player.restoreCameraAfterRender(restoreState);
        const clearWorld = { getBlock: () => 0 };
        for (let frame = 0; frame < 30; frame++) {
            const state = player.prepareCameraForRender(clearWorld);
            player.restoreCameraAfterRender(state);
        }
        expect(player.characterGroup.visible).toBe(true);
    });

    it('does not consume wheel scrolling outside the game surface', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const gameSurface = document.createElement('canvas');
        const scrollableDialog = document.createElement('div');
        document.body.append(gameSurface, scrollableDialog);
        const player = new Player(scene, camera, gameSurface, CONFIG, null);
        player.setCameraMode('third');
        const initialDistance = player.getThirdPersonCameraDistance();

        const dialogWheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        expect(scrollableDialog.dispatchEvent(dialogWheel)).toBe(true);
        expect(player.getThirdPersonCameraDistance()).toBe(initialDistance);

        const gameWheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        expect(gameSurface.dispatchEvent(gameWheel)).toBe(false);
        expect(player.getThirdPersonCameraDistance()).toBeGreaterThan(initialDistance);

        gameSurface.remove();
        scrollableDialog.remove();
    });

    it('keeps pointer lock on the document while limiting zoom to the game surface', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const gameSurface = document.createElement('canvas');
        const dialog = document.createElement('div');
        document.body.append(gameSurface, dialog);
        const player = new Player(scene, camera, document.body, CONFIG, null, gameSurface);
        player.setCameraMode('third');
        const initialDistance = player.getThirdPersonCameraDistance();

        expect(player.controls.domElement).toBe(document.body);
        expect(dialog.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))).toBe(true);
        expect(player.getThirdPersonCameraDistance()).toBe(initialDistance);
        expect(gameSurface.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))).toBe(false);

        gameSurface.remove();
        dialog.remove();
    });

    it('wires the desktop pointer lock and camera zoom to separate surfaces', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain(
            'new Player(scene, camera, document.body, CONFIG, activeCharacterProfile, renderer.domElement)'
        );
    });
});
