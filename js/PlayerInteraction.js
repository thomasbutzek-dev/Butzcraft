import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { classifyChestLoot, getLootDiscoveryMessage, rollLoot } from './structures.js?v=20260719a';
import { openFurnace } from './furnace.js?v=20260719a';
import { createBlockHTML, getItemName } from './inventory.js?v=20260720q';
        import { BLOCK_COLORS } from './blocks.js?v=20260717z';
import { Game } from './Game.js?v=20260716b';
import { getMiningPlan, getToolInfo } from './miningRules.js?v=20260718b';
import { getAttackProfile, getBowInfo, getSwordInfo } from './combatRules.js?v=20260716b';
import { PlayerArrowProjectile } from './playerArrow.js?v=20260720q';
import { getFoodInfo } from './foodRules.js?v=20260716a';
import { getTorchMount, TORCH_TYPE } from './torchLights.js?v=20260719a';
import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';
import { openTradeUI } from './tradeUI.js?v=20260720q';
import { STORY_EVENTS } from './storyProgress.js?v=20260720q';
import { activateDialog, deactivateDialog } from './dialogFocus.js?v=20260718b';

const { MAX_HUNGER, HUNGER_GAIN_PIG } = CONFIG.GAMEPLAY;

const WOOD_BLOCKS = new Set([5, 13, 15, 102, 103]);
const TORCH_NON_SUPPORT_BLOCKS = new Set([0, 4, 9, 10, 27, 32, 33, 34, 36, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52, 54, 79, 80, 86, 104, TORCH_TYPE]);
const MINING_HINT_COOLDOWN_MS = 1800;

export function getBlockBreakParticleProfile(painterly = graphicsPrototype.usesPainterlyTextures, reducedDetail = graphicsPrototype.reducedDetail) {
    return painterly
        ? { count: reducedDetail ? 6 : 9, size: 0.08, opacity: 0.78, lifetimeMs: 480, gravity: 4.8 }
        : { count: 10, size: 0.09, opacity: 0.9, lifetimeMs: 360, gravity: 5.5 };
}

export function canUseMouseInteraction({
    gameStarted,
    gameActive,
    spawning,
    manuallyPaused,
    blockingOverlayOpen
}) {
    return Boolean(
        gameStarted &&
        gameActive &&
        !spawning &&
        !manuallyPaused &&
        !blockingOverlayOpen
    );
}

export class PlayerInteraction {
    constructor(camera, scene, world, mobs, SoundManager, context) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.mobs = mobs;
        this.SoundManager = SoundManager;
        this.context = context; 
        
