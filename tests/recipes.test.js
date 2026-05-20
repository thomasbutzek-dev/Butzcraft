/* tests/recipes.test.js - Reine Logik-Tests für das Crafting-System.
 *
 * Diese Datei deckt die kritischen Pfade ab:
 *  - Legacy-Rezepte werden korrekt normalisiert
 *  - Pattern-Shifting funktioniert (Holz im 2×2 egal wo positioniert → Bretter)
 *  - Shapeless-Rezepte matchen unabhängig von Reihenfolge
 *  - Negativ-Tests: falsche Pattern matchen NICHT (kein false-positive Crafting)
 */
import { describe, it, expect } from 'vitest';
import { matchRecipe, normalizeRecipe, craftingRecipes } from '../js/recipes.js';

describe('normalizeRecipe', () => {
    it('konvertiert Legacy-Form zu shaped/2×2', () => {
        const legacy = { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } };
        const norm = normalizeRecipe(legacy);
        expect(norm.kind).toBe('shaped');
        expect(norm.gridSize).toBe(2);
        expect(norm.pattern).toEqual([5, 0, 0, 0]);
        expect(norm.result).toEqual({ type: 26, count: 4 });
    });

    it('lässt bereits-normalisierte shaped-Rezepte unverändert (Idempotenz)', () => {
        const r = { kind: 'shaped', gridSize: 2, pattern: [1, 0, 0, 0], result: { type: 99, count: 1 } };
        expect(normalizeRecipe(r)).toBe(r);
    });

    it('lässt shapeless-Rezepte unverändert', () => {
        const r = { kind: 'shapeless', ingredients: [27, 27], result: { type: 1, count: 1 } };
        expect(normalizeRecipe(r)).toBe(r);
    });
});

describe('matchRecipe – Pattern-Shifting (shaped)', () => {
    // Wood→Planks Recipe: { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } }
    // Pattern-Shifting MUSS bewirken, dass Holz an JEDER Stelle des 2×2 Grids matcht.
    const recipes = [{ pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } }];

    it('matched Holz oben-links', () => {
        expect(matchRecipe([5, 0, 0, 0], 2, recipes)).toEqual({ type: 26, count: 4 });
    });

    it('matched Holz oben-rechts', () => {
        expect(matchRecipe([0, 5, 0, 0], 2, recipes)).toEqual({ type: 26, count: 4 });
    });

    it('matched Holz unten-links', () => {
        expect(matchRecipe([0, 0, 5, 0], 2, recipes)).toEqual({ type: 26, count: 4 });
    });

    it('matched Holz unten-rechts', () => {
        expect(matchRecipe([0, 0, 0, 5], 2, recipes)).toEqual({ type: 26, count: 4 });
    });

    it('matched NICHT, wenn falscher Block gelegt wurde', () => {
        expect(matchRecipe([3, 0, 0, 0], 2, recipes)).toBeNull();
    });

    it('matched NICHT, wenn zusätzlicher Block im Grid liegt', () => {
        expect(matchRecipe([5, 3, 0, 0], 2, recipes)).toBeNull();
    });
});

describe('matchRecipe – Shaped mit Form (Workbench-Recipe)', () => {
    // Workbench: 4 Bretter im 2×2 Quadrat
    const recipes = [{ pattern: [26, 26, 26, 26], result: { type: 28, count: 1 } }];

    it('matched 4 Bretter', () => {
        expect(matchRecipe([26, 26, 26, 26], 2, recipes)).toEqual({ type: 28, count: 1 });
    });

    it('matched NICHT mit nur 3 Brettern', () => {
        expect(matchRecipe([26, 26, 26, 0], 2, recipes)).toBeNull();
    });
});

describe('matchRecipe – Shapeless', () => {
    const recipes = [
        { kind: 'shapeless', ingredients: [27, 27, 26], result: { type: 99, count: 1 } }
    ];

    it('matched in Reihenfolge ABC', () => {
        expect(matchRecipe([27, 27, 26, 0], 2, recipes)).toEqual({ type: 99, count: 1 });
    });

    it('matched in beliebiger Reihenfolge (CBA)', () => {
        expect(matchRecipe([26, 27, 27, 0], 2, recipes)).toEqual({ type: 99, count: 1 });
    });

    it('matched mit verstreuten Slots', () => {
        expect(matchRecipe([27, 0, 26, 27], 2, recipes)).toEqual({ type: 99, count: 1 });
    });

    it('matched NICHT, wenn eine Zutat fehlt', () => {
        expect(matchRecipe([27, 27, 0, 0], 2, recipes)).toBeNull();
    });

    it('matched NICHT, wenn eine extra-Zutat dabei ist', () => {
        expect(matchRecipe([27, 27, 26, 5], 2, recipes)).toBeNull();
    });
});

describe('matchRecipe – Smoke-Test mit echten Spiel-Rezepten', () => {
    it('Wood→Planks funktioniert in der Production-Liste', () => {
        const result = matchRecipe([5, 0, 0, 0], 2, craftingRecipes);
        expect(result).toEqual({ type: 26, count: 4 });
    });

    it('Jungle Wood -> Planks funktioniert im 3x3-Inventar-Grid', () => {
        const result = matchRecipe([13, 0, 0, 0, 0, 0, 0, 0, 0], 3, craftingRecipes);
        expect(result).toEqual({ type: 26, count: 4 });
    });

    it('Palm Wood -> Planks funktioniert im 3x3-Inventar-Grid', () => {
        const result = matchRecipe([15, 0, 0, 0, 0, 0, 0, 0, 0], 3, craftingRecipes);
        expect(result).toEqual({ type: 26, count: 4 });
    });

    it('4 Planks → 1 Workbench funktioniert', () => {
        const result = matchRecipe([26, 26, 26, 26], 2, craftingRecipes);
        expect(result).toEqual({ type: 28, count: 1 });
    });

    it('Wool+Planks → Bed funktioniert', () => {
        const result = matchRecipe([19, 19, 26, 26], 2, craftingRecipes);
        expect(result).toEqual({ type: 38, count: 1 });
    });

    it('leeres Grid liefert null (kein Phantom-Recipe)', () => {
        expect(matchRecipe([0, 0, 0, 0], 2, craftingRecipes)).toBeNull();
    });
});
