import { describe, expect, it, vi } from 'vitest';

vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: {
        WOOD: 5,
        JUNGLE_WOOD: 13,
        PALM_WOOD: 15,
        PLANKS: 26,
        STICK: 27,
        WORKBENCH: 28,
        STONE: 3,
        STONE_BRICK: 29,
        FURNACE: 59,
        WOOD_PICKAXE: 63,
        STONE_PICKAXE: 64,
        WOOD_AXE: 67,
        STONE_AXE: 68,
        WOOD_SHOVEL: 71,
        STONE_SHOVEL: 72,
        IRON_PICKAXE: 65,
        GOLD_PICKAXE: 66,
        WOOD_SWORD: 89,
        STONE_SWORD: 90,
        IRON_SWORD: 91,
        GOLD_SWORD: 92,
        BOW: 94,
        COOKED_FISH: 96,
        COOKED_MEAT: 97,
        COOKED_CHICKEN: 98,
        COOKED_MUTTON: 99,
        COOKED_TURTLE_MEAT: 100,
        BED_HEAD: 38
    }
}));

const { getOnboardingProgress } = await import('../js/onboarding.js');

describe('onboarding progress', () => {
    it('starts with the first concrete player objective', () => {
        expect(getOnboardingProgress([], 0)).toEqual({
            index: 0,
            objective: {
                label: 'Erster Tag',
                text: 'Sammle Holz',
                hint: 'Ziele auf einen Baumstamm und halte Linksklick.',
                touchHint: 'Ziele auf einen Baumstamm und halte Abbauen.',
                step: 1,
                total: 11
            }
        });
    });

    it('recognizes downstream crafted items without replaying earlier steps', () => {
        const inventory = [{ type: 28, count: 1 }];

        expect(getOnboardingProgress(inventory, 0)).toEqual({
            index: 4,
            objective: expect.objectContaining({
                text: 'Baue dein erstes Schwert',
                step: 5,
                total: 11
            })
        });
    });

    it('never regresses below restored save progress', () => {
        expect(getOnboardingProgress([], 6)).toEqual({
            index: 6,
            objective: expect.objectContaining({
                text: 'Sammle Stein',
                step: 7,
                total: 11
            })
        });
    });

    it('guides the player from a wooden pickaxe to stone', () => {
        expect(getOnboardingProgress([{ type: 63, count: 1 }], 0)).toEqual({
            index: 6,
            objective: expect.objectContaining({
                text: 'Sammle Stein',
                hint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.'
            })
        });
    });

    it('guides from the furnace to cooked food instead of ending early', () => {
        expect(getOnboardingProgress([{ type: 59, count: 1 }], 0)).toEqual({
            index: 8,
            objective: expect.objectContaining({
                text: 'Bereite Nahrung im Ofen zu',
                step: 9,
                total: 11
            })
        });
    });

    it('teaches bed crafting and finishes only after a respawn point exists', () => {
        expect(getOnboardingProgress([{ type: 97, count: 1 }], 0)).toEqual({
            index: 9,
            objective: expect.objectContaining({ text: 'Baue ein Bett' })
        });
        expect(getOnboardingProgress([{ type: 38, count: 1 }], 0)).toEqual({
            index: 10,
            objective: expect.objectContaining({ text: 'Schlafe in deinem Bett' })
        });
        expect(getOnboardingProgress([], 10, { respawnSet: true })).toEqual({
            index: 11,
            objective: null
        });
    });
});
