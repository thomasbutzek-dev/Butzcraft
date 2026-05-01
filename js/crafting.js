/* js/crafting.js - Butzcraft Crafting System Logic */
import { craftingRecipes, matchRecipe } from './recipes.js';

// User-facing Grid bleibt 2×2 (4 Slots). Erweiterung auf 3×3 erfordert separates UI-Refactor.
const CRAFTING_GRID_SIZE = 2;

export let craftingGridData = Array.from({ length: CRAFTING_GRID_SIZE * CRAFTING_GRID_SIZE }, () => ({ type: 0, count: 0 }));
export let craftingResultData = { type: 0, count: 0 };

export function checkCrafting() {
    const currentPattern = craftingGridData.map(slot => slot.count > 0 ? slot.type : 0);

    const result = matchRecipe(currentPattern, CRAFTING_GRID_SIZE, craftingRecipes);
    if (result) {
        craftingResultData.type = result.type;
        craftingResultData.count = result.count;
    } else {
        craftingResultData.type = 0;
        craftingResultData.count = 0;
    }
}
