import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const recipeBookState = vi.hoisted(() => ({ onRecipeClick: null }));

vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: { WOOD: 5, PLANKS: 26 },
    BLOCK_TEX: {},
    atlasDataURL: ''
}));
vi.mock('../js/recipe_book.js', () => ({
    initRecipeBook: (...args) => {
        recipeBookState.onRecipeClick = args.at(-1);
    }
}));
vi.mock('../js/sound.js', () => ({ SoundManager: { playSound: () => {} } }));

const {
    inventorySlots,
    isInventoryOpened,
    toggleInventory
} = await import('../js/inventory.js');
const { craftingGridData } = await import('../js/crafting.js');

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

beforeEach(() => {
    document.body.innerHTML = `
        <div id="inventory"></div>
        <div id="inventory-overlay" style="display:none">
            <div id="crafting-status" role="status"></div>
            <div id="crafting-grid"></div>
            <div id="crafting-result"></div>
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
    controls.lock.mockClear();
    controls.unlock.mockClear();
});

afterEach(() => {
    if (isInventoryOpened()) toggleInventory(true, false, controls);
});

describe('recipe selection', () => {
    it('does not create crafting ingredients when the inventory is empty', () => {
        toggleInventory(true, false, controls);

        recipeBookState.onRecipeClick(planksRecipe);

        expect(craftingGridData[0]).toEqual({ type: 0, count: 0 });
        expect(inventorySlots.every(slot => slot.count === 0)).toBe(true);
        expect(document.getElementById('crafting-status').textContent).toContain('Zutaten fehlen');
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
});

describe('crafting controls', () => {
    it('provides visible labels, feedback and a close button', () => {
        const html = readFileSync('index.html', 'utf8');
        const page = new DOMParser().parseFromString(html, 'text/html');

        expect(page.getElementById('inventory-close-btn').textContent.trim()).toBe('Schließen');
        expect(page.getElementById('crafting-label').textContent).toBe('Bastelfeld');
        expect(page.getElementById('crafting-status').getAttribute('aria-live')).toBe('polite');
    });
});
