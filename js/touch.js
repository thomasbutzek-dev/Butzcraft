/* js/touch.js - Touch-Controls für Mobilgeräte
 *
 * Architektur:
 *  - Wird beim Spielstart aufgerufen. Bei Nicht-Touch-Devices ist es ein No-Op.
 *  - Steuerkreuz (links): mappt eindeutig auf Input.moveF/B/L/R
 *  - Look-Bereich (rechte Bildschirmhälfte ohne Buttons): swipt → camera/controls Rotation
 *  - SPRINGEN kombiniert Sprung und Blicksteuerung, BAUEN nutzt mousedown button=2
 *  - Kurzer Tap in den Look-Bereich: ABBAUEN/Angreifen (mousedown button=0)
 *
 *  PointerLock funktioniert auf iOS/Android nicht (kein API-Support) → wir setzen
 *  Game.touchActive=true, und PlayerInteraction sowie der Pause-Check ignorieren
 *  controls.isLocked, wenn touchActive gesetzt ist.
 *
 *  Look-Empfindlichkeit: 0.005 rad pro Pixel — Daumen-tauglich, nicht wackelig.
 */

import { Input } from './Input.js?v=20260731a';
import { Game } from './Game.js?v=20260716b';

const LOOK_SENSITIVITY = 0.005;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const TAP_MAX_MOVE_PX = 10;
const MINE_HOLD_MOVE_PX = 24;
const TAP_MAX_MS = 260;
const MINE_HOLD_DELAY_MS = 180;

export function isTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

export function applyTouchLookDelta(ctx, dx, dy) {
    if (ctx?.player?.cameraMode === 'third' && typeof ctx.player.adjustThirdPersonOrbit === 'function') {
        ctx.player.adjustThirdPersonOrbit(-dx * LOOK_SENSITIVITY, -dy * LOOK_SENSITIVITY);
        return;
    }
    const camera = ctx && ctx.camera;
    if (!camera || !camera.rotation) return;

    const yawObj = ctx.controls && ctx.controls.getObject ? ctx.controls.getObject() : null;
    const yawTarget = yawObj && yawObj.rotation && yawObj !== camera ? yawObj : camera;

    if (camera.rotation.order !== undefined) camera.rotation.order = 'YXZ';
    if (yawTarget.rotation.order !== undefined) yawTarget.rotation.order = 'YXZ';

    yawTarget.rotation.y -= dx * LOOK_SENSITIVITY;
    camera.rotation.x -= dy * LOOK_SENSITIVITY;

    if (camera.rotation.x > PITCH_LIMIT) camera.rotation.x = PITCH_LIMIT;
    if (camera.rotation.x < -PITCH_LIMIT) camera.rotation.x = -PITCH_LIMIT;

    // Mobile darf nur Yaw + Pitch erzeugen. Roll/Seitwaerts-Kippen war auf
    // Desktop nie vorgesehen und fuehlt sich wie ein verdrehter Charakter an.
    if ('z' in camera.rotation) camera.rotation.z = 0;
    if (yawTarget !== camera && 'z' in yawTarget.rotation) yawTarget.rotation.z = 0;

    if (camera.quaternion && typeof camera.quaternion.setFromEuler === 'function') {
        camera.quaternion.setFromEuler(camera.rotation);
    }
    if (yawTarget !== camera && yawTarget.quaternion && typeof yawTarget.quaternion.setFromEuler === 'function') {
        yawTarget.quaternion.setFromEuler(yawTarget.rotation);
    }
}

function pressTouchJump() {
    Input.touchJumpQueued = true;
    Input.touchJumpHeld = true;
}

function releaseTouchJump(cancelled = false) {
    Input.touchJumpHeld = false;
    if (cancelled) Input.touchJumpQueued = false;
}

/**
 * Initialisiert Touch-UI. Idempotent (mehrfache Aufrufe sind sicher).
 * @param {object} ctx - { camera, controls, player, toggleCameraMode, isInventoryOpenedProvider }
 *
 * Mobile HUD:
 *   ⛶  Vollbild erneut anfordern, wenn der Browser es beendet hat
 *   ⏸  Pause/Menü oben rechts
 *   📦 Inventar und Q Questjournal oben
 *   Steuerkreuz links: exakt eine Laufrichtung, ohne Zusatzbelegung
 *   ▣  Block platzieren rechts unten
 *   ⤒  Springen unten rechts; nur dort beginnen, Ziehen steuert den Blick
 *   Tap im Look-Bereich: Block abbauen / Mob angreifen
 */
