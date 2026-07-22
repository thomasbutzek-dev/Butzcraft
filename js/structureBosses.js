import * as THREE from 'three';

export const DEEP_GUARDIAN_HEALTH = 120;
export const SEAL_KEEPER_HEALTH = 100;

const DEEP_GUARDIAN_TEXTURE_URL = new URL('../assets/generated/deep-guardian-stone-v1.webp', import.meta.url).href;
const SEAL_KEEPER_TEXTURE_URL = new URL('../assets/generated/seal-keeper-armor-v1.webp', import.meta.url).href;
const textureCache = new Map();

function getBossTexture(url) {
    if (textureCache.has(url)) return textureCache.get(url);
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 1.5);
    texture.anisotropy = 4;
    textureCache.set(url, texture);
    return texture;
}

function createAura(color, count, radius, height) {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
        const angle = index * 2.39996;
        const spread = radius * (0.35 + (index % 7) / 9);
        positions[index * 3] = Math.cos(angle) * spread;
        positions[index * 3 + 1] = 0.2 + (index * 0.618 % 1) * height;
        positions[index * 3 + 2] = Math.sin(angle) * spread;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
        color,
        size: 0.09,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    return new THREE.Points(geometry, material);
}

function getPhase(health, maxHealth) {
    const ratio = Math.max(0, health) / Math.max(1, maxHealth);
    if (ratio <= 0.33) return 3;
    if (ratio <= 0.66) return 2;
    return 1;
}

function disposeGroup(scene, group) {
    scene.remove(group);
    group.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
        else object.material?.dispose?.();
    });
}

export class DeepGuardian {
    constructor(scene, position, { onDefeated = null } = {}) {
        this.scene = scene;
        this.type = 'deepGuardian';
        this.displayName = 'Tiefenwächter';
        this.maxHealth = DEEP_GUARDIAN_HEALTH;
        this.health = this.maxHealth;
        this.isBoss = true;
        this.isDead = false;
        this.isPenned = false;
        this.hitHeight = 2.4;
        this.hitRadiusSquared = 3.25;
        this.onDefeated = onDefeated;
        this.attackCooldown = 0;
        this.slamCooldown = 2;
        this.slamCharge = 0;
        this.vulnerableTimer = 0;
        this.elapsed = 0;
        this.rockfalls = [];
        this.anchorY = position.y;
        this.group = new THREE.Group();
        this.mesh = this.group;
        this._buildModel();
        this.group.position.copy(position);
        this.scene.add(this.group);
    }

