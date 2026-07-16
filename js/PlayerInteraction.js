import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { rollLoot } from './structures.js?v=20260507b';
import { openFurnace } from './furnace.js?v=20260507b';
import { createBlockHTML, getItemName } from './inventory.js?v=20260716a';
import { BLOCK_COLORS } from './blocks.js?v=20260507b';
import { Game } from './Game.js?v=20260507b';

const { MAX_HUNGER, HUNGER_GAIN_EGG, HUNGER_GAIN_MILK, HUNGER_GAIN_PIG } = CONFIG.GAMEPLAY;

// Werkzeug-Kategorien und Materialien
const TOOL_TYPES = {
    pickaxe: { materials: [63, 64, 65, 66], goodBlocks: new Set([3, 29, 56, 57, 58, 59, 30, 20, 78, 83, 84, 85]) },
    axe:     { materials: [67, 68, 69, 70], goodBlocks: new Set([5, 13, 15, 26, 28, 36, 75, 81]) },
    shovel:  { materials: [71, 72, 73, 74], goodBlocks: new Set([2, 1, 7, 11, 77]) },
};
const TOOL_DURABILITY = { wood: 60, stone: 131, iron: 250, gold: 32 };
const MATERIAL_IDX = [0, 1, 2, 3]; // wood/stone/iron/gold = offset 0-3 in each category

const WOOD_BLOCKS = new Set([5, 13, 15]);
const MINING_HINT_COOLDOWN_MS = 1800;

