/* js/recipes.js - Butzcraft Crafting Recipes */

export const craftingRecipes = [
    { pattern: [5, 0, 0, 0], result: { type: 26, count: 4 } },       // WOOD -> 4x PLANKS
    { pattern: [26, 0, 26, 0], result: { type: 27, count: 4 } },     // 2x PLANKS -> 4x STICK
    { pattern: [26, 26, 26, 26], result: { type: 28, count: 1 } },   // 4x PLANKS -> 1x WORKBENCH
    { pattern: [3, 3, 3, 3], result: { type: 29, count: 4 } },       // 4x STONE -> 4x STONE_BRICK
    { pattern: [7, 7, 7, 7], result: { type: 30, count: 4 } },       // 4x SAND -> 4x SANDSTONE
    { pattern: [26, 12, 12, 26], result: { type: 32, count: 1 } },   // PLANKS+ICE -> WINDOW
    { pattern: [27, 26, 27, 26], result: { type: 33, count: 1 } },   // STICK+PLANKS -> DOOR
    { pattern: [19, 19, 26, 26], result: { type: 38, count: 1 } }    // WOOL+PLANKS -> BED
];
