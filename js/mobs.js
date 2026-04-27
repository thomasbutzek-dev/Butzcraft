import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { SoundManager } from './sound.js';
import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas } from './blocks.js';
import { Physics } from './Physics.js?v=1775830882304';

const { ZOMBIE_DETECTION_RANGE, ZOMBIE_SPEED, ZOMBIE_DAMAGE, WANDER_SPEED, CHICKEN_EGG_TIME_MIN, CHICKEN_EGG_TIME_MAX, SHEEP_WOOL_TIME_MIN, SHEEP_WOOL_TIME_MAX, WATER_AVOIDANCE_RADIUS, SPAWN_DIST_MAX, SKELETON_SPEED = 1.5 } = CONFIG.MOBS;
const { GRAVITY, MOB_JUMP_FORCE = 5.5 } = CONFIG.PHYSICS;
const { HUNGER_GAIN_PIG } = CONFIG.GAMEPLAY;

window.droppedItems = window.droppedItems || [];

// Wiederverwendbare Vektor-Objekte (vermeidet GC-Druck durch new Vector3 in update())
const _tempDir = new THREE.Vector3();
const _tempPDir = new THREE.Vector3();
const _tempNormVel = new THREE.Vector3();


export class Mob {
    constructor(scene, type, x, y, z) {
        this.scene = scene;
        this.type = type;
        this.health = (type === 'zombie' || type === 'skeleton') ? 20 : (type === 'pig' || type === 'sheep' || type === 'cow') ? 12 : 5;
        this.lastMilkTime = 0; // Für Kühe
        this.lastShotTime = 0; // Für Skelette
        this.isDead = false;
        this.velocity = new THREE.Vector3();
        this.lastJump = 0;
        this.group = new THREE.Group();

        if (type === 'zombie') {
            this._buildZombie();
        } else if (type === 'skeleton') {
            this._buildSkeleton();
        } else if (type === 'pig') {
            this._buildPig();
        } else if (type === 'chicken') {
            this._buildChicken();
            this.lastEggTime = Date.now();
        } else if (type === 'sheep') {
            this._buildSheep();
            this.lastWoolTime = Date.now();
                } else if (type === 'cow') {
            this._buildCow();
            this.lastMilkTime = Date.now();
        } else if (type === 'fish') {
            this._buildFish();
        } else if (type === 'octopus') {
            this._buildOctopus();
        }

        this.group.position.set(x, y, z);
        scene.add(this.group);
        this.mesh = this.group;
    }

    _getTexMat(baseColor, texIdx) {
        if (texIdx === undefined) return new THREE.MeshPhongMaterial({ color: baseColor });
        if (!textureAtlas) return new THREE.MeshPhongMaterial({ color: baseColor });

        const tex = textureAtlas.clone();
        tex.needsUpdate = true;
        
        const tileW = 1 / 16;
        const tileH = 1 / 16;
        const u = (texIdx % 16) * tileW;
        const v = Math.floor(texIdx / 16) * tileW; // 16x16 tiles
        
        tex.repeat.set(tileW, tileW);
        // V in Three.js starts from bottom, our tiles start from top.
        tex.offset.set(u, 1.0 - tileW - v);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;

        return new THREE.MeshPhongMaterial({
            color: baseColor,
            map: tex,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });
    }

