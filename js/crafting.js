/* js/crafting.js - Butzcraft Crafting System Logic */
import { craftingRecipes, matchRecipe } from './recipes.js?v=20260507b';

const CRAFTING_GRID_SIZE = 3;

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
