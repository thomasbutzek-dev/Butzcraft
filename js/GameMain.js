        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
        import { CONFIG } from '../config.js?v=20260511a';
        import { SoundManager } from './sound.js?v=20260507b';
        import { BLOCK_TYPES, BLOCK_COLORS, BLOCK_TEX, textureAtlas, atlasDataURL } from './blocks.js?v=20260717z';
        import { World, getBiomeAt, BIOMES } from './world.js?v=20260721b';
        import { Mob, updateProjectiles, projectiles } from './mobs.js?v=20260720q';
        import { BloodMoonBoss } from './bloodMoonBoss.js?v=20260720a';

        import { Input } from './Input.js?v=20260507b';
        import { initTouchControls, isTouchDevice } from './touch.js?v=20260720q';
        import { getWorldGenerationLoadNotice, prepareSaveForLoad, stampSaveVersion } from './saveMigrations.js?v=20260720q';
        import { Game } from './Game.js?v=20260716b'; // Central state container
        import { Player } from './Player.js?v=20260719a';
        import { createCharacterProfile, normalizeCharacterProfile, parseCharacterProfile } from './characterProfile.js?v=20260602a';
        import { PlayerInteraction, canUseMouseInteraction } from './PlayerInteraction.js?v=20260721c';
        import { inventorySlots, getSelectedSlot, setSelectedSlot, addItemToInventory, tryAddItemsToInventory, updateInventoryUI, toggleInventory, openWorkbenchCrafting, prepareInventoryUI, setupInventoryEvents, oldInventoryMap, isInventoryOpened } from './inventory.js?v=20260721c';
        import { addItemOrCreateDrop, tryCollectDroppedItem, updateDroppedItemVisual } from './itemCollection.js?v=20260721c';
        import { getOnboardingProgress } from './onboarding.js?v=20260718f';
        import { STORY_EVENTS, advanceStoryProgress, getStoryProgress } from './storyProgress.js?v=20260721b';
        import { applyQuestEvent, createQuestState, ensureVillageState, getNpcIdentity, getVillageId, grantQuestItem, hasQuestItems, normalizeQuestState, refreshVillageOffers } from './quests.js?v=20260721b';
        import { findNewGameSpawn } from './newGameSpawn.js?v=20260719a';
        import { tickFurnace, isFurnaceOpen } from './furnace.js?v=20260721c';
        import { WeatherSystem } from './weather.js?v=20260719a';
        import { graphicsPrototype } from './graphicsPrototype.js?v=20260718c';
        import { NPC } from './npc.js?v=20260720q';
        import { preloadEntityMaterials } from './entityMaterials.js?v=20260719a';
        import { Minecart } from './minecart.js?v=20260719a';
        import { closeTradeUI, isTradeOpen } from './tradeUI.js?v=20260721c';
        import { listBrowserSaves, loadBrowserSave, saveBrowserSave, isValidSaveName, normalizeImportedSave, serializeSaveFile } from './saveStore.js?v=20260718b';
        import { SaveRepository } from './saveRepository.js?v=20260718a';
        import { getAmbientLightIntensity, getDayCycleSpeed, getDayRatio, getSkyLightIntensity, getSleepBlockReason, getWakeTime } from './sleep.js?v=20260719a';
        import { canSpawnerSpawnAt, findSpawnerBlocksInRange } from './spawners.js?v=20260515a';
        import { findSafeBedRespawn, normalizeRespawnBed } from './respawn.js?v=20260716a';
        import { TorchLightSystem, TORCH_TYPE } from './torchLights.js?v=20260719a';
        import { DamageFeedback } from './damageFeedback.js?v=20260718a';
        import { FrameRateTracker } from './frameRateTracker.js?v=20260718a';
        import { calculateRenderPixelRatio } from './renderResolution.js?v=20260718a';
        import { resolveUiInputCommand } from './inputCommand.js?v=20260720q';
        import { initQuestJournal, showInventoryPanel, updateQuestCompass } from './questJournal.js?v=20260721c';
        import { activateDialog, deactivateDialog } from './dialogFocus.js?v=20260718b';
        window.__butzcraftGameMainEvaluating = true;
        window.addItemToInventory = addItemToInventory;
        window.updateInventoryUI = updateInventoryUI;
        window.getSelectedSlot = getSelectedSlot;
        window.setSelectedSlot = setSelectedSlot;
        window.getBiomeAt = getBiomeAt;

        window._blockTexData = { BLOCK_TEX, atlasDataURL };
        window.addEventListener('butzcraft:atlas-ready', () => {
            window._blockTexData.atlasDataURL = atlasDataURL;
            document.querySelectorAll('.flat-icon, .mc-face, .mini-icon').forEach(element => {
                element.style.backgroundImage = `url("${atlasDataURL}")`;
            });
        });
        


