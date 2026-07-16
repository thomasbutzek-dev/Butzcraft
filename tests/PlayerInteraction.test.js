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

async function createInteraction({ blockType = 0, inventoryItem = null } = {}) {
    const { PlayerInteraction } = await import('../js/PlayerInteraction.js');
    const sound = {
        playDig: vi.fn(),
        playSound: vi.fn(),
        playSword: vi.fn()
    };
    const inventorySlots = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
    if (inventoryItem) inventorySlots[0] = { ...inventoryItem };
    const context = {
        getSelectedSlot: () => 0,
        getInventorySlots: () => inventorySlots,
        addItemToInventory: vi.fn(),
        updateInventoryUI: vi.fn(),
        updateUI: vi.fn(),
        openWorkbenchCrafting: vi.fn()
    };
    let currentBlockType = blockType;
    const world = {
        chunks: new Map(),
        getBlock: () => currentBlockType,
        setBlock: vi.fn((x, y, z, type) => { currentBlockType = type; }),
        deleteBlockMeta: vi.fn(),
        chestContents: {},
        lootedChests: new Set(),
        spawnerMeta: {},
        fireBlocks: new Set()
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
    return { interaction, sound, context, inventorySlots, world };
}

describe('PlayerInteraction through the Game seam', () => {
    beforeEach(() => {
        Game.player = { health: 10, hunger: 10, isSwinging: false, swingProgress: 1 };
        window.npcs = [];
        window.getSelectedSlot = undefined;
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

    it('breaks a held target only after enough progress and wears the correct tool', async () => {
        const { interaction, inventorySlots, world } = await createInteraction({
            blockType: 5,
            inventoryItem: { type: 67, count: 1, durability: 37 }
        });
        const target = { x: 1, y: 2, z: 3, normal: new THREE.Vector3(0, 1, 0) };
        interaction._getBlockHit = () => target;
        interaction.spawnBlockBreakParticles = vi.fn();
        interaction._startMining(target, { canBreak: true }, 67);

        interaction.updateMining(0.1);
        expect(world.setBlock).not.toHaveBeenCalled();

        interaction.updateMining(0.5);
        expect(world.setBlock).toHaveBeenCalledWith(1, 2, 3, 0);
        expect(inventorySlots[0].durability).toBe(36);
    }, 15000);

    it('keeps valuable stone intact and shows the required tool hint', async () => {
        const { interaction, world } = await createInteraction({ blockType: 3 });
        const target = { x: 1, y: 2, z: 3, normal: new THREE.Vector3(0, 1, 0) };
        interaction._getBlockHit = () => target;
        interaction._startMining(target, { canBreak: true }, 0);

        interaction.updateMining(1);

        expect(world.setBlock).not.toHaveBeenCalled();
        expect(interaction.showMessage).toHaveBeenCalledWith('Du brauchst eine Holz-Spitzhacke.', '#ffe066', 18);
        expect(interaction.miningHeld).toBe(false);
    }, 15000);

    it('opens the 3x3 station when a placed workbench is used', async () => {
        const { interaction, context, world } = await createInteraction({ blockType: 28 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        world.chunks.set('0,0', { mesh });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.length === 0 ? [] : [{
            distance: 2,
            object: mesh,
            point: new THREE.Vector3(0.5, 0.5, 0.5),
            face: { normal: new THREE.Vector3(0, 1, 0) }
        }]);

        await interaction.handleInteraction({ button: 2 });

        expect(context.openWorkbenchCrafting).toHaveBeenCalledOnce();
    }, 15000);
});
