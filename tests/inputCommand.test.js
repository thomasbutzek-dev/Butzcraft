import { describe, expect, it } from 'vitest';
import { resolveUiInputCommand } from '../js/inputCommand.js';

describe('resolveUiInputCommand', () => {
    it('closes the active blocking overlay before changing pause state', () => {
        expect(resolveUiInputCommand({
            code: 'Escape',
            inventoryOpen: true,
            furnaceOpen: true,
            chestOpen: true,
            tradeOpen: true,
            paused: false
        })).toBe('close-inventory');
    });

    it('uses the same overlay priority for Tab, Escape and E', () => {
        const state = {
            inventoryOpen: false,
            furnaceOpen: false,
            chestOpen: true,
            tradeOpen: true,
            paused: false
        };

        expect(resolveUiInputCommand({ ...state, code: 'Tab' })).toBe('close-chest');
        expect(resolveUiInputCommand({ ...state, code: 'Escape' })).toBe('close-chest');
        expect(resolveUiInputCommand({ ...state, code: 'KeyE' })).toBe('close-chest');
    });

    it('toggles pause with Tab or Escape and inventory with E', () => {
        const clearState = {
            inventoryOpen: false,
            furnaceOpen: false,
            chestOpen: false,
            tradeOpen: false
        };

        expect(resolveUiInputCommand({ ...clearState, code: 'Tab', paused: false })).toBe('pause');
        expect(resolveUiInputCommand({ ...clearState, code: 'Escape', paused: true })).toBe('resume');
        expect(resolveUiInputCommand({ ...clearState, code: 'KeyE', paused: false })).toBe('toggle-inventory');
    });

    it('ignores unrelated keys', () => {
        expect(resolveUiInputCommand({ code: 'KeyW' })).toBeNull();
        expect(resolveUiInputCommand({ code: 'KeyQ' })).toBeNull();
    });
});
