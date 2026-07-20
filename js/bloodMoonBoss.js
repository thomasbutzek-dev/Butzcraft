import * as THREE from 'three';

export const BLOOD_MOON_BOSS_HEALTH = 160;
export const BLOOD_MOON_ECHO_HEALTH = 220;

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
        this.maxHealth = echo ? BLOOD_MOON_ECHO_HEALTH : BLOOD_MOON_BOSS_HEALTH;
        this.health = this.maxHealth;
        this.isBoss = true;
        this.hitHeight = 2.2;
        this.hitRadiusSquared = 2.25;
        this.isDead = false;
        this.isPenned = false;
        this.onDefeated = onDefeated;
        this.onSummon = onSummon;
        this.attackCooldown = 0;
        this.summonCooldown = 8;
        this.elapsed = 0;
        this.anchor = new THREE.Vector3(position.x, position.y, position.z);
        this.group = new THREE.Group();
        this.mesh = this.group;
        this._buildModel();
        this.group.position.copy(this.anchor);
        this.scene.add(this.group);
    }

    _buildModel() {
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: this.echo ? 0x8f1438 : 0x5e0b18, emissive: 0x260006 });
        const armorMaterial = new THREE.MeshPhongMaterial({ color: 0x181017, emissive: 0x120006 });
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff304f });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 1.2), bodyMaterial);
        body.position.y = 1.8;
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 1.1), armorMaterial);
        head.position.y = 3.45;
        const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.05), eyeMaterial);
        leftEye.position.set(-0.32, 3.5, -0.57);
        const rightEye = leftEye.clone();
        rightEye.position.x = 0.32;
        const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 4), armorMaterial);
        leftHorn.position.set(-0.55, 4.35, 0);
        leftHorn.rotation.z = -0.35;
        const rightHorn = leftHorn.clone();
        rightHorn.position.x = 0.55;
        rightHorn.rotation.z = 0.35;
        this.group.add(body, head, leftEye, rightEye, leftHorn, rightHorn);
    }

    update(delta, playerPosition, world, onDamage) {
        if (this.isDead || !playerPosition) return;
        this.elapsed += delta;
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);
        this.summonCooldown -= delta;
        const dx = playerPosition.x - this.group.position.x;
        const dz = playerPosition.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);
        const phase = getBloodMoonBossPhase(this.health, this.maxHealth);
        if (distance > 1.8 && distance < 34) {
            const speed = 1.35 + phase * 0.35;
            const step = Math.min(distance - 1.8, speed * delta);
            this.group.position.x += dx / distance * step;
            this.group.position.z += dz / distance * step;
            this.group.lookAt(playerPosition.x, this.group.position.y + 2, playerPosition.z);
        }
        this.group.position.y = this.anchor.y + Math.sin(this.elapsed * 2.2) * 0.12;
        if (distance < 2.6 && this.attackCooldown <= 0) {
            onDamage?.(6 + phase * 2);
            this.attackCooldown = Math.max(0.65, 1.25 - phase * 0.15);
        }
        if (this.summonCooldown <= 0 && distance < 28) {
            this.onSummon?.(this.group.position, phase);
            this.summonCooldown = Math.max(7, 14 - phase * 2);
        }
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
        this.group.traverse(object => {
            object.geometry?.dispose?.();
            if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
            else object.material?.dispose?.();
        });
    }
}
