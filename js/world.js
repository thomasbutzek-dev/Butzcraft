import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas } from './blocks.js?v=20260507b';

// RENDER_DIST wird NICHT destrukturiert, damit Laufzeit-Änderungen via Settings sofort wirken.
// CHUNK_SIZE/HEIGHT etc. sind hingegen statisch und werden beim Welt-Load fest verdrahtet.
const { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, CLOUD_HEIGHT } = CONFIG.WORLD;

export const BIOMES = { OCEAN: 'Ozean', DESERT: 'Wüste', JUNGLE: 'Urwald', SNOW: 'Schneefeld', PLAINS: 'Grasland' };

        function noise2D(x, z, seed = 123) {
            const getComp = (f, a) => (Math.sin(x * f + seed) + Math.cos(z * f + seed)) * a;
            // Noch flachere Berge (Amplituden reduziert von 4/6/8 auf 2/4/5)
            return getComp(0.1, 2) + getComp(0.05, 4) + getComp(0.02, 5); 
        }

        export function getBiomeAt(x, z) {
            const temp = (Math.sin(x * 0.01) + Math.cos(z * 0.01)) * 0.5;
            const humidity = (Math.sin(x * 0.01 + 500) + Math.cos(z * 0.01 + 500)) * 0.5;
            if (temp < -0.4) return BIOMES.SNOW;
            if (temp > 0.2) return humidity < -0.15 ? BIOMES.DESERT : BIOMES.JUNGLE;
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

        // --- WORLD CLASS ---
        export class World {
            constructor(scene) {
                this.scene = scene;
                this.chunks = new Map();
                this.modifiedBlocks = {};
                this.blockMeta = {};    // "x,y,z" → metadata byte (Tür-Rotation etc.)
                this.chestContents = {}; // "chest,x,y,z" → Array<{type,count}>
                this.lootedChests = new Set(); // Keys von Kisten, die bereits einmal geöffnet wurden
                this.fireBlocks = new Map();    // "x,y,z" → { remaining: seconds } — aktive Feuer-Blöcke
                this.spawnerMeta = {};           // "x,y,z" → { lastSpawn, mobCount } — Spawner-Zustand
                this.villages = [];              // [{cx,cz,x,y,z}] — erkannte Dörfer für NPC-Spawn
                this.uTime = { value: 0 };
                this.pendingMeshes = new Set(); // Verhindert doppelte Mesh-Requests
                
                // Opaque Material mit Wind-Shader für Vegetation +
                // Atlas-Tiling-Shader für Greedy-Meshing-Quads.
                //
                // Wie funktioniert das Atlas-Tiling?
                //   - aAtlasUV.x < 0  → Vertex benutzt vMapUv direkt (Special-Block-Pfad: Pflanzen,
                //                       Türen, Betten — UV ist bereits in Atlas-Koordinaten).
                //   - aAtlasUV.x ≥ 0  → vMapUv wird per fract() in [0,1)² getiled, dann in die
                //                       16×16-Atlas-Zelle bei aAtlasUV gemappt. So kann ein
                //                       greedy-merged Quad die Tile-Textur N×M-fach wiederholen,
                //                       ohne benachbarte Atlas-Zellen anzuschneiden.
                this.opaqueMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, map: textureAtlas, shininess: 10, alphaTest: 0.5 });
                const windTime = this.uTime;
                this.opaqueMaterial.onBeforeCompile = (shader) => {
                    shader.uniforms.uTime = windTime;
                    shader.vertexShader = shader.vertexShader.replace(
                        'void main() {',
                        'attribute float aSway;\nattribute vec2 aAtlasUV;\nuniform float uTime;\nvarying vec2 vAtlasUV;\nvoid main() {\n  vAtlasUV = aAtlasUV;'
                    );
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `#include <begin_vertex>
                        if (aSway > 0.5) {
                            float windStr = sin(uTime * 1.8 + position.x * 0.7 + position.z * 0.9) * 0.08;
                            float windStr2 = cos(uTime * 1.3 + position.x * 0.5 + position.z * 1.1) * 0.05;
                            transformed.x += windStr * aSway;
                            transformed.z += windStr2 * aSway;
                        }`
                    );
                    // Fragment: Atlas-Tiling für Greedy-Quads. Inset um eps gegen
                    // Texture-Bleeding zwischen benachbarten Atlas-Zellen.
                    shader.fragmentShader = shader.fragmentShader.replace(
                        'void main() {',
                        'varying vec2 vAtlasUV;\nvoid main() {'
                    );
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <map_fragment>',
                        `vec2 _atlasFinalUV;
                        if (vAtlasUV.x < 0.0) {
                            _atlasFinalUV = vMapUv;
                        } else {
                            float _atlasEps = 0.5 / 1024.0;
                            vec2 _local = fract(vMapUv);
                            _atlasFinalUV = vAtlasUV + _local * (1.0/16.0 - 2.0*_atlasEps) + vec2(_atlasEps);
                        }
                        vec4 sampledDiffuseColor = texture2D( map, _atlasFinalUV );
                        diffuseColor *= sampledDiffuseColor;`
                    );
                };
                
                // Water Material mit Wellen-Shader
                this.waterMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 100, depthWrite: false });
                this.waterMaterial.onBeforeCompile = (shader) => {
                    shader.uniforms.uTime = windTime;
                    shader.vertexShader = shader.vertexShader.replace(
                        'void main() {',
                        'uniform float uTime;\nvoid main() {'
                    );
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `#include <begin_vertex>
                        vec4 waveWorldPos = modelMatrix * vec4(position, 1.0);
                        transformed.y += sin(waveWorldPos.x * 1.5 + uTime * 1.8) * 0.04
                                       + cos(waveWorldPos.z * 1.2 + uTime * 1.4) * 0.03;`
                    );
                };

                // URL statt String-Pfad: Vite kann den Worker so in dist/ mitnehmen.
                // Im Dev/Express-Modus bleibt er weiterhin relativ zu world.js auflösbar.
                const workerUrl = new URL('./chunkWorker.js', import.meta.url);
                workerUrl.search = import.meta.env?.DEV ? 'v=' + Date.now() : 'v=20260507c';
                this.worker = new Worker(workerUrl);
                // Init: Sende Config + Block-Daten an Worker
                this.worker.postMessage({
                    type: 'init',
                    config: CONFIG.WORLD,
                    blockColors: this._flattenColors(),
                    blockTex: Object.assign({}, BLOCK_TEX)
                });
                this.queuedChunks = new Set();
                this.chunkPool = [];
                // Race-Fix: Wenn ein Re-Mesh angefordert wird während einer pending ist,
                // merken wir uns das hier. Nach Abschluss des aktuellen Meshings wird
                // automatisch ein erneutes angestoßen — sonst bleibt z.B. ein Chunk
                // mit AO-Verdunklung an Rändern hängen, weil die Nachbar-Chunks erst
                // NACH dem ersten Mesh-Build geladen wurden (sichtbar als 1×1-Quads
                // mit per-Block-Farbvariation auf Eis-/Schnee-/Wolken-Flächen statt
                // großer einheitlich gefärbter Greedy-Quads).
                this.dirtyMeshes = new Set();
                
                this.worker.onmessage = (e) => {
                    const msg = e.data;

                    // ==============================
                    // Terrain-Daten empfangen
                    // ==============================
                    if (msg.type === 'terrain') {
                        const { cx, cz, data } = msg;
                        this.queuedChunks.delete(this.getChunkKey(cx, cz));
                        
                        // Modified Blocks anwenden
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

                        // Mesh für diesen und ALLE 8 angrenzenden Chunks anfordern
                        // (inkl. Diagonalen — die brauchen die Daten dieses Chunks
                        //  für ihre Eckblock-AO-Berechnung).
                        this.requestMesh(cx, cz);
                        this.requestMesh(cx - 1, cz);
                        this.requestMesh(cx + 1, cz);
                        this.requestMesh(cx, cz - 1);
                        this.requestMesh(cx, cz + 1);
                        this.requestMesh(cx - 1, cz - 1);
                        this.requestMesh(cx + 1, cz - 1);
                        this.requestMesh(cx - 1, cz + 1);
                        this.requestMesh(cx + 1, cz + 1);

                        // Tier 3: Village-Infos an Main-Thread weiterleiten
                        if (msg.villageInfos && msg.villageInfos.length > 0) {
                            for (const vInfo of msg.villageInfos) {
                                this.villages.push(vInfo);
                                // Custom-Event für NPC-Spawning
                                window.dispatchEvent(new CustomEvent('villageGenerated', { detail: vInfo }));
                            }
                        }
                        return;
                    }

                    // ==============================
                    // Mesh-Ergebnis empfangen
                    // ==============================
                    if (msg.type === 'meshResult') {
                        const { cx, cz, opaque, water } = msg;
                        const meshKey = this.getChunkKey(cx, cz);
                        this.pendingMeshes.delete(meshKey);

                        const chunk = this.chunks.get(meshKey);
                        if (!chunk) {
                            this.dirtyMeshes.delete(meshKey);
                            return;
                        }

                        // Alte Meshes entfernen
                        this.disposeMesh(chunk.mesh);
                        this.disposeMesh(chunk.waterMesh);
                        chunk.mesh = null;
                        chunk.waterMesh = null;

                        // Opaque Mesh erstellen
                        if (opaque) {
                            chunk.mesh = this._createMeshFromArrays(opaque, this.opaqueMaterial, cx, cz);
                            this.scene.add(chunk.mesh);
                        }

                        // Water Mesh erstellen
                        if (water) {
                            chunk.waterMesh = this._createMeshFromArrays(water, this.waterMaterial, cx, cz);
                            this.scene.add(chunk.waterMesh);
                        }

                        // Race-Fix: Falls während des Meshings ein Re-Mesh angefordert
                        // wurde (z.B. weil ein Nachbar-Chunk zwischenzeitlich geladen
                        // wurde), jetzt nachholen. Das aktuelle Mesh hatte u.U. unvoll-
                        // ständige AO-Daten an den Rändern.
                        if (this.dirtyMeshes.has(meshKey)) {
                            this.dirtyMeshes.delete(meshKey);
                            this.requestMesh(cx, cz);
                        }
                        return;
                    }
                };
            }

            // Konvertiert BLOCK_COLORS zu einem flachen Objekt mit Integer-Werten
            _flattenColors() {
                const flat = {};
                for (const key in BLOCK_COLORS) {
                    flat[key] = BLOCK_COLORS[key];
                }
                return flat;
            }

            // Erstellt ein Three.js Mesh aus den vom Worker empfangenen Float32Arrays.
            // aAtlasUV: pro Vertex (-1, -1) für Special-Blöcke (kein Tiling) oder (cellU0, cellV0)
            //           für greedy-merged Würfel-Faces (mit Atlas-Tiling im Fragment-Shader).
            _createMeshFromArrays(arrays, material, cx, cz) {
                const geom = new THREE.BufferGeometry();
                geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arrays.pos), 3));
                geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(arrays.col), 3));
                geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(arrays.norm), 3));
                geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(arrays.uv), 2));
                geom.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(arrays.sway), 1));
                // atlasUV ist optional aus Backwards-Compat-Gründen (alte Worker-Version sendet es nicht).
                // Falls nicht vorhanden, füllen wir mit Sentinel -1 → Shader nutzt vMapUv direkt.
                if (arrays.atlasUV) {
                    geom.setAttribute('aAtlasUV', new THREE.BufferAttribute(new Float32Array(arrays.atlasUV), 2));
                } else {
                    const n = arrays.pos.length / 3;
                    const fallback = new Float32Array(n * 2);
                    fallback.fill(-1);
                    geom.setAttribute('aAtlasUV', new THREE.BufferAttribute(fallback, 2));
                }
                geom.setIndex(new THREE.BufferAttribute(new Uint32Array(arrays.idx), 1));
                geom.computeBoundingSphere();
                const mesh = new THREE.Mesh(geom, material);
                mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
                return mesh;
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

            // Fordert ein Mesh-Update beim Worker an (mit Nachbar-Chunk-Daten)
            requestMesh(cx, cz) {
                const key = this.getChunkKey(cx, cz);
                const chunk = this.chunks.get(key);
                if (!chunk) return;
                if (this.pendingMeshes.has(key)) {
                    // Schon eine Mesh-Anfrage unterwegs — markieren als dirty, damit
                    // nach Abschluss neu gemesht wird (mit dem aktuellen Stand der
                    // Nachbar-Chunks). Verhindert "stale boundary faces"-Bug.
                    this.dirtyMeshes.add(key);
                    return;
                }
                this.pendingMeshes.add(key);

                // Nachbar-Chunk-Daten sammeln — inkl. der 4 DIAGONALEN Chunks!
                // AO-Berechnung an Chunk-Ecken liest Blöcke wie (cx-1, cz-1),
                // also außerhalb der 4 orthogonalen Nachbarn. Ohne Diagonal-Daten
                // liefert getBlock() dort -1 → wird als "solid" behandelt → die
                // Eckblöcke bekommen ein dunkleres AO und fallen aus dem Greedy-
                // Merging raus, was die per-Block-Farbvariation auf großen Greedy-
                // Flächen (Eis, Schnee, Wolken) sichtbar macht.
                const neighbors = [];
                const neighborCoords = [
                    [cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1],
                    [cx - 1, cz - 1], [cx + 1, cz - 1], [cx - 1, cz + 1], [cx + 1, cz + 1]
                ];
                for (const [ncx, ncz] of neighborCoords) {
                    const nChunk = this.chunks.get(this.getChunkKey(ncx, ncz));
                    if (nChunk && nChunk.data) {
                        neighbors.push({ cx: ncx, cz: ncz, data: nChunk.data.buffer.slice(0) });
                    }
                }

                // Kopie der Center-Daten erstellen (da Transferables den Buffer neutrieren)
                const centerCopy = chunk.data.buffer.slice(0);

                // blockMeta für den Chunk-Bereich + 1 Block Rand (für Tür-Rendering an Grenzen)
                const chunkMeta = {};
                const x0 = cx * CHUNK_SIZE - 1, x1 = (cx + 1) * CHUNK_SIZE + 1;
                const z0 = cz * CHUNK_SIZE - 1, z1 = (cz + 1) * CHUNK_SIZE + 1;
                for (const key in this.blockMeta) {
                    const parts = key.split(',');
                    const bx = +parts[0], bz = +parts[2];
                    if (bx >= x0 && bx < x1 && bz >= z0 && bz < z1) chunkMeta[key] = this.blockMeta[key];
                }

                this.worker.postMessage(
                    { type: 'mesh', cx, cz, centerData: centerCopy, neighbors, blockMeta: chunkMeta },
                    [centerCopy, ...neighbors.map(n => n.data)]
                );
            }

            // Entfernt Mesh aus Scene UND disposed Geometry (Material wird global geteilt → NICHT disposen!)
            disposeMesh(mesh) {
                if (!mesh) return;
                this.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
            }

            update(time) {
                this.uTime.value = time;
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
                    this.requestMesh(cx, cz);
                    if (lx === 0) this.requestMesh(cx - 1, cz); if (lx === CHUNK_SIZE - 1) this.requestMesh(cx + 1, cz);
                    if (lz === 0) this.requestMesh(cx, cz - 1); if (lz === CHUNK_SIZE - 1) this.requestMesh(cx, cz + 1);
                }
            }

            updateVisibleChunks(pX, pZ) {
                // Live-Read aus CONFIG: ermöglicht Render-Distance-Setting zur Laufzeit.
                const RD = CONFIG.WORLD.RENDER_DIST;
                const pcx = Math.floor(pX / CHUNK_SIZE), pcz = Math.floor(pZ / CHUNK_SIZE);
                for (let x = pcx - RD; x <= pcx + RD; x++) {
                    for (let z = pcz - RD; z <= pcz + RD; z++) this.generateChunk(x, z);
                }
                for (const [key, chunk] of this.chunks) {
                    if (Math.abs(chunk.cx - pcx) > RD + 1 || Math.abs(chunk.cz - pcz) > RD + 1) {
                        this.disposeMesh(chunk.mesh); this.disposeMesh(chunk.waterMesh);
                        if (chunk.data) this.chunkPool.push(chunk.data.buffer);
                        this.chunks.delete(key);
                    }
                }
            }
        }
