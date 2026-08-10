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
const { addItemOrCreateDrop, tryCollectDroppedItem, updateDroppedItemVisual } = await import('../js/itemCollection.js');

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

    it('does not rebuild unchanged inventory icons when collecting an item', () => {
        document.body.innerHTML = `
            <div id="inventory">
                <div class="slot"></div>
                <div class="slot"></div>
            </div>
        `;
        inventory.inventorySlots[0] = { type: 1, count: 1 };
        inventory.inventorySlots[1] = { type: 3, count: 1 };
        inventory.updateInventoryUI();
        const unchangedIcon = document.querySelectorAll('.slot-color-preview')[1].firstElementChild;
        const drops = [{ blockType: 1 }];

        tryCollectDroppedItem(drops, 0, () => {});

        expect(document.querySelectorAll('.slot-color-preview')[1].firstElementChild).toBe(unchangedIcon);
    });

    it('gives painterly drops a restrained individual motion', () => {
        const drop = {
            blockType: 22,
            age: 1,
            mesh: { rotation: { x: 0, y: 0, z: 0 } }
        };

        updateDroppedItemVisual(drop, 0.25);

        expect(drop.mesh.rotation.y).toBeGreaterThan(0);
        expect(Math.abs(drop.mesh.rotation.z)).toBeLessThanOrEqual(0.09);
        expect(drop.visualPhase).toBeTypeOf('number');
    });
});
