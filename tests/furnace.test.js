import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const inventoryMock = vi.hoisted(() => ({
    slots: Array.from({ length: 64 }, () => ({ type: 0, count: 0 }))
}));

vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: {
        STONE: 3,
        WOOD: 5,
        SAND: 7,
        JUNGLE_WOOD: 13,
        PALM_WOOD: 15,
        STONE_BRICK: 29,
        SANDSTONE: 30,
        COAL_ORE: 56,
        IRON_ORE: 57,
        GOLD_ORE: 58,
        COAL: 60,
        IRON_INGOT: 61,
        GOLD_INGOT: 62,
        PLANKS: 26,
        STICK: 27,
        FISH: 21,
        RAW_MEAT: 22,
        RAW_CHICKEN: 23,
        MUTTON: 25,
        TURTLE_MEAT: 55,
        COOKED_FISH: 96,
        COOKED_MEAT: 97,
        COOKED_CHICKEN: 98,
        COOKED_MUTTON: 99,
        COOKED_TURTLE_MEAT: 100
    },
    BLOCK_TEX: {},
    atlasDataURL: ''
}));

vi.mock('../js/inventory.js', () => ({
    inventorySlots: inventoryMock.slots,
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
        <div id="furnace-fuel-reserve"></div>
        <div id="furnace-status"></div>
        <div id="furnace-selection-title"></div>
        <div id="furnace-inventory-grid"></div>
    `;
}

async function loadFurnace() {
    vi.resetModules();
    return import('../js/furnace.js?v=20260717e');
}

beforeEach(() => {
    vi.restoreAllMocks();
    setFurnaceDom();
    for (let i = 0; i < inventoryMock.slots.length; i++) {
        inventoryMock.slots[i] = { type: 0, count: 0 };
    }
    window.getSelectedSlot = () => 0;
    window.updateInventoryUI = vi.fn();
    window.addItemToInventory = vi.fn();
});

describe('furnace inventory transfer', () => {
    it('contains the item picker and visible fuel reserve in the real furnace UI', () => {
        const html = readFileSync('index.html', 'utf8');

        expect(html).toContain('id="furnace-inventory-grid"');
        expect(html).toContain('id="furnace-fuel-reserve"');
    });

    it('lets the player choose a specific smeltable inventory stack', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };
        inventoryMock.slots[1] = { type: 58, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        const goldButton = document.querySelector('[data-furnace-inventory-index="1"]');
        expect(goldButton).not.toBeNull();
        goldButton.click();

        expect(document.getElementById('furnace-input-slot').title).toBe('Item 58');
        expect(inventoryMock.slots[0]).toEqual({ type: 57, count: 1 });
    });

    it('shows only items allowed for the explicitly selected furnace slot', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 1, count: 1 };
        inventoryMock.slots[1] = { type: 57, count: 1 };
        inventoryMock.slots[2] = { type: 60, count: 1 };
        inventoryMock.slots[10] = { type: 58, count: 1 };

        furnace.openFurnace(0, 0, 0, null);

        expect(document.getElementById('furnace-selection-title').textContent).toBe('Schmelzen / Garen: geeigneten Gegenstand wählen');
        expect(document.querySelector('[data-furnace-inventory-index="0"]')).toBeNull();
        expect(document.querySelector('[data-furnace-inventory-index="1"]')).not.toBeNull();
        expect(document.querySelector('[data-furnace-inventory-index="2"]')).toBeNull();
        expect(document.querySelector('[data-furnace-inventory-index="10"]')).toBeNull();

        document.getElementById('furnace-fuel-slot').click();

        expect(document.getElementById('furnace-selection-title').textContent).toBe('Brennstoff: geeigneten Gegenstand wählen');
        expect(document.querySelector('[data-furnace-inventory-index="0"]')).toBeNull();
        expect(document.querySelector('[data-furnace-inventory-index="1"]')).toBeNull();
        expect(document.querySelector('[data-furnace-inventory-index="2"]')).not.toBeNull();
    });

    it('shows consumed fuel as an active reserve', async () => {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };
        inventoryMock.slots[1] = { type: 60, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        document.getElementById('furnace-fuel-slot').click();
        document.querySelector('[data-furnace-inventory-index="1"]').click();
        now += 100;
        furnace.tickFurnace(null);

        expect(document.getElementById('furnace-fuel-reserve').textContent).toContain('Item 60');
        expect(document.getElementById('furnace-fuel-reserve').textContent).toContain('8');
    });

    it('keeps contents and fuel separate for each furnace position', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };

        furnace.openFurnace(1, 2, 3, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        furnace.closeFurnace(null);
        furnace.openFurnace(9, 2, 3, null);

        expect(document.getElementById('furnace-input-slot').title).toBe('');
    });

    it('does not let one furnace power another furnace', async () => {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };
        inventoryMock.slots[1] = { type: 60, count: 1 };
        inventoryMock.slots[2] = { type: 58, count: 1 };

        furnace.openFurnace(1, 2, 3, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        document.getElementById('furnace-fuel-slot').click();
        document.querySelector('[data-furnace-inventory-index="1"]').click();
        now += 100;
        furnace.tickFurnace(null);
        furnace.closeFurnace(null);

        furnace.openFurnace(9, 2, 3, null);
        document.querySelector('[data-furnace-inventory-index="2"]').click();
        now += 6000;
        furnace.tickFurnace(null);

        expect(document.getElementById('furnace-status').textContent).toBe('Warte auf Brennstoff');
        expect(document.getElementById('furnace-output-slot').title).toBe('');
    });

    it('makes dense fuel more valuable and keeps smelting casual-friendly', async () => {
        const furnace = await loadFurnace();

        expect(furnace.getFuelValue(60)).toBe(8);
        expect(furnace.getFuelValue(5)).toBe(3);
        expect(furnace.getFuelValue(13)).toBe(3);
        expect(furnace.getFuelValue(15)).toBe(3);
        expect(furnace.getFuelValue(26)).toBe(2);
        expect(furnace.getFuelValue(27)).toBe(1);
        expect(furnace.getFuelValue(57)).toBe(0);
        expect(furnace.getSmeltTime()).toBe(6000);
    });

    it('turns every wood type into charcoal', async () => {
        const furnace = await loadFurnace();

        expect(furnace.getSmeltRecipe(5)).toEqual({ type: 60, count: 1 });
        expect(furnace.getSmeltRecipe(13)).toEqual({ type: 60, count: 1 });
        expect(furnace.getSmeltRecipe(15)).toEqual({ type: 60, count: 1 });
    });

    it('smelts eight items with one piece of coal', async () => {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 8 };
        inventoryMock.slots[1] = { type: 60, count: 1 };
        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        document.getElementById('furnace-fuel-slot').click();
        document.querySelector('[data-furnace-inventory-index="1"]').click();

        for (let i = 0; i < 8; i++) {
            now += 6000;
            furnace.tickFurnace(null);
        }

        expect(document.querySelector('#furnace-output-slot .slot-count').textContent).toBe('8');
        expect(document.getElementById('furnace-input-slot').title).toBe('');
        expect(document.getElementById('furnace-fuel-slot').title).toBe('');
    });

    it('explains when a different output blocks the next recipe', async () => {
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };
        inventoryMock.slots[1] = { type: 60, count: 1 };
        inventoryMock.slots[2] = { type: 58, count: 1 };
        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        document.getElementById('furnace-fuel-slot').click();
        document.querySelector('[data-furnace-inventory-index="1"]').click();
        now += 6000;
        furnace.tickFurnace(null);
        document.getElementById('furnace-input-slot').click();
        document.querySelector('[data-furnace-inventory-index="2"]').click();
        furnace.tickFurnace(null);

        expect(document.getElementById('furnace-status').textContent).toBe('Ausgabe leeren');
    });

    it('turns every raw animal food into its cooked version', async () => {
        const furnace = await loadFurnace();

        expect(furnace.getSmeltRecipe(21)).toEqual({ type: 96, count: 1 });
        expect(furnace.getSmeltRecipe(22)).toEqual({ type: 97, count: 1 });
        expect(furnace.getSmeltRecipe(23)).toEqual({ type: 98, count: 1 });
        expect(furnace.getSmeltRecipe(25)).toEqual({ type: 99, count: 1 });
        expect(furnace.getSmeltRecipe(55)).toEqual({ type: 100, count: 1 });
        expect(furnace.getSmeltRecipe(24)).toBeNull();
    });

    it('moves the selected stack from main inventory into an empty input slot', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[16] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="16"]').click();

        expect(inventoryMock.slots[16]).toEqual({ type: 0, count: 0 });
        expect(document.getElementById('furnace-input-slot').title).toBe('Item 57');
        expect(window.updateInventoryUI).toHaveBeenCalled();
    });

    it('returns an occupied input slot when the selected slot cannot add to it', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[0] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="0"]').click();
        document.getElementById('furnace-input-slot').click();

        expect(window.addItemToInventory).toHaveBeenCalledWith(57, 1);
        expect(document.getElementById('furnace-input-slot').title).toBe('');
    });

    it('keeps an occupied input slot when the inventory is full', async () => {
        const furnace = await loadFurnace();
        inventoryMock.slots[16] = { type: 57, count: 1 };

        furnace.openFurnace(0, 0, 0, null);
        document.querySelector('[data-furnace-inventory-index="16"]').click();
        for (let i = 0; i < inventoryMock.slots.length; i++) {
            if (i < 8 || i >= 16) inventoryMock.slots[i] = { type: 1, count: 64 };
        }
        window.addItemToInventory.mockReturnValue({ added: 0, remaining: 1 });

        document.getElementById('furnace-input-slot').click();

        expect(document.getElementById('furnace-input-slot').title).toBe('Item 57');
    });
});
