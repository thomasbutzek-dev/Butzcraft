const FOODS = Object.freeze({
    17: Object.freeze({ hunger: 5, cooked: false }),
    18: Object.freeze({ hunger: 15, cooked: false }),
    21: Object.freeze({ hunger: 10, cooked: false }),
    22: Object.freeze({ hunger: 15, cooked: false }),
    23: Object.freeze({ hunger: 10, cooked: false }),
    24: Object.freeze({ hunger: 5, cooked: false, damageChance: 0.3, damage: 5 }),
    25: Object.freeze({ hunger: 12, cooked: false }),
    51: Object.freeze({ hunger: 8, cooked: false }),
    55: Object.freeze({ hunger: 12, cooked: false }),
    96: Object.freeze({ hunger: 18, cooked: true }),
    97: Object.freeze({ hunger: 24, cooked: true }),
    98: Object.freeze({ hunger: 20, cooked: true }),
    99: Object.freeze({ hunger: 22, cooked: true }),
    100: Object.freeze({ hunger: 20, cooked: true })
});

export function getFoodInfo(type) {
    return FOODS[type] || null;
}

export function isFoodType(type) {
    return getFoodInfo(type) !== null;
}