    _buildSkeleton() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));
        const boneColor = 0xF5F5DC; // Etwas cremigeres Knochenweiß
        const boneTex = 35;
        const skullTex = 33;

        // --- KOPF ---
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.87;
        const skull = box(0.5, 0.5, 0.5, 0xFFFFFF, skullTex);
        headGroup.add(skull);
        
        // Zornesfalte / Augenbraue
        const brow = box(0.52, 0.12, 0.12, boneColor, boneTex);
        brow.position.set(0, 0.18, 0.22);
        headGroup.add(brow);
        this.group.add(headGroup);

        // --- TORSO ---
        const torsoGroup = new THREE.Group();
        // Wirbelsäule
        const spine = box(0.12, 0.9, 0.12, boneColor, boneTex);
        spine.position.y = 1.25;
        torsoGroup.add(spine);

        // Rippen
        for (let i = 0; i < 3; i++) {
            const rib = box(0.45, 0.08, 0.22, boneColor, boneTex);
            rib.position.set(0, 1.15 + i * 0.22, 0);
            torsoGroup.add(rib);
        }

        // Becken (Pelvis)
        const pelvis = box(0.42, 0.2, 0.25, boneColor, boneTex);
        pelvis.position.y = 0.85;
        torsoGroup.add(pelvis);
        this.group.add(torsoGroup);

        // --- EXTREMITÄTEN ---
        const armL = box(0.1, 0.8, 0.1, boneColor, boneTex);
        armL.position.set(-0.35, 1.25, 0);
        armL.rotation.x = -1.2; // Hält Bogen leicht schräg
        this.group.add(armL);

        const armR = box(0.1, 0.8, 0.1, boneColor, boneTex);
        armR.position.set(0.35, 1.25, 0);
        armR.rotation.x = -1.5; // Aiming position
        this.group.add(armR);

        const legL = box(0.12, 0.85, 0.12, boneColor, boneTex);
        legL.position.set(-0.15, 0.425, 0);
        this.group.add(legL); this.legs.push(legL);

        const legR = box(0.12, 0.85, 0.12, boneColor, boneTex);
        legR.position.set(0.15, 0.425, 0);
        this.group.add(legR); this.legs.push(legR);

        // --- BOGEN (Bow) ---
        const bowGroup = new THREE.Group();
        const bowColor = 0x8B4513; // Sattelbraun
        const bowCurve = (y, r) => {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), new THREE.MeshPhongMaterial({ color: bowColor }));
            seg.position.y = y;
            seg.rotation.z = r;
            return seg;
        };
        const b1 = bowCurve(0.25, 0.3);
        const b2 = bowCurve(0, 0);
        const b3 = bowCurve(-0.25, -0.3);
        bowGroup.add(b1, b2, b3);

        // Sehne
        const string = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.8, 0.01), new THREE.MeshPhongMaterial({ color: 0x555555 }));
        string.position.set(-0.1, 0, 0);
        bowGroup.add(string);

        bowGroup.position.set(-0.4, 1.2, 0.3);
        bowGroup.rotation.y = Math.PI / 2;
        this.group.add(bowGroup);
    }

    _buildZombie() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));

        const body = box(0.6, 0.9, 0.4, 0xffffff, 20); body.position.y = 1.15; this.group.add(body);
        const head = box(0.55, 0.55, 0.55, 0xffffff, 20); head.position.y = 1.87; this.group.add(head);
        const eyeL = box(0.12, 0.1, 0.02, 0x111111); eyeL.position.set(-0.14, 1.93, 0.27); this.group.add(eyeL);
        const eyeR = box(0.12, 0.1, 0.02, 0x111111); eyeR.position.set(0.14, 1.93, 0.27); this.group.add(eyeR);
        const mouth = box(0.25, 0.07, 0.02, 0x222222); mouth.position.set(0, 1.77, 0.27); this.group.add(mouth);
        const armL = box(0.2, 0.8, 0.2, 0xffffff, 20); armL.position.set(-0.45, 1.2, 0); armL.rotation.x = -1.0; this.group.add(armL);
        const armR = box(0.2, 0.8, 0.2, 0xffffff, 20); armR.position.set(0.45, 1.2, 0); armR.rotation.x = -1.0; this.group.add(armR);
        
        const legL = box(0.22, 0.7, 0.22, 0x2d5a8e); legL.position.set(-0.17, 0.35, 0); this.group.add(legL); this.legs.push(legL);
        const legR = box(0.22, 0.7, 0.22, 0x2d5a8e); legR.position.set(0.17, 0.35, 0); this.group.add(legR); this.legs.push(legR);
    }

    _buildPig() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));

        const body = box(0.85, 0.6, 1.1, 0xffffff, 19); body.position.y = 0.55; this.group.add(body);
        const head = box(0.65, 0.6, 0.6, 0xffffff, 19); head.position.set(0, 0.6, 0.7); this.group.add(head);
        const snout = box(0.35, 0.25, 0.12, 0xe07070); snout.position.set(0, 0.52, 1.01); this.group.add(snout);
        const n1 = box(0.08, 0.07, 0.02, 0xc05050); n1.position.set(-0.09, 0.53, 1.07); this.group.add(n1);
        const n2 = box(0.08, 0.07, 0.02, 0xc05050); n2.position.set(0.09, 0.53, 1.07); this.group.add(n2);
        const eyeL = box(0.1, 0.1, 0.02, 0x111111); eyeL.position.set(-0.2, 0.72, 1.01); this.group.add(eyeL);
        const eyeR = box(0.1, 0.1, 0.02, 0x111111); eyeR.position.set(0.2, 0.72, 1.01); this.group.add(eyeR);
        const earL = box(0.18, 0.18, 0.06, 0xe08080); earL.position.set(-0.28, 0.92, 0.68); this.group.add(earL);
        const earR = box(0.18, 0.18, 0.06, 0xe08080); earR.position.set(0.28, 0.92, 0.68); this.group.add(earR);
        
        const leg = (ox, oz) => { const l = box(0.2, 0.35, 0.2, 0xffffff, 19); l.position.set(ox, 0.17, oz); this.group.add(l); this.legs.push(l); };
        leg(-0.28, -0.35); leg(0.28, -0.35); leg(-0.28, 0.35); leg(0.28, 0.35);
    }

    _buildChicken() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));

        const body = box(0.4, 0.4, 0.5, 0xffffff, 25); body.position.y = 0.4; this.group.add(body);
        const neck = box(0.3, 0.35, 0.3, 0xffffff, 25); neck.position.set(0, 0.55, 0.3); this.group.add(neck);
        const beak = box(0.15, 0.1, 0.2, 0xffcc00); beak.position.set(0, 0.6, 0.5); this.group.add(beak);
        const comb = box(0.1, 0.15, 0.25, 0xcc0000); comb.position.set(0, 0.75, 0.3); this.group.add(comb);
        const wattle = box(0.1, 0.15, 0.1, 0xcc0000); wattle.position.set(0, 0.45, 0.45); this.group.add(wattle);
        const eyeL = box(0.05, 0.05, 0.02, 0x111111); eyeL.position.set(-0.16, 0.65, 0.35); this.group.add(eyeL);
        const eyeR = box(0.05, 0.05, 0.02, 0x111111); eyeR.position.set(0.16, 0.65, 0.35); this.group.add(eyeR);
        
        const leg = (ox, oz) => { const l = box(0.08, 0.2, 0.08, 0xffcc00); l.position.set(ox, 0.1, oz); this.group.add(l); this.legs.push(l); };
        leg(-0.1, 0.1); leg(0.1, 0.1);
    }

    _buildSheep() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));

        const body = box(0.8, 0.7, 1.0, 0xffffff, 18); body.position.y = 0.65; this.group.add(body);
        const head = box(0.4, 0.45, 0.4, 0xeeeeee); head.position.set(0, 0.85, 0.6); this.group.add(head);
        const eyeL = box(0.08, 0.08, 0.02, 0x111111); eyeL.position.set(-0.12, 0.95, 0.81); this.group.add(eyeL);
        const eyeR = box(0.08, 0.08, 0.02, 0x111111); eyeR.position.set(0.12, 0.95, 0.81); this.group.add(eyeR);
        const face = box(0.25, 0.2, 0.1, 0xf5d6c6); face.position.set(0, 0.82, 0.81); this.group.add(face);
        
        const leg = (ox, oz) => { const l = box(0.18, 0.4, 0.18, 0xdddddd); l.position.set(ox, 0.2, oz); this.group.add(l); this.legs.push(l); };
        leg(-0.25, -0.3); leg(0.25, -0.3); leg(-0.25, 0.3); leg(0.25, 0.3);
    }

    _buildCow() {
        this.legs = [];
        const box = (w, h, d, c, t) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, t));

        const body = box(0.9, 0.8, 1.3, 0xffffff, 24); body.position.y = 0.7; this.group.add(body);
        const head = box(0.5, 0.55, 0.6, 0xffffff, 24); head.position.set(0, 1.0, 0.75); this.group.add(head);
        
        const h1 = box(0.12, 0.2, 0.1, 0xdddddd); h1.position.set(0.18, 1.3, 0.8); this.group.add(h1);
        const h2 = box(0.12, 0.2, 0.1, 0xdddddd); h2.position.set(-0.18, 1.3, 0.8); this.group.add(h2);
        const snout = box(0.35, 0.25, 0.15, 0xe5a3a3); snout.position.set(0, 0.85, 1.05); this.group.add(snout);
        const udders = box(0.35, 0.2, 0.4, 0xffb6c1); udders.position.set(0, 0.3, -0.1); this.group.add(udders);

        const eyeL = box(0.1, 0.1, 0.05, 0x111111); eyeL.position.set(-0.15, 1.1, 1.02); this.group.add(eyeL);
        const eyeR = box(0.1, 0.1, 0.05, 0x111111); eyeR.position.set(0.15, 1.1, 1.02); this.group.add(eyeR);
        
        const leg = (ox, oz) => { const l = box(0.24, 0.5, 0.24, 0xffffff, 24); l.position.set(ox, 0.25, oz); this.group.add(l); this.legs.push(l); };
        leg(-0.28, -0.35); leg(0.28, -0.35); leg(-0.28, 0.35); leg(0.28, 0.35);
    }


    
    updateAquatic(delta, playerPos, world, onDamage) {
        const time = performance.now();
        const pos = this.group.position;
        const dist = pos.distanceTo(playerPos);
        
        if (dist > 50) { this.isDead = true; return; }
        
        // Animations
        if (this.type === 'fish' && this.tail) {
            this.tail.rotation.y = Math.sin(time * 0.01) * 0.5;
        } else if (this.type === 'octopus' && this.tentacles) {
            this.tentacles.forEach(t => {
                t.position.y = 0.1 + Math.sin(time * 0.005 + t.userData.angleOffset) * 0.1;
            });
        }
        
        const myBlockY = Math.floor(pos.y);
        const myBlock = world.getBlock(Math.floor(pos.x), myBlockY, Math.floor(pos.z));
        const inWater = (myBlock === 4 || myBlock === 12);

        // Very simple logic: stay perfectly within water blocks!
        if (inWater) {
            // Find valid range
            let surfaceY = myBlockY;
            while(surfaceY < 64) {
                if (world.getBlock(Math.floor(pos.x), surfaceY, Math.floor(pos.z)) !== 4) break;
                surfaceY++;
            }
            const topY = surfaceY - ((this.type === 'fish') ? 0.6 : 1.0);
            
            let floorY = myBlockY;
            while(floorY > 0) {
                if (world.getBlock(Math.floor(pos.x), floorY, Math.floor(pos.z)) !== 4) break;
                floorY--;
            }
            const botY = floorY + 1.2; // Keep at least 1.2 above floor (which is floorY)
            
            if (Math.random() < 0.02) {
                // Pick a new target depth within strict bounds
                const randomRange = topY - botY;
                if (randomRange > 0) {
                    if (this.type === 'fish') {
                        this.targetDepth = topY - Math.random() * Math.min(1.0, randomRange);
                    } else { // Octopus prefers bottom
                        this.targetDepth = botY + Math.random() * Math.min(1.0, randomRange);
                    }
                } else {
                    this.targetDepth = (topY + botY) / 2; // Flat boundary
                }
                
                const a = Math.random() * Math.PI * 2;
                const speed = (this.type === 'fish') ? 1.0 : 0.3;
                this.velocity.x = Math.cos(a) * speed;
                this.velocity.z = Math.sin(a) * speed;
                this.group.rotation.y = -a + Math.PI/2;
            }
            
            if (this.targetDepth === undefined || isNaN(this.targetDepth)) this.targetDepth = (topY + botY) / 2;
            
            if (pos.y < this.targetDepth - 0.2) this.velocity.y = 1.0;
            else if (pos.y > this.targetDepth + 0.2) this.velocity.y = -1.0;
            else this.velocity.y = 0;
            
            const nextX = pos.x + this.velocity.x * delta;
            const nextZ = pos.z + this.velocity.z * delta;
            
            // Strictly check that horizontal velocity will not lead OUT of water
            const bn = world.getBlock(Math.floor(nextX), myBlockY, Math.floor(nextZ));
            if (bn !== 4 && bn !== 12) {
                this.velocity.x *= -1;
                this.velocity.z *= -1;
                this.group.rotation.y += Math.PI; // bounce
            } else {
                pos.x = nextX;
                pos.z = nextZ;
            }
            pos.y += this.velocity.y * delta;
            
            // Hard clamp just in case
            if (pos.y > topY) pos.y = topY;
            if (pos.y < botY) pos.y = botY;
            
        } else {
            // Not in water?! We probably glitched onto shore or air.
            // Die almost instantly or flop back logically
            this.velocity.x = 0; this.velocity.z = 0;
            this.velocity.y -= 9.8 * delta;
            pos.y += this.velocity.y * delta;
            
            // Ground collision
            const bBelowY = Math.floor(pos.y);
            const bb = world.getBlock(Math.floor(pos.x), bBelowY, Math.floor(pos.z));
            if (bb !== 0 && bb !== 4 && bb !== 8 && bb !== 9 && bb !== 10) {
                pos.y = bBelowY + 1.0;
                this.velocity.y = 0;
            }
            
            // Flopping damage = die on shore
            if (Math.random() < 0.1) this.takeDamage(1, onDamage);
        }
    }

    _buildFish() {
        this.isAquatic = true;
        this.group = new THREE.Group();
        const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhongMaterial({ color: c }));
        
        const body = box(0.15, 0.3, 0.45, 0xFF9800); // Orange body
        body.position.y = 0.2;
        this.group.add(body);
        
        const belly = box(0.16, 0.1, 0.4, 0xFFFFFF); // White belly
        belly.position.set(0, 0.08, 0.0);
        this.group.add(belly);

        // Eyes
        const eyeL = box(0.04, 0.06, 0.04, 0x111111);
        eyeL.position.set(-0.08, 0.25, 0.15);
        this.group.add(eyeL);
        const eyeR = box(0.04, 0.06, 0.04, 0x111111);
        eyeR.position.set(0.08, 0.25, 0.15);
        this.group.add(eyeR);

        // Side fins
        const finL = box(0.15, 0.05, 0.15, 0xFF5722);
        finL.position.set(-0.12, 0.15, 0.0);
        finL.rotation.z = -0.4;
        this.group.add(finL);
        
        const finR = box(0.15, 0.05, 0.15, 0xFF5722);
        finR.position.set(0.12, 0.15, 0.0);
        finR.rotation.z = 0.4;
        this.group.add(finR);

        // Tail
        const tail = box(0.04, 0.25, 0.15, 0xFF5722);
        tail.position.set(0, 0.2, -0.28);
        this.tail = tail; // Reference for animation
        this.group.add(tail);
        
        this.box = new THREE.Box3();
    }

    _buildOctopus() {
        this.isAquatic = true;
        this.group = new THREE.Group();
        const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhongMaterial({ color: c }));
        
        const head = box(0.5, 0.5, 0.5, 0x6A1B9A); // Purple head
        head.position.y = 0.5;
        this.group.add(head);

        // Sclera (White outer eye)
        const scleraL = box(0.2, 0.2, 0.05, 0xFFFFFF); 
        scleraL.position.set(-0.15, 0.5, 0.255);
        this.group.add(scleraL);
        
        const scleraR = box(0.2, 0.2, 0.05, 0xFFFFFF);
        scleraR.position.set(0.15, 0.5, 0.255);
        this.group.add(scleraR);

        // Pupils
        const eyeL = box(0.1, 0.15, 0.1, 0x000000); 
        eyeL.position.set(-0.15, 0.5, 0.26);
        this.group.add(eyeL);
        
        const eyeR = box(0.1, 0.15, 0.1, 0x000000);
        eyeR.position.set(0.15, 0.5, 0.26);
        this.group.add(eyeR);
        
        this.tentacles = [];
        for(let i=0; i<8; i++) {
            const t = new THREE.Group();
            const arm = box(0.1, 0.4, 0.1, 0x4A148C); // Darker purple tentacles
            arm.position.y = 0;
            t.add(arm);
            
            // Suction cups
            for(let j=0; j<3; j++) {
                const cup = box(0.12, 0.05, 0.12, 0x8E24AA); // Lighter purple cups
                cup.position.y = -0.15 + j * 0.15;
                t.add(cup);
            }
            
            const a = i * Math.PI / 4;
            t.userData.baseX = Math.cos(a) * 0.22;
            t.userData.baseZ = Math.sin(a) * 0.22;
            t.userData.angleOffset = a;
            t.position.set(t.userData.baseX, 0.15, t.userData.baseZ);
            
            // Give tentacles a slight outward tilt
            t.rotation.x = -Math.sin(a) * 0.2;
            t.rotation.z = Math.cos(a) * 0.2;

            this.group.add(t);
            this.tentacles.push(t);
        }
        this.box = new THREE.Box3();
    }

    update(delta, playerPos, world, onDamage) {
        if (this.isAquatic) { this.updateAquatic(delta, playerPos, world, onDamage); return; }
                if (this.isDead) return;
                const pos = this.group.position;
                const dist = pos.distanceTo(playerPos);

                if (!this.lastSound || performance.now() - this.lastSound > 3000) {
                    if (Math.random() < 0.005) { 
                        this.lastSound = performance.now();
                        if (this.type === 'zombie' && dist < 25) SoundManager.playZombie();
                        else if (this.type === 'pig' && dist < 20) SoundManager.playPig();
                        else if (this.type === 'sheep' && dist < 20) SoundManager.playSheep();
                        else if (this.type === 'cow' && dist < 20) SoundManager.playCow();
                        else if (this.type === 'chicken' && dist < 20) SoundManager.playChicken();
                    }
                }
                
                // Despawn, wenn Mob zu weit weg ist (damit in der Nähe des Spielers neue spawnen können)
                if (dist > SPAWN_DIST_MAX + 15) {
                    this.isDead = true;
                    return;
                }
                
                const checkMobC = (np) => Physics.checkAABBCollision(world, np, 0.3, 0.6, 1.8, true);

                if ((this.type === 'zombie' || this.type === 'skeleton') && dist < ZOMBIE_DETECTION_RANGE) {
                    const dir = _tempDir.subVectors(playerPos, pos);
                    dir.y = 0; dir.normalize();
                    
                    let waterAhead = false;
                    for (let r = 1; r <= WATER_AVOIDANCE_RADIUS; r++) {
                        if (world.getBlock(Math.floor(pos.x + dir.x * r), Math.floor(pos.y), Math.floor(pos.z + dir.z * r)) === 4 ||
                            world.getBlock(Math.floor(pos.x + dir.x * r), Math.floor(pos.y - 1), Math.floor(pos.z + dir.z * r)) === 4) {
                            waterAhead = true; break;
                        }
                    }

                    if (waterAhead) {
                        // Zombie stoppt vor Wasser, aber versucht seitlich auszuweichen
                        this.velocity.x = 0; this.velocity.z = 0;
                    } else {
                         const speed = this.type === 'skeleton' ? SKELETON_SPEED : ZOMBIE_SPEED;
                        if (this.type === 'skeleton' && dist < 10) {
                            this.velocity.x = 0; this.velocity.z = 0;
                        } else {
                            this.velocity.x = dir.x * speed; this.velocity.z = dir.z * speed;
                        }
                        if (dir.length() > 0.1) this.group.rotation.y = Math.atan2(dir.x, dir.z);
                        if (this.type === 'skeleton') {
                            if (performance.now() - this.lastShotTime > 2500) {
                                this.lastShotTime = performance.now();
                                const pDir = _tempPDir.subVectors(playerPos, new THREE.Vector3(pos.x, pos.y + 1.2, pos.z)).normalize();
                                pDir.y += 0.05;
                                projectiles.push(new ArrowProjectile(this.scene, new THREE.Vector3(pos.x, pos.y + 1.2, pos.z), pDir));
                            }
                        }
                        const nX = pos.x + dir.x * 0.5, nZ = pos.z + dir.z * 0.5;
                        if (world.getBlock(Math.floor(nX), Math.floor(pos.y), Math.floor(nZ)) !== 0 && performance.now() - this.lastJump > 1200) {
                            this.velocity.y = MOB_JUMP_FORCE; this.lastJump = performance.now();
                        }
                    }
                } else {
                    // Wander-Logik für friedliche Mobs oder Zombies außer Reichweite
                    if (Math.random() < 0.005 || (this.velocity.x === 0 && this.velocity.z === 0 && Math.random() < 0.05)) {
                        const angle = Math.random() * Math.PI * 2;
                        const dirX = Math.cos(angle);
                        const dirZ = Math.sin(angle);
                        
                        let waterAhead = false;
                        for (let r = 1; r <= WATER_AVOIDANCE_RADIUS; r++) {
                            if (world.getBlock(Math.floor(pos.x + dirX * r), Math.floor(pos.y), Math.floor(pos.z + dirZ * r)) === 4 ||
                                world.getBlock(Math.floor(pos.x + dirX * r), Math.floor(pos.y - 1), Math.floor(pos.z + dirZ * r)) === 4) {
                                waterAhead = true; break;
                            }
                        }

                        if (!waterAhead) {
                            this.velocity.x = dirX * ((this.type === 'zombie' || this.type === 'skeleton') ? ZOMBIE_SPEED : WANDER_SPEED);
                            this.velocity.z = dirZ * ((this.type === 'zombie' || this.type === 'skeleton') ? ZOMBIE_SPEED : WANDER_SPEED);
                            this.group.rotation.y = angle;
                        } else {
                            this.velocity.x = 0; this.velocity.z = 0;
                        }
                    }
                }
                
                // Beinanimation beim Gehen
                if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
                    const walkCycle = (performance.now() % 600) / 600 * Math.PI * 2; // Beine schwingen im 600ms Takt
                    if (this.legs && this.legs.length > 0) {
                        if (this.legs.length === 2) {
                            // Zweibeiner
                            this.legs[0].rotation.x = Math.sin(walkCycle) * 0.6;
                            this.legs[1].rotation.x = Math.sin(walkCycle + Math.PI) * 0.6;
                        } else if (this.legs.length === 4) {
                            // Vierbeiner (Schweine, Schafe)
                            this.legs[0].rotation.x = Math.sin(walkCycle) * 0.6;       // Vorne links
                            this.legs[1].rotation.x = Math.sin(walkCycle + Math.PI) * 0.6; // Vorne rechts
                            this.legs[2].rotation.x = Math.sin(walkCycle + Math.PI) * 0.6; // Hinten links
                            this.legs[3].rotation.x = Math.sin(walkCycle) * 0.6;       // Hinten rechts
                        }
                    }
                } else if (this.legs) {
                    this.legs.forEach(leg => leg.rotation.x = 0);
                }
                
                this.velocity.y -= GRAVITY * delta;
                
                // Kontinuierliche Wasser-Vermeidung
                if (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01) {
                    const normVel = _tempNormVel.set(this.velocity.x, 0, this.velocity.z).normalize();
                    let waterInPath = false;
                    for (let r = 1; r <= WATER_AVOIDANCE_RADIUS; r++) {
                        if (world.getBlock(Math.floor(pos.x + normVel.x * r), Math.floor(pos.y), Math.floor(pos.z + normVel.z * r)) === 4 ||
                            world.getBlock(Math.floor(pos.x + normVel.x * r), Math.floor(pos.y - 1), Math.floor(pos.z + normVel.z * r)) === 4) {
                            waterInPath = true; break;
                        }
                    }
                    if (waterInPath) {
                        this.velocity.x = 0; this.velocity.z = 0;
                    }
                }

                // Horizontale Kollision mit "Stuck"-Erkennung
                const mnx = pos.x + this.velocity.x * delta;
                const mnz = pos.z + this.velocity.z * delta;
                
                let hitWall = false;
                if (!checkMobC({ x: mnx, y: pos.y, z: pos.z })) {
                    pos.x = mnx; 
                } else { 
                    this.velocity.x = 0; hitWall = true; 
                }
                
                if (!checkMobC({ x: pos.x, y: pos.y, z: mnz })) {
                    pos.z = mnz; 
                } else { 
                    this.velocity.z = 0; hitWall = true; 
                }

                if (hitWall) {
                    if (this.velocity.y <= 0 && (performance.now() - this.lastJump) > 1000) {
                        // Bei Wandkontakt automatisch springen (Schwerkraft ist im y<=0 abgedeckt)
                        this.velocity.y = MOB_JUMP_FORCE;
                        this.lastJump = performance.now();
                    } else if (Math.random() < 0.1) {
                        // Gelegentlich neue Richtung suchen
                        this.velocity.x = 0; this.velocity.z = 0; 
                    }
                }

                pos.y += this.velocity.y * delta;

                // KORREKTER Boden-Check (verhindert Jitter und Sinken)
                // Ein Block bei y wird von y bis y+1.0 gerendert (Oberkante ist also y+1.0)
                const bBelowY = Math.floor(pos.y - 0.05); // Block direkt unter den Füßen
                const bBelow = world.getBlock(Math.floor(pos.x), bBelowY, Math.floor(pos.z));
                const bFootY = Math.floor(pos.y + 0.1); 
                const bFoot = world.getBlock(Math.floor(pos.x), bFootY, Math.floor(pos.z));

                if (bBelow !== 0 && bBelow !== 4 && bBelow !== 8 && bBelow !== 9 && this.velocity.y <= 0) {
                    pos.y = bBelowY + 1.0; // Auf exakte Blockoberkante snappen
                    this.velocity.y = 0;
                } else if (bFoot !== 0 && bFoot !== 4 && bFoot !== 8 && bFoot !== 9 && bFoot !== 10) {
                    pos.y = bFootY + 1.0; // Auf Block setzen, falls drinsteckend
                    this.velocity.y = 0;
                }

                // Hühner legen Eier
                if (this.type === 'chicken' && Date.now() - this.lastEggTime > CHICKEN_EGG_TIME_MIN + Math.random() * (CHICKEN_EGG_TIME_MAX - CHICKEN_EGG_TIME_MIN)) {
                    this.lastEggTime = Date.now();
                    const eggMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.15, 0.2, 0.15),
                        new THREE.MeshPhongMaterial({ color: 0xffeebb })
                    );
                    eggMesh.position.copy(pos);
                    eggMesh.position.y += 0.2; // Etwas über dem Boden spawnen
                    this.scene.add(eggMesh);
                    if(!window.droppedItems) window.droppedItems=[];
                    window.droppedItems.push({ mesh: eggMesh, velocityY: 0, blockType: 17 });
                }

                if ((this.type === 'zombie' || this.type === 'skeleton') && dist < 2.0) onDamage(ZOMBIE_DAMAGE * delta * 20);
            }
            takeDamage(amount, onKill) {
                if (this.type === 'octopus') return; // Unsterblich
                this.health -= amount;
                if (this.health <= 0) {
                    this.isDead = true; this.scene.remove(this.group);
                    
                    let blockType = null;
                    let dropColor = 0xFFFFFF;
                    if (this.type === 'fish' || this.type === 'octopus') { blockType = 21; dropColor = 0xFF9800; }
                    else if (this.type === 'pig' || this.type === 'cow') { blockType = 22; dropColor = 0xFF9999; }
                    else if (this.type === 'chicken') { blockType = 23; dropColor = 0xFFEEBB; }
                    else if (this.type === 'zombie') { blockType = 24; dropColor = 0x3a5f0b; }
                    else if (this.type === 'skeleton') { blockType = 31; dropColor = 0xebebeb; }
                    else if (this.type === 'sheep') { blockType = 25; dropColor = 0xFFB6C1; }

                    if (blockType) {
                        const dropMesh = new THREE.Mesh(
                            new THREE.BoxGeometry(0.2, 0.2, 0.2),
                            new THREE.MeshPhongMaterial({ color: dropColor })
                        );
                        dropMesh.position.copy(this.group.position);
                        dropMesh.position.y += 0.3;
                        this.scene.add(dropMesh);
                        if (!window.droppedItems) window.droppedItems = [];
                        window.droppedItems.push({ mesh: dropMesh, velocityY: 2.0, blockType: blockType });
                    }
                }
            }
        }

