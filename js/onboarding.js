import { BLOCK_TYPES } from './blocks.js?v=20260723e';

const STAGES = [
    [BLOCK_TYPES.WOOD, BLOCK_TYPES.JUNGLE_WOOD, BLOCK_TYPES.PALM_WOOD],
    [BLOCK_TYPES.PLANKS],
    [BLOCK_TYPES.STICK],
    [BLOCK_TYPES.WORKBENCH],
    [BLOCK_TYPES.WOOD_SWORD, BLOCK_TYPES.STONE_SWORD, BLOCK_TYPES.IRON_SWORD, BLOCK_TYPES.GOLD_SWORD, BLOCK_TYPES.BOW],
    [BLOCK_TYPES.WOOD_PICKAXE, BLOCK_TYPES.STONE_PICKAXE, BLOCK_TYPES.IRON_PICKAXE, BLOCK_TYPES.GOLD_PICKAXE],
    [BLOCK_TYPES.STONE, BLOCK_TYPES.STONE_BRICK],
    [BLOCK_TYPES.FURNACE],
    [BLOCK_TYPES.COOKED_FISH, BLOCK_TYPES.COOKED_MEAT, BLOCK_TYPES.COOKED_CHICKEN, BLOCK_TYPES.COOKED_MUTTON, BLOCK_TYPES.COOKED_TURTLE_MEAT],
    [BLOCK_TYPES.BED_HEAD]
];

function completionTypes(stageIndex) {
    return new Set(STAGES.slice(stageIndex).flat());
}

const OBJECTIVES = [
    {
        label: 'Erster Tag', text: 'Sammle Holz',
        hint: 'Ziele auf einen Baumstamm und halte Linksklick.',
        touchHint: 'Ziele auf einen Baumstamm und halte Abbauen.'
    },
    {
        label: 'Erster Tag', text: 'Stelle Holzbretter her',
        hint: 'Öffne mit E das Inventar und wähle Holzbretter im Rezeptbuch.',
        touchHint: 'Öffne das Inventar und wähle Holzbretter im Rezeptbuch.'
    },
    {
        label: 'Erster Tag', text: 'Mache Stöcke',
        hint: 'Wähle Stock im Rezeptbuch und stelle das Rezept her.',
        touchHint: 'Wähle Stock im Rezeptbuch und stelle das Rezept her.'
    },
    {
        label: 'Erster Tag', text: 'Baue eine Werkbank',
        hint: 'Wähle Werkbank im Rezeptbuch und stelle das Rezept her.',
        touchHint: 'Wähle Werkbank im Rezeptbuch und stelle das Rezept her.'
    },
    {
        label: 'Überleben', text: 'Baue dein erstes Schwert',
        hint: 'Stelle die Werkbank auf, öffne sie mit Rechtsklick und wähle ein Schwertrezept.',
        touchHint: 'Stelle die Werkbank auf, öffne sie und wähle ein Schwertrezept.'
    },
    {
        label: 'Überleben', text: 'Baue eine Holzspitzhacke',
        hint: 'Öffne die Werkbank und wähle die Holzspitzhacke im Rezeptbuch.',
        touchHint: 'Öffne die Werkbank und wähle die Holzspitzhacke im Rezeptbuch.'
    },
    {
        label: 'Überleben', text: 'Sammle Stein',
        hint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.',
        touchHint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.'
    },
    {
        label: 'Überleben', text: 'Baue einen Ofen',
        hint: 'Öffne die Werkbank und wähle den Ofen im Rezeptbuch.',
        touchHint: 'Öffne die Werkbank und wähle den Ofen im Rezeptbuch.'
    },
    {
        label: 'Überleben', text: 'Bereite Nahrung im Ofen zu',
        hint: 'Lege rohes Tierfutter oben und Kohle oder Holz unten in den Ofen.',
        touchHint: 'Lege rohes Tierfutter oben und Kohle oder Holz unten in den Ofen.'
    },
    {
        label: 'Sicheres Zuhause', text: 'Baue ein Bett',
        hint: 'Schere Schafe und stelle aus Wolle und Brettern ein Bett her.',
        touchHint: 'Schere Schafe und stelle aus Wolle und Brettern ein Bett her.'
    },
    {
        label: 'Sicheres Zuhause', text: 'Schlafe in deinem Bett',
        hint: 'Stelle das Bett auf und nutze es nachts mit Rechtsklick. Das setzt deinen Rückkehrpunkt.',
        touchHint: 'Stelle das Bett auf und nutze es nachts. Das setzt deinen Rückkehrpunkt.',
        milestone: 'respawnSet'
    }
].map((objective, index) => ({
    ...objective,
    completeTypes: index < STAGES.length ? completionTypes(index) : new Set()
}));

export function getOnboardingProgress(inventorySlots, minimumIndex = 0, milestones = {}) {
    const slots = Array.isArray(inventorySlots) ? inventorySlots : [];
    let index = Number.isInteger(minimumIndex) ? minimumIndex : 0;
    index = Math.max(0, Math.min(index, OBJECTIVES.length));

    while (index < OBJECTIVES.length) {
        const objective = OBJECTIVES[index];
        const itemComplete = slots.some(slot => slot && slot.count > 0 && objective.completeTypes.has(slot.type));
        const milestoneComplete = objective.milestone && Boolean(milestones[objective.milestone]);
        if (!itemComplete && !milestoneComplete) break;
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
