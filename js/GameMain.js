        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
        import { CONFIG } from '../config.js?v=20260507b';
        import { SoundManager } from './sound.js?v=20260507b';
        import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas, atlasDataURL } from './blocks.js?v=20260507b';
        import { World, getBiomeAt, getHeightAt, BIOMES } from './world.js?v=20260507b';
        import { Mob, updateProjectiles } from './mobs.js?v=20260507b';

        import { Input } from './Input.js?v=20260507b';
        import { initTouchControls, isTouchDevice } from './touch.js?v=20260507b';
        import { migrateSave, stampSaveVersion } from './saveMigrations.js?v=20260507b';
        import { Game } from './Game.js?v=20260507b'; // Sprint 3 Phase 1: zentraler State-Container (proxy zu window.*)
        import { Player } from './Player.js?v=20260507b';
        import { PlayerInteraction } from './PlayerInteraction.js?v=20260507b';
        import { inventorySlots, getSelectedSlot, setSelectedSlot, addItemToInventory, updateInventoryUI, toggleInventory, setupInventoryEvents, oldInventoryMap, isInventoryOpened } from './inventory.js?v=20260507b';
        import { tickFurnace, isFurnaceOpen } from './furnace.js?v=20260507b';
        import { WeatherSystem } from './weather.js?v=20260507b';
        import { NPC } from './npc.js?v=20260507b';
        import { openTradeUI, closeTradeUI, isTradeOpen } from './tradeUI.js?v=20260507b';
        window.__butzcraftGameMainEvaluating = true;
        window.addItemToInventory = addItemToInventory;
        window.inventorySlots = inventorySlots;
        window.updateInventoryUI = updateInventoryUI;
        window.getSelectedSlot = getSelectedSlot;
        window.setSelectedSlot = setSelectedSlot;
        window.getBiomeAt = getBiomeAt;

        window.SoundManager = SoundManager;
        window.BLOCK_TYPES = BLOCK_TYPES;
        window.BLOCK_TEX = BLOCK_TEX;
        window._blockTexData = { BLOCK_TEX, atlasDataURL };
        