export function initTouchControls(ctx) {
    if (!isTouchDevice()) return;
    if (document.getElementById('touch-overlay')) return; // schon initialisiert

    Game.touchActive = true;
    document.documentElement.classList.add('touch-device');
    document.body.classList.add('touch-device');

    const overlay = document.createElement('div');
    overlay.id = 'touch-overlay';
    overlay.innerHTML = `
        <div id="touch-dpad" role="group" aria-label="Bewegung">
            <button id="touch-dpad-up" class="touch-dpad-btn" data-direction="forward" aria-label="Vorwärts">▲</button>
            <button id="touch-dpad-left" class="touch-dpad-btn" data-direction="left" aria-label="Links">◀</button>
            <span id="touch-dpad-center" aria-hidden="true"></span>
            <button id="touch-dpad-right" class="touch-dpad-btn" data-direction="right" aria-label="Rechts">▶</button>
            <button id="touch-dpad-down" class="touch-dpad-btn" data-direction="backward" aria-label="Rückwärts">▼</button>
        </div>
        <div id="touch-look-area"></div>
        <div id="touch-top-actions">
            <button id="touch-btn-fullscreen" class="touch-btn touch-btn-small" aria-label="Vollbild aktivieren">⛶</button>
            <button id="touch-btn-camera" class="touch-btn touch-btn-small" aria-label="Zu Third Person wechseln">3P</button>
            <button id="touch-btn-inv" class="touch-btn touch-btn-small" aria-label="Inventar">📦</button>
            <button id="touch-btn-journal" class="touch-btn touch-btn-small" aria-label="Questjournal">Q</button>
            <button id="touch-btn-pause" class="touch-btn touch-btn-small" aria-label="Pause">⏸</button>
        </div>
        <div id="touch-button-stack">
            <button id="touch-btn-place" class="touch-btn" aria-label="Bauen">▣</button>
            <button id="touch-btn-jump" class="touch-btn touch-btn-primary" aria-label="Springen">⤒</button>
        </div>
    `;
    document.body.appendChild(overlay);

    _injectTouchStyles();
    _bindDpad();
    _bindLookArea(ctx);
    _bindActionButtons(ctx);
}

