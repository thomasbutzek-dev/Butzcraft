/* js/recipes.js - Butzcraft Crafting Recipes
 *
 * Schema:
 *   Shaped (mit Position):
 *     { kind: 'shaped', gridSize: 2, pattern: [a,b,c,d], result: { type, count } }
 *     - gridSize 2 = 2×2 (4 Zellen), gridSize 3 = 3×3 (9 Zellen, derzeit nicht UI-sichtbar)
 *     - 0 = leer, sonst Block-Type
 *     - Pattern darf KLEINER als das User-Grid sein → wird automatisch verschoben (Pattern-Shifting)
 *
 *   Shapeless (unsortiert):
 *     { kind: 'shapeless', ingredients: [a,b,c], result: { type, count } }
 *     - matched, wenn User-Grid genau diese Zutaten enthält (in beliebiger Reihenfolge)
 *
 *   Legacy (vor Sprint 3): { pattern: [...], result: {...} } wird als shaped/2×2 interpretiert.
 */

export const craftingRecipes = [
    // Bestehende Rezepte (Legacy-Form, weiterhin gültig):
    { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } },       // WOOD -> 4x PLANKS (Pattern-Shifting!)
    { pattern: [13, 0, 0, 0], result: { type: 26, count: 4 } },      // JUNGLE_WOOD -> 4x PLANKS
    { pattern: [15, 0, 0, 0], result: { type: 26, count: 4 } },      // PALM_WOOD -> 4x PLANKS
    { pattern: [26, 0, 26, 0], result: { type: 27, count: 4 } },     // 2x PLANKS -> 4x STICK
    { pattern: [26, 26, 26, 26], result: { type: 28, count: 1 } },   // 4x PLANKS -> 1x WORKBENCH
    { pattern: [3, 3, 3, 3], result: { type: 29, count: 4 } },       // 4x STONE -> 4x STONE_BRICK
    { pattern: [7, 7, 7, 7], result: { type: 30, count: 4 } },       // 4x SAND -> 4x SANDSTONE
    { pattern: [26, 12, 12, 26], result: { type: 32, count: 1 } },   // PLANKS+ICE -> WINDOW
    { pattern: [27, 26, 27, 26], result: { type: 33, count: 1 } },   // STICK+PLANKS -> DOOR
    { pattern: [19, 19, 26, 26], result: { type: 38, count: 1 } },   // WOOL+PLANKS -> BED

    // Neue 3×3-Rezepte: Werkzeuge
    // Schema: pattern[0..8] = Zeile0-2, Spalte0-2
    // Spitzhacken (3 Material oben, 2 Stöcke Mitte/unten)
    { kind: 'shaped', gridSize: 3, pattern: [26,26,26, 0,27,0, 0,27,0], result: { type: 63, count: 1 } }, // Holz-Spitzhacke
    { kind: 'shaped', gridSize: 3, pattern: [3, 3, 3,  0,27,0, 0,27,0], result: { type: 64, count: 1 } }, // Stein-Spitzhacke
    { kind: 'shaped', gridSize: 3, pattern: [61,61,61, 0,27,0, 0,27,0], result: { type: 65, count: 1 } }, // Eisen-Spitzhacke
    { kind: 'shaped', gridSize: 3, pattern: [62,62,62, 0,27,0, 0,27,0], result: { type: 66, count: 1 } }, // Gold-Spitzhacke
    // Äxte (L-Form: 2 Material + 1 Material, 1 Stock, 1 Stock)
    { kind: 'shaped', gridSize: 3, pattern: [26,26,0, 26,27,0, 0,27,0], result: { type: 67, count: 1 } }, // Holz-Axt
    { kind: 'shaped', gridSize: 3, pattern: [3, 3, 0, 3, 27,0, 0,27,0], result: { type: 68, count: 1 } }, // Stein-Axt
    { kind: 'shaped', gridSize: 3, pattern: [61,61,0, 61,27,0, 0,27,0], result: { type: 69, count: 1 } }, // Eisen-Axt
    { kind: 'shaped', gridSize: 3, pattern: [62,62,0, 62,27,0, 0,27,0], result: { type: 70, count: 1 } }, // Gold-Axt
    // Schaufeln (1 Material oben, 2 Stöcke)
    { kind: 'shaped', gridSize: 3, pattern: [0,26,0, 0,27,0, 0,27,0], result: { type: 71, count: 1 } }, // Holz-Schaufel
    { kind: 'shaped', gridSize: 3, pattern: [0, 3,0, 0,27,0, 0,27,0], result: { type: 72, count: 1 } }, // Stein-Schaufel
    { kind: 'shaped', gridSize: 3, pattern: [0,61,0, 0,27,0, 0,27,0], result: { type: 73, count: 1 } }, // Eisen-Schaufel
    { kind: 'shaped', gridSize: 3, pattern: [0,62,0, 0,27,0, 0,27,0], result: { type: 74, count: 1 } }, // Gold-Schaufel
    // Schwerter (2 Material übereinander, 1 Stock als Griff)
    { kind: 'shaped', gridSize: 3, pattern: [0,26,0, 0,26,0, 0,27,0], result: { type: 89, count: 1 } }, // Holzschwert
    { kind: 'shaped', gridSize: 3, pattern: [0, 3,0, 0, 3,0, 0,27,0], result: { type: 90, count: 1 } }, // Steinschwert
    { kind: 'shaped', gridSize: 3, pattern: [0,61,0, 0,61,0, 0,27,0], result: { type: 91, count: 1 } }, // Eisenschwert
    { kind: 'shaped', gridSize: 3, pattern: [0,62,0, 0,62,0, 0,27,0], result: { type: 92, count: 1 } }, // Goldschwert
    // Fernkampf: Bogen an der Werkbank, Pfeile günstig auch unterwegs
    { kind: 'shaped', gridSize: 3, pattern: [27,93,0, 27,0,93, 27,93,0], result: { type: 94, count: 1 } }, // Bogen
    { kind: 'shapeless', ingredients: [3,27], result: { type: 95, count: 4 } }, // 4 Pfeile
    // Ofen (8x Stein im Ring)
    { kind: 'shaped', gridSize: 3, pattern: [3,3,3, 3,0,3, 3,3,3], result: { type: 59, count: 1 } }, // Ofen
];

