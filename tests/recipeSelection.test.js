import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const recipeBookState = vi.hoisted(() => ({ onRecipeClick: null, options: null }));

vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: { WOOD: 5, PLANKS: 26 },
    BLOCK_TEX: {},
    atlasDataURL: ''
}));
vi.mock('../js/recipe_book.js', () => ({
    initRecipeBook: (...args) => {
        recipeBookState.onRecipeClick = args[5];
        recipeBookState.options = args[6];
    }
}));
vi.mock('../js/sound.js', () => ({ SoundManager: { playSound: () => {} } }));

const {
    inventorySlots,
    craftCurrentRecipe,
    getCraftingStation,
    isInventoryOpened,
    openWorkbenchCrafting,
    toggleInventory
} = await import('../js/inventory.js');
const { checkCrafting, craftingGridData, craftingResultData } = await import('../js/crafting.js');

const controls = {
    lock: vi.fn(),
    unlock: vi.fn()
};
const planksRecipe = {
    kind: 'shaped',
    gridSize: 2,
    pattern: [5, 0, 0, 0],
    result: { type: 26, count: 4 }
};
const woodPickRecipe = {
    kind: 'shaped',
    gridSize: 3,
    pattern: [26, 26, 26, 0, 27, 0, 0, 27, 0],
    result: { type: 63, count: 1 }
};

beforeEach(() => {
    document.body.innerHTML = `
        <div id="inventory"></div>
        <div id="inventory-overlay" style="display:none">
            <div id="crafting-status" role="status"></div>
            <div id="crafting-grid"></div>
            <div id="crafting-result"></div>
            <button id="crafting-create-btn">Herstellen</button>
            <div id="inventory-grid"></div>
        </div>
    `;
    for (let i = 0; i < inventorySlots.length; i++) {
        inventorySlots[i] = { type: 0, count: 0 };
    }
    for (let i = 0; i < craftingGridData.length; i++) {
        craftingGridData[i] = { type: 0, count: 0 };
    }
    recipeBookState.onRecipeClick = null;
    recipeBookState.options = null;
    controls.lock.mockClear();
    controls.unlock.mockClear();
    window.getHighestVillageTrust = () => 0;
});

afterEach(() => {
    if (isInventoryOpened()) toggleInventory(true, false, controls);
    delete window.getHighestVillageTrust;
});

describe('recipe selection', () => {
    it('does not create crafting ingredients when the inventory is empty', () => {
        toggleInventory(true, false, controls);

        recipeBookState.onRecipeClick(planksRecipe);

        expect(craftingGridData[0]).toEqual({ type: 0, count: 0 });
        expect(inventorySlots.every(slot => slot.count === 0)).toBe(true);
        expect(document.getElementById('crafting-status').textContent).toBe('Fehlt: 1× Eichenholz.');
    });

    it('moves required ingredients from inventory into the crafting grid', () => {
        inventorySlots[0] = { type: 5, count: 2 };
        toggleInventory(true, false, controls);

        recipeBookState.onRecipeClick(planksRecipe);

        expect(inventorySlots[0]).toEqual({ type: 5, count: 1 });
        expect(craftingGridData[0]).toEqual({ type: 5, count: 1 });
        expect(document.getElementById('crafting-status').textContent).toBe('Rezept eingesetzt.');
    });

    it('keeps existing crafting ingredients when the selected recipe is unavailable', () => {
        craftingGridData[0] = { type: 26, count: 1 };
        toggleInventory(true, false, controls);

        recipeBookState.onRecipeClick(planksRecipe);

        expect(craftingGridData[0]).toEqual({ type: 26, count: 1 });
    });

    it('locks 3x3 recipes in the inventory without moving ingredients', () => {
        inventorySlots[0] = { type: 26, count: 3 };
        inventorySlots[1] = { type: 27, count: 2 };
        toggleInventory(true, false, controls);

        recipeBookState.onRecipeClick(woodPickRecipe);

        expect(getCraftingStation()).toBe('inventory');
        expect(craftingGridData.every(slot => slot.count === 0)).toBe(true);
        expect(document.getElementById('crafting-status').textContent).toBe('Werkbank erforderlich.');
    });

    it('opens a placed workbench as a 3x3 crafting station', () => {
        inventorySlots[0] = { type: 26, count: 3 };
        inventorySlots[1] = { type: 27, count: 2 };
        openWorkbenchCrafting(true, false, controls);

        recipeBookState.onRecipeClick(woodPickRecipe);

        expect(getCraftingStation()).toBe('workbench');
        expect(document.getElementById('crafting-grid').children).toHaveLength(9);
        expect(craftingResultData).toEqual({ type: 63, count: 1 });
    });

    it('blocks manually entered trust recipes until the required village trust was reached', () => {
        openWorkbenchCrafting(true, false, controls);
        [0, 61, 0, 0, 61, 0, 62, 27, 62].forEach((type, index) => {
            craftingGridData[index] = { type, count: type === 0 ? 0 : 1 };
        });

        checkCrafting();
        expect(craftingResultData).toEqual({ type: 0, count: 0 });

        window.getHighestVillageTrust = () => 12;
        checkCrafting();
        expect(craftingResultData).toEqual({ type: 91, count: 2 });
    });

    it('crafts directly into the inventory and gives tools full durability', () => {
        inventorySlots[0] = { type: 26, count: 3 };
        inventorySlots[1] = { type: 27, count: 2 };
        openWorkbenchCrafting(true, false, controls);
        recipeBookState.onRecipeClick(woodPickRecipe);

        const result = craftCurrentRecipe();

        expect(result).toEqual({ crafted: true, reason: null });
        expect(inventorySlots.some(slot => slot.type === 63 && slot.durability === 120)).toBe(true);
        expect(craftingGridData.every(slot => slot.count === 0)).toBe(true);
    });

    it('keeps ingredients and result untouched when the output does not fit', () => {
        for (let i = 0; i < inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventorySlots[i] = { type: 1, count: 64 };
        }
        inventorySlots[0] = { type: 5, count: 64 };
        toggleInventory(true, false, controls);
        recipeBookState.onRecipeClick(planksRecipe);
        const inventoryBefore = inventorySlots.map(slot => ({ ...slot }));
        const craftingBefore = craftingGridData.map(slot => ({ ...slot }));

        const result = craftCurrentRecipe();

        expect(result).toEqual({ crafted: false, reason: 'inventory-full' });
        expect(inventorySlots).toEqual(inventoryBefore);
        expect(craftingGridData).toEqual(craftingBefore);
        expect(craftingResultData).toEqual({ type: 26, count: 4 });
    });

    it('returns unused crafting ingredients when the inventory closes', () => {
        inventorySlots[0] = { type: 5, count: 2 };
        toggleInventory(true, false, controls);
        recipeBookState.onRecipeClick(planksRecipe);

        toggleInventory(true, false, controls);

        expect(craftingGridData.every(slot => slot.count === 0)).toBe(true);
        expect(inventorySlots[0]).toEqual({ type: 5, count: 2 });
    });
});

describe('crafting controls', () => {
    it('provides visible labels, feedback and a close button', () => {
        const html = readFileSync('index.html', 'utf8');
        const page = new DOMParser().parseFromString(html, 'text/html');

        expect(page.getElementById('inventory-close-btn').textContent.trim()).toBe('Schließen');
        expect(page.getElementById('crafting-label').textContent).toBe('Bastelfeld');
        expect(page.getElementById('crafting-create-btn').textContent.trim()).toBe('Herstellen');
        expect(page.getElementById('crafting-status').getAttribute('aria-live')).toBe('polite');
    });
});
