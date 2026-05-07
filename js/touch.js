/* js/touch.js - Touch-Controls für Mobilgeräte
 *
 * Architektur:
 *  - Wird beim Spielstart aufgerufen. Bei Nicht-Touch-Devices ist es ein No-Op.
 *  - Joystick (links): mappt auf Input.moveF/B/L/R
 *  - Look-Bereich (rechte Bildschirmhälfte ohne Buttons): swipt → camera/controls Rotation
 *  - Buttons: SPRINGEN (Input.moveUp), ABBAUEN (mousedown button=0), BAUEN (mousedown button=2)
 *
 *  PointerLock funktioniert auf iOS/Android nicht (kein API-Support) → wir setzen
 *  window.touchActive=true, und PlayerInteraction sowie der Pause-Check ignorieren
 *  controls.isLocked, wenn touchActive gesetzt ist.
 *
 *  Look-Empfindlichkeit: 0.005 rad pro Pixel — Daumen-tauglich, nicht wackelig.
 */

import { Input } from './Input.js?v=20260507b';

const LOOK_SENSITIVITY = 0.005;
const JOYSTICK_DEADZONE = 0.18;
const JOYSTICK_RADIUS_PX = 60;

export function isTouchDevice() {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

/**
 * Initialisiert Touch-UI. Idempotent (mehrfache Aufrufe sind sicher).
 * @param {object} ctx - { camera, controls, isInventoryOpenedProvider, toggleInventory, openPauseMenu }
 *
 * Buttons (rechts unten, von oben nach unten):
 *   ⏸  Pause/Menü öffnen (für Save/Settings, da kein ESC auf Mobile)
 *   📦 Inventar öffnen/schließen
 *   ⤒  Springen (holdable)
 *   ▣  Block platzieren (synth. mousedown button=2)
 *   ⛏  Block abbauen / Mob angreifen (synth. mousedown button=0)
 */
export function initTouchControls(ctx) {
    if (!isTouchDevice()) return;
    if (document.getElementById('touch-overlay')) return; // schon initialisiert

    window.touchActive = true;
    document.documentElement.classList.add('touch-device');
    document.body.classList.add('touch-device');

    const overlay = document.createElement('div');
    overlay.id = 'touch-overlay';
    overlay.innerHTML = `
        <div id="touch-joystick-base">
            <div id="touch-joystick-knob"></div>
        </div>
        <div id="touch-look-area"></div>
        <div id="touch-button-stack">
            <div id="touch-slot-switch">
                <button id="touch-btn-slot-prev" class="touch-btn touch-btn-small" aria-label="Slot zurück">◀</button>
                <button id="touch-btn-slot-next" class="touch-btn touch-btn-small" aria-label="Slot vor">▶</button>
            </div>
            <button id="touch-btn-pause" class="touch-btn touch-btn-small" aria-label="Pause">⏸</button>
            <button id="touch-btn-inv" class="touch-btn touch-btn-small" aria-label="Inventar">📦</button>
            <button id="touch-btn-jump" class="touch-btn" aria-label="Springen">⤒</button>
            <button id="touch-btn-place" class="touch-btn" aria-label="Bauen">▣</button>
            <button id="touch-btn-dig" class="touch-btn" aria-label="Abbauen">⛏</button>
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
            position: absolute; right: 0; top: 0;
            width: 58%; height: 100%;
            pointer-events: auto;
            touch-action: none;
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
        .touch-btn:active { background: rgba(255,255,255,0.4); }
        #touch-slot-switch {
            grid-column: 1 / span 2;
            display: grid;
            grid-template-columns: repeat(2, clamp(48px, 9vw, 64px));
            gap: clamp(8px, 1.5vw, 12px);
            width: 100%;
            justify-content: center;
        }
        #touch-btn-pause { grid-column: 1; }
        #touch-btn-inv { grid-column: 2; }
        #touch-btn-jump { grid-column: 1; }
        #touch-btn-place { grid-column: 2; }
        #touch-btn-dig { grid-column: 2; }
        @media (orientation: portrait) and (max-width: 560px) {
            #touch-button-stack {
                grid-template-columns: repeat(2, 52px);
                grid-auto-rows: 52px;
            }
            #touch-slot-switch {
                grid-template-columns: repeat(2, 52px);
            }
            #touch-joystick-base {
                width: 116px;
                height: 116px;
            }
        }
        @media (orientation: landscape) and (max-height: 460px) {
            #touch-button-stack {
                grid-template-columns: repeat(3, 50px);
                grid-auto-rows: 50px;
            }
            #touch-slot-switch {
                grid-column: 1 / span 2;
                grid-template-columns: repeat(2, 50px);
            }
            #touch-btn-pause { grid-column: 3; grid-row: 1; }
            #touch-btn-inv { grid-column: 1; grid-row: 2; }
            #touch-btn-jump { grid-column: 2; grid-row: 2; }
            #touch-btn-place { grid-column: 3; grid-row: 2; }
            #touch-btn-dig { grid-column: 3; grid-row: 3; }
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

    area.addEventListener('touchstart', (e) => {
        // Ignorieren, wenn Inventar offen
        if (ctx.isInventoryOpenedProvider && ctx.isInventoryOpenedProvider()) return;
        if (activeId !== null) return;
        const t = e.changedTouches[0];
        activeId = t.identifier;
        lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });

    area.addEventListener('touchmove', (e) => {
        if (activeId === null) return;
        e.preventDefault();
        for (const t of e.touches) {
            if (t.identifier !== activeId) continue;
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            lastX = t.clientX; lastY = t.clientY;
            // controls.getObject() trägt Yaw, camera direkt trägt Pitch (PointerLockControls-Konvention)
            const yawObj = ctx.controls && ctx.controls.getObject ? ctx.controls.getObject() : null;
            if (yawObj) yawObj.rotation.y -= dx * LOOK_SENSITIVITY;
            if (ctx.camera) {
                ctx.camera.rotation.x -= dy * LOOK_SENSITIVITY;
                // Pitch klemmen wie PointerLockControls (±π/2)
                const lim = Math.PI / 2 - 0.01;
                if (ctx.camera.rotation.x > lim) ctx.camera.rotation.x = lim;
                if (ctx.camera.rotation.x < -lim) ctx.camera.rotation.x = -lim;
            }
        }
    }, { passive: false });

    const endHandler = (e) => {
        for (const t of e.changedTouches) {
            if (t.identifier === activeId) { activeId = null; break; }
        }
    };
    area.addEventListener('touchend', endHandler);
    area.addEventListener('touchcancel', endHandler);
}

function _bindActionButtons(ctx) {
    const jumpBtn = document.getElementById('touch-btn-jump');
    const digBtn  = document.getElementById('touch-btn-dig');
    const placeBtn = document.getElementById('touch-btn-place');
    const invBtn = document.getElementById('touch-btn-inv');
    const pauseBtn = document.getElementById('touch-btn-pause');
    const pauseOverlay = document.getElementById('instructions');

    if (pauseOverlay) {
        pauseOverlay.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || !window.touchActive) return;
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

    // Dig/Place: synthetisches mousedown-Event auf body — PlayerInteraction.handleInteraction() reagiert darauf.
    // Wir simulieren NICHT mouseup, weil die existierende Logik ohnehin nur auf mousedown reagiert.
    const dispatchClick = (button) => {
        const evt = new MouseEvent('mousedown', { button, bubbles: true });
        document.dispatchEvent(evt);
    };
    digBtn.addEventListener('touchstart', (e) => { e.preventDefault(); dispatchClick(0); }, { passive: false });
    placeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); dispatchClick(2); }, { passive: false });

    // Inventar-Button: Synthetisches Tasten-Event 'KeyE' dispatchen.
    // GameMain registriert keydown auf KeyE → toggleInventory(). So bleibt Single-Source-of-Truth.
    if (invBtn) {
        invBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const evt = new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true });
            window.dispatchEvent(evt);
        }, { passive: false });
    }

    // Slot-Wechsel ◀ ▶: navigiert durch die 8 Hotbar-Slots.
    // Nutzt window.getSelectedSlot / window.setSelectedSlot (aus GameMain.js exponiert).
    const slotPrev = document.getElementById('touch-btn-slot-prev');
    const slotNext = document.getElementById('touch-btn-slot-next');
    if (slotPrev) {
        slotPrev.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const cur = window.getSelectedSlot ? window.getSelectedSlot() : 0;
            if (window.setSelectedSlot) window.setSelectedSlot((cur + 7) % 8);
            if (window.updateInventoryUI) window.updateInventoryUI();
        }, { passive: false });
    }
    if (slotNext) {
        slotNext.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const cur = window.getSelectedSlot ? window.getSelectedSlot() : 0;
            if (window.setSelectedSlot) window.setSelectedSlot((cur + 1) % 8);
            if (window.updateInventoryUI) window.updateInventoryUI();
        }, { passive: false });
    }

    // Pause-Button: Auf Mobile gibt's keinen ESC. Der existierende Pause-Pfad ist
    // controls.unlock() → Pause-Menü erscheint. Aber im Touch-Mode lockt PointerLock nie.
    // Lösung: Pause-Overlay direkt zeigen (existiert als #instructions im DOM).
    if (pauseBtn) {
        pauseBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const inst = document.getElementById('instructions');
            if (!inst) return;
            const isPaused = inst.style.display === 'block';
            if (isPaused) {
                inst.style.display = 'none';
            } else {
                inst.style.display = 'block';
                if (typeof window.loadGamesList === 'function') window.loadGamesList();
            }
        }, { passive: false });
    }
}