/**
 * Normalisiert ein Recipe-Objekt zu interner Form. Idempotent.
 */
export function normalizeRecipe(recipe) {
    if (recipe.kind === 'shapeless') return recipe;
    if (recipe.kind === 'shaped') return recipe;
    // Legacy: { pattern, result } → shaped/2×2
    return { kind: 'shaped', gridSize: 2, pattern: recipe.pattern, result: recipe.result };
}

/**
 * Findet alle nicht-leeren Pattern-Zellen und ihre Bounding-Box (für Pattern-Shifting).
 */
function patternBounds(pattern, size) {
    let minR = size, maxR = -1, minC = size, maxC = -1;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (pattern[r * size + c] !== 0) {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            }
        }
    }
    if (maxR === -1) return null; // komplett leer
    return { minR, maxR, minC, maxC, h: maxR - minR + 1, w: maxC - minC + 1 };
}

/**
 * Prüft, ob ein User-Grid (gridSize × gridSize) auf ein Pattern matched, ggf. verschoben.
 * Das Pattern wird durch alle gültigen Offsets im User-Grid geschoben — matcht, wenn an
 * irgendeiner Position alle Pattern-Zellen exakt liegen UND außerhalb davon nichts steht.
 */
function matchShaped(userPattern, userSize, recipePattern, recipeSize) {
    if (recipeSize > userSize) return false;
    const rb = patternBounds(recipePattern, recipeSize);
    if (!rb) return false;

    for (let dr = 0; dr <= userSize - rb.h; dr++) {
        for (let dc = 0; dc <= userSize - rb.w; dc++) {
            let ok = true;
            for (let r = 0; r < userSize && ok; r++) {
                for (let c = 0; c < userSize && ok; c++) {
                    const uVal = userPattern[r * userSize + c];
                    const rR = r - dr + rb.minR;
                    const rC = c - dc + rb.minC;
                    let want = 0;
                    if (rR >= rb.minR && rR <= rb.maxR && rC >= rb.minC && rC <= rb.maxC) {
                        want = recipePattern[rR * recipeSize + rC];
                    }
                    if (uVal !== want) ok = false;
                }
            }
            if (ok) return true;
        }
    }
    return false;
}

/**
 * Shapeless: Multiset-Vergleich der Nicht-Null-Werte.
 */
function matchShapeless(userPattern, ingredients) {
    const userBag = userPattern.filter(v => v !== 0).sort((a, b) => a - b);
    const recipeBag = ingredients.slice().sort((a, b) => a - b);
    if (userBag.length !== recipeBag.length) return false;
    for (let i = 0; i < userBag.length; i++) if (userBag[i] !== recipeBag[i]) return false;
    return true;
}

/**
 * Hauptfunktion: gibt das passende Result oder null zurück.
 */
export function matchRecipe(userPattern, userGridSize, recipes) {
    for (const raw of recipes) {
        const r = normalizeRecipe(raw);
        if (r.kind === 'shapeless') {
            if (matchShapeless(userPattern, r.ingredients)) return r.result;
        } else {
            if (matchShaped(userPattern, userGridSize, r.pattern, r.gridSize || userGridSize)) return r.result;
        }
    }
    return null;
}