export const projectiles = [];
export class ArrowProjectile {
    constructor(scene, startPos, dir) {
        this.scene = scene;
        this.dir = dir;
        this.speed = 22.0; 
        this.isDead = false;
        
        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), new THREE.MeshPhongMaterial({ color: 0x555555 }));
        this.mesh.position.copy(startPos);
        
        const target = new THREE.Vector3().copy(startPos).add(dir);
        this.mesh.lookAt(target);
        
        scene.add(this.mesh);
    }
    update(delta, playerPos, world, onDamage) {
        if (this.isDead) return;
        
        const moveVec = new THREE.Vector3().copy(this.dir).multiplyScalar(this.speed * delta);
        this.mesh.position.add(moveVec);
        
        if (this.mesh.position.distanceTo(playerPos) < 1.0) {
            onDamage(10); 
            this.isDead = true;
            this.scene.remove(this.mesh);
            return;
        }
        
        const block = world.getBlock(Math.floor(this.mesh.position.x), Math.floor(this.mesh.position.y), Math.floor(this.mesh.position.z));
        if (block !== 0 && block !== 4 && block !== 8) { 
            this.isDead = true;
            this.scene.remove(this.mesh);
        }
    }
}

export function updateProjectiles(delta, playerPos, world, onDamage) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(delta, playerPos, world, onDamage);
        if (p.isDead) {
            projectiles.splice(i, 1);
        }
    }
}
