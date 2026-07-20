import { beforeEach, describe, expect, it, vi } from 'vitest';

const structureMocks = vi.hoisted(() => ({
    classifyChestLoot: vi.fn(() => 'mine_timber'),
    getLootDiscoveryMessage: vi.fn(() => 'Minenfund entdeckt!'),
    rollLoot: vi.fn(() => [{ type: 60, count: 2 }])
}));

vi.mock('../js/structures.js', () => structureMocks);

vi.mock('../js/furnace.js', () => ({
    openFurnace: () => {}
}));

vi.mock('../js/inventory.js', () => ({
    createBlockHTML: (type) => `<span>${type}</span>`,
    getItemName: (type) => `Item ${type}`
}));

vi.mock('../js/blocks.js', () => ({
    BLOCK_COLORS: {}
}));

const { PlayerInteraction } = await import('../js/PlayerInteraction.js');

function setupChestDom() {
    document.body.innerHTML = `
        <div id="chest-overlay" style="display:none"></div>
        <div id="chest-grid"></div>
    `;
}

describe('chest loot UI', () => {
    beforeEach(() => {
        setupChestDom();
        window.getBiomeAt = () => 'Grasland';
        vi.clearAllMocks();
    });

    it('does not loot the same emptied chest slot twice', () => {
        const world = {
            chestContents: {},
            lootedChests: new Set(),
            getBlock: () => 0
        };
        const context = {
            addItemToInventory: vi.fn(),
            updateInventoryUI: vi.fn()
        };
        const interaction = new PlayerInteraction(null, null, world, [], {}, context);

        interaction._openChest(1, 20, 3);
        const firstSlot = document.querySelector('#chest-grid .inv-slot');

        firstSlot.click();
        firstSlot.click();

        expect(context.addItemToInventory).toHaveBeenCalledTimes(1);
        expect(context.addItemToInventory).toHaveBeenCalledWith(60, 2);
        expect(world.chestContents['chest,1,20,3'][0]).toEqual({ type: 0, count: 0 });
    });

    it('keeps loot in the chest when the inventory is full', () => {
        const world = {
            chestContents: {},
            lootedChests: new Set(),
            getBlock: () => 0
        };
        const context = {
            addItemToInventory: vi.fn(() => ({ added: 0, remaining: 2 })),
            updateInventoryUI: vi.fn()
        };
        const interaction = new PlayerInteraction(null, null, world, [], {}, context);

        interaction._openChest(1, 20, 3);
        document.querySelector('#chest-grid .inv-slot').click();

        expect(world.chestContents['chest,1,20,3'][0]).toEqual({ type: 60, count: 2 });
    });

    it('uses generated loot metadata and records a dungeon key once', () => {
        const chestInfo = {
            x: 1,
            y: 20,
            z: 3,
            structureId: 'dungeon:0,0:v2',
            role: 'dungeon_key',
            lootTable: 'dungeon_catacomb'
        };
        const world = {
            chestContents: {},
            lootedChests: new Set(),
            structureChests: new Map([['chest,1,20,3', chestInfo]]),
            structureProgress: {},
            getBlock: () => 0
        };
        const interaction = new PlayerInteraction(null, null, world, [], {}, {
            addItemToInventory: vi.fn(),
            updateInventoryUI: vi.fn()
        });

        interaction._openChest(1, 20, 3);
        interaction._openChest(1, 20, 3);

        expect(structureMocks.classifyChestLoot).not.toHaveBeenCalled();
        expect(structureMocks.rollLoot).toHaveBeenCalledTimes(1);
        expect(structureMocks.rollLoot).toHaveBeenCalledWith('dungeon_catacomb', expect.any(Number));
        expect(world.structureProgress[chestInfo.structureId]).toEqual({ keyFound: true });
    });
});