        this.raycaster = new THREE.Raycaster();
        this._aimOrigin = new THREE.Vector3();
        this._aimDirection = new THREE.Vector3();
        this.lastMiningHintAt = 0;
        this.miningHeld = false;
        this.miningTarget = null;
        this.miningProgress = 0;
        this.miningToolType = 0;
        this.attackReadyAt = 0;
        this.lastAttackCooldown = 0.8;
        this.rangedProjectiles = [];
        this.activePressurePlateKey = null;
    }

    spawnBlockBreakParticles(x, y, z, blockType, normal) {
        const painterly = graphicsPrototype.usesPainterlyTextures;
        const profile = getBlockBreakParticleProfile(painterly, graphicsPrototype.reducedDetail);
        const color = new THREE.Color(BLOCK_COLORS[blockType] || 0xaaaaaa);
        if (painterly) color.offsetHSL(0, -0.06, 0.035);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: profile.opacity, depthWrite: !painterly });
        const geometry = new THREE.BoxGeometry(profile.size, profile.size, profile.size);
        const particles = [];
        const baseNormal = normal ? normal.clone() : new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < profile.count; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                x + 0.5 + (Math.random() - 0.5) * 0.55,
                y + 0.5 + (Math.random() - 0.5) * 0.55,
                z + 0.5 + (Math.random() - 0.5) * 0.55
            );
            const baseScale = painterly
                ? new THREE.Vector3(0.58 + Math.random() * 0.64, 0.42 + Math.random() * 0.76, 0.55 + Math.random() * 0.7)
                : new THREE.Vector3(1, 1, 1);
            mesh.scale.copy(baseScale);
            this.scene.add(mesh);
            particles.push({
                mesh,
                baseScale,
                spinX: painterly ? 3.5 + Math.random() * 5 : 8,
                spinY: painterly ? 2.5 + Math.random() * 5 : 6,
                velocity: baseNormal.clone().multiplyScalar(1.6 + Math.random() * 1.4).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2.2,
                    Math.random() * 1.6,
                    (Math.random() - 0.5) * 2.2
                ))
            });
        }

        const startedAt = performance.now();
        const lifetimeMs = profile.lifetimeMs;
        let lastAt = startedAt;
        const tick = (now) => {
            const delta = Math.min((now - lastAt) / 1000, 0.04);
            lastAt = now;
            const age = now - startedAt;
            const alpha = Math.max(0, 1 - age / lifetimeMs);
            material.opacity = alpha * profile.opacity;

            for (const particle of particles) {
                particle.velocity.y -= profile.gravity * delta;
                particle.mesh.position.addScaledVector(particle.velocity, delta);
                particle.mesh.rotation.x += delta * particle.spinX;
                particle.mesh.rotation.y += delta * particle.spinY;
                const scale = 0.65 + alpha * 0.35;
                particle.mesh.scale.copy(particle.baseScale).multiplyScalar(scale);
            }

            if (age < lifetimeMs) {
                requestAnimationFrame(tick);
                return;
            }

            for (const particle of particles) this.scene.remove(particle.mesh);
            geometry.dispose();
            material.dispose();
        };

        requestAnimationFrame(tick);
    }

    init(controls, getGameActive, getSpawning) {
        this._controls = controls;
        // Cleanup: falls init() mehrfach gerufen wird (z.B. nach loadGame), alten
        // Listener entfernen. Sonst feuert ein Klick mehrfach → "Doppelschlag"-Bug.
        this.destroy();
        this._onMouseDown = (e) => {
            // PointerLock ist auf Touch-Geräten nicht verfügbar → bei aktivem Touch-Mode
            // wird die isLocked-Check übersprungen (Touch-Buttons feuern synthetische mousedowns).
            const lockOk = typeof window.butzcraftCanInteract === 'function'
                ? window.butzcraftCanInteract(e)
                : (controls.isLocked || Game.touchActive);
            if (!lockOk || !getGameActive() || getSpawning()) return;
            this.handleInteraction(e);
        };
        this._onMouseUp = (e) => {
            if (e.button === 0) this.cancelMining();
        };
        this._onWindowBlur = () => this.cancelMining();
        document.addEventListener('mousedown', this._onMouseDown);
        document.addEventListener('mouseup', this._onMouseUp);
        window.addEventListener('blur', this._onWindowBlur);
    }

    destroy() {
        if (this._onMouseDown) {
            document.removeEventListener('mousedown', this._onMouseDown);
            this._onMouseDown = null;
        }
        if (this._onMouseUp) {
            document.removeEventListener('mouseup', this._onMouseUp);
            this._onMouseUp = null;
        }
        if (this._onWindowBlur) {
            window.removeEventListener('blur', this._onWindowBlur);
            this._onWindowBlur = null;
        }
        if (this.rangedProjectiles) {
            for (const projectile of this.rangedProjectiles) projectile.dispose();
            this.rangedProjectiles.length = 0;
        }
        this.cancelMining();
    }

    _getCurrentItem() {
        const slotIndex = typeof window.getSelectedSlot === 'function'
            ? window.getSelectedSlot()
            : this.context.getSelectedSlot();
        return this.context.getInventorySlots()[slotIndex];
    }

    _getBlockHit() {
        this._setAimRay();
        const chunkMeshes = [];
        this.world.chunks.forEach(chunk => {
            if (chunk.mesh) chunkMeshes.push(chunk.mesh);
            if (chunk.waterMesh) chunkMeshes.push(chunk.waterMesh);
        });
        const hit = this.raycaster.intersectObjects(chunkMeshes)[0];
        if (!hit || hit.distance > 3 || !(hit.object instanceof THREE.Mesh) || !hit.object.geometry) return null;

        const point = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(-0.5));
        return {
            x: Math.floor(point.x),
            y: Math.floor(point.y),
            z: Math.floor(point.z),
            normal: hit.face.normal.clone()
        };
    }

    _setAimRay() {
        if (typeof Game.player?.getAimRay === 'function') {
            const ray = Game.player.getAimRay(this._aimOrigin, this._aimDirection);
            this.raycaster.set(ray.origin, ray.direction);
            this.raycaster.camera = this.camera;
            return;
        }
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    }

    _getAimDirection(target) {
        if (typeof Game.player?.getAimRay === 'function') {
            return Game.player.getAimRay(this._aimOrigin, target).direction;
        }
        return this.camera.getWorldDirection(target).normalize();
    }

    _setMiningProgress(progress) {
        const indicator = document.getElementById('mining-progress');
        if (!indicator) return;
        const clamped = Math.max(0, Math.min(1, progress));
        indicator.style.setProperty('--mining-progress', String(clamped));
        indicator.classList.toggle('visible', clamped > 0);
        indicator.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    }

    cancelMining() {
        this.miningHeld = false;
        this.miningTarget = null;
        this.miningProgress = 0;
        this.miningToolType = 0;
        this._setMiningProgress(0);
    }

    _setAttackCooldown(progress, visible) {
        const indicator = document.getElementById('attack-cooldown');
        const fill = document.getElementById('attack-cooldown-fill');
        if (!indicator || !fill) return;
        const clamped = Math.max(0, Math.min(1, progress));
        fill.style.transform = `scaleX(${clamped})`;
        indicator.classList.toggle('visible', visible);
        indicator.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    }

    updateCombat(now = performance.now()) {
        const currentItem = this._getCurrentItem();
        const weaponSelected = Boolean(currentItem && currentItem.count > 0 && (getSwordInfo(currentItem.type) || getBowInfo(currentItem.type)));
        const remaining = Math.max(0, this.attackReadyAt - now);
        const coolingDown = remaining > 0;
        const duration = Math.max(1, this.lastAttackCooldown * 1000);
        this._setAttackCooldown(coolingDown ? 1 - remaining / duration : 1, weaponSelected || coolingDown);
    }

    _wearWeapon(item, weaponInfo, label) {
        if (!item || !weaponInfo) return;
        if (!Number.isFinite(item.durability) || item.durability <= 0) {
            item.durability = weaponInfo.maxDurability;
        }
        const previousDurability = item.durability;
        item.durability--;
        if (item.durability <= 0) {
            item.type = 0;
            item.count = 0;
            item.durability = 0;
            this.showMessage(`${label} kaputt!`, '#ff4444', 20);
        } else if (previousDurability / weaponInfo.maxDurability > 0.15 && item.durability / weaponInfo.maxDurability <= 0.15) {
            this.showMessage(`${label} fast kaputt!`, '#ff9800', 18);
        }
        this.context.updateInventoryUI();
    }

    _fireBow(currentItem, bowInfo) {
        const now = performance.now();
        if (now < this.attackReadyAt) return false;
        const arrowSlot = this.context.getInventorySlots().find(slot => slot.type === 95 && slot.count > 0);
        if (!arrowSlot) {
            this.showMessage('Keine Pfeile – aus Stein und Stock herstellen.', '#ff9800', 18);
            return false;
        }

        arrowSlot.count--;
        if (arrowSlot.count <= 0) {
            arrowSlot.type = 0;
            arrowSlot.count = 0;
        }
        const direction = this._getAimDirection(new THREE.Vector3());
        const start = this._aimOrigin.clone().addScaledVector(direction, 0.6);
        if (this.rangedProjectiles.length >= 64) this.rangedProjectiles.shift().dispose();
        this.rangedProjectiles.push(new PlayerArrowProjectile(this.scene, start, direction, bowInfo.damage));
        this.attackReadyAt = now + bowInfo.cooldown * 1000;
        this.lastAttackCooldown = bowInfo.cooldown;
        this._setAttackCooldown(0, true);
        this._wearWeapon(currentItem, bowInfo, 'Bogen');
        return true;
    }

    updateRanged(delta) {
        for (let i = this.rangedProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.rangedProjectiles[i];
            projectile.update(delta, this.world, this.mobs);
            if (projectile.isDead) this.rangedProjectiles.splice(i, 1);
        }
    }

    _startMining(target, plan, toolType) {
        this.miningHeld = true;
        this.miningTarget = target;
        this.miningProgress = 0;
        this.miningToolType = toolType;
        this._setMiningProgress(0.001);
        if (!plan.canBreak) {
            this.showMiningHint(plan.hint);
            this.cancelMining();
        }
    }

    updateMining(delta) {
        if (!this.miningHeld) return;
        Game.player?.setActionCamera?.(220);
        const hit = this._getBlockHit();
        if (!hit) {
            this.cancelMining();
            return;
        }

        const targetChanged = !this.miningTarget ||
            hit.x !== this.miningTarget.x || hit.y !== this.miningTarget.y || hit.z !== this.miningTarget.z;
        if (targetChanged) {
            this.miningTarget = hit;
            this.miningProgress = 0;
        }

        const currentItem = this._getCurrentItem();
        const toolType = currentItem && currentItem.count > 0 ? currentItem.type : 0;
        const plan = getMiningPlan(this.world.getBlock(hit.x, hit.y, hit.z), toolType);
        if (!plan.canBreak) {
            this.showMiningHint(plan.hint);
            this.cancelMining();
            return;
        }
        if (toolType !== this.miningToolType) {
            this.miningToolType = toolType;
            this.miningProgress = 0;
        }

        this.miningProgress += delta / plan.duration;
        this._setMiningProgress(this.miningProgress);
        if (this.miningProgress < 1) return;

        this._breakMinedBlock(hit, currentItem, plan);
        this.miningTarget = null;
        this.miningProgress = 0;
        this._setMiningProgress(0);
    }

    _breakMinedBlock(target, currentItem, plan) {
        const bx = target.x, by = target.y, bz = target.z;
        const brokenType = this.world.getBlock(bx, by, bz);
        if (!plan.canBreak || brokenType === 0) return;

        const isNextToWater = (
            this.world.getBlock(bx, by + 1, bz) === 4 ||
            this.world.getBlock(bx - 1, by, bz) === 4 ||
            this.world.getBlock(bx + 1, by, bz) === 4 ||
            this.world.getBlock(bx, by, bz - 1) === 4 ||
            this.world.getBlock(bx, by, bz + 1) === 4
        );

        this.world.setBlock(bx, by, bz, isNextToWater ? 4 : 0);
        if (brokenType === TORCH_TYPE || brokenType === 103 || brokenType === 104) this.world.deleteBlockMeta(bx, by, bz);
        this.SoundManager.playDig(brokenType);
        this.spawnBlockBreakParticles(bx, by, bz, brokenType, target.normal);

        if (plan.usesDurability && currentItem) {
            const toolInfo = getToolInfo(currentItem.type);
            if (toolInfo) {
                if (!Number.isFinite(currentItem.durability) || currentItem.durability <= 0) {
                    currentItem.durability = toolInfo.maxDurability;
                }
                const previousDurability = currentItem.durability;
                currentItem.durability--;
                if (currentItem.durability <= 0) {
                    currentItem.type = 0;
                    currentItem.count = 0;
                    currentItem.durability = 0;
                    this.showMessage('Werkzeug kaputt!', '#ff4444', 20);
                } else if (previousDurability / toolInfo.maxDurability > 0.15 && currentItem.durability / toolInfo.maxDurability <= 0.15) {
                    this.showMessage('Werkzeug fast kaputt!', '#ff9800', 18);
                }
            }
        }

        if (brokenType === 28 || brokenType === 36) {
            for (let x = bx - 1; x <= bx + 1; x++) {
                for (let z = bz - 1; z <= bz + 1; z++) {
                    const neighbor = this.world.getBlock(x, by, z);
                    if ((brokenType === 28 && neighbor === 36) || (brokenType === 36 && neighbor === 28)) {
                        this.world.setBlock(x, by, z, 0);
                        this.world.deleteBlockMeta(x, by, z);
                    }
                }
            }
            this.world.deleteBlockMeta(bx, by, bz);
            this.context.addItemToInventory(28, 1);
        } else if (brokenType === 33 || brokenType === 34) {
            const partnerY = brokenType === 33 ? by + 1 : by - 1;
            const partnerType = this.world.getBlock(bx, partnerY, bz);
            if (brokenType === 33 && partnerType === 34) {
                this.world.setBlock(bx, by + 1, bz, 0);
                this.world.deleteBlockMeta(bx, by + 1, bz);
            } else if (brokenType === 34 && partnerType === 33) {
                this.world.setBlock(bx, by - 1, bz, 0);
                this.world.deleteBlockMeta(bx, by - 1, bz);
            }
            this.world.deleteBlockMeta(bx, by, bz);
            this.context.addItemToInventory(33, 1);
        } else if (brokenType === 38 || brokenType === 39) {
            for (let x = bx - 1; x <= bx + 1; x++) {
                for (let z = bz - 1; z <= bz + 1; z++) {
                    const neighbor = this.world.getBlock(x, by, z);
                    if ((brokenType === 38 && neighbor === 39) || (brokenType === 39 && neighbor === 38)) {
                        this.world.setBlock(x, by, z, 0);
                        this.world.deleteBlockMeta(x, by, z);
                    }
                }
            }
            this.world.deleteBlockMeta(bx, by, bz);
            this.context.addItemToInventory(38, 1);
        } else if (brokenType === 56) {
            const dropCount = 1 + Math.floor(Math.random() * 2);
            this.context.addItemToInventory(60, dropCount);
            this.showMessage(`+ ${dropCount}x Kohle`, '#333333', 20);
        } else if (brokenType === 57) {
            this.context.addItemToInventory(57, 1);
            this.showMessage('+ Eisen-Erz', '#C0C0C0', 20);
        } else if (brokenType === 58) {
            this.context.addItemToInventory(58, 1);
            this.showMessage('+ Gold-Erz', '#FFD700', 20);
        } else if (brokenType === 75) {
            const chestKey = `chest,${bx},${by},${bz}`;
            const contents = this.world.chestContents[chestKey] || [];
            for (const item of contents) {
                if (item && item.count > 0) this.context.addItemToInventory(item.type, item.count);
            }
            delete this.world.chestContents[chestKey];
            this.world.lootedChests.delete(chestKey);
            this.context.addItemToInventory(75, 1);
        } else if (brokenType === 46) {
            const stickCount = 1 + Math.floor(Math.random() * 2);
            this.context.addItemToInventory(27, stickCount);
            this.showMessage(`+ ${stickCount}x Stock`, '#8B4513', 20);
        } else if (brokenType === 6 || brokenType === 14) {
            if (Math.random() < 0.2) {
                this.context.addItemToInventory(27, 1);
                this.showMessage('+ Stock', '#8B4513', 20);
            }
        } else if (brokenType === 52) {
            this.context.addItemToInventory(27, 1);
        } else if (brokenType === 43) {
            const berryCount = 1 + Math.floor(Math.random() * 3);
            this.context.addItemToInventory(51, berryCount);
            this.context.addItemToInventory(27, 1);
            this.showMessage(`+ ${berryCount}x Beeren`, '#E53935', 20);
        } else if (brokenType === 79) {
            this.context.addItemToInventory(79, 1);
        } else if (brokenType === 83) {
            const spawnerKey = `${bx},${by},${bz}`;
            delete this.world.spawnerMeta[spawnerKey];
            if (Array.isArray(this.mobs)) {
                for (const mob of this.mobs) {
                    if (mob && mob._spawnerKey === spawnerKey) mob.isDead = true;
                }
            }
            this.context.addItemToInventory(85, 2);
            this.showMessage('Spawner zerstört! 💀', '#8B0000', 20);
        } else if (brokenType === 86) {
            const fireKey = `${bx},${by},${bz}`;
            this.world.fireBlocks.delete(fireKey);
            this.showMessage('Feuer gelöscht! 🔥', '#FF6600', 18);
        } else {
            this.context.addItemToInventory(brokenType, 1);
            if (WOOD_BLOCKS.has(brokenType)) this.showMessage('+ Holz', '#d9a45f', 20);
        }

        this.context.updateInventoryUI();
    }

    async handleInteraction(e) {
        Game.player?.setActionCamera?.(500);
        const currentItem = this._getCurrentItem();
        const heldType = currentItem && currentItem.count > 0 ? currentItem.type : 0;
        const swordInfo = getSwordInfo(heldType);
        const bowInfo = getBowInfo(heldType);

        if (e.button === 0) {
            if (bowInfo) {
                if (this._fireBow(currentItem, bowInfo) && typeof Game.player.startBowAnimation === 'function') {
                    Game.player.startBowAnimation(bowInfo);
                }
                return;
            }
            if (typeof Game.player.startAttackAnimation === 'function') {
                Game.player.startAttackAnimation(swordInfo);
            } else {
                Game.player.isSwinging = true;
                Game.player.swingProgress = 0;
            }
            if (swordInfo) this.SoundManager.playSword();
        }

        this._setAimRay();

        // 0. NPCs prüfen (Tier 3: Handel)
        const activeNpcs = (window.npcs || []).filter(n => !n.isDead && !n.isUnconscious);
        if (activeNpcs.length > 0) {
            const npcMeshes = activeNpcs.map(n => n.group);
            const npcHits = this.raycaster.intersectObjects(npcMeshes, true);
            if (npcHits.length > 0 && npcHits[0].distance <= 3.5) {
                const hitNpc = activeNpcs.find(n => {
                    let p = npcHits[0].object;
                    while(p) { if(p === n.group) return true; p = p.parent; }
                    return false;
                });
                if (hitNpc) {
                    if (e.button === 2) {
                        // Rechtsklick: Handels-UI öffnen
                        openTradeUI(hitNpc, this._controls);
                        return;
                    } else if (e.button === 0) {
                        this.showMessage('Dorfbewohner sind Freunde – sprich mit Rechtsklick.', '#ffe066', 18);
                        return;
                    }
                }
            }
        }

        // 1. Mobs prüfen
        const activeMobs = this.mobs.filter(m => !m.isDead);
        const mobHits = this.raycaster.intersectObjects(activeMobs.map(m => m.mesh), true);
        if (mobHits.length > 0 && mobHits[0].distance <= 3.0) {
            const hitMob = activeMobs.find(m => {
                let p = mobHits[0].object;
                while(p) { if(p === m.mesh) return true; p = p.parent; }
                return false;
            });

            if (hitMob) {
                if (e.button === 0) { // Angreifen
                    const now = performance.now();
                    if (now < this.attackReadyAt) return;
                    const attack = getAttackProfile(heldType);
                    this.attackReadyAt = now + attack.cooldown * 1000;
                    this.lastAttackCooldown = attack.cooldown;
                    this._setAttackCooldown(0, true);
                    hitMob.takeDamage(attack.damage, (killedMob) => {
                        if (hitMob.type === 'pig') {
                            Game.player.hunger = Math.min(MAX_HUNGER, Game.player.hunger + HUNGER_GAIN_PIG);
                        }
                        window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
                            detail: {
                                type: 'hunt',
                                mobType: killedMob.type,
                                position: {
                                    x: killedMob.group.position.x,
                                    z: killedMob.group.position.z
                                }
                            }
                        }));
                    });
                    if (attack.usesDurability) this._wearWeapon(currentItem, swordInfo, 'Schwert');
                } else if (e.button === 2 && hitMob.type === 'cow') { // Melken
                    const now = Date.now();
                    if (now - hitMob.lastMilkTime > CONFIG.MOBS.COW_MILK_TIME_MIN) {
                        hitMob.lastMilkTime = now;
                        this.context.addItemToInventory(18, 1); // MILK
                        this.SoundManager.playCow();
                        this.showMessage("+ Milch 🍼", "#fff");
                    } else {
                        this.showMessage("Keine Milch bereit...", "#ff9800", 18);
                    }
                } else if (e.button === 2 && hitMob.type === 'sheep') { // Scheren
                    const now = Date.now();
                    if (now - hitMob.lastWoolTime > CONFIG.MOBS.SHEEP_WOOL_TIME_MIN) {
                        hitMob.lastWoolTime = now;
                        this.context.addItemToInventory(19, 1); // WOOL
                        this.SoundManager.playSheep();
                        this.showMessage("+ Wolle 🧶", "#fff");
                    } else {
                        this.showMessage("Muss noch Wolle wachsen...", "#ff9800", 19);
                    }
                }
            }
            return; // Interaktion nach Mob-Hit beenden
        }

        // 2. Konsumierbare Items prüfen (Live-Abfrage der Slot-Daten)
        const foodInfo = currentItem ? getFoodInfo(currentItem.type) : null;
        if (e.button === 2 && currentItem && foodInfo) {
            if (currentItem.count > 0) {
                currentItem.count--;
                if (foodInfo.damageChance && Math.random() < foodInfo.damageChance) {
                    Game.player.health -= foodInfo.damage;
                    this.SoundManager.playSound('damage', 1.0, 1.0);
                }

                Game.player.hunger = Math.min(MAX_HUNGER, Game.player.hunger + foodInfo.hunger);
                this.SoundManager.playSound('step_grass', 0.5, 1.5);
                this.context.updateInventoryUI();
                this.context.updateUI();
                this.showMessage(foodInfo.cooked ? 'Lecker gekocht!' : 'Yum!', '#ffe066', 24);
                return;
            }
        }

        // 3. Block-Interaktion (Abbauen/Bauen)
        // Nur Chunks treffen (verhindert Treffer auf das Schwert in der Hand)
        const chunkMeshes = [];
        this.world.chunks.forEach(c => {
            if (c.mesh) chunkMeshes.push(c.mesh);
            if (c.waterMesh) chunkMeshes.push(c.waterMesh);
        });
        
        const hits = this.raycaster.intersectObjects(chunkMeshes);
        if (hits.length > 0) {
            if (hits[0].distance > 3.0) {
                if (e.button === 0) this.showMiningHint('Ziele auf einen Block in Reichweite');
                return;
            }
            
            const h = hits[0].object instanceof THREE.Mesh && hits[0].object.geometry ? hits[0] : null;
            if (!h) return;
            const p = h.point.clone();
            
            if (e.button === 0) {
                // Block abbauen
                p.add(h.face.normal.clone().multiplyScalar(-0.5));
                const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
                const brokenType = this.world.getBlock(bx, by, bz);
                
                const toolType = currentItem && currentItem.count > 0 ? currentItem.type : 0;
                const plan = getMiningPlan(brokenType, toolType);
                this._startMining({ x: bx, y: by, z: bz, normal: h.face.normal.clone() }, plan, toolType);
                return;
            } else if (e.button === 2) {
                // Block platzieren / Interagieren
                // === BEERENBUSCH, OFEN, TRUHE RECHTSKLICK ===
                p.add(h.face.normal.clone().multiplyScalar(-0.5));
                const harvestX = Math.floor(p.x), harvestY = Math.floor(p.y), harvestZ = Math.floor(p.z);
                const harvestBlock = this.world.getBlock(harvestX, harvestY, harvestZ);

                if (this._tryUnlockStructureGate(harvestX, harvestY, harvestZ)) return;

                if (harvestBlock === 33 || harvestBlock === 34) {
                    const doorY = harvestBlock === 34 ? harvestY - 1 : harvestY;
                    const metadata = this.world.getBlockMeta(harvestX, doorY, harvestZ);
                    const nextMetadata = metadata ^ 4;
                    this.world.setBlockMeta(harvestX, doorY, harvestZ, nextMetadata);
                    this.world.setBlockMeta(harvestX, doorY + 1, harvestZ, nextMetadata);
                    this.SoundManager.playSound('dig_wood', 0.45, nextMetadata & 4 ? 1.15 : 0.9);
                    return;
                }

                if (harvestBlock === 103) {
                    const nextMetadata = this.world.getBlockMeta(harvestX, harvestY, harvestZ) ^ 4;
                    this.world.setBlockMeta(harvestX, harvestY, harvestZ, nextMetadata);
                    this.SoundManager.playSound('dig_wood', 0.45, nextMetadata & 4 ? 1.15 : 0.9);
                    return;
                }

                if (harvestBlock === 28 || harvestBlock === 36) {
                    if (typeof this.context.openWorkbenchCrafting === 'function') {
                        this.context.openWorkbenchCrafting();
                    }
                    return;
                }

                if (harvestBlock === 38 || harvestBlock === 39) {
                    if (typeof window.trySleepInBed === 'function') {
                        const result = window.trySleepInBed({ x: harvestX, y: harvestY, z: harvestZ });
                        if (result && result.message) {
                            this.showMessage(result.message, result.ok ? '#ffe066' : '#ff9800', 20);
                        }
                    }
                    return;
                }

                // OFEN: Rechtsklick öffnet Ofen-UI
                if (harvestBlock === 59) {
                    openFurnace(harvestX, harvestY, harvestZ, this._controls);
                    return;
                }

                // TRUHE: Rechtsklick öffnet Truhen-UI
                if (harvestBlock === 75) {
                    this._openChest(harvestX, harvestY, harvestZ);
                    return;
                }

                if (harvestBlock === 43) { // Voller Beerenbusch
                    const berryCount = 1 + Math.floor(Math.random() * 3);
                    this.context.addItemToInventory(51, berryCount);
                    this.world.setBlock(harvestX, harvestY, harvestZ, 52);
                    this.SoundManager.playSound('step_grass', 0.5, 1.2);
                    this.showMessage(`+ ${berryCount}x Beeren`, "#E53935", 20);
                    this.context.updateInventoryUI();
                    return;
                }
                // Point zurücksetzen für normale Platzierung
                p.copy(h.point.clone());

                // Werkzeuge, Barren, Items können nicht platziert werden
                const unplaceable = [17, 18, 21, 22, 23, 24, 25, 31, 34, 39, 51,
                    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
                    89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
                
                if (currentItem.count <= 0 || currentItem.type === 0 || unplaceable.includes(currentItem.type)) {
                    return; 
                }
                
                p.add(h.face.normal.clone().multiplyScalar(0.5));
                let px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
                const placedType = currentItem.type;
                
                // Kollisions-Check
                const pPos = this.camera.position;
                if (currentItem.type !== TORCH_TYPE &&
                    pPos.x + 0.3 > px && pPos.x - 0.3 < px + 1 &&
                    pPos.y + 0.1 > py && pPos.y - 1.6 < py + 1 &&
                    pPos.z + 0.3 > pz && pPos.z - 0.3 < pz + 1) {
                    return; 
                }
                
                // Doppel-Werkbank-Check
                if (currentItem.type === 28) {
                    // Prüfen, welche Seite frei ist (quer zur Blickrichtung)
                    const fwd = new THREE.Vector3();
                    this._getAimDirection(fwd);
                    let sx = 0, sz = 0;
                    if (Math.abs(fwd.x) > Math.abs(fwd.z)) { sz = 1; } else { sx = 1; }
                    
                    if (this.world.getBlock(px + sx, py, pz + sz) === 0) {
                        const direction = sx > 0 ? 0 : sz > 0 ? 2 : sx < 0 ? 1 : 3;
                        this.world.setBlock(px, py, pz, 28);
                        this.world.setBlockMeta(px, py, pz, direction);
                        this.world.setBlock(px + sx, py, pz + sz, 36);
                        this.world.setBlockMeta(px + sx, py, pz + sz, direction);
                        currentItem.count--;
                    } else if (this.world.getBlock(px - sx, py, pz - sz) === 0) {
                        const direction = sx > 0 ? 1 : sz > 0 ? 3 : sx < 0 ? 0 : 2;
                        this.world.setBlock(px, py, pz, 28);
                        this.world.setBlockMeta(px, py, pz, direction);
                        this.world.setBlock(px - sx, py, pz - sz, 36);
                        this.world.setBlockMeta(px - sx, py, pz - sz, direction);
                        currentItem.count--;
                    } else {
                        this.showMessage("Kein Platz für breite Werkbank!", "#ff9800", 20);
                        return;
                    }
                // TÜR platzieren: Unten + Oben setzen
                } else if (currentItem.type === 33) {
                    const fwd = new THREE.Vector3();
                    this._getAimDirection(fwd);
                    const rotation = Math.abs(fwd.x) > Math.abs(fwd.z) ? 1 : 0;

                    if (this.world.getBlock(px, py + 1, pz) === 0) {
                        this.world.setBlock(px, py, pz, 33);
                        this.world.setBlockMeta(px, py, pz, rotation);
                        this.world.setBlock(px, py + 1, pz, 34);
                        this.world.setBlockMeta(px, py + 1, pz, rotation);
                        currentItem.count--;
                    } else {
                        this.showMessage("Kein Platz für die Tür!", "#ff9800", 20);
                        return;
                    }
                } else if (currentItem.type === 103) {
                    const fwd = new THREE.Vector3();
                    this._getAimDirection(fwd);
                    const rotation = Math.abs(fwd.x) > Math.abs(fwd.z) ? 1 : 0;
                    this.world.setBlock(px, py, pz, 103);
                    this.world.setBlockMeta(px, py, pz, rotation);
                    currentItem.count--;
                // BETT platzieren: Kopfteil + Fußteil nebeneinander
                } else if (currentItem.type === 38) {
                    const fwd = new THREE.Vector3();
                    this._getAimDirection(fwd);
                    let sx = 0, sz = 0;
                    if (Math.abs(fwd.x) > Math.abs(fwd.z)) { sz = 1; } else { sx = 1; }
                    
                    if (this.world.getBlock(px + sx, py, pz + sz) === 0) {
                        const direction = sx > 0 ? 0 : sz > 0 ? 2 : sx < 0 ? 1 : 3;
                        this.world.setBlock(px, py, pz, 38);
                        this.world.setBlockMeta(px, py, pz, direction);
                        this.world.setBlock(px + sx, py, pz + sz, 39);
                        this.world.setBlockMeta(px + sx, py, pz + sz, direction);
                        currentItem.count--;
                    } else if (this.world.getBlock(px - sx, py, pz - sz) === 0) {
                        const direction = sx > 0 ? 1 : sz > 0 ? 3 : sx < 0 ? 0 : 2;
                        this.world.setBlock(px, py, pz, 38);
                        this.world.setBlockMeta(px, py, pz, direction);
                        this.world.setBlock(px - sx, py, pz - sz, 39);
                        this.world.setBlockMeta(px - sx, py, pz - sz, direction);
                        currentItem.count--;
                    } else {
                        this.showMessage("Kein Platz für das Bett!", "#ff9800", 20);
                        return;
                    }
                } else if (currentItem.type === TORCH_TYPE) {
                    const mount = getTorchMount(h.face.normal);
                    if (mount === null) {
                        this.showMessage('Fackeln können nicht an Decken hängen.', '#ff9800', 18);
                        return;
                    }
                    if (TORCH_NON_SUPPORT_BLOCKS.has(harvestBlock) || this.world.getBlock(px, py, pz) !== 0) {
                        this.showMessage('Hier kann keine Fackel befestigt werden.', '#ff9800', 18);
                        return;
                    }
                    this.world.setBlockMeta(px, py, pz, mount);
                    this.world.setBlock(px, py, pz, TORCH_TYPE);
                    currentItem.count--;
                } else {
                    this.world.setBlock(px, py, pz, currentItem.type);
                    currentItem.count--;
                }
                window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
                    detail: { type: 'place', itemType: placedType, position: { x: px, y: py, z: pz } }
                }));
                // Place-Sound: Dig-Sound bei höherer Pitch klingt wie "Setz"-Klang.
                // Vorher gab es gar keinen Sound beim Bauen (im Gegensatz zum Abbauen).
                this.SoundManager.playSound('dig_' + this.SoundManager.getSoundCategory(currentItem.type), 0.5, 1.4);
                this.context.updateInventoryUI();
            }
        } else if (e.button === 0) {
            this.showMiningHint('Schaue auf einen Baum und halte Linksklick');
        }
    }

    _tryUnlockStructureGate(x, y, z) {
        const gateInfo = this.world.structureGates?.get(`${x},${y},${z}`);
        if (!gateInfo) return false;
        if (!this.world.structureProgress) this.world.structureProgress = {};
        const progress = this.world.structureProgress[gateInfo.structureId] || {};
        if (!progress.keyFound) {
            this.showMessage('Das Tor ist verschlossen. Der Schlüssel liegt im oberen Dungeon.', '#ff9800', 18);
            return true;
        }

        const gate = gateInfo.gate;
        for (let width = -1; width <= 1; width++) {
            for (let dy = 0; dy <= 2; dy++) {
                const gx = gate.x + (gate.widthAxis === 'x' ? width : 0);
                const gz = gate.z + (gate.widthAxis === 'z' ? width : 0);
                this.world.setBlock(gx, gate.y + dy, gz, 0);
                this.world.structureGates.delete(`${gx},${gate.y + dy},${gz}`);
            }
        }
        this.world.structureProgress[gateInfo.structureId] = { ...progress, gateOpened: true };
        window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
            detail: { type: 'structure', structureKind: 'dungeon-gate', structureId: gateInfo.structureId }
        }));
        window.dispatchEvent(new CustomEvent(STORY_EVENTS.DUNGEON_GATE_OPENED));
        this.showMessage('Das Dungeon-Tor öffnet sich.', '#ffe066', 18);
        return true;
    }

    // Truhe öffnen und Loot lazy generieren
    _openChest(x, y, z) {
        const key = `chest,${x},${y},${z}`;
        const structureChest = this.world.structureChests?.get(key);
        const wasLooted = this.world.lootedChests.has(key);
        if (wasLooted && structureChest?.role === 'dungeon_reward' && typeof window.tryActivateBloodMoonRitual === 'function') {
            const result = window.tryActivateBloodMoonRitual({
                structureId: structureChest.structureId,
                position: { x, y: y + 1.5, z }
            });
            if (result?.message) this.showMessage(result.message, result.ok ? '#ff647c' : '#ffe066', 18);
            if (result?.ok) return;
        }
        // Loot nur einmal generieren: lootedChests merkt sich alle je geöffneten Kisten.
        // Auch nach Save/Load wird kein Loot mehr nachgefüllt.
        if (!wasLooted) {
            const biome = window.getBiomeAt ? window.getBiomeAt(x, z) : 'Grasland';
            const biomeType = structureChest?.lootTable || classifyChestLoot({
                    x,
                    y,
                    z,
                    biome,
                    villages: this.world.villages || [],
                    getBlock: (bx, by, bz) => this.world.getBlock(bx, by, bz)
                });
            this.world.chestContents[key] = rollLoot(biomeType, x * 7013 + y * 3517 + z * 1223);
            this.world.lootedChests.add(key);
            if (structureChest?.role === 'dungeon_key') {
                if (!this.world.structureProgress) this.world.structureProgress = {};
                const progress = this.world.structureProgress[structureChest.structureId] || {};
                this.world.structureProgress[structureChest.structureId] = { ...progress, keyFound: true };
                window.dispatchEvent(new CustomEvent(STORY_EVENTS.DUNGEON_KEY_FOUND));
            }
            if (structureChest?.role === 'mine_reward' || structureChest?.role === 'dungeon_reward') {
                window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
                    detail: {
                        type: 'structure',
                        structureKind: structureChest.role === 'mine_reward' ? 'mine' : 'dungeon',
                        structureId: structureChest.structureId,
                        position: { x, y, z }
                    }
                }));
                const storyEvent = structureChest.role === 'mine_reward'
                    ? STORY_EVENTS.MINE_COMPLETED
                    : STORY_EVENTS.DUNGEON_COMPLETED;
                window.dispatchEvent(new CustomEvent(storyEvent, {
                    detail: { structureId: structureChest.structureId, position: { x, y, z } }
                }));
            }
            this.showMessage(getLootDiscoveryMessage(biomeType), '#ffe066', 18);
        }
        if (!this.world.chestContents[key]) this.world.chestContents[key] = [];
        const contents = this.world.chestContents[key];

        // Truhen-UI befüllen
        const grid = document.getElementById('chest-grid');
        if (grid) {
            grid.innerHTML = '';
            for (let i = 0; i < 15; i++) {
                const slot = document.createElement('div');
                slot.className = 'inv-slot';
                slot.style.width = '60px'; slot.style.height = '60px'; slot.style.position = 'relative';
                const item = contents[i];
                if (item && item.count > 0) {
                    const iconWrap = document.createElement('div');
                    iconWrap.className = 'slot-color-preview';
                    iconWrap.style.pointerEvents = 'none';
                    iconWrap.style.background = 'none';
                    iconWrap.style.display = 'flex';
                    iconWrap.style.justifyContent = 'center';
                    iconWrap.innerHTML = createBlockHTML(item.type);
                    const countEl = document.createElement('span');
                    countEl.className = 'slot-count';
                    countEl.style.pointerEvents = 'none';
                    countEl.textContent = item.count > 1 ? item.count : '';
                    slot.append(iconWrap, countEl);
                    slot.title = getItemName(item.type);
                    slot.style.cursor = 'pointer';
                    slot.onclick = () => {
                        const currentItem = contents[i];
                        if (!currentItem || currentItem.count <= 0) return;
                        const result = this.context.addItemToInventory(currentItem.type, currentItem.count);
                        if (result && result.remaining > 0) {
                            currentItem.count = result.remaining;
                            countEl.textContent = currentItem.count > 1 ? currentItem.count : '';
                            this.world.chestContents[key] = contents;
                            this.context.updateInventoryUI();
                            return;
                        }
                        contents[i] = { type: 0, count: 0 };
                        this.world.chestContents[key] = contents;
                        slot.innerHTML = '';
                        slot.title = '';
                        slot.style.cursor = '';
                        slot.onclick = null;
                        this.context.updateInventoryUI();
                    };
                }
                grid.appendChild(slot);
            }
        }

        const overlay = document.getElementById('chest-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            activateDialog(overlay, '.panel-close-button');
        }
        if (this._controls) this._controls.unlock();

        window.closeChest = () => {
            deactivateDialog(overlay);
            if (overlay) overlay.style.display = 'none';
            if (this._controls && !Game.touchActive) {
                if (typeof window.resumeGame === 'function') window.resumeGame();
                else this._controls.lock();
            }
        };
    }

    // Druckplatten-Schaden prüfen — wird aus dem Game-Loop aufgerufen
    checkPressurePlates(playerX, playerY, playerZ) {
        const bx = Math.floor(playerX), by = Math.floor(playerY - 0.1), bz = Math.floor(playerZ);
        const plateKey = `${bx},${by},${bz}`;
        if (this.world.getBlock(bx, by, bz) !== 79) {
            this.activePressurePlateKey = null;
            return false;
        }
        if (this.activePressurePlateKey === plateKey) return false;

        this.activePressurePlateKey = plateKey;
        Game.player.health = Math.max(0, Game.player.health - 2);
        this.SoundManager.playSound('damage', 0.8, 1.0);
        this.showMessage('Falle! -2 HP', '#ff0000', 18);
        return true;
    }

    showMessage(text, color, fontSize = 32) {
        const msg = document.createElement('div');
        msg.innerText = text;
        msg.style = `position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); color:${color}; font-weight:bold; pointer-events:none; animation: fade-up 1.5s forwards; text-shadow: 0 0 10px rgba(0,0,0,0.5); font-size: ${fontSize}px; z-index: 2000;`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
    }

    showMiningHint(text) {
        if (!text) return;
        const now = Date.now();
        if (now - this.lastMiningHintAt < MINING_HINT_COOLDOWN_MS) return;
        this.lastMiningHintAt = now;
        this.showMessage(text, '#ffe066', 18);
    }
}
