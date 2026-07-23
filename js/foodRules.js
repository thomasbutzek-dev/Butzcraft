const FOODS = Object.freeze({
    17: Object.freeze({ hunger: 5, cooked: false, shelfLife: 300 }),
    18: Object.freeze({ hunger: 15, cooked: false, shelfLife: 300 }),
    21: Object.freeze({ hunger: 10, cooked: false, shelfLife: 600 }),
    22: Object.freeze({ hunger: 15, cooked: false, shelfLife: 600 }),
    23: Object.freeze({ hunger: 10, cooked: false, shelfLife: 600 }),
    24: Object.freeze({ hunger: 5, cooked: false, damageChance: 0.3, damage: 5 }),
    25: Object.freeze({ hunger: 12, cooked: false, shelfLife: 600 }),
    51: Object.freeze({ hunger: 8, cooked: false, shelfLife: 450 }),
    55: Object.freeze({ hunger: 12, cooked: false, shelfLife: 600 }),
    96: Object.freeze({ hunger: 18, cooked: true, shelfLife: 1200 }),
    97: Object.freeze({ hunger: 24, cooked: true, shelfLife: 1200 }),
    98: Object.freeze({ hunger: 20, cooked: true, shelfLife: 1200 }),
    99: Object.freeze({ hunger: 22, cooked: true, shelfLife: 1200 }),
    100: Object.freeze({ hunger: 20, cooked: true, shelfLife: 1200 }),
    136: Object.freeze({ hunger: 2, cooked: false, damageChance: 1, damage: 8 })
});

export function getFoodInfo(type) {
    return FOODS[type] || null;
}

export function isFoodType(type) {
    return getFoodInfo(type) !== null;
}

export function updateFoodSpoilage(inventorySlots, gameTime) {
    if (!Array.isArray(inventorySlots) || !Number.isFinite(gameTime)) return 0;
    let spoiledCount = 0;
    for (const item of inventorySlots) {
        const food = item && item.count > 0 ? getFoodInfo(item.type) : null;
        if (!food?.shelfLife) continue;
        if (!Number.isFinite(item.spoilAt)) {
            item.spoilAt = gameTime + food.shelfLife;
            continue;
        }
        if (gameTime < item.spoilAt) continue;
        spoiledCount += item.count;
        item.type = 136;
        delete item.spoilAt;
    }
    return spoiledCount;
}

export function getFoodFreshness(item, gameTime) {
    const food = item && item.count > 0 ? getFoodInfo(item.type) : null;
    if (!food?.shelfLife || !Number.isFinite(item.spoilAt) || !Number.isFinite(gameTime)) return null;
    return Math.max(0, Math.min(1, (item.spoilAt - gameTime) / food.shelfLife));
}
