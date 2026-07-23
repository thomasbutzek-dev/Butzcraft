import { describe, expect, it } from 'vitest';
import {
    EQUIPMENT_SLOTS,
    applyArmorDamage,
    equipArmorFromInventory,
    getArmorInfo,
    getArmorProtection,
    getArmorSetItems,
    unequipArmorToInventory
} from '../js/equipmentRules.js';

function emptyInventory() {
    return Array.from({ length: 64 }, () => ({ type: 0, count: 0 }));
}

describe('equipment rules', () => {
    it('defines five armor slots including arms', () => {
        expect(EQUIPMENT_SLOTS.map(slot => slot.id)).toEqual(['head', 'body', 'arms', 'legs', 'feet']);
    });

    it('equips a piece into its reserved slot and swaps an old piece back', () => {
        const inventory = emptyInventory();
        inventory[16] = { type: 106, count: 1, durability: 40 };
        inventory[8] = { type: 111, count: 1, durability: 80 };

        expect(equipArmorFromInventory(inventory, 16)).toEqual({
            equipped: true,
            slot: 'head',
            replaced: true
        });
        expect(inventory[8]).toEqual({ type: 106, count: 1, durability: 40 });
        expect(inventory[16]).toEqual({ type: 111, count: 1, durability: 80 });
    });

    it('reduces damage, wears equipped pieces and removes broken armor', () => {
        const inventory = emptyInventory();
        getArmorSetItems('iron').forEach((item, index) => {
            inventory[EQUIPMENT_SLOTS[index].inventoryIndex] = { ...item, durability: index === 0 ? 1 : 100 };
        });

        const result = applyArmorDamage(inventory, 10);

        expect(result.protection).toBeCloseTo(0.36);
        expect(result.damage).toBeCloseTo(6.4);
        expect(result.broken).toHaveLength(1);
        expect(inventory[8]).toEqual({ type: 0, count: 0 });
        expect(inventory[9].durability).toBe(96.5);
    });

    it('caps mixed armor protection and can unequip into a normal slot', () => {
        const inventory = emptyInventory();
        inventory[8] = { type: 131, count: 1 };
        inventory[9] = { type: 132, count: 1 };
        expect(getArmorProtection(inventory)).toBeCloseTo(0.3);

        expect(unequipArmorToInventory(inventory, 'head')).toEqual({
            unequipped: true,
            inventoryIndex: 0
        });
        expect(getArmorInfo(inventory[0].type)?.slot).toBe('head');
        expect(inventory[8]).toEqual({ type: 0, count: 0 });
    });
});
