import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js?v=20260719a';
import { SoundManager } from './sound.js?v=20260507b';
import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas } from './blocks.js?v=20260717y';
import { Physics } from './Physics.js?v=20260717a';
import { Game } from './Game.js?v=20260716b';
import { getPainterlyEntityTexture, selectEntityTextureVariant } from './entityMaterials.js?v=20260719a';

const { ZOMBIE_DETECTION_RANGE, ZOMBIE_SPEED, ZOMBIE_DAMAGE, WANDER_SPEED, CHICKEN_EGG_TIME_MIN, CHICKEN_EGG_TIME_MAX, SHEEP_WOOL_TIME_MIN, SHEEP_WOOL_TIME_MAX, WATER_AVOIDANCE_RADIUS, SPAWN_DIST_MAX, SKELETON_SPEED = 1.5, SPIDER_DETECTION_RANGE = 12, SPIDER_SPEED = 1.2, SPIDER_DAMAGE = 2 } = CONFIG.MOBS;
const { GRAVITY, MOB_JUMP_FORCE = 5.5 } = CONFIG.PHYSICS;
const { HUNGER_GAIN_PIG } = CONFIG.GAMEPLAY;

Game.droppedItems = Game.droppedItems || [];

// Wiederverwendbare Vektor-Objekte (vermeidet GC-Druck durch new Vector3 in update())
const _tempDir = new THREE.Vector3();
const _tempPDir = new THREE.Vector3();
const _tempNormVel = new THREE.Vector3();
const _tempProjectileMove = new THREE.Vector3();
const MOB_TEXTURE_TILES = {
    zombie: 0,
    skeleton: 1,
    spider: 2,
    pig: 3,
    chicken: 4,
    sheep: 5,
    cow: 6,
    fish: 7,
    octopus: 8,
    turtle: 9,
    parrot: 10
};

// Material-Cache pro Farb-, Atlas- und Variantenkombination. Vorher wurde pro Body-Part eines Mobs
// ein NEUES Material + Textur-Clone erzeugt → Skelett-Mob = ~20 Materials, 20 Textur-Klone.
// Bei 20 Mobs = 400 Material-Instanzen mit eigenen Atlas-Klonen. Mit Cache: ~10 Materials total.
const _matCache = new Map();
const _sharedMobMaterials = new Set();
const _sharedMobGeometries = new Set();
const _lodAssets = new Map();
const MOB_LOD_DISTANCE_SQ = 32 * 32;
const MOB_FAR_UPDATE_INTERVAL = 0.1;
const MOB_LOD_PROFILES = {
    zombie: { size: [0.7, 1.8, 0.5], y: 0.9, color: 0x587a46 },
    skeleton: { size: [0.7, 1.8, 0.4], y: 0.9, color: 0xd8d2b8 },
    spider: { size: [1.8, 0.5, 1.5], y: 0.35, color: 0x34252b },
    pig: { size: [0.9, 0.8, 1.3], y: 0.45, color: 0xd98585 },
    chicken: { size: [0.5, 0.8, 0.7], y: 0.4, color: 0xe8e2c9 },
    sheep: { size: [0.9, 1, 1.2], y: 0.5, color: 0xd9d5c5 },
    cow: { size: [1, 1.3, 1.5], y: 0.65, color: 0x765342 },
    fish: { size: [0.5, 0.4, 1], y: 0.2, color: 0x4d91a8 },
    octopus: { size: [0.9, 0.8, 0.9], y: 0.3, color: 0x80526f },
    turtle: { size: [1.2, 0.5, 1.4], y: 0.25, color: 0x668351 },
    geist: { size: [0.8, 1.8, 0.6], y: 0.8, color: 0x9fb7ba },
    parrot: { size: [0.6, 0.7, 0.7], y: 0.4, color: 0xc45b46 }
};

