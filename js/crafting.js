/* js/crafting.js - Butzcraft Crafting System Logic */
import { craftingRecipes } from './recipes.js';

export let craftingGridData = Array.from({ length: 4 }, () => ({ type: 0, count: 0 }));
export let craftingResultData = { type: 0, count: 0 };

export function checkCrafting() {
    // Aktuelles Pattern bauen, leere Slots als 0
    const currentPattern = craftingGridData.map(slot => slot.count > 0 ? slot.type : 0);
    
    craftingResultData.type = 0;
    craftingResultData.count = 0;
    
    for (const recipe of craftingRecipes) {
        let match = true;
        for (let i = 0; i < 4; i++) {
            if (recipe.pattern[i] !== currentPattern[i]) {
                match = false; break;
            }
        }
        if (match) {
            craftingResultData.type = recipe.result.type;
            craftingResultData.count = recipe.result.count;
            break;
        }
    }
}
