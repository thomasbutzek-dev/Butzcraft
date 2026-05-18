/* js/Input.js - Butzcraft Input State */

export const Input = {
    moveF: false,
    moveB: false,
    moveL: false,
    moveR: false,
    moveUp: false,
    sprint: false,   // Shift
    crouch: false,   // Ctrl

    // Handler-Referenzen, damit removeEventListener funktioniert
    _onKeyDown: null,
    _onKeyUp: null,
    _onBlur: null,

    init(isInventoryOpenedProvider) {
        // Vorherige Listener entfernen, falls init() mehrfach gerufen wird (z.B. nach loadGame)
        this.destroy();

        // Reset state, damit hängengebliebene Tasten nach Reload nicht weiter "gedrückt" sind
        this.moveF = this.moveB = this.moveL = this.moveR = this.moveUp = false;
        this.sprint = this.crouch = false;

        this._onKeyDown = (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (isInventoryOpenedProvider && isInventoryOpenedProvider()) return;
            const handled =
                e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyA' || e.code === 'KeyD' ||
                e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
                e.code === 'ControlLeft' || e.code === 'ControlRight';
            if (handled && e.cancelable) e.preventDefault();

            if (e.code === 'KeyW') this.moveF = true;
            if (e.code === 'KeyS') this.moveB = true;
            if (e.code === 'KeyA') this.moveL = true;
            if (e.code === 'KeyD') this.moveR = true;
            if (e.code === 'Space') this.moveUp = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = true;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouch = true;
        };

        this._onKeyUp = (e) => {
            if (e.code === 'KeyW') this.moveF = false;
            if (e.code === 'KeyS') this.moveB = false;
            if (e.code === 'KeyA') this.moveL = false;
            if (e.code === 'KeyD') this.moveR = false;
            if (e.code === 'Space') this.moveUp = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprint = false;
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouch = false;
        };

        // Bei Tab-Wechsel/Fokusverlust alle Tasten resetten — sonst klebt z.B. Shift,
        // wenn der User Alt+Tab macht während er sprintet.
        this._onBlur = () => {
            this.moveF = this.moveB = this.moveL = this.moveR = this.moveUp = false;
            this.sprint = this.crouch = false;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    },

    destroy() {
        if (this._onKeyDown) {
            window.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._onKeyUp) {
            window.removeEventListener('keyup', this._onKeyUp);
            this._onKeyUp = null;
        }
        if (this._onBlur) {
            window.removeEventListener('blur', this._onBlur);
            this._onBlur = null;
        }
    }
};