    _buildModel() {
        const texture = getBossTexture(DEEP_GUARDIAN_TEXTURE_URL);
        const stone = new THREE.MeshStandardMaterial({ map: texture, color: 0x87939a, roughness: 0.92, metalness: 0.08 });
        const darkStone = new THREE.MeshStandardMaterial({ map: texture, color: 0x30373c, roughness: 1 });
        const crystal = new THREE.MeshStandardMaterial({
            color: 0x4ddfff,
            emissive: 0x087c9c,
            emissiveIntensity: 2.8,
            roughness: 0.2,
            metalness: 0.3
        });
        const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x020608 });
        this.rockMaterial = stone;
        this.modelRoot = new THREE.Group();
        this.group.add(this.modelRoot);

        const pelvis = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 0), darkStone);
        pelvis.scale.set(1.15, 0.75, 0.85);
        pelvis.position.y = 1.05;
        const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 1), stone);
        torso.scale.set(1.15, 1.25, 0.78);
        torso.position.y = 2.25;
        this.modelRoot.add(pelvis, torso);

        for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 1.1, 5), darkStone);
            leg.position.set(side * 0.63, 0.5, 0);
            leg.rotation.z = side * 0.08;
            const foot = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), stone);
            foot.scale.set(1, 0.55, 1.35);
            foot.position.set(side * 0.68, 0.08, 0.25);
            this.modelRoot.add(leg, foot);
        }

        this.leftArm = new THREE.Group();
        this.rightArm = new THREE.Group();
        for (const [side, arm] of [[-1, this.leftArm], [1, this.rightArm]]) {
            arm.position.set(side * 1.25, 2.65, 0);
            const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), stone);
            shoulder.scale.set(1.25, 0.85, 1);
            const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.25, 5), darkStone);
            upperArm.position.set(side * 0.28, -0.7, 0);
            upperArm.rotation.z = side * 0.18;
            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, 1.15, 5), stone);
            forearm.position.set(side * 0.43, -1.65, 0.05);
            forearm.rotation.z = side * 0.12;
            const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), darkStone);
            fist.scale.set(1, 0.85, 1.15);
            fist.position.set(side * 0.5, -2.28, 0.15);
            arm.add(shoulder, upperArm, forearm, fist);
            this.modelRoot.add(arm);
        }

        this.head = new THREE.Group();
        this.head.position.set(0, 3.72, 0.05);
        const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), darkStone);
        skull.scale.set(1.15, 0.92, 0.88);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.22, 0.32), stone);
        brow.position.set(0, 0.1, 0.62);
        brow.rotation.x = -0.15;
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.34, 0.62), stone);
        jaw.position.set(0, -0.55, 0.2);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.05), voidMaterial);
        mouth.position.set(0, -0.56, 0.53);
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), crystal);
        leftEye.scale.set(1.5, 0.55, 0.55);
        leftEye.position.set(-0.3, -0.02, 0.69);
        const rightEye = leftEye.clone();
        rightEye.position.x = 0.3;
        this.head.add(skull, brow, jaw, mouth, leftEye, rightEye);
        this.modelRoot.add(this.head);

        for (const side of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.05, 5), darkStone);
            horn.position.set(side * 0.62, 0.55, -0.05);
            horn.rotation.z = side * -0.58;
            horn.rotation.x = -0.18;
            this.head.add(horn);
        }
        for (const [x, y, scale] of [[-0.7, 2.55, 0.75], [0, 2.9, 1], [0.7, 2.55, 0.75]]) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2 * scale, 0.9 * scale, 5), darkStone);
            spike.position.set(x, y, -0.82);
            spike.rotation.x = -Math.PI / 2;
            this.modelRoot.add(spike);
        }

        this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), crystal);
        this.core.position.set(0, 2.2, 1.08);
        const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.11, 8, 20), darkStone);
        coreRing.position.copy(this.core.position);
        this.coreLight = new THREE.PointLight(0x39dfff, 7, 5);
        this.coreLight.position.set(0, 2.2, 1.25);
        this.aura = createAura(0x41dfff, 42, 1.9, 3.8);
        this.modelRoot.add(this.core, coreRing, this.coreLight, this.aura);
    }

    _animateVisuals(phase) {
        const pulse = 1 + Math.sin(this.elapsed * (3.5 + phase)) * 0.12;
        this.core.scale.setScalar(pulse);
        this.core.rotation.x += 0.015 * phase;
        this.core.rotation.y += 0.025 * phase;
        this.coreLight.intensity = 6 + phase * 1.5 + Math.sin(this.elapsed * 6) * 1.5;
        this.aura.rotation.y -= 0.006 * phase;
        this.aura.material.opacity = 0.48 + Math.sin(this.elapsed * 2.8) * 0.18;
        this.head.rotation.y = Math.sin(this.elapsed * 0.75) * 0.12;
        if (this.slamCharge > 0) {
            this.leftArm.rotation.x = -1.35;
            this.rightArm.rotation.x = -1.35;
            this.modelRoot.position.y = Math.sin(this.elapsed * 24) * 0.05;
        } else {
            this.leftArm.rotation.x = Math.sin(this.elapsed * 1.5) * 0.08;
            this.rightArm.rotation.x = -Math.sin(this.elapsed * 1.5) * 0.08;
            this.modelRoot.position.y *= 0.8;
        }
    }

    _startRockfall(playerPosition, phase) {
        for (let index = 0; index < phase + 1; index++) {
            const angle = this.elapsed * 1.7 + index * Math.PI * 2 / (phase + 1);
            const radius = index === 0 ? 0 : 1.7;
            const target = new THREE.Vector3(
                playerPosition.x + Math.cos(angle) * radius,
                playerPosition.y,
                playerPosition.z + Math.sin(angle) * radius
            );
            const mesh = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.52 + index * 0.05, 0),
                this.rockMaterial.clone()
            );
            mesh.position.set(target.x, target.y + 5, target.z);
            this.scene.add(mesh);
            this.rockfalls.push({ mesh, target, delay: 0.35 + index * 0.12 });
        }
    }

    _updateRockfalls(delta, playerPosition, onDamage, phase) {
        for (let index = this.rockfalls.length - 1; index >= 0; index--) {
            const rock = this.rockfalls[index];
            rock.delay -= delta;
            rock.mesh.rotation.x += delta * 3;
            rock.mesh.rotation.z += delta * 2;
            if (rock.delay > 0) continue;
            rock.mesh.position.y -= delta * 11;
            if (rock.mesh.position.y > rock.target.y) continue;
            if (Math.hypot(playerPosition.x - rock.target.x, playerPosition.z - rock.target.z) < 1.35) {
                onDamage?.(4 + phase * 2);
            }
            this.scene.remove(rock.mesh);
            rock.mesh.geometry.dispose();
            rock.mesh.material.dispose();
            this.rockfalls.splice(index, 1);
        }
    }

    update(delta, playerPosition, world, onDamage) {
        if (this.isDead || !playerPosition) return;
        this.elapsed += delta;
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);
        this.slamCooldown -= delta;
        this.vulnerableTimer = Math.max(0, this.vulnerableTimer - delta);
        const phase = getPhase(this.health, this.maxHealth);
        this._animateVisuals(phase);
        this._updateRockfalls(delta, playerPosition, onDamage, phase);
        const dx = playerPosition.x - this.group.position.x;
        const dz = playerPosition.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);

        if (this.slamCharge > 0) {
            this.slamCharge -= delta;
            if (this.slamCharge <= 0) {
                if (distance < 4.5) onDamage?.(8 + phase * 2);
                this._startRockfall(playerPosition, phase);
                this.vulnerableTimer = 2.2;
                this.slamCooldown = Math.max(2.8, 4.3 - phase * 0.4);
            }
            return;
        }

        if (this.slamCooldown <= 0 && distance < 7) {
            this.slamCharge = 0.75;
            return;
        }
        if (distance > 2.2 && distance < 28) {
            const step = Math.min(distance - 2.2, (0.65 + phase * 0.18) * delta);
            this.group.position.x += dx / distance * step;
            this.group.position.z += dz / distance * step;
            this.group.lookAt(playerPosition.x, this.group.position.y + 1.5, playerPosition.z);
        }
        if (distance < 2.8 && this.attackCooldown <= 0) {
            onDamage?.(5 + phase * 2);
            this.attackCooldown = 1.25;
        }
        this.group.position.y = this.anchorY + Math.sin(this.elapsed * 1.6) * 0.025;
    }

    takeDamage(amount, onKill) {
        if (this.isDead || amount <= 0) return;
        const damage = this.vulnerableTimer > 0 ? amount : amount * 0.45;
        this.health = Math.max(0, this.health - damage);
        if (this.health > 0) return;
        this.isDead = true;
        this.onDefeated?.(this);
        onKill?.(this);
    }

    dispose() {
        for (const rock of this.rockfalls) {
            this.scene.remove(rock.mesh);
            rock.mesh.geometry.dispose();
            rock.mesh.material.dispose();
        }
        this.rockfalls.length = 0;
        disposeGroup(this.scene, this.group);
    }
}

