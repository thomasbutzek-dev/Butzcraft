import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initRecipeBook } from '../js/recipe_book.js';

describe('recipe book initialization', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <div id="inventory-overlay">
                <div id="crafting-area"></div>
                <div id="inventory-grid"></div>
            </div>
        `;
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
        delete window.updateRecipeList;
    });

    it('builds the initial list without requiring a global refresh hook', () => {
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 5: 1, 26: 2 },
            [{ pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } }],
            { WOOD: 5, PLANKS: 26 },
            { WOOD: 'Holz', PLANKS: 'Holzbretter' },
            vi.fn()
        );

        expect(document.getElementById('recipe-book')).not.toBeNull();
        expect(document.querySelectorAll('.recipe-entry')).toHaveLength(1);
        expect(document.querySelector('.recipe-name').textContent).toBe('Holzbretter');
        expect(window.updateRecipeList).toBeUndefined();
    });

    it('groups recipes by station and explains locked entries', () => {
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 5: 1, 26: 2, 27: 3, 63: 4 },
            [
                { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } },
                { kind: 'shaped', gridSize: 3, pattern: [26, 26, 26, 0, 27, 0, 0, 27, 0], result: { type: 63, count: 1 } }
            ],
            { WOOD: 5, PLANKS: 26, STICK: 27, WOOD_PICKAXE: 63 },
            { WOOD: 'Holz', PLANKS: 'Holzbretter', STICK: 'Stock', WOOD_PICKAXE: 'Holz-Spitzhacke' },
            vi.fn(),
            { getLockReason: recipe => recipe.gridSize === 3 ? 'Werkbank erforderlich.' : '' }
        );

        expect([...document.querySelectorAll('.recipe-section-title')].map(el => el.textContent)).toEqual([
            'Im Inventar',
            'An der Werkbank'
        ]);
        expect(document.querySelectorAll('.recipe-entry.locked')).toHaveLength(1);
        expect(document.querySelector('.recipe-lock-reason').textContent).toBe('Werkbank erforderlich.');
    });
});
