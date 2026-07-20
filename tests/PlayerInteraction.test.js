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

async function createInteraction({ blockType = 0, inventoryItem = null, mobs = [], getBlockAt = null } = {}) {
    const { PlayerInteraction } = await import('../js/PlayerInteraction.js');
    const sound = {
        playDig: vi.fn(),
        playSound: vi.fn(),
        playSword: vi.fn(),
        getSoundCategory: vi.fn(() => 'wood')
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
    const blockMetadata = new Map();
    const world = {
        chunks: new Map(),
        getBlock: (x, y, z) => getBlockAt ? getBlockAt(x, y, z) : currentBlockType,
        setBlock: vi.fn((x, y, z, type) => { currentBlockType = type; }),
        setBlockMeta: vi.fn((x, y, z, value) => blockMetadata.set(`${x},${y},${z}`, value)),
        getBlockMeta: vi.fn((x, y, z) => blockMetadata.get(`${x},${y},${z}`) || 0),
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
        delete window.butzcraftCanInteract;
        delete window.trySleepInBed;
    });

    it('starts an empty-hand animation without showing or sounding like a free sword', async () => {
        const { interaction, sound } = await createInteraction();

        await interaction.handleInteraction({ button: 0 });

        expect(Game.player.startAttackAnimation).toHaveBeenCalledWith(null);
        expect(sound.playSword).not.toHaveBeenCalled();
    }, 15000);

    it('routes left and right mouse buttons through the installed document handlers', async () => {
        const { interaction } = await createInteraction();
        const handleInteraction = vi.spyOn(interaction, 'handleInteraction').mockResolvedValue();
        interaction.init({ isLocked: true }, () => true, () => false);

        document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
        document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        document.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
        document.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));

        expect(handleInteraction.mock.calls.map(([event]) => event.button)).toEqual([0, 2]);
        interaction.destroy();
    }, 15000);

    it('passes the mouse event to the canvas fallback when pointer lock is unavailable', async () => {
        const { interaction } = await createInteraction();
        const canvas = document.createElement('canvas');
        document.body.appendChild(canvas);
        const handleInteraction = vi.spyOn(interaction, 'handleInteraction').mockResolvedValue();
        window.butzcraftCanInteract = event => event?.target === canvas;
        interaction.init({ isLocked: false }, () => true, () => false);

        canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));

        expect(handleInteraction.mock.calls.map(([event]) => event.button)).toEqual([0, 2]);
        interaction.destroy();
        canvas.remove();
    }, 15000);

    it('keeps both mouse buttons enabled when an active game loses pointer lock over the HUD', async () => {
        const { canUseMouseInteraction } = await import('../js/PlayerInteraction.js');

        expect(canUseMouseInteraction({
            gameStarted: true,
            gameActive: true,
            spawning: false,
            manuallyPaused: false,
            blockingOverlayOpen: false
        })).toBe(true);
    });

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

    it('raycasts NPC sprites safely with the third-person aim ray', async () => {
        const group = new THREE.Group();
        group.add(new THREE.Sprite(new THREE.SpriteMaterial()));
        window.npcs = [{ group, isDead: false }];
        Game.player.getAimRay = (origin, direction) => ({
            origin: origin.set(0, 0, 5),
            direction: direction.set(0, 0, -1)
        });
        const { interaction } = await createInteraction();

        await expect(interaction.handleInteraction({ button: 0 })).resolves.toBeUndefined();
        expect(interaction.raycaster.camera).not.toBeNull();
    });

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
            expect(mob.takeDamage).toHaveBeenCalledWith(6, expect.any(Function));
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

    it('uses the shared cooked-food value when eating', async () => {
        const { interaction, inventorySlots, context } = await createInteraction({
            inventoryItem: { type: 97, count: 1 }
        });

        await interaction.handleInteraction({ button: 2 });

        expect(Game.player.hunger).toBe(34);
        expect(inventorySlots[0].count).toBe(0);
        expect(context.updateUI).toHaveBeenCalled();
        expect(interaction.showMessage).toHaveBeenCalledWith('Lecker gekocht!', '#ffe066', 24);
    }, 15000);

    it.each([
        [33, [[0, 0, 0, 4], [0, 1, 0, 4]]],
        [103, [[0, 0, 0, 4]]]
    ])('toggles door or gate block %i with right click', async (blockType, expectedCalls) => {
        const { interaction, world } = await createInteraction({ blockType });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        world.chunks.set('0,0', { mesh, waterMesh: null });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.includes(mesh) ? [{
            distance: 2,
            object: mesh,
            point: new THREE.Vector3(0.5, 0.5, 0.5),
            face: { normal: new THREE.Vector3(0, 0, 1) }
        }] : []);

        await interaction.handleInteraction({ button: 2 });

        for (const call of expectedCalls) expect(world.setBlockMeta).toHaveBeenCalledWith(...call);
    });

    it('applies pressure-plate damage to the central player state', async () => {
        const { interaction, sound, world } = await createInteraction({ blockType: 79 });

        interaction.checkPressurePlates(2.4, 4.1, 6.8);
        interaction.checkPressurePlates(2.4, 4.1, 6.8);

        expect(Game.player.health).toBe(8);
        expect(sound.playSound).toHaveBeenCalledWith('damage', 0.8, 1.0);

        world.setBlock(2, 4, 6, 0);
        interaction.checkPressurePlates(2.4, 4.1, 6.8);
        world.setBlock(2, 4, 6, 79);
        interaction.checkPressurePlates(2.4, 4.1, 6.8);

        expect(Game.player.health).toBe(6);
        expect(sound.playSound).toHaveBeenCalledTimes(2);
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

    it('never removes a block after reporting that it cannot be mined', async () => {
        const { interaction, world } = await createInteraction({ blockType: 20 });
        const target = { x: 1, y: 2, z: 3, normal: new THREE.Vector3(0, 1, 0) };
        interaction._getBlockHit = () => target;

        interaction._startMining(target, {
            canBreak: false,
            hint: 'Diesen Block kannst du nicht abbauen.'
        }, 0);
        interaction.updateMining(10);

        expect(interaction.showMessage).toHaveBeenCalledWith(
            'Diesen Block kannst du nicht abbauen.',
            '#ffe066',
            18
        );
        expect(world.setBlock).not.toHaveBeenCalled();
    }, 15000);

    it('does not report the stale air hit after successfully mining a block', async () => {
        const { interaction, world } = await createInteraction({ blockType: 5 });
        const target = { x: 1, y: 2, z: 3, normal: new THREE.Vector3(0, 1, 0) };
        interaction._getBlockHit = () => target;
        interaction._startMining(target, {
            canBreak: true,
            duration: 0.1,
            usesDurability: false
        }, 0);
        interaction.updateMining(10);
        interaction.updateMining(0.016);

        expect(world.setBlock).toHaveBeenCalledWith(1, 2, 3, 0);
        expect(interaction.showMessage).not.toHaveBeenCalledWith(
            'Diesen Block kannst du nicht abbauen.',
            '#ffe066',
            18
        );
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

    it('passes the used bed position to the sleep system', async () => {
        const { interaction, world } = await createInteraction({ blockType: 38 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        world.chunks.set('0,0', { mesh });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.length === 0 ? [] : [{
            distance: 2,
            object: mesh,
            point: new THREE.Vector3(0.5, 0.5, 0.5),
            face: { normal: new THREE.Vector3(0, 1, 0) }
        }]);
        window.trySleepInBed = vi.fn(() => ({ ok: true, message: 'Gesetzt' }));

        await interaction.handleInteraction({ button: 2 });

        expect(window.trySleepInBed).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 });
    }, 15000);

    it('places a wall torch with its attachment direction and consumes one item', async () => {
        const { interaction, world, inventorySlots } = await createInteraction({
            inventoryItem: { type: 101, count: 2 },
            getBlockAt: (x, y, z) => x === 0 && y === 0 && z === 0 ? 3 : 0
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        world.chunks.set('0,0', { mesh });
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.length === 0 ? [] : [{
            distance: 2,
            object: mesh,
            point: new THREE.Vector3(1, 0.5, 0.5),
            face: { normal: new THREE.Vector3(1, 0, 0) }
        }]);

        await interaction.handleInteraction({ button: 2 });

        expect(world.setBlock).toHaveBeenCalledWith(1, 0, 0, 101);
        expect(world.setBlockMeta).toHaveBeenCalledWith(1, 0, 0, 1);
        expect(inventorySlots[0].count).toBe(1);
    }, 15000);

    it('keeps a dungeon gate locked until its generated key chest was opened', async () => {
        const { interaction, world } = await createInteraction({ blockType: 85 });
        const structureId = 'dungeon:0,0:v2';
        const gate = { x: 4, y: 18, z: 6, widthAxis: 'z' };
        world.structureGates = new Map([['4,18,6', { structureId, gate }]]);
        world.structureProgress = {};

        expect(interaction._tryUnlockStructureGate(4, 18, 6)).toBe(true);
        expect(world.setBlock).not.toHaveBeenCalled();

        world.structureProgress[structureId] = { keyFound: true };
        expect(interaction._tryUnlockStructureGate(4, 18, 6)).toBe(true);
        expect(world.setBlock).toHaveBeenCalledTimes(9);
        expect(world.structureProgress[structureId]).toEqual({ keyFound: true, gateOpened: true });
    }, 15000);

    it.each([
        { type: 28, pairedType: 36, label: 'workbench' },
        { type: 38, pairedType: 39, label: 'bed' }
    ])('stores one shared orientation for both $label halves', async ({ type, pairedType }) => {
        const { interaction, world } = await createInteraction({
            inventoryItem: { type, count: 1 },
            getBlockAt: (x, y, z) => y === 0 ? 3 : 0
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
        world.chunks.set('0,0', { mesh });
        interaction._getAimDirection = (target) => target.set(0, 0, -1);
        interaction.raycaster.intersectObjects = vi.fn(objects => objects.length === 0 ? [] : [{
            distance: 2,
            object: mesh,
            point: new THREE.Vector3(0.5, 1, 0.5),
            face: { normal: new THREE.Vector3(0, 1, 0) }
        }]);

        await interaction.handleInteraction({ button: 2 });

        expect(world.setBlock).toHaveBeenCalledWith(0, 1, 0, type);
        expect(world.setBlock).toHaveBeenCalledWith(1, 1, 0, pairedType);
        expect(world.setBlockMeta).toHaveBeenCalledWith(0, 1, 0, 0);
        expect(world.setBlockMeta).toHaveBeenCalledWith(1, 1, 0, 0);
    }, 15000);

    it('returns a mined torch and removes its attachment metadata', async () => {
        const { interaction, world, context } = await createInteraction({ blockType: 101 });

        interaction._breakMinedBlock(
            { x: 2, y: 3, z: 4, normal: new THREE.Vector3(0, 1, 0) },
            null,
            { canBreak: true, usesDurability: false }
        );

        expect(world.setBlock).toHaveBeenCalledWith(2, 3, 4, 0);
        expect(world.deleteBlockMeta).toHaveBeenCalledWith(2, 3, 4);
        expect(context.addItemToInventory).toHaveBeenCalledWith(101, 1);
    }, 15000);
});

describe('painterly block fragments', () => {
    it('uses fewer, softer and longer-lived fragments on painterly devices', async () => {
        const { getBlockBreakParticleProfile } = await import('../js/PlayerInteraction.js');
        const original = getBlockBreakParticleProfile(false, false);
        const painterly = getBlockBreakParticleProfile(true, false);
        const reduced = getBlockBreakParticleProfile(true, true);

        expect(painterly.count).toBeLessThanOrEqual(original.count);
        expect(painterly.opacity).toBeLessThan(original.opacity);
        expect(painterly.lifetimeMs).toBeGreaterThan(original.lifetimeMs);
        expect(reduced.count).toBeLessThan(painterly.count);
    });
});
