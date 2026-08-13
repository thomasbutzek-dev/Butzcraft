import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
    BLOOD_MOON_BOSS_HEALTH,
    BLOOD_MOON_ECHO_HEALTH,
    BloodMoonBoss,
    getBloodMoonBossPhase
} from '../js/bloodMoonBoss.js';

describe('blood moon boss', () => {
    it('uses fixed story and echo difficulty', () => {
        expect(new BloodMoonBoss(new THREE.Scene(), new THREE.Vector3()).maxHealth).toBe(BLOOD_MOON_BOSS_HEALTH);
        expect(new BloodMoonBoss(new THREE.Scene(), new THREE.Vector3(), { echo: true }).maxHealth).toBe(BLOOD_MOON_ECHO_HEALTH);
    });

    it('changes phases at fixed health thresholds', () => {
        expect(getBloodMoonBossPhase(160, 160)).toBe(1);
        expect(getBloodMoonBossPhase(100, 160)).toBe(2);
        expect(getBloodMoonBossPhase(40, 160)).toBe(3);
    });

    it('summons support, damages nearby players and reports defeat once', () => {
        const onSummon = vi.fn();
        const onDefeated = vi.fn();
        const onDamage = vi.fn();
        const boss = new BloodMoonBoss(new THREE.Scene(), new THREE.Vector3(), { onSummon, onDefeated });

        boss.summonCooldown = 0;
        boss.update(0.1, new THREE.Vector3(1, 0, 0), null, onDamage);
        boss.takeDamage(BLOOD_MOON_BOSS_HEALTH);
        boss.takeDamage(1);

        expect(onSummon).toHaveBeenCalledOnce();
        expect(onDamage).toHaveBeenCalledOnce();
        expect(onDefeated).toHaveBeenCalledOnce();
        expect(boss.isDead).toBe(true);
    });

    it('uses the approved textured armor rig in the live boss class', () => {
        const boss = new BloodMoonBoss(new THREE.Scene(), new THREE.Vector3());
        const texturedMeshes = [];
        boss.group.traverse(object => {
            if (object.isMesh && object.material?.map) texturedMeshes.push(object);
        });

        expect(boss.modelRoot).toBeInstanceOf(THREE.Group);
        expect(boss.head).toBeInstanceOf(THREE.Group);
        expect(boss.arms.left).toBeInstanceOf(THREE.Group);
        expect(boss.arms.right).toBeInstanceOf(THREE.Group);
        expect(boss.core).toBeInstanceOf(THREE.Mesh);
        expect(texturedMeshes.length).toBeGreaterThan(20);
    });

    it('builds a fractured echo and shows its summoning pose', () => {
        const onSummon = vi.fn();
        const echo = new BloodMoonBoss(new THREE.Scene(), new THREE.Vector3(), { echo: true, onSummon });

        expect(echo.fractureParts.length).toBeGreaterThan(8);
        echo.summonCooldown = 0;
        echo.update(0.1, new THREE.Vector3(8, 0, 0), null, vi.fn());
        echo.update(0.6, new THREE.Vector3(8, 0, 0), null, vi.fn());

        expect(onSummon).toHaveBeenCalledOnce();
        expect(echo.summonRing.visible).toBe(true);
        expect(Math.abs(echo.arms.left.rotation.z)).toBeGreaterThan(1);
        expect(Math.abs(echo.arms.right.rotation.z)).toBeGreaterThan(1);
    });
});
