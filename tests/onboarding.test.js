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
            objective: { label: 'Erstes Ziel', text: 'Sammle Holz' }
        });
    });

    it('recognizes downstream crafted items without replaying earlier steps', () => {
        const inventory = [{ type: 28, count: 1 }];

        expect(getOnboardingProgress(inventory, 0)).toEqual({
            index: 4,
            objective: { label: 'Steinzeit', text: 'Sammle Stein' }
        });
    });

    it('never regresses below restored save progress', () => {
        expect(getOnboardingProgress([], 4)).toEqual({
            index: 4,
            objective: { label: 'Steinzeit', text: 'Sammle Stein' }
        });
    });

    it('finishes the onboarding when a furnace is available', () => {
        expect(getOnboardingProgress([{ type: 59, count: 1 }], 0)).toEqual({
            index: 6,
            objective: null
        });
    });
});
