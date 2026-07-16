import { BLOCK_TYPES } from './blocks.js?v=20260716e';

const OBJECTIVES = [
    {
        label: 'Erster Tag',
        text: 'Sammle Holz',
        hint: 'Ziele auf einen Baumstamm und halte Linksklick.',
        touchHint: 'Ziele auf einen Baumstamm und halte Abbauen.',
        completeTypes: new Set([
            BLOCK_TYPES.WOOD, BLOCK_TYPES.JUNGLE_WOOD, BLOCK_TYPES.PALM_WOOD,
            BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Stelle Holzbretter her',
        hint: 'Öffne mit E das Inventar und lege Holz ins Bastelfeld.',
        touchHint: 'Öffne das Inventar und lege Holz ins Bastelfeld.',
        completeTypes: new Set([
            BLOCK_TYPES.PLANKS, BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Mache Stöcke',
        hint: 'Lege zwei Holzbretter übereinander ins Bastelfeld.',
        touchHint: 'Lege zwei Holzbretter übereinander ins Bastelfeld.',
        completeTypes: new Set([
            BLOCK_TYPES.STICK, BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Baue eine Werkbank',
        hint: 'Fülle das 2×2-Bastelfeld mit Holzbrettern.',
        touchHint: 'Fülle das 2×2-Bastelfeld mit Holzbrettern.',
        completeTypes: new Set([
            BLOCK_TYPES.WORKBENCH,
            BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.WOOD_AXE, BLOCK_TYPES.WOOD_SHOVEL,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK, BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Baue eine Holzspitzhacke',
        hint: 'Nutze 3 Bretter oben und 2 Stöcke in der Mitte.',
        touchHint: 'Nutze 3 Bretter oben und 2 Stöcke in der Mitte.',
        completeTypes: new Set([
            BLOCK_TYPES.WOOD_PICKAXE,
            BLOCK_TYPES.STONE_PICKAXE,
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK,
            BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Sammle Stein',
        hint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.',
        touchHint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.',
        completeTypes: new Set([
            BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK,
            BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.STONE_AXE, BLOCK_TYPES.STONE_SHOVEL,
            BLOCK_TYPES.FURNACE
        ])
    },
    {
        label: 'Erster Tag',
        text: 'Baue einen Ofen',
        hint: 'Lege 8 Steine als Ring ins 3×3-Bastelfeld.',
        touchHint: 'Lege 8 Steine als Ring ins 3×3-Bastelfeld.',
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
        objective: objective ? {
            label: objective.label,
            text: objective.text,
            hint: objective.hint,
            touchHint: objective.touchHint,
            step: index + 1,
            total: OBJECTIVES.length
        } : null
    };
}
