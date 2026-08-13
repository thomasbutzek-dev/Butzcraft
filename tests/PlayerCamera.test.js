import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Player } from '../js/Player.js';
import { createCharacterProfile } from '../js/characterProfile.js';

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            if (!(property in target)) target[property] = () => {};
            return target[property];
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
});

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

    it('keeps selected swords and tools visible in first person and animates tools', () => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const player = new Player(scene, camera, document.createElement('canvas'), CONFIG, null);

        player.updateHeldItem(63);
        player.updateSword(0.016);
        expect(player.toolGroup.visible).toBe(true);
        expect(player.swordGroup.visible).toBe(false);

        player.startAttackAnimation(null);
        player.updateSword(0.016);
        expect(player.toolGroup.visible).toBe(true);

        player.isSwinging = false;
        player.updateHeldItem(91);
        player.updateSword(0.016);
        expect(player.swordGroup.visible).toBe(true);
        expect(player.toolGroup.visible).toBe(false);
    });

    it.each([
        [63, 'pickaxeHead'],
        [67, 'axeHead'],
        [71, 'shovelHead']
    ])('gives held tool %i its own multi-part silhouette', (itemType, activeHeadName) => {
        const player = new Player(new THREE.Scene(), new THREE.PerspectiveCamera(), document.createElement('canvas'), CONFIG, null);

        player.updateHeldItem(itemType);

        const heads = ['pickaxeHead', 'axeHead', 'shovelHead'].map(name => player.toolGroup.getObjectByName(name));
        expect(heads.every(Boolean)).toBe(true);
        expect(heads.find(head => head.name === activeHeadName).visible).toBe(true);
        expect(heads.filter(head => head.name !== activeHeadName).every(head => !head.visible)).toBe(true);
        expect(heads.find(head => head.name === activeHeadName).children.length).toBeGreaterThan(1);
    });

    it('uses distinct painterly material textures for every tool and sword tier', () => {
        const player = new Player(new THREE.Scene(), new THREE.PerspectiveCamera(), document.createElement('canvas'), CONFIG, null);
        const toolMaps = [63, 64, 65, 66].map(type => {
            player.updateHeldItem(type);
            return player.toolGroup.userData.headMaterial?.map;
        });
        const swordMaps = [89, 90, 91, 92].map(type => {
            player.updateHeldItem(type);
            return player.swordGroup.userData.bladeMaterial?.map;
        });

        expect(toolMaps.every(Boolean)).toBe(true);
        expect(swordMaps.every(Boolean)).toBe(true);
        expect(new Set(toolMaps).size).toBe(4);
        expect(new Set(swordMaps).size).toBe(4);
        expect(new Set(Array.from(toolMaps[0].image.data))).not.toEqual(new Set([toolMaps[0].image.data[0]]));
    });

    it('builds the sword and bow from recognizable detailed parts', () => {
        const player = new Player(new THREE.Scene(), new THREE.PerspectiveCamera(), document.createElement('canvas'), CONFIG, null);

        expect(player.swordGroup.getObjectByName('swordBladeTip')).toBeTruthy();
        expect(player.swordGroup.getObjectByName('swordBladeEdge')).toBeTruthy();
        expect(player.swordGroup.getObjectByName('swordGripWrap')).toBeTruthy();
        expect(player.bowGroup.getObjectByName('bowGrip')).toBeTruthy();
        expect(player.bowGroup.userData.limbSegments).toBeGreaterThanOrEqual(6);
        expect(player.bowGroup.userData.limbMaterial?.map).toBeTruthy();
    });

    it.each([
        [63, 'toolGroup'],
        [91, 'swordGroup'],
        [94, 'bowGroup']
    ])('shows held item %i on the third-person character', (itemType, groupName) => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera();
        const player = new Player(
            scene,
            camera,
            document.createElement('canvas'),
            CONFIG,
            createCharacterProfile()
        );

        player.setCameraMode('third');
        player.updateHeldItem(itemType);
        player.updateSword(0.016);

        const heldGroup = player[groupName];
        expect(heldGroup.parent).toBe(player.characterGroup.rig.rightArmPivot);
        expect(heldGroup.visible).toBe(true);
    });
});
