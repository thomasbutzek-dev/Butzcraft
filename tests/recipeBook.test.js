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
        expect(document.getElementById('recipe-search').getAttribute('aria-label')).toBe('Rezepte suchen');
        expect(document.querySelectorAll('.recipe-entry')).toHaveLength(1);
        expect(document.querySelector('.recipe-entry').tagName).toBe('BUTTON');
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

        const search = document.getElementById('recipe-search');
        search.value = 'Spitzhacke';
        search.dispatchEvent(new Event('input'));
        const entries = [...document.querySelectorAll('.recipe-entry')];
        expect(entries.map(entry => entry.hidden)).toEqual([true, false]);
        expect([...document.querySelectorAll('.recipe-section-title')].map(title => title.hidden)).toEqual([true, false]);
    });

    it('refreshes recipe availability without rebuilding every recipe card', () => {
        const recipes = [
            { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } }
        ];
        const blockTypes = { WOOD: 5, PLANKS: 26 };
        const translations = { WOOD: 'Holz', PLANKS: 'Holzbretter' };
        let lockReason = 'Fehlt: 1× Holz.';

        initRecipeBook(
            'data:image/png;base64,atlas',
            { 5: 1, 26: 2 },
            recipes,
            blockTypes,
            translations,
            vi.fn(),
            { getLockReason: () => lockReason }
        );
        const firstEntry = document.querySelector('.recipe-entry');

        lockReason = '';
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 5: 1, 26: 2 },
            recipes,
            blockTypes,
            translations,
            vi.fn(),
            { getLockReason: () => lockReason }
        );

        expect(document.querySelector('.recipe-entry')).toBe(firstEntry);
        expect(firstEntry.classList.contains('locked')).toBe(false);
        expect(firstEntry.querySelector('.recipe-lock-reason')).toBeNull();
    });

    it('filters recipes with the agreed category tabs', () => {
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 26: 2, 27: 3, 63: 4 },
            [
                { category: 'Versorgung', pattern: [26, 0, 0, 0], result: { type: 27, count: 4 } },
                { category: 'Werkzeuge', kind: 'shaped', gridSize: 3, pattern: [26, 26, 26, 0, 27, 0, 0, 27, 0], result: { type: 63, count: 1 } }
            ],
            { PLANKS: 26, STICK: 27, WOOD_PICKAXE: 63 },
            { PLANKS: 'Holzbretter', STICK: 'Stock', WOOD_PICKAXE: 'Holz-Spitzhacke' },
            vi.fn()
        );

        expect([...document.querySelectorAll('.recipe-category-tab')].map(tab => tab.textContent)).toEqual([
            'Alle', 'Bauen', 'Werkzeuge', 'Kampf', 'Versorgung'
        ]);
        document.querySelector('[data-category="Werkzeuge"]').click();
        expect([...document.querySelectorAll('.recipe-entry')].map(entry => entry.hidden)).toEqual([true, false]);
    });

    it('shows a custom title for a visible trust recipe', () => {
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 26: 2, 27: 3, 102: 4 },
            [{
                name: 'Verstärkter Dorfzaun', requiredTrust: 3, category: 'Bauen',
                kind: 'shaped', gridSize: 3,
                pattern: [26, 27, 26, 26, 27, 26, 0, 0, 0],
                result: { type: 102, count: 8 }
            }],
            { PLANKS: 26, STICK: 27, WOOD_FENCE: 102 },
            { PLANKS: 'Holzbretter', STICK: 'Stock', WOOD_FENCE: 'Holzzaun' },
            vi.fn(),
            { getLockReason: () => 'Bekanntes Dorf erforderlich (3 Vertrauen).' }
        );

        expect(document.querySelector('.recipe-name').textContent).toBe('Verstärkter Dorfzaun');
        expect(document.querySelector('[data-recipe-icon="fence"]')).not.toBeNull();
        expect(document.querySelector('.recipe-entry').classList.contains('locked')).toBe(true);
    });

    it('uses distinct silhouettes for fence and gate outputs', () => {
        initRecipeBook(
            'data:image/png;base64,atlas',
            { 26: 2, 27: 3, 102: 4, 103: 4 },
            [
                { category: 'Bauen', kind: 'shaped', gridSize: 3, pattern: [27,26,27, 27,26,27, 0,0,0], result: { type: 102, count: 4 } },
                { category: 'Bauen', kind: 'shaped', gridSize: 3, pattern: [27,27,27, 26,26,27, 0,0,0], result: { type: 103, count: 1 } }
            ],
            { PLANKS: 26, STICK: 27, WOOD_FENCE: 102, WOOD_GATE: 103 },
            { PLANKS: 'Holzbretter', STICK: 'Stock', WOOD_FENCE: 'Holzzaun', WOOD_GATE: 'Holzgatter' },
            vi.fn()
        );

        expect(document.querySelectorAll('[data-recipe-icon="fence"]')).toHaveLength(1);
        expect(document.querySelectorAll('[data-recipe-icon="gate"]')).toHaveLength(1);
    });
});
