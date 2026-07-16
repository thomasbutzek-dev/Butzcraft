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
        STONE_SHOVEL: 72
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
                total: 7
            }
        });
    });

    it('recognizes downstream crafted items without replaying earlier steps', () => {
        const inventory = [{ type: 28, count: 1 }];

        expect(getOnboardingProgress(inventory, 0)).toEqual({
            index: 4,
            objective: expect.objectContaining({
                text: 'Baue eine Holzspitzhacke',
                step: 5,
                total: 7
            })
        });
    });

    it('never regresses below restored save progress', () => {
        expect(getOnboardingProgress([], 5)).toEqual({
            index: 5,
            objective: expect.objectContaining({
                text: 'Sammle Stein',
                step: 6,
                total: 7
            })
        });
    });

    it('guides the player from a wooden pickaxe to stone', () => {
        expect(getOnboardingProgress([{ type: 63, count: 1 }], 0)).toEqual({
            index: 5,
            objective: expect.objectContaining({
                text: 'Sammle Stein',
                hint: 'Baue graue Steinblöcke mit der Holzspitzhacke ab.'
            })
        });
    });

    it('finishes the onboarding when a furnace is available', () => {
        expect(getOnboardingProgress([{ type: 59, count: 1 }], 0)).toEqual({
            index: 7,
            objective: null
        });
    });
});