function _injectTouchStyles() {
    const css = `
        #touch-overlay {
            position: fixed; inset: 0; z-index: 500;
            pointer-events: none;
            user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
            --touch-safe-bottom: max(16px, env(safe-area-inset-bottom));
            --touch-safe-left: max(16px, env(safe-area-inset-left));
            --touch-safe-right: max(24px, env(safe-area-inset-right));
            --touch-safe-top: max(16px, env(safe-area-inset-top));
            --touch-look-bottom: 128px;
        }
        #touch-dpad {
            position: absolute;
            left: var(--touch-safe-left);
            bottom: var(--touch-safe-bottom);
            width: clamp(126px, 20vw, 150px);
            height: clamp(126px, 20vw, 150px);
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(3, 1fr);
            pointer-events: none;
            touch-action: none;
        }
        .touch-dpad-btn {
            width: 100%; height: 100%;
            padding: 0;
            background: rgba(255,255,255,0.18);
            border: 2px solid rgba(255,255,255,0.48);
            border-radius: 11px;
            color: white;
            font-size: clamp(20px, 4vw, 26px);
            line-height: 1;
            pointer-events: auto;
            touch-action: none;
            -webkit-tap-highlight-color: transparent;
        }
        .touch-dpad-btn.is-active,
        .touch-dpad-btn:active { background: rgba(255,255,255,0.42); }
        #touch-dpad-up { grid-column: 2; grid-row: 1; }
        #touch-dpad-left { grid-column: 1; grid-row: 2; }
        #touch-dpad-center {
            grid-column: 2; grid-row: 2;
            margin: 5px;
            border-radius: 8px;
            background: rgba(255,255,255,0.10);
            border: 1px solid rgba(255,255,255,0.24);
            pointer-events: none;
        }
        #touch-dpad-right { grid-column: 3; grid-row: 2; }
        #touch-dpad-down { grid-column: 2; grid-row: 3; }
        #touch-look-area {
            position: absolute; right: 0; top: 0; bottom: var(--touch-look-bottom);
            width: 58%;
            pointer-events: auto;
            touch-action: none;
        }
        #touch-top-actions {
            position: absolute;
            top: var(--touch-safe-top);
            right: var(--touch-safe-right);
            display: flex;
            gap: clamp(5px, 1vw, 9px);
            width: auto;
            height: clamp(42px, 7vw, 54px);
            pointer-events: auto;
        }
        #touch-top-actions .touch-btn {
            width: clamp(42px, 7vw, 54px);
            flex: 0 0 clamp(42px, 7vw, 54px);
        }
        #touch-btn-fullscreen[hidden] { display: none; }
        #touch-button-stack {
            position: absolute;
            right: var(--touch-safe-right);
            bottom: var(--touch-safe-bottom);
            display: grid;
            grid-template-columns: clamp(78px, 12vw, 92px);
            grid-template-rows: clamp(48px, 8vw, 58px) clamp(78px, 12vw, 92px);
            gap: clamp(8px, 1.5vw, 12px);
            align-items: center;
            justify-items: center;
            pointer-events: auto;
        }
        .touch-btn {
            width: 100%; height: 100%;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            border: 2px solid rgba(255,255,255,0.45);
            color: white;
            font-size: clamp(18px, 4vw, 24px);
            font-weight: bold;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        .touch-btn-small { font-size: clamp(15px, 3vw, 18px); opacity: 0.85; }
        .touch-btn-primary {
            background: rgba(255,255,255,0.26);
            border-color: rgba(255,255,255,0.7);
            font-size: clamp(22px, 5vw, 28px);
        }
        .touch-btn:active { background: rgba(255,255,255,0.4); }
        #touch-btn-place {
            grid-column: 1; grid-row: 1;
            width: 82%; height: 82%;
        }
        #touch-btn-jump { grid-column: 1; grid-row: 2; touch-action: none; }
        @media (orientation: portrait) and (max-width: 560px) {
            #touch-overlay {
                --touch-look-bottom: 150px;
            }
            #touch-button-stack {
                grid-template-columns: 84px;
                grid-template-rows: 52px 84px;
            }
            #touch-dpad {
                width: 132px;
                height: 132px;
            }
        }
        @media (orientation: landscape) and (max-height: 460px) {
            #touch-overlay {
                --touch-look-bottom: 104px;
            }
            #touch-button-stack {
                grid-template-columns: 84px;
                grid-template-rows: 46px 84px;
            }
            #touch-top-actions {
                width: auto;
                height: 44px;
            }
            #touch-top-actions .touch-btn {
                width: 44px;
                flex-basis: 44px;
            }
            #touch-dpad {
                width: 120px;
                height: 120px;
            }
        }
        /* Bei Desktop-Browsern ist Touch-UI versteckt (Erkennung über CSS-Media falls JS-Detection irrt) */
        @media (hover: hover) and (pointer: fine) {
            #touch-overlay { display: none; }
        }
    `;
    const style = document.createElement('style');
    style.id = 'touch-controls-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

function _dispatchInteraction(button, type = 'mousedown') {
    const evt = new MouseEvent(type, {
        button,
        buttons: button === 2 ? 2 : 1,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(evt);
}

function _bindDpad() {
    const dpad = document.getElementById('touch-dpad');
    const buttons = [...dpad.querySelectorAll('[data-direction]')];
    let activeId = null;

    const reset = () => {
        Input.moveF = Input.moveB = Input.moveL = Input.moveR = false;
        Input.sprint = false;
        buttons.forEach((button) => button.classList.remove('is-active'));
        activeId = null;
    };

    const activate = (button) => {
        Input.moveF = Input.moveB = Input.moveL = Input.moveR = false;
        Input.sprint = false;
        buttons.forEach((candidate) => candidate.classList.toggle('is-active', candidate === button));
        const direction = button.dataset.direction;
        if (direction === 'forward') Input.moveF = true;
        if (direction === 'backward') Input.moveB = true;
        if (direction === 'left') Input.moveL = true;
        if (direction === 'right') Input.moveR = true;
    };

    const endHandler = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === activeId) { reset(); break; }
        }
    };

    buttons.forEach((button) => {
        button.addEventListener('touchstart', (e) => {
            if (activeId !== null) return;
            e.preventDefault();
            activeId = e.changedTouches[0].identifier;
            activate(button);
        }, { passive: false });
        button.addEventListener('touchend', endHandler);
        button.addEventListener('touchcancel', endHandler);
    });
}

