import * as THREE from 'three';
import { createBloodMoonBossVisual } from './bloodMoonBossVisual.js';

export const BLOOD_MOON_BOSS_HEALTH = 160;
export const BLOOD_MOON_ECHO_HEALTH = 220;

const ATTACK_ANIMATION_DURATION = 0.85;
const SUMMON_ANIMATION_DURATION = 2;

function ease(value) {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
}

export function getBloodMoonBossPhase(health, maxHealth) {
    const ratio = Math.max(0, Number(health) || 0) / Math.max(1, Number(maxHealth) || 1);
    if (ratio <= 0.33) return 3;
    if (ratio <= 0.66) return 2;
    return 1;
}

export class BloodMoonBoss {
    constructor(scene, position, { echo = false, onDefeated = null, onSummon = null } = {}) {
        this.scene = scene;
        this.type = echo ? 'bloodMoonEcho' : 'bloodMoonBoss';
        this.echo = echo;
        this.displayName = echo ? 'Blutmondecho' : 'Blutmondwächter';
        this.maxHealth = echo ? BLOOD_MOON_ECHO_HEALTH : BLOOD_MOON_BOSS_HEALTH;
        this.health = this.maxHealth;
        this.isBoss = true;
        this.hitHeight = 3.4;
        this.hitRadiusSquared = 4;
        this.isDead = false;
        this.isPenned = false;
        this.onDefeated = onDefeated;
        this.onSummon = onSummon;
        this.attackCooldown = 0;
        this.summonCooldown = 8;
        this.attackAnimation = 0;
        this.summonAnimation = 0;
        this.elapsed = 0;
        this.anchor = new THREE.Vector3(position.x, position.y, position.z);
        Object.assign(this, createBloodMoonBossVisual({ echo }));
        this.mesh = this.group;
        this.group.position.copy(this.anchor);
        this.scene.add(this.group);
    }

    _resetPose() {
        this.modelRoot.position.set(0, this.visualBaseY, 0);
        this.modelRoot.rotation.set(0, 0, 0);
        this.modelRoot.scale.setScalar(1);
        this.head.rotation.set(0, 0, 0);
        this.arms.left.rotation.set(0, 0, -0.08);
        this.arms.right.rotation.set(0, 0, 0.08);
        this.legs.left.rotation.set(0, 0, 0);
        this.legs.right.rotation.set(0, 0, 0);
        this.summonRing.visible = false;
    }