function getMobLodAssets(type, visualVariant) {
    const key = `${type}:${visualVariant}`;
    let assets = _lodAssets.get(key);
    if (assets) return assets;
    const profile = MOB_LOD_PROFILES[type] || MOB_LOD_PROFILES.pig;
    const bodyGeometry = new THREE.BoxGeometry(...profile.size);
    const headSize = [profile.size[0] * 0.72, profile.size[1] * 0.62, profile.size[2] * 0.38];
    const headGeometry = new THREE.BoxGeometry(...headSize);
    headGeometry.translate(0, profile.size[1] * 0.18, profile.size[2] * 0.62);
    const geometry = mergeGeometries([bodyGeometry, headGeometry]);
    bodyGeometry.dispose();
    headGeometry.dispose();
    const material = getCachedMobMaterial(profile.color, undefined, MOB_TEXTURE_TILES[type], visualVariant);
    _sharedMobGeometries.add(geometry);
    assets = { geometry, material, y: profile.y };
    _lodAssets.set(key, assets);
    return assets;
}
function getCachedMobMaterial(baseColor, texIdx, painterlyTile, visualVariant) {
    const key = `${baseColor}:${texIdx ?? 'plain'}:${painterlyTile ?? 'none'}:${visualVariant}`;
    let mat = _matCache.get(key);
    if (mat) return mat;
    const painterlyTexture = painterlyTile === undefined ? null : getPainterlyEntityTexture(painterlyTile, visualVariant);
    if (painterlyTexture) {
        mat = new THREE.MeshPhongMaterial({ color: baseColor, map: painterlyTexture });
    } else if (!textureAtlas || texIdx === undefined) {
        mat = new THREE.MeshPhongMaterial({ color: baseColor });
    } else {
        const tex = textureAtlas.clone();
        tex.needsUpdate = true;
        const tile = 1 / 16;
        const u = (texIdx % 16) * tile;
        const v = Math.floor(texIdx / 16) * tile;
        tex.repeat.set(tile, tile);
        tex.offset.set(u, 1.0 - tile - v);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        mat = new THREE.MeshPhongMaterial({
            color: baseColor,
            map: tex,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });
    }
    _matCache.set(key, mat);
    _sharedMobMaterials.add(mat);
    return mat;
}


export class Mob {
    constructor(scene, type, x, y, z) {
        this.scene = scene;
        this.type = type;
        this.health = (type === 'zombie' || type === 'skeleton') ? 20 : (type === 'spider') ? 8 : (type === 'turtle') ? 15 : (type === 'pig' || type === 'sheep' || type === 'cow') ? 12 : (type === 'geist') ? Infinity : 5;
        this.lastMilkTime = 0; // Für Kühe
        this.lastShotTime = 0; // Für Skelette
        this.isDead = false;
        this.velocity = new THREE.Vector3();
        this.lastJump = 0;
        this.group = new THREE.Group();
        this.visualVariant = selectEntityTextureVariant(x, z, type.length);

        if (type === 'zombie') {
            this._buildZombie();
        } else if (type === 'skeleton') {
            this._buildSkeleton();
        } else if (type === 'spider') {
            this._buildSpider();
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
        } else if (type === 'turtle') {
            this._buildTurtle();
        } else if (type === 'geist') {
            this._buildGeist();
        } else if (type === 'parrot') {
            this._buildParrot();
        }

        this.detailObjects = [...this.group.children];
        const lodAssets = getMobLodAssets(type, this.visualVariant);
        this.lodMesh = new THREE.Mesh(lodAssets.geometry, lodAssets.material);
        this.lodMesh.position.y = lodAssets.y;
        this.lodMesh.visible = false;
        this.group.add(this.lodMesh);

        this.group.position.set(x, y, z);
        scene.add(this.group);
        this.mesh = this.group;
    }

    dispose() {
        if (this._disposed || !this.group) return;
        this.scene.remove(this.group);
        this.group.traverse(obj => {
            if (obj.geometry && !_sharedMobGeometries.has(obj.geometry)) obj.geometry.dispose();
            if (obj.material) {
                const disposeMaterial = (mat) => {
                    if (!_sharedMobMaterials.has(mat)) mat.dispose();
                };
                if (Array.isArray(obj.material)) obj.material.forEach(disposeMaterial);
                else disposeMaterial(obj.material);
            }
        });
        this._disposed = true;
    }