function _bindLookArea(ctx) {
    const area = document.getElementById('touch-look-area');
    let activeId = null;
    let lastX = 0, lastY = 0;
    let startX = 0, startY = 0, startTime = 0;
    let moved = false;
    let miningCancelled = false;
    let miningStarted = false;
    let miningTimer = null;
    let pinching = false;
    let pinchDistance = 0;

    const distanceBetween = (touches) => Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );

    const stopMining = () => {
        if (miningTimer) {
            clearTimeout(miningTimer);
            miningTimer = null;
        }
        if (miningStarted) {
            _dispatchInteraction(0, 'mouseup');
            miningStarted = false;
        }
    };

    area.addEventListener('touchstart', (e) => {
        // Ignorieren, wenn Inventar offen
        if (ctx.isInventoryOpenedProvider && ctx.isInventoryOpenedProvider()) return;
        if (activeId !== null) {
            if (e.touches.length >= 2) {
                e.preventDefault();
                pinching = true;
                moved = true;
                miningCancelled = true;
                pinchDistance = distanceBetween(e.touches);
                stopMining();
            }
            return;
        }
        const t = e.changedTouches[0];
        activeId = t.identifier;
        lastX = startX = t.clientX;
        lastY = startY = t.clientY;
        startTime = performance.now();
        moved = false;
        miningCancelled = false;
        miningStarted = false;
        if (miningTimer) clearTimeout(miningTimer);
        miningTimer = setTimeout(() => {
            miningTimer = null;
            if (activeId === null || miningCancelled) return;
            miningStarted = true;
            _dispatchInteraction(0, 'mousedown');
        }, MINE_HOLD_DELAY_MS);
    }, { passive: false });

    area.addEventListener('touchmove', (e) => {
        if (activeId === null) return;
        e.preventDefault();
        if (pinching && e.touches.length >= 2) {
            const nextDistance = distanceBetween(e.touches);
            const delta = nextDistance - pinchDistance;
            pinchDistance = nextDistance;
            if (typeof ctx.player?.setThirdPersonCameraDistance === 'function') {
                ctx.player.setThirdPersonCameraDistance(ctx.player.getThirdPersonCameraDistance() - delta * 0.015);
            }
            return;
        }
        for (const t of e.touches) {
            if (t.identifier !== activeId) continue;
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            lastX = t.clientX; lastY = t.clientY;
            const distanceFromStart = Math.hypot(t.clientX - startX, t.clientY - startY);
            if (distanceFromStart > TAP_MAX_MOVE_PX) moved = true;
            if (!miningStarted && distanceFromStart > MINE_HOLD_MOVE_PX) {
                miningCancelled = true;
                if (miningTimer) {
                    clearTimeout(miningTimer);
                    miningTimer = null;
                }
            }
            if (miningStarted) continue;
            applyTouchLookDelta(ctx, dx, dy);
        }
    }, { passive: false });

    const endHandler = (e) => {
        if (pinching) {
            stopMining();
            moved = true;
            if (e.touches.length < 2) pinching = false;
            if (e.touches.length === 0) {
                activeId = null;
            }
            return;
        }
        for (const t of e.changedTouches) {
            if (t.identifier === activeId) {
                const elapsed = performance.now() - startTime;
                if (miningTimer) {
                    clearTimeout(miningTimer);
                    miningTimer = null;
                }
                if (miningStarted) {
                    _dispatchInteraction(0, 'mouseup');
                    miningStarted = false;
                } else if (!moved && elapsed <= TAP_MAX_MS && !(ctx.isInventoryOpenedProvider && ctx.isInventoryOpenedProvider())) {
                    _dispatchInteraction(0, 'mousedown');
                    _dispatchInteraction(0, 'mouseup');
                }
                activeId = null;
                break;
            }
        }
    };
    const cancelHandler = (e) => {
        pinching = false;
        for (const t of e.changedTouches) {
            if (t.identifier !== activeId) continue;
            stopMining();
            activeId = null;
            break;
        }
    };
    area.addEventListener('touchend', endHandler);
    area.addEventListener('touchcancel', cancelHandler);
}

