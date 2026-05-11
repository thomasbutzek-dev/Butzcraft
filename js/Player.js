import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Physics } from './Physics.js?v=20260507b';

export class Player {
    constructor(scene, camera, domElement, CONFIG) {
        this.camera = camera;
        this.scene = scene;
        this.controls = new PointerLockControls(camera, domElement);
        this.scene.add(this.controls.getObject());

        this.CONFIG = CONFIG;

        // Stats
        this.health = CONFIG.GAMEPLAY.MAX_HEALTH;
        this.hunger = CONFIG.GAMEPLAY.MAX_HUNGER;

        // Physics State
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.canJ = false;
        this.distanceTravelled = 0;
        
        // Environment State
        this.wasInWater = false;
        this.wasHeadInWater = false;
        this.underwaterTime = 0;

        // Sword Animation State
        this.isSwinging = false;
        this.swingProgress = 0;
        this.swordGroup = this.createSword();
        this.camera.add(this.swordGroup);

        // Wiederverwendbare Vector3-Instanzen für updatePhysics (vermeidet GC-Druck bei 60fps).
        // Pattern wie in mobs.js (`_tempDir` etc.). Pro Frame wurden vorher 3 neue Vec3 alloziert.
        this._fwd = new THREE.Vector3();
        this._fwdH = new THREE.Vector3();
        this._rgt = new THREE.Vector3();
    }

