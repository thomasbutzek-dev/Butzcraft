import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/structures.js', () => ({
    rollLoot: () => [{ type: 60, count: 2 }]
}));

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
});
