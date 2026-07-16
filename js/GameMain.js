        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
        import { CONFIG } from '../config.js?v=20260511a';
        import { SoundManager } from './sound.js?v=20260507b';
        import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas, atlasDataURL } from './blocks.js?v=20260507b';
        import { World, getBiomeAt, BIOMES } from './world.js?v=20260716b';
        import { Mob, updateProjectiles, projectiles } from './mobs.js?v=20260716a';

        import { Input } from './Input.js?v=20260507b';
        import { initTouchControls, isTouchDevice } from './touch.js?v=20260511c';
        import { prepareSaveForLoad, stampSaveVersion } from './saveMigrations.js?v=20260716d';
        import { Game } from './Game.js?v=20260507b'; // Sprint 3 Phase 1: zentraler State-Container (proxy zu window.*)
        import { Player } from './Player.js?v=20260602a';
        import { createCharacterProfile, parseCharacterProfile } from './characterProfile.js?v=20260602a';
        import { PlayerInteraction } from './PlayerInteraction.js?v=20260716b';
        import { inventorySlots, getSelectedSlot, setSelectedSlot, addItemToInventory, tryAddItemsToInventory, updateInventoryUI, toggleInventory, setupInventoryEvents, oldInventoryMap, isInventoryOpened } from './inventory.js?v=20260716b';
        import { addItemOrCreateDrop, tryCollectDroppedItem } from './itemCollection.js?v=20260716a';
        import { getOnboardingProgress } from './onboarding.js?v=20260716a';
        import { findNewGameSpawn } from './newGameSpawn.js?v=20260716a';
        import { tickFurnace, isFurnaceOpen } from './furnace.js?v=20260716a';
        import { WeatherSystem } from './weather.js?v=20260517a';
        import { NPC } from './npc.js?v=20260507b';
        import { openTradeUI, closeTradeUI, isTradeOpen } from './tradeUI.js?v=20260716a';
        import { listBrowserSaves, loadBrowserSave, saveBrowserSave, isValidSaveName, normalizeImportedSave, serializeSaveFile } from './saveStore.js?v=20260512a';
        import { getDayRatio, getSleepBlockReason, getWakeTime } from './sleep.js?v=20260515a';
        import { canSpawnerSpawnAt, findSpawnerBlocksInRange } from './spawners.js?v=20260515a';
        window.__butzcraftGameMainEvaluating = true;
        window.addItemToInventory = addItemToInventory;
        Game.inventorySlots = inventorySlots;
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
        let lastBloodMoonRewardDay = -1;
        let pendingBloodMoonRewardDay = -1;
        let lastBloodMoonRewardRetry = 0;
        const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
        const mobs = [];
        Game.droppedItems = [];
        const droppedItems = Game.droppedItems;
        let weatherSystem = null;  // Tier 3: Wetter-System (init nach World)
        const npcs = [];            // Tier 3: NPC-Array
        window.npcs = npcs;
        // Tier 3: Spawner-Tick-Timer auf Modul-Scope. WICHTIG nicht `this._spawnerTickTimer`
        // verwenden — `this` ist in einer Top-Level-Funktion innerhalb eines ES-Moduls `undefined`
        // (strict mode), und `this.x = 0` wirft TypeError. Das war der Grund, warum nach dem
        // Tier-3-Update die gesamte Steuerung blockiert war: animate() ist jeden Frame in dieser
        // Zeile abgestürzt, BEVOR `Game.player.updatePhysics(...)` aufgerufen werden konnte.
        let _spawnerTickTimer = 0;
        let _lastVisibleChunkX = null, _lastVisibleChunkZ = null, _lastVisibleRenderDist = null;
        
        
        let inventoryOpened = false;
        window.BLOCK_TEX = BLOCK_TEX;
        let gameActive = true, spawning = true, gameStarted = false, manuallyPaused = false;
        let currentSaveName = null;
        const CHARACTER_PROFILE_STORAGE_KEY = 'butzcraft.characterProfile';

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

        function loadLocalCharacterProfile() {
            try {
                const saved = localStorage.getItem(CHARACTER_PROFILE_STORAGE_KEY);
                return saved ? parseCharacterProfile(saved) : createCharacterProfile();
            } catch {
                return createCharacterProfile();
            }
        }

        function showCameraModeMessage(mode) {
            const msg = document.createElement('div');
            msg.textContent = mode === 'third' ? 'Third Person' : 'First Person';
            msg.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:3000;padding:8px 14px;background:rgba(0,0,0,0.65);color:#fff;font:600 14px sans-serif;border-radius:4px;pointer-events:none;';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 900);
        }

        function applyLocalCharacterProfile() {
            const profile = loadLocalCharacterProfile();
            if (Game.player?.setCharacterProfile) Game.player.setCharacterProfile(profile);
            return profile;
        }

        function initStartCharacterEditor() {
            const openBtn = document.getElementById('character-editor-button');
            const overlay = document.getElementById('character-editor-overlay');
            const frame = document.getElementById('character-editor-frame');
            const applyBtn = document.getElementById('character-editor-apply');
            const closeBtn = document.getElementById('character-editor-close');
            if (!openBtn || !overlay || !frame || !applyBtn || !closeBtn) return;

            const close = () => {
                overlay.classList.remove('open');
                overlay.setAttribute('aria-hidden', 'true');
            };
            const open = () => {
                if (!frame.src) frame.src = 'character-editor.html';
                overlay.classList.add('open');
                overlay.setAttribute('aria-hidden', 'false');
            };
            const apply = () => {
                const saveButton = frame.contentDocument?.getElementById('save-button');
                if (saveButton) saveButton.click();
                applyLocalCharacterProfile();
                close();
            };

            bindPress(openBtn, open);
            bindPress(applyBtn, apply);
            bindPress(closeBtn, close);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            window.openCharacterEditor = open;
            if (window.__butzcraftCharacterEditorRequested) {
                window.__butzcraftCharacterEditorRequested = false;
                open();
            }
        }

        function lockControlsForDesktop() {
            if (shouldUseTouchMode()) return false;
            if (!controls) return false;
            if (window.butzcraftPointerLockUnavailable) return false;
            if (typeof (controls.domElement || document.body).requestPointerLock !== 'function') {
                window.butzcraftPointerLockUnavailable = true;
                return false;
            }
            let embeddedOrAutomated = Boolean(window.navigator.webdriver);
            try {
                embeddedOrAutomated = embeddedOrAutomated || window.self !== window.top;
            } catch (err) {
                embeddedOrAutomated = true;
            }
            if (embeddedOrAutomated) {
                window.butzcraftPointerLockUnavailable = true;
                return false;
            }
            try {
                if (window.top !== window.self) {
                    window.butzcraftPointerLockUnavailable = true;
                    return false;
                }
            } catch (err) {
                window.butzcraftPointerLockUnavailable = true;
                return false;
            }
            try {
                controls.lock();
                return true;
            } catch (err) {
                const msg = err && err.message ? err.message : String(err);
                console.warn('[Input] Pointer Lock konnte gerade nicht aktiviert werden:', msg);
                return false;
            }
        }

        function isGameplayKey(e) {
            return Boolean(
                e &&
                (
                    e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' ||
                    e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
                    e.code === 'ControlLeft' || e.code === 'ControlRight' ||
                    e.code === 'KeyE' || e.code === 'Tab' ||
                    (e.key >= '1' && e.key <= '8')
                )
            );
        }

        function relockControlsFromInput(e) {
            if (!isGameplayKey(e)) return;
            if (!gameStarted || manuallyPaused || isBlockingOverlayOpen()) return;
            if (!controls?.isLocked && !window.touchActive) lockControlsForDesktop();
        }

        function relockControlsFromPointer(e) {
            if (e && e.button !== undefined && e.button !== 0) return;
            const target = e?.target;
            if (target?.closest?.('button, input, textarea, select, #save-section, #pause-load-list, #inventory-overlay, #furnace-overlay, #chest-overlay, #trade-overlay, #start-menu, #game-over')) return;
            if (!gameStarted || !gameActive || isBlockingOverlayOpen()) return;
            if (manuallyPaused) {
                manuallyPaused = false;
                hidePauseMenu();
            }
            if (!controls?.isLocked && !window.touchActive) lockControlsForDesktop();
        }

        function handleCameraModeToggle(e) {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code !== 'KeyV') return;
            if (!gameStarted || manuallyPaused || isBlockingOverlayOpen()) return;
            if (e.cancelable) e.preventDefault();
            const mode = Game.player.toggleCameraMode();
            showCameraModeMessage(mode);
        }

        window.butzcraftCanInteract = function() {
            return Boolean(
                gameStarted &&
                gameActive &&
                !spawning &&
                !manuallyPaused &&
                !isBlockingOverlayOpen() &&
                (controls?.isLocked || window.touchActive || window.butzcraftPointerLockUnavailable)
            );
        };

        function showPauseMenu() {
            const inst = document.getElementById('instructions');
            if (!inst) return;
            inst.style.display = 'block';
            if (typeof window.loadGamesList === 'function') window.loadGamesList();
        }

        function hidePauseMenu() {
            const inst = document.getElementById('instructions');
            if (inst) inst.style.display = 'none';
        }

        const CONTROLS_HINT_HIDE_MS = 8500;
        let controlsHintTimer = null;
        let controlsHintShownForRun = false;
        let miniObjectiveIndex = 0;
        let currentMiniObjective = null;

        function getControlsHintText() {
            if (shouldUseTouchMode() || window.innerWidth <= 760) {
                return 'Schaue auf einen Baum und tippe zum Abbauen - linker Daumen bewegt - rechts umsehen';
            }
            return 'Schaue auf einen Baum und halte Linksklick - WASD bewegen - Maus umsehen - E Inventar';
        }

        function hideControlsHint() {
            const hint = document.getElementById('controls-hint');
            if (!hint) return;
            hint.classList.remove('visible');
            hint.setAttribute('aria-hidden', 'true');
            if (controlsHintTimer) {
                clearTimeout(controlsHintTimer);
                controlsHintTimer = null;
            }
        }

        function showControlsHint() {
            const hint = document.getElementById('controls-hint');
            const text = document.getElementById('controls-hint-text');
            if (!hint || !text) return;
            text.textContent = getControlsHintText();
            hint.setAttribute('aria-hidden', 'false');
            hint.classList.add('visible');
            if (controlsHintTimer) clearTimeout(controlsHintTimer);
            controlsHintTimer = setTimeout(() => {
                hideControlsHint();
                updateFirstObjective();
            }, CONTROLS_HINT_HIDE_MS);
        }

        function advanceMiniObjective() {
            const progress = getOnboardingProgress(inventorySlots, miniObjectiveIndex);
            miniObjectiveIndex = progress.index;
            currentMiniObjective = progress.objective;
        }

        function hideFirstObjective() {
            const el = document.getElementById('first-objective');
            if (!el) return;
            el.classList.remove('visible');
            el.setAttribute('aria-hidden', 'true');
        }

        function showFirstObjective() {
            const el = document.getElementById('first-objective');
            const label = document.getElementById('first-objective-label');
            const text = document.getElementById('first-objective-text');
            const objective = currentMiniObjective;
            if (!el || !label || !text || !objective) return;
            label.textContent = objective.label;
            text.textContent = objective.text;
            el.classList.add('visible');
            el.setAttribute('aria-hidden', 'false');
        }

        function updateFirstObjective() {
            advanceMiniObjective();
            if (!currentMiniObjective) {
                hideFirstObjective();
                return;
            }
            const controlsHint = document.getElementById('controls-hint');
            const controlsHintVisible = controlsHint && controlsHint.classList.contains('visible');
            if (!gameStarted || spawning || manuallyPaused || isBlockingOverlayOpen() || controlsHintVisible) {
                hideFirstObjective();
                return;
            }
            showFirstObjective();
        }

        function resetControlsHintForRun(restoredObjectiveIndex = 0) {
            controlsHintShownForRun = false;
            miniObjectiveIndex = restoredObjectiveIndex;
            advanceMiniObjective();
            hideControlsHint();
            hideFirstObjective();
        }

        function showControlsHintOnceReady() {
            if (controlsHintShownForRun || !gameStarted || spawning || manuallyPaused || isBlockingOverlayOpen()) return;
            controlsHintShownForRun = true;
            showControlsHint();
        }

        window.pauseGame = function() {
            if (!gameStarted || spawning || isBlockingOverlayOpen()) return;
            manuallyPaused = true;
            if (controls?.isLocked) controls.unlock();
            hideControlsHint();
            hideFirstObjective();
            showPauseMenu();
        };

        window.resumeGame = function() {
            if (!gameStarted || spawning) return;
            manuallyPaused = false;
            hidePauseMenu();
            lockControlsForDesktop();
        };

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

        function apiUrl(path) {
            return new URL(path.replace(/^\/+/, ''), window.location.href).toString();
        }

        async function loadSaveData(name) {
            try {
                const browserSave = await loadBrowserSave(name);
                if (browserSave) return browserSave;
            } catch (err) {
                if (err && err.message === 'Invalid name') throw err;
                console.warn('[Save] Browser-Save nicht lesbar, versuche Server-Fallback:', err);
            }

            const res = await fetch(apiUrl(`api/load?name=${encodeURIComponent(name)}`));
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data;
        }

        async function listServerSaves() {
            try {
                const res = await fetch(apiUrl('api/saves'));
                const saves = await res.json();
                return Array.isArray(saves) ? saves : [];
            } catch (err) {
                return [];
            }
        }

        async function listAllSaveNames() {
            let browserSaves = [];
            try {
                browserSaves = await listBrowserSaves();
            } catch (err) {
                console.warn('[Save] Browser-Save-Liste nicht lesbar:', err);
            }
            const serverSaves = await listServerSaves();
            return [...new Set([...browserSaves, ...serverSaves])];
        }

        function showSaveMessage(text, color = '#4caf50') {
            const msg = document.getElementById('save-msg');
            if (!msg) return;
            msg.textContent = text;
            msg.style.color = color;
            msg.style.display = 'block';
            setTimeout(() => msg.style.display = 'none', 3000);
        }

        function showSaveNameError() {
            const input = document.getElementById('save-input');
            showSaveMessage('Bitte gib einen Namen fuer den Spielstand ein.', '#ff9800');
            if (!input) return;
            input.classList.add('save-input-error');
            input.focus();
            input.addEventListener('input', () => input.classList.remove('save-input-error'), { once: true });
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

        function getRenderDistanceFogDensity() {
            return THREE.MathUtils.clamp(0.06 / Math.max(1, CONFIG.WORLD.RENDER_DIST), 0.005, 0.035);
        }

        function applyRenderDistanceVisuals() {
            if (scene?.fog && !Game.player?.inWater) scene.fog.density = getRenderDistanceFogDensity();
        }

        function disposeDroppedItem(item) {
            if (!item || !item.mesh) return;
            scene.remove(item.mesh);
            if (item.mesh.geometry) item.mesh.geometry.dispose();
            if (item.mesh.material) {
                if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
                else item.mesh.material.dispose();
            }
        }

        function createOverflowDrop(type, count) {
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.25, 0.25, 0.25),
                new THREE.MeshPhongMaterial({ color: BLOCK_COLORS[type] || 0xffffff })
            );
            const playerPosition = controls?.getObject?.()?.position || camera?.position;
            if (playerPosition) mesh.position.copy(playerPosition);
            mesh.position.y += 0.3;
            scene.add(mesh);
            droppedItems.push({ mesh, velocityY: 2, blockType: type, count });
        }

        function addItemToInventoryOrDrop(type, count) {
            return addItemOrCreateDrop(type, count, createOverflowDrop);
        }

        function resetRuntimeForLoadedGame() {
            while (mobs.length > 0) {
                const mob = mobs.pop();
                if (mob && typeof mob.dispose === 'function') mob.dispose();
                else if (mob && mob.group) scene.remove(mob.group);
            }
            while (droppedItems.length > 0) disposeDroppedItem(droppedItems.pop());
            while (projectiles.length > 0) {
                const projectile = projectiles.pop();
                if (projectile && typeof projectile.dispose === 'function') projectile.dispose();
            }
            world.fireBlocks.clear();
            world.spawnerMeta = {};
            world.villages = [];
        }

        window.startNewGame = function() {
            if (gameStarted) return;
            console.log("DEBUG: startNewGame starting...");
            applyLocalCharacterProfile();
            document.getElementById('start-menu').style.display = 'none';
            document.body.classList.add('game-started');
            currentSaveName = null;
            SoundManager.init();
            manuallyPaused = false;
            lockControlsForDesktop();
            hidePauseMenu();
            gameStarted = true;
            resetControlsHintForRun();
            window.__butzcraftStartRequested = false;
            console.log("DEBUG: startNewGame finished, gameStarted set to true");
        };
        window.__butzcraftStartFunctionReady = true;
        if (window.__butzcraftStartRequested && window.__butzcraftRefreshStartStatus) {
            window.__butzcraftRefreshStartStatus('Engine bereit. Welt wird vorbereitet...');
        }

        window.loadGame = function(name) {
            console.log("DEBUG: loadGame starting for", name);
            SoundManager.init();
            loadSaveData(name)
                .then(rawData => {
                    const data = prepareSaveForLoad(rawData);
                    document.getElementById('start-menu').style.display = 'none';
                    document.body.classList.add('game-started');
                    lockControlsForDesktop();
                    gameStarted = true;
                    currentSaveName = name;
                    document.getElementById('save-input').value = name;

                    resetRuntimeForLoadedGame();

                    const playerPos = camera.position;
                    playerPos.set(data.pos.x, data.pos.y, data.pos.z);
                    Game.player.health = data.health;
                    Game.player.hunger = data.hunger;
                    time = data.time;
                    spawning = false;

                    // migrateSave liefert immer exakt 64 Slots und ersetzt damit den vorherigen Inventarstand vollständig.
                    data.inventory.forEach((item, i) => inventorySlots[i] = item);
                    resetControlsHintForRun(data.onboardingObjectiveIndex);
                    
                    collectedWool = data.collectedWool || 0;
                    lastBloodMoonRewardDay = typeof data.lastBloodMoonRewardDay === 'number' ? data.lastBloodMoonRewardDay : -1;
                    pendingBloodMoonRewardDay = typeof data.pendingBloodMoonRewardDay === 'number' ? data.pendingBloodMoonRewardDay : -1;
                    updateInventoryUI();
                    updateUI();
                    
                    {
                        world.modifiedBlocks = data.modifiedBlocks || {};
                        world.setBlockMetaData(data.blockMeta || {});
                        world.chestContents = data.chestContents || {};
                        world.lootedChests = new Set(data.lootedChests || []);

                        // Tier 3: Wetter-State + Feuer-Blöcke wiederherstellen
                        if (weatherSystem) {
                            weatherSystem.deserialize(data.weather);
                            weatherSystem.loadFireBlocks(data.fireBlocks || {});
                        }
                        world.villages = Array.isArray(data.villages) ? data.villages : [];

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

                        world.disposeAllChunks({ reuseBuffers: true });
                        updateVisibleChunksIfNeeded(playerPos, true);
                    }
                })
                .catch(err => alert("Fehler beim Laden: " + (err && err.message ? err.message : err)));
        };




        // --- DOM-CACHE (statt getElementById pro Frame) ---
        const DOM = {
            healthFill: document.getElementById('health-fill'),
            hungerFill: document.getElementById('hunger-fill'),
            timeInfo: document.getElementById('time-info'),
            stats: document.getElementById('stats'),
            fpsCounter: document.getElementById('fps-counter'),
            gameOver: document.getElementById('game-over')
        };
        const UI_UPDATE_INTERVAL_MS = 100;
        const STATS_UPDATE_INTERVAL_MS = 250;
        const FPS_UPDATE_INTERVAL_MS = 500;
        let lastUiUpdateAt = 0;
        let lastStatsUpdateAt = 0;
        let lastStatsText = '';
        let fpsFrameCount = 0;
        let fpsWindowStartedAt = performance.now();
        let debugHudVisible = false;

        function setDebugHudVisible(visible) {
            debugHudVisible = Boolean(visible);
            DOM.stats.classList.toggle('debug-visible', debugHudVisible);
            DOM.fpsCounter.classList.toggle('debug-visible', debugHudVisible);
            DOM.stats.setAttribute('aria-hidden', debugHudVisible ? 'false' : 'true');
            DOM.fpsCounter.setAttribute('aria-hidden', debugHudVisible ? 'false' : 'true');
        }

        function toggleDebugHud() {
            setDebugHudVisible(!debugHudVisible);
        }

        setDebugHudVisible(false);

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

        function grantBloodMoonReward(dayCount, notifyFailure = true) {
            if (BLOOD_MOON_INTERVAL <= 0) return;
            if (dayCount % BLOOD_MOON_INTERVAL !== BLOOD_MOON_INTERVAL - 1) return;
            if (lastBloodMoonRewardDay === dayCount) return;
            if (!Game.player || Game.player.health <= 0) return;

            const result = tryAddItemsToInventory([
                { type: 61, count: 1 },
                { type: 60, count: 4 },
                { type: 31, count: 2 }
            ]);
            if (!result.added) {
                pendingBloodMoonRewardDay = dayCount;
                if (notifyFailure) showSaveMessage('Blutmond-Belohnung wartet: Inventar voll', '#ff9800');
                return;
            }

            lastBloodMoonRewardDay = dayCount;
            pendingBloodMoonRewardDay = -1;
            showSaveMessage('Blutmond ueberlebt: +1 Eisenbarren, +4 Kohle, +2 Knochen', '#FFD700');
        }

        window.trySleepInBed = function() {
            const dayRatio = getDayRatio(time, DAY_DURATION);
            const dayCount = Math.floor(time / DAY_DURATION);
            const isBloodMoonNight = dayCount % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1);
            const playerPos = controls.getObject().position;
            const hostileNearby = mobs.some(m => (
                !m.isDead &&
                (m.type === 'zombie' || m.type === 'skeleton' || m.type === 'spider' || m.type === 'geist') &&
                m.group.position.distanceTo(playerPos) < 12
            ));
            const blockReason = getSleepBlockReason(dayRatio, isBloodMoonNight, hostileNearby);

            if (blockReason === 'day') return { ok: false, message: 'Du kannst nur nachts schlafen.' };
            if (blockReason === 'bloodMoon') return { ok: false, message: 'Der Blutmond laesst dich nicht schlafen.' };
            if (blockReason === 'hostile') return { ok: false, message: 'Monster sind zu nah.' };

            time = getWakeTime(time, DAY_DURATION);
            mobs.forEach(m => {
                if (m.type === 'zombie' || m.type === 'skeleton' || m.type === 'spider' || m.type === 'geist') m.isDead = true;
            });
            Game.player.health = Math.min(MAX_HEALTH, Game.player.health + 10);
            Game.player.hunger = Math.max(0, Game.player.hunger - 5);
            updateUI();
            return { ok: true, message: 'Gut geschlafen. Es ist Morgen.' };
        };

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
            window.__butzcraftGameMainEvaluating = false;
            animate();
        } catch (err) {
            window.__butzcraftGameMainError = err && (err.stack || err.message || String(err));
            window.__butzcraftGameMainEvaluating = false;
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
            scene.fog = new THREE.FogExp2(fogColor, getRenderDistanceFogDensity());
            
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
            
            // Grasland bevorzugen, damit neue Spieler mit freier Sicht und Holz in der Nähe starten.
            const spawn = findNewGameSpawn();
            camera.position.set(spawn.x, spawn.height + 5, spawn.z); // Näher am Boden spawnen

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

            renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
            renderer.domElement.id = 'game-canvas';
            const DEFAULT_RENDER_SCALE = 1;
            let renderScale = DEFAULT_RENDER_SCALE;
            renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * renderScale, 2));
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // WebGL Context-Loss Handling: tritt auf bei Tab-Wechsel auf Mobile, GPU-Reset, oder
            // wenn der Browser den Context wegen Inaktivität freigibt. Ohne preventDefault wird
            // der Context NIE wiederhergestellt → Canvas bleibt schwarz für immer.
            Game.webglContextLost = false;
            renderer.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                Game.webglContextLost = true;
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
                Game.webglContextLost = false;
                const overlay = document.getElementById('webgl-context-lost-overlay');
                if (overlay) overlay.style.display = 'none';
                // Chunk-Meshes neu aufbauen — alte BufferGeometries sind nach Context-Loss ungültig.
                if (Game.world && Game.world.chunks) {
                    for (const chunk of Game.world.chunks.values()) {
                        Game.world.disposeChunkMeshes(chunk);
                        Game.world.requestMesh(chunk.cx, chunk.cz);
                    }
                }
            }, false);
            document.addEventListener('pointerdown', relockControlsFromPointer, true);

            Game.player = new Player(scene, camera, document.body, CONFIG, loadLocalCharacterProfile());
            controls = Game.player.controls;

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

            initStartCharacterEditor();

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
                if (gameActive && manuallyPaused) window.resumeGame();
            });
            controls.addEventListener('lock', () => {
                manuallyPaused = false;
                inst.style.display = 'none';
            });
            controls.addEventListener('unlock', () => { 
                // Nur anzeigen, wenn das Hauptmenü weg ist UND wir nicht gerade im Lade-Spawn sind
                if (manuallyPaused && gameActive && !spawning && document.getElementById('start-menu').style.display === 'none' && !isBlockingOverlayOpen()) {
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
            Game.world = world;

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
            const RS_STORAGE_KEY = 'butzcraft.renderScale';
            const RD_ALLOWED = [2, 4, 6, 8, 12];
            const RS_ALLOWED = [0.5, 0.75, 1];
            const applyRenderDistance = (value) => {
                const n = parseInt(value, 10);
                if (!RD_ALLOWED.includes(n)) return;
                CONFIG.WORLD.RENDER_DIST = n;
                try { localStorage.setItem(RD_STORAGE_KEY, String(n)); } catch (e) { /* QuotaExceeded etc. ignorieren */ }
                applyRenderDistanceVisuals();
                // Sofort wirksam machen, wenn Spieler bereits in der Welt ist
                if (Game.player && Game.player.controls) {
                    const p = Game.player.controls.getObject().position;
                    updateVisibleChunksIfNeeded(p, true);
                }
            };
            const applyRenderScale = (value) => {
                const n = parseFloat(value);
                if (!RS_ALLOWED.includes(n)) return;
                renderScale = n;
                renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * renderScale, 2));
                renderer.setSize(window.innerWidth, window.innerHeight);
                try { localStorage.setItem(RS_STORAGE_KEY, String(n)); } catch (e) { /* QuotaExceeded etc. ignorieren */ }
            };
            window.applyRenderDistance = applyRenderDistance;
            window.applyRenderScale = applyRenderScale;
            // Initial-Apply: aus localStorage laden, falls vorhanden
            try {
                const stored = localStorage.getItem(RD_STORAGE_KEY);
                if (stored) applyRenderDistance(stored);
                const storedScale = localStorage.getItem(RS_STORAGE_KEY);
                if (storedScale) applyRenderScale(storedScale);
            } catch (e) { /* Storage disabled (Privacy-Mode) */ }
            // UI-Verdrahtung
            const rdSelect = document.getElementById('render-distance-select');
            if (rdSelect) {
                rdSelect.value = String(CONFIG.WORLD.RENDER_DIST);
                rdSelect.addEventListener('change', (e) => applyRenderDistance(e.target.value));
            }
            const rsSelect = document.getElementById('render-scale-select');
            if (rsSelect) {
                rsSelect.value = String(renderScale);
                rsSelect.addEventListener('change', (e) => applyRenderScale(e.target.value));
            }

            window.playerInteraction = new PlayerInteraction(camera, scene, world, mobs, SoundManager, {
                getSelectedSlot: getSelectedSlot,
                getInventorySlots: () => inventorySlots,
                addItemToInventory: addItemToInventoryOrDrop,
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
                if (e.code === 'F3') {
                    if (e.cancelable) e.preventDefault();
                    toggleDebugHud();
                    return;
                }
                if (e.code === 'KeyV') {
                    handleCameraModeToggle(e);
                    return;
                }
                if (isGameplayKey(e) && e.cancelable) e.preventDefault();

                if (e.code === 'Tab') {
                    const furnaceOverlay = document.getElementById('furnace-overlay');
                    const chestOverlay = document.getElementById('chest-overlay');
                    const tradeOverlay = document.getElementById('trade-overlay');
                    if (isInventoryOpened()) { toggleInventory(gameStarted, spawning, controls); return; }
                    if (furnaceOverlay && furnaceOverlay.style.display !== 'none') { window.closeFurnace && window.closeFurnace(); return; }
                    if (chestOverlay && chestOverlay.style.display !== 'none') { window.closeChest && window.closeChest(); return; }
                    if (tradeOverlay && tradeOverlay.style.display !== 'none') { closeTradeUI(controls); return; }
                    if (manuallyPaused) window.resumeGame(); else window.pauseGame();
                    return;
                }

                if (e.code === 'Escape') {
                    const furnaceOverlay = document.getElementById('furnace-overlay');
                    const chestOverlay = document.getElementById('chest-overlay');
                    const tradeOverlay = document.getElementById('trade-overlay');
                    if (isInventoryOpened()) { toggleInventory(gameStarted, spawning, controls); return; }
                    if (furnaceOverlay && furnaceOverlay.style.display !== 'none') { window.closeFurnace && window.closeFurnace(); return; }
                    if (chestOverlay && chestOverlay.style.display !== 'none') { window.closeChest && window.closeChest(); return; }
                    if (tradeOverlay && tradeOverlay.style.display !== 'none') { closeTradeUI(controls); return; }
                    if (manuallyPaused) window.resumeGame(); else window.pauseGame();
                    return;
                }

                relockControlsFromInput(e);

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
            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setPixelRatio(Math.min((window.devicePixelRatio || 1) * renderScale, 2));
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
            Game.camera = camera;
            Game.controls = controls;
            Game.world = world;
            Game.renderer = renderer;
            Game.scene = scene;
            window.SoundManager = SoundManager;
            window.mobs = mobs;



            // Komfort-Funktion zum Testen von Wasser
            
        }


        function updateStatsHud(now, playerPos, biome, weatherIcon) {
            const text = `Pos: ${Math.floor(playerPos.x)}, ${Math.floor(playerPos.y)}, ${Math.floor(playerPos.z)} | Biom: ${biome}${weatherIcon}`;
            if (text === lastStatsText && now - lastStatsUpdateAt < STATS_UPDATE_INTERVAL_MS) return;
            lastStatsText = text;
            lastStatsUpdateAt = now;
            DOM.stats.textContent = text;
        }

        function updateFpsCounter(now) {
            fpsFrameCount++;
            const elapsed = now - fpsWindowStartedAt;
            if (elapsed < FPS_UPDATE_INTERVAL_MS) return;
            const fps = Math.round((fpsFrameCount * 1000) / elapsed);
            DOM.fpsCounter.textContent = `FPS: ${fps}`;
            fpsFrameCount = 0;
            fpsWindowStartedAt = now;
        }

        function updateUI(force = true, now = performance.now()) {
            if (force || now - lastUiUpdateAt >= UI_UPDATE_INTERVAL_MS) {
                lastUiUpdateAt = now;
                DOM.healthFill.style.width = Math.max(0, Game.player.health) + '%';
                DOM.hungerFill.style.width = Math.max(0, Game.player.hunger) + '%';
                const tm = Math.floor((time / DAY_DURATION) * 1440), hh = Math.floor(tm / 60) % 24, mm = tm % 60, dd = Math.floor(time / DAY_DURATION) + 1;
                const dayRatioUI = (isNaN(time) || DAY_DURATION <= 0) ? 0.45 : (time % DAY_DURATION) / DAY_DURATION;
                const dayCountUI = Math.floor(time / DAY_DURATION);
                const isBloodMoonUI = dayCountUI % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1);
                const bloodMoonWarning = isBloodMoonUI && dayRatioUI > 0.65 && dayRatioUI <= 0.80 ? ' | \u{1F534} Blutmond!' : '';
                const bloodMoonActive = isBloodMoonUI && (dayRatioUI > 0.80 || dayRatioUI < 0.20) ? ' | \u{1F7E5} BLUTMOND' : '';
                DOM.timeInfo.textContent = `Tag ${dd} | ${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}${bloodMoonWarning}${bloodMoonActive}`;
            }
            if (Game.player.health <= 0 && gameActive && !spawning) {
                gameActive = false;
                controls.unlock();
                hideFirstObjective();
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
            listAllSaveNames()
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
            if (Game.webglContextLost) { prevTime = performance.now(); return; }
            const now = performance.now();
            updateFpsCounter(now);
            const delta = Math.min((now - prevTime) / 1000, 0.02);
            prevTime = now;

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
            Game.player.updateWaterAndVoid(world, SoundManager, delta);
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

            if (Game.player.inWater) {
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
                    if (scene.fog) { scene.fog.color.copy(wH); scene.fog.density = getRenderDistanceFogDensity() + weatherFogExtra; }
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
            updateStatsHud(now, playerPos, bAt, weatherIcon);
            updateUI(false, now);
            updateFirstObjective();

            // 4. SIMULATION (Nur wenn nicht pausiert)
            // Fix: Während spawning=true pausieren wir niemals automatisch
            // Touch-Mode kennt keinen PointerLock — touchActive zählt als "im Spiel aktiv".
            const isPaused = !gameStarted || manuallyPaused || (!spawning && isBlockingOverlayOpen());
            if (!isPaused) {
                const previousDayCount = Math.floor(time / DAY_DURATION);
                time += delta;
                const currentDayCount = Math.floor(time / DAY_DURATION);
                if (currentDayCount > previousDayCount) grantBloodMoonReward(previousDayCount);
                if (pendingBloodMoonRewardDay >= 0 && now - lastBloodMoonRewardRetry >= 1000) {
                    lastBloodMoonRewardRetry = now;
                    grantBloodMoonReward(pendingBloodMoonRewardDay, false);
                }

                // Tier 3: Wetter-System Update
                if (weatherSystem) {
                    weatherSystem.update(delta, playerPos, bAt);
                }

                if (spawning) {
                    const cx = Math.floor(playerPos.x / CHUNK_SIZE);
                    const cz = Math.floor(playerPos.z / CHUNK_SIZE);
                    if (!world.chunks.has(world.getChunkKey(cx, cz))) {
                        Game.player.velocity.set(0, 0, 0);
                        playerPos.y = CHUNK_HEIGHT + 10; 
                    } else {
                        Game.player.velocity.y = Math.max(Game.player.velocity.y, -4.0);
                        const bt = world.getBlock(Math.floor(playerPos.x), Math.floor(playerPos.y - 1.7), Math.floor(playerPos.z));
                        if (bt !== 0 && bt !== 8 && bt !== 9 && bt !== 10) {
                            spawning = false;
                            if (!controls.isLocked && !window.touchActive) lockControlsForDesktop();
                        }
                    }
                }
                showControlsHintOnceReady();

                // Wrapped onDamage: appliziert Schaden UND triggert Feedback (Flash + Pain-Sound + Shake).
                // _lastPainAt verhindert Sound-Spam bei kontinuierlichem Zombie-Damage (≤ 1 Sound/300ms).
                const onPlayerDamage = (d) => {
                    if (d <= 0) return;
                    Game.player.health -= d;
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
                    
                    const now = performance.now() / 1000;
                    const nearbySpawners = findSpawnerBlocksInRange(world, px, py, pz, SPAWNER_RANGE);
                    for (const spawner of nearbySpawners) {
                        const sx = spawner.x, sy = spawner.y, sz = spawner.z;
                        const sKey = spawner.key;
                        if (!world.spawnerMeta[sKey]) {
                            world.spawnerMeta[sKey] = { lastSpawn: now - CONFIG.DUNGEON.SPAWNER_INTERVAL_MAX, mobCount: 0 };
                        }
                        const meta = world.spawnerMeta[sKey];
                        const interval = CONFIG.DUNGEON.SPAWNER_INTERVAL_MIN +
                            Math.random() * (CONFIG.DUNGEON.SPAWNER_INTERVAL_MAX - CONFIG.DUNGEON.SPAWNER_INTERVAL_MIN);

                        if (now - meta.lastSpawn > interval && meta.mobCount < CONFIG.DUNGEON.SPAWNER_MAX_MOBS) {
                            // Spawn-Position: zufällig um den Spawner herum (innerhalb des Dungeons)
                            const spX = sx + (Math.random() - 0.5) * 4;
                            const spZ = sz + (Math.random() - 0.5) * 4;
                            const spY = sy + 1;

                            // Luft über dem Spawn-Punkt prüfen
                            if (canSpawnerSpawnAt(world, spX, spY, spZ)) {
                                const mobType = 'spider';
                                const newMob = new Mob(scene, mobType, spX, spY, spZ);
                                newMob._spawnerKey = sKey; // Spawner-Referenz für Zähler
                                mobs.push(newMob);
                                meta.lastSpawn = now;
                                meta.mobCount++;
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
                            tryCollectDroppedItem(items, i, disposeDrop);
                        }
                    }
                };
                updateItems(droppedItems);

                // PLAYER PHYSICS
                Game.player.updatePhysics(delta, Input, world, SoundManager);
                Game.player.hunger -= HUNGER_LOSS_PASSIVE * delta; if (Game.player.hunger <= 0) { Game.player.hunger = 0; Game.player.health -= 2 * delta; }
                if (Game.player.hunger > REGEN_THRESHOLD && Game.player.health < MAX_HEALTH) Game.player.health += REGEN_RATE * delta;

                // Druckplatten-Schaden
                if (window.playerInteraction) window.playerInteraction.checkPressurePlates(playerPos.x, playerPos.y, playerPos.z);
            }

            // Ofen-Tick (auch wenn pausiert, solange UI offen)
            tickFurnace(controls);

            updateVisibleChunksIfNeeded(playerPos);
            world.processPendingMeshResults();
            Game.player.updateSword(delta);


            const cameraRestoreState = Game.player.prepareCameraForRender(world);
            try {
                renderer.render(scene, camera);
            } finally {
                Game.player.restoreCameraAfterRender(cameraRestoreState);
            }
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

            listAllSaveNames()
                .then(saves => {
                    if (startList) startList.textContent = '';
                    if (pauseList) pauseList.textContent = '';

                    if (!saves || saves.length === 0) {
                        setStatus(startList, 'Noch kein Spielstand. Starte eine neue Welt und sichere später deinen Fortschritt.', '#ddd');
                        setStatus(pauseList, 'Keine Speicherstände gefunden!', '#aaa');
                        return;
                    }

                    saves.forEach(name => {
                        if (startList) startList.appendChild(buildSaveItem(name, false));
                        if (pauseList) pauseList.appendChild(buildSaveItem(name, true));
                    });
                })
                .catch(err => {
                    setStatus(startList, 'Speicherstaende nicht lesbar', '#aaa');
                    setStatus(pauseList, 'Speicherstaende nicht lesbar', '#aaa');
                });
        };


        window.saveGame = function() {
            const name = document.getElementById('save-input').value.trim();
            if(!name) { showSaveNameError(); return; }
            
            const playerPos = camera.position;
            const gameData = stampSaveVersion({
                pos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
                health: Game.player.health,
                hunger: Game.player.hunger,
                time: time,
                inventory: inventorySlots,
                collectedEggs: collectedEggs,
                collectedWool: collectedWool,
                lastBloodMoonRewardDay: lastBloodMoonRewardDay,
                pendingBloodMoonRewardDay: pendingBloodMoonRewardDay,
                onboardingObjectiveIndex: miniObjectiveIndex,
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
            
            if (!isValidSaveName(name)) {
                alert("Ungueltiger Name. Erlaubt sind Buchstaben, Zahlen, Leerzeichen, _ und -.");
                return;
            }

            saveBrowserSave(name, gameData)
                .then(() => {
                    currentSaveName = name;
                    showSaveMessage('Spiel gespeichert!');
                    window.loadGamesList();
                })
                .catch(err => alert("Fehler beim Speichern: " + (err && err.message ? err.message : err)));
        };

        window.exportSaveGame = function() {
            const inputName = document.getElementById('save-input').value.trim();
            const name = inputName || currentSaveName;
            if (!name) {
                alert("Bitte erst einen Spielstand speichern oder einen Namen eingeben.");
                return;
            }
            loadSaveData(name)
                .then(gameData => {
                    const blob = new Blob([serializeSaveFile(name, gameData)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${name}.json`;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                })
                .catch(err => alert("Fehler beim Export: " + (err && err.message ? err.message : err)));
        };

        window.importSaveGame = function() {
            const input = document.getElementById('save-import-input');
            if (!input) return;
            input.value = '';
            input.click();
        };

        window.handleSaveImport = function(input) {
            const file = input && input.files && input.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const raw = JSON.parse(reader.result);
                    const save = normalizeImportedSave(raw, file.name);
                    saveBrowserSave(save.name, save.gameData)
                        .then(() => {
                            currentSaveName = save.name;
                            const nameInput = document.getElementById('save-input');
                            if (nameInput) nameInput.value = save.name;
                            showSaveMessage('Spielstand importiert!');
                            window.loadGamesList();
                        })
                        .catch(err => alert("Fehler beim Import: " + (err && err.message ? err.message : err)));
                } catch (err) {
                    alert("Fehler beim Import: Ungueltige JSON-Datei.");
                }
            };
            reader.onerror = () => alert("Fehler beim Import: Datei konnte nicht gelesen werden.");
            reader.readAsText(file);
        };

        window.loadGamesList(); // Initial laden