function getToolInfo(toolType) {
    for (const [cat, info] of Object.entries(TOOL_TYPES)) {
        const idx = info.materials.indexOf(toolType);
        if (idx !== -1) {
            const matNames = ['wood', 'stone', 'iron', 'gold'];
            return { cat, matName: matNames[idx], goodBlocks: info.goodBlocks, maxDurability: TOOL_DURABILITY[matNames[idx]] };
        }
    }
    return null;
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
        this.lastMiningHintAt = 0;
    }

    spawnBlockBreakParticles(x, y, z, blockType, normal) {
        const color = BLOCK_COLORS[blockType] || 0xaaaaaa;
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
        const geometry = new THREE.BoxGeometry(0.09, 0.09, 0.09);
        const particles = [];
        const baseNormal = normal ? normal.clone() : new THREE.Vector3(0, 1, 0);

        for (let i = 0; i < 10; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                x + 0.5 + (Math.random() - 0.5) * 0.55,
                y + 0.5 + (Math.random() - 0.5) * 0.55,
                z + 0.5 + (Math.random() - 0.5) * 0.55
            );
            this.scene.add(mesh);
            particles.push({
                mesh,
                velocity: baseNormal.clone().multiplyScalar(1.6 + Math.random() * 1.4).add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2.2,
                    Math.random() * 1.6,
                    (Math.random() - 0.5) * 2.2
                ))
            });
        }

        const startedAt = performance.now();
        const lifetimeMs = 360;
        let lastAt = startedAt;
        const tick = (now) => {
            const delta = Math.min((now - lastAt) / 1000, 0.04);
            lastAt = now;
            const age = now - startedAt;
            const alpha = Math.max(0, 1 - age / lifetimeMs);
            material.opacity = alpha * 0.9;

            for (const particle of particles) {
                particle.velocity.y -= 5.5 * delta;
                particle.mesh.position.addScaledVector(particle.velocity, delta);
                particle.mesh.rotation.x += delta * 8;
                particle.mesh.rotation.y += delta * 6;
                const scale = 0.65 + alpha * 0.35;
                particle.mesh.scale.setScalar(scale);
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
                ? window.butzcraftCanInteract()
                : (controls.isLocked || window.touchActive);
            if (!lockOk || !getGameActive() || getSpawning()) return;
            this.handleInteraction(e);
        };
        document.addEventListener('mousedown', this._onMouseDown);
    }

    destroy() {
        if (this._onMouseDown) {
            document.removeEventListener('mousedown', this._onMouseDown);
            this._onMouseDown = null;
        }
    }

    async handleInteraction(e) {
        // Schlag-Animation triggern
        if (e.button === 0) { 
            Game.player.isSwinging = true;
            Game.player.swingProgress = 0;
            this.SoundManager.playSword();
        }

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        // 0. NPCs prüfen (Tier 3: Handel)
        const activeNpcs = (window.npcs || []).filter(n => !n.isDead);
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
                        const { openTradeUI } = await import('./tradeUI.js');
                        openTradeUI(hitNpc, this._controls);
                        return;
                    } else if (e.button === 0) {
                        // Linksklick: NPC angreifen
                        hitNpc.takeDamage(10);
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
                    hitMob.takeDamage(10, (amount) => {
                        if (hitMob.type === 'pig') {
                            Game.player.hunger = Math.min(MAX_HUNGER, Game.player.hunger + HUNGER_GAIN_PIG);
                        }
                    });
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
        const currentSlotIdx = (typeof window.getSelectedSlot === 'function') ? window.getSelectedSlot() : this.context.getSelectedSlot();
        const inventorySlots = (window.inventorySlots) ? window.inventorySlots : this.context.getInventorySlots();
        const currentItem = inventorySlots[currentSlotIdx];
        
        if (e.button === 2 && currentItem && (currentItem.type === 17 || currentItem.type === 18 || (currentItem.type >= 21 && currentItem.type <= 25) || currentItem.type === 51 || currentItem.type === 55)) {
            if (currentItem.count > 0) {
                currentItem.count--;
                let gain = 0;
                if (currentItem.type === 17) gain = HUNGER_GAIN_EGG;
                else if (currentItem.type === 18) gain = HUNGER_GAIN_MILK;
                else if (currentItem.type === 21) gain = 10; // Fisch
                else if (currentItem.type === 22) gain = 15; // Fleisch
                else if (currentItem.type === 23) gain = 10; // Hähnchen
                else if (currentItem.type === 24) gain = 5;  // Zombie
                else if (currentItem.type === 25) gain = 12; // Mutton
                else if (currentItem.type === 51) gain = 8;  // Beeren
                else if (currentItem.type === 55) gain = 12; // Schildkröte
                // Wenn es vergammelt ist, 30% Chance auf kleinen Schaden
                if (currentItem.type === 24 && Math.random() < 0.3) {
                    Game.player.health -= 5;
                    this.SoundManager.playSound('damage', 1.0, 1.0);
                }

                Game.player.hunger = Math.min(MAX_HUNGER, Game.player.hunger + gain);
                this.SoundManager.playSound('step_grass', 0.5, 1.5);
                this.context.updateInventoryUI();
                this.context.updateUI();
                this.showMessage("Yum! 😋", "#ffe066", 24);
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
                
                // Wasser und Bedrock können nicht abgebaut werden
                if (brokenType === 4 || brokenType === 0 || brokenType === 20) {
                    this.showMiningHint('Diesen Block kannst du nicht abbauen');
                    return;
                }

                // Wasser-Einströmen prüfen
                const isNextToWater = (
                    this.world.getBlock(bx, by + 1, bz) === 4 ||
                    this.world.getBlock(bx - 1, by, bz) === 4 ||
                    this.world.getBlock(bx + 1, by, bz) === 4 ||
                    this.world.getBlock(bx, by, bz - 1) === 4 ||
                    this.world.getBlock(bx, by, bz + 1) === 4
                );

                this.world.setBlock(bx, by, bz, isNextToWater ? 4 : 0);
                this.SoundManager.playDig(brokenType);
                this.spawnBlockBreakParticles(bx, by, bz, brokenType, h.face.normal);

                // Werkzeug-Haltbarkeit reduzieren
                const toolInfo = getToolInfo(currentItem ? currentItem.type : 0);
                if (toolInfo) {
                    if (!currentItem.durability) currentItem.durability = toolInfo.maxDurability;
                    currentItem.durability--;
                    if (currentItem.durability <= 0) {
                        currentItem.type = 0; currentItem.count = 0; currentItem.durability = 0;
                        this.showMessage('Werkzeug kaputt!', '#ff4444', 20);
                    }
                }

                // Doppel-Werkbank Logik
                if (brokenType === 28 || brokenType === 36) {
                    for (let x = bx - 1; x <= bx + 1; x++) {
                        for (let z = bz - 1; z <= bz + 1; z++) {
                            const neighbor = this.world.getBlock(x, by, z);
                            if ((brokenType === 28 && neighbor === 36) || (brokenType === 36 && neighbor === 28)) {
                                this.world.setBlock(x, by, z, 0);
                            }
                        }
                    }
                    this.context.addItemToInventory(28, 1);
                // TÜR abbauen
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
                // BETT abbauen
                } else if (brokenType === 38 || brokenType === 39) {
                    for (let x = bx - 1; x <= bx + 1; x++) {
                        for (let z = bz - 1; z <= bz + 1; z++) {
                            const neighbor = this.world.getBlock(x, by, z);
                            if ((brokenType === 38 && neighbor === 39) || (brokenType === 39 && neighbor === 38)) {
                                this.world.setBlock(x, by, z, 0);
                            }
                        }
                    }
                    this.context.addItemToInventory(38, 1);
                // ERZ-Drops: Kohle-Erz → Kohle; Eisen/Gold-Erz → Erz selbst (zum Schmelzen)
                } else if (brokenType === 56) {
                    const dropCount = 1 + Math.floor(Math.random() * 2);
                    this.context.addItemToInventory(60, dropCount); // COAL
                    this.showMessage(`+ ${dropCount}x Kohle`, '#333333', 20);
                } else if (brokenType === 57) {
                    this.context.addItemToInventory(57, 1); // IRON_ORE (zum Schmelzen)
                    this.showMessage('+ Eisen-Erz', '#C0C0C0', 20);
                } else if (brokenType === 58) {
                    this.context.addItemToInventory(58, 1); // GOLD_ORE (zum Schmelzen)
                    this.showMessage('+ Gold-Erz', '#FFD700', 20);
                // TRUHE: Inhalt und Block droppen
                } else if (brokenType === 75) {
                    const chestKey = `chest,${bx},${by},${bz}`;
                    const contents = this.world.chestContents[chestKey] || [];
                    for (const item of contents) {
                        if (item && item.count > 0) this.context.addItemToInventory(item.type, item.count);
                    }
                    delete this.world.chestContents[chestKey];
                    this.world.lootedChests.delete(chestKey); // Abgebaute Kiste zurücksetzen
                    this.context.addItemToInventory(75, 1);
                // TOTER STRAUCH
                } else if (brokenType === 46) {
                    const stickCount = 1 + Math.floor(Math.random() * 2);
                    this.context.addItemToInventory(27, stickCount);
                    this.showMessage(`+ ${stickCount}x Stock`, "#8B4513", 20);
                // BLÄTTER
                } else if (brokenType === 6 || brokenType === 14) {
                    if (Math.random() < 0.2) {
                        this.context.addItemToInventory(27, 1);
                        this.showMessage("+ Stock", "#8B4513", 20);
                    }
                // LEERER BEERENBUSCH
                } else if (brokenType === 52) {
                    this.context.addItemToInventory(27, 1);
                // VOLLER BEERENBUSCH
                } else if (brokenType === 43) {
                    const berryCount = 1 + Math.floor(Math.random() * 3);
                    this.context.addItemToInventory(51, berryCount);
                    this.context.addItemToInventory(27, 1);
                    this.showMessage(`+ ${berryCount}x Beeren`, "#E53935", 20);
                // DRUCKPLATTE: fallen lassen
                } else if (brokenType === 79) {
                    this.context.addItemToInventory(79, 1);
                // SPAWNER: Abbau zerstört den Spawner, droppt nur Cobblestone
                } else if (brokenType === 83) {
                    const spawnerKey = `${bx},${by},${bz}`;
                    delete this.world.spawnerMeta[spawnerKey];
                    if (Array.isArray(this.mobs)) {
                        for (const mob of this.mobs) {
                            if (mob && mob._spawnerKey === spawnerKey) mob.isDead = true;
                        }
                    }
                    this.context.addItemToInventory(85, 2); // 2x Cobblestone
                    this.showMessage('Spawner zerstört! 💀', '#8B0000', 20);
                // FEUER: Feuer löschen, kein Drop
                } else if (brokenType === 86) {
                    const fireKey = `${bx},${by},${bz}`;
                    this.world.fireBlocks.delete(fireKey);
                    this.showMessage('Feuer gelöscht! 🔥', '#FF6600', 18);
                } else if (brokenType !== 0) {
                    this.context.addItemToInventory(brokenType, 1);
                    if (WOOD_BLOCKS.has(brokenType)) this.showMessage('+ Holz', '#d9a45f', 20);
                }

                this.context.updateInventoryUI();

                
            } else if (e.button === 2) {
                // Block platzieren / Interagieren
                // === BEERENBUSCH, OFEN, TRUHE RECHTSKLICK ===
                p.add(h.face.normal.clone().multiplyScalar(-0.5));
                const harvestX = Math.floor(p.x), harvestY = Math.floor(p.y), harvestZ = Math.floor(p.z);
                const harvestBlock = this.world.getBlock(harvestX, harvestY, harvestZ);

                if (harvestBlock === 38 || harvestBlock === 39) {
                    if (typeof window.trySleepInBed === 'function') {
                        const result = window.trySleepInBed();
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
                    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74];
                
                if (currentItem.count <= 0 || currentItem.type === 0 || unplaceable.includes(currentItem.type)) {
                    return; 
                }
                
                p.add(h.face.normal.clone().multiplyScalar(0.5));
                let px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
                
                // Kollisions-Check
                const pPos = this.camera.position;
                if (pPos.x + 0.3 > px && pPos.x - 0.3 < px + 1 &&
                    pPos.y + 0.1 > py && pPos.y - 1.6 < py + 1 &&
                    pPos.z + 0.3 > pz && pPos.z - 0.3 < pz + 1) {
                    return; 
                }
                
                // Doppel-Werkbank-Check
                if (currentItem.type === 28) {
                    // Prüfen, welche Seite frei ist (quer zur Blickrichtung)
                    const fwd = new THREE.Vector3();
                    this.camera.getWorldDirection(fwd);
                    let sx = 0, sz = 0;
                    if (Math.abs(fwd.x) > Math.abs(fwd.z)) { sz = 1; } else { sx = 1; }
                    
                    if (this.world.getBlock(px + sx, py, pz + sz) === 0) {
                        this.world.setBlock(px, py, pz, 28);
                        this.world.setBlock(px + sx, py, pz + sz, 36);
                        currentItem.count--;
                    } else if (this.world.getBlock(px - sx, py, pz - sz) === 0) {
                        this.world.setBlock(px, py, pz, 28);
                        this.world.setBlock(px - sx, py, pz - sz, 36);
                        currentItem.count--;
                    } else {
                        this.showMessage("Kein Platz für breite Werkbank!", "#ff9800", 20);
                        return;
                    }
                // TÜR platzieren: Unten + Oben setzen
                } else if (currentItem.type === 33) {
                    const fwd = new THREE.Vector3();
                    this.camera.getWorldDirection(fwd);
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
                // BETT platzieren: Kopfteil + Fußteil nebeneinander
                } else if (currentItem.type === 38) {
                    const fwd = new THREE.Vector3();
                    this.camera.getWorldDirection(fwd);
                    let sx = 0, sz = 0;
                    if (Math.abs(fwd.x) > Math.abs(fwd.z)) { sz = 1; } else { sx = 1; }
                    
                    if (this.world.getBlock(px + sx, py, pz + sz) === 0) {
                        this.world.setBlock(px, py, pz, 38);
                        this.world.setBlock(px + sx, py, pz + sz, 39);
                        currentItem.count--;
                    } else if (this.world.getBlock(px - sx, py, pz - sz) === 0) {
                        this.world.setBlock(px, py, pz, 38);
                        this.world.setBlock(px - sx, py, pz - sz, 39);
                        currentItem.count--;
                    } else {
                        this.showMessage("Kein Platz für das Bett!", "#ff9800", 20);
                        return;
                    }
                } else {
                    this.world.setBlock(px, py, pz, currentItem.type);
                    currentItem.count--;
                }
                // Place-Sound: Dig-Sound bei höherer Pitch klingt wie "Setz"-Klang.
                // Vorher gab es gar keinen Sound beim Bauen (im Gegensatz zum Abbauen).
                this.SoundManager.playSound('dig_' + this.SoundManager.getSoundCategory(currentItem.type), 0.5, 1.4);
                this.context.updateInventoryUI();
            }
        } else if (e.button === 0) {
            this.showMiningHint('Schaue auf einen Baum und halte Linksklick');
        }
    }

    // Truhe öffnen und Loot lazy generieren
    _openChest(x, y, z) {
        const key = `chest,${x},${y},${z}`;
        // Loot nur einmal generieren: lootedChests merkt sich alle je geöffneten Kisten.
        // Auch nach Save/Load wird kein Loot mehr nachgefüllt.
        if (!this.world.lootedChests.has(key)) {
            // Biom-Typ bestimmen — Dungeon-Erkennung über Y-Level + umgebende Blöcke
            let biomeType;
            if (y <= 18) {
                // Tief unterirdisch: prüfe ob Dungeon-Blöcke in der Nähe
                let dungeonBlocks = 0;
                for (let dx = -2; dx <= 2; dx++) {
                    for (let dz = -2; dz <= 2; dz++) {
                        const nb = this.world.getBlock(x + dx, y, z + dz);
                        if (nb === 84 || nb === 85 || nb === 83) dungeonBlocks++;
                    }
                }
                biomeType = dungeonBlocks >= 3 ? 'dungeon' : 'mine';
            } else {
                const biome = window.getBiomeAt ? window.getBiomeAt(x, z) : 'Grasland';
                biomeType = (biome === 'Wüste') ? 'temple' : (biome === 'Schneefeld') ? 'igloo' : 'mine';
            }
            this.world.chestContents[key] = rollLoot(biomeType, x * 7013 + y * 3517 + z * 1223);
            this.world.lootedChests.add(key);
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
        if (overlay) overlay.style.display = 'flex';
        if (this._controls) this._controls.unlock();

        window.closeChest = () => {
            if (overlay) overlay.style.display = 'none';
            if (this._controls && !window.touchActive) {
                if (typeof window.resumeGame === 'function') window.resumeGame();
                else this._controls.lock();
            }
        };
    }

    // Druckplatten-Schaden prüfen — wird aus dem Game-Loop aufgerufen
    checkPressurePlates(playerX, playerY, playerZ) {
        const bx = Math.floor(playerX), by = Math.floor(playerY - 0.1), bz = Math.floor(playerZ);
        if (this.world.getBlock(bx, by, bz) === 79) {
            Game.player.health = Math.max(0, Game.player.health - 2);
            this.SoundManager.playSound('damage', 0.8, 1.0);
            this.showMessage('Falle! -2 HP', '#ff0000', 18);
        }
    }

    showMessage(text, color, fontSize = 32) {
        const msg = document.createElement('div');
        msg.innerText = text;
        msg.style = `position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); color:${color}; font-weight:bold; pointer-events:none; animation: fade-up 1.5s forwards; text-shadow: 0 0 10px rgba(0,0,0,0.5); font-size: ${fontSize}px; z-index: 2000;`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
    }

    showMiningHint(text) {
        const now = Date.now();
        if (now - this.lastMiningHintAt < MINING_HINT_COOLDOWN_MS) return;
        this.lastMiningHintAt = now;
        this.showMessage(text, '#ffe066', 18);
    }
}
