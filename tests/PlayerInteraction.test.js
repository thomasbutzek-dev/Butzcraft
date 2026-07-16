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

async function createInteraction({ blockType = 0, inventoryItem = null, mobs = [] } = {}) {
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
        mobs,
        sound,
        context
    );
    interaction.showMessage = vi.fn();
    return { interaction, sound, context, inventorySlots, world };
}

describe('PlayerInteraction through the Game seam', () => {
    beforeEach(() => {
        Game.player = {
            health: 10,
            hunger: 10,
            isSwinging: false,
            swingProgress: 1,
            startAttackAnimation: vi.fn(),
            startBowAnimation: vi.fn()
        };
        window.npcs = [];
        window.getSelectedSlot = undefined;
    });

    afterEach(() => {
        Game.reset();
        delete window.npcs;
        delete window.getSelectedSlot;
    });

    it('starts an empty-hand animation without showing or sounding like a free sword', async () => {
        const { interaction, sound } = await createInteraction();

        await interaction.handleInteraction({ button: 0 });

        expect(Game.player.startAttackAnimation).toHaveBeenCalledWith(null);
        expect(sound.playSword).not.toHaveBeenCalled();
    }, 15000);

    it('applies sword damage once per cooldown and wears the sword on a hit', async () => {
        const mobMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        const mob = { mesh: mobMesh, isDead: false, type: 'zombie', takeDamage: vi.fn() };
        const { interaction, context, inventorySlots } = await createInteraction({
            inventoryItem: { type: 89, count: 1, durability: 5 },
            mobs: [mob]
        });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.includes(mobMesh) ? [{
            distance: 2,
            object: mobMesh
        }] : []);
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000);

        await interaction.handleInteraction({ button: 0 });
        await interaction.handleInteraction({ button: 0 });

        expect(mob.takeDamage).toHaveBeenCalledTimes(1);
        expect(mob.takeDamage).toHaveBeenCalledWith(5, expect.any(Function));
        expect(inventorySlots[0].durability).toBe(4);
        expect(context.updateInventoryUI).toHaveBeenCalled();
        now.mockRestore();
    }, 15000);

    it('protects villagers from player attacks', async () => {
        const group = new THREE.Group();
        const npc = { group, isDead: false, takeDamage: vi.fn() };
        window.npcs = [npc];
        const { interaction } = await createInteraction({ inventoryItem: { type: 91, count: 1, durability: 450 } });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.includes(group) ? [{
            distance: 2,
            object: group
        }] : []);

        await interaction.handleInteraction({ button: 0 });

        expect(npc.takeDamage).not.toHaveBeenCalled();
        expect(interaction.showMessage).toHaveBeenCalledWith(
            'Dorfbewohner sind Freunde – sprich mit Rechtsklick.',
            '#ffe066',
            18
        );
    }, 15000);

    it('fires one inventory arrow, damages a mob and wears the bow', async () => {
        const mobMesh = new THREE.Group();
        mobMesh.position.set(0, 0, -2);
        const mob = { mesh: mobMesh, isDead: false, type: 'zombie', takeDamage: vi.fn() };
        const { interaction, context, inventorySlots } = await createInteraction({
            inventoryItem: { type: 94, count: 1, durability: 5 },
            mobs: [mob]
        });
        inventorySlots[1] = { type: 95, count: 2 };
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000);

        try {
            await interaction.handleInteraction({ button: 0 });
            interaction.updateRanged(0.05);

            expect(inventorySlots[1]).toEqual({ type: 95, count: 1 });
            expect(inventorySlots[0].durability).toBe(4);
            expect(mob.takeDamage).toHaveBeenCalledWith(6);
            expect(context.updateInventoryUI).toHaveBeenCalled();
            expect(Game.player.startBowAnimation).toHaveBeenCalledWith(expect.objectContaining({ damage: 6 }));
        } finally {
            now.mockRestore();
        }
    }, 15000);

    it('does not wear or fire a bow without arrows', async () => {
        const { interaction, inventorySlots } = await createInteraction({
            inventoryItem: { type: 94, count: 1, durability: 5 }
        });

        await interaction.handleInteraction({ button: 0 });

        expect(interaction.rangedProjectiles).toHaveLength(0);
        expect(inventorySlots[0].durability).toBe(5);
        expect(interaction.showMessage).toHaveBeenCalledWith(
            'Keine Pfeile – aus Stein und Stock herstellen.',
            '#ff9800',
            18
        );
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
