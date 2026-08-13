import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
    DEEP_GUARDIAN_HEALTH,
    SEAL_KEEPER_HEALTH,
    DeepGuardian,
    SealKeeper
} from '../js/structureBosses.js';

describe('deep guardian', () => {
    it('uses armor until its slam exposes the core', () => {
        const onDamage = vi.fn();
        const boss = new DeepGuardian(new THREE.Scene(), new THREE.Vector3());

        boss.takeDamage(20);
        expect(boss.health).toBe(DEEP_GUARDIAN_HEALTH - 9);

        boss.slamCharge = 0.01;
        boss.update(0.02, new THREE.Vector3(1, 0, 0), null, onDamage);
        boss.takeDamage(20);

        expect(onDamage).toHaveBeenCalledWith(10);
        expect(boss.health).toBe(DEEP_GUARDIAN_HEALTH - 29);
        expect(boss.rockfalls).toHaveLength(2);
    });
});

describe('seal keeper', () => {
    it('absorbs hits with visible rune charges before taking damage', () => {
        const onDefeated = vi.fn();
        const boss = new SealKeeper(new THREE.Scene(), new THREE.Vector3(), { onDefeated });

        boss.takeDamage(10);
        boss.takeDamage(10);
        expect(boss.health).toBe(SEAL_KEEPER_HEALTH);
        expect(boss.runeCharges).toBe(0);

        boss.takeDamage(10);
        boss.rangedCooldown = 0;
        boss.update(0.1, new THREE.Vector3(8, 0, 0), null, vi.fn());

        expect(boss.health).toBe(SEAL_KEEPER_HEALTH - 10);
        expect(boss.bolts).toHaveLength(1);

        boss.takeDamage(SEAL_KEEPER_HEALTH);
        boss.takeDamage(1);
        expect(onDefeated).toHaveBeenCalledOnce();
    });
});
