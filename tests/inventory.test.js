/* tests/inventory.test.js
 *
 * Tests für Inventory-Stack-Logic. Beachten:
 *  - Slots 8..15 werden übersprungen (Hotbar 0..7, Hauptinventar 16..63 — die Lücke ist beabsichtigt
 *    und wird im UI als Trenner gezeichnet).
 *  - Stack-Cap pro Slot ist 64.
 *  - addItemToInventory füllt zuerst existierende Stacks auf, dann erst leere Slots.
 *
 * inventorySlots ist ein Modul-globales Array. Wir stellen vor jedem Test einen sauberen Zustand her.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// blocks.js importiert three (nur via CDN-importmap im Browser verfügbar) → mocken.
// Wir geben die fürs Inventory nötigen Konstanten zurück, ohne Three.js zu laden.
vi.mock('../js/blocks.js', () => ({
    BLOCK_TYPES: { GRASS: 1, DIRT: 2, STONE: 3, WATER: 4, WOOD: 5 },
    BLOCK_TEX: {},
    atlasDataURL: ''
}));
// recipe_book.js + sound.js sind UI/Audio-only — für Inventory-Logic-Tests irrelevant.
vi.mock('../js/recipe_book.js', () => ({ initRecipeBook: () => {} }));
vi.mock('../js/sound.js', () => ({ SoundManager: { playSound: () => {} } }));

// Nach den Mocks importieren — top-level await funktioniert in Vitest.
const { inventorySlots, addItemToInventory, canAddItemToInventory, tryAddItemsToInventory } = await import('../js/inventory.js');

// updateInventoryUI hängt am DOM; wir machen sie zum No-Op via document.querySelectorAll-stub.
beforeEach(() => {
    // Reset Slots
    for (let i = 0; i < inventorySlots.length; i++) {
        inventorySlots[i].type = 0;
        inventorySlots[i].count = 0;
    }
    // Stub für DOM-Lookups in updateInventoryUI
    document.querySelectorAll = () => [];
});

describe('addItemToInventory – Basis', () => {
    it('Item type=0 wird ignoriert', () => {
        addItemToInventory(0, 5);
        expect(inventorySlots.every(s => s.count === 0)).toBe(true);
    });

    it('legt erstes Item in Slot 0 ab', () => {
        addItemToInventory(3, 5);
        expect(inventorySlots[0]).toEqual({ type: 3, count: 5 });
    });

    it('füllt vorhandenen Stack auf, statt neuen zu öffnen', () => {
        inventorySlots[0] = { type: 3, count: 10 };
        addItemToInventory(3, 7);
        expect(inventorySlots[0].count).toBe(17);
        expect(inventorySlots[1].count).toBe(0);
    });

    it('respektiert Stack-Cap 64 — Überlauf in nächsten Slot', () => {
        inventorySlots[0] = { type: 3, count: 60 };
        addItemToInventory(3, 10);
        expect(inventorySlots[0].count).toBe(64);
        expect(inventorySlots[1]).toEqual({ type: 3, count: 6 });
    });
});

describe('addItemToInventory full inventory', () => {
    it('reports the quantity that could not be stored', () => {
        for (let i = 0; i < inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventorySlots[i] = { type: 1, count: 64 };
        }

        const result = addItemToInventory(3, 5);

        expect(result).toEqual({ added: 0, remaining: 5 });
        expect(inventorySlots.every((slot, index) => (
            index >= 8 && index <= 15 ? slot.count === 0 : slot.count === 64
        ))).toBe(true);
    });

    it('reports that an item does not fit before changing the inventory', () => {
        for (let i = 0; i < inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventorySlots[i] = { type: 1, count: 64 };
        }

        expect(canAddItemToInventory(3, 1)).toBe(false);
    });

    it('rolls back a multi-item reward when only part of it fits', () => {
        for (let i = 0; i < inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventorySlots[i] = { type: 1, count: 64 };
        }
        inventorySlots[0] = { type: 3, count: 63 };
        const before = inventorySlots.map(slot => ({ ...slot }));

        const result = tryAddItemsToInventory([
            { type: 3, count: 1 },
            { type: 5, count: 1 }
        ]);

        expect(result).toEqual({ added: false, reason: 'inventory-full' });
        expect(inventorySlots).toEqual(before);
    });
});

describe('addItemToInventory – Slot-Skip 8..15', () => {
    it('füllt Hotbar 0..7, dann Hauptinventar ab 16 (Slots 8..15 bleiben leer)', () => {
        // Alle Hotbar-Slots vollmachen
        for (let i = 0; i < 8; i++) inventorySlots[i] = { type: 1, count: 64 };
        addItemToInventory(2, 5);
        // Slots 8..15 dürfen NICHT befüllt werden
        for (let i = 8; i <= 15; i++) {
            expect(inventorySlots[i].count).toBe(0);
        }
        // Slot 16 (erster Hauptinventar-Slot) bekommt das Item
        expect(inventorySlots[16]).toEqual({ type: 2, count: 5 });
    });

    it('fügt zu existierendem Hauptinventar-Stack hinzu, ignoriert Slot 8..15', () => {
        inventorySlots[16] = { type: 5, count: 10 };
        // Slots 8..15 könnten "type: 5" enthalten (alter Save?), sollten aber ignoriert werden
        inventorySlots[10] = { type: 5, count: 5 };
        addItemToInventory(5, 3);
        // Slot 16 bekommt die +3
        expect(inventorySlots[16].count).toBe(13);
        // Slot 10 bleibt unverändert (übersprungen)
        expect(inventorySlots[10].count).toBe(5);
    });
});

describe('addItemToInventory – Mehrfach-Slots', () => {
    it('verteilt großen Drop auf mehrere Slots wenn nötig', () => {
        addItemToInventory(7, 130); // 64+64+2 = 130
        expect(inventorySlots[0]).toEqual({ type: 7, count: 64 });
        expect(inventorySlots[1]).toEqual({ type: 7, count: 64 });
        expect(inventorySlots[2]).toEqual({ type: 7, count: 2 });
    });

    it('füllt zuerst Hotbar, dann Hauptinventar', () => {
        addItemToInventory(3, 64 * 8); // exakt Hotbar-Kapazität
        for (let i = 0; i < 8; i++) {
            expect(inventorySlots[i]).toEqual({ type: 3, count: 64 });
        }
        // Slots 8..15 leer
        for (let i = 8; i <= 15; i++) {
            expect(inventorySlots[i].count).toBe(0);
        }
        // Hauptinventar leer
        expect(inventorySlots[16].count).toBe(0);
    });
});
