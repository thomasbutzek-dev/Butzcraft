import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: {
        STONE: 3,
        WOOD: 5,
        SAND: 7,
        STONE_BRICK: 29,
        SANDSTONE: 30,
        COAL_ORE: 56,
        IRON_ORE: 57,
        GOLD_ORE: 58,
        COAL: 60,
        IRON_INGOT: 61,
        GOLD_INGOT: 62,
        PLANKS: 26,
        STICK: 27
    },
    BLOCK_TEX: {},
    atlasDataURL: ''
}));

vi.mock('../js/inventory.js', () => ({
    createBlockHTML: (type) => `<span>${type}</span>`,
    getItemName: (type) => `Item ${type}`
}));

function setFurnaceDom() {
    document.body.innerHTML = `
        <div id="furnace-overlay" style="display:none"></div>
        <div id="furnace-input-slot"></div>
        <div id="furnace-fuel-slot"></div>
        <div id="furnace-output-slot"></div>
        <div id="furnace-progress-bar"></div>
        <div id="furnace-status"></div>
    `;
}

async function loadFurnace() {
    vi.resetModules();
    return import('../js/furnace.js');
}

beforeEach(() => {
    setFurnaceDom();
    window.inventorySlots = Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
    window.getSelectedSlot = () => 0;
    window.updateInventoryUI = vi.fn();
    window.addItemToInventory = vi.fn();
});

describe('furnace inventory transfer', () => {
    it('moves smeltable items from main inventory into an empty input slot', async () => {
        const furnace = await loadFurnace();
        window.inventorySlots[16] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.getElementById('furnace-input-slot').click();

        expect(window.inventorySlots[16]).toEqual({ type: 0, count: 0 });
        expect(document.getElementById('furnace-input-slot').title).toBe('Item 57');
        expect(window.updateInventoryUI).toHaveBeenCalled();
    });

    it('returns an occupied input slot when the selected slot cannot add to it', async () => {
        const furnace = await loadFurnace();
        window.inventorySlots[0] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.getElementById('furnace-input-slot').click();
        document.getElementById('furnace-input-slot').click();

        expect(window.addItemToInventory).toHaveBeenCalledWith(57, 1);
        expect(document.getElementById('furnace-input-slot').title).toBe('');
    });

    it('keeps an occupied input slot when the inventory is full', async () => {
        const furnace = await loadFurnace();
        window.inventorySlots[16] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.getElementById('furnace-input-slot').click();
        for (let i = 0; i < window.inventorySlots.length; i++) {
            if (i < 8 || i >= 16) window.inventorySlots[i] = { type: 1, count: 64 };
        }
        window.addItemToInventory.mockReturnValue({ added: 0, remaining: 1 });

        document.getElementById('furnace-input-slot').click();

        expect(document.getElementById('furnace-input-slot').title).toBe('Item 57');
    });
});
