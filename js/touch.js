/* js/touch.js - Touch-Controls für Mobilgeräte
 *
 * Architektur:
 *  - Wird beim Spielstart aufgerufen. Bei Nicht-Touch-Devices ist es ein No-Op.
 *  - Joystick (links): mappt auf Input.moveF/B/L/R
 *  - Look-Bereich (rechte Bildschirmhälfte ohne Buttons): swipt → camera/controls Rotation
 *  - Buttons: SPRINGEN (Input.moveUp), BAUEN (mousedown button=2), Inventar/Pause
 *  - Kurzer Tap in den Look-Bereich: ABBAUEN/Angreifen (mousedown button=0)
 *
 *  PointerLock funktioniert auf iOS/Android nicht (kein API-Support) → wir setzen
 *  Game.touchActive=true, und PlayerInteraction sowie der Pause-Check ignorieren
 *  controls.isLocked, wenn touchActive gesetzt ist.
 *
 *  Look-Empfindlichkeit: 0.005 rad pro Pixel — Daumen-tauglich, nicht wackelig.
 */

import { Input } from './Input.js?v=20260507b';
import { Game } from './Game.js?v=20260716b';

const LOOK_SENSITIVITY = 0.005;
const JOYSTICK_DEADZONE = 0.18;
const JOYSTICK_RADIUS_PX = 60;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const TAP_MAX_MOVE_PX = 10;
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

