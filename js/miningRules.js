const TOOL_GROUPS = {
    pickaxe: [63, 64, 65, 66],
    axe: [67, 68, 69, 70],
    shovel: [71, 72, 73, 74]
};

const TOOL_MATERIALS = [
    { name: 'Holz', tier: 1, speed: 2.0, maxDurability: 120 },
    { name: 'Stein', tier: 2, speed: 2.8, maxDurability: 240 },
    { name: 'Eisen', tier: 3, speed: 4.0, maxDurability: 500 },
    { name: 'Gold', tier: 4, speed: 5.4, maxDurability: 220 }
];

const BLOCK_CATEGORIES = {
    pickaxe: new Set([3, 29, 30, 56, 57, 58, 59, 78, 79, 80, 82, 83, 84, 85]),
    axe: new Set([5, 13, 15, 26, 28, 33, 34, 36, 38, 39, 75, 81, 88, 102, 103, 104]),
    shovel: new Set([1, 2, 7, 11, 44, 46, 50, 77, 87])
};

const UNBREAKABLE_BLOCKS = new Set([0, 4, 20]);
const PLANT_BLOCKS = new Set([6, 9, 10, 14, 16, 43, 44, 46, 47, 48, 49, 50, 52, 54, 86]);
const SOFT_BLOCKS = new Set([1, 2, 7, 11, 77, 87]);
const WOOD_BLOCKS = new Set([5, 13, 15, 26, 28, 33, 34, 36, 38, 39, 75, 81, 88, 102, 103, 104]);
const ORE_BLOCKS = new Set([56, 57, 58]);

const REQUIRED_PICKAXE_TIER = new Map([
    [3, 1],
    [29, 1],
    [56, 1],
    [57, 2],
    [58, 3],
    [59, 1],
    [83, 2],
    [84, 1],
    [85, 1]
]);

function getBlockCategory(blockType) {
    for (const [category, blocks] of Object.entries(BLOCK_CATEGORIES)) {
        if (blocks.has(blockType)) return category;
    }
    return null;
}

function getBaseDuration(blockType) {
    if (PLANT_BLOCKS.has(blockType)) return 0.18;
    if (SOFT_BLOCKS.has(blockType)) return 0.5;
    if (WOOD_BLOCKS.has(blockType)) return 0.9;
    if (ORE_BLOCKS.has(blockType)) return 1.8;
    if (BLOCK_CATEGORIES.pickaxe.has(blockType)) return 1.35;
    return 0.65;
}

function getRequiredPickaxeHint(tier) {
    const name = TOOL_MATERIALS[Math.max(0, tier - 1)]?.name || 'Holz';
    return `Du brauchst eine ${name}-Spitzhacke.`;
}

export function getToolInfo(toolType) {
    for (const [category, ids] of Object.entries(TOOL_GROUPS)) {
        const materialIndex = ids.indexOf(toolType);
        if (materialIndex === -1) continue;
        return {
            type: toolType,
            category,
            material: TOOL_MATERIALS[materialIndex].name,
            ...TOOL_MATERIALS[materialIndex]
        };
    }
    return null;
}

export function isToolType(type) {
    return getToolInfo(type) !== null;
}

export function getMiningPlan(blockType, toolType = 0) {
    if (blockType === 0 || blockType === 4) {
        return {
            canBreak: false,
            duration: Infinity,
            usesDurability: false,
            hint: ''
        };
    }

    if (UNBREAKABLE_BLOCKS.has(blockType)) {
        return {
            canBreak: false,
            duration: Infinity,
            usesDurability: false,
            hint: 'Diesen Block kannst du nicht abbauen.'
        };
    }

    const tool = getToolInfo(toolType);
    const requiredTier = REQUIRED_PICKAXE_TIER.get(blockType) || 0;
    if (requiredTier > 0 && (!tool || tool.category !== 'pickaxe' || tool.tier < requiredTier)) {
        return {
            canBreak: false,
            duration: Infinity,
            usesDurability: false,
            hint: getRequiredPickaxeHint(requiredTier)
        };
    }

    const category = getBlockCategory(blockType);
    const isCorrectTool = Boolean(tool && category && tool.category === category);
    const speed = isCorrectTool ? tool.speed : 1;

    return {
        canBreak: true,
        duration: Math.max(0.12, getBaseDuration(blockType) / speed),
        usesDurability: isCorrectTool,
        hint: '',
        category,
        tool
    };
}