    createSword() {
        const swordGroup = new THREE.Group();
        
        // Klinge (Hellgrau)
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.6, 0.05),
            new THREE.MeshPhongMaterial({ color: 0xbdc3c7 })
        );
        blade.position.y = 0.45;
        swordGroup.add(blade);

        // Parierstange (Dunkelgrau)
        const guard = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.08, 0.08),
            new THREE.MeshPhongMaterial({ color: 0x2c3e50 })
        );
        guard.position.y = 0.15;
        swordGroup.add(guard);

        // Griff (Braun)
        const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.25, 0.08),
            new THREE.MeshPhongMaterial({ color: 0x7e5233 })
        );
        handle.position.y = 0.0;
        swordGroup.add(handle);

        // Knauf (Dunkelgrau)
        const pommel = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.1, 0.12),
            new THREE.MeshPhongMaterial({ color: 0x2c3e50 })
        );
        pommel.position.y = -0.15;
        swordGroup.add(pommel);

        // Positionierung in der Hand (unten rechts im HUD)
        swordGroup.position.set(0.4, -0.35, -0.5);
        swordGroup.rotation.set(-0.2, 0, 0);
        swordGroup.visible = false;
        return swordGroup;
    }

    swingSword() {
        if (!this.isSwinging) {
            this.isSwinging = true;
            this.swingProgress = 0;
        }
    }

    updateSword(delta) {
        if (this.isSwinging) {
            this.swordGroup.visible = true; 
            this.swingProgress += delta * 12; 
            if (this.swingProgress > Math.PI) { 
                this.swingProgress = 0; 
                this.isSwinging = false; 
                this.swordGroup.visible = false; 
            }
            const v = Math.sin(this.swingProgress); 
            this.swordGroup.rotation.x = -0.2 - v * 1.5; 
            this.swordGroup.rotation.z = v * 0.5; 
            this.swordGroup.position.z = -0.5 + v * 0.2; 
            this.swordGroup.rotation.y = -0.35 - v * 0.15;
        } else {
            this.swordGroup.visible = false;
        }
    }

    updateWaterAndVoid(world, SoundManager, delta = 0) {
        const playerPos = this.controls.getObject().position;

        // Void Protection
        if (playerPos.y < -20) {
            playerPos.set(playerPos.x, 50, playerPos.z);
            this.velocity.set(0, 0, 0);
            const msg = document.createElement('div');
            msg.innerText = "Absturz verhindert! 🛡️";
            msg.style = "position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); color:#fff; font-weight:bold; pointer-events:none; animation: fade-up 3s forwards; text-shadow: 0 0 10px rgba(0,0,0,1.0); font-size: 32px; z-index: 3000;";
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        }

        // Water Status (vereinfacht: eine State-Machine statt doppeltem Tracking)
        const headInWater = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 0.2), Math.floor(playerPos.z)) === 4;
        const feetInWater = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z)) === 4;
        this.inWater = headInWater || feetInWater;
        
        // Splash bei Eintritt ins Wasser
        if (this.inWater && !this.wasInWater && this.velocity.y < -5) {
            SoundManager.playSplash();
        }
        this.wasInWater = this.inWater;

        // Unterwasser-Sound & Overlay nur bei Kopf-Status-Änderung aktualisieren
        if (headInWater !== this.wasHeadInWater) {
            SoundManager.setUnderwater(headInWater);
            this.wasHeadInWater = headInWater;
        }

        if (headInWater) {
            this.underwaterTime += delta;
            const breathSeconds = this.CONFIG.GAMEPLAY.UNDERWATER_BREATH_SECONDS || 8;
            const damagePerSecond = this.CONFIG.GAMEPLAY.UNDERWATER_DAMAGE_PER_SECOND || 0;
            if (this.underwaterTime > breathSeconds && damagePerSecond > 0) {
                this.health = Math.max(0, this.health - damagePerSecond * delta);
            }
        } else {
            this.underwaterTime = 0;
        }

        // Overlay gecacht (DOM-Zugriff minimieren)
        if (!this._uwOverlay) this._uwOverlay = document.getElementById('underwater-overlay');
        if (this._uwOverlay) this._uwOverlay.style.display = headInWater ? 'block' : 'none';
    }

    updatePhysics(delta, Input, world, SoundManager) {
        const playerPos = this.controls.getObject().position;
        if (world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y), Math.floor(playerPos.z)) === -1) {
            this.velocity.set(0, 0, 0);
            return;
        }
        const headInWater = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 0.2), Math.floor(playerPos.z)) === 4;
        const feetInWater = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z)) === 4;
        const inWater = headInWater || feetInWater;

        // Reuse persistente Vektoren statt new Vector3() pro Frame.
        this.controls.getDirection(this._fwd);
        this._fwdH.set(this._fwd.x, 0, this._fwd.z).normalize();
        this._rgt.crossVectors(this._fwdH, this.camera.up).normalize();
        const fwdH = this._fwdH, rgt = this._rgt;

        this.direction.z = Number(Input.moveF) - Number(Input.moveB);
        this.direction.x = Number(Input.moveL) - Number(Input.moveR);
        this.direction.normalize();

        const { PLAYER_WIDTH, PLAYER_HITBOX_Y_MIN, PLAYER_HITBOX_Y_MAX, GRAVITY, GRAVITY_MULTIPLIER, PLAYER_JUMP_FORCE, WALK_SPEED, FRICTION, SUB_STEP_MAX, SPRINT_SPEED_MULT, CROUCH_SPEED_MULT, SPRINT_HUNGER_MULT, WATER_DRAG } = this.CONFIG.PHYSICS;
        const { HUNGER_LOSS_MOVE } = this.CONFIG.GAMEPLAY;

        // Sprint/Crouch: Sprint nur am Boden + bei Vorwärtsbewegung + ausreichend Hunger.
        // Crouch dominiert über Sprint, falls beide Tasten gehalten werden.
        const isSprinting = !!Input.sprint && this.canJ && Input.moveF && this.hunger > 6 && !Input.crouch;
        const isCrouching = !!Input.crouch && this.canJ;
        const speedMult = isCrouching ? CROUCH_SPEED_MULT : (isSprinting ? SPRINT_SPEED_MULT : 1.0);
        const hungerMult = isSprinting ? SPRINT_HUNGER_MULT : 1.0;
        const effectiveWalk = WALK_SPEED * speedMult;

        // Crouch verkleinert die Player-Hitbox vertikal (Top-Y rückt von +0.10 auf -0.45).
        // → Spieler kann unter 1-Block-Lücken durchkriechen. Nur wenn auf Boden (canJ),
        //   damit man im Sprung nicht durch Decken phasen kann.
        const effectiveYMax = (isCrouching ? -0.45 : PLAYER_HITBOX_Y_MAX);
        const checkC = (np) => Physics.checkAABBCollision(world, np, PLAYER_WIDTH, PLAYER_HITBOX_Y_MIN, effectiveYMax, false);

        // Sub-Step-Anzahl pro Achse: Hitbox-Halbbreite < SUB_STEP_MAX → kein Wand-Tunnel.
        const subStepsFor = (totalMove) => Math.max(1, Math.ceil(Math.abs(totalMove) / SUB_STEP_MAX));

        // Sub-stepped Y-Movement mit Boden-/Decken-Snap.
        const stepY = (totalDy) => {
            const n = subStepsFor(totalDy);
            const dy = totalDy / n;
            for (let s = 0; s < n; s++) {
                playerPos.y += dy;
                if (checkC(playerPos)) {
                    if (this.velocity.y <= 0) {
                        playerPos.y = (Math.floor(playerPos.y - 1.65) + 1.0) + 1.651;
                        this.velocity.y = 0;
                        return 'ground';
                    } else {
                        playerPos.y = Math.floor(playerPos.y + 0.1) - 0.11;
                        this.velocity.y = 0;
                        return 'ceiling';
                    }
                }
            }
            return null;
        };

        // Sub-stepped horizontale Bewegung. axis = 'x' oder 'z'.
        const stepHoriz = (axis, totalD) => {
            const n = subStepsFor(totalD);
            const d = totalD / n;
            for (let s = 0; s < n; s++) {
                const old = playerPos[axis];
                playerPos[axis] += d;
                if (checkC(playerPos)) {
                    playerPos[axis] = old;
                    this.velocity[axis] = 0;
                    return;
                }
            }
        };

        if (inWater) {
            const drag = WATER_DRAG;
            this.velocity.x -= this.velocity.x * drag * delta;
            this.velocity.y -= this.velocity.y * drag * delta;
            this.velocity.z -= this.velocity.z * drag * delta;
            this.velocity.y -= 9.8 * 1.5 * delta;

            if (Input.moveUp) this.velocity.y += (PLAYER_JUMP_FORCE * 2.5) * delta;
            if (Input.moveF || Input.moveB) { this.velocity.z -= this.direction.z * (WALK_SPEED / 2) * delta; this.hunger -= (HUNGER_LOSS_MOVE / 2) * delta; }
            if (Input.moveL || Input.moveR) { this.velocity.x -= this.direction.x * (WALK_SPEED / 2) * delta; this.hunger -= (HUNGER_LOSS_MOVE / 2) * delta; }

            stepY(this.velocity.y * delta);
            stepHoriz('x', (fwdH.x * -this.velocity.z + rgt.x * this.velocity.x) * delta);
            stepHoriz('z', (fwdH.z * -this.velocity.z + rgt.z * this.velocity.x) * delta);

            this.canJ = true;
        } else {
            this.velocity.x -= this.velocity.x * FRICTION * delta;
            this.velocity.z -= this.velocity.z * FRICTION * delta;

            const onGround = checkC({ x: playerPos.x, y: playerPos.y - 0.05, z: playerPos.z });
            if (!onGround || this.velocity.y > 0) {
                this.velocity.y -= GRAVITY * GRAVITY_MULTIPLIER * delta;
            } else {
                this.velocity.y = 0; this.canJ = true;
            }

            if (Input.moveUp && this.canJ) {
                this.velocity.y = PLAYER_JUMP_FORCE;
                this.canJ = false;
            }

            if (Input.moveF || Input.moveB) { this.velocity.z -= this.direction.z * effectiveWalk * delta; this.hunger -= HUNGER_LOSS_MOVE * hungerMult * delta; }
            if (Input.moveL || Input.moveR) { this.velocity.x -= this.direction.x * effectiveWalk * delta; this.hunger -= HUNGER_LOSS_MOVE * hungerMult * delta; }
            this.isSprinting = isSprinting;
            this.isCrouching = isCrouching;

            const spd = Math.hypot(this.velocity.x, this.velocity.z);
            if (this.canJ && spd > 1.0) {
                this.distanceTravelled += spd * delta;
                // Schritt-Frequenz: Sprint = häufigere Schritte (1.5 statt 2.2 Distanz-Schwelle).
                // Crouch = leiseres / langsameres Gehen → längere Schwelle (3.5).
                const stepThreshold = isSprinting ? 1.5 : (isCrouching ? 3.5 : 2.2);
                if (this.distanceTravelled > stepThreshold) {
                    this.distanceTravelled = 0;
                    const bB = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z));
                    if (bB !== 0 && bB !== 4) SoundManager.playStep(bB);
                }
            } else this.distanceTravelled = 0;

            // Y-Bewegung: bei Boden-Hit canJ setzen (Decke nicht).
            const yHit = stepY(this.velocity.y * delta);
            if (yHit === 'ground') this.canJ = true;

            stepHoriz('x', (fwdH.x * -this.velocity.z + rgt.x * this.velocity.x) * delta);
            stepHoriz('z', (fwdH.z * -this.velocity.z + rgt.z * this.velocity.x) * delta);
        }
    }
}
