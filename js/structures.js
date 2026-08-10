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

Object.assign(LOOT_TABLES, {
    mine_timber: [
        ...LOOT_TABLES.mine,
        { type: 81, minCount: 2, maxCount: 6, weight: 18 },
        { type: 61, minCount: 1, maxCount: 2, weight: 8 }
    ],
    mine_overgrown: [
        ...LOOT_TABLES.mine,
        { type: 13, minCount: 2, maxCount: 6, weight: 16 },
        { type: 14, minCount: 2, maxCount: 5, weight: 14 },
        { type: 51, minCount: 2, maxCount: 5, weight: 12 }
    ],
    mine_frozen: [
        ...LOOT_TABLES.mine,
        { type: 12, minCount: 1, maxCount: 3, weight: 15 },
        { type: 11, minCount: 3, maxCount: 8, weight: 14 },
        { type: 19, minCount: 1, maxCount: 3, weight: 10 }
    ],
    dungeon_catacomb: [
        ...LOOT_TABLES.dungeon,
        { type: 31, minCount: 3, maxCount: 7, weight: 22 },
        { type: 61, minCount: 2, maxCount: 4, weight: 14 }
    ],
    dungeon_ruins: [
        ...LOOT_TABLES.dungeon,
        { type: 82, minCount: 2, maxCount: 5, weight: 18 },
        { type: 14, minCount: 2, maxCount: 5, weight: 14 },
        { type: 62, minCount: 1, maxCount: 3, weight: 12 }
    ],
    dungeon_frozen: [
        ...LOOT_TABLES.dungeon,
        { type: 12, minCount: 2, maxCount: 5, weight: 18 },
        { type: 77, minCount: 2, maxCount: 6, weight: 14 },
        { type: 19, minCount: 2, maxCount: 4, weight: 12 }
    ],
    village_farmstead: [
        { type: 51, minCount: 3, maxCount: 8, weight: 24 },
        { type: 88, minCount: 2, maxCount: 6, weight: 20 },
        { type: 26, minCount: 3, maxCount: 8, weight: 18 },
        { type: 22, minCount: 1, maxCount: 3, weight: 12 }
    ],
    village_courtyard: [
        { type: 30, minCount: 3, maxCount: 8, weight: 22 },
        { type: 82, minCount: 1, maxCount: 4, weight: 16 },
        { type: 19, minCount: 2, maxCount: 5, weight: 16 },
        { type: 62, minCount: 1, maxCount: 2, weight: 8 }
    ],
    village_shelteredLine: [
        { type: 11, minCount: 3, maxCount: 8, weight: 22 },
        { type: 19, minCount: 2, maxCount: 5, weight: 18 },
        { type: 60, minCount: 2, maxCount: 6, weight: 16 },
        { type: 22, minCount: 1, maxCount: 3, weight: 12 }
    ]
});

const DUNGEON_BLOCKS = new Set([29, 83, 84, 85]);

export function applyVillageChestPenalty(questState, villageId, penalty = 3) {
    const village = questState?.villages?.[villageId];
    if (!village) return null;
    const normalizedPenalty = Math.max(0, Math.floor(Number(penalty) || 0));
    village.trust = Math.max(0, Math.floor(Number(village.trust) || 0) - normalizedPenalty);
    return { penalty: normalizedPenalty, trust: village.trust };
}

export function classifyChestLoot({ x, y, z, biome = 'Grasland', villages = [], getBlock = () => 0 }) {
    const village = villages.find(candidate =>
        Array.isArray(candidate?.houses) && candidate.houses.some(house =>
            Math.abs(x - house.x) <= 5 &&
            Math.abs(y - house.y) <= 4 &&
            Math.abs(z - house.z) <= 5
        )
    );
    if (village?.layout && LOOT_TABLES[`village_${village.layout}`]) {
        return `village_${village.layout}`;
    }

    let dungeonBlocks = 0;
    let pressurePlateNearby = false;
    let railNearby = false;
    for (let dx = -4; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
            const block = getBlock(x + dx, y, z + dz);
            if (Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && DUNGEON_BLOCKS.has(block)) dungeonBlocks++;
            if (block === 79) pressurePlateNearby = true;
            for (let dy = -1; dy <= 1; dy++) {
                if (getBlock(x + dx, y + dy, z + dz) === 80) railNearby = true;
            }
        }
    }

    if (biome === 'Wüste' && pressurePlateNearby) return 'temple';
    if (dungeonBlocks >= 3) {
        if (biome === 'Urwald') return 'dungeon_ruins';
        if (biome === 'Schneefeld') return 'dungeon_frozen';
        return 'dungeon_catacomb';
    }
    if (railNearby) {
        if (biome === 'Urwald') return 'mine_overgrown';
        if (biome === 'Schneefeld') return 'mine_frozen';
        return 'mine_timber';
    }
    if (biome === 'Wüste') return 'temple';
    if (biome === 'Schneefeld') return 'igloo';
    return biome === 'Urwald' ? 'mine_overgrown' : 'mine_timber';
}

export function getLootDiscoveryMessage(structureType) {
    if (structureType.startsWith('dungeon_')) return 'Dungeon-Schatz entdeckt!';
    if (structureType.startsWith('mine_')) return 'Minenfund entdeckt!';
    if (structureType.startsWith('village_')) return 'Dorfvorrat gefunden.';
    if (structureType === 'temple') return 'Tempelschatz entdeckt!';
    if (structureType === 'igloo') return 'Iglu-Vorrat gefunden.';
    return 'Vorrat gefunden.';
}

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