    updateVisualLod(playerPos) {
        const useLod = this.group.position.distanceToSquared(playerPos) >= MOB_LOD_DISTANCE_SQ;
        if (this._usingLod === useLod) return useLod;
        this._usingLod = useLod;
        for (const object of this.detailObjects) object.visible = !useLod;
        this.lodMesh.visible = useLod;
        return useLod;
    }

    _getTexMat(baseColor, texIdx, usePainterlyTexture = false) {
        // Delegiert an den Modul-Cache → eine Materialinstanz pro Farb-, Atlas- und Variantenkombination
        // statt pro Mesh. Massive Reduktion bei vielen Mobs.
        const painterlyTile = (texIdx !== undefined || usePainterlyTexture) ? MOB_TEXTURE_TILES[this.type] : undefined;
        return getCachedMobMaterial(baseColor, texIdx, painterlyTile, this.visualVariant);
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

    _buildSpider() {
        this.legs = [];
        const box = (w, h, d, c, painted = false) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, undefined, painted));
        const red = 0xc00000;

        const body = box(0.82, 0.34, 0.76, 0xffffff, true);
        body.position.set(0, 0.42, -0.12);
        this.group.add(body);

        const abdomen = box(0.74, 0.42, 0.68, 0xffffff, true);
        abdomen.position.set(0, 0.46, -0.62);
        this.group.add(abdomen);

        const head = box(0.62, 0.40, 0.48, 0xffffff, true);
        head.position.set(0, 0.40, 0.38);
        this.group.add(head);

        const eyeGeo = new THREE.BoxGeometry(0.11, 0.11, 0.04);
        const eyeMat = this._getTexMat(red);
        for (const x of [-0.18, 0.18]) {
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(x, 0.48, 0.64);
            this.group.add(eye);
        }
        const mouth = box(0.38, 0.10, 0.05, red);
        mouth.position.set(0, 0.31, 0.65);
        this.group.add(mouth);

