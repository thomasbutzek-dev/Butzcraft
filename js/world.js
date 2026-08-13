import * as THREE from 'three';
import { CONFIG } from '../config.js?v=20260507b';
import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas } from './blocks.js?v=20260801b';
import { getOceanDepthFactor } from './terrainHeightRules.js?v=20260801a';

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
            const biome = getBiomeAt(wx, wz);
            const temperature = (Math.sin(wx * 0.01) + Math.cos(wz * 0.01)) * 0.5;
            const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
            const oceanFactor = getOceanDepthFactor(temperature, humidity);
            let baseH = noise2D(wx, wz) + 38; 
            baseH -= oceanFactor * 22; 
            if (biome === BIOMES.DESERT) baseH += Math.sin(wx * 0.2) * 2;
            return Math.floor(baseH);
        }

        // --- WORLD CLASS ---
        export class World {
            constructor(scene) {
                this.scene = scene;
                this.worldGenerationVersion = 2;
                this.chunks = new Map();
                this.modifiedBlocks = {};
                this.blockMeta = {};    // "x,y,z" → metadata byte (Tür-Rotation etc.)
                this.blockMetaChunkIndex = new Map();
                this.chestContents = {}; // "chest,x,y,z" → Array<{type,count}>
                this.lootedChests = new Set(); // Keys von Kisten, die bereits einmal geöffnet wurden
                this.fireBlocks = new Map();    // "x,y,z" → { remaining: seconds } — aktive Feuer-Blöcke
                this.spawnerMeta = {};           // "x,y,z" → { lastSpawn, mobCount } — Spawner-Zustand
                this.spawnerKeys = new Set();    // bekannte Spawner-Positionen, damit Runtime-Ticks nicht den Raum scannen
                this.fireLightKeys = new Set();  // geladene Feuer-Blöcke für den gepoolten Lichtschein
                this.torchKeys = new Set();      // geladene gesetzte Fackeln für den gepoolten Lichtschein
                this.villages = [];              // [{cx,cz,x,y,z}] — erkannte Dörfer für NPC-Spawn
                this.structures = new Map();
                this.structureChests = new Map();
                this.structureGates = new Map();
                this.structureAltars = new Map();
                this.structureProgress = {};
                this.uTime = { value: 0 };
                this.pendingMeshes = new Set(); // Verhindert doppelte Mesh-Requests
                this.meshEpoch = 0;
                
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
                this.opaqueMaterial = new THREE.MeshPhongMaterial({
                    vertexColors: true,
                    map: textureAtlas,
                    shininess: 3,
                    specular: 0x2c241b,
                    alphaTest: 0.5
                });
                const windTime = this.uTime;
                const windScale = { value: 1 };
                this.opaqueMaterial.onBeforeCompile = (shader) => {
                    shader.uniforms.uTime = windTime;
                    shader.uniforms.uWindScale = windScale;
                    shader.vertexShader = shader.vertexShader.replace(
                        'void main() {',
                        'attribute float aSway;\nattribute vec2 aAtlasUV;\nuniform float uTime;\nuniform float uWindScale;\nvarying vec2 vAtlasUV;\nvoid main() {\n  vAtlasUV = aAtlasUV;'
                    );
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `#include <begin_vertex>
                        if (aSway > 0.5) {
                            float windStr = sin(uTime * 1.8 + position.x * 0.7 + position.z * 0.9) * 0.08;
                            float windStr2 = cos(uTime * 1.3 + position.x * 0.5 + position.z * 1.1) * 0.05;
                            transformed.x += windStr * aSway * uWindScale;
                            transformed.z += windStr2 * aSway * uWindScale;
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
                this.waterMaterial = new THREE.MeshPhongMaterial({
                    vertexColors: true,
                    map: textureAtlas,
                    transparent: true,
                    opacity: 0.72,
                    shininess: 48,
                    depthWrite: false
                });
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

                // Diese direkte Form wird von Vite als Modul-Worker erkannt und gebündelt.
                this.worker = new Worker(new URL('./chunkWorker.js?v=20260801d', import.meta.url), { type: 'module' });
                // Init: Sende Config + Block-Daten an Worker
                this.worker.postMessage({
                    type: 'init',
                    config: CONFIG.WORLD,
                    blockColors: this._flattenColors(),
                    blockTex: Object.assign({}, BLOCK_TEX),
                    worldGenerationVersion: this.worldGenerationVersion
                });
                this.queuedChunks = new Set();
                this.chunkPool = [];
                this.viewCenterX = null;
                this.viewCenterZ = null;
                this.viewRenderDistance = CONFIG.WORLD.RENDER_DIST;
                // Race-Fix: Wenn ein Re-Mesh angefordert wird während einer pending ist,
                // merken wir uns das hier. Nach Abschluss des aktuellen Meshings wird
                // automatisch ein erneutes angestoßen — sonst bleibt z.B. ein Chunk
                // mit AO-Verdunklung an Rändern hängen, weil die Nachbar-Chunks erst
                // NACH dem ersten Mesh-Build geladen wurden (sichtbar als 1×1-Quads
                // mit per-Block-Farbvariation auf Eis-/Schnee-/Wolken-Flächen statt
                // großer einheitlich gefärbter Greedy-Quads).
                this.dirtyMeshes = new Set();
                this.pendingMeshResults = [];
                this.chunkGenerationRequestedAt = new Map();
                this.meshRequestedAt = new Map();
                this.performanceTimings = {};
                
                this.worker.onmessage = (e) => {
                    const msg = e.data;

                    // ==============================
                    // Terrain-Daten empfangen
                    // ==============================
                    if (msg.type === 'terrain') {
                        const { cx, cz, data, epoch } = msg;
                        const chunkKey = this.getChunkKey(cx, cz);
                        this.queuedChunks.delete(chunkKey);
                        const requestedAt = this.chunkGenerationRequestedAt.get(chunkKey);
                        this.chunkGenerationRequestedAt.delete(chunkKey);
                        if (Number.isFinite(requestedAt)) {
                            this._recordPerformanceTiming('chunkGenerationRoundTripMs', performance.now() - requestedAt);
                        }
                        this._recordPerformanceTiming('workerGenerationMs', msg.timings?.workerGenerationMs);

                        if (epoch !== undefined && epoch !== this.meshEpoch) {
                            if (data) this.chunkPool.push(data.buffer);
                            return;
                        }

                        if (!this.isChunkInsideActiveView(cx, cz, 1)) {
                            if (data) this.chunkPool.push(data.buffer);
                            return;
                        }
                        
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

                        const chunkData = data instanceof Uint8Array ? data : new Uint8Array(data);
                        const chunk = { cx, cz, data: chunkData, mesh: null, waterMesh: null, spawnerKeys: new Set(), fireLightKeys: new Set(), torchKeys: new Set() };
                        this.indexChunkRuntimeKeys(chunk);
                        this.chunks.set(this.getChunkKey(cx, cz), chunk);

                        // Mesh für diesen und ALLE 8 angrenzenden Chunks anfordern
                        // (inkl. Diagonalen — die brauchen die Daten dieses Chunks
                        //  für ihre Eckblock-AO-Berechnung).
                        this.requestReadyMeshesAround(cx, cz);

                        // Tier 3: Village-Infos an Main-Thread weiterleiten
                        if (msg.villageInfos && msg.villageInfos.length > 0) {
                            for (const vInfo of msg.villageInfos) {
                                if (this.villages.some(village => village.cx === vInfo.cx && village.cz === vInfo.cz)) continue;
                                this.villages.push(vInfo);
                                // Custom-Event für NPC-Spawning
                                window.dispatchEvent(new CustomEvent('villageGenerated', { detail: vInfo }));
                            }
                        }
                        if (msg.minecartInfos && msg.minecartInfos.length > 0) {
                            for (const minecartInfo of msg.minecartInfos) {
                                window.dispatchEvent(new CustomEvent('minecartGenerated', { detail: minecartInfo }));
                            }
                        }
                        if (msg.structureInfos && msg.structureInfos.length > 0) {
                            for (const structureInfo of msg.structureInfos) {
                                if (this.structures.has(structureInfo.id)) continue;
                                this.structures.set(structureInfo.id, structureInfo);
                                const gate = structureInfo.gate;
                                if (gate) {
                                    for (let width = -1; width <= 1; width++) {
                                        for (let dy = 0; dy <= 2; dy++) {
                                            const gx = gate.x + (gate.widthAxis === 'x' ? width : 0);
                                            const gz = gate.z + (gate.widthAxis === 'z' ? width : 0);
                                            this.structureGates.set(`${gx},${gate.y + dy},${gz}`, {
                                                structureId: structureInfo.id,
                                                gate
                                            });
                                        }
                                    }
                                }
                                const altar = structureInfo.altar;
                                if (altar) {
                                    for (const block of altar.blocks || [altar.interaction]) {
                                        this.structureAltars.set(`${block.x},${block.y},${block.z}`, altar);
                                    }
                                }
                                window.dispatchEvent(new CustomEvent('structureGenerated', { detail: structureInfo }));
                            }
                        }
                        if (msg.chestInfos && msg.chestInfos.length > 0) {
                            for (const chestInfo of msg.chestInfos) {
                                this.structureChests.set(`chest,${chestInfo.x},${chestInfo.y},${chestInfo.z}`, chestInfo);
                            }
                        }
                        if (msg.spawnerInfos && msg.spawnerInfos.length > 0) {
                            for (const spawnerInfo of msg.spawnerInfos) {
                                const key = `${spawnerInfo.x},${spawnerInfo.y},${spawnerInfo.z}`;
                                this.spawnerMeta[key] = {
                                    lastSpawn: 0,
                                    mobCount: 0,
                                    ...this.spawnerMeta[key],
                                    ...spawnerInfo
                                };
                            }
                        }
                        return;
                    }

                    // ==============================
                    // Mesh-Ergebnis empfangen
                    // ==============================
                    if (msg.type === 'meshResult') {
                        const meshKey = this.getChunkKey(msg.cx, msg.cz);
                        const requestedAt = this.meshRequestedAt.get(meshKey);
                        this.meshRequestedAt.delete(meshKey);
                        if (Number.isFinite(requestedAt)) {
                            this._recordPerformanceTiming('meshRoundTripMs', performance.now() - requestedAt);
                        }
                        this._recordPerformanceTiming('workerMeshBuildMs', msg.timings?.workerMeshBuildMs);
                        if (msg.epoch !== undefined && msg.epoch !== this.meshEpoch) return;
                        this.pendingMeshResults.push(msg);
                        return;
                    }
                };
            }

            // Keep worker bursts from monopolizing the main thread between rendered frames.
            processPendingMeshResults(maxResults = 2) {
                let processed = 0;
                while (processed < maxResults && this.pendingMeshResults.length > 0) {
                    const { cx, cz, opaque, water, epoch } = this.pendingMeshResults.shift();
                    if (epoch !== undefined && epoch !== this.meshEpoch) continue;

                    const meshKey = this.getChunkKey(cx, cz);
                    this.pendingMeshes.delete(meshKey);
                    const chunk = this.chunks.get(meshKey);
                    if (!chunk) {
                        this.dirtyMeshes.delete(meshKey);
                        continue;
                    }

                    const adoptionStartedAt = performance.now();
                    this.disposeMesh(chunk.mesh);
                    this.disposeMesh(chunk.waterMesh);
                    chunk.mesh = opaque ? this._createMeshFromArrays(opaque, this.opaqueMaterial, cx, cz) : null;
                    chunk.waterMesh = water ? this._createMeshFromArrays(water, this.waterMaterial, cx, cz) : null;
                    if (chunk.mesh) this.scene.add(chunk.mesh);
                    if (chunk.waterMesh) this.scene.add(chunk.waterMesh);
                    this._recordPerformanceTiming('mainThreadMeshAdoptionMs', performance.now() - adoptionStartedAt);

                    if (this.dirtyMeshes.has(meshKey)) {
                        this.dirtyMeshes.delete(meshKey);
                        this.requestMesh(cx, cz);
                    }
                    processed++;
                }
                return processed;
            }

            setGenerationVersion(version) {
                const normalized = version === 1 ? 1 : 2;
                if (normalized === this.worldGenerationVersion) return;
                this.worldGenerationVersion = normalized;
                this.worker.postMessage({ type: 'worldGenerationVersion', version: normalized });
            }

            _recordPerformanceTiming(name, value) {
                if (!Number.isFinite(value) || value < 0) return;
                if (!this.performanceTimings[name]) this.performanceTimings[name] = [];
                this.performanceTimings[name].push(value);
                if (this.performanceTimings[name].length > 512) this.performanceTimings[name].shift();
            }

            consumePerformanceTimings() {
                const timings = this.performanceTimings;
                this.performanceTimings = {};
                return timings;
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
                const float32 = value => value instanceof Float32Array ? value : new Float32Array(value);
                geom.setAttribute('position', new THREE.BufferAttribute(float32(arrays.pos), 3));
                geom.setAttribute('color', new THREE.BufferAttribute(float32(arrays.col), 3));
                geom.setAttribute('normal', new THREE.BufferAttribute(float32(arrays.norm), 3));
                geom.setAttribute('uv', new THREE.BufferAttribute(float32(arrays.uv), 2));
                geom.setAttribute('aSway', new THREE.BufferAttribute(float32(arrays.sway), 1));
                // atlasUV ist optional aus Backwards-Compat-Gründen (alte Worker-Version sendet es nicht).
                // Falls nicht vorhanden, füllen wir mit Sentinel -1 → Shader nutzt vMapUv direkt.
                if (arrays.atlasUV) {
                    geom.setAttribute('aAtlasUV', new THREE.BufferAttribute(float32(arrays.atlasUV), 2));
                } else {
                    const n = arrays.pos.length / 3;
                    const fallback = new Float32Array(n * 2);
                    fallback.fill(-1);
                    geom.setAttribute('aAtlasUV', new THREE.BufferAttribute(fallback, 2));
                }
                const indices = arrays.idx instanceof Uint32Array ? arrays.idx : new Uint32Array(arrays.idx);
                geom.setIndex(new THREE.BufferAttribute(indices, 1));
                geom.computeBoundingSphere();
                const mesh = new THREE.Mesh(geom, material);
                mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
                return mesh;
            }

            getChunkKey(x, z) { return `${x},${z}`; }

            getBlockKey(x, y, z) { return `${x},${y},${z}`; }

            _parseBlockKey(key) {
                const parts = key.split(',');
                return { x: +parts[0], y: +parts[1], z: +parts[2] };
            }

            _getMetaChunkKeyForBlock(x, z) {
                return this.getChunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
            }

            _indexBlockMetaKey(key) {
                const pos = this._parseBlockKey(key);
                const chunkKey = this._getMetaChunkKeyForBlock(pos.x, pos.z);
                let keys = this.blockMetaChunkIndex.get(chunkKey);
                if (!keys) {
                    keys = new Set();
                    this.blockMetaChunkIndex.set(chunkKey, keys);
                }
                keys.add(key);
            }

            _unindexBlockMetaKey(key) {
                const pos = this._parseBlockKey(key);
                const chunkKey = this._getMetaChunkKeyForBlock(pos.x, pos.z);
                const keys = this.blockMetaChunkIndex.get(chunkKey);
                if (!keys) return;
                keys.delete(key);
                if (keys.size === 0) this.blockMetaChunkIndex.delete(chunkKey);
            }

            rebuildBlockMetaIndex() {
                this.blockMetaChunkIndex.clear();
                for (const key in this.blockMeta) this._indexBlockMetaKey(key);
            }

            setBlockMetaData(blockMeta = {}) {
                this.blockMeta = blockMeta && typeof blockMeta === 'object' ? blockMeta : {};
                this.rebuildBlockMetaIndex();
            }

            setBlockMeta(x, y, z, value) {
                const key = this.getBlockKey(x, y, z);
                this.blockMeta[key] = value;
                this._indexBlockMetaKey(key);
                this.requestMesh(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
            }

            getBlockMeta(x, y, z) {
                return this.blockMeta[this.getBlockKey(x, y, z)] || 0;
            }

            deleteBlockMeta(x, y, z) {
                const key = this.getBlockKey(x, y, z);
                if (!(key in this.blockMeta)) return;
                delete this.blockMeta[key];
                this._unindexBlockMetaKey(key);
            }

            getChunkBlockMeta(cx, cz) {
                const chunkMeta = {};
                const x0 = cx * CHUNK_SIZE - 1, x1 = (cx + 1) * CHUNK_SIZE + 1;
                const z0 = cz * CHUNK_SIZE - 1, z1 = (cz + 1) * CHUNK_SIZE + 1;
                const mcx0 = Math.floor(x0 / CHUNK_SIZE), mcx1 = Math.floor((x1 - 1) / CHUNK_SIZE);
                const mcz0 = Math.floor(z0 / CHUNK_SIZE), mcz1 = Math.floor((z1 - 1) / CHUNK_SIZE);

                for (let mcx = mcx0; mcx <= mcx1; mcx++) {
                    for (let mcz = mcz0; mcz <= mcz1; mcz++) {
                        const keys = this.blockMetaChunkIndex.get(this.getChunkKey(mcx, mcz));
                        if (!keys) continue;
                        for (const key of keys) {
                            const pos = this._parseBlockKey(key);
                            if (pos.x >= x0 && pos.x < x1 && pos.z >= z0 && pos.z < z1) {
                                chunkMeta[key] = this.blockMeta[key];
                            }
                        }
                    }
                }

                return chunkMeta;
            }

            indexChunkRuntimeKeys(chunk) {
                if (!chunk || !chunk.data) return;
                if (!chunk.spawnerKeys) chunk.spawnerKeys = new Set();
                if (!chunk.fireLightKeys) chunk.fireLightKeys = new Set();
                if (!chunk.torchKeys) chunk.torchKeys = new Set();
                chunk.spawnerKeys.clear();
                chunk.fireLightKeys.clear();
                chunk.torchKeys.clear();
                const baseX = chunk.cx * CHUNK_SIZE;
                const baseZ = chunk.cz * CHUNK_SIZE;
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    for (let z = 0; z < CHUNK_SIZE; z++) {
                        for (let x = 0; x < CHUNK_SIZE; x++) {
                            const idx = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                            const type = chunk.data[idx];
                            if (type !== 83 && type !== 86 && type !== 101 && type !== 104) continue;
                            const key = this.getBlockKey(baseX + x, y, baseZ + z);
                            if (type === 83) {
                                chunk.spawnerKeys.add(key);
                                this.spawnerKeys.add(key);
                            } else if (type === 86) {
                                chunk.fireLightKeys.add(key);
                                this.fireLightKeys.add(key);
                            } else {
                                chunk.torchKeys.add(key);
                                this.torchKeys.add(key);
                            }
                        }
                    }
                }
            }

            unindexChunkRuntimeKeys(chunk) {
                if (!chunk) return;
                for (const key of chunk.spawnerKeys || []) this.spawnerKeys.delete(key);
                for (const key of chunk.fireLightKeys || []) this.fireLightKeys.delete(key);
                for (const key of chunk.torchKeys || []) this.torchKeys.delete(key);
                chunk.spawnerKeys?.clear();
                chunk.fireLightKeys?.clear();
                chunk.torchKeys?.clear();
            }

            generateChunk(cx, cz) {
                const key = this.getChunkKey(cx, cz);
                if (this.chunks.has(key) || this.queuedChunks.has(key)) return;
                this.queuedChunks.add(key);
                this.chunkGenerationRequestedAt.set(key, performance.now());
                
                const pooledBuffer = this.chunkPool.pop();
                if (pooledBuffer) {
                    this.worker.postMessage({ type: 'generate', cx, cz, buffer: pooledBuffer, epoch: this.meshEpoch }, [pooledBuffer]);
                } else {
                    this.worker.postMessage({ type: 'generate', cx, cz, epoch: this.meshEpoch });
                }
            }

            isChunkInsideActiveView(cx, cz, margin = 0) {
                if (this.viewCenterX === null || this.viewCenterZ === null) return true;
                const rd = this.viewRenderDistance + margin;
                return Math.abs(cx - this.viewCenterX) <= rd && Math.abs(cz - this.viewCenterZ) <= rd;
            }

            hasAllActiveViewNeighbors(cx, cz) {
                if (this.viewCenterX === null || this.viewCenterZ === null) return true;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx === 0 && dz === 0) continue;
                        const nx = cx + dx;
                        const nz = cz + dz;
                        if (!this.isChunkInsideActiveView(nx, nz)) continue;
                        if (!this.chunks.has(this.getChunkKey(nx, nz))) return false;
                    }
                }
                return true;
            }

            requestReadyMeshesAround(cx, cz) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const meshX = cx + dx;
                        const meshZ = cz + dz;
                        if (!this.isChunkInsideActiveView(meshX, meshZ)) continue;
                        if (!this.chunks.has(this.getChunkKey(meshX, meshZ))) continue;
                        if (this.hasAllActiveViewNeighbors(meshX, meshZ)) this.requestMesh(meshX, meshZ);
                    }
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
                this.meshRequestedAt.set(key, performance.now());

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

                const chunkMeta = this.getChunkBlockMeta(cx, cz);

                this.worker.postMessage(
                    { type: 'mesh', cx, cz, centerData: centerCopy, neighbors, blockMeta: chunkMeta, epoch: this.meshEpoch },
                    [centerCopy, ...neighbors.map(n => n.data)]
                );
            }

            // Entfernt Mesh aus Scene UND disposed Geometry (Material wird global geteilt → NICHT disposen!)
            disposeMesh(mesh) {
                if (!mesh) return;
                this.scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
            }

            disposeChunkMeshes(chunk) {
                if (!chunk) return;
                this.disposeMesh(chunk.mesh);
                this.disposeMesh(chunk.waterMesh);
                chunk.mesh = null;
                chunk.waterMesh = null;
            }

            disposeAllChunks({ reuseBuffers = false } = {}) {
                this.meshEpoch++;
                for (const chunk of this.chunks.values()) {
                    this.disposeChunkMeshes(chunk);
                    if (reuseBuffers && chunk.data) this.chunkPool.push(chunk.data.buffer);
                }
                this.chunks.clear();
                this.spawnerKeys.clear();
                this.fireLightKeys.clear();
                this.torchKeys.clear();
                this.queuedChunks.clear();
                this.pendingMeshes.clear();
                this.dirtyMeshes.clear();
                this.pendingMeshResults.length = 0;
                this.chunkGenerationRequestedAt.clear();
                this.meshRequestedAt.clear();
                this.performanceTimings = {};
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
                const idx = (y * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx;
                const previous = chunk.data[idx];
                chunk.data[idx] = t;
                const blockKey = this.getBlockKey(x, y, z);
                if (!chunk.spawnerKeys) chunk.spawnerKeys = new Set();
                if (previous === 83 && t !== 83) {
                    chunk.spawnerKeys.delete(blockKey);
                    this.spawnerKeys.delete(blockKey);
                } else if (previous !== 83 && t === 83) {
                    chunk.spawnerKeys.add(blockKey);
                    this.spawnerKeys.add(blockKey);
                }
                if (!chunk.fireLightKeys) chunk.fireLightKeys = new Set();
                if (previous === 86 && t !== 86) {
                    chunk.fireLightKeys.delete(blockKey);
                    this.fireLightKeys.delete(blockKey);
                } else if (previous !== 86 && t === 86) {
                    chunk.fireLightKeys.add(blockKey);
                    this.fireLightKeys.add(blockKey);
                }
                if (!chunk.torchKeys) chunk.torchKeys = new Set();
                const previousIsTorchLight = previous === 101 || previous === 104;
                const nextIsTorchLight = t === 101 || t === 104;
                if (previousIsTorchLight && !nextIsTorchLight) {
                    chunk.torchKeys.delete(blockKey);
                    this.torchKeys.delete(blockKey);
                } else if (!previousIsTorchLight && nextIsTorchLight) {
                    chunk.torchKeys.add(blockKey);
                    this.torchKeys.add(blockKey);
                }
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
                this.viewCenterX = pcx;
                this.viewCenterZ = pcz;
                this.viewRenderDistance = RD;
                for (let x = pcx - RD; x <= pcx + RD; x++) {
                    for (let z = pcz - RD; z <= pcz + RD; z++) this.generateChunk(x, z);
                }
                for (const [key, chunk] of this.chunks) {
                    if (Math.abs(chunk.cx - pcx) > RD + 1 || Math.abs(chunk.cz - pcz) > RD + 1) {
                        this.disposeChunkMeshes(chunk);
                        this.unindexChunkRuntimeKeys(chunk);
                        if (chunk.data) this.chunkPool.push(chunk.data.buffer);
                        this.chunks.delete(key);
                    }
                }
            }
        }
