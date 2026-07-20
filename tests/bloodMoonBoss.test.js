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
});