;

        // --- KONSTANTEN & KONFIGURATION ---
        const { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, RENDER_DIST, CLOUD_HEIGHT } = CONFIG.WORLD;
        const { DAY_DURATION, MAX_HEALTH, MAX_HUNGER, HUNGER_LOSS_PASSIVE, HUNGER_LOSS_MOVE, REGEN_RATE, REGEN_THRESHOLD, FALL_DAMAGE_THRESHOLD, FALL_DAMAGE_MULT } = CONFIG.GAMEPLAY;
        const { GRAVITY, GRAVITY_MULTIPLIER, WATER_DRAG, JUMP_FORCE, PLAYER_JUMP_FORCE, WALK_SPEED, FRICTION, PLAYER_WIDTH } = CONFIG.PHYSICS;
        const { MAX_COUNT, SPAWN_CHANCE, SPAWN_DIST_MIN, SPAWN_DIST_MAX, ZOMBIE_DETECTION_RANGE, ZOMBIE_SPEED, ZOMBIE_DAMAGE, WANDER_SPEED, CHICKEN_EGG_TIME_MIN, CHICKEN_EGG_TIME_MAX, SHEEP_WOOL_TIME_MIN, SHEEP_WOOL_TIME_MAX, WATER_AVOIDANCE_RADIUS , WEIGHT_COW, WEIGHT_PIG, WEIGHT_SHEEP, WEIGHT_CHICKEN } = CONFIG.MOBS;
        const MOB_JUMP_FORCE = 5.5; // Konstante für das Springen von Tieren/Zombies (ca. 1.5 Blöcke hoch bei g=9.8)

        // --- GAME STATE ---
        let camera, scene, renderer, controls, world, sun, sunGroup, ambient;
        let skyUniforms, skyMesh;
        // Spielstart auf Mittag setzen
        let time = DAY_DURATION * 0.45, prevTime = performance.now(), spawnTimer = 0;
        let collectedEggs = 0, collectedWool = 0;
        let lastBloodMoonRewardDay = -1;
        let pendingBloodMoonRewardDay = -1;
        let lastBloodMoonRewardRetry = 0;
        let storyObjectiveIndex = 0;
        let questState = createQuestState();
        let activeBloodMoonBoss = null;
        let bossEncounterCounter = 0;
        const velocity = new THREE.Vector3(), direction = new THREE.Vector3();
        const mobs = [];
        Game.droppedItems = [];
        const droppedItems = Game.droppedItems;
        let weatherSystem = null;  // Tier 3: Wetter-System (init nach World)
        let torchLightSystem = null;
        let damageFeedback = null;

        function applyPlayerDamage(damage) {
            if (damage <= 0) return;
            Game.player.health -= damage;
            damageFeedback.trigger(damage);
        }
        const npcs = [];            // Tier 3: NPC-Array
        window.npcs = npcs;
        window.getQuestState = () => questState;
        window.getQuestDayCount = () => Math.floor(time / DAY_DURATION);
        window.getHighestVillageTrust = () => Math.max(0, ...Object.values(questState.villages || {}).map(village => Number(village.trust) || 0));
        window.getCurrentStoryObjective = () => currentStoryObjective;
        window.getQuestNavigationContext = () => {
            const playerPosition = controls?.getObject?.()?.position || null;
            const villages = Object.values(questState.villages || {});
            const homeVillage = villages.find(village => village.id === questState.homeVillageId);
            const fallbackVillage = villages[0];
            let mainTarget = homeVillage?.center || fallbackVillage?.center || null;
            const desiredStructureKind = storyObjectiveIndex === 4 ? 'mine' : (storyObjectiveIndex >= 5 && storyObjectiveIndex <= 9 ? 'dungeon' : null);
            if (desiredStructureKind && playerPosition && world?.structures) {
                const nearestStructure = [...world.structures.values()]
                    .filter(structure => structure.kind === desiredStructureKind && Number.isFinite(structure.x) && Number.isFinite(structure.z))
                    .sort((first, second) => (
                        (first.x - playerPosition.x) ** 2 + (first.z - playerPosition.z) ** 2
                    ) - (
                        (second.x - playerPosition.x) ** 2 + (second.z - playerPosition.z) ** 2
                    ))[0];
                if (nearestStructure) {
                    mainTarget = {
                        x: nearestStructure.x,
                        z: nearestStructure.z,
                        discovered: storyObjectiveIndex > 5,
                        searchRadius: 90
                    };
                }
            }
            return {
                playerPosition,
                respawnBed,
                world,
                headingDegrees: camera?.rotation?.y ? camera.rotation.y * 180 / Math.PI : 0,
                mainTarget
            };
        };

        function resetBloodMoonEncounter() {
            if (!activeBloodMoonBoss) return;
            const encounterId = activeBloodMoonBoss.bossEncounterId;
            for (const mob of mobs) {
                if (mob === activeBloodMoonBoss || mob.bossEncounterId === encounterId) mob.isDead = true;
            }
            activeBloodMoonBoss = null;
            questState.storyFlags.bossActive = false;
        }

        function spawnBloodMoonBoss(position, echo = false) {
            const encounterId = `blood-moon:${++bossEncounterCounter}`;
            const summonMinions = (bossPosition, phase) => {
                const count = Math.min(3, phase);
                for (let index = 0; index < count; index++) {
                    const angle = index / count * Math.PI * 2;
                    const summon = new Mob(
                        scene,
                        phase >= 2 && index % 2 ? 'skeleton' : 'zombie',
                        bossPosition.x + Math.cos(angle) * 3,
                        bossPosition.y,
                        bossPosition.z + Math.sin(angle) * 3
                    );
                    summon.bossEncounterId = encounterId;
                    mobs.push(summon);
                }
            };
            const boss = new BloodMoonBoss(scene, new THREE.Vector3(position.x, position.y, position.z), {
                echo,
                onSummon: summonMinions,
                onDefeated: defeatedBoss => {
                    for (const mob of mobs) {
                        if (mob !== defeatedBoss && mob.bossEncounterId === encounterId) mob.isDead = true;
                    }
                    activeBloodMoonBoss = null;
                    questState.storyFlags.bossActive = false;
                    questState.storyFlags.bossDefeated = true;
                    window.dispatchEvent(new CustomEvent('butzcraft:quest-action', {
                        detail: { type: 'boss', bossType: defeatedBoss.type, count: 1 }
                    }));
                    window.dispatchEvent(new CustomEvent(STORY_EVENTS.BOSS_DEFEATED, {
                        detail: { echo: defeatedBoss.echo }
                    }));
                }
            });
            boss.bossEncounterId = encounterId;
            activeBloodMoonBoss = boss;
            questState.storyFlags.bossActive = true;
            mobs.push(boss);
            return boss;
        }

        window.tryActivateBloodMoonRitual = ({ position, structureId } = {}) => {
            updateStoryObjectiveFromTime();
            if (activeBloodMoonBoss && !activeBloodMoonBoss.isDead) {
                return { ok: false, message: 'Der Blutmondwächter ist bereits erwacht.' };
            }
            if (storyObjectiveIndex < 8) {
                return { ok: false, message: 'Der Ritualstein bleibt still.' };
            }
            if (!hasQuestItems(questState, { deepCrystal: 1, bloodSeal: 1 })) {
                return { ok: false, message: 'Tiefenkristall und Blutsiegel fehlen.' };
            }
            if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
                return { ok: false, message: 'Der Ritualort ist nicht mehr erreichbar.' };
            }
            if (storyObjectiveIndex === 8) handleStoryEvent(STORY_EVENTS.RITUAL_ACTIVATED);
            const echo = storyObjectiveIndex >= 10;
            questState.storyFlags.ritualSite = { structureId, position: { ...position } };
            spawnBloodMoonBoss(position, echo);
            return {
                ok: true,
                message: echo ? 'Ein Blutmondecho erhebt sich!' : 'Der Blutmondwächter erwacht!'
            };
        };
        const minecarts = [];
        const spawnedMinecartKeys = new Set();
        let activeMinecart = null;
        window.minecarts = minecarts;
        // Tier 3: Spawner-Tick-Timer auf Modul-Scope. WICHTIG nicht `this._spawnerTickTimer`
        // verwenden — `this` ist in einer Top-Level-Funktion innerhalb eines ES-Moduls `undefined`
        // (strict mode), und `this.x = 0` wirft TypeError. Das war der Grund, warum nach dem
        // Tier-3-Update die gesamte Steuerung blockiert war: animate() ist jeden Frame in dieser
        // Zeile abgestürzt, BEVOR `Game.player.updatePhysics(...)` aufgerufen werden konnte.
        let _spawnerTickTimer = 0;
        let _lastVisibleChunkX = null, _lastVisibleChunkZ = null, _lastVisibleRenderDist = null;
        
        
        let inventoryOpened = false;
        let gameActive = true, spawning = true, gameStarted = false, manuallyPaused = false;
        let currentSaveName = null;
        let respawnBed = null;
        const CHARACTER_PROFILE_STORAGE_KEY = 'butzcraft.characterProfile';
        const legacyCharacterProfile = readLegacyCharacterProfile();
        let activeCharacterProfile = legacyCharacterProfile;

        // Schwert & Animation

        let blockingOverlayElements = null;

        function isBlockingOverlayOpen() {
            if (isInventoryOpened()) return true;
            blockingOverlayElements ||= [
                document.getElementById('trade-overlay'),
                document.getElementById('furnace-overlay'),
                document.getElementById('chest-overlay')
            ];
            return blockingOverlayElements.some(el => el && el.style.display !== 'none');
        }

        function shouldUseTouchMode() {
            return Boolean(Game.touchActive) || isTouchDevice();
        }

        function readLegacyCharacterProfile() {
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

        function setActiveCharacterProfile(profile) {
            activeCharacterProfile = normalizeCharacterProfile(profile);
            if (Game.player?.setCharacterProfile) Game.player.setCharacterProfile(activeCharacterProfile);
            return activeCharacterProfile;
        }

        function initStartCharacterEditor() {
            const openButtons = document.querySelectorAll('[data-open-character-editor]');
            const overlay = document.getElementById('character-editor-overlay');
            const frame = document.getElementById('character-editor-frame');
            const applyBtn = document.getElementById('character-editor-apply');
            const closeBtn = document.getElementById('character-editor-close');
            if (!openButtons.length || !overlay || !frame || !applyBtn || !closeBtn) return;

            const send = (type, extra = {}) => {
                frame.contentWindow?.postMessage({ type, ...extra }, window.location.origin);
            };
            const close = () => {
                send('cancel');
                overlay.classList.remove('open');
                deactivateDialog(overlay);
            };
            const open = () => {
                overlay.classList.add('open');
                activateDialog(overlay, '#character-editor-close');
                if (frame.dataset.ready === 'true') send('load-profile', { profile: activeCharacterProfile });
            };
            const apply = () => {
                send('apply-profile');
            };

            frame.addEventListener('load', () => {
                frame.dataset.ready = 'true';
                if (overlay.classList.contains('open')) send('load-profile', { profile: activeCharacterProfile });
            });
            openButtons.forEach((button) => bindPress(button, open));
            bindPress(applyBtn, apply);
            bindPress(closeBtn, close);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            window.addEventListener('message', (event) => {
                if (event.origin !== window.location.origin || event.source !== frame.contentWindow || !event.data) return;
                if (event.data.type === 'editor-ready') {
                    frame.dataset.ready = 'true';
                    if (overlay.classList.contains('open')) send('load-profile', { profile: activeCharacterProfile });
                }
                if (event.data.type === 'apply-profile') {
                    setActiveCharacterProfile(event.data.profile);
                    overlay.classList.remove('open');
                    deactivateDialog(overlay);
                }
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
                    e.code === 'KeyE' || e.code === 'KeyJ' || e.code === 'KeyQ' || e.code === 'Tab' ||
                    (e.key >= '1' && e.key <= '8')
                )
            );
        }

        function relockControlsFromInput(e) {
            if (!isGameplayKey(e)) return;
            if (!gameStarted || manuallyPaused || isBlockingOverlayOpen()) return;
            if (!controls?.isLocked && !Game.touchActive) lockControlsForDesktop();
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
            if (!controls?.isLocked && !Game.touchActive) lockControlsForDesktop();
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
            return canUseMouseInteraction({
                gameStarted,
                gameActive,
                spawning,
                manuallyPaused,
                blockingOverlayOpen: isBlockingOverlayOpen()
            });
        };

        function showPauseMenu() {
            const inst = document.getElementById('instructions');
            if (!inst) return;
            document.body.classList.add('game-paused');
            inst.style.display = 'block';
            activateDialog(inst, '[data-resume-game]');
            if (typeof window.loadGamesList === 'function') window.loadGamesList();
        }

        function hidePauseMenu() {
            const inst = document.getElementById('instructions');
            document.body.classList.remove('game-paused');
            if (inst) {
                deactivateDialog(inst);
                inst.style.display = 'none';
            }
        }

        const CONTROLS_HINT_HIDE_MS = 8500;
        const OBJECTIVE_COMPLETION_MS = 1200;
        let controlsHintTimer = null;
        let objectiveCompletionTimer = null;
        let controlsHintShownForRun = false;
        let miniObjectiveIndex = 0;
        let currentMiniObjective = null;
        let currentStoryObjective = null;
        const OBJECTIVE_UPDATE_INTERVAL_MS = 100;
        let lastObjectiveUpdateAt = 0;

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
            const previousIndex = miniObjectiveIndex;
            const completedObjective = currentMiniObjective;
            const progress = getOnboardingProgress(inventorySlots, miniObjectiveIndex, { respawnSet: Boolean(respawnBed) });
            miniObjectiveIndex = progress.index;
            currentMiniObjective = progress.objective;
            return {
                advanced: progress.index > previousIndex,
                completedObjective
            };
        }

        function hideFirstObjective() {
            const el = document.getElementById('first-objective');
            if (!el) return;
            if (el.classList.contains('visible')) el.classList.remove('visible');
            if (el.getAttribute('aria-hidden') !== 'true') el.setAttribute('aria-hidden', 'true');
        }

        function showFirstObjective() {
            const el = document.getElementById('first-objective');
            const label = document.getElementById('first-objective-label');
            const step = document.getElementById('first-objective-step');
            const text = document.getElementById('first-objective-text');
            const hint = document.getElementById('first-objective-hint');
            const objective = currentMiniObjective || currentStoryObjective;
            if (!el || !label || !step || !text || !hint || !objective) return;
            const objectiveSource = currentMiniObjective ? 'onboarding' : 'story';
            const objectiveKey = `${objectiveSource}-${objective.step}`;
            const objectiveHint = shouldUseTouchMode() ? objective.touchHint : objective.hint;
            const needsRender = el.dataset.objectiveKey !== objectiveKey
                || el.classList.contains('complete')
                || hint.textContent !== objectiveHint;
            el.classList.remove('complete');
            if (needsRender) {
                label.textContent = objective.label;
                step.textContent = `Schritt ${objective.step} von ${objective.total}`;
                text.textContent = objective.text;
                hint.textContent = objectiveHint;
                updateObjectiveProgress(objective.step, objective.total);
                el.dataset.objectiveKey = objectiveKey;
            }
            if (!el.classList.contains('visible')) el.classList.add('visible');
            if (el.getAttribute('aria-hidden') !== 'false') el.setAttribute('aria-hidden', 'false');
        }

        function updateObjectiveProgress(completedSteps, totalSteps) {
            const segments = document.querySelectorAll('#first-objective-progress i');
            segments.forEach((segment, index) => {
                segment.classList.toggle('unused', index >= totalSteps);
                segment.classList.toggle('active', index < completedSteps);
            });
        }

        function updateInventoryObjective() {
            const el = document.getElementById('inventory-objective');
            const label = document.getElementById('inventory-objective-label');
            const step = document.getElementById('inventory-objective-step');
            const text = document.getElementById('inventory-objective-text');
            const hint = document.getElementById('inventory-objective-hint');
            const objective = currentMiniObjective || currentStoryObjective;
            if (!el || !label || !step || !text || !hint) return;

            if (!isInventoryOpened() || !objective) {
                el.classList.remove('visible');
                el.setAttribute('aria-hidden', 'true');
                return;
            }

            const objectiveSource = currentMiniObjective ? 'onboarding' : 'story';
            const objectiveKey = `${objectiveSource}-${objective.step}`;
            const objectiveHint = shouldUseTouchMode() ? objective.touchHint : objective.hint;
            if (el.dataset.objectiveKey !== objectiveKey || hint.textContent !== objectiveHint) {
                label.textContent = objective.label;
                step.textContent = `Schritt ${objective.step} von ${objective.total}`;
                text.textContent = objective.text;
                hint.textContent = objectiveHint;
                el.dataset.objectiveKey = objectiveKey;
            }
            el.classList.add('visible');
            el.setAttribute('aria-hidden', 'false');
        }

        function showObjectiveCompletion(objective) {
            const el = document.getElementById('first-objective');
            const label = document.getElementById('first-objective-label');
            const step = document.getElementById('first-objective-step');
            const text = document.getElementById('first-objective-text');
            const hint = document.getElementById('first-objective-hint');
            if (!el || !label || !step || !text || !hint) return;

            label.textContent = 'Geschafft';
            step.textContent = `Schritt ${objective.step} von ${objective.total}`;
            text.textContent = objective.text;
            hint.textContent = 'Nächstes Ziel kommt gleich.';
            updateObjectiveProgress(objective.step, objective.total);
            el.classList.add('complete', 'visible');
            el.setAttribute('aria-hidden', 'false');

            objectiveCompletionTimer = setTimeout(() => {
                objectiveCompletionTimer = null;
                el.classList.remove('complete');
                updateFirstObjective();
            }, OBJECTIVE_COMPLETION_MS);
        }

        function updateFirstObjective(force = true, now = performance.now()) {
            if (!force && now - lastObjectiveUpdateAt < OBJECTIVE_UPDATE_INTERVAL_MS) return;
            lastObjectiveUpdateAt = now;
            const { advanced, completedObjective } = advanceMiniObjective();
            updateStoryObjectiveFromTime();
            updateInventoryObjective();
            updateQuestCompass();
            const controlsHint = document.getElementById('controls-hint');
            const controlsHintVisible = controlsHint && controlsHint.classList.contains('visible');
            if (!gameStarted || spawning || manuallyPaused || isBlockingOverlayOpen() || controlsHintVisible) {
                hideFirstObjective();
                return;
            }
            if (objectiveCompletionTimer) return;
            if (advanced && completedObjective) {
                showObjectiveCompletion(completedObjective);
                return;
            }
            if (!currentMiniObjective && !currentStoryObjective) {
                hideFirstObjective();
                return;
            }
            showFirstObjective();
        }

        function updateStoryObjectiveFromTime() {
            const playerPosition = controls?.getObject?.()?.position || null;
            const progress = getStoryProgress(storyObjectiveIndex, {
                dayCount: Math.floor(time / DAY_DURATION),
                playerPosition,
                villages: world?.villages || []
            });
            storyObjectiveIndex = progress.index;
            questState.mainQuestIndex = storyObjectiveIndex;
            currentStoryObjective = progress.objective;
        }

        function handleStoryEvent(eventName) {
            updateStoryObjectiveFromTime();
            const nextIndex = advanceStoryProgress(storyObjectiveIndex, eventName);
            if (nextIndex === storyObjectiveIndex) return;
            storyObjectiveIndex = nextIndex;
            questState.mainQuestIndex = storyObjectiveIndex;
            updateStoryObjectiveFromTime();
            updateFirstObjective();
        }

        window.addEventListener(STORY_EVENTS.VILLAGER_MET, (event) => {
            const npc = event.detail?.npc;
            if (npc?.villageId) {
                const village = world?.villages?.find(candidate => getVillageId(candidate) === npc.villageId);
                if (village) ensureVillageState(questState, village, Math.floor(time / DAY_DURATION));
                if (!questState.homeVillageId) questState.homeVillageId = npc.villageId;
            }
            handleStoryEvent(STORY_EVENTS.VILLAGER_MET);
        });
        window.addEventListener(STORY_EVENTS.QUEST_COMPLETED, () => handleStoryEvent(STORY_EVENTS.QUEST_COMPLETED));
        window.addEventListener(STORY_EVENTS.BLOOD_MOON_SURVIVED, () => handleStoryEvent(STORY_EVENTS.BLOOD_MOON_SURVIVED));
        window.addEventListener(STORY_EVENTS.MINE_COMPLETED, () => {
            grantQuestItem(questState, 'deepCrystal');
            handleStoryEvent(STORY_EVENTS.MINE_COMPLETED);
        });
        window.addEventListener(STORY_EVENTS.DUNGEON_KEY_FOUND, () => handleStoryEvent(STORY_EVENTS.DUNGEON_KEY_FOUND));
        window.addEventListener(STORY_EVENTS.DUNGEON_GATE_OPENED, () => handleStoryEvent(STORY_EVENTS.DUNGEON_GATE_OPENED));
        window.addEventListener(STORY_EVENTS.DUNGEON_COMPLETED, (event) => {
            grantQuestItem(questState, 'bloodSeal');
            if (event.detail?.position) {
                questState.storyFlags.ritualSite = {
                    structureId: event.detail.structureId,
                    position: { ...event.detail.position }
                };
            }
            handleStoryEvent(STORY_EVENTS.DUNGEON_COMPLETED);
        });
        window.addEventListener(STORY_EVENTS.RITUAL_ACTIVATED, () => handleStoryEvent(STORY_EVENTS.RITUAL_ACTIVATED));
        window.addEventListener(STORY_EVENTS.BOSS_DEFEATED, () => handleStoryEvent(STORY_EVENTS.BOSS_DEFEATED));
        window.addEventListener('butzcraft:quest-action', (event) => {
            if (!event.detail) return;
            applyQuestEvent(questState, event.detail);
            updateFirstObjective();
        });

        function resetControlsHintForRun(restoredObjectiveIndex = 0, restoredStoryObjectiveIndex = 0) {
            controlsHintShownForRun = false;
            miniObjectiveIndex = restoredObjectiveIndex;
            storyObjectiveIndex = restoredStoryObjectiveIndex;
            currentMiniObjective = null;
            currentStoryObjective = null;
            if (objectiveCompletionTimer) {
                clearTimeout(objectiveCompletionTimer);
                objectiveCompletionTimer = null;
            }
            advanceMiniObjective();
            updateStoryObjectiveFromTime();
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
            if (window.playerInteraction) window.playerInteraction.cancelMining();
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

        async function fetchSaveJson(path) {
            const res = await fetch(apiUrl(path));
            return res.json();
        }

        const saveRepository = new SaveRepository({
            browserStore: {
                list: listBrowserSaves,
                load: loadBrowserSave,
                save: saveBrowserSave
            },
            fetchJson: fetchSaveJson,
            warn: (...args) => console.warn(...args)
        });

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

        const DROP_TTL = 90;
        const DROP_HARD_CAP = 150;

        function updateDroppedItems(items, delta, playerPos) {
            while (items.length > DROP_HARD_CAP) {
                disposeDroppedItem(items[0]);
                items.shift();
            }
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                const ip = item.mesh.position;
                item.age = (item.age || 0) + delta;
                if (item.age > DROP_TTL) {
                    disposeDroppedItem(item);
                    items.splice(i, 1);
                    continue;
                }

                item.velocityY -= 9.8 * delta;
                ip.y += item.velocityY * delta;
                const blockBelow = world.getBlock(Math.floor(ip.x), Math.floor(ip.y - 0.1), Math.floor(ip.z));
                if (blockBelow !== 0 && blockBelow !== 4 && blockBelow !== 8 && blockBelow !== 9 && item.velocityY < 0) {
                    ip.y = Math.floor(ip.y - 0.1) + 1.0;
                    item.velocityY = 0;
                }
                updateDroppedItemVisual(item, delta, graphicsPrototype.usesPainterlyTextures);

                const dx = ip.x - playerPos.x;
                const dz = ip.z - playerPos.z;
                if (dx * dx + dz * dz < 4 && Math.abs(ip.y - playerPos.y) < 2.5) {
                    tryCollectDroppedItem(items, i, disposeDroppedItem);
                }
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

        function spawnMinecart(data) {
            if (!data?.id || spawnedMinecartKeys.has(data.id)) return null;
            const minecart = new Minecart(scene, data);
            minecarts.push(minecart);
            spawnedMinecartKeys.add(data.id);
            return minecart;
        }

        function disposeMinecarts() {
            activeMinecart = null;
            while (minecarts.length > 0) minecarts.pop().dispose(scene);
            spawnedMinecartKeys.clear();
        }

        function exitActiveMinecart() {
            if (!activeMinecart) return false;
            const cart = activeMinecart;
            cart.hasRider = false;
            activeMinecart = null;

            const playerPosition = controls.getObject().position;
            const sideX = cart.direction.z;
            const sideZ = -cart.direction.x;
            playerPosition.set(
                cart.group.position.x + sideX * 1.15,
                cart.group.position.y + 1.58,
                cart.group.position.z + sideZ * 1.15
            );
            Game.player.velocity.set(0, 0, 0);
            window.playerInteraction?.showMessage('Lore verlassen.', '#ffe066', 18);
            return true;
        }

        function tryToggleMinecart() {
            if (activeMinecart) return exitActiveMinecart();
            if (!controls || !Game.player) return false;
            const playerPosition = controls.getObject().position;
            let nearest = null;
            let nearestDistance = 2.6;
            for (const minecart of minecarts) {
                const distance = minecart.group.position.distanceTo(playerPosition);
                if (distance < nearestDistance) {
                    nearest = minecart;
                    nearestDistance = distance;
                }
            }
            if (!nearest) return false;

            activeMinecart = nearest;
            nearest.hasRider = true;
            nearest.syncRider(playerPosition);
            Game.player.velocity.set(0, 0, 0);
            window.playerInteraction?.showMessage('Lore: W fahren, S bremsen, A/D Weiche, Q aussteigen.', '#ffe066', 18);
            return true;
        }

        function resetRuntimeForLoadedGame() {
            activeBloodMoonBoss = null;
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
            disposeMinecarts();
            _spawnedVillageKeys.clear();
            world.fireBlocks.clear();
            world.spawnerMeta = {};
            world.villages = [];
            world.structures.clear();
            world.structureChests.clear();
            world.structureGates.clear();
            world.structureAltars.clear();
            world.structureProgress = {};
        }

        window.startNewGame = function() {
            if (gameStarted) return;
            world.setGenerationVersion(2);
            setActiveCharacterProfile(activeCharacterProfile);
            document.getElementById('start-menu').style.display = 'none';
            document.body.classList.add('game-started');
            currentSaveName = null;
            respawnBed = null;
            questState = createQuestState();
            activeBloodMoonBoss = null;
            SoundManager.init();
            manuallyPaused = false;
            lockControlsForDesktop();
            hidePauseMenu();
            gameStarted = true;
            fpsTracker.reset(performance.now());
            resetControlsHintForRun();
            window.__butzcraftStartRequested = false;
        };
        window.__butzcraftStartFunctionReady = true;
        if (window.__butzcraftStartRequested && window.__butzcraftRefreshStartStatus) {
            window.__butzcraftRefreshStartStatus('Engine bereit. Welt wird vorbereitet...');
        }

        window.loadGame = function(name) {
            SoundManager.init();
            saveRepository.load(name)
                .then(async rawData => {
                    const worldgenNotice = getWorldGenerationLoadNotice(rawData, name);
                    if (worldgenNotice) {
                        try {
                            await saveRepository.save(worldgenNotice.backupName, rawData);
                            alert(worldgenNotice.message);
                        } catch (backupError) {
                            console.warn('[Save] Legacy-Backup konnte nicht angelegt werden:', backupError);
                            alert('Dieser Spielstand nutzt die alte Weltgenerierung. Das automatische Backup konnte nicht angelegt werden. Für die neuen großen Minen und Dungeons wird eine neue Welt empfohlen.');
                        }
                    }
                    const data = prepareSaveForLoad(rawData);
                    document.getElementById('start-menu').style.display = 'none';
                    document.body.classList.add('game-started');
                    lockControlsForDesktop();
                    gameStarted = true;
                    fpsTracker.reset(performance.now());
                    currentSaveName = name;
                    document.getElementById('save-input').value = name;

                    resetRuntimeForLoadedGame();
                    world.setGenerationVersion(data.worldGenerationVersion);
                    world.structureProgress = data.structureProgress || {};

                    const playerPos = camera.position;
                    playerPos.set(data.pos.x, data.pos.y, data.pos.z);
                    Game.player.health = data.health;
                    Game.player.hunger = data.hunger;
                    setActiveCharacterProfile(data.characterProfile || legacyCharacterProfile || createCharacterProfile());
                    Game.player.setThirdPersonCameraDistance(data.thirdPersonCamera?.distance);
                    time = data.time;
                    respawnBed = normalizeRespawnBed(data.respawnBed);
                    questState = normalizeQuestState(data.questState, data.storyObjectiveIndex);
                    questState.storyFlags.bossActive = false;
                    spawning = false;

                    // migrateSave liefert immer exakt 64 Slots und ersetzt damit den vorherigen Inventarstand vollständig.
                    data.inventory.forEach((item, i) => inventorySlots[i] = item);
                    resetControlsHintForRun(data.onboardingObjectiveIndex, questState.mainQuestIndex);
                    
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
                        for (const village of world.villages) {
                            _spawnedVillageKeys.add(`${village.cx},${village.cz}`);
                            refreshVillageOffers(questState, village, Math.floor(time / DAY_DURATION));
                        }

                        // Tier 3: NPCs wiederherstellen
                        // Bestehende NPCs entfernen
                        while (npcs.length > 0) {
                            const npc = npcs.pop();
                            npc.dispose();
                        }
                        if (data.npcs && Array.isArray(data.npcs)) {
                            for (const npcData of data.npcs) {
                                if (!npcData.isDead) {
                                    const npc = new NPC(scene, npcData.homeX, npcData.homeY, npcData.homeZ, npcData.professionIdx, {
                                        ...(npcData.schedule || {}),
                                        villageId: npcData.villageId,
                                        npcId: npcData.id,
                                        displayName: npcData.displayName,
                                        essential: npcData.isEssential
                                    });
                                    npc.group.position.set(npcData.x, npcData.y, npcData.z);
                                    npc.health = npcData.health;
                                    npc.isUnconscious = Boolean(npcData.isUnconscious);
                                    npcs.push(npc);
                                }
                            }
                        }
                        if (Array.isArray(data.keptAnimals)) {
                            for (const animalData of data.keptAnimals) {
                                const animal = new Mob(scene, animalData.type, animalData.x, animalData.y, animalData.z);
                                animal.health = animalData.health;
                                animal.isPenned = true;
                                mobs.push(animal);
                            }
                        }
                        if (Array.isArray(data.minecarts)) {
                            for (const minecartData of data.minecarts) spawnMinecart(minecartData);
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
            bossStatus: document.getElementById('boss-status'),
            bossStatusLabel: document.getElementById('boss-status-label'),
            bossStatusFill: document.getElementById('boss-status-fill'),
            worldTimeInfo: document.getElementById('world-time-info'),
            fpsSummary: document.getElementById('fps-summary'),
            stats: document.getElementById('stats'),
            gameOver: document.getElementById('game-over')
        };
        const UI_UPDATE_INTERVAL_MS = 100;
        const STATS_UPDATE_INTERVAL_MS = 250;
        let lastUiUpdateAt = 0;
        let lastStatsUpdateAt = 0;
        let lastStatsText = '';
        const fpsTracker = new FrameRateTracker(500);
        let debugHudVisible = false;

        function setDebugHudVisible(visible) {
            debugHudVisible = Boolean(visible);
            DOM.stats.classList.toggle('debug-visible', debugHudVisible);
            DOM.stats.setAttribute('aria-hidden', debugHudVisible ? 'false' : 'true');
        }

        function toggleDebugHud() {
            setDebugHudVisible(!debugHudVisible);
        }

        setDebugHudVisible(false);

        // --- SKY-COLOR CACHE (statt 8x new THREE.Color pro Frame) ---
        const SKY = {
            nightH: new THREE.Color().setHSL(0.64, 0.4, 0.18),
            nightZ: new THREE.Color().setHSL(0.64, 0.55, 0.08),
            sunriseH: new THREE.Color().setHSL(0.08, 0.8, 0.4),
            sunriseZ: new THREE.Color().setHSL(0.6, 0.5, 0.25),
            dayH: new THREE.Color().setHSL(0.55, 0.5, 0.7),
            dayZ: new THREE.Color().setHSL(0.58, 0.8, 0.45),
            bloodMoonH: new THREE.Color().setHSL(0.0, 0.8, 0.2),    // Blutmond-Horizont: dunkelrot
            bloodMoonZ: new THREE.Color().setHSL(0.02, 0.6, 0.08),  // Blutmond-Zenit: schwarz-rot
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
            const shouldAnnounceSurvival = pendingBloodMoonRewardDay !== dayCount;
            if (shouldAnnounceSurvival) {
                window.dispatchEvent(new CustomEvent(STORY_EVENTS.BLOOD_MOON_SURVIVED));
            }

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

        window.trySleepInBed = function(bedPosition) {
            const dayRatio = getDayRatio(time, DAY_DURATION);
            const dayCount = Math.floor(time / DAY_DURATION);
            const isBloodMoonNight = dayCount % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1);
            const playerPos = controls.getObject().position;
            const hostileNearby = mobs.some(m => (
                !m.isDead &&
                (m.type === 'zombie' || m.type === 'skeleton' || m.type === 'spider' || m.type === 'geist' || m.isBoss) &&
                m.group.position.distanceTo(playerPos) < 12
            ));
            const blockReason = getSleepBlockReason(dayRatio, isBloodMoonNight, hostileNearby);

            if (blockReason === 'day') return { ok: false, message: 'Du kannst nur nachts schlafen.' };
            if (blockReason === 'bloodMoon') return { ok: false, message: 'Der Blutmond laesst dich nicht schlafen.' };
            if (blockReason === 'hostile') return { ok: false, message: 'Monster sind zu nah.' };

            const safeRespawn = findSafeBedRespawn(world, bedPosition);
            if (!safeRespawn) return { ok: false, message: 'Raeume neben dem Bett einen sicheren Platz frei.' };

            time = getWakeTime(time, DAY_DURATION);
            respawnBed = normalizeRespawnBed(bedPosition);
            mobs.forEach(m => {
                if (m.type === 'zombie' || m.type === 'skeleton' || m.type === 'spider' || m.type === 'geist') m.isDead = true;
            });
            Game.player.health = Math.min(MAX_HEALTH, Game.player.health + 10);
            Game.player.hunger = Math.max(0, Game.player.hunger - 5);
            updateUI();
            return { ok: true, message: 'Gut geschlafen. Rueckkehrpunkt gesetzt.' };
        };

        function respawnAtBed() {
            const point = findSafeBedRespawn(world, respawnBed);
            if (!point) return false;

            resetBloodMoonEncounter();
            controls.getObject().position.set(point.x, point.y, point.z);
            Game.player.velocity.set(0, 0, 0);
            velocity.set(0, 0, 0);
            Game.player.health = MAX_HEALTH;
            Game.player.hunger = Math.max(50, Game.player.hunger);
            mobs.forEach(mob => {
                const hostile = mob.type === 'zombie' || mob.type === 'skeleton' || mob.type === 'spider' || mob.type === 'geist';
                if (hostile && !mob.isDead && mob.group.position.distanceTo(controls.getObject().position) < 8) mob.isDead = true;
            });
            gameActive = true;
            spawning = false;
            manuallyPaused = false;
            DOM.gameOver.style.display = 'none';
            updateVisibleChunksIfNeeded(controls.getObject().position, true);
            updateUI(true);
            lockControlsForDesktop();
            showSaveMessage('Am Bett wiederbelebt.', '#ffe066');
            return true;
        }

        async function startGame() {
            try {
                await preloadEntityMaterials();
                Input.init(isInventoryOpened);
                setupInventoryEvents();
                prepareInventoryUI();
                initQuestJournal();
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
        }
        startGame();

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

            ambient = new THREE.AmbientLight(0xffffff, 0.4); scene.add(ambient);
            sunGroup = new THREE.Group(); scene.add(sunGroup);
            sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(0, 50, 0); sunGroup.add(sun);

            const celestialGroup = new THREE.Group();
            scene.add(celestialGroup);
            
            const sunGeo = new THREE.CircleGeometry(30, 32);
            const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, fog: false, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
            const sunMesh = new THREE.Mesh(sunGeo, sunMat);
            sunMesh.position.set(0, 400, 0);
            celestialGroup.add(sunMesh);

            const moonGeo = new THREE.CircleGeometry(25, 32);
            const moonMat = new THREE.MeshBasicMaterial({ color: 0xdddddf, fog: false, transparent: true, side: THREE.DoubleSide });
            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.position.set(0, -400, 0);
            celestialGroup.add(moonMesh);

            const starsGeo = new THREE.BufferGeometry();
            const starsPos = [];
            for(let i=0; i<1500; i++) {
                const vec = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(400);
                starsPos.push(vec.x, vec.y, vec.z);
            }
            starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
            const starsMat = new THREE.PointsMaterial({color: 0xffffff, size: 2.0, transparent: true, opacity: 0, fog: false});
            const starsMesh = new THREE.Points(starsGeo, starsMat);
            scene.add(starsMesh);

            renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
            renderer.domElement.id = 'game-canvas';
            const DEFAULT_RENDER_SCALE = 1;
            let renderScale = DEFAULT_RENDER_SCALE;
            const applyRendererResolution = () => {
                renderer.setPixelRatio(calculateRenderPixelRatio(
                    window.innerWidth,
                    window.innerHeight,
                    window.devicePixelRatio || 1,
                    renderScale
                ));
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            applyRendererResolution();
            document.body.appendChild(renderer.domElement);
            damageFeedback = new DamageFeedback(renderer.domElement);

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

            Game.player = new Player(scene, camera, document.body, CONFIG, activeCharacterProfile, renderer.domElement);
            controls = Game.player.controls;

            // Sicherheits-Reset: Falls aus einem früheren Sprint-5-Bug-Run noch ein roll-Drift
            // in der Camera-Quaternion saß (Sprint 5 setzte camera.rotation.z direkt), hier
            // einmalig komplett aufräumen. PointerLockControls würde sonst den Drift via
            // Quaternion-Roundtrip beim ersten Mausbewegen reaktivieren.
            camera.rotation.set(0, 0, 0);
            camera.quaternion.setFromEuler(camera.rotation);
            // Start-Button Event-Listener
            const startBtn = document.getElementById('start-button');
            bindPress(startBtn, () => {
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
                restartBtn.addEventListener('click', () => {
                    if (!respawnAtBed()) window.location.reload();
                });
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
            torchLightSystem = new TorchLightSystem(scene);

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
                const villageId = getVillageId(vInfo);
                ensureVillageState(questState, vInfo, Math.floor(time / DAY_DURATION));
                const protectedProfessions = new Set();
                for (const [houseIndex, house] of vInfo.houses.entries()) {
                    const residentCount = Math.max(1, house.residentCount || 1);
                    for (let resident = 0; resident < residentCount; resident++) {
                        const offset = residentCount > 1 ? (resident === 0 ? -0.25 : 0.25) : 0;
                        const professionIdx = (house.professionIdx + resident) % 4;
                        const identity = getNpcIdentity(villageId, professionIdx, houseIndex * 2 + resident);
                        const essential = !protectedProfessions.has(professionIdx);
                        if (essential) protectedProfessions.add(professionIdx);
                        const npc = new NPC(scene, house.x + offset, house.y, house.z, professionIdx, {
                            home: house.home,
                            door: house.door,
                            porch: house.porch,
                            work: house.work,
                            waypoints: vInfo.waypoints,
                            villageId,
                            npcId: identity.id,
                            displayName: identity.name,
                            essential
                        });
                        npcs.push(npc);
                    }
                }
            });

            window.addEventListener('minecartGenerated', (e) => {
                spawnMinecart(e.detail);
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
                applyRendererResolution();
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

            if (window.playerInteraction && typeof window.playerInteraction.destroy === 'function') {
                window.playerInteraction.destroy();
            }
            window.playerInteraction = new PlayerInteraction(camera, scene, world, mobs, SoundManager, {
                getSelectedSlot: getSelectedSlot,
                getInventorySlots: () => inventorySlots,
                addItemToInventory: addItemToInventoryOrDrop,
                updateInventoryUI: updateInventoryUI,
                updateUI: updateUI,
                openWorkbenchCrafting: () => openWorkbenchCrafting(gameStarted, spawning, controls)
            });
            window.playerInteractions = window.playerInteraction; // Alias für Backwards-Compat
            window.playerInteraction.init(controls, () => gameActive, () => spawning);

            // Touch-Controls: nur auf Touch-Devices aktiv. Setzt Game.touchActive=true,
            // damit der PointerLock-Pause-Mechanismus übersprungen wird.
            initTouchControls({
                camera,
                controls,
                player: Game.player,
                isInventoryOpenedProvider: isInventoryOpened,
                isPausedProvider: () => manuallyPaused,
                pauseGame: window.pauseGame,
                resumeGame: window.resumeGame
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

                const furnaceOverlay = document.getElementById('furnace-overlay');
                const chestOverlay = document.getElementById('chest-overlay');
                const tradeOverlay = document.getElementById('trade-overlay');
                const stationOverlayOpen =
                    Boolean(furnaceOverlay && furnaceOverlay.style.display !== 'none') ||
                    Boolean(chestOverlay && chestOverlay.style.display !== 'none') ||
                    Boolean(tradeOverlay && tradeOverlay.style.display !== 'none');
                if (
                    e.code === 'KeyQ' && !e.repeat && !manuallyPaused &&
                    !isInventoryOpened() && !stationOverlayOpen && tryToggleMinecart()
                ) {
                    if (e.cancelable) e.preventDefault();
                    return;
                }
                const uiCommand = resolveUiInputCommand({
                    code: e.code,
                    inventoryOpen: isInventoryOpened(),
                    furnaceOpen: Boolean(furnaceOverlay && furnaceOverlay.style.display !== 'none'),
                    chestOpen: Boolean(chestOverlay && chestOverlay.style.display !== 'none'),
                    tradeOpen: Boolean(tradeOverlay && tradeOverlay.style.display !== 'none'),
                    paused: manuallyPaused
                });
                if (uiCommand) {
                    if (uiCommand === 'close-inventory' || uiCommand === 'toggle-inventory') {
                        if (window.playerInteraction) window.playerInteraction.cancelMining();
                        toggleInventory(gameStarted, spawning, controls);
                    } else if (uiCommand === 'open-journal') {
                        if (!isInventoryOpened()) toggleInventory(gameStarted, spawning, controls);
                        showInventoryPanel('quests');
                    } else if (uiCommand === 'close-furnace') {
                        window.closeFurnace && window.closeFurnace();
                    } else if (uiCommand === 'close-chest') {
                        window.closeChest && window.closeChest();
                    } else if (uiCommand === 'close-trade') {
                        closeTradeUI(controls);
                    } else if (uiCommand === 'resume') {
                        window.resumeGame();
                    } else if (uiCommand === 'pause') {
                        window.pauseGame();
                    }
                    return;
                }

                relockControlsFromInput(e);
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
                applyRendererResolution();
            });
            Game.world = world;
            Game.renderer = renderer;
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
            const active = gameStarted && gameActive && !manuallyPaused && !spawning;
            const sample = fpsTracker.record(now, active);
            if (!sample) return;
            DOM.fpsSummary.textContent = `FPS · Aktuell ${sample.current} · Min ${sample.min} · Max ${sample.max}`;
            DOM.fpsSummary.setAttribute('aria-label', `FPS: Aktuell ${sample.current}, Minimum ${sample.min}, Maximum ${sample.max}`);
        }

        function updateUI(force = true, now = performance.now()) {
            if (force || now - lastUiUpdateAt >= UI_UPDATE_INTERVAL_MS) {
                lastUiUpdateAt = now;
                DOM.healthFill.style.width = Math.max(0, Game.player.health) + '%';
                DOM.hungerFill.style.width = Math.max(0, Game.player.hunger) + '%';
                if (DOM.bossStatus) {
                    const bossVisible = activeBloodMoonBoss && !activeBloodMoonBoss.isDead;
                    DOM.bossStatus.hidden = !bossVisible;
                    if (bossVisible) {
                        DOM.bossStatusLabel.textContent = activeBloodMoonBoss.echo ? 'Blutmondecho' : 'Blutmondwächter';
                        DOM.bossStatusFill.style.width = `${Math.max(0, activeBloodMoonBoss.health / activeBloodMoonBoss.maxHealth * 100)}%`;
                    }
                }
                const tm = Math.floor((time / DAY_DURATION) * 1440), hh = Math.floor(tm / 60) % 24, mm = tm % 60, dd = Math.floor(time / DAY_DURATION) + 1;
                const dayRatioUI = (isNaN(time) || DAY_DURATION <= 0) ? 0.45 : (time % DAY_DURATION) / DAY_DURATION;
                const dayCountUI = Math.floor(time / DAY_DURATION);
                const isBloodMoonUI = dayCountUI % BLOOD_MOON_INTERVAL === (BLOOD_MOON_INTERVAL - 1);
                const bloodMoonWarning = isBloodMoonUI && dayRatioUI > 0.65 && dayRatioUI <= 0.80 ? ' | \u{1F534} Blutmond!' : '';
                const bloodMoonActive = isBloodMoonUI && (dayRatioUI > 0.80 || dayRatioUI < 0.20) ? ' | \u{1F7E5} BLUTMOND' : '';
                DOM.worldTimeInfo.textContent = `Tag ${dd} | ${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}${bloodMoonWarning}${bloodMoonActive}`;
            }
            if (Game.player.health <= 0 && gameActive && !spawning) {
                gameActive = false;
                controls.unlock();
                hideFirstObjective();
                const restartBtn = document.getElementById('game-over-restart');
                if (restartBtn) restartBtn.textContent = findSafeBedRespawn(world, respawnBed)
                    ? 'Am Bett wiederbeleben'
                    : 'Neu starten';
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
            saveRepository.list()
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
            damageFeedback.update();

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
            const skyInty = getSkyLightIntensity(dayRatio);
            if (dayRatio >= 0.20 && dayRatio < 0.25) {
                const f = (dayRatio - 0.20) / 0.05; SKY.hColor.lerpColors(nightH, SKY.sunriseH, f); SKY.zColor.lerpColors(nightZ, SKY.sunriseZ, f);
            } else if (dayRatio >= 0.25 && dayRatio < 0.30) {
                const f = (dayRatio - 0.25) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, SKY.dayH, f); SKY.zColor.lerpColors(SKY.sunriseZ, SKY.dayZ, f);
            } else if (dayRatio >= 0.30 && dayRatio <= 0.70) {
                SKY.hColor.copy(SKY.dayH); SKY.zColor.copy(SKY.dayZ);
            } else if (dayRatio > 0.70 && dayRatio <= 0.75) {
                const f = (dayRatio - 0.70) / 0.05; SKY.hColor.lerpColors(SKY.dayH, SKY.sunriseH, f); SKY.zColor.lerpColors(SKY.dayZ, SKY.sunriseZ, f);
            } else if (dayRatio > 0.75 && dayRatio <= 0.80) {
                const f = (dayRatio - 0.75) / 0.05; SKY.hColor.lerpColors(SKY.sunriseH, nightH, f); SKY.zColor.lerpColors(SKY.sunriseZ, nightZ, f);
            } else { SKY.hColor.copy(nightH); SKY.zColor.copy(nightZ); }
            sun.intensity = skyInty;
            if (ambient?.userData.painterlyDayIntensity !== undefined) {
                ambient.intensity = getAmbientLightIntensity(
                    skyInty,
                    ambient.userData.painterlyNightIntensity,
                    ambient.userData.painterlyDayIntensity
                );
            }

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
            updateFirstObjective(false, now);

            // 4. SIMULATION (Nur wenn nicht pausiert)
            // Fix: Während spawning=true pausieren wir niemals automatisch
            // Touch-Mode kennt keinen PointerLock — touchActive zählt als "im Spiel aktiv".
            const isPaused = !gameStarted || manuallyPaused || (!spawning && isBlockingOverlayOpen());
            if (!isPaused) {
                const previousDayCount = Math.floor(time / DAY_DURATION);
                time += delta * getDayCycleSpeed(dayRatio);
                const currentDayCount = Math.floor(time / DAY_DURATION);
                if (currentDayCount > previousDayCount) {
                    grantBloodMoonReward(previousDayCount);
                    for (const village of world.villages || []) {
                        const villageId = getVillageId(village);
                        if (villageId && questState.villages?.[villageId]) {
                            refreshVillageOffers(questState, village, currentDayCount);
                        }
                    }
                }
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
                            if (!controls.isLocked && !Game.touchActive) lockControlsForDesktop();
                        }
                    }
                }
                showControlsHintOnceReady();

                const heldItemType = inventorySlots[getSelectedSlot()]?.type || 0;
                mobs.forEach(m => {
                    if ((dayRatio < 0.25 || dayRatio > 0.75) === false && (m.type === 'zombie' || m.type === 'skeleton')) m.isDead = true;
                    else m.update(delta, playerPos, world, applyPlayerDamage, dayRatio, now, heldItemType);
                });
                for (let i = mobs.length - 1; i >= 0; i--) {
                    if (mobs[i].isDead) {
                        if (typeof mobs[i].dispose === 'function') mobs[i].dispose();
                        else scene.remove(mobs[i].group);
                        mobs.splice(i, 1);
                    }
                }
                updateProjectiles(delta, playerPos, world, applyPlayerDamage);

                // Tier 3: NPC-Update
                for (let i = npcs.length - 1; i >= 0; i--) {
                    const npc = npcs[i];
                    if (npc.isDead) {
                        npc.dispose();
                        npcs.splice(i, 1);
                    } else {
                        npc.update(delta, playerPos, world, dayRatio);
                    }
                }

                // --- Mob Spawning (optimiert: eine Schleife statt 3x filter) ---
                let landMobsCount = 0, waterMobsCount = 0, geistCount = 0, parrotCount = 0;
                for (let i = 0; i < mobs.length; i++) {
                    if (mobs[i].isDead) continue;
                    if (mobs[i].type === 'fish' || mobs[i].type === 'octopus' || mobs[i].type === 'turtle') waterMobsCount++;
                    else if (mobs[i].type === 'geist') geistCount++;
                    else if (mobs[i].type === 'parrot') parrotCount++;
                    else if (!mobs[i].isPenned) landMobsCount++;
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
                updateDroppedItems(droppedItems, delta, playerPos);

                // PLAYER PHYSICS / MINECART
                for (const minecart of minecarts) minecart.update(delta, Input, world);
                if (activeMinecart) {
                    activeMinecart.syncRider(playerPos);
                    Game.player.velocity.set(0, 0, 0);
                } else {
                    Game.player.updatePhysics(delta, Input, world, SoundManager);
                }
                Game.player.hunger -= HUNGER_LOSS_PASSIVE * delta; if (Game.player.hunger <= 0) { Game.player.hunger = 0; Game.player.health -= 2 * delta; }
                if (Game.player.hunger > REGEN_THRESHOLD && Game.player.health < MAX_HEALTH) Game.player.health += REGEN_RATE * delta;

                // Druckplatten-Schaden
                if (window.playerInteraction) window.playerInteraction.checkPressurePlates(playerPos.x, playerPos.y, playerPos.z);
                if (window.playerInteraction) window.playerInteraction.updateMining(delta);
                if (window.playerInteraction) window.playerInteraction.updateCombat();
                if (window.playerInteraction) window.playerInteraction.updateRanged(delta);
            }

            // Ofen-Tick (auch wenn pausiert, solange UI offen)
            tickFurnace(controls);

            updateVisibleChunksIfNeeded(playerPos);
            world.processPendingMeshResults();
            const selectedItem = inventorySlots[getSelectedSlot()];
            Game.player.updateHeldTorch(Boolean(selectedItem && selectedItem.count > 0 && selectedItem.type === TORCH_TYPE));
            torchLightSystem.update(delta, world.torchKeys, world.fireLightKeys, playerPos);
            Game.player.updateSword(delta);
            Game.player.updateCharacterModel(delta);


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

            saveRepository.list()
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
                storyObjectiveIndex: storyObjectiveIndex,
                respawnBed: respawnBed,
                modifiedBlocks: world.modifiedBlocks,
                blockMeta: world.blockMeta,
                chestContents: world.chestContents,
                lootedChests: [...world.lootedChests],
                // Tier 3: Wetter + Feuer + Dörfer + NPCs persistieren
                weather: weatherSystem ? weatherSystem.serialize() : null,
                fireBlocks: weatherSystem ? weatherSystem.saveFireBlocks() : {},
                villages: world.villages || [],
                npcs: npcs.filter(n => !n.isDead).map(n => n.serialize()),
                keptAnimals: mobs.filter(m => !m.isDead && m.isPenned).map(m => m.serialize()),
                minecarts: minecarts.map(minecart => minecart.serialize()),
                worldGenerationVersion: world.worldGenerationVersion,
                structureProgress: world.structureProgress,
                questState: questState,
                characterProfile: normalizeCharacterProfile(activeCharacterProfile),
                thirdPersonCamera: { distance: Game.player.getThirdPersonCameraDistance() }
            });
            
            if (!isValidSaveName(name)) {
                alert("Ungueltiger Name. Erlaubt sind Buchstaben, Zahlen, Leerzeichen, _ und -.");
                return;
            }

            saveRepository.save(name, gameData)
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
            saveRepository.load(name)
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
                    saveRepository.save(save.name, save.gameData)
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
