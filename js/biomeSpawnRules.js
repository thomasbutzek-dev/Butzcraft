const SNOW_SPAWNS = Object.freeze({
    land: Object.freeze([
        Object.freeze({ type: 'penguin', weight: 55 }),
        Object.freeze({ type: 'seal', weight: 25 }),
        Object.freeze({ type: 'polarBear', weight: 1 })
    ]),
    water: Object.freeze([
        Object.freeze({ type: 'fish', weight: 45 }),
        Object.freeze({ type: 'penguin', weight: 35 }),
        Object.freeze({ type: 'seal', weight: 20 })
    ])
});

const DESERT_SPAWNS = Object.freeze({
    landDay: Object.freeze([
        Object.freeze({ type: 'camel', weight: 65 }),
        Object.freeze({ type: 'fennec', weight: 35 })
    ]),
    landNight: Object.freeze([
        Object.freeze({ type: 'fennec', weight: 25 }),
        Object.freeze({ type: 'scorpion', weight: 75 })
    ]),
    water: Object.freeze([
        Object.freeze({ type: 'fish', weight: 1 })
    ])
});

const TEMPERATE_LAND_SPAWNS = Object.freeze([
    Object.freeze({ type: 'cow', weight: 30 }),
    Object.freeze({ type: 'pig', weight: 30 }),
    Object.freeze({ type: 'sheep', weight: 20 }),
    Object.freeze({ type: 'chicken', weight: 20 })
]);

const OCEAN_SPAWNS = Object.freeze([
    Object.freeze({ type: 'fish', weight: 40 }),
    Object.freeze({ type: 'turtle', weight: 15 }),
    Object.freeze({ type: 'octopus', weight: 5 })
]);

const JUNGLE_LAND_SPAWNS = Object.freeze([
    Object.freeze({ type: 'pig', weight: 3 }),
    Object.freeze({ type: 'chicken', weight: 2 })
]);

function getEntries(biome, habitat, isNight) {
    if (biome === 'Schneefeld') return SNOW_SPAWNS[habitat] || [];
    if (biome === 'Wüste') {
        if (habitat === 'land') return DESERT_SPAWNS[isNight ? 'landNight' : 'landDay'];
        return DESERT_SPAWNS[habitat] || [];
    }
    if (habitat === 'water') return OCEAN_SPAWNS;
    if (biome === 'Grasland') return TEMPERATE_LAND_SPAWNS;
    if (biome === 'Urwald') return JUNGLE_LAND_SPAWNS;
    return [];
}

export function selectBiomeAnimal({ biome, habitat, isNight = false, roll = Math.random() }) {
    const entries = getEntries(biome, habitat, isNight);
    const totalWeight = entries.reduce((total, entry) => total + entry.weight, 0);
    if (totalWeight === 0) return null;

    let cursor = Math.min(Math.max(roll, 0), 0.999999999) * totalWeight;
    for (const entry of entries) {
        cursor -= entry.weight;
        if (cursor < 0) return entry;
    }

    return entries[entries.length - 1];
}