    _animateVisuals(delta, phase, moving) {
        this._resetPose();
        this.head.rotation.x = Math.sin(this.elapsed * 1.6) * 0.018;
        this.head.rotation.y = Math.sin(this.elapsed * 0.72) * 0.06;
        this.core.rotation.x += delta * (0.7 + phase * 0.16);
        this.core.rotation.y += delta * (1.1 + phase * 0.2);
        const pulse = 1 + Math.sin(this.elapsed * (4.2 + phase)) * (this.echo ? 0.18 : 0.1);
        this.core.scale.setScalar(pulse);
        this.coreLight.intensity = (this.echo ? 17 : 12) + phase * 2 + Math.sin(this.elapsed * 7) * 2;

        if (this.summonAnimation > 0) {
            const progress = 1 - this.summonAnimation / SUMMON_ANIMATION_DURATION;
            const raise = Math.sin(THREE.MathUtils.clamp(progress, 0, 1) * Math.PI);
            this.arms.left.rotation.x = -0.38 * raise;
            this.arms.right.rotation.x = -0.38 * raise;
            this.arms.left.rotation.z = -2.28 * raise;
            this.arms.right.rotation.z = 2.28 * raise;
            this.head.rotation.x = -0.2 * raise;
            this.modelRoot.position.y = this.visualBaseY + raise * 0.12;
            this.summonRing.visible = true;
            this.summonRing.scale.setScalar(0.65 + progress * 1.55);
            this.summonRing.material.opacity = 0.78 * (1 - progress * 0.6);
        } else if (this.attackAnimation > 0) {
            const progress = 1 - this.attackAnimation / ATTACK_ANIMATION_DURATION;
            const windup = progress < 0.45
                ? ease(progress / 0.45)
                : 1 - ease((progress - 0.45) / 0.55);
            this.arms.right.rotation.x = -0.58 * windup;
            this.arms.right.rotation.z = 0.08 + 2.05 * windup;
            this.arms.left.rotation.x = -0.24 * windup;
            this.modelRoot.rotation.y = -0.42 * windup;
            this.modelRoot.rotation.z = 0.08 * windup;
        } else if (moving) {
            const swing = Math.sin(this.elapsed * 5.2) * 0.42;
            this.arms.left.rotation.x = swing * 0.68;
            this.arms.right.rotation.x = -swing * 0.68;
            this.legs.left.rotation.x = -swing * 0.42;
            this.legs.right.rotation.x = swing * 0.42;
            this.modelRoot.position.y = this.visualBaseY + Math.abs(Math.sin(this.elapsed * 5.2)) * 0.08;
            this.modelRoot.rotation.z = Math.sin(this.elapsed * 5.2) * 0.025;
        } else if (phase > 1) {
            this.arms.left.rotation.z = -0.14 * phase;
            this.arms.right.rotation.z = 0.14 * phase;
            this.modelRoot.scale.setScalar(1 + (phase - 1) * 0.04 + Math.sin(this.elapsed * 7) * 0.01);
            this.head.rotation.z = Math.sin(this.elapsed * 3.2) * 0.035 * phase;
        }

        this.particles.forEach((particle, index) => {
            const angle = this.elapsed * (0.65 + phase * 0.18) + index * 2.39996;
            const radius = 1.25 + index % 5 * 0.28;
            particle.position.set(
                Math.cos(angle) * radius,
                0.4 + (index * 0.51 + this.elapsed * (0.45 + phase * 0.1)) % 4.8,
                Math.sin(angle) * radius
            );
            particle.scale.setScalar(0.7 + Math.sin(this.elapsed * 4 + index) * 0.25);
        });

        if (this.echo) {
            this.echoParts.forEach((part, index) => {
                const base = part.userData.basePosition;
                const seed = part.userData.floatSeed;
                const detached = this.fracturePartSet.has(part);
                const spread = detached ? 1.9 : 1;
                part.position.set(
                    base.x + Math.sin(this.elapsed * 0.85 + seed) * 0.07 * phase * spread,
                    base.y + Math.cos(this.elapsed * 0.72 + seed) * 0.09 * phase * spread,
                    base.z + Math.sin(this.elapsed * 0.63 + seed) * 0.06 * phase * spread
                );
                if (!detached) return;
                part.rotation.copy(part.userData.baseRotation);
                part.rotation.x += this.elapsed * 0.24 * (index % 3 + 1);
                part.rotation.y += this.elapsed * 0.31 * (index % 2 ? -1 : 1);
            });
        }
    }

    update(delta, playerPosition, world, onDamage) {
        if (this.isDead || !playerPosition) return;
        this.elapsed += delta;
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);
        this.summonCooldown -= delta;
        this.attackAnimation = Math.max(0, this.attackAnimation - delta);
        this.summonAnimation = Math.max(0, this.summonAnimation - delta);
        const dx = playerPosition.x - this.group.position.x;
        const dz = playerPosition.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);
        const phase = getBloodMoonBossPhase(this.health, this.maxHealth);
        let moving = false;
        if (distance > 1.8 && distance < 34) {
            const speed = 1.35 + phase * 0.35;
            const step = Math.min(distance - 1.8, speed * delta);
            this.group.position.x += dx / distance * step;
            this.group.position.z += dz / distance * step;
            this.group.lookAt(playerPosition.x, this.group.position.y + 2, playerPosition.z);
            moving = step > 0;
        }
        this.group.position.y = this.anchor.y + (this.echo ? 0.45 + Math.sin(this.elapsed * 2.2) * 0.14 : 0);
        if (distance < 2.6 && this.attackCooldown <= 0) {
            onDamage?.(6 + phase * 2);
            this.attackCooldown = Math.max(0.65, 1.25 - phase * 0.15);
            this.attackAnimation = ATTACK_ANIMATION_DURATION;
        }
        if (this.summonCooldown <= 0 && distance < 28) {
            this.onSummon?.(this.group.position, phase);
            this.summonCooldown = Math.max(7, 14 - phase * 2);
            this.summonAnimation = SUMMON_ANIMATION_DURATION;
        }
        this._animateVisuals(delta, phase, moving);
    }

    takeDamage(amount, onKill) {
        if (this.isDead || amount <= 0) return;
        this.health = Math.max(0, this.health - amount);
        if (this.health > 0) return;
        this.isDead = true;
        this.onDefeated?.(this);
        onKill?.(this);
    }

    dispose() {
        this.scene.remove(this.group);
        const geometries = new Set();
        const materials = new Set();
        this.group.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
            else if (object.material) materials.add(object.material);
        });
        geometries.forEach(geometry => geometry.dispose?.());
        materials.forEach(material => material.dispose?.());
    }
}