        const legMat = this._getTexMat(0xffffff, undefined, true);
        for (const side of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const z = 0.28 - i * 0.24;
                const leg = new THREE.Group();
                leg.position.set(side * 0.36, 0.30, z);

                const upper = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.10, 0.10), legMat);
                upper.position.x = side * 0.22;
                upper.rotation.z = side * -0.18;
                leg.add(upper);

                const lower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.09), legMat);
                lower.position.set(side * 0.60, -0.05, side * (i - 1.5) * 0.02);
                lower.rotation.z = side * 0.22;
                lower.rotation.y = side * (0.25 - i * 0.08);
                leg.add(lower);

                this.group.add(leg);
                this.legs.push(leg);
            }
        }
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
        } else if (this.type === 'turtle' && this.flippers) {
            const paddle = Math.sin(time * 0.003) * 0.3;
            this.flippers[0].rotation.x = paddle;
            this.flippers[1].rotation.x = -paddle;
            this.flippers[2].rotation.x = -paddle * 0.5;
            this.flippers[3].rotation.x = paddle * 0.5;
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
                if (this.isSurfaceSwimmer) {
                    this.targetDepth = topY;
                } else if (randomRange > 0) {
                    if (this.type === 'fish') {
                        this.targetDepth = topY - Math.random() * Math.min(1.0, randomRange);
                    } else {
                        this.targetDepth = botY + Math.random() * Math.min(1.0, randomRange);
                    }
                } else {
                    this.targetDepth = (topY + botY) / 2;
                }
                
                const a = Math.random() * Math.PI * 2;
                const speed = (this.type === 'fish') ? 1.0 : (this.type === 'turtle') ? 0.5 : 0.3;
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
        const box = (w, h, d, c, painted = false) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, undefined, painted));
        
        const body = box(0.15, 0.3, 0.45, 0xffffff, true);
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
        const box = (w, h, d, c, painted = false) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, undefined, painted));
        
        const head = box(0.5, 0.5, 0.5, 0xffffff, true);
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
            const arm = box(0.1, 0.4, 0.1, 0xffffff, true);
            arm.position.y = 0;
            t.add(arm);
            
            // Suction cups
            for(let j=0; j<3; j++) {
                const cup = box(0.12, 0.05, 0.12, 0xd8a7d3, true);
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

    _buildTurtle() {
        this.isAquatic = true;
        this.isSurfaceSwimmer = true;
        this.flippers = [];
        this.group = new THREE.Group();
        const box = (w, h, d, c, painted = false) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, undefined, painted));

        const shell = box(0.7, 0.2, 0.8, 0xffffff, true);
        shell.position.y = 0.3;
        this.group.add(shell);

        const plastron = box(0.65, 0.08, 0.75, 0xC4A96A);
        plastron.position.y = 0.15;
        this.group.add(plastron);

        const head = box(0.2, 0.18, 0.25, 0xb7c087, true);
        head.position.set(0, 0.25, 0.45);
        this.group.add(head);

        const eyeL = box(0.04, 0.04, 0.02, 0x111111);
        eyeL.position.set(-0.07, 0.28, 0.58);
        this.group.add(eyeL);
        const eyeR = box(0.04, 0.04, 0.02, 0x111111);
        eyeR.position.set(0.07, 0.28, 0.58);
        this.group.add(eyeR);

        const flipper = (ox, oz, angle) => {
            const f = box(0.25, 0.05, 0.15, 0xa2ad73, true);
            f.position.set(ox, 0.18, oz);
            f.rotation.y = angle;
            this.group.add(f);
            this.flippers.push(f);
        };
        flipper(-0.38, 0.2, -0.3);
        flipper(0.38, 0.2, 0.3);
        flipper(-0.35, -0.2, -0.2);
        flipper(0.35, -0.2, 0.2);

        this.box = new THREE.Box3();
    }

    _buildParrot() {
        this.isFlying = true;
        this.parrotTarget = null;
        this.parrotPerchUntil = 0;
        this.parrotNextRetarget = 0;
        this.flapPhase = Math.random() * Math.PI * 2;
        this.wings = [];

        const box = (w, h, d, c, painted = false) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._getTexMat(c, undefined, painted));
        const BEAK = 0xE8B89A;
        const FEET = 0xC9A88A;
        const DARK = 0x1a1a1a;

        const body = box(0.32, 0.42, 0.32, 0xffffff, true);
        body.position.y = 0.55;
        this.group.add(body);

        const head = box(0.32, 0.32, 0.30, 0xffffff, true);
        head.position.set(0, 0.92, 0.04);
        this.group.add(head);

        // Schwarze Augenmaske
        const mask = box(0.33, 0.13, 0.06, DARK);
        mask.position.set(0, 0.90, 0.18);
        this.group.add(mask);

        const eyeL = box(0.04, 0.04, 0.02, 0xFFFFFF);
        eyeL.position.set(-0.09, 0.90, 0.21);
        this.group.add(eyeL);
        const eyeR = box(0.04, 0.04, 0.02, 0xFFFFFF);
        eyeR.position.set(0.09, 0.90, 0.21);
        this.group.add(eyeR);

        // Schnabel
        const beak = box(0.10, 0.09, 0.10, BEAK);
        beak.position.set(0, 0.81, 0.22);
        this.group.add(beak);

        // Federn auf dem Kopf
        const feather1 = box(0.06, 0.20, 0.06, 0xffffff, true);
        feather1.position.set(-0.07, 1.18, -0.04);
        feather1.rotation.z = -0.25;
        this.group.add(feather1);
        const feather2 = box(0.06, 0.20, 0.06, 0xffffff, true);
        feather2.position.set(0.07, 1.18, -0.01);
        feather2.rotation.z = 0.18;
        this.group.add(feather2);

        // Flügel mit Drehgelenk
        const buildWing = (side) => {
            const wingGroup = new THREE.Group();
            const w1 = box(0.08, 0.34, 0.30, 0xffffff, true);
            w1.position.set(side * 0.04, -0.17, 0);
            wingGroup.add(w1);
            const w2 = box(0.08, 0.10, 0.24, 0xffd267, true);
            w2.position.set(side * 0.04, -0.34, -0.02);
            wingGroup.add(w2);
            const w3 = box(0.08, 0.10, 0.16, 0x75a8df, true);
            w3.position.set(side * 0.04, -0.45, -0.06);
            wingGroup.add(w3);
            wingGroup.position.set(side * 0.18, 0.73, 0);
            this.group.add(wingGroup);
            this.wings.push(wingGroup);
        };
        buildWing(-1);
        buildWing(1);

        // Schwanz
        const tail = box(0.18, 0.08, 0.24, 0xb24a3e, true);
        tail.position.set(0, 0.45, -0.22);
        this.group.add(tail);

        // Beine/Füße
        const footL = box(0.06, 0.10, 0.10, FEET);
        footL.position.set(-0.09, 0.32, 0);
        this.group.add(footL);
        const footR = box(0.06, 0.10, 0.10, FEET);
        footR.position.set(0.09, 0.32, 0);
        this.group.add(footR);
    }

    _findTreeTarget(pos, world) {
        const LEAVES = 6, JUNGLE_LEAVES = 14, PALM_LEAVES = 16;
        const candidates = [];
        const R = 14;
        const cx = Math.floor(pos.x), cz = Math.floor(pos.z);
        const cy = Math.floor(pos.y);

        // Sparse-Sampling um Performance zu schonen
        for (let dx = -R; dx <= R; dx += 2) {
            for (let dz = -R; dz <= R; dz += 2) {
                const distSq = dx * dx + dz * dz;
                if (distSq < 16 || distSq > R * R) continue;
                for (let dy = 8; dy >= -4; dy--) {
                    const y = cy + dy;
                    const b = world.getBlock(cx + dx, y, cz + dz);
                    if (b === LEAVES || b === JUNGLE_LEAVES || b === PALM_LEAVES) {
                        const above = world.getBlock(cx + dx, y + 1, cz + dz);
                        if (above === 0) {
                            candidates.push(new THREE.Vector3(cx + dx + 0.5, y + 1.6, cz + dz + 0.5));
                        }
                        break;
                    }
                }
                if (candidates.length > 24) break;
            }
            if (candidates.length > 24) break;
        }
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    updateParrot(delta, playerPos, world) {
        const time = performance.now();
        const pos = this.group.position;

        if (pos.distanceTo(playerPos) > SPAWN_DIST_MAX + 15) {
            this.isDead = true;
            return;
        }

        const isPerched = time < this.parrotPerchUntil;

        // Flügelschlag-Animation
        if (this.wings && this.wings.length === 2) {
            if (isPerched) {
                this.wings[0].rotation.z = 0.05;
                this.wings[1].rotation.z = -0.05;
            } else {
                const flap = Math.sin(time * 0.025 + this.flapPhase) * 0.9;
                this.wings[0].rotation.z = -flap;
                this.wings[1].rotation.z = flap;
            }
        }

        if (isPerched) {
            this.velocity.set(0, 0, 0);
            // Leichtes Wippen auf der Sitzstange
            const sway = Math.sin(time * 0.003) * 0.02;
            this.group.rotation.y += sway * delta;
            return;
        }

        // Neues Ziel suchen, falls keines vorhanden oder am aktuellen Ziel angekommen
        if (!this.parrotTarget) {
            this.parrotTarget = this._findTreeTarget(pos, world);
            if (!this.parrotTarget) {
                // Kein Baum in der Nähe → kurze Pause, dann erneut versuchen
                this.parrotPerchUntil = time + 1500;
                return;
            }
        } else if (pos.distanceTo(this.parrotTarget) < 1.0) {
            // Ziel erreicht → kurze Verschnaufpause auf dem Baum
            pos.copy(this.parrotTarget);
            this.parrotPerchUntil = time + 3000 + Math.random() * 5000;
            this.parrotTarget = null;
            return;
        }

        // Sicherheits-Timeout: falls Ziel unerreichbar (z.B. Baum verschwunden), nach 12s neu wählen
        if (!this.parrotNextRetarget || time > this.parrotNextRetarget) {
            this.parrotNextRetarget = time + 12000;
        }
        if (time > this.parrotNextRetarget) {
            this.parrotTarget = null;
            this.parrotNextRetarget = 0;
            return;
        }

        // Zum Ziel fliegen
        const tx = this.parrotTarget.x - pos.x;
        const ty = this.parrotTarget.y - pos.y;
        const tz = this.parrotTarget.z - pos.z;
        const horizDist = Math.hypot(tx, tz);

        const speed = 3.5;
        if (horizDist > 0.01) {
            this.velocity.x = (tx / horizDist) * speed;
            this.velocity.z = (tz / horizDist) * speed;
            this.group.rotation.y = Math.atan2(tx, tz);
        }
        this.velocity.y = Math.max(-2.5, Math.min(2.5, ty * 2.5));

        pos.x += this.velocity.x * delta;
        pos.y += this.velocity.y * delta;
        pos.z += this.velocity.z * delta;
    }

    _buildGeist() {
        this.isFlying = true;
        this.floatOffset = Math.random() * Math.PI * 2;
        this._geistWander = false;

        const ghostMat = new THREE.MeshPhongMaterial({
            color: 0xddeeff,
            transparent: true,
            opacity: 0.70,
            emissive: 0x3355aa,
            emissiveIntensity: 0.28,
            side: THREE.DoubleSide
        });
        const eyeMat = new THREE.MeshPhongMaterial({
            color: 0x111133,
            transparent: true,
            opacity: 0.92
        });
        const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || ghostMat);

        // Kopf (etwas breiter als der Körper)
        const head = box(0.76, 0.66, 0.66);
        head.position.y = 1.05;
        this.group.add(head);

        // Körper
        const body = box(0.70, 0.72, 0.56);
        body.position.y = 0.46;
        this.group.add(body);

        // Hohle Augen
        const eyeL = box(0.18, 0.16, 0.06, eyeMat);
        eyeL.position.set(-0.18, 1.10, 0.34);
        this.group.add(eyeL);

        const eyeR = box(0.18, 0.16, 0.06, eyeMat);
        eyeR.position.set(0.18, 1.10, 0.34);
        this.group.add(eyeR);

        // Mund (traurig / neutral)
        const mouth = box(0.28, 0.09, 0.06, eyeMat);
        mouth.position.set(0, 0.87, 0.34);
        this.group.add(mouth);

        // Wellige Fransen unten (3 Stück)
        this.tendrils = [];
        for (let i = 0; i < 3; i++) {
            const t = box(0.20, 0.33, 0.20);
            t.position.set((i - 1) * 0.26, 0.10, 0);
            t.userData.tendrilIdx = i;
            this.tendrils.push(t);
            this.group.add(t);
        }
    }

    updateGeist(delta, playerPos, world, dayRatio) {
        const time = performance.now();
        const pos = this.group.position;

        // Am Tag lautlos auflösen
        if (dayRatio >= 0.25 && dayRatio <= 0.75) {
            this.isDead = true;
            return;
        }

        // Zu weit weg → despawnen
        if (pos.distanceTo(playerPos) > SPAWN_DIST_MAX + 15) {
            this.isDead = true;
            return;
        }

        // Tendril-Wellenanimation
        if (this.tendrils) {
            this.tendrils.forEach((t, i) => {
                t.position.y = 0.06 + Math.sin(time * 0.0018 + i * 1.1) * 0.10;
                t.rotation.z = Math.sin(time * 0.0013 + i * 0.9) * 0.18;
            });
        }

        // Sanftes Zufalls-Driften (neue Richtung alle ~5 s)
        if (!this._geistWander || Math.random() < 0.003) {
            const angle = Math.random() * Math.PI * 2;
            this.velocity.x = Math.cos(angle) * 1.3;
            this.velocity.z = Math.sin(angle) * 1.3;
            this.group.rotation.y = angle;
            this._geistWander = true;
        }

        // Ziel-Höhe: 4–7 Blöcke über Boden + sanftes Wippen
        const groundY = this._getGroundY(pos, world);
        const targetY = groundY + 4.5 + Math.sin(time * 0.0009 + this.floatOffset) * 1.5;
        this.velocity.y = (targetY - pos.y) * 2.5;

        pos.x += this.velocity.x * delta;
        pos.y += this.velocity.y * delta;
        pos.z += this.velocity.z * delta;

        // Horizontale Dämpfung (weiches Gleiten)
        this.velocity.x *= 0.97;
        this.velocity.z *= 0.97;
    }

    _getGroundY(pos, world) {
        const cx = Math.floor(pos.x), cz = Math.floor(pos.z);
        for (let y = Math.min(Math.floor(pos.y) + 3, 63); y > 0; y--) {
            const b = world.getBlock(cx, y, cz);
            if (b !== 0 && b !== 4 && b !== 8 && b !== 9) return y + 1;
        }
        return 1;
    }

    update(delta, playerPos, world, onDamage, dayRatio = 0.5) {
        if (this.isDead) return;
        if (this.updateVisualLod(playerPos)) {
            this._farUpdateAccumulator = (this._farUpdateAccumulator || 0) + delta;
            if (this._farUpdateAccumulator < MOB_FAR_UPDATE_INTERVAL) return;
            delta = this._farUpdateAccumulator;
            this._farUpdateAccumulator = 0;
        } else {
            this._farUpdateAccumulator = 0;
        }
        if (this.isAquatic) { this.updateAquatic(delta, playerPos, world, onDamage); return; }
        if (this.type === 'geist') { this.updateGeist(delta, playerPos, world, dayRatio); return; }
        if (this.type === 'parrot') { this.updateParrot(delta, playerPos, world); return; }
                const pos = this.group.position;
                const dist = pos.distanceTo(playerPos);

                if (!this.lastSound || performance.now() - this.lastSound > 3000) {
                    if (Math.random() < 0.005) { 
                        this.lastSound = performance.now();
                        // Position übergeben → 3D-Spatial (Distanz-Attenuation + Stereo-Pan).
                        // Distanz-Filter (dist < N) bleibt als Early-Exit, der Sound-Manager macht
                        // den finalen Falloff fein.
                        if (this.type === 'zombie' && dist < 25) SoundManager.playZombie(pos);
                        else if (this.type === 'pig' && dist < 20) SoundManager.playPig(pos);
                        else if (this.type === 'sheep' && dist < 20) SoundManager.playSheep(pos);
                        else if (this.type === 'cow' && dist < 20) SoundManager.playCow(pos);
                        else if (this.type === 'chicken' && dist < 20) SoundManager.playChicken(pos);
                    }
                }
                
                // Despawn, wenn Mob zu weit weg ist (damit in der Nähe des Spielers neue spawnen können)
                if (dist > SPAWN_DIST_MAX + 15) {
                    this.isDead = true;
                    return;
                }
                
                const checkMobC = (np) => Physics.checkAABBCollision(world, np, 0.3, 0.6, 1.8, true);

                const isHostileWalker = this.type === 'zombie' || this.type === 'skeleton' || this.type === 'spider';
                const detectionRange = this.type === 'spider' ? SPIDER_DETECTION_RANGE : ZOMBIE_DETECTION_RANGE;
                if (isHostileWalker && dist < detectionRange) {
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
                         const speed = this.type === 'skeleton' ? SKELETON_SPEED : (this.type === 'spider' ? SPIDER_SPEED : ZOMBIE_SPEED);
                        if ((this.type === 'skeleton' && dist < 10) || (this.type === 'zombie' && dist < 2.0)) {
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
                            this.velocity.x = dirX * (isHostileWalker ? (this.type === 'spider' ? SPIDER_SPEED : ZOMBIE_SPEED) : WANDER_SPEED);
                            this.velocity.z = dirZ * (isHostileWalker ? (this.type === 'spider' ? SPIDER_SPEED : ZOMBIE_SPEED) : WANDER_SPEED);
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
                        } else if (this.legs.length === 8) {
                            for (let i = 0; i < this.legs.length; i++) {
                                this.legs[i].rotation.x = Math.sin(walkCycle + (i % 2) * Math.PI) * 0.35;
                            }
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
                    if (!Game.droppedItems) Game.droppedItems = [];
                    Game.droppedItems.push({ mesh: eggMesh, velocityY: 0, blockType: 17 });
                }

                if ((this.type === 'zombie' || this.type === 'skeleton') && dist < 2.0) onDamage(ZOMBIE_DAMAGE * delta);
                if (this.type === 'spider') {
                    const horizontalDist = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
                    if (horizontalDist < 1.6 && Math.abs(pos.y - playerPos.y) < 2.0) {
                        onDamage(SPIDER_DAMAGE * delta);
                    }
                }
            }
            takeDamage(amount, onKill) {
                if (this.type === 'octopus') return; // Unsterblich
                if (this.type === 'geist') return;   // Geist – unantastbar, kein Schaden möglich
                this.health -= amount;
                if (this.health <= 0) {
                    this.isDead = true;
                    
                    let blockType = null;
                    let dropColor = 0xFFFFFF;
                    if (this.type === 'fish' || this.type === 'octopus') { blockType = 21; dropColor = 0xFF9800; }
                    else if (this.type === 'pig' || this.type === 'cow') { blockType = 22; dropColor = 0xFF9999; }
                    else if (this.type === 'chicken') { blockType = 23; dropColor = 0xFFEEBB; }
                    else if (this.type === 'zombie') { blockType = 24; dropColor = 0x3a5f0b; }
                    else if (this.type === 'skeleton') { blockType = 31; dropColor = 0xebebeb; }
                    else if (this.type === 'spider') { blockType = BLOCK_TYPES.STRING; dropColor = 0xF2F2F2; }
                    else if (this.type === 'sheep') { blockType = 25; dropColor = 0xFFB6C1; }
                    else if (this.type === 'turtle') { blockType = 55; dropColor = 0x4A7A3D; }

                    if (blockType) {
                        const dropMesh = new THREE.Mesh(
                            new THREE.BoxGeometry(0.2, 0.2, 0.2),
                            new THREE.MeshPhongMaterial({ color: dropColor })
                        );
                        dropMesh.position.copy(this.group.position);
                        dropMesh.position.y += 0.3;
                        this.scene.add(dropMesh);
                        if (!Game.droppedItems) Game.droppedItems = [];
                        Game.droppedItems.push({ mesh: dropMesh, velocityY: 2.0, blockType: blockType });
                    }
                }
            }
        }

