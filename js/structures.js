/* js/structures.js – Loot-Tabellen für Truhen in prozeduralen Strukturen */

// Loot-Tabellen: [{type, minCount, maxCount, weight}]
const LOOT_TABLES = {
    mine: [
        { type: 60, minCount: 2, maxCount: 8, weight: 30 },  // COAL
        { type: 56, minCount: 1, maxCount: 3, weight: 20 },  // COAL_ORE
        { type: 57, minCount: 1, maxCount: 2, weight: 12 },  // IRON_ORE
        { type: 58, minCount: 1, maxCount: 2, weight: 5 },   // GOLD_ORE
        { type: 26, minCount: 4, maxCount: 12, weight: 25 }, // PLANKS
        { type: 27, minCount: 2, maxCount: 6, weight: 20 },  // STICK
        { type: 31, minCount: 1, maxCount: 3, weight: 8 },   // BONE
    ],
    temple: [
        { type: 62, minCount: 1, maxCount: 3, weight: 15 },  // GOLD_INGOT
        { type: 58, minCount: 1, maxCount: 4, weight: 20 },  // GOLD_ORE
        { type: 30, minCount: 4, maxCount: 12, weight: 25 }, // SANDSTONE
        { type: 60, minCount: 2, maxCount: 6, weight: 20 },  // COAL
        { type: 31, minCount: 2, maxCount: 5, weight: 15 },  // BONE
        { type: 61, minCount: 1, maxCount: 2, weight: 10 },  // IRON_INGOT
    ],
    igloo: [
        { type: 11, minCount: 4, maxCount: 10, weight: 30 }, // SNOW
        { type: 12, minCount: 1, maxCount: 3, weight: 15 },  // ICE
        { type: 31, minCount: 1, maxCount: 3, weight: 12 },  // BONE
        { type: 22, minCount: 1, maxCount: 3, weight: 20 },  // RAW_MEAT
        { type: 60, minCount: 2, maxCount: 5, weight: 18 },  // COAL
        { type: 19, minCount: 1, maxCount: 2, weight: 10 },  // WOOL
    ],
    dungeon: [
        { type: 61, minCount: 1, maxCount: 3, weight: 20 },  // IRON_INGOT
        { type: 62, minCount: 1, maxCount: 2, weight: 12 },  // GOLD_INGOT
        { type: 65, minCount: 1, maxCount: 1, weight: 8 },   // IRON_PICKAXE
        { type: 69, minCount: 1, maxCount: 1, weight: 6 },   // IRON_AXE
        { type: 31, minCount: 2, maxCount: 5, weight: 18 },  // BONE
        { type: 60, minCount: 3, maxCount: 8, weight: 22 },  // COAL
        { type: 57, minCount: 1, maxCount: 3, weight: 15 },  // IRON_ORE
        { type: 58, minCount: 1, maxCount: 2, weight: 8 },   // GOLD_ORE
        { type: 19, minCount: 1, maxCount: 3, weight: 10 },  // WOOL
        { type: 26, minCount: 2, maxCount: 8, weight: 18 },  // PLANKS
    ]
};

function weightedPick(items, rng) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = rng() * total;
    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item;
    }
    return items[items.length - 1];
}

function seededRng(seed) {
    let s = seed | 0;
    return () => {
        s = Math.imul(s ^ (s >>> 15), s | 1);
        s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Generiert Loot für eine Truhe basierend auf Biom-Typ.
 * @param {string} biomeType – 'mine', 'temple', oder 'igloo'
 * @param {number} seed – deterministisch aus Weltkoordinaten
 * @returns {Array<{type, count}>} – bis zu 5 Item-Stacks
 */
export function rollLoot(biomeType, seed) {
    const table = LOOT_TABLES[biomeType] || LOOT_TABLES.mine;
    const rng = seededRng(seed);
    const slotCount = 3 + Math.floor(rng() * 3); // 3-5 Stacks
    const loot = [];
    for (let i = 0; i < slotCount; i++) {
        const item = weightedPick(table, rng);
        const count = item.minCount + Math.floor(rng() * (item.maxCount - item.minCount + 1));
        loot.push({ type: item.type, count });
    }
    return loot;
}
