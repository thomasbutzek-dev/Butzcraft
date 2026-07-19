import * as THREE from 'three';

const MAX_LIFETIME_SECONDS = 4;
const STEP_DISTANCE = 0.25;

export class PlayerArrowProjectile {
    constructor(scene, startPosition, direction, damage) {
        this.scene = scene;
        this.direction = direction.clone().normalize();
        this.damage = damage;
        this.speed = 28;
        this.age = 0;
        this.isDead = false;
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.05, 0.8),
            new THREE.MeshPhongMaterial({ color: 0x8B6B3D })
        );
        this.mesh.position.copy(startPosition);
        this.mesh.lookAt(startPosition.clone().add(this.direction));
        this._step = new THREE.Vector3();
        this._target = new THREE.Vector3();
        scene.add(this.mesh);
    }

    dispose() {
        if (!this.mesh) return;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh = null;
        this.isDead = true;
    }

    update(delta, world, mobs) {
        if (this.isDead) return;
        this.age += delta;
        if (this.age >= MAX_LIFETIME_SECONDS) {
            this.dispose();
            return;
        }

        const distance = this.speed * delta;
        const steps = Math.max(1, Math.ceil(distance / STEP_DISTANCE));
        this._step.copy(this.direction).multiplyScalar(distance / steps);
        for (let step = 0; step < steps; step++) {
            this.mesh.position.add(this._step);

            const block = world.getBlock(
                Math.floor(this.mesh.position.x),
                Math.floor(this.mesh.position.y),
                Math.floor(this.mesh.position.z)
            );
            if (block !== 0 && block !== 4 && block !== 8) {
                this.dispose();
                return;
            }

            for (const mob of mobs) {
                if (!mob || mob.isDead || !mob.mesh) continue;
                mob.mesh.getWorldPosition(this._target);
                this._target.y += 0.8;
                if (this.mesh.position.distanceToSquared(this._target) > 1) continue;
                mob.takeDamage(this.damage);
                this.dispose();
                return;
            }
        }
    }
}