function _bindActionButtons(ctx) {
    const jumpBtn = document.getElementById('touch-btn-jump');
    const placeBtn = document.getElementById('touch-btn-place');
    const invBtn = document.getElementById('touch-btn-inv');
    const journalBtn = document.getElementById('touch-btn-journal');
    const fullscreenBtn = document.getElementById('touch-btn-fullscreen');
    const cameraBtn = document.getElementById('touch-btn-camera');
    const pauseBtn = document.getElementById('touch-btn-pause');
    const pauseOverlay = document.getElementById('instructions');

    const updateCameraButton = (mode = ctx.player?.cameraMode) => {
        if (!cameraBtn) return;
        const isThirdPerson = mode === 'third';
        cameraBtn.textContent = isThirdPerson ? '1P' : '3P';
        cameraBtn.setAttribute('aria-label', isThirdPerson
            ? 'Zu First Person wechseln'
            : 'Zu Third Person wechseln');
    };
    updateCameraButton();

    const syncFullscreenButton = () => {
        if (!fullscreenBtn) return;
        fullscreenBtn.hidden = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    };
    syncFullscreenButton();
    document.addEventListener('fullscreenchange', syncFullscreenButton);
    document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

    if (pauseOverlay) {
        pauseOverlay.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !Game.touchActive) return;
            if (btn.textContent && btn.textContent.includes('Weiter')) {
                e.stopPropagation();
                pauseOverlay.style.display = 'none';
            }
        });
    }

    let jumpTouchId = null;
    let jumpLastX = 0;
    let jumpLastY = 0;
    jumpBtn.addEventListener('touchstart', (e) => {
        if (jumpTouchId !== null) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        jumpTouchId = touch.identifier;
        jumpLastX = touch.clientX;
        jumpLastY = touch.clientY;
        pressTouchJump();
    }, { passive: false });
    jumpBtn.addEventListener('touchmove', (e) => {
        if (jumpTouchId === null) return;
        e.preventDefault();
        for (const touch of e.touches) {
            if (touch.identifier !== jumpTouchId) continue;
            const dx = touch.clientX - jumpLastX;
            const dy = touch.clientY - jumpLastY;
            jumpLastX = touch.clientX;
            jumpLastY = touch.clientY;
            applyTouchLookDelta(ctx, dx, dy);
            break;
        }
    }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== jumpTouchId) continue;
            e.preventDefault();
            releaseTouchJump();
            jumpTouchId = null;
            break;
        }
    }, { passive: false });
    jumpBtn.addEventListener('touchcancel', (e) => {
        for (const touch of e.changedTouches) {
            if (touch.identifier !== jumpTouchId) continue;
            releaseTouchJump(true);
            jumpTouchId = null;
            break;
        }
    });

    // Place: synthetisches Rechtsklick-mousedown. Abbau liegt auf Tap im Look-Bereich.
    placeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); _dispatchInteraction(2); }, { passive: false });

    // Inventar-Button: Synthetisches Tasten-Event 'KeyE' dispatchen.
    // GameMain registriert keydown auf KeyE → toggleInventory(). So bleibt Single-Source-of-Truth.
    if (invBtn) {
        invBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const evt = new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true });
            window.dispatchEvent(evt);
        }, { passive: false });
    }
    if (journalBtn) {
        journalBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', bubbles: true }));
        }, { passive: false });
    }
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('touchstart', async (e) => {
            e.preventDefault();
            if (typeof window.__butzcraftRequestFullscreen !== 'function') return;
            await window.__butzcraftRequestFullscreen();
            syncFullscreenButton();
        }, { passive: false });
    }
    if (cameraBtn) {
        cameraBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (typeof ctx.toggleCameraMode !== 'function') return;
            updateCameraButton(ctx.toggleCameraMode());
        }, { passive: false });
    }

    // Pause-Button: Auf Mobile gibt's keinen ESC. Der existierende Pause-Pfad ist
    // controls.unlock() → Pause-Menü erscheint. Aber im Touch-Mode lockt PointerLock nie.
    // Lösung: Pause-Overlay direkt zeigen (existiert als #instructions im DOM).
    if (pauseBtn) {
        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const inst = document.getElementById('instructions');
            const isPaused = ctx.isPausedProvider
                ? ctx.isPausedProvider()
                : inst?.style.display === 'block';
            if (isPaused) {
                if (typeof ctx.resumeGame === 'function') ctx.resumeGame();
                else if (inst) inst.style.display = 'none';
            } else {
                if (typeof ctx.pauseGame === 'function') ctx.pauseGame();
                else if (inst) {
                    inst.style.display = 'block';
                    if (typeof window.loadGamesList === 'function') window.loadGamesList();
                }
            }
        }, { passive: false });
    }
}
