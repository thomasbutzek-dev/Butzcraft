import { BLOCK_TYPES } from './blocks.js?v=20260507b';

const OBJECTIVES = [
    {
        label: 'Erstes Ziel',
        text: 'Sammle Holz',
        completeTypes: new Set([
            BLOCK_TYPES.WOOD, BLOCK_TYPES.JUNGLE_WOOD, BLOCK_TYPES.PALM_WOOD,
            BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Weiter',
        text: 'Stelle Holzbretter her',
        completeTypes: new Set([
            BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Werkzeugbasis',
        text: 'Mache Stöcke',
        completeTypes: new Set([
            BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Arbeitsplatz',
        text: 'Baue eine Werkbank',
        completeTypes: new Set([
            BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Steinzeit',
        text: 'Sammle Stein',
        completeTypes: new Set([
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Überleben',
        text: 'Baue einen Ofen',
        completeTypes: new Set([BLOCK_TYPES.FURNACE])
    }
];

export function getOnboardingProgress(inventorySlots, minimumIndex = 0) {
    const slots = Array.isArray(inventorySlots) ? inventorySlots : [];
    let index = Number.isInteger(minimumIndex) ? minimumIndex : 0;
    index = Math.max(0, Math.min(index, OBJECTIVES.length));

    while (
        index < OBJECTIVES.length &&
        slots.some(slot => slot && slot.count > 0 && OBJECTIVES[index].completeTypes.has(slot.type))
    ) {
        index++;
    }

    const objective = OBJECTIVES[index];
    return {
        index,
        objective: objective ? { label: objective.label, text: objective.text } : null
    };
}