export class SealKeeper {
    constructor(scene, position, { onDefeated = null } = {}) {
        this.scene = scene;
        this.type = 'sealKeeper';
        this.displayName = 'Siegelhüter';
        this.maxHealth = SEAL_KEEPER_HEALTH;
        this.health = this.maxHealth;
        this.isBoss = true;
        this.isDead = false;
        this.isPenned = false;
        this.hitHeight = 2.5;
        this.hitRadiusSquared = 2.25;
        this.onDefeated = onDefeated;
        this.elapsed = 0;
        this.rangedCooldown = 1;
        this.runeCooldown = 0;
        this.runeCharges = 2;
        this.anchorY = position.y;
        this.bolts = [];
        this.runes = [];
        this.group = new THREE.Group();
        this.mesh = this.group;
        this._buildModel();
        this.group.position.copy(position);
        this.scene.add(this.group);
    }

    _buildModel() {
        const texture = getBossTexture(SEAL_KEEPER_TEXTURE_URL);
        const armor = new THREE.MeshStandardMaterial({ map: texture, color: 0x66506f, roughness: 0.76, metalness: 0.28 });
        const darkArmor = new THREE.MeshStandardMaterial({ map: texture, color: 0x211426, roughness: 0.92, metalness: 0.15 });
        const bone = new THREE.MeshStandardMaterial({ map: texture, color: 0xc3aa79, roughness: 0.82, metalness: 0.06 });
        const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x030105 });
        const runeMaterial = new THREE.MeshStandardMaterial({
            color: 0xc15cff,
            emissive: 0x6d0ca5,
            emissiveIntensity: 3.5,
            roughness: 0.18,
            metalness: 0.35
        });
        this.modelRoot = new THREE.Group();
        this.group.add(this.modelRoot);

        const robe = new THREE.Mesh(new THREE.ConeGeometry(1.12, 2.75, 7, 2, true), darkArmor);
        robe.position.y = 1.35;
        robe.rotation.y = Math.PI / 7;
        const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.82, 0), armor);
        torso.scale.set(0.9, 1.25, 0.68);
        torso.position.y = 2.35;
        this.modelRoot.add(robe, torso);
        for (let index = 0; index < 7; index++) {
            const angle = index * Math.PI * 2 / 7;
            const strip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.45, 4, 1, true), darkArmor);
            strip.position.set(Math.cos(angle) * 0.72, 0.43, Math.sin(angle) * 0.72);
            strip.rotation.z = Math.cos(angle) * 0.16;
            strip.rotation.x = Math.sin(angle) * 0.16;
            this.modelRoot.add(strip);
        }

        for (let index = 0; index < 4; index++) {
            const leftRib = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.13), bone);
            leftRib.position.set(-0.34, 2.65 - index * 0.23, 0.61);
            leftRib.rotation.z = -0.24 - index * 0.04;
            const rightRib = leftRib.clone();
            rightRib.position.x = 0.34;
            rightRib.rotation.z *= -1;
            this.modelRoot.add(leftRib, rightRib);
        }
        const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.95, 0.14), bone);
        sternum.position.set(0, 2.28, 0.65);
        this.modelRoot.add(sternum);

        this.skull = new THREE.Group();
        this.skull.position.set(0, 3.55, 0.06);
        const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 1), bone);
        cranium.scale.set(0.82, 1.12, 0.78);
        const cheekLeft = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.55, 4), bone);
        cheekLeft.position.set(-0.28, -0.45, 0.28);
        cheekLeft.rotation.z = -0.25;
        const cheekRight = cheekLeft.clone();
        cheekRight.position.x = 0.28;
        cheekRight.rotation.z = 0.25;
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.48), bone);
        jaw.position.set(0, -0.66, 0.1);
        const socketLeft = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), voidMaterial);
        socketLeft.scale.set(1, 0.75, 0.45);
        socketLeft.position.set(-0.22, 0.06, 0.53);
        const socketRight = socketLeft.clone();
        socketRight.position.x = 0.22;
        const eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), runeMaterial);
        eyeLeft.position.set(-0.22, 0.06, 0.62);
        const eyeRight = eyeLeft.clone();
        eyeRight.position.x = 0.22;
        this.skull.add(cranium, cheekLeft, cheekRight, jaw, socketLeft, socketRight, eyeLeft, eyeRight);
        for (const side of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.05, 5), darkArmor);
            horn.position.set(side * 0.48, 0.45, -0.04);
            horn.rotation.z = side * -0.62;
            this.skull.add(horn);
        }
        this.modelRoot.add(this.skull);

        this.leftArm = new THREE.Group();
        this.rightArm = new THREE.Group();
        for (const [side, arm] of [[-1, this.leftArm], [1, this.rightArm]]) {
            arm.position.set(side * 1.05, 2.75, 0);
            const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), armor);
            pauldron.scale.set(1.35, 0.62, 1);
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.75, 5), bone);
            spike.position.set(side * 0.42, 0.36, 0);
            spike.rotation.z = side * -0.88;
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.9, 5), bone);
            upper.position.set(side * 0.22, -0.62, 0);
            upper.rotation.z = side * 0.28;
            const elbow = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), armor);
            elbow.position.set(side * 0.36, -1.02, 0);
            const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.78, 5), bone);
            forearm.position.set(side * 0.42, -1.45, 0.12);
            forearm.rotation.z = side * 0.12;
            const hand = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), darkArmor);
            hand.position.set(side * 0.47, -1.86, 0.18);
            arm.add(pauldron, spike, upper, elbow, forearm, hand);
            for (let clawIndex = -1; clawIndex <= 1; clawIndex++) {
                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.36, 4), bone);
                claw.position.set(side * (0.48 + clawIndex * 0.05), -2.08, 0.22 + clawIndex * 0.09);
                claw.rotation.z = Math.PI;
                arm.add(claw);
            }
            this.modelRoot.add(arm);
        }

        this.staff = new THREE.Group();
        this.staff.position.set(1.72, 1.65, 0.18);
        this.staff.rotation.z = -0.09;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.4, 7), bone);
        const staffCrown = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 7, 20), armor);
        staffCrown.position.y = 1.77;
        const staffCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), runeMaterial);
        staffCrystal.position.y = 1.77;
        const staffLight = new THREE.PointLight(0xa837ff, 8, 5);
        staffLight.position.y = 1.77;
        this.staff.add(shaft, staffCrown, staffCrystal, staffLight);
        this.staffCrystal = staffCrystal;
        this.staffLight = staffLight;
        this.modelRoot.add(this.staff);

        for (let index = 0; index < 3; index++) {
            const rune = new THREE.Group();
            const outer = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 18), runeMaterial);
            const inner = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 12), runeMaterial);
            rune.add(outer, inner);
            for (let spoke = 0; spoke < 4; spoke++) {
                const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), runeMaterial);
                const angle = spoke * Math.PI / 2;
                blade.position.set(Math.cos(angle) * 0.52, Math.sin(angle) * 0.52, 0);
                blade.rotation.z = angle - Math.PI / 2;
                rune.add(blade);
            }
            this.group.add(rune);
            this.runes.push(rune);
        }
        this.eyeLight = new THREE.PointLight(0xb32fff, 6, 4);
        this.eyeLight.position.set(0, 3.55, 0.75);
        this.aura = createAura(0xa52aff, 58, 2.25, 4.3);
        this.modelRoot.add(this.eyeLight, this.aura);
        this._updateRuneVisibility();
    }

    _animateVisuals(phase) {
        const pulse = 1 + Math.sin(this.elapsed * (4 + phase)) * 0.16;
        this.staffCrystal.scale.setScalar(pulse);
        this.staffCrystal.rotation.y += 0.035 * phase;
        this.staffLight.intensity = 7 + phase * 1.5 + Math.sin(this.elapsed * 7) * 2;
        this.eyeLight.intensity = 5 + phase + Math.sin(this.elapsed * 8) * 1.4;
        this.skull.rotation.y = Math.sin(this.elapsed * 0.9) * 0.18;
        this.skull.rotation.z = Math.sin(this.elapsed * 0.55) * 0.045;
        this.leftArm.rotation.z = 0.08 + Math.sin(this.elapsed * 1.4) * 0.12;
        this.rightArm.rotation.z = -0.08 - Math.sin(this.elapsed * 1.4) * 0.12;
        this.leftArm.position.y = 2.75 + Math.sin(this.elapsed * 1.8) * 0.1;
        this.rightArm.position.y = 2.75 - Math.sin(this.elapsed * 1.8) * 0.1;
        this.staff.rotation.z = -0.09 + Math.sin(this.elapsed * 0.8) * 0.04;
        this.aura.rotation.y += 0.008 * phase;
        this.aura.material.opacity = 0.45 + Math.sin(this.elapsed * 3.2) * 0.2;
    }

    _updateRuneVisibility() {
        this.runes.forEach((rune, index) => { rune.visible = index < this.runeCharges; });
    }

    _launchBolt(playerPosition, phase) {
        const material = new THREE.MeshStandardMaterial({
            color: 0xca69ff,
            emissive: 0x7600aa,
            emissiveIntensity: 3
        });
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 0), material);
        mesh.add(new THREE.PointLight(0xb944ff, 4, 3));
        const start = this.group.position.clone().add(new THREE.Vector3(0, 1.7, 0));
        const direction = new THREE.Vector3(
            playerPosition.x - start.x,
            playerPosition.y - start.y,
            playerPosition.z - start.z
        ).normalize();
        mesh.position.copy(start);
        this.scene.add(mesh);
        this.bolts.push({ mesh, direction, age: 0, damage: 4 + phase * 2 });
    }

    _updateBolts(delta, playerPosition, onDamage) {
        for (let index = this.bolts.length - 1; index >= 0; index--) {
            const bolt = this.bolts[index];
            bolt.age += delta;
            bolt.mesh.position.addScaledVector(bolt.direction, delta * 9);
            bolt.mesh.rotation.x += delta * 5;
            bolt.mesh.rotation.y += delta * 7;
            if (bolt.mesh.position.distanceTo(playerPosition) < 1.1) {
                onDamage?.(bolt.damage);
                bolt.age = 5;
            }
            if (bolt.age <= 4) continue;
            this.scene.remove(bolt.mesh);
            bolt.mesh.geometry.dispose();
            bolt.mesh.material.dispose();
            this.bolts.splice(index, 1);
        }
    }

    update(delta, playerPosition, world, onDamage) {
        if (this.isDead || !playerPosition) return;
        this.elapsed += delta;
        this.rangedCooldown -= delta;
        const phase = getPhase(this.health, this.maxHealth);
        this._animateVisuals(phase);
        if (this.runeCharges === 0) {
            this.runeCooldown -= delta;
            if (this.runeCooldown <= 0) {
                this.runeCharges = Math.min(3, phase + 1);
                this._updateRuneVisibility();
            }
        }
        this._updateBolts(delta, playerPosition, onDamage);
        const dx = playerPosition.x - this.group.position.x;
        const dz = playerPosition.z - this.group.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.001 && distance < 30) {
            const radial = distance > 10 ? 1 : (distance < 6 ? -1 : 0);
            const speed = 1.4 + phase * 0.25;
            this.group.position.x += (dx / distance * radial - dz / distance * 0.45) * speed * delta;
            this.group.position.z += (dz / distance * radial + dx / distance * 0.45) * speed * delta;
            this.group.lookAt(playerPosition.x, this.group.position.y + 1.4, playerPosition.z);
        }
        if (distance < 24 && this.rangedCooldown <= 0) {
            this._launchBolt(playerPosition, phase);
            this.rangedCooldown = Math.max(0.75, 1.8 - phase * 0.25);
        }
        this.group.position.y = this.anchorY + Math.sin(this.elapsed * 2.4) * 0.22;
        this.runes.forEach((rune, index) => {
            const angle = this.elapsed * 1.8 + index * Math.PI * 2 / 3;
            const radius = 1.65 + phase * 0.12;
            rune.position.set(Math.cos(angle) * radius, 2.05 + Math.sin(angle * 2) * 0.35, Math.sin(angle) * radius);
            rune.rotation.y = Math.PI / 2 - angle;
            rune.rotation.z += delta * (0.8 + phase * 0.25);
            rune.scale.setScalar(1 + Math.sin(this.elapsed * 4 + index) * 0.08);
        });
    }

    takeDamage(amount, onKill) {
        if (this.isDead || amount <= 0) return;
        if (this.runeCharges > 0) {
            this.runeCharges--;
            this._updateRuneVisibility();
            if (this.runeCharges === 0) this.runeCooldown = 8;
            return;
        }
        this.health = Math.max(0, this.health - amount);
        if (this.health > 0) return;
        this.isDead = true;
        this.onDefeated?.(this);
        onKill?.(this);
    }

    dispose() {
        for (const bolt of this.bolts) {
            this.scene.remove(bolt.mesh);
            bolt.mesh.geometry.dispose();
            bolt.mesh.material.dispose();
        }
        this.bolts.length = 0;
        disposeGroup(this.scene, this.group);
    }
}
