/* js/npc.js — Butzcraft NPC-System (Tier 3: NPC-Dorf)
 *
 * NPC-Klasse mit:
 *   - Voxel-Humanoid-Mesh (braune Kleidung, unterschiedliche Farben)
 *   - Einfache Wander-AI um Home-Position
 *   - Handels-Angebote pro NPC (deterministisch aus Position)
 *   - Rechtsklick → Trade-UI
 *
 * Integration: GameMain.js verwaltet Array<NPC>, update() pro Frame.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { Physics } from './Physics.js?v=20260717a';
import { getPainterlyEntityTexture, selectEntityTextureVariant } from './entityMaterials.js?v=20260719a';

const NPC_CFG = CONFIG.NPC;
const NAME_TAG_VISIBLE_DISTANCE = 8;
const NAME_TAG_FADE_DISTANCE = 5;
const NPC_HALF_WIDTH = 0.28;
const NPC_FEET_OFFSET = 0.05;
const NPC_HEAD_OFFSET = 1.85;
const WATER_BLOCKS = new Set([4]);
const VILLAGER_SKIN_TILE = 11;
const PROFESSION_TEXTURE_TILES = [12, 13, 14, 15];

// NPC-Typen mit unterschiedlichen Farben und Handels-Angeboten
const NPC_PROFESSIONS = [
    {
        name: 'Schmied',
        color: 0x555555,
        apronColor: 0x8B4513,
        quest: { give: { type: 60, count: 12 }, receive: { type: 61, count: 2 } },
        trades: [
            { give: { type: 60, count: 10 }, receive: { type: 61, count: 1 } },  // 10 Kohle → 1 Eisen-Barren
            { give: { type: 57, count: 5 },  receive: { type: 65, count: 1 } },  // 5 Eisen-Erz → 1 Eisen-Spitzhacke
            { give: { type: 62, count: 3 },  receive: { type: 66, count: 1 } },  // 3 Gold-Barren → 1 Gold-Spitzhacke
        ]
    },
    {
        name: 'Bauer',
        color: 0x8B6914,
        apronColor: 0x228B22,
        quest: { give: { type: 51, count: 12 }, receive: { type: 88, count: 3 } },
        trades: [
            { give: { type: 51, count: 8 },  receive: { type: 22, count: 2 } },  // 8 Beeren → 2 Fleisch
            { give: { type: 5, count: 10 },  receive: { type: 26, count: 20 } }, // 10 Holz → 20 Planken
            { give: { type: 27, count: 16 }, receive: { type: 88, count: 4 } },  // 16 Stöcke → 4 Strohballen
        ]
    },
    {
        name: 'Händler',
        color: 0x4169E1,
        apronColor: 0xFFD700,
        quest: { give: { type: 62, count: 2 }, receive: { type: 65, count: 1 } },
        trades: [
            { give: { type: 62, count: 1 },  receive: { type: 19, count: 8 } },  // 1 Gold-Barren → 8 Wolle
            { give: { type: 61, count: 2 },  receive: { type: 32, count: 4 } },  // 2 Eisen-Barren → 4 Fenster
            { give: { type: 60, count: 15 }, receive: { type: 58, count: 1 } },  // 15 Kohle → 1 Gold-Erz
        ]
    },
    {
        name: 'Bibliothekar',
        color: 0xF5F5DC,
        apronColor: 0x800020,
        quest: { give: { type: 31, count: 6 }, receive: { type: 82, count: 4 } },
        trades: [
            { give: { type: 26, count: 20 }, receive: { type: 29, count: 10 } }, // 20 Planken → 10 Steinziegel
            { give: { type: 31, count: 5 },  receive: { type: 82, count: 3 } },  // 5 Knochen → 3 Gravierter Sandstein
            { give: { type: 3, count: 30 },  receive: { type: 61, count: 2 } },  // 30 Stein → 2 Eisen-Barren
        ]
    }
];

export class NPC {
    /**
     * @param {THREE.Scene} scene
     * @param {number} x — Welt-X
     * @param {number} y — Welt-Y (Fußposition)
     * @param {number} z — Welt-Z
     * @param {number} professionIdx — Index in NPC_PROFESSIONS
     */
    constructor(scene, x, y, z, professionIdx) {
        this.scene = scene;
        this.homeX = x;
        this.homeY = y;
        this.homeZ = z;
        this.professionIdx = professionIdx % NPC_PROFESSIONS.length;
        this.profession = NPC_PROFESSIONS[this.professionIdx];
        this.visualVariant = selectEntityTextureVariant(x, z, this.professionIdx + 31);

        this.isDead = false;
        this.health = 20;
        this.velocity = new THREE.Vector3();

        // Wander-AI
        this.targetX = x;
        this.targetZ = z;
        this.wanderTimer = 2 + Math.random() * 5;

        // Mesh bauen
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this._buildMesh();
        scene.add(this.group);

        // Walk-Animation
        this.walkTime = 0;
        this.isWalking = false;
    }

    _buildMesh() {
        const prof = this.profession;
        const createMaterial = (color, tile, fallbackColor = color) => {
            const texture = getPainterlyEntityTexture(tile, this.visualVariant);
            return new THREE.MeshPhongMaterial({ color: texture ? color : fallbackColor, map: texture });
        };
        const professionTile = PROFESSION_TEXTURE_TILES[this.professionIdx];
        const bodyMat = createMaterial(0xffffff, professionTile, prof.color);
        const skinMat = createMaterial(0xffffff, VILLAGER_SKIN_TILE, 0xFFD5B8);
        const apronMat = createMaterial(prof.apronColor, professionTile);

        // Kopf (0.5×0.5×0.5)
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
        head.position.set(0, 1.55, 0);
        head.castShadow = true;
        this.group.add(head);

        // Augen
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x332211 });
        const eyeGeo = new THREE.BoxGeometry(0.08, 0.06, 0.05);
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.12, 1.58, 0.26);
        this.group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.12, 1.58, 0.26);
        this.group.add(rightEye);

        // Nase
        const noseMat = new THREE.MeshPhongMaterial({ color: 0xDDAA88 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.15), noseMat);
        nose.position.set(0, 1.50, 0.30);
        this.group.add(nose);

        // Körper (0.5×0.75×0.3)
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.35), bodyMat);
        body.position.set(0, 1.0, 0);
        this.group.add(body);

        // Schürze/Akzent
        const apron = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.36), apronMat);
        apron.position.set(0, 0.85, 0.01);
        this.group.add(apron);

        // Arme
        this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.25), bodyMat);
        this.leftArm.position.set(-0.35, 1.0, 0);
        this.group.add(this.leftArm);

        this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.25), bodyMat);
        this.rightArm.position.set(0.35, 1.0, 0);
        this.group.add(this.rightArm);

        // Beine
        const legMat = createMaterial(0x5b4639, professionTile);
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), legMat);
        this.leftLeg.position.set(-0.13, 0.3, 0);
        this.group.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), legMat);
        this.rightLeg.position.set(0.13, 0.3, 0);
        this.group.add(this.rightLeg);

        // Namens-Schild über dem Kopf
        this._createNameTag(prof.name);

        this.mesh = this.group; // Für Raycasting
    }

    _createNameTag(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(text, 128, 42);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 0.4, 1);
        sprite.position.set(0, 2.1, 0);
        sprite.visible = false;
        this.nameTag = sprite;
        this.group.add(sprite);
    }

    _updateNameTag(playerPos) {
        if (!this.nameTag || !playerPos) return;
        const pos = this.group.position;
        const dx = pos.x - playerPos.x;
        const dy = pos.y - playerPos.y;
        const dz = pos.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const visible = dist <= NAME_TAG_VISIBLE_DISTANCE;
        this.nameTag.visible = visible;
        if (!visible) return;

        const fadeRange = Math.max(0.1, NAME_TAG_VISIBLE_DISTANCE - NAME_TAG_FADE_DISTANCE);
        const opacity = Math.max(0, Math.min(1, (NAME_TAG_VISIBLE_DISTANCE - dist) / fadeRange));
        this.nameTag.material.opacity = 0.35 + opacity * 0.65;
    }

    _getFootprintColumns(x, z) {
        const minX = Math.floor(x - NPC_HALF_WIDTH);
        const maxX = Math.floor(x + NPC_HALF_WIDTH);
        const minZ = Math.floor(z - NPC_HALF_WIDTH);
        const maxZ = Math.floor(z + NPC_HALF_WIDTH);
        const columns = [];
        for (let bx = minX; bx <= maxX; bx++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                columns.push([bx, bz]);
            }
        }
        return columns;
    }

    _isDrySolidFloor(world, x, y, z) {
        const block = world.getBlock(x, y, z);
        if (WATER_BLOCKS.has(block)) return false;
        return Physics.isSolid(world, x, y, z, false);
    }

    _hasDryStandSpace(world, x, footY, z) {
        for (const [bx, bz] of this._getFootprintColumns(x, z)) {
            const floorY = footY - 1;
            if (!this._isDrySolidFloor(world, bx, floorY, bz)) return false;

            for (let y = Math.floor(footY + NPC_FEET_OFFSET); y <= Math.floor(footY + NPC_HEAD_OFFSET); y++) {
                if (Physics.isSolid(world, bx, y, bz, true)) return false;
                if (WATER_BLOCKS.has(world.getBlock(bx, y, bz))) return false;
            }
        }
        return true;
    }

    _findNearestFootY(world, x, z, fromY) {
        const startY = Math.min(62, Math.floor(fromY + 3));
        const endY = Math.max(1, Math.floor(fromY - 8));

        for (let footY = startY + 1; footY >= endY + 1; footY--) {
            if (this._hasDryStandSpace(world, x, footY, z)) return footY;
        }

        return null;
    }

    _findSafeHomeFootY(world) {
        const homeFootY = this._findNearestFootY(world, this.homeX, this.homeZ, this.homeY);
        if (homeFootY !== null) return homeFootY;
        return this._findNearestFootY(world, this.homeX, this.homeZ, this.group.position.y);
    }

    _resolveGround(world, force = false) {
        const pos = this.group.position;
        const footY = this._findNearestFootY(world, pos.x, pos.z, pos.y);
        if (footY === null) {
            const safeHomeY = this._findSafeHomeFootY(world);
            if (safeHomeY !== null) {
                pos.set(this.homeX, safeHomeY, this.homeZ);
                this.homeY = safeHomeY;
                this.targetX = this.homeX;
                this.targetZ = this.homeZ;
                this.velocity.set(0, 0, 0);
                return true;
            }
            return false;
        }

        const stuck = Physics.checkAABBCollision(world, pos, NPC_HALF_WIDTH, NPC_FEET_OFFSET, NPC_HEAD_OFFSET, true);
        const closeEnough = Math.abs(pos.y - footY) <= 1.25;
        const fallingOntoGround = this.velocity.y <= 0 && pos.y <= footY + 0.05;

        if (force || stuck || closeEnough || fallingOntoGround) {
            pos.y = footY;
            this.velocity.y = 0;
            return true;
        }

        return false;
    }

    _pickWanderTarget() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * NPC_CFG.WANDER_RADIUS;
        this.targetX = this.homeX + Math.cos(angle) * dist;
        this.targetZ = this.homeZ + Math.sin(angle) * dist;
        this.wanderTimer = NPC_CFG.WANDER_INTERVAL_MIN + Math.random() * (NPC_CFG.WANDER_INTERVAL_MAX - NPC_CFG.WANDER_INTERVAL_MIN);
    }

    /**
     * Update pro Frame.
     * @param {number} delta — Sekunden
     * @param {THREE.Vector3} playerPos
     * @param {import('./world.js').World} world
     */
    update(delta, playerPos, world) {
        if (this.isDead) return;
        this._updateNameTag(playerPos);

        const pos = this.group.position;
        this._resolveGround(world, true);

        // Wander-Timer
        this.wanderTimer -= delta;
        if (this.wanderTimer <= 0) {
            this._pickWanderTarget();
        }

        // Bewegung zum Ziel
        const dx = this.targetX - pos.x;
        const dz = this.targetZ - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const checkNpcCollision = (np) => Physics.checkAABBCollision(world, np, NPC_HALF_WIDTH, NPC_FEET_OFFSET, NPC_HEAD_OFFSET, true);
        const canStandAt = (x, z) => this._findNearestFootY(world, x, z, pos.y) !== null;

        if (dist > 0.5) {
            const speed = NPC_CFG.WANDER_SPEED * delta;
            const nx = dx / dist, nz = dz / dist;
            const nextX = pos.x + nx * speed;
            const nextZ = pos.z + nz * speed;
            let moved = false;

            if (canStandAt(nextX, pos.z) && !checkNpcCollision({ x: nextX, y: pos.y, z: pos.z })) {
                pos.x = nextX;
                moved = true;
            }
            if (canStandAt(pos.x, nextZ) && !checkNpcCollision({ x: pos.x, y: pos.y, z: nextZ })) {
                pos.z = nextZ;
                moved = true;
            }
            this.isWalking = moved;

            if (!moved) {
                this.velocity.x = 0;
                this.velocity.z = 0;
                this._pickWanderTarget();
            }

            // Blickrichtung
            this.group.rotation.y = Math.atan2(nx, nz);
        } else {
            this.isWalking = false;
        }

        const groundY = this._findNearestFootY(world, pos.x, pos.z, pos.y);
        if (groundY === null || pos.y > groundY + 0.05) {
            this.velocity.y -= 9.8 * delta;
        }
        pos.y += this.velocity.y * delta;
        this._resolveGround(world);

        // Walk-Animation
        if (this.isWalking) {
            this.walkTime += delta * 8;
            const swing = Math.sin(this.walkTime) * 0.4;
            if (this.leftArm) this.leftArm.rotation.x = swing;
            if (this.rightArm) this.rightArm.rotation.x = -swing;
            if (this.leftLeg) this.leftLeg.rotation.x = -swing;
            if (this.rightLeg) this.rightLeg.rotation.x = swing;
        } else {
            if (this.leftArm) this.leftArm.rotation.x = 0;
            if (this.rightArm) this.rightArm.rotation.x = 0;
            if (this.leftLeg) this.leftLeg.rotation.x = 0;
            if (this.rightLeg) this.rightLeg.rotation.x = 0;
        }

        // Void-Schutz
        if (pos.y < 0) {
            pos.set(this.homeX, this.homeY, this.homeZ);
            this.velocity.set(0, 0, 0);
        }
    }

    /**
     * Schaden nehmen
     */
    takeDamage(amount) {
        this.health -= amount;
        // Rote Flash-Animation
        this.group.children.forEach(child => {
            if (child.material && child.material.color) {
                const origColor = child.material.color.getHex();
                child.material.color.set(0xFF0000);
                setTimeout(() => child.material.color.set(origColor), 150);
            }
        });

        if (this.health <= 0) {
            this.isDead = true;
        }
    }

    /**
     * Serialisierung für Save
     */
    serialize() {
        return {
            x: this.group.position.x,
            y: this.group.position.y,
            z: this.group.position.z,
            homeX: this.homeX,
            homeY: this.homeY,
            homeZ: this.homeZ,
            professionIdx: this.professionIdx,
            health: this.health,
            isDead: this.isDead
        };
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }
}

// Export für Trade-System
export { NPC_PROFESSIONS };
