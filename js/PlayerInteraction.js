import * as THREE from 'three';
import { CONFIG } from '../config.js';

const { MAX_HUNGER, HUNGER_GAIN_EGG, HUNGER_GAIN_MILK, HUNGER_GAIN_PIG } = CONFIG.GAMEPLAY;

export class PlayerInteraction {
    constructor(camera, scene, world, mobs, SoundManager, context) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.mobs = mobs;
        this.SoundManager = SoundManager;
        this.context = context; 
        
        this.raycaster = new THREE.Raycaster();
    }

    init(controls, getGameActive, getSpawning) {
        // Cleanup: falls init() mehrfach gerufen wird (z.B. nach loadGame), alten
        // Listener entfernen. Sonst feuert ein Klick mehrfach → "Doppelschlag"-Bug.
        this.destroy();
        this._onMouseDown = (e) => {
            // PointerLock ist auf Touch-Geräten nicht verfügbar → bei aktivem Touch-Mode
            // wird die isLocked-Check übersprungen (Touch-Buttons feuern synthetische mousedowns).
            const lockOk = controls.isLocked || window.touchActive;
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

    handleInteraction(e) {
        // Schlag-Animation triggern
        if (e.button === 0) { 
            window.player.isSwinging = true; 
            window.player.swingProgress = 0; 
            this.SoundManager.playSword();
        }

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

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
                            window.player.hunger = Math.min(MAX_HUNGER, window.player.hunger + HUNGER_GAIN_PIG);
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
                    window.player.health -= 5;
                    this.SoundManager.playSound('damage', 1.0, 1.0);
                }

                window.player.hunger = Math.min(MAX_HUNGER, window.player.hunger + gain);
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
            if (hits[0].distance > 3.0) return;
            
            const h = hits[0].object instanceof THREE.Mesh && hits[0].object.geometry ? hits[0] : null;
            if (!h) return;
            const p = h.point.clone();
            
            if (e.button === 0) {
                // Block abbauen
                p.add(h.face.normal.clone().multiplyScalar(-0.5));
                const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
                const brokenType = this.world.getBlock(bx, by, bz);
                
                // Wasser und Bedrock können nicht abgebaut werden
                if (brokenType === 4 || brokenType === 0 || brokenType === 20) return;

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
                
                // Doppel-Werkbank Logik: Anderen Teil finden und löschen
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
                // TÜR abbauen: Partner-Block (oben/unten) entfernen
                } else if ((brokenType & 0x3f) === 33 || (brokenType & 0x3f) === 34) {
                    const partnerType = this.world.getBlock(bx, (brokenType & 0x3f) === 33 ? by + 1 : by - 1, bz);
                    if ((brokenType & 0x3f) === 33 && (partnerType & 0x3f) === 34) {
                        this.world.setBlock(bx, by + 1, bz, 0);
                    } else if ((brokenType & 0x3f) === 34 && (partnerType & 0x3f) === 33) {
                        this.world.setBlock(bx, by - 1, bz, 0);
                    }
                    this.context.addItemToInventory(33, 1); // Nur 1x Tür
                // BETT abbauen: Partner-Block finden und entfernen
                } else if (brokenType === 38 || brokenType === 39) {
                    for (let x = bx - 1; x <= bx + 1; x++) {
                        for (let z = bz - 1; z <= bz + 1; z++) {
                            const neighbor = this.world.getBlock(x, by, z);
                            if ((brokenType === 38 && neighbor === 39) || (brokenType === 39 && neighbor === 38)) {
                                this.world.setBlock(x, by, z, 0);
                            }
                        }
                    }
                    this.context.addItemToInventory(38, 1); // Nur 1x Bett
                // TOTER STRAUCH: Droppt Stöcke statt sich selbst
                } else if (brokenType === 46) {
                    const stickCount = 1 + Math.floor(Math.random() * 2); // 1-2 Stöcke
                    this.context.addItemToInventory(27, stickCount);
                    this.showMessage(`+ ${stickCount}x Stock 🪵`, "#8B4513", 20);
                // BLÄTTER: 20% Chance auf Stock-Drop
                } else if (brokenType === 6 || brokenType === 14) {
                    if (Math.random() < 0.2) {
                        this.context.addItemToInventory(27, 1);
                        this.showMessage("+ Stock 🪵", "#8B4513", 20);
                    }
                // LEERER BEERENBUSCH: Droppt sich selbst nicht, nur Stöcke
                } else if (brokenType === 52) {
                    this.context.addItemToInventory(27, 1);
                // VOLLER BEERENBUSCH: Droppt Beeren + Stöcke
                } else if (brokenType === 43) {
                    const berryCount = 1 + Math.floor(Math.random() * 3);
                    this.context.addItemToInventory(51, berryCount);
                    this.context.addItemToInventory(27, 1);
                    this.showMessage(`+ ${berryCount}x Beeren 🫐`, "#E53935", 20);
                } else if (brokenType !== 0) {
                    this.context.addItemToInventory(brokenType, 1);
                }
                
                this.context.updateInventoryUI();

                
            } else if (e.button === 2) {
                // Block platzieren
                // === BEERENBUSCH RECHTSKLICK: Beeren pflücken ===
                p.add(h.face.normal.clone().multiplyScalar(-0.5));
                const harvestX = Math.floor(p.x), harvestY = Math.floor(p.y), harvestZ = Math.floor(p.z);
                const harvestBlock = this.world.getBlock(harvestX, harvestY, harvestZ);
                if (harvestBlock === 43) { // Voller Beerenbusch
                    const berryCount = 1 + Math.floor(Math.random() * 3); // 1-3 Beeren
                    this.context.addItemToInventory(51, berryCount);
                    this.world.setBlock(harvestX, harvestY, harvestZ, 52); // Leerer Busch
                    this.SoundManager.playSound('step_grass', 0.5, 1.2);
                    this.showMessage(`+ ${berryCount}x Beeren 🫐`, "#E53935", 20);
                    this.context.updateInventoryUI();
                    return;
                }
                // Point zurücksetzen für normale Platzierung
                p.copy(h.point.clone());
                
                const unplaceable = [17, 18, 21, 22, 23, 24, 25, 31, 34, 39, 51]; 
                
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
                        this.world.setBlock(px, py, pz, 33 | (rotation << 6));
                        this.world.setBlock(px, py + 1, pz, 34 | (rotation << 6));
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
        }
    }

    showMessage(text, color, fontSize = 32) {
        const msg = document.createElement('div');
        msg.innerText = text;
        msg.style = `position:absolute; left:50%; top:45%; transform:translate(-50%,-50%); color:${color}; font-weight:bold; pointer-events:none; animation: fade-up 1.5s forwards; text-shadow: 0 0 10px rgba(0,0,0,0.5); font-size: ${fontSize}px; z-index: 2000;`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 1500);
    }
}
