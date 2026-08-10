/* js/npc.js — Butzcraft NPC-System (Tier 3: NPC-Dorf)
 *
 * NPC-Klasse mit:
 *   - Voxel-Humanoid-Mesh (braune Kleidung, unterschiedliche Farben)
 *   - Tagesroutinen, Berufsaktionen und begrenzte A*-Wegfindung
 *   - Handels-Angebote pro NPC (deterministisch aus Position)
 *   - Rechtsklick → Trade-UI
 *
 * Integration: GameMain.js verwaltet Array<NPC>, update() pro Frame.
 */

import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { Physics } from './Physics.js?v=20260717a';
import { getPainterlyEntityTexture, selectEntityTextureVariant } from './entityMaterials.js?v=20260801a';
import { getArmorSetItems } from './equipmentRules.js?v=20260723e';
import { findNpcPath, getNpcRoutine } from './npcBehavior.js?v=20260730a';

const NPC_CFG = CONFIG.NPC;
const NAME_TAG_VISIBLE_DISTANCE = 8;
const NAME_TAG_FADE_DISTANCE = 5;
const NPC_HALF_WIDTH = 0.28;
const NPC_FEET_OFFSET = 0.05;
const NPC_HEAD_OFFSET = 1.85;
const WATER_BLOCKS = new Set([4]);
const DOOR_BLOCKS = new Set([33, 34, 103]);
const VILLAGER_SKIN_TILE = 11;
const PROFESSION_TEXTURE_TILES = [12, 13, 14, 15];
const SOCIAL_OFFSETS = [
    [-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
];

export function findNearestFootY(fromY, hasStandSpace, minY = 1, maxY = 63) {
    const centerY = Math.max(minY, Math.min(maxY, Math.round(fromY)));
    for (let offset = 0; offset <= 8; offset++) {
        const candidates = offset === 0 ? [centerY] : [centerY - offset, centerY + offset];
        for (const footY of candidates) {
            if (footY >= minY && footY <= maxY && hasStandSpace(footY)) return footY;
        }
    }
    return null;
}

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
            { give: { type: 61, count: 4 }, receive: { label: 'Leichtes Rüstungsset', items: getArmorSetItems('brush') } },
            { give: { type: 61, count: 7 }, receive: { label: 'Fellrüstungsset', items: getArmorSetItems('fur') } },
            { give: { type: 61, count: 12 }, receive: { label: 'Holzrüstungsset', items: getArmorSetItems('wood') } },
            { give: { type: 62, count: 14 }, receive: { label: 'Eisenrüstungsset', items: getArmorSetItems('iron') } },
            { give: { type: 62, count: 30 }, receive: { label: 'Verstärktes Eisenrüstungsset', items: getArmorSetItems('reinforcedIron') } },
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
    constructor(scene, x, y, z, professionIdx, schedule = {}) {
        this.scene = scene;
        this.homeX = x;
        this.homeY = y;
        this.homeZ = z;
        this.professionIdx = professionIdx % NPC_PROFESSIONS.length;
        this.profession = NPC_PROFESSIONS[this.professionIdx];
        this.villageId = typeof schedule.villageId === 'string' ? schedule.villageId : null;
        this.id = typeof schedule.npcId === 'string' ? schedule.npcId : null;
        this.displayName = typeof schedule.displayName === 'string' ? schedule.displayName : this.profession.name;
        this.isEssential = Boolean(schedule.essential);
        this.isUnconscious = false;
        this.visualVariant = selectEntityTextureVariant(x, z, this.professionIdx + 31);
        this.schedule = {
            home: schedule.home || { x, y, z },
            door: schedule.door || null,
            porch: schedule.porch || null,
            work: schedule.work || null,
            gathering: schedule.gathering || schedule.waypoints?.find(point => point.role === 'center') || null,
            community: schedule.community || null,
            waypoints: Array.isArray(schedule.waypoints) ? schedule.waypoints : []
        };

        this.isDead = false;
        this.health = 20;
        this.velocity = new THREE.Vector3();

        // Tagesroutine und Navigation
        this.targetX = x;
        this.targetZ = z;
        this.activity = 'sleeping';
        this.routinePhase = null;
        this.path = [];
        this.pathIndex = 0;
        this.pathGoalKey = null;
        this.repathTimer = 0;
        this.stuckTimer = 0;

        // Mesh bauen
        this.group = new THREE.Group();
        this.group.position.set(x, y, z);
        this._buildMesh();
        this._buildActivityProp();
        scene.add(this.group);

        // Walk-Animation
        this.walkTime = 0;
        this.isWalking = false;
    }

    _buildActivityProp() {
        this.activityProp = new THREE.Group();
        this.activityProp.visible = false;

        if (this.professionIdx === 0) {
            const handle = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.36, 0.05),
                new THREE.MeshPhongMaterial({ color: 0x6b4423 })
            );
            const head = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.1, 0.1),
                new THREE.MeshPhongMaterial({ color: 0x555b63 })
            );
            head.position.y = 0.18;
            this.activityProp.add(handle, head);
        } else if (this.professionIdx === 1) {
            this.activityProp.add(new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.MeshPhongMaterial({ color: 0xd4a820 })
            ));
        } else if (this.professionIdx === 2) {
            this.activityProp.add(new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.075, 0.18, 8),
                new THREE.MeshPhongMaterial({ color: 0xc9a66b })
            ));
        } else {
            this.activityProp.add(new THREE.Mesh(
                new THREE.BoxGeometry(0.26, 0.06, 0.3),
                new THREE.MeshPhongMaterial({ color: 0x6f2746 })
            ));
        }

        this.activityProp.position.set(0, -0.28, 0.18);
        this.rightArm.add(this.activityProp);
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
        this._createNameTag(`${this.displayName} · ${prof.name}`);

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

    _hasDryStandSpace(world, x, footY, z, allowClosedDoors = false) {
        let hasFloorSupport = false;
        for (const [bx, bz] of this._getFootprintColumns(x, z)) {
            const floorY = footY - 1;
            if (this._isDrySolidFloor(world, bx, floorY, bz)) hasFloorSupport = true;

            for (let y = Math.floor(footY + NPC_FEET_OFFSET); y <= Math.floor(footY + NPC_HEAD_OFFSET); y++) {
                if (allowClosedDoors && DOOR_BLOCKS.has(world.getBlock(bx, y, bz))) continue;
                if (Physics.isSolid(world, bx, y, bz, true)) return false;
                if (WATER_BLOCKS.has(world.getBlock(bx, y, bz))) return false;
            }
        }
        return hasFloorSupport;
    }

    _findNearestFootY(world, x, z, fromY, allowClosedDoors = false) {
        return findNearestFootY(fromY, footY => this._hasDryStandSpace(world, x, footY, z, allowClosedDoors), 1, 63);
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

    _stableSlot() {
        const source = this.id || `${this.homeX}:${this.homeZ}:${this.professionIdx}`;
        let hash = 0;
        for (let index = 0; index < source.length; index++) {
            hash = ((hash * 31) + source.charCodeAt(index)) | 0;
        }
        return Math.abs(hash) % SOCIAL_OFFSETS.length;
    }

    _getRoutineTarget(routine) {
        if (!routine.target) return { x: this.homeX, y: this.homeY, z: this.homeZ };
        if (routine.phase !== 'midday' && routine.phase !== 'evening') return routine.target;
        const [offsetX, offsetZ] = SOCIAL_OFFSETS[this._stableSlot()];
        return {
            x: routine.target.x + offsetX,
            y: routine.target.y,
            z: routine.target.z + offsetZ
        };
    }

    _isNpcPositionFree(x, z, npcs) {
        for (const npc of npcs || []) {
            if (npc === this || npc.isDead || npc.isUnconscious) continue;
            const dx = npc.group.position.x - x;
            const dz = npc.group.position.z - z;
            if (dx * dx + dz * dz >= 0.55 * 0.55) continue;
            const currentDx = npc.group.position.x - this.group.position.x;
            const currentDz = npc.group.position.z - this.group.position.z;
            if (dx * dx + dz * dz <= currentDx * currentDx + currentDz * currentDz) return false;
        }
        return true;
    }

    _planPath(world, npcs, target) {
        const occupied = new Set();
        for (const npc of npcs || []) {
            if (npc === this || npc.isDead || npc.isUnconscious) continue;
            occupied.add(`${Math.round(npc.group.position.x)},${Math.round(npc.group.position.z)}`);
        }

        this.path = findNpcPath({
            start: this.group.position,
            target,
            getFootY: (x, z, fromY) => this._findNearestFootY(world, x, z, fromY, true),
            isBlocked: (x, z) => occupied.has(`${x},${z}`)
        });
        this.pathIndex = this.path.length > 1 ? 1 : 0;
        this.repathTimer = this.path.length > 0 ? 2 : 0.75;
    }

    _updateActivityAnimation(delta) {
        this.walkTime += delta * (this.isWalking ? 8 : 4);
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.activityProp.visible = false;

        if (this.isWalking) {
            const swing = Math.sin(this.walkTime) * 0.4;
            this.leftArm.rotation.x = swing;
            this.rightArm.rotation.x = -swing;
            this.leftLeg.rotation.x = -swing;
            this.rightLeg.rotation.x = swing;
            return;
        }

        if (this.activity === 'forging') {
            this.rightArm.rotation.x = -0.8 + Math.sin(this.walkTime * 1.8) * 0.65;
            this.activityProp.visible = true;
        } else if (this.activity === 'tending') {
            const reach = -0.45 + Math.sin(this.walkTime) * 0.18;
            this.leftArm.rotation.x = reach;
            this.rightArm.rotation.x = reach;
            this.activityProp.visible = true;
        } else if (this.activity === 'serving') {
            this.rightArm.rotation.x = -0.75 + Math.sin(this.walkTime * 0.7) * 0.12;
            this.activityProp.visible = true;
        } else if (this.activity === 'studying') {
            this.leftArm.rotation.x = -0.65;
            this.rightArm.rotation.x = -0.65;
            this.activityProp.visible = true;
        } else if (this.activity === 'trading' || this.activity === 'socializing') {
            this.rightArm.rotation.x = Math.sin(this.walkTime) * 0.25;
        }
    }

    /**
     * Update pro Frame.
     * @param {number} delta — Sekunden
     * @param {THREE.Vector3} playerPos
     * @param {import('./world.js').World} world
     */
    _openDoorAt(world, x, y, z) {
        for (const [blockX, blockZ] of this._getFootprintColumns(x, z)) {
            for (let blockY = Math.floor(y); blockY <= Math.floor(y) + 1; blockY++) {
                const block = world.getBlock(blockX, blockY, blockZ);
                if (!DOOR_BLOCKS.has(block)) continue;
                const baseY = block === 34 ? blockY - 1 : blockY;
                const nextMetadata = world.getBlockMeta(blockX, baseY, blockZ) | 4;
                world.setBlockMeta(blockX, baseY, blockZ, nextMetadata);
                if (block !== 103) world.setBlockMeta(blockX, baseY + 1, blockZ, nextMetadata);
                return true;
            }
        }
        return false;
    }

    update(delta, playerPos, world, dayRatio = 0.5, npcs = []) {
        if (this.isDead) return;
        this._updateNameTag(playerPos);
        if (this.isUnconscious) {
            if (dayRatio >= 0.25 && dayRatio <= 0.35) {
                this.isUnconscious = false;
                this.health = 20;
                this.group.position.set(this.homeX, this.homeY, this.homeZ);
            } else {
                return;
            }
        }

        const pos = this.group.position;
        this._resolveGround(world, true);
        this.repathTimer -= delta;

        const routine = getNpcRoutine(dayRatio, this.professionIdx, this.schedule);
        const target = this._getRoutineTarget(routine);
        this.targetX = target.x;
        this.targetZ = target.z;
        const goalKey = `${routine.phase}:${Math.round(target.x * 2)}:${Math.round(target.z * 2)}`;
        if (goalKey !== this.pathGoalKey) {
            this.pathGoalKey = goalKey;
            this.routinePhase = routine.phase;
            this.path = [];
            this.pathIndex = 0;
            this.repathTimer = 0;
            this.stuckTimer = 0;
        }

        const targetDx = target.x - pos.x;
        const targetDz = target.z - pos.z;
        const targetDistance = Math.sqrt(targetDx * targetDx + targetDz * targetDz);
        const pathEnd = this.path[this.path.length - 1];
        const pathEndDistance = pathEnd
            ? Math.hypot(pathEnd.x - pos.x, pathEnd.z - pos.z)
            : Infinity;
        const reachedGoal = targetDistance <= 1.05 || pathEndDistance <= 0.3;
        const checkNpcCollision = (np) => Physics.checkAABBCollision(world, np, NPC_HALF_WIDTH, NPC_FEET_OFFSET, NPC_HEAD_OFFSET, true);
        const getStandY = (x, z) => this._findNearestFootY(world, x, z, pos.y);

        if (!reachedGoal) {
            if (this.repathTimer <= 0 || (this.path.length > 0 && this.pathIndex >= this.path.length)) {
                this._planPath(world, npcs, target);
            }

            while (this.pathIndex < this.path.length) {
                const point = this.path[this.pathIndex];
                const pointDx = point.x - pos.x;
                const pointDz = point.z - pos.z;
                if (pointDx * pointDx + pointDz * pointDz >= 0.25 * 0.25) break;
                this.pathIndex++;
            }

            const point = this.path[this.pathIndex];
            let moved = false;
            if (point) {
                const dx = point.x - pos.x;
                const dz = point.z - pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const nx = dx / Math.max(0.001, dist);
                const nz = dz / Math.max(0.001, dist);
                const speed = Math.min(NPC_CFG.WANDER_SPEED * delta, dist);
                const turn = this._stableSlot() % 2 === 0 ? 1 : -1;
                const directions = [
                    [nx, nz],
                    [nx + nz * 0.9 * turn, nz - nx * 0.9 * turn],
                    [nz * turn, -nx * turn]
                ];

                for (const [rawX, rawZ] of directions) {
                    const length = Math.sqrt(rawX * rawX + rawZ * rawZ);
                    const moveX = rawX / length;
                    const moveZ = rawZ / length;
                    const nextX = pos.x + moveX * speed;
                    const nextZ = pos.z + moveZ * speed;
                    const nextY = getStandY(nextX, nextZ);
                    this._openDoorAt(world, nextX, pos.y, nextZ);

                    if (nextY !== null &&
                        !checkNpcCollision({ x: nextX, y: nextY, z: nextZ }) &&
                        this._isNpcPositionFree(nextX, nextZ, npcs)) {
                        pos.x = nextX;
                        pos.y = nextY;
                        pos.z = nextZ;
                        this.velocity.y = 0;
                        moved = true;
                        this.group.rotation.y = Math.atan2(moveX, moveZ);
                        break;
                    }
                }
            }

            this.isWalking = moved;
            if (moved) {
                this.stuckTimer = 0;
                this.activity = 'walking';
            } else {
                this.activity = 'waiting';
                this.stuckTimer += delta;
                if (this.stuckTimer >= 0.7) {
                    this.path = [];
                    this.pathIndex = 0;
                    this.repathTimer = 0;
                    this.stuckTimer = 0;
                }
            }
        } else {
            this.isWalking = false;
            this.activity = routine.action;
        }

        const groundY = this._findNearestFootY(world, pos.x, pos.z, pos.y);
        if (groundY === null || pos.y > groundY + 0.05) {
            this.velocity.y -= 9.8 * delta;
        }
        pos.y += this.velocity.y * delta;
        this._resolveGround(world);
        this._updateActivityAnimation(delta);

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
            if (this.isEssential) {
                this.health = 1;
                this.isUnconscious = true;
                this.velocity.set(0, 0, 0);
            } else {
                this.isDead = true;
            }
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
            villageId: this.villageId,
            id: this.id,
            displayName: this.displayName,
            isEssential: this.isEssential,
            isUnconscious: this.isUnconscious,
            health: this.health,
            isDead: this.isDead,
            schedule: this.schedule
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
