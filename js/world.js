import * as THREE from 'three';
import { CONFIG } from '../config.js?v=1775830882304';
import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas } from './blocks.js?v=1775830882304';

const { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, RENDER_DIST, CLOUD_HEIGHT } = CONFIG.WORLD;

export const BIOMES = { OCEAN: 'Ozean', DESERT: 'Wüste', JUNGLE: 'Urwald', SNOW: 'Schneefeld', PLAINS: 'Grasland' };

        function mulberry32(a) {
            return function () {
                var t = a += 0x6D2B79F5;
                t = Math.imul(t ^ t >>> 15, t | 1);
                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        }

        function noise2D(x, z, seed = 123) {
            const getComp = (f, a) => (Math.sin(x * f + seed) + Math.cos(z * f + seed)) * a;
            // Noch flachere Berge (Amplituden reduziert von 4/6/8 auf 2/4/5)
            return getComp(0.1, 2) + getComp(0.05, 4) + getComp(0.02, 5); 
        }

        export function getBiomeAt(x, z) {
            const temp = (Math.sin(x * 0.01) + Math.cos(z * 0.01)) * 0.5;
            const humidity = (Math.sin(x * 0.01 + 500) + Math.cos(z * 0.01 + 500)) * 0.5;
            if (temp < -0.6) return BIOMES.SNOW;
            if (temp > 0.5) return humidity < -0.3 ? BIOMES.DESERT : BIOMES.JUNGLE;
            return humidity < -0.25 ? BIOMES.OCEAN : BIOMES.PLAINS;
        }

        export function getHeightAt(wx, wz) {
            const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
            const oceanFactor = Math.max(0, Math.min(1, (-0.15 - humidity) / 0.4));
            let baseH = noise2D(wx, wz) + 38; 
            baseH -= oceanFactor * 22; 
            if (getBiomeAt(wx, wz) === BIOMES.DESERT) baseH += Math.sin(wx * 0.2) * 2;
            return Math.floor(baseH);
        }

        // Würfel-Gesichter als Modul-Konstante (statt pro build()-Aufruf neu definiert)
        const CUBE_FACES = [{ d: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] }, { d: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] }, { d: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] }, { d: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] }, { d: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { d: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] }];

        // --- WORLD CLASS ---
        export class World {
            constructor(scene) {
                this.scene = scene;
                this.chunks = new Map();
                this.modifiedBlocks = {};
                this.opaqueMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, map: textureAtlas, shininess: 10, alphaTest: 0.5 });
                this.waterMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 100, depthWrite: false });

                this.worker = new Worker('js/chunkWorker.js');
                this.worker.postMessage({ type: 'init', config: CONFIG.WORLD });
                this.queuedChunks = new Set();
                this.chunkPool = [];
                
                this.worker.onmessage = (e) => {
                    const {cx, cz, data} = e.data;
                    this.queuedChunks.delete(this.getChunkKey(cx, cz));
                    
                    for (const key in this.modifiedBlocks) {
                        const [bx, by, bz] = key.split(',').map(Number);
                        const bcx = Math.floor(bx / CHUNK_SIZE);
                        const bcz = Math.floor(bz / CHUNK_SIZE);
                        if (bcx === cx && bcz === cz && by >= 0 && by < CHUNK_HEIGHT) {
                            const lx = bx - cx * CHUNK_SIZE;
                            const lz = bz - cz * CHUNK_SIZE;
                            data[(by * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx] = this.modifiedBlocks[key];
                        }
                    }

                    const chunk = { cx, cz, data: new Uint8Array(data), mesh: null, waterMesh: null };
                    this.chunks.set(this.getChunkKey(cx, cz), chunk);
                    this.updateChunkMesh(cx, cz);
                    this.updateChunkMesh(cx - 1, cz); this.updateChunkMesh(cx + 1, cz);
                    this.updateChunkMesh(cx, cz - 1); this.updateChunkMesh(cx, cz + 1);
                };
            }
            getChunkKey(x, z) { return `${x},${z}`; }
            generateChunk(cx, cz) {
                const key = this.getChunkKey(cx, cz);
                if (this.chunks.has(key) || this.queuedChunks.has(key)) return;
                this.queuedChunks.add(key);
                
                const pooledBuffer = this.chunkPool.pop();
                if (pooledBuffer) {
                    this.worker.postMessage({ type: 'generate', cx, cz, buffer: pooledBuffer }, [pooledBuffer]);
                } else {
                    this.worker.postMessage({ type: 'generate', cx, cz });
                }
            }
            updateChunkMesh(cx, cz) {
                const chunk = this.chunks.get(this.getChunkKey(cx, cz)); if (!chunk) return;
                if (chunk.mesh) this.scene.remove(chunk.mesh); if (chunk.waterMesh) this.scene.remove(chunk.waterMesh);
                
                const build = (isW) => {
                    const pos = [], col = [], norm = [], idx = [], uv = []; let vc = 0;
                    for (let y = 0; y < CHUNK_HEIGHT; y++) {
                        for (let z = 0; z < CHUNK_SIZE; z++) {
                            for (let x = 0; x < CHUNK_SIZE; x++) {
                                const t = this.getBlock(cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z);
                                if (t === 0 || (t === 4) !== isW) continue;
                                const bc = new THREE.Color(BLOCK_COLORS[t]);
                                const rng = mulberry32(x * 12 + y * 34 + z * 56 + cx * 78 + cz * 90);
                                bc.multiplyScalar(0.9 + rng() * 0.2);

                                if (t === 9 || t === 10 || t === 27 || t === 43 || t === 44 || t === 46 || t === 47 || t === 48 || t === 49 || t === 50 || t === 52) {
                                    // Visual Excellence 2D Elements: Stern-Mesh (3 Flächen à 60°) + Variation
                                    const rng2 = mulberry32(x * 123 + y * 456 + z * 789 + cx * 101 + cz * 202);
                                    const offX = (rng2() - 0.5) * 0.4;
                                    const offZ = (rng2() - 0.5) * 0.4;
                                    
                                    // Verschiedene Höhen je nach Pflanzentyp
                                    let scaleY;
                                    if (t === 44) scaleY = 0.4 + rng2() * 0.3;           // Hohes Gras: 0.4-0.7
                                    else if (t === 50) scaleY = 0.5 + rng2() * 0.3;      // Farn: 0.5-0.8
                                    else if (t === 47 || t === 48) scaleY = 0.3 + rng2() * 0.2; // Pilze: 0.3-0.5
                                    else if (t === 9 || t === 10) scaleY = 0.5 + rng2() * 0.3;  // Blumen: 0.5-0.8
                                    else if (t === 43 || t === 52) scaleY = 0.8 + rng2() * 0.5; // Beerenbüsche: 0.8-1.3
                                    else if (t === 46) scaleY = 0.7 + rng2() * 0.6;      // Toter Strauch: 0.7-1.3
                                    else if (t === 49) scaleY = 1.0 + rng2() * 0.6;      // Zuckerrohr: 1.0-1.6
                                    else scaleY = 0.7 + rng2() * 0.5;                    // Standard (Stöcke etc.)
                                    
                                    // Use texture atlas mappings for flowers
                                    bc.set(0xffffff); // Use pristine texture atlas colors
                                    bc.multiplyScalar(0.8 + rng2() * 0.4); // Helligkeits-Variation

                                    // Pick proper texture (using 15 as fallback red flower if t=10 fails)
                                    const texIdx = BLOCK_TEX[t] || 15;
                                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                                    const u1 = u0 + 1/16, v1 = v0 + 1/16;

                                    for (let i = 0; i < 3; i++) {
                                        const angle = (i * Math.PI) / 3;
                                        const c = Math.cos(angle) * 0.5;
                                        const s = Math.sin(angle) * 0.5;
                                        const st = vc;
                                        // Ebene zentriert im Block mit Offset
                                        pos.push(x + 0.5 - c + offX, y, z + 0.5 - s + offZ, 
                                                 x + 0.5 + c + offX, y, z + 0.5 + s + offZ, 
                                                 x + 0.5 + c + offX, y + scaleY, z + 0.5 + s + offZ, 
                                                 x + 0.5 - c + offX, y + scaleY, z + 0.5 - s + offZ);
                                        col.push(bc.r, bc.g, bc.b, bc.r, bc.g, bc.b, bc.r, bc.g, bc.b, bc.r, bc.g, bc.b);
                                        norm.push(-s, 0, c, -s, 0, c, -s, 0, c, -s, 0, c);
                                        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                                        idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                                    }
                                    continue;
                                }

                                // TÜREN: Schmale Wand (0.15 Blöcke dick, zentriert auf Z-Achse)
                                if (t === 33 || t === 34) {
                                    bc.set(0xffffff);
                                    const texIdx = BLOCK_TEX[t] || 0;
                                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                                    const u1 = u0 + 1/16, v1 = v0 + 1/16;
                                    const thick = 0.15;
                                    // Vorderseite
                                    let st = vc;
                                    pos.push(x, y, z+0.5-thick/2,  x+1, y, z+0.5-thick/2,  x+1, y+1, z+0.5-thick/2,  x, y+1, z+0.5-thick/2);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    // Rückseite
                                    st = vc;
                                    pos.push(x+1, y, z+0.5+thick/2,  x, y, z+0.5+thick/2,  x, y+1, z+0.5+thick/2,  x+1, y+1, z+0.5+thick/2);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    continue;
                                }

                                // BETTEN: Flache Geometrie (halbe Blockhöhe)
                                if (t === 38 || t === 39) {
                                    bc.set(0xffffff);
                                    const texIdx = BLOCK_TEX[t] || 0;
                                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                                    const u1 = u0 + 1/16, v1 = v0 + 1/16;
                                    const bh = 0.5; // Halbe Blockhöhe
                                    // Oberseite
                                    let st = vc;
                                    pos.push(x,y+bh,z+1, x+1,y+bh,z+1, x+1,y+bh,z, x,y+bh,z);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    // Vorderseite (schmal)
                                    st = vc;
                                    pos.push(x,y,z+1, x+1,y,z+1, x+1,y+bh,z+1, x,y+bh,z+1);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(0,0,1, 0,0,1, 0,0,1, 0,0,1);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    // Rückseite
                                    st = vc;
                                    pos.push(x+1,y,z, x,y,z, x,y+bh,z, x+1,y+bh,z);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    // Linke Seite
                                    st = vc;
                                    pos.push(x,y,z, x,y,z+1, x,y+bh,z+1, x,y+bh,z);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(-1,0,0, -1,0,0, -1,0,0, -1,0,0);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    // Rechte Seite
                                    st = vc;
                                    pos.push(x+1,y,z+1, x+1,y,z, x+1,y+bh,z, x+1,y+bh,z+1);
                                    col.push(bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b, bc.r,bc.g,bc.b);
                                    norm.push(1,0,0, 1,0,0, 1,0,0, 1,0,0);
                                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                                    continue;
                                }

                                CUBE_FACES.forEach(f => {
                                    const nx = x + f.d[0], ny = y + f.d[1], nz = z + f.d[2];
                                    const gX = cx * CHUNK_SIZE + nx, gZ = cz * CHUNK_SIZE + nz;
                                    const neigh = this.getBlock(gX, ny, gZ);
                                    
                                    let shouldDraw = false;
                                    if (isW) {
                                        if (neigh === 0) shouldDraw = true;
                                    } else {
                                        if (neigh === 0 || neigh === -1 || neigh === 4 || neigh === 9 || neigh === 10 || neigh === 27 || neigh === 32 || neigh === 33 || neigh === 34 || neigh === 36 || neigh === 38 || neigh === 39 || neigh === 43 || neigh === 44 || neigh === 46 || neigh === 47 || neigh === 48 || neigh === 49 || neigh === 50 || neigh === 52) shouldDraw = true;
                                    }

                                    if (shouldDraw) {
                                        const st = vc;
                                        const texIdx = BLOCK_TEX[t] || 0;
                                        const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                                        const u1 = u0 + 1/16, v1 = v0 + 1/16;
                                        const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

                                        f.v.forEach((v, i) => { 
                                            pos.push(x + v[0], y + v[1], z + v[2]); 
                                            col.push(bc.r, bc.g, bc.b); 
                                            norm.push(f.d[0], f.d[1], f.d[2]);
                                            uv.push(uvs[i][0], uvs[i][1]);
                                        });
                                        idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                                    }
                                });
                            }
                        }
                    }
                    if (vc === 0) return null;
                    const geom = new THREE.BufferGeometry();
                    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                    geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
                    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
                    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
                    geom.setIndex(idx);
                    const mesh = new THREE.Mesh(geom, isW ? this.waterMaterial : this.opaqueMaterial);
                    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE); return mesh;
                };
                chunk.mesh = build(false); if (chunk.mesh) this.scene.add(chunk.mesh);
                chunk.waterMesh = build(true); if (chunk.waterMesh) this.scene.add(chunk.waterMesh);
            }
            getBlock(x, y, z) {
                const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
                const chunk = this.chunks.get(this.getChunkKey(cx, cz)); 
                // WICHTIG: -1 signalisiert einen ungeladenen Chunk (Verhindert "Sicht durch die Welt")
                if (!chunk) return -1;
                const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
                return (y < 0 || y >= CHUNK_HEIGHT) ? 0 : chunk.data[(y * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx];
            }
            setBlock(x, y, z, t, updateMesh = true) {
                if (y < 0 || y >= CHUNK_HEIGHT) return;
                this.modifiedBlocks[`${x},${y},${z}`] = t;
                const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
                const chunk = this.chunks.get(this.getChunkKey(cx, cz)); if (!chunk) return;
                const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
                chunk.data[(y * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx] = t;
                if (updateMesh) {
                    this.updateChunkMesh(cx, cz);
                    if (lx === 0) this.updateChunkMesh(cx - 1, cz); if (lx === CHUNK_SIZE - 1) this.updateChunkMesh(cx + 1, cz);
                    if (lz === 0) this.updateChunkMesh(cx, cz - 1); if (lz === CHUNK_SIZE - 1) this.updateChunkMesh(cx, cz + 1);
                }
            }
            updateVisibleChunks(pX, pZ) {
                const pcx = Math.floor(pX / CHUNK_SIZE), pcz = Math.floor(pZ / CHUNK_SIZE);
                for (let x = pcx - RENDER_DIST; x <= pcx + RENDER_DIST; x++) {
                    for (let z = pcz - RENDER_DIST; z <= pcz + RENDER_DIST; z++) this.generateChunk(x, z);
                }
                for (const [key, chunk] of this.chunks) {
                    if (Math.abs(chunk.cx - pcx) > RENDER_DIST + 1 || Math.abs(chunk.cz - pcz) > RENDER_DIST + 1) {
                        if (chunk.mesh) this.scene.remove(chunk.mesh); if (chunk.waterMesh) this.scene.remove(chunk.waterMesh);
                        if (chunk.data) this.chunkPool.push(chunk.data.buffer);
                        this.chunks.delete(key);
                    }
                }
            }
        }