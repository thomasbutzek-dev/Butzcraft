/* js/Input.js - Butzcraft Input State */

export const Input = {
    moveF: false,
    moveB: false,
    moveL: false,
    moveR: false,
    moveUp: false,

    // Handler-Referenzen, damit removeEventListener funktioniert
    _onKeyDown: null,
    _onKeyUp: null,

    init(isInventoryOpenedProvider) {
        // Vorherige Listener entfernen, falls init() mehrfach gerufen wird (z.B. nach loadGame)
        this.destroy();

        // Reset state, damit hängengebliebene Tasten nach Reload nicht weiter "gedrückt" sind
        this.moveF = this.moveB = this.moveL = this.moveR = this.moveUp = false;

        this._onKeyDown = (e) => {
            if (isInventoryOpenedProvider && isInventoryOpenedProvider()) return;

            if (e.code === 'KeyW') this.moveF = true;
            if (e.code === 'KeyS') this.moveB = true;
            if (e.code === 'KeyA') this.moveL = true;
            if (e.code === 'KeyD') this.moveR = true;
            if (e.code === 'Space') this.moveUp = true;
        };

        this._onKeyUp = (e) => {
            if (e.code === 'KeyW') this.moveF = false;
            if (e.code === 'KeyS') this.moveB = false;
            if (e.code === 'KeyA') this.moveL = false;
            if (e.code === 'KeyD') this.moveR = false;
            if (e.code === 'Space') this.moveUp = false;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
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
    }
};
