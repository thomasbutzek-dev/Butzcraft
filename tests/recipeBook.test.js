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
});