;

        // --- KONSTANTEN & KONFIGURATION ---
        const { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, RENDER_DIST, CLOUD_HEIGHT } = CONFIG.WORLD;
        const { DAY_DURATION, MAX_HEALTH, MAX_HUNGER, HUNGER_LOSS_PASSIVE, HUNGER_LOSS_MOVE, HUNGER_GAIN_PIG, HUNGER_GAIN_EGG, HUNGER_GAIN_MILK, REGEN_RATE, REGEN_THRESHOLD, FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULT } = CONFIG.GAMEPLAY;
        const { GRAVITY, GRAVITY_MULTIPLIER, WATER_DRAG, JUMP_FORCE, PLAYER_JUMP_FORCE, WALK_SPEED, FRICTION, PLAYER_WIDTH } = CONFIG.PHYSICS;
        const { MAX_COUNT, SPAWN_CHANCE, SPAWN_DIST_MIN, SPAWN_DIST_MAX, ZOMBIE_DETECTION_RANGE, ZOMBIE_SPEED, ZOMBIE_DAMAGE, WANDER_SPEED, CHICKEN_EGG_TIME_MIN, CHICKEN_EGG_TIME_MAX, SHEEP_WOOL_TIME_MIN, SHEEP_WOOL_TIME_MAX, WATER_AVOIDANCE_RADIUS , WEIGHT_COW, WEIGHT_PIG, WEIGHT_SHEEP, WEIGHT_CHICKEN } = CONFIG.MOBS;
        const MOB_JUMP_FORCE = 5.5; // Konstante für das Springen von Tieren/Zombies (ca. 1.5 Blöcke hoch bei g=9.8)

        // --- GAME STATE ---
        let camera, scene, renderer, controls, world, sun, sunGroup;
        let skyUniforms, skyMesh;
        // Spielstart auf Mittag setzen
        let time = DAY_DURATION * 0.45, prevTime = performance.now(), spawnTimer = 0;
        let collectedEggs = 0, collectedWool = 0;
        const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
        const mobs = [];
        window.droppedItems = [];
        const droppedItems = window.droppedItems;
        let weatherSystem = null;  // Tier 3: Wetter-System (init nach World)
        const npcs = [];            // Tier 3: NPC-Array
        window.npcs = npcs;
        // Tier 3: Spawner-Tick-Timer auf Modul-Scope. WICHTIG nicht `this._spawnerTickTimer`
        // verwenden — `this` ist in einer Top-Level-Funktion innerhalb eines ES-Moduls `undefined`
        // (strict mode), und `this.x = 0` wirft TypeError. Das war der Grund, warum nach dem
        // Tier-3-Update die gesamte Steuerung blockiert war: animate() ist jeden Frame in dieser
        // Zeile abgestürzt, BEVOR `window.player.updatePhysics(...)` aufgerufen werden konnte.
        let _spawnerTickTimer = 0;
        let _lastVisibleChunkX = null, _lastVisibleChunkZ = null, _lastVisibleRenderDist = null;
        
        
        let inventoryOpened = false;
        window.BLOCK_TEX = BLOCK_TEX;
        let gameActive = true, spawning = true, gameStarted = false;
        let currentSaveName = null;

        // Schwert & Animation

        function isBlockingOverlayOpen() {
            const visible = (id) => {
                const el = document.getElementById(id);
                return el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
            };
            return isInventoryOpened() || visible('trade-overlay') || visible('furnace-overlay') || visible('chest-overlay');
        }

        function shouldUseTouchMode() {
            return Boolean(window.touchActive) || isTouchDevice();
        }

        // Welt-Loading-Overlay: zeigt Spinner + Chunk-Counter zwischen "Start gedrückt"
        // und "erstem Chunk-Mesh in der Scene". Verhindert den schwarzen Screen, der
        // auf Mobile bisher 5–15 s dauern konnte und den Anschein eines Crashes erweckte.
        let __worldLoadingTimer = 0;
        let __worldLoadingTimeoutId = null;
        function showWorldLoading() {
            const ov = document.getElementById('world-loading-overlay');
            if (!ov) return;
            ov.style.display = 'flex';
            const cancelBtn = document.getElementById('world-loading-cancel');
            if (cancelBtn) {
                cancelBtn.style.display = 'none';
                cancelBtn.onclick = () => window.location.reload();
            }
            __worldLoadingTimer = performance.now();
            if (__worldLoadingTimeoutId) clearTimeout(__worldLoadingTimeoutId);
            // Nach 30 s Reload-Button anbieten — wenn die Welt-Generation hängt,
            // ist das die einzig sinnvolle Notbremse für den Spieler.
            __worldLoadingTimeoutId = setTimeout(() => {
                if (cancelBtn) cancelBtn.style.display = 'inline-block';
                const txt = document.getElementById('world-loading-text');
                if (txt) txt.textContent = 'Welt-Generation dauert ungewöhnlich lange…';
            }, 30000);
        }
        function updateWorldLoadingProgress() {
            const ov = document.getElementById('world-loading-overlay');
            if (!ov || ov.style.display === 'none') return;
            const ready = window.world && window.world.chunks ? window.world.chunks.size : 0;
            const rd = CONFIG.WORLD.RENDER_DIST;
            const expected = (2 * rd + 1) * (2 * rd + 1);
            const el = document.getElementById('world-loading-progress');
            if (el) el.textContent = `${ready} / ${expected} Chunks`;
        }
        function hideWorldLoadingIfReady() {
            const ov = document.getElementById('world-loading-overlay');
            if (!ov || ov.style.display === 'none') return;
            // Erst ausblenden, wenn wenigstens ein Chunk-Mesh tatsächlich in der Scene ist —
            // dann ist auch der erste Frame keine schwarze Fläche mehr.
            const w = window.world;
            if (!w || !w.chunks) return;
            let firstMeshReady = false;
            for (const chunk of w.chunks.values()) {
                if (chunk.mesh) { firstMeshReady = true; break; }
            }
            if (!firstMeshReady) return;
            ov.style.display = 'none';
            if (__worldLoadingTimeoutId) { clearTimeout(__worldLoadingTimeoutId); __worldLoadingTimeoutId = null; }
            const dt = ((performance.now() - __worldLoadingTimer) / 1000).toFixed(1);
            console.info(`[Butzcraft] Welt sichtbar nach ${dt}s (${w.chunks.size} Chunks geladen).`);
        }
        window.__butzcraftShowWorldLoading = showWorldLoading;

        function lockControlsForDesktop() {
            if (shouldUseTouchMode()) return;
            controls.lock();
        }

        function bindPress(el, handler) {
            if (!el) return;
            let lastRun = 0;
            const run = (e) => {
                const now = performance.now();
                if (now - lastRun < 350) return;
                lastRun = now;
                if (e && e.cancelable) e.preventDefault();
                handler(e);
            };
            el.addEventListener('click', run);
            el.addEventListener('touchend', run, { passive: false });
            el.addEventListener('pointerup', (e) => {
                if (e.pointerType === 'mouse') return;
                run(e);
            });
        }

        function updateVisibleChunksIfNeeded(playerPos, force = false) {
            const cx = Math.floor(playerPos.x / CHUNK_SIZE);
            const cz = Math.floor(playerPos.z / CHUNK_SIZE);
            const rd = CONFIG.WORLD.RENDER_DIST;
            if (!force && cx === _lastVisibleChunkX && cz === _lastVisibleChunkZ && rd === _lastVisibleRenderDist) return;
            world.updateVisibleChunks(playerPos.x, playerPos.z);
            _lastVisibleChunkX = cx;
            _lastVisibleChunkZ = cz;
            _lastVisibleRenderDist = rd;
        }

        window.startNewGame = function() {
            if (gameStarted) return;
            console.log("DEBUG: startNewGame starting...");
            document.getElementById('start-menu').style.display = 'none';
            showWorldLoading();
            currentSaveName = null;
            SoundManager.init();
            lockControlsForDesktop();
            gameStarted = true;
            window.__butzcraftStartRequested = false;
            console.log("DEBUG: startNewGame finished, gameStarted set to true");
        };
        window.__butzcraftStartFunctionReady = true;
        if (window.__butzcraftStartRequested && window.__butzcraftRefreshStartStatus) {
            window.__butzcraftRefreshStartStatus('Engine bereit. Welt wird vorbereitet...');
        }

        window.loadGame = function(name) {
            console.log("DEBUG: loadGame starting for", name);
            showWorldLoading();
            SoundManager.init();
            fetch(`/api/load?name=${encodeURIComponent(name)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert("Fehler beim Laden: " + data.error);
                        return;
                    }
                    
                    document.getElementById('start-menu').style.display = 'none';
                    lockControlsForDesktop();
                    gameStarted = true;
                    currentSaveName = name;
                    document.getElementById('save-input').value = name;

                    // Sprint 6: Migration zentralisiert via saveMigrations.js
                    // Vorher war die Inventory-Migration hier inline + oldInventoryMap aus inventory.js.
                    // Jetzt: ein Aufruf, alle nötigen Versions-Schritte werden angewendet.
                    data = migrateSave(data);

                    const playerPos = camera.position;
                    playerPos.set(data.pos.x, data.pos.y, data.pos.z);
                    window.player.health = data.health;
                    window.player.hunger = data.hunger;
                    time = data.time;
                    spawning = false;

                    // Nach migrateSave ist data.inventory garantiert ein Array (v1+).
                    if (Array.isArray(data.inventory)) {
                        data.inventory.forEach((item, i) => inventorySlots[i] = item);
                    }
                    
                    collectedWool = data.collectedWool || 0;
                    updateInventoryUI();
                    updateUI();
                    
                    {
                        world.modifiedBlocks = data.modifiedBlocks || {};
                        world.blockMeta = data.blockMeta || {};
                        world.chestContents = data.chestContents || {};
                        world.lootedChests = new Set(data.lootedChests || []);

                        // Tier 3: Wetter-State + Feuer-Blöcke wiederherstellen
                        if (weatherSystem) {
                            weatherSystem.deserialize(data.weather);
                            weatherSystem.loadFireBlocks(data.fireBlocks || {});
                        }
                        if (data.villages) world.villages = data.villages;

                        // Tier 3: NPCs wiederherstellen
                        // Bestehende NPCs entfernen
                        while (npcs.length > 0) {
                            const npc = npcs.pop();
                            npc.dispose();
                        }
                        if (data.npcs && Array.isArray(data.npcs)) {
                            for (const npcData of data.npcs) {
                                if (!npcData.isDead) {
                                    const npc = new NPC(scene, npcData.homeX, npcData.homeY, npcData.homeZ, npcData.professionIdx);
                                    npc.group.position.set(npcData.x, npcData.y, npcData.z);
                                    npc.health = npcData.health;
                                    npcs.push(npc);
                                }
                            }
                        }

                        world.chunks.forEach(c => {
                            if (c.mesh) scene.remove(c.mesh);
                            if (c.waterMesh) scene.remove(c.waterMesh);
                        });
                        world.chunks.clear();
                        updateVisibleChunksIfNeeded(playerPos, true);
                    }
                })
                .catch(err => alert("Netzwerkfehler beim Laden!"));
        };




        // --- DOM-CACHE (statt getElementById pro Frame) ---
        const DOM = {
            healthFill: document.getElementById('health-fill'),
            hungerFill: document.getElementById('hunger-fill'),
            timeInfo: document.getElementById('time-info'),
            stats: document.getElementById('stats'),
            gameOver: document.getElementById('game-over')
        };

        // --- SKY-COLOR CACHE (statt 8x new THREE.Color pro Frame) ---
        const SKY = {
            nightH: new THREE.Color().setHSL(0.64, 0.4, 0.1),
            nightZ: new THREE.Color().setHSL(0.64, 0.6, 0.03),
            sunriseH: new THREE.Color().setHSL(0.08, 0.8, 0.4),
            sunriseZ: new THREE.Color().setHSL(0.6, 0.5, 0.25),
            dayH: new THREE.Color().setHSL(0.55, 0.5, 0.7),
            dayZ: new THREE.Color().setHSL(0.58, 0.8, 0.45),
            bloodMoonH: new THREE.Color().setHSL(0.0, 0.8, 0.15),   // Blutmond-Horizont: dunkelrot
            bloodMoonZ: new THREE.Color().setHSL(0.02, 0.6, 0.05),  // Blutmond-Zenit: schwarz-rot
            hColor: new THREE.Color(),
            zColor: new THREE.Color(),
            weatherColor: new THREE.Color(),
            lightningColor: new THREE.Color(0xCCCCFF),
            underwaterColor: new THREE.Color(0x003060)
        };
        const BLOOD_MOON_INTERVAL = CONFIG.GAMEPLAY.BLOOD_MOON_INTERVAL || 3;

        // ============================================================
        // Damage-Feedback (Sprint 5)
        // ============================================================
        // Visuelles + akustisches Feedback bei Player-Schaden:
        //   - Roter Vignette-Flash (fadet 250ms)
        //   - Subtiler Pain-Sound (water_splash bei tieferem Pitch)
        //   - Camera-Shake (kurze Pitch/Yaw-Pertubation, 150ms)
        // Cooldown 250ms verhindert Visual-Spam bei kontinuierlichem Zombie-Damage.
        //
        // WICHTIG: State + Funktionen MÜSSEN vor `animate()`-Aufruf deklariert sein,
        // sonst TDZ — animate() ruft applyCameraShake() bereits im ersten Tick.
        const _damageFx = { lastAt: 0, flashEl: null, shakeUntil: 0, shakeMag: 0 };
        function ensureDamageFlashDOM() {
            if (_damageFx.flashEl) return _damageFx.flashEl;
            const el = document.createElement('div');
            el.id = 'damage-flash';
            el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;opacity:0;background:radial-gradient(ellipse at center, transparent 35%, rgba(180,0,0,0.55) 100%);transition:opacity 250ms ease-out;';
            document.body.appendChild(el);
            _damageFx.flashEl = el;
            return el;
        }
        function triggerDamageFeedback(amount) {
            const now = performance.now();
            if (now - _damageFx.lastAt < 250) return;
            _damageFx.lastAt = now;
            const el = ensureDamageFlashDOM();
            const intensity = Math.min(1, amount / 8);
            el.style.opacity = String(0.4 + 0.5 * intensity);
            requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '0'; }));
            try {
                if (window.SoundManager && window.SoundManager.playSound) {
                    window.SoundManager.playSound('water_splash', 0.5, 0.6 + Math.random() * 0.15, { skipCooldown: true });
                }
            } catch (e) { /* sound-system optional */ }
            _damageFx.shakeUntil = now + 150;
            _damageFx.shakeMag = 0.025 * intensity;
        }
        function applyCameraShake() {
            // Shake wird über CSS-Transform am Canvas gemacht, NICHT über Three.js-Camera-Rotation.
            //
            // WARUM CSS statt camera.rotation.z?
            //   PointerLockControls nutzt intern Euler-Order 'YXZ' und überschreibt bei jedem
            //   Mausbewegen `camera.quaternion` via `setFromEuler(setFromQuaternion(...))`.
            //   Der Z-Anteil (Roll) wird dabei aus der Quaternion extrahiert und wieder
            //   zurückgeschrieben — d.h. ein einmal gesetzter Roll WÄCHST mit jeder Mausbewegung
            //   weiter, weil die XYZ↔YXZ-Konvertierung nicht winkeltreu ist.
            //   Resultat: Welt verdreht sich beim Mausbewegen.
            //   Mit CSS-Transform am Canvas-Element passiert das alles außerhalb von Three.js
            //   und kann sauber via leerem `transform`-String zurückgesetzt werden.
            const canvas = renderer && renderer.domElement;
            if (!canvas) return;
            const now = performance.now();
            if (now >= _damageFx.shakeUntil || _damageFx.shakeMag <= 0) {
                if (canvas.style.transform) canvas.style.transform = '';
                return;
            }
            const remain = (_damageFx.shakeUntil - now) / 150;
            const m = _damageFx.shakeMag * remain;
            const angle = Math.sin(now * 0.05) * m * 0.5; // rad
            canvas.style.transform = `rotate(${angle}rad)`;
        }

        try {
            Input.init(isInventoryOpened);
            setupInventoryEvents();
            init();
            window.__butzcraftGameMainReady = true;
            animate();
        } catch (err) {
            window.__butzcraftGameMainError = err && (err.stack || err.message || String(err));
            if (window.__butzcraftShowStartError) {
                window.__butzcraftShowStartError('GameMain Fehler: ' + (err && err.message ? err.message : String(err)));
            }
            throw err;
        }

        function init() {
            scene = new THREE.Scene();
            // Nebel für weicheren Horizont und SkyDome für Rendering wie in Visualisierung
            const fogColor = new THREE.Color(0x87ceeb);
            scene.background = fogColor;
            scene.fog = new THREE.FogExp2(fogColor, 0.015);
            
            // --- HIMMEL-GRADIENT ---
            const vertexShader = `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }
            `;
            const fragmentShader = `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize( vWorldPosition + offset ).y;
                    gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h, 0.0 ), exponent ), 0.0 ) ), 1.0 );
                }
            `;
            skyUniforms = {
                topColor: { value: new THREE.Color(0x5caeff) },
                bottomColor: { value: fogColor },
                offset: { value: 10 },
                exponent: { value: 0.8 }
            };
            const skyGeo = new THREE.SphereGeometry( 450, 32, 15 );
            const skyMat = new THREE.ShaderMaterial( {
                uniforms: skyUniforms,
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                side: THREE.BackSide,
                fog: false
            } );
            skyMesh = new THREE.Mesh( skyGeo, skyMat );
            scene.add( skyMesh );

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
            
            // Zufälligen Spawn-Punkt über einem Land-Biom ermitteln (mit Garantie, dass Höhe > WATER_LEVEL ist)
            let spawnX = 0, spawnZ = 0, spawnH = 0;
            let foundLand = false;
            while (!foundLand) {
                spawnX = Math.floor(Math.random() * 2000 - 1000);
                spawnZ = Math.floor(Math.random() * 2000 - 1000);
                const h = getHeightAt(spawnX, spawnZ);
                if (h > WATER_LEVEL) {
                    spawnH = h;
                    foundLand = true;
                }
            }
            camera.position.set(spawnX, spawnH + 5, spawnZ); // Näher am Boden spawnen

            const ambient = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambient);
            sunGroup = new THREE.Group(); scene.add(sunGroup);
            sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(0, 50, 0); sunGroup.add(sun);

            window.celestialGroup = new THREE.Group();
            scene.add(window.celestialGroup);
            
            const sunGeo = new THREE.CircleGeometry(30, 32);
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, fog: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            window.sunMesh = new THREE.Mesh(sunGeo, sunMat);
            window.sunMesh.position.set(0, 400, 0);
            window.celestialGroup.add(window.sunMesh);

            const moonGeo = new THREE.CircleGeometry(25, 32);
            const moonMat = new THREE.MeshBasicMaterial({ color: 0xdddddf, fog: false, transparent: true, side: THREE.DoubleSide });
            window.moonMesh = new THREE.Mesh(moonGeo, moonMat);
            window.moonMesh.position.set(0, -400, 0);
            window.celestialGroup.add(window.moonMesh);

            const starsGeo = new THREE.BufferGeometry();
            const starsPos = [];
            for(let i=0; i<1500; i++) {
                const vec = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(400);
                starsPos.push(vec.x, vec.y, vec.z);
            }
            starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
            window.starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 2.0, transparent: true, opacity: 0, fog: false});
            window.starsMesh = new THREE.Points(starsGeo, window.starsMat);
            scene.add(window.starsMesh);

            // Mobile-Render-Profil: auf Touch-Geräten antialias aus, pixelRatio gedeckelt,
            // RENDER_DIST + Mob-Cap reduziert. Einmaliger Schalter, der sich vor der ersten
            // Welt-Generation auswirken muss (siehe new World(scene) weiter unten).
            // ?mobile=1 erzwingt das Profil auch auf Desktop (für Diagnose).
            const __mobileForce = new URLSearchParams(window.location.search).has('mobile');
            const __mobile = __mobileForce || isTouchDevice();
            const __mProfile = CONFIG.MOBILE || {};
            window.__butzcraftRenderProfile = {
                mobile: __mobile,
                antialias: __mobile ? !!__mProfile.ANTIALIAS : true,
                pixelRatioCap: __mobile ? (__mProfile.PIXEL_RATIO_CAP || 1.5) : 2,
                renderDist: __mobile ? (__mProfile.RENDER_DIST || 2) : CONFIG.WORLD.RENDER_DIST,
                disableShadows: __mobile ? !!__mProfile.DISABLE_SHADOWS : false,
                particleFactor: __mobile ? (__mProfile.PARTICLE_FACTOR || 0.5) : 1,
                maxMobsFactor: __mobile ? (__mProfile.MAX_MOBS_FACTOR || 0.5) : 1
            };
            if (__mobile) {
                CONFIG.WORLD.RENDER_DIST = window.__butzcraftRenderProfile.renderDist;
                CONFIG.MOBS.MAX_COUNT = Math.max(2, Math.round(CONFIG.MOBS.MAX_COUNT * window.__butzcraftRenderProfile.maxMobsFactor));
                console.info(`[Butzcraft] Mobile-Profil aktiv: RENDER_DIST=${CONFIG.WORLD.RENDER_DIST}, antialias=${window.__butzcraftRenderProfile.antialias}, pixelRatioCap=${window.__butzcraftRenderProfile.pixelRatioCap}, MAX_MOBS=${CONFIG.MOBS.MAX_COUNT}`);
            }

            try {
                renderer = new THREE.WebGLRenderer({
                    antialias: window.__butzcraftRenderProfile.antialias,
                    powerPreference: 'high-performance'
                });
            } catch (err) {
                console.error('[WebGL] Renderer-Init fehlgeschlagen:', err);
                if (window.__butzcraftShowStartError) {
                    window.__butzcraftShowStartError('WebGL nicht verfügbar: ' + (err && err.message ? err.message : String(err)));
                }
                throw err;
            }
            renderer.domElement.id = 'game-canvas';
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.__butzcraftRenderProfile.pixelRatioCap));
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // GPU-/Capability-Info loggen — wichtig für Mobile-Debugging ohne Remote-DevTools.
            try {
                const gl = renderer.getContext();
                const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '(unmasked nicht verfügbar)';
                const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '(unmasked nicht verfügbar)';
                console.info(`[WebGL] GPU: ${gpu} | Vendor: ${vendor} | MAX_TEXTURE_SIZE=${gl.getParameter(gl.MAX_TEXTURE_SIZE)} | DPR=${window.devicePixelRatio}`);
            } catch (err) {
                console.warn('[WebGL] GPU-Info konnte nicht gelesen werden:', err);
            }

            // WebGL Context-Loss Handling: tritt auf bei Tab-Wechsel auf Mobile, GPU-Reset, oder
            // wenn der Browser den Context wegen Inaktivität freigibt. Ohne preventDefault wird
            // der Context NIE wiederhergestellt → Canvas bleibt schwarz für immer.
            window.webglContextLost = false;
            renderer.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                window.webglContextLost = true;
                console.warn('[WebGL] Context lost — pausing render loop, awaiting restore.');
                let overlay = document.getElementById('webgl-context-lost-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'webgl-context-lost-overlay';
                    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99999;font-family:sans-serif;text-align:center;padding:20px;';
                    const h = document.createElement('h2'); h.textContent = 'Grafik-Kontext verloren'; h.style.marginBottom = '10px';
                    const p = document.createElement('p'); p.textContent = 'Der Browser hat den WebGL-Kontext freigegeben (z.B. nach Tab-Wechsel oder GPU-Reset). Versuche, das Spiel automatisch wiederherzustellen…'; p.style.marginBottom = '20px'; p.style.maxWidth = '500px';
                    const btn = document.createElement('button'); btn.textContent = 'Spiel neu laden'; btn.style.cssText = 'padding:12px 24px;font-size:16px;cursor:pointer;background:#e74c3c;color:#fff;border:none;border-radius:4px;';
                    btn.addEventListener('click', () => window.location.reload());
                    overlay.appendChild(h); overlay.appendChild(p); overlay.appendChild(btn);
                    document.body.appendChild(overlay);
                } else {
                    overlay.style.display = 'flex';
                }
            }, false);

            renderer.domElement.addEventListener('webglcontextrestored', () => {
                console.warn('[WebGL] Context restored — rebuilding chunk meshes.');
                window.webglContextLost = false;
                const overlay = document.getElementById('webgl-context-lost-overlay');
                if (overlay) overlay.style.display = 'none';
                // Chunk-Meshes neu aufbauen — alte BufferGeometries sind nach Context-Loss ungültig.
                if (window.world && window.world.chunks) {
                    for (const chunk of window.world.chunks.values()) {
                        chunk.mesh = null;
                        chunk.waterMesh = null;
                        window.world.requestMesh(chunk.cx, chunk.cz);
                    }
                }
            }, false);

            window.player = new Player(scene, camera, document.body, CONFIG);
            controls = window.player.controls;

            // Sicherheits-Reset: Falls aus einem früheren Sprint-5-Bug-Run noch ein roll-Drift
            // in der Camera-Quaternion saß (Sprint 5 setzte camera.rotation.z direkt), hier
            // einmalig komplett aufräumen. PointerLockControls würde sonst den Drift via
            // Quaternion-Roundtrip beim ersten Mausbewegen reaktivieren.
            camera.rotation.set(0, 0, 0);
            camera.quaternion.setFromEuler(camera.rotation);
            // Empfindlichkeit anpassen: Wir verstärken die Drehung durch einen Multiplikator
            // Three.js PointerLockControls nutzt intern camera.rotation. 
            // Ein einfacher Weg: Wir hängen uns an den PointerLock-Mechanismus.
            const sensitivity = 1.8; 
            const originalOnMouseMove = document.onmousemove;
            // Wir können hier nicht einfach onmousemove überschreiben, da Three.js Event-Listener nutzt.
            // Aber wir können in der animate-Schleife die Drehung verstärken, 
            // indem wir die Differenz zur vorherigen Rotation skalieren.
            
            // Start-Button Event-Listener
            const startBtn = document.getElementById('start-button');
            bindPress(startBtn, () => {
                console.log("DEBUG: Start Button Press Event (ID-based)");
                if (typeof window.startNewGame === 'function') {
                    window.startNewGame();
                } else {
                    console.error("CRITICAL: window.startNewGame is not a function!");
                }
            });

            if (window.__butzcraftStartRequested) window.startNewGame();

            // Sprint 6: Game-Over-"Neu starten" → Reload (alter Inline-onclick-Handler ist weg)
            const restartBtn = document.getElementById('game-over-restart');
            if (restartBtn) {
                restartBtn.addEventListener('click', () => window.location.reload());
            }

            // Sprint 6: Auto-Load-Hint nach Reload (gesetzt vom Death-Overlay-Save-Klick)
            try {
                const autoLoadName = sessionStorage.getItem('butzcraft.autoLoad');
                if (autoLoadName) {
                    sessionStorage.removeItem('butzcraft.autoLoad');
                    // Asynchron auslösen, damit der DOM-Init zuerst durchläuft
                    setTimeout(() => {
                        if (typeof window.loadGame === 'function') window.loadGame(autoLoadName);
                    }, 100);
                }
            } catch (e) { /* sessionStorage disabled */ }

            const inst = document.getElementById('instructions');
            inst.addEventListener('click', () => { 
                console.log("DEBUG: Instructions clicked -> Locking mouse");
                if (gameActive) controls.lock(); 
                gameStarted = true; 
            });
            controls.addEventListener('lock', () => {
                inst.style.display = 'none';
            });
            controls.addEventListener('unlock', () => { 
                // Nur anzeigen, wenn das Hauptmenü weg ist UND wir nicht gerade im Lade-Spawn sind
                if (gameActive && !spawning && document.getElementById('start-menu').style.display === 'none' && !isBlockingOverlayOpen()) {
                    inst.style.display = 'block'; 
                    window.loadGamesList(); // Liste im Pause-Menü aktualisieren
                }
            });
            scene.add(controls.getObject());

            // Browser-Kontextmenü bei Rechtsklick unterdrücken (stört Spiel-Interaktion)
            document.addEventListener('contextmenu', (e) => { e.preventDefault(); });

            // Schwert an Kamera binden
            scene.add(camera); // Kamera muss in die Szene, da sie nun Kinder hat

            world = new World(scene);
            window.world = world;

            // Tier 3: Wetter-System initialisieren
            weatherSystem = new WeatherSystem(scene, world);
            window.weatherSystem = weatherSystem;

            // Tier 3: NPC-Spawning bei Dorf-Generierung
            const _spawnedVillageKeys = new Set();
            window.addEventListener('villageGenerated', (e) => {
                const vInfo = e.detail;
                const vKey = `${vInfo.cx},${vInfo.cz}`;
                if (_spawnedVillageKeys.has(vKey)) return; // Doppel-Spawn verhindern
                _spawnedVillageKeys.add(vKey);
                for (const house of vInfo.houses) {
                    const npc = new NPC(scene, house.x, house.y, house.z, house.professionIdx);
                    npcs.push(npc);
                }
            });

            // Trade-UI globale Schließ-Funktion
            window.closeTradeUI = () => closeTradeUI(controls);

            // --- Render Distance Setting (persistiert in localStorage) ---
            const RD_STORAGE_KEY = 'butzcraft.renderDistance';
            const RD_ALLOWED = [2, 4, 6, 8, 12];
            const applyRenderDistance = (value) => {
                const n = parseInt(value, 10);
                if (!RD_ALLOWED.includes(n)) return;
                CONFIG.WORLD.RENDER_DIST = n;
                try { localStorage.setItem(RD_STORAGE_KEY, String(n)); } catch (e) { /* QuotaExceeded etc. ignorieren */ }
                // Sofort wirksam machen, wenn Spieler bereits in der Welt ist
                if (window.player && window.player.controls) {
                    const p = window.player.controls.getObject().position;
                    updateVisibleChunksIfNeeded(p, true);
                }
            };
            window.applyRenderDistance = applyRenderDistance;
            // Initial-Apply: aus localStorage laden, falls vorhanden
            try {
                const stored = localStorage.getItem(RD_STORAGE_KEY);
                if (stored) applyRenderDistance(stored);
            } catch (e) { /* Storage disabled (Privacy-Mode) */ }
            // UI-Verdrahtung
            const rdSelect = document.getElementById('render-distance-select');
            if (rdSelect) {
                rdSelect.value = String(CONFIG.WORLD.RENDER_DIST);
                rdSelect.addEventListener('change', (e) => applyRenderDistance(e.target.value));
            }

            window.playerInteraction = new PlayerInteraction(camera, scene, world, mobs, SoundManager, {
                getSelectedSlot: getSelectedSlot,
                getInventorySlots: () => inventorySlots,
                addItemToInventory: addItemToInventory,
                updateInventoryUI: updateInventoryUI,
                updateUI: updateUI
            });
            window.playerInteractions = window.playerInteraction; // Alias für Backwards-Compat
            window.playerInteraction.init(controls, () => gameActive, () => spawning);

            // Touch-Controls: nur auf Touch-Devices aktiv. Setzt window.touchActive=true,
            // damit der PointerLock-Pause-Mechanismus übersprungen wird.
            initTouchControls({
                camera,
                controls,
                isInventoryOpenedProvider: isInventoryOpened
            });
            window.addEventListener('keydown', e => {
                // Wenn ein Textfeld fokussiert ist, keine Spielsteuerung auslösen
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

                if (e.code === 'KeyE') {
                    // Ofen/Truhe/Handel zuerst schließen
                    const furnaceOverlay = document.getElementById('furnace-overlay');
                    const chestOverlay = document.getElementById('chest-overlay');
                    const tradeOverlay = document.getElementById('trade-overlay');
                    if (furnaceOverlay && furnaceOverlay.style.display !== 'none') { window.closeFurnace && window.closeFurnace(); return; }
                    if (chestOverlay && chestOverlay.style.display !== 'none') { window.closeChest && window.closeChest(); return; }
                    if (tradeOverlay && tradeOverlay.style.display !== 'none') { closeTradeUI(controls); return; }
                    toggleInventory(gameStarted, spawning, controls); return;
                }
                if (isInventoryOpened()) return;

                // Space logik in Input.js
                if (e.key >= '1' && e.key <= '8') {
                    setSelectedSlot(parseInt(e.key) - 1);
                    updateInventoryUI();
                }
            });
            document.addEventListener('keyup', e => {
            });
            window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
            window.camera = camera;
            window.controls = controls;
            window.world = world;
            window.renderer = renderer;
            window.scene = scene;
            window.SoundManager = SoundManager;
            window.mobs = mobs;



            // Komfort-Funktion zum Testen von Wasser
            
        }


        function updateUI() {
            DOM.healthFill.style.width = Math.max(0, window.player.health) + '%';
            DOM.hungerFill.style.width = Math.max(0, window.player.hunger) + '%';
            const tm = Math.floor((time / DAY_DURATION) * 1440), hh = Math.floor(tm / 60) % 24, mm = tm % 60, dd = Math.floor(time / DAY_DURATION) + 1;
            const dayRatioUI = (isNaN(time) || DAY_DURATION <= 0) ? 0.45 : (time % DAY_DURATION) / DAY_DURATION;
            const dayCountUI = Math.floor(time / DAY_DURATION);
            const isBloodMoonUI = dayCountUI % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1);
            const bloodMoonWarning = isBloodMoonUI && dayRatioUI > 0.65 && dayRatioUI <= 0.80 ? ' | \u{1F534} Blutmond!' : '';
            const bloodMoonActive = isBloodMoonUI && (dayRatioUI > 0.80 || dayRatioUI < 0.20) ? ' | \u{1F7E5} BLUTMOND' : '';
            DOM.timeInfo.innerText = `Tag ${dd} | ${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}${bloodMoonWarning}${bloodMoonActive}`;
            if (window.player.health <= 0 && gameActive && !spawning) {
                gameActive = false;
                controls.unlock();
                DOM.gameOver.style.display = 'flex';
                // Sprint 6: Death-Overlay um "Spielstand laden"-Liste erweitern.
                // Lädt asynchron — User muss nicht warten, falls die Server-Liste leer ist.
                populateGameOverSaveList();
            }
        }

        // Füllt die Save-Liste im Game-Over-Overlay.
        // Klick auf Save-Eintrag → window.location.reload() + danach loadGame() aufrufen.
        // (Reload ist nötig, weil der Spielzustand nach Tod inkonsistent sein kann; Per-Click-Reload ist
        //  einfacher und sicherer als Welt/Player partiell zu resetten.)
        function populateGameOverSaveList() {
            const section = document.getElementById('game-over-load-section');
            const list = document.getElementById('game-over-save-list');
            if (!section || !list) return;
            list.innerHTML = '';
            fetch('/api/saves')
                .then(r => r.json())
                .then(names => {
                    if (!Array.isArray(names) || names.length === 0) {
                        section.style.display = 'none';
                        return;
                    }
                    section.style.display = 'flex';
                    for (const name of names) {
                        const btn = document.createElement('button');
                        btn.textContent = '🎮 ' + name;
                        btn.style.cssText = 'padding:10px 20px; font-size:14px; cursor:pointer; background:#27ae60; color:white; border:none; border-radius:4px;';
                        btn.addEventListener('click', () => {
                            // Reload + nach Load loadGame triggern via sessionStorage-Hint
                            try { sessionStorage.setItem('butzcraft.autoLoad', name); } catch(e) {}
                            window.location.reload();
                        });
                        list.appendChild(btn);
                    }
                })
                .catch(() => { section.style.display = 'none'; });
        }

        function animate() {
            requestAnimationFrame(animate);
            // Bei verlorenem WebGL-Context: prevTime trotzdem aktualisieren,
            // damit nach Restore kein riesiger delta-Spike entsteht (würde Wall-Phasing auslösen).
            if (window.webglContextLost) { prevTime = performance.now(); return; }
            const now = performance.now();
            const delta = Math.min((now - prevTime) / 1000, 0.02);
            prevTime = now;

            updateWorldLoadingProgress();
            hideWorldLoadingIfReady();

            const playerPos = controls.getObject().position;

            // Shader-Zeit für Wellen & Wind aktualisieren
            world.update(now * 0.001);

            // Audio-Listener auf Kamera ausrichten (für 3D-Spatial-Sounds: Distanz-Falloff + Stereo-Pan).
            // Kamera ist Child der controls.getObject(), aber ihre Position ist relativ — wir verwenden
            // die Camera direkt, weil PointerLockControls ihre yaw/pitch via Quaternion auf der Kamera setzen.
            SoundManager.updateListener(camera);

            // Camera-Shake bei aktivem Damage-Feedback (Sprint 5).
            applyCameraShake();

            // 1. VOID PROTECTION (Immer aktiv)
            window.player.updateWaterAndVoid(world, SoundManager);
            // 3. SKY & HUD (Immer aktiv)
            const dayRatio = (isNaN(time) || DAY_DURATION <= 0) ? 0.45 : (time % DAY_DURATION) / DAY_DURATION;
            const dayCount = Math.floor(time / DAY_DURATION);
            const isBloodMoon = dayCount % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1); // Erste Nächte friedlich
            sunGroup.rotation.x = dayRatio * Math.PI * 2 + Math.PI;

            // Nacht-Farben: normal oder Blutmond
            const nightH = isBloodMoon ? SKY.bloodMoonH : SKY.nightH;
            const nightZ = isBloodMoon ? SKY.bloodMoonZ : SKY.nightZ;

            // Sky-Colors: Wiederverwendung gecachter Color-Objekte (0 Allokationen pro Frame)
            let skyInty = 1.0;
            if (dayRatio >= 0.20 && dayRatio < 0.25) {
                const f = (dayRatio - 0.20) / 0.05; SKY.hColor.lerpColors(nightH, SKY.sunriseH, f); SKY.zColor.lerpColors(nightZ, SKY.sunriseZ, f); skyInty = 0.05 + f * 0.35;
            } else if (dayRatio >= 0.25 && dayRatio < 0.30) {
                const f = (dayRatio - 0.25) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, SKY.dayH, f); SKY.zColor.lerpColors(SKY.sunriseZ, SKY.dayZ, f); skyInty = 0.4 + f * 0.6;
            } else if (dayRatio >= 0.30 && dayRatio <= 0.70) {
                SKY.hColor.copy(SKY.dayH); SKY.zColor.copy(SKY.dayZ); skyInty = 1.0;
            } else if (dayRatio > 0.70 && dayRatio <= 0.75) {
                const f = (dayRatio - 0.70) / 0.05; SKY.hColor.lerpColors(SKY.dayH, SKY.sunriseH, f); SKY.zColor.lerpColors(SKY.dayZ, SKY.sunriseZ, f); skyInty = 1.0 - f * 0.6;
            } else if (dayRatio > 0.75 && dayRatio <= 0.80) {
                const f = (dayRatio - 0.75) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, nightH, f); SKY.zColor.lerpColors(SKY.sunriseZ, nightZ, f); skyInty = 0.4 - f * 0.35;
            } else { SKY.hColor.copy(nightH); SKY.zColor.copy(nightZ); skyInty = 0.05; }
            sun.intensity = skyInty;

            if (window.player.inWater) {
                scene.background = SKY.underwaterColor;
                if (scene.fog) { scene.fog.color.copy(SKY.underwaterColor); scene.fog.density = 0.12; }
            } else {
                // Tier 3: Wetter-System beeinflusst Sky + Fog
                const weatherSkyMult = weatherSystem ? weatherSystem.getSkyMultiplier() : 1.0;
                const weatherFogExtra = weatherSystem ? weatherSystem.getExtraFogDensity() : 0;

                // Blitz-Flash: kurzzeitig weißer Himmel
                if (weatherSystem && weatherSystem.isLightningFlash()) {
                    scene.background = SKY.lightningColor;
                    if (scene.fog) { scene.fog.color.copy(SKY.lightningColor); scene.fog.density = 0.005; }
                } else {
                    // Sky-Farbe mit Wetter-Verdunkelung
                    const wH = SKY.weatherColor.copy(SKY.hColor).multiplyScalar(weatherSkyMult);
                    scene.background = wH;
                    if (scene.fog) { scene.fog.color.copy(wH); scene.fog.density = 0.015 + weatherFogExtra; }
                }
                if (skyUniforms) {
                    skyUniforms.bottomColor.value.copy(SKY.hColor).multiplyScalar(weatherSkyMult);
                    skyUniforms.topColor.value.copy(SKY.zColor).multiplyScalar(weatherSkyMult);
                    if (skyMesh) skyMesh.position.copy(camera.position);
                }
            }

            const bAt = getBiomeAt(playerPos.x, playerPos.z);
            // Tier 3: Wetter-Indikator im Stats-String
            let weatherIcon = '';
            if (weatherSystem) {
                const ws = weatherSystem.getState();
                if (ws === 'rain') weatherIcon = ' | 🌧️ Regen';
                else if (ws === 'thunderstorm') weatherIcon = ' | ⛈️ Gewitter';
                else if (ws === 'snow') weatherIcon = ' | 🌨️ Schnee';
            }
            DOM.stats.innerText = `Pos: ${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}, ${Math.floor(playerPos.z)} | Biom: ${bAt}${weatherIcon}`;
            updateUI();

            // 4. SIMULATION (Nur wenn nicht pausiert)
            // Fix: Während spawning=true pausieren wir niemals automatisch
            // Touch-Mode kennt keinen PointerLock — touchActive zählt als "im Spiel aktiv".
            const isPaused = !gameStarted || (!controls.isLocked && !spawning && !window.touchActive);
            if (!isPaused) {
                time += delta;

                // Tier 3: Wetter-System Update
                if (weatherSystem) {
                    weatherSystem.update(delta, playerPos, bAt);
                }

                if (spawning) {
                    const cx = Math.floor(playerPos.x / CHUNK_SIZE);
                    const cz = Math.floor(playerPos.z / CHUNK_SIZE);
                    if (!world.chunks.has(world.getChunkKey(cx, cz))) {
                        window.player.velocity.set(0, 0, 0);
                        playerPos.y = CHUNK_HEIGHT + 10; 
                    } else {
                        window.player.velocity.y = Math.max(window.player.velocity.y, -4.0);
                        const bt = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z));
                        if (bt !== 0 && bt !== 8 && bt !== 9 && bt !== 10) {
                            spawning = false;
                            if (!controls.isLocked && !window.touchActive) {
                                controls.lock();
                            }
                        }
                    }
                }

                // Wrapped onDamage: appliziert Schaden UND triggert Feedback (Flash + Pain-Sound + Shake).
                // _lastPainAt verhindert Sound-Spam bei kontinuierlichem Zombie-Damage (≤ 1 Sound/300ms).
                const onPlayerDamage = (d) => {
                    if (d <= 0) return;
                    window.player.health -= d;
                    triggerDamageFeedback(d);
                };
                mobs.forEach(m => {
                    if ((dayRatio < 0.25 || dayRatio > 0.75) === false && (m.type === 'zombie' || m.type === 'skeleton')) m.isDead = true;
                    else m.update(delta, playerPos, world, onPlayerDamage, dayRatio);
                });
                for (let i = mobs.length - 1; i >= 0; i--) {
                    if (mobs[i].isDead) {
                        if (typeof mobs[i].dispose === 'function') mobs[i].dispose();
                        else scene.remove(mobs[i].group);
                        mobs.splice(i, 1);
                    }
                }
                updateProjectiles(delta, playerPos, world, onPlayerDamage);

                // Tier 3: NPC-Update
                for (let i = npcs.length - 1; i >= 0; i--) {
                    const npc = npcs[i];
                    if (npc.isDead) {
                        npc.dispose();
                        npcs.splice(i, 1);
                    } else {
                        npc.update(delta, playerPos, world);
                    }
                }

                // --- Mob Spawning (optimiert: eine Schleife statt 3x filter) ---
                let landMobsCount = 0, waterMobsCount = 0, geistCount = 0, parrotCount = 0;
                for (let i = 0; i < mobs.length; i++) {
                    if (mobs[i].isDead) continue;
                    if (mobs[i].type === 'fish' || mobs[i].type === 'octopus' || mobs[i].type === 'turtle') waterMobsCount++;
                    else if (mobs[i].type === 'geist') geistCount++;
                    else if (mobs[i].type === 'parrot') parrotCount++;
                    else landMobsCount++;
                }
                
                if ((landMobsCount < MAX_COUNT || waterMobsCount < 15 || parrotCount < 5) && Math.random() < SPAWN_CHANCE) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = SPAWN_DIST_MIN + Math.random() * (SPAWN_DIST_MAX - SPAWN_DIST_MIN);
                    const ox = playerPos.x + Math.cos(angle) * dist, oz = playerPos.z + Math.sin(angle) * dist;
                    let spawnY = -1; let isWaterSpawn = false;
                    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
                        const bt = world.getBlock(Math.floor(ox), y, Math.floor(oz));
                        if (bt !== 0 && bt !== 8 && bt !== 9) {
                            if (bt===6||bt===14) spawnY=-1; else if(bt===4||bt===12){ let depth=0; for(let dy=y;dy>0;dy--) if(world.getBlock(Math.floor(ox),dy,Math.floor(oz))===4) depth++; else break; if(depth>0){ isWaterSpawn=true; spawnY=y-0.5;} else spawnY=-1; }
                            else spawnY = y + 1.0;
                            break;
                        }
                    }
                    if (spawnY > 0) {
                        // Prüfe nur direkte Umgebung auf Wasser (Radius 1) an der Oberfläche
                        let waterNearby = false;
                        for (let x = -1; x <= 1; x++) {
                            for (let z = -1; z <= 1; z++) {
                                if (world.getBlock(Math.floor(ox + x), Math.floor(spawnY), Math.floor(oz + z)) === 4) { 
                                    waterNearby = true; break; 
                                }
                            }
                            if (waterNearby) break;
                        }
                        // Geister spawnen jede Nacht (nicht beim Blutmond), unabhängig von Terrain
                        const isNight = (dayRatio < 0.25 || dayRatio > 0.75);
                        if (isNight && !isBloodMoon && geistCount < 6 && spawnY > 0) {
                            mobs.push(new Mob(scene, 'geist', ox, spawnY + 5, oz));
                        }

                        // Papageien: tagsüber, unabhängig vom Land-Mob-Cap (eigenes Cap: 5)
                        if (!isNight && parrotCount < 5 && !isWaterSpawn && !waterNearby && spawnY > 0 && spawnY <= 46) {
                            let leavesNearby = false;
                            outer2: for (let dy = -2; dy <= 12; dy++) {
                                for (let dx = -4; dx <= 4; dx++) {
                                    for (let dz = -4; dz <= 4; dz++) {
                                        const b = world.getBlock(Math.floor(ox + dx), Math.floor(spawnY + dy), Math.floor(oz + dz));
                                        if (b === 6 || b === 14 || b === 16) { leavesNearby = true; break outer2; }
                                    }
                                }
                            }
                            if (leavesNearby && Math.random() < 0.35) {
                                mobs.push(new Mob(scene, 'parrot', ox, spawnY + 4, oz));
                            }
                        }

                        if (spawnY <= 46) {
                            if (isWaterSpawn && waterMobsCount < 15) {
                                const WEIGHT_FISH = CONFIG.MOBS.WEIGHT_FISH || 40;
                                const WEIGHT_OCTOPUS = CONFIG.MOBS.WEIGHT_OCTOPUS || 1;
                                const WEIGHT_TURTLE = CONFIG.MOBS.WEIGHT_TURTLE || 15;
                                const totalW = WEIGHT_FISH + WEIGHT_OCTOPUS + WEIGHT_TURTLE;
                                const roll = Math.random() * totalW;
                                if (roll < WEIGHT_FISH) mobs.push(new Mob(scene, 'fish', ox, spawnY, oz));
                                else if (roll < WEIGHT_FISH + WEIGHT_TURTLE) mobs.push(new Mob(scene, 'turtle', ox, spawnY, oz));
                                else mobs.push(new Mob(scene, 'octopus', ox, spawnY, oz));
                            } else if (!waterNearby && landMobsCount < MAX_COUNT) {
                                if (isNight && isBloodMoon) {
                                    // Blutmond-Nacht: Zombies & Skelette spawnen
                                    if (Math.random() < 0.5) mobs.push(new Mob(scene, 'zombie', ox, spawnY, oz));
                                    else mobs.push(new Mob(scene, 'skeleton', ox, spawnY, oz));
                                }
                                else if (dayRatio >= 0.25 && dayRatio <= 0.75) {
                                    const totalWeight = WEIGHT_COW + WEIGHT_PIG + WEIGHT_SHEEP + WEIGHT_CHICKEN;
                                    const r = Math.random() * totalWeight;
                                    if (r < WEIGHT_COW) mobs.push(new Mob(scene, 'cow', ox, spawnY, oz));
                                    else if (r < WEIGHT_COW + WEIGHT_PIG) mobs.push(new Mob(scene, 'pig', ox, spawnY, oz));
                                    else if (r < WEIGHT_COW + WEIGHT_PIG + WEIGHT_SHEEP) mobs.push(new Mob(scene, 'sheep', ox, spawnY, oz));
                                    else mobs.push(new Mob(scene, 'chicken', ox, spawnY, oz));
                                }
                            }
                        }
                    }
                }

                // ===== Tier 3: SPAWNER-TICK-LOGIK =====
                // Überprüft alle Spawner im Radius des Spielers und spawnt hostile Mobs
                _spawnerTickTimer -= delta;
                if (_spawnerTickTimer <= 0) {
                    _spawnerTickTimer = 2.0; // Alle 2 Sekunden checken
                    const SPAWNER_RANGE = CONFIG.DUNGEON.SPAWNER_RANGE;
                    const px = Math.floor(playerPos.x), py = Math.floor(playerPos.y), pz = Math.floor(playerPos.z);
                    
                    // Scan für Spawner-Blöcke in Reichweite
                    for (let dx = -SPAWNER_RANGE; dx <= SPAWNER_RANGE; dx += 4) {
                        for (let dz = -SPAWNER_RANGE; dz <= SPAWNER_RANGE; dz += 4) {
                            for (let dy = -SPAWNER_RANGE; dy <= SPAWNER_RANGE; dy += 4) {
                                const sx = px + dx, sy = py + dy, sz = pz + dz;
                                if (sy < 1 || sy >= 63) continue;
                                const block = world.getBlock(sx, sy, sz);
                                if (block !== 83) continue; // Nicht SPAWNER
                                
                                const sKey = `${sx},${sy},${sz}`;
                                if (!world.spawnerMeta[sKey]) {
                                    world.spawnerMeta[sKey] = { lastSpawn: 0, mobCount: 0 };
                                }
                                const meta = world.spawnerMeta[sKey];
                                const now = performance.now() / 1000;
                                const interval = CONFIG.DUNGEON.SPAWNER_INTERVAL_MIN + 
                                    Math.random() * (CONFIG.DUNGEON.SPAWNER_INTERVAL_MAX - CONFIG.DUNGEON.SPAWNER_INTERVAL_MIN);
                                
                                if (now - meta.lastSpawn > interval && meta.mobCount < CONFIG.DUNGEON.SPAWNER_MAX_MOBS) {
                                    // Spawn-Position: zufällig um den Spawner herum (innerhalb des Dungeons)
                                    const spX = sx + (Math.random() - 0.5) * 4;
                                    const spZ = sz + (Math.random() - 0.5) * 4;
                                    const spY = sy + 1;
                                    
                                    // Luft über dem Spawn-Punkt prüfen
                                    if (world.getBlock(Math.floor(spX), spY, Math.floor(spZ)) === 0 &&
                                        world.getBlock(Math.floor(spX), spY + 1, Math.floor(spZ)) === 0) {
                                        const mobType = Math.random() < 0.6 ? 'zombie' : 'skeleton';
                                        const newMob = new Mob(scene, mobType, spX, spY, spZ);
                                        newMob._spawnerKey = sKey; // Spawner-Referenz für Zähler
                                        mobs.push(newMob);
                                        meta.lastSpawn = now;
                                        meta.mobCount++;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Spawner-Mob-Counter aktualisieren (tote Mobs abziehen)
                    for (const sKey in world.spawnerMeta) {
                        let aliveCount = 0;
                        for (const m of mobs) {
                            if (!m.isDead && m._spawnerKey === sKey) aliveCount++;
                        }
                        world.spawnerMeta[sKey].mobCount = aliveCount;
                    }
                }

                // Drop-Item-Update mit TTL + Hard-Cap (Sprint 5: Memory-Sicherheit).
                // - DROP_TTL: nicht-aufgesammelte Drops verschwinden nach 90s (RAM + scene-Mesh-Leak vermeiden)
                // - DROP_HARD_CAP: globaler Cap. Wenn überschritten → ältester Drop wird entfernt (LRU)
                const DROP_TTL = 90; // Sekunden
                const DROP_HARD_CAP = 150;
                const disposeDrop = (item) => {
                    if (item.mesh) {
                        scene.remove(item.mesh);
                        if (item.mesh.geometry) item.mesh.geometry.dispose();
                        if (item.mesh.material) {
                            // Drops verwenden eigene MeshPhongMaterial-Instanzen → safe to dispose
                            if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
                            else item.mesh.material.dispose();
                        }
                    }
                };
                const updateItems = (items) => {
                    // Hard-Cap durchsetzen: ältester (= [0]) entfernt, bis unter Cap.
                    while (items.length > DROP_HARD_CAP) {
                        disposeDrop(items[0]);
                        items.shift();
                    }
                    for (let i = items.length - 1; i >= 0; i--) {
                        const item = items[i]; const ip = item.mesh.position;
                        // TTL-Tracking: age in Sekunden; falls fehlt (alter Drop), jetzt initialisieren.
                        item.age = (item.age || 0) + delta;
                        if (item.age > DROP_TTL) {
                            disposeDrop(item);
                            items.splice(i, 1);
                            continue;
                        }
                        item.velocityY -= 9.8 * delta; ip.y += item.velocityY * delta;
                        const bB = world.getBlock(Math.floor(ip.x), Math.floor(ip.y - 0.1), Math.floor(ip.z));
                        if (bB !== 0 && bB !== 4 && bB !== 8 && bB !== 9 && item.velocityY < 0) { ip.y = Math.floor(ip.y - 0.1) + 1.0; item.velocityY = 0; }
                        if (Math.hypot(ip.x - playerPos.x, ip.z - playerPos.z) < 2.0 && Math.abs(ip.y - playerPos.y) < 2.5) {
                            disposeDrop(item);
                            items.splice(i, 1);
                            addItemToInventory(item.blockType, 1);
                        }
                    }
                };
                updateItems(droppedItems);

                // PLAYER PHYSICS
                window.player.updatePhysics(delta, Input, world, SoundManager);
                window.player.hunger -= HUNGER_LOSS_PASSIVE * delta; if (window.player.hunger <= 0) { window.player.hunger = 0; window.player.health -= 2 * delta; }
                if (window.player.hunger > REGEN_THRESHOLD && window.player.health < MAX_HEALTH) window.player.health += REGEN_RATE * delta;

                // Druckplatten-Schaden
                if (window.playerInteraction) window.playerInteraction.checkPressurePlates(playerPos.x, playerPos.y, playerPos.z);
            }

            // Ofen-Tick (auch wenn pausiert, solange UI offen)
            tickFurnace(controls);

            updateVisibleChunksIfNeeded(playerPos);
            window.player.updateSword(delta);


            renderer.render(scene, camera);
        }



        // --- SAVE / LOAD SYSTEM ---


        window.loadGamesList = function() {
            const startList = document.getElementById('save-list');
            const pauseList = document.getElementById('pause-load-list');

            // Helper: zentrierter Status-Text (ersetzt Inhalt einer Liste sicher als textContent)
            const setStatus = (list, text, color) => {
                if (!list) return;
                list.textContent = '';
                const div = document.createElement('div');
                div.style.textAlign = 'center';
                div.style.color = color;
                div.style.padding = '10px';
                div.textContent = text;
                list.appendChild(div);
            };

            // Helper: Save-Item aus echten DOM-Nodes (kein innerHTML mit User-Daten)
            const buildSaveItem = (name, compact) => {
                const item = document.createElement('div');
                item.className = 'save-item';
                if (compact) {
                    item.style.padding = '5px 10px';
                    item.style.fontSize = '14px';
                }
                const span = document.createElement('span');
                span.textContent = `🎮 ${name}`;
                const btn = document.createElement('button');
                btn.className = 'save-btn';
                btn.textContent = 'Laden';
                bindPress(btn, () => window.loadGame(name));
                item.appendChild(span);
                item.appendChild(btn);
                return item;
            };

            setStatus(startList, 'Lade...', '#aaa');
            setStatus(pauseList, 'Lade...', '#aaa');

            fetch('/api/saves')
                .then(res => res.json())
                .then(saves => {
                    if (startList) startList.textContent = '';
                    if (pauseList) pauseList.textContent = '';

                    if (!saves || saves.length === 0) {
                        setStatus(startList, 'Keine Speicherstände gefunden!', '#aaa');
                        setStatus(pauseList, 'Keine Speicherstände gefunden!', '#aaa');
                        return;
                    }

                    saves.forEach(name => {
                        if (startList) startList.appendChild(buildSaveItem(name, false));
                        if (pauseList) pauseList.appendChild(buildSaveItem(name, true));
                    });
                })
                .catch(err => {
                    setStatus(startList, 'Fehler!', '#ff6b6b');
                    setStatus(pauseList, 'Fehler!', '#ff6b6b');
                });
        };


        window.saveGame = function() {
            const name = document.getElementById('save-input').value.trim();
            if(!name) { alert("Bitte einen Namen eingeben!"); return; }
            
            const playerPos = camera.position;
            const gameData = stampSaveVersion({
                pos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                health: window.player.health,
                hunger: window.player.hunger,
                time: time,
                inventory: inventorySlots,
                collectedEggs: collectedEggs,
                collectedWool: collectedWool,
                modifiedBlocks: world.modifiedBlocks,
                blockMeta: world.blockMeta,
                chestContents: world.chestContents,
                lootedChests: [...world.lootedChests],
                // Tier 3: Wetter + Feuer + Dörfer + NPCs persistieren
                weather: weatherSystem ? weatherSystem.serialize() : null,
                fireBlocks: weatherSystem ? weatherSystem.saveFireBlocks() : {},
                villages: world.villages || [],
                npcs: npcs.filter(n => !n.isDead).map(n => n.serialize())
            });
            
            fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, gameData })
            })
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    currentSaveName = name;
                    const msg = document.getElementById('save-msg');
                    msg.style.display = 'block';
                    setTimeout(() => msg.style.display = 'none', 3000);
                    window.loadGamesList();
                } else {
                    alert("Fehler beim Speichern auf dem Server: " + res.error);
                }
            })
            .catch(err => alert("Fehler beim Speichern: Server nicht erreichbar?"));
        };

        window.loadGamesList(); // Initial laden
