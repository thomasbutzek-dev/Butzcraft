/* js/crafting.js - Butzcraft Crafting System Logic */
import { craftingRecipes, getRecipeTrustLockReason, matchRecipe } from './recipes.js?v=20260721b';

const CRAFTING_GRID_SIZE = 3;
let activeCraftingGridSize = 2;

export let craftingGridData = Array.from({ length: CRAFTING_GRID_SIZE * CRAFTING_GRID_SIZE }, () => ({ type: 0, count: 0 }));
export let craftingResultData = { type: 0, count: 0 };

export function setCraftingGridSize(size) {
    activeCraftingGridSize = size === 3 ? 3 : 2;
    checkCrafting();
}

export function getCraftingGridSize() {
    return activeCraftingGridSize;
}

export function checkCrafting() {
    const activeSlots = activeCraftingGridSize === 3
        ? craftingGridData
        : [craftingGridData[0], craftingGridData[1], craftingGridData[3], craftingGridData[4]];
    const currentPattern = activeSlots.map(slot => slot.count > 0 ? slot.type : 0);

    const trust = globalThis.window?.getHighestVillageTrust?.() || 0;
    const availableRecipes = craftingRecipes.filter(recipe => !getRecipeTrustLockReason(recipe, trust));
    const result = matchRecipe(currentPattern, activeCraftingGridSize, availableRecipes);
    if (result) {
        craftingResultData.type = result.type;
        craftingResultData.count = result.count;
    } else {
        craftingResultData.type = 0;
        craftingResultData.count = 0;
    }
}