/**
 * Initialisiert Touch-UI. Idempotent (mehrfache Aufrufe sind sicher).
 * @param {object} ctx - { camera, controls, isInventoryOpenedProvider, toggleInventory, openPauseMenu }
 *
 * Mobile HUD:
 *   ⏸  Pause/Menü oben rechts
 *   📦 Inventar rechts unten
 *   ▣  Block platzieren rechts unten
 *   ⤒  Springen unten rechts (holdable)
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
        <div id="touch-joystick-base">
            <div id="touch-joystick-knob"></div>
        </div>
        <div id="touch-look-area"></div>
        <div id="touch-top-actions">
            <button id="touch-btn-pause" class="touch-btn touch-btn-small" aria-label="Pause">⏸</button>
        </div>
        <div id="touch-button-stack">
            <button id="touch-btn-inv" class="touch-btn touch-btn-small" aria-label="Inventar">📦</button>
            <button id="touch-btn-place" class="touch-btn" aria-label="Bauen">▣</button>
            <button id="touch-btn-jump" class="touch-btn touch-btn-primary" aria-label="Springen">⤒</button>
        </div>
    `;
    document.body.appendChild(overlay);

    _injectTouchStyles();
    _bindJoystick();
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
            --touch-safe-right: max(16px, env(safe-area-inset-right));
            --touch-safe-top: max(16px, env(safe-area-inset-top));
            --touch-look-bottom: 128px;
        }
        #touch-joystick-base {
            position: absolute;
            left: var(--touch-safe-left);
            bottom: var(--touch-safe-bottom);
            width: clamp(108px, 18vw, 140px);
            height: clamp(108px, 18vw, 140px);
            background: rgba(255,255,255,0.12);
            border: 2px solid rgba(255,255,255,0.35);
            border-radius: 50%;
            pointer-events: auto;
            touch-action: none;
        }
        #touch-joystick-knob {
            position: absolute; left: 50%; top: 50%;
            width: 60px; height: 60px;
            margin-left: -30px; margin-top: -30px;
            background: rgba(255,255,255,0.4);
            border: 2px solid rgba(255,255,255,0.7);
            border-radius: 50%;
            pointer-events: none;
            transition: background 0.1s;
        }
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
            width: clamp(46px, 8vw, 58px);
            height: clamp(46px, 8vw, 58px);
            pointer-events: auto;
        }
        #touch-button-stack {
            position: absolute;
            right: var(--touch-safe-right);
            bottom: var(--touch-safe-bottom);
            display: grid;
            grid-template-columns: repeat(2, clamp(48px, 9vw, 64px));
            grid-auto-rows: clamp(48px, 9vw, 64px);
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
        #touch-btn-inv { grid-column: 1; }
        #touch-btn-place { grid-column: 2; }
        #touch-btn-jump { grid-column: 2; grid-row: 2; }
        @media (orientation: portrait) and (max-width: 560px) {
            #touch-overlay {
                --touch-look-bottom: 150px;
            }
            #touch-button-stack {
                grid-template-columns: repeat(2, 52px);
                grid-auto-rows: 52px;
            }
            #touch-joystick-base {
                width: 116px;
                height: 116px;
            }
        }
        @media (orientation: landscape) and (max-height: 460px) {
            #touch-overlay {
                --touch-look-bottom: 104px;
            }
            #touch-button-stack {
                grid-template-columns: repeat(2, 50px);
                grid-auto-rows: 50px;
            }
            #touch-top-actions {
                width: 50px;
                height: 50px;
            }
            #touch-joystick-base {
                width: 104px;
                height: 104px;
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

function _bindJoystick() {
    const base = document.getElementById('touch-joystick-base');
    const knob = document.getElementById('touch-joystick-knob');
    let activeId = null;
    let centerX = 0, centerY = 0;

    const reset = () => {
        knob.style.transform = '';
        Input.moveF = Input.moveB = Input.moveL = Input.moveR = false;
        Input.sprint = false;
        activeId = null;
    };

    base.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        const rect = base.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
        activeId = t.identifier;
    }, { passive: false });

    base.addEventListener('touchmove', (e) => {
        if (activeId === null) return;
        e.preventDefault();
        for (const t of e.touches) {
            if (t.identifier !== activeId) continue;
            let dx = t.clientX - centerX;
            let dy = t.clientY - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const max = JOYSTICK_RADIUS_PX;
            if (dist > max) { dx = dx * max / dist; dy = dy * max / dist; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            const nx = dx / max, ny = dy / max; // -1..1
            Input.moveF = ny < -JOYSTICK_DEADZONE;
            Input.moveB = ny > JOYSTICK_DEADZONE;
            Input.moveL = nx < -JOYSTICK_DEADZONE;
            Input.moveR = nx > JOYSTICK_DEADZONE;
            // Auto-Sprint, wenn Joystick fast voll ausgeschlagen ist (>85%)
            const intensity = Math.min(1, dist / max);
            Input.sprint = intensity > 0.85 && Input.moveF;
        }
    }, { passive: false });

    const endHandler = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === activeId) { reset(); break; }
        }
    };
    base.addEventListener('touchend', endHandler);
    base.addEventListener('touchcancel', endHandler);
}

function _bindLookArea(ctx) {
    const area = document.getElementById('touch-look-area');
    let activeId = null;
    let lastX = 0, lastY = 0;
    let startX = 0, startY = 0, startTime = 0;
    let moved = false;
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
        miningStarted = false;
        if (miningTimer) clearTimeout(miningTimer);
        miningTimer = setTimeout(() => {
            miningTimer = null;
            if (activeId === null || moved) return;
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
            if (Math.hypot(t.clientX - startX, t.clientY - startY) > TAP_MAX_MOVE_PX) {
                moved = true;
                if (miningTimer) {
                    clearTimeout(miningTimer);
                    miningTimer = null;
                }
                if (miningStarted) {
                    _dispatchInteraction(0, 'mouseup');
                    miningStarted = false;
                }
            }
            applyTouchLookDelta(ctx, dx, dy);
        }
    }, { passive: false });

    const endHandler = (e) => {
        if (pinching) {
            stopMining();
            moved = true;
            if (e.touches.length < 2) pinching = false;
            if (e.touches.length === 0) activeId = null;
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
    const pauseBtn = document.getElementById('touch-btn-pause');
    const pauseOverlay = document.getElementById('instructions');

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

    // Sprung als Holdable: Während Touch aktiv ist, Input.moveUp = true.
    const holdJump = (down) => { Input.moveUp = down; };
    jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); holdJump(true); }, { passive: false });
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); holdJump(false); }, { passive: false });
    jumpBtn.addEventListener('touchcancel', () => holdJump(false));

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
