        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
        import { CONFIG } from '../config.js?v=1775830882304';
        import { SoundManager } from './sound.js?v=1775830882304';
        import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas, atlasDataURL } from './blocks.js?v=1775830882304';
        import { World, getBiomeAt, getHeightAt, BIOMES } from './world.js?v=1775830882304';
        import { Mob, updateProjectiles } from './mobs.js?v=1775830882304';

        import { Input } from './Input.js';
        import { Player } from './Player.js';
        import { PlayerInteraction } from './PlayerInteraction.js';
        import { inventorySlots, getSelectedSlot, setSelectedSlot, addItemToInventory, updateInventoryUI, toggleInventory, setupInventoryEvents, oldInventoryMap, isInventoryOpened } from './inventory.js';
        window.addItemToInventory = addItemToInventory;
        window.inventorySlots = inventorySlots;
        window.updateInventoryUI = updateInventoryUI;
        window.getSelectedSlot = getSelectedSlot;
        
        window.SoundManager = SoundManager;
        window.BLOCK_TYPES = BLOCK_TYPES;
        


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
        
        
        let inventoryOpened = false;
        window.BLOCK_TEX = BLOCK_TEX;
        let gameActive = true, spawning = true, gameStarted = false;
        let currentSaveName = null;

        // Schwert & Animation

        window.startNewGame = function() {
            console.log("DEBUG: startNewGame starting...");
            SoundManager.init();
            document.getElementById('start-menu').style.display = 'none';
            currentSaveName = null;
            controls.lock(); 
            gameStarted = true;
            console.log("DEBUG: startNewGame finished, gameStarted set to true");
        };

        window.loadGame = function(name) {
            console.log("DEBUG: loadGame starting for", name);
            SoundManager.init();
            fetch(`/api/load?name=${encodeURIComponent(name)}`)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert("Fehler beim Laden: " + data.error);
                        return;
                    }
                    
                    document.getElementById('start-menu').style.display = 'none';
                    controls.lock();
                    gameStarted = true;
                    currentSaveName = name;
                    document.getElementById('save-input').value = name;
                    
                    const playerPos = camera.position;
                    playerPos.set(data.pos.x, data.pos.y, data.pos.z);
                    window.player.health = data.health;
                    window.player.hunger = data.hunger;
                    time = data.time;
                    spawning = false;
                    
                    // Migration: Falls altes Inventar-Format (Objekt) geladen wird
                    if (data.inventory && !Array.isArray(data.inventory)) {
                        for (const [oldType, count] of Object.entries(data.inventory)) {
                            const slotIdx = oldInventoryMap[oldType];
                            if (slotIdx !== undefined) inventorySlots[slotIdx] = { type: parseInt(oldType), count: count };
                        }
                    } else if (Array.isArray(data.inventory)) {
                        data.inventory.forEach((item, i) => inventorySlots[i] = item);
                    }
                    
                    collectedWool = data.collectedWool || 0;
                    updateInventoryUI();
                    updateUI();
                    
                    if(data.modifiedBlocks) {
                        world.modifiedBlocks = data.modifiedBlocks;
                        world.chunks.forEach(c => {
                            if (c.mesh) scene.remove(c.mesh);
                            if (c.waterMesh) scene.remove(c.waterMesh);
                        });
                        world.chunks.clear();
                        world.updateVisibleChunks(playerPos.x, playerPos.z);
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
            hColor: new THREE.Color(),
            zColor: new THREE.Color(),
            underwaterColor: new THREE.Color(0x003060)
        };

        Input.init(isInventoryOpened);
        setupInventoryEvents();
        init();
        animate();

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
                if (h > 38) { // WATER_LEVEL = 38
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

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.domElement.id = 'game-canvas';
            renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            window.player = new Player(scene, camera, document.body, CONFIG);
            controls = window.player.controls;
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
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    console.log("DEBUG: Start Button Click Event (ID-based)");
                    if (typeof window.startNewGame === 'function') {
                        window.startNewGame();
                    } else {
                        console.error("CRITICAL: window.startNewGame is not a function!");
                    }
                });
            }

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
                if (gameActive && !spawning && document.getElementById('start-menu').style.display === 'none') {
                    inst.style.display = 'block'; 
                    window.loadGamesList(); // Liste im Pause-Menü aktualisieren
                }
            });
            scene.add(controls.getObject());
            
            // Schwert an Kamera binden
            scene.add(camera); // Kamera muss in die Szene, da sie nun Kinder hat

            world = new World(scene);
            window.playerInteractions = new PlayerInteraction(camera, scene, world, mobs, SoundManager, {
                getSelectedSlot: getSelectedSlot,
                getInventorySlots: () => inventorySlots,
                addItemToInventory: addItemToInventory,
                updateInventoryUI: updateInventoryUI,
                updateUI: updateUI
            });
            window.playerInteractions.init(controls, () => gameActive, () => spawning);
            window.addEventListener('keydown', e => {
                if (e.code === 'KeyE') { toggleInventory(gameStarted, spawning, controls); return; }
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
            DOM.timeInfo.innerText = `Tag ${dd} | ${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
            if (window.player.health <= 0 && gameActive && !spawning) { 
                gameActive = false; 
                controls.unlock(); 
                DOM.gameOver.style.display = 'flex'; 
            }
        }

        function animate() {
            requestAnimationFrame(animate);
            const now = performance.now();
            const delta = Math.min((now - prevTime) / 1000, 0.02);
            prevTime = now;

            const playerPos = controls.getObject().position;

            // 1. VOID PROTECTION (Immer aktiv)
            window.player.updateWaterAndVoid(world, SoundManager);
            // 3. SKY & HUD (Immer aktiv)
            const dayRatio = (isNaN(time) || DAY_DURATION <= 0) ? 0.45 : (time % DAY_DURATION) / DAY_DURATION;
            sunGroup.rotation.x = dayRatio * Math.PI * 2 + Math.PI;

            // Sky-Colors: Wiederverwendung gecachter Color-Objekte (0 Allokationen pro Frame)
            let skyInty = 1.0;
            if (dayRatio >= 0.20 && dayRatio < 0.25) { 
                const f = (dayRatio - 0.20) / 0.05; SKY.hColor.lerpColors(SKY.nightH, SKY.sunriseH, f); SKY.zColor.lerpColors(SKY.nightZ, SKY.sunriseZ, f); skyInty = 0.05 + f * 0.35;
            } else if (dayRatio >= 0.25 && dayRatio < 0.30) {
                const f = (dayRatio - 0.25) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, SKY.dayH, f); SKY.zColor.lerpColors(SKY.sunriseZ, SKY.dayZ, f); skyInty = 0.4 + f * 0.6;
            } else if (dayRatio >= 0.30 && dayRatio <= 0.70) {
                SKY.hColor.copy(SKY.dayH); SKY.zColor.copy(SKY.dayZ); skyInty = 1.0;
            } else if (dayRatio > 0.70 && dayRatio <= 0.75) {
                const f = (dayRatio - 0.70) / 0.05; SKY.hColor.lerpColors(SKY.dayH, SKY.sunriseH, f); SKY.zColor.lerpColors(SKY.dayZ, SKY.sunriseZ, f); skyInty = 1.0 - f * 0.6;
            } else if (dayRatio > 0.75 && dayRatio <= 0.80) {
                const f = (dayRatio - 0.75) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, SKY.nightH, f); SKY.zColor.lerpColors(SKY.sunriseZ, SKY.nightZ, f); skyInty = 0.4 - f * 0.35;
            } else { SKY.hColor.copy(SKY.nightH); SKY.zColor.copy(SKY.nightZ); skyInty = 0.05; }
            sun.intensity = skyInty;

            if (window.player.inWater) {
                scene.background = SKY.underwaterColor;
                if (scene.fog) { scene.fog.color.copy(SKY.underwaterColor); scene.fog.density = 0.12; }
            } else {
                scene.background = SKY.hColor;
                if (scene.fog) { scene.fog.color.copy(SKY.hColor); scene.fog.density = 0.015; }
                if (skyUniforms) { skyUniforms.bottomColor.value.copy(SKY.hColor); skyUniforms.topColor.value.copy(SKY.zColor); if (skyMesh) skyMesh.position.copy(camera.position); }
            }

            const bAt = getBiomeAt(playerPos.x, playerPos.z);
            DOM.stats.innerText = `Pos: ${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}, ${Math.floor(playerPos.z)} | Biom: ${bAt}`;
            updateUI();

            // 4. SIMULATION (Nur wenn nicht pausiert)
            // Fix: Während spawning=true pausieren wir niemals automatisch
            const isPaused = !gameStarted || (!controls.isLocked && !spawning);
            if (!isPaused) {
                time += delta;
                                if (spawning) {
                    const cx = Math.floor(playerPos.x / CHUNK_SIZE);
                    const cz = Math.floor(playerPos.z / CHUNK_SIZE);
                    if (!world.chunks.has(world.getChunkKey(cx, cz))) {
                        window.player.velocity.set(0, 0, 0);
                        playerPos.y = CHUNK_HEIGHT + 10; 
                    } else {
                        window.player.velocity.y = Math.max(window.player.velocity.y, -4.0);
                        const bt = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z));
                        if (bt !== 0 && bt !== 8 && bt !== 9 && bt !== 10) spawning = false;
                    }
                }

                mobs.forEach(m => { 
                    if ((dayRatio < 0.25 || dayRatio > 0.75) === false && (m.type === 'zombie' || m.type === 'skeleton')) m.isDead = true;
                    else m.update(delta, playerPos, world, (d) => window.player.health -= d);
                });
                for (let i = mobs.length - 1; i >= 0; i--) { if (mobs[i].isDead) { scene.remove(mobs[i].group); mobs.splice(i, 1); } }
                updateProjectiles(delta, playerPos, world, (d) => window.player.health -= d);

                // --- Mob Spawning (optimiert: eine Schleife statt 3x filter) ---
                let landMobsCount = 0, waterMobsCount = 0;
                for (let i = 0; i < mobs.length; i++) {
                    if (mobs[i].isDead) continue;
                    if (mobs[i].type === 'fish' || mobs[i].type === 'octopus') waterMobsCount++;
                    else landMobsCount++;
                }
                
                if ((landMobsCount < MAX_COUNT || waterMobsCount < 15) && Math.random() < SPAWN_CHANCE) {
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
                        if (spawnY <= 46) {
                            if (isWaterSpawn && waterMobsCount < 15) {
                                const WEIGHT_FISH = CONFIG.MOBS.WEIGHT_FISH || 40;
                                const WEIGHT_OCTOPUS = CONFIG.MOBS.WEIGHT_OCTOPUS || 1;
                                const totalW = WEIGHT_FISH + WEIGHT_OCTOPUS;
                                if (Math.random() * totalW < WEIGHT_FISH) mobs.push(new Mob(scene, 'fish', ox, spawnY, oz));
                                else mobs.push(new Mob(scene, 'octopus', ox, spawnY, oz));
                            } else if (!waterNearby && landMobsCount < MAX_COUNT) {
                                if (dayRatio < 0.25 || dayRatio > 0.75) {
                                    if (Math.random() < 0.5) mobs.push(new Mob(scene, 'zombie', ox, spawnY, oz));
                                    else mobs.push(new Mob(scene, 'skeleton', ox, spawnY, oz));
                                }
                                else {
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

                const updateItems = (items) => {
                    for (let i = items.length - 1; i >= 0; i--) {
                        const item = items[i]; const ip = item.mesh.position;
                        item.velocityY -= 9.8 * delta; ip.y += item.velocityY * delta;
                        const bB = world.getBlock(Math.floor(ip.x), Math.floor(ip.y - 0.1), Math.floor(ip.z));
                        if (bB !== 0 && bB !== 4 && bB !== 8 && bB !== 9 && item.velocityY < 0) { ip.y = Math.floor(ip.y - 0.1) + 1.0; item.velocityY = 0; }
                        if (Math.hypot(ip.x - playerPos.x, ip.z - playerPos.z) < 2.0 && Math.abs(ip.y - playerPos.y) < 2.5) { 
                            scene.remove(item.mesh); 
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
            }

            world.updateVisibleChunks(playerPos.x, playerPos.z);
            window.player.updateSword(delta);


            renderer.render(scene, camera);
        }



        // --- SAVE / LOAD SYSTEM ---


        window.loadGamesList = function() {
            const startList = document.getElementById('save-list');
            const pauseList = document.getElementById('pause-load-list');
            
            const loadingHtml = '<div style="text-align:center;color:#aaa;padding:10px;">Lade...</div>';
            if (startList) startList.innerHTML = loadingHtml;
            if (pauseList) pauseList.innerHTML = loadingHtml;
            
            fetch('/api/saves')
                .then(res => res.json())
                .then(saves => {
                    if (startList) startList.innerHTML = '';
                    if (pauseList) pauseList.innerHTML = '';

                    if(!saves || saves.length === 0) {
                        const emptyHtml = '<div style="text-align:center;color:#aaa;padding:10px;">Keine Speicherstände gefunden!</div>';
                        if (startList) startList.innerHTML = emptyHtml;
                        if (pauseList) pauseList.innerHTML = emptyHtml;
                        return;
                    }

                    saves.forEach(name => {
                        const itemHtml = `<span>🎮 ${name}</span><button class="save-btn" onclick="loadGame('${name}')">Laden</button>`;
                        
                        if (startList) {
                            const item = document.createElement('div');
                            item.className = 'save-item';
                            item.innerHTML = itemHtml;
                            startList.appendChild(item);
                        }

                        if (pauseList) {
                            const item = document.createElement('div');
                            item.className = 'save-item';
                            item.style.padding = '5px 10px';
                            item.style.fontSize = '14px';
                            item.innerHTML = itemHtml;
                            pauseList.appendChild(item);
                        }
                    });
                })
                .catch(err => {
                    const errorHtml = '<div style="text-align:center;color:#ff6b6b;padding:10px;">Fehler!</div>';
                    if (startList) startList.innerHTML = errorHtml;
                    if (pauseList) pauseList.innerHTML = errorHtml;
                });
        };


        window.saveGame = function() {
            const name = document.getElementById('save-input').value.trim();
            if(!name) { alert("Bitte einen Namen eingeben!"); return; }
            
            const playerPos = camera.position;
            const gameData = {
                pos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                health: window.player.health,
                hunger: window.player.hunger,
                time: time,
                inventory: inventorySlots,
                collectedEggs: collectedEggs,
                collectedWool: collectedWool,
                modifiedBlocks: world.modifiedBlocks
            };
            
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