export const projectiles = [];

// Hard cap: zerstört Pfeile spätestens nach 5s — schützt vor unbegrenztem Wachstum,
// falls ein Pfeil nie auf Block/Player trifft (z.B. nach oben in den Himmel geschossen).
const ARROW_MAX_LIFETIME = 5.0;
// Sicherheits-Cap, falls Skelette extrem spammen (z.B. Bug oder Cheat).
const PROJECTILE_HARD_CAP = 200;

export class ArrowProjectile {
    constructor(scene, startPos, dir) {
        this.scene = scene;
        this.dir = dir;
        this.speed = 22.0;
        this.isDead = false;
        this.age = 0; // Sekunden seit Spawn

        this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), new THREE.MeshPhongMaterial({ color: 0x555555 }));
        this.mesh.position.copy(startPos);

        const target = new THREE.Vector3().copy(startPos).add(dir);
        this.mesh.lookAt(target);

        scene.add(this.mesh);
    }

    // Zentralisiert: Mesh aus Scene entfernen UND GPU-Ressourcen freigeben.
    // Geometry + Material sind hier per-Pfeil (NICHT geteilt) → beides disposen.
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
        this.isDead = true;
    }

    update(delta, playerPos, world, onDamage) {
        if (this.isDead) return;

        this.age += delta;
        if (this.age >= ARROW_MAX_LIFETIME) {
            this.dispose();
            return;
        }

        const moveVec = _tempProjectileMove.copy(this.dir).multiplyScalar(this.speed * delta);
        this.mesh.position.add(moveVec);

        if (this.mesh.position.distanceTo(playerPos) < 1.0) {
            onDamage(10);
            this.dispose();
            return;
        }

        const block = world.getBlock(Math.floor(this.mesh.position.x), Math.floor(this.mesh.position.y), Math.floor(this.mesh.position.z));
        if (block !== 0 && block !== 4 && block !== 8) {
            this.dispose();
        }
    }
}

export function updateProjectiles(delta, playerPos, world, onDamage) {
    // Sicherheits-Cap: bei extremer Anzahl die ältesten zwangsweise entsorgen.
    while (projectiles.length > PROJECTILE_HARD_CAP) {
        const old = projectiles.shift();
        if (old && typeof old.dispose === 'function') old.dispose();
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(delta, playerPos, world, onDamage);
        if (p.isDead) {
            projectiles.splice(i, 1);
        }
    }
}
