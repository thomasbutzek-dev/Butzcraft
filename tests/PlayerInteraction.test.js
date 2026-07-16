import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Game } from '../js/Game.js';

beforeAll(() => {
    const gradient = { addColorStop() {} };
    const context = new Proxy({}, {
        get(target, property) {
            if (property === 'createLinearGradient' || property === 'createRadialGradient') {
                return () => gradient;
            }
            if (!(property in target)) target[property] = () => {};
            return target[property];
        }
    });
    HTMLCanvasElement.prototype.getContext = () => context;
    HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
});

async function createInteraction({ blockType = 0 } = {}) {
    const { PlayerInteraction } = await import('../js/PlayerInteraction.js');
    const sound = {
        playSound: vi.fn(),
        playSword: vi.fn()
    };
    const context = {
        getSelectedSlot: () => 0,
        getInventorySlots: () => Array.from({ length: 64 }, () => ({ type: 0, count: 0 })),
        addItemToInventory: vi.fn(),
        updateInventoryUI: vi.fn(),
        updateUI: vi.fn()
    };
    const world = {
        chunks: new Map(),
        getBlock: () => blockType
    };
    const interaction = new PlayerInteraction(
        new THREE.PerspectiveCamera(),
        new THREE.Scene(),
        world,
        [],
        sound,
        context
    );
    interaction.showMessage = vi.fn();
    return { interaction, sound };
}

describe('PlayerInteraction through the Game seam', () => {
    beforeEach(() => {
        Game.player = { health: 10, hunger: 10, isSwinging: false, swingProgress: 1 };
        window.npcs = [];
        window.getSelectedSlot = undefined;
        window.inventorySlots = undefined;
    });

    afterEach(() => {
        Game.reset();
        delete window.npcs;
        delete window.getSelectedSlot;
    });

    it('updates the player swing state on a primary interaction', async () => {
        const { interaction, sound } = await createInteraction();

        await interaction.handleInteraction({ button: 0 });

        expect(Game.player.isSwinging).toBe(true);
        expect(Game.player.swingProgress).toBe(0);
        expect(sound.playSword).toHaveBeenCalledOnce();
    }, 15000);

    it('applies pressure-plate damage to the central player state', async () => {
        const { interaction, sound } = await createInteraction({ blockType: 79 });

        interaction.checkPressurePlates(2.4, 4.1, 6.8);

        expect(Game.player.health).toBe(8);
        expect(sound.playSound).toHaveBeenCalledWith('damage', 0.8, 1.0);
    }, 15000);
});
