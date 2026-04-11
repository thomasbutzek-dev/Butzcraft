/* js/Input.js - Butzcraft Input State */

export const Input = {
    moveF: false,
    moveB: false,
    moveL: false,
    moveR: false,
    moveUp: false,
    
    init(isInventoryOpenedProvider) {
        window.addEventListener('keydown', e => {
            if (isInventoryOpenedProvider && isInventoryOpenedProvider()) return;

            if (e.code === 'KeyW') this.moveF = true;
            if (e.code === 'KeyS') this.moveB = true;
            if (e.code === 'KeyA') this.moveL = true;
            if (e.code === 'KeyD') this.moveR = true;
            if (e.code === 'Space') this.moveUp = true;
        });

        window.addEventListener('keyup', e => {
            if (e.code === 'KeyW') this.moveF = false;
            if (e.code === 'KeyS') this.moveB = false;
            if (e.code === 'KeyA') this.moveL = false;
            if (e.code === 'KeyD') this.moveR = false;
            if (e.code === 'Space') this.moveUp = false;
        });
    }
};
