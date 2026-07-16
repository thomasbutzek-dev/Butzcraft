import { beforeEach, describe, expect, it, vi } from 'vitest';

const gradient = { addColorStop() {} };
const canvasContext = new Proxy({}, {
    get(target, property) {
        if (property === 'createLinearGradient' || property === 'createRadialGradient') {
            return () => gradient;
        }
        if (!(property in target)) target[property] = () => {};
        return target[property];
    },
    set(target, property, value) {
        target[property] = value;
        return true;
    }
});
HTMLCanvasElement.prototype.getContext = () => canvasContext;
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

const inventory = await import('../js/inventory.js');
const { addItemOrCreateDrop, tryCollectDroppedItem } = await import('../js/itemCollection.js');

beforeEach(() => {
    document.body.innerHTML = '';
    for (let i = 0; i < inventory.inventorySlots.length; i++) {
        inventory.inventorySlots[i] = { type: 0, count: 0 };
    }
});

describe('dropped item collection', () => {
    it('keeps the drop in the world when the inventory is full', () => {
        for (let i = 0; i < inventory.inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventory.inventorySlots[i] = { type: 1, count: 64 };
        }
        const drop = { blockType: 3 };
        const drops = [drop];
        let disposed = false;

        const collected = tryCollectDroppedItem(drops, 0, () => { disposed = true; });

        expect(collected).toBe(false);
        expect(drops).toEqual([drop]);
        expect(disposed).toBe(false);
    });

    it('creates one stacked world drop for inventory overflow', () => {
        for (let i = 0; i < inventory.inventorySlots.length; i++) {
            if (i < 8 || i >= 16) inventory.inventorySlots[i] = { type: 1, count: 64 };
        }
        const createDrop = vi.fn();

        const result = addItemOrCreateDrop(3, 5, createDrop);

        expect(result).toEqual({ added: 0, remaining: 0, dropped: 5 });
        expect(createDrop).toHaveBeenCalledWith(3, 5);
    });

    it('collects the complete stacked world drop', () => {
        const drop = { blockType: 3, count: 5 };
        const drops = [drop];

        const collected = tryCollectDroppedItem(drops, 0, () => {});

        expect(collected).toBe(true);
        expect(inventory.inventorySlots[0]).toEqual({ type: 3, count: 5 });
        expect(drops).toEqual([]);
    });
});